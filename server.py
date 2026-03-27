import asyncio
import base64
import json
import logging
import os
import sys
import time
import traceback
from collections import defaultdict
from typing import AsyncIterator

from dotenv import load_dotenv

# ── Paths: support both normal and PyInstaller bundled mode ──
if getattr(sys, "frozen", False):
    # Running as PyInstaller bundle
    _SCRIPT_DIR = os.path.dirname(sys.executable)
    _STATIC_DIR = os.path.join(sys._MEIPASS, "static")
else:
    _SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
    _STATIC_DIR = os.path.join(_SCRIPT_DIR, "static")

CONFIG_FILE = os.path.join(_SCRIPT_DIR, "config.json")

# Load .env (fallback for dev mode)
load_dotenv(os.path.join(_SCRIPT_DIR, ".env"))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("voxtral")
from fastapi import FastAPI, Form, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
try:
    # mistralai v2.x (new package layout)
    from mistralai.client import Mistral
    from mistralai.client.models import (
        AudioFormat,
        RealtimeTranscriptionError,
        RealtimeTranscriptionSessionCreated,
        TranscriptionStreamDone,
        TranscriptionStreamTextDelta,
    )
except ImportError:
    # mistralai v1.x (original layout)
    from mistralai import Mistral
    from mistralai.models import (
        AudioFormat,
        RealtimeTranscriptionError,
        RealtimeTranscriptionSessionCreated,
        TranscriptionStreamDone,
        TranscriptionStreamTextDelta,
    )

app = FastAPI()


# ── Rate limiting ──
class RateLimiter:
    """Simple in-memory sliding window rate limiter."""

    def __init__(self):
        self._timestamps: dict[str, list[float]] = defaultdict(list)

    def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> bool:
        """Check if a request is allowed. Returns False if rate limit exceeded."""
        now = time.monotonic()
        cutoff = now - window_seconds
        # Remove expired timestamps
        self._timestamps[key] = [t for t in self._timestamps[key] if t > cutoff]
        if len(self._timestamps[key]) >= max_requests:
            return False
        self._timestamps[key].append(now)
        return True


rate_limiter = RateLimiter()
active_ws_count = 0  # Track concurrent WebSocket connections
MAX_WS_CONNECTIONS = 4  # Allow active + reconnect overlap (dual-delay uses 2 Mistral streams per session)

REALTIME_MODEL_DEFAULT = "voxtral-mini-transcribe-realtime-2602"
BATCH_MODEL_DEFAULT = "voxtral-mini-latest"
CORRECT_MODEL_DEFAULT = "mistral-small-latest"
BATCH_LANGUAGE_DEFAULT = "nl"
AUDIO_FORMAT = AudioFormat(encoding="pcm_s16le", sample_rate=16000)

# Local vLLM backend defaults
LOCAL_BACKEND_DEFAULT = "mistral-api"  # "mistral-api" or "local-vllm"
LOCAL_SERVER_URL_DEFAULT = "http://localhost:8000"


# ── API key management ──
def load_config() -> dict:
    """Load config from config.json, fall back to .env."""
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def save_config(cfg: dict):
    """Save config to config.json."""
    with open(CONFIG_FILE, "w") as f:
        json.dump(cfg, f, indent=2)


def get_api_key() -> str:
    """Get API key: config.json takes priority, then .env / env var."""
    cfg = load_config()
    key = cfg.get("api_key", "")
    if key:
        return key
    return os.environ.get("MISTRAL_API_KEY", "")


def _cfg_or_env(cfg_key: str, env_key: str, default: str) -> str:
    """Read a setting: config.json → env var → default."""
    cfg = load_config()
    val = cfg.get(cfg_key, "")
    if val:
        return val
    return os.environ.get(env_key, default)


def get_language() -> str:
    return _cfg_or_env("language", "VOXTRAL_LANGUAGE", BATCH_LANGUAGE_DEFAULT)


def get_realtime_model() -> str:
    return _cfg_or_env("realtime_model", "VOXTRAL_REALTIME_MODEL", REALTIME_MODEL_DEFAULT)


def get_batch_model() -> str:
    return _cfg_or_env("batch_model", "VOXTRAL_BATCH_MODEL", BATCH_MODEL_DEFAULT)


def get_correct_model() -> str:
    return _cfg_or_env("correct_model", "VOXTRAL_CORRECT_MODEL", CORRECT_MODEL_DEFAULT)


def get_backend() -> str:
    return _cfg_or_env("backend", "VOXTRAL_BACKEND", LOCAL_BACKEND_DEFAULT)


def get_local_server_url() -> str:
    return _cfg_or_env("local_server_url", "VOXTRAL_LOCAL_SERVER_URL", LOCAL_SERVER_URL_DEFAULT)


def get_client() -> Mistral:
    """Create a fresh Mistral client with the current API key."""
    return Mistral(api_key=get_api_key())


# ── API routes ──
@app.get("/api/health")
async def health():
    key = get_api_key()
    if not key:
        return JSONResponse({"status": "no_key", "message": "API key niet ingesteld"}, status_code=200)
    return {"status": "ok"}


@app.get("/api/settings")
async def get_settings():
    """Return current settings (API key masked)."""
    key = get_api_key()
    if key:
        masked = key[:4] + "•" * (len(key) - 8) + key[-4:] if len(key) > 8 else "••••"
    else:
        masked = ""
    return {
        "has_key": bool(key),
        "masked_key": masked,
        "language": get_language(),
        "realtime_model": get_realtime_model(),
        "batch_model": get_batch_model(),
        "correct_model": get_correct_model(),
        "backend": get_backend(),
        "local_server_url": get_local_server_url(),
    }


@app.get("/api/models")
async def list_models():
    """Return available Mistral models with their capabilities."""
    key = get_api_key()
    if not key:
        return JSONResponse({"error": "Geen API key ingesteld"}, status_code=400)
    try:
        client = Mistral(api_key=key)
        result = client.models.list()
        models = []
        for m in result.data:
            caps = {}
            if hasattr(m, "capabilities") and m.capabilities:
                caps = {k: v for k, v in vars(m.capabilities).items() if isinstance(v, bool)}
            models.append({"id": m.id, "capabilities": caps})
        models.sort(key=lambda x: x["id"])
        return {"models": models}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/api/settings")
async def save_settings(body: dict):
    """Save API key to config.json."""
    if not rate_limiter.is_allowed("settings", max_requests=5, window_seconds=60):
        return JSONResponse({"error": "Te veel verzoeken, probeer later opnieuw"}, status_code=429)
    cfg = load_config()

    # Save language if provided
    language = body.get("language", "").strip()
    if language:
        cfg["language"] = language

    # Save model selections if provided
    for cfg_key, body_key in [
        ("realtime_model", "realtime_model"),
        ("batch_model", "batch_model"),
        ("correct_model", "correct_model"),
    ]:
        val = body.get(body_key, "").strip()
        if val:
            cfg[cfg_key] = val

    # Save backend selection if provided
    backend = body.get("backend", "").strip()
    if backend in ("mistral-api", "local-vllm"):
        cfg["backend"] = backend

    # Save local server URL if provided
    local_url = body.get("local_server_url", "").strip()
    if local_url:
        cfg["local_server_url"] = local_url

    # Save API key if provided (with validation)
    api_key = body.get("api_key", "").strip()
    if api_key:
        try:
            test_client = Mistral(api_key=api_key)
            test_client.models.list()
        except Exception as e:
            return JSONResponse({"error": f"Ongeldige API key: {e}"}, status_code=400)
        cfg["api_key"] = api_key

    has_model_change = any(body.get(k, "").strip() for k in ("realtime_model", "batch_model", "correct_model"))
    has_backend_change = backend or local_url
    if not api_key and not language and not has_model_change and not has_backend_change:
        return JSONResponse({"error": "Geen instellingen opgegeven"}, status_code=400)

    save_config(cfg)
    return {"status": "ok", "message": "Instellingen opgeslagen"}



DEFAULT_CORRECT_PROMPT = (
    "Je bent een nauwkeurige tekstcorrector voor Nederlands. "
    "Corrigeer ALLEEN:\n"
    "- Capitalisatie (hoofdletters aan het begin van zinnen, eigennamen)\n"
    "- Duidelijk verkeerd geschreven of verminkte woorden (door spraakherkenning)\n"
    "- Ontbrekende of verkeerde leestekens\n\n"
    "NIET veranderen:\n"
    "- Zinsstructuur of woordvolgorde\n"
    "- Stijl of toon\n"
    "- Markdown opmaak (# koppen, - lijstjes, - [ ] to-do items)\n\n"
    "INLINE CORRECTIE-INSTRUCTIES:\n"
    "De tekst is gedicteerd via spraakherkenning. De spreker geeft soms inline instructies "
    "of correcties die voor jou bedoeld zijn. Herken deze patronen:\n"
    "- Expliciete markers: 'voor de correctie', 'voor de controle achteraf', "
    "'voor de correctie achteraf', 'correctie-instructie', 'noot voor de corrector', "
    "'voor de automatische correctie'\n"
    "- Gespelde woorden: 'V-O-X-T-R-A-L' of 'met een x' → voeg samen tot het bedoelde woord\n"
    "- Zelfcorrecties: 'nee niet X maar Y', 'ik bedoel Y', 'dat moet Z zijn'\n"
    "- Meta-commentaar over het dicteren: 'dat is een Nederlands woord', 'met een hoofdletter'\n\n"
    "Als je zulke instructies of meta-commentaar tegenkomt:\n"
    "1. Volg de instructie op bij het corrigeren van de REST van de tekst\n"
    "2. Verwijder de instructie/het meta-commentaar zelf volledig uit de output\n"
    "3. Behoud alle inhoudelijke tekst — verwijder NOOIT gewone zinnen\n\n"
    "Geef ALLEEN de gecorrigeerde tekst terug, zonder uitleg."
)


@app.post("/api/correct")
async def correct_text(body: dict):
    """Correct text using Mistral chat model."""
    if not rate_limiter.is_allowed("correct", max_requests=10, window_seconds=60):
        return JSONResponse({"error": "Te veel verzoeken, probeer later opnieuw"}, status_code=429)
    text = body.get("text", "").strip()
    if not text:
        return JSONResponse({"error": "Geen tekst opgegeven"}, status_code=400)

    system_prompt = body.get("system_prompt", "").strip()
    full_prompt = DEFAULT_CORRECT_PROMPT
    if system_prompt:
        full_prompt += f"\n\nExtra context/jargon van de gebruiker:\n{system_prompt}"

    try:
        client = get_client()
        response = client.chat.complete(
            model=get_correct_model(),
            messages=[
                {"role": "system", "content": full_prompt},
                {"role": "user", "content": text},
            ],
            temperature=0.1,
        )
        corrected = response.choices[0].message.content.strip()
        return {"corrected": corrected}
    except Exception as e:
        logger.error(f"Correction failed:\n{traceback.format_exc()}")
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/api/transcribe")
async def transcribe_batch(file: UploadFile, diarize: bool = Form(False)):
    """Batch transcription for offline-queued recordings."""
    if not rate_limiter.is_allowed("transcribe", max_requests=10, window_seconds=60):
        return JSONResponse({"error": "Te veel verzoeken, probeer later opnieuw"}, status_code=429)
    try:
        client = get_client()
        content = await file.read()
        kwargs = dict(
            model=get_batch_model(),
            file={"content": content, "file_name": file.filename or "audio.webm"},
            language=get_language(),
        )
        if diarize:
            kwargs["diarize"] = True
            kwargs["timestamp_granularities"] = ["segment"]

        result = client.audio.transcriptions.complete(**kwargs)

        if diarize and hasattr(result, "segments") and result.segments:
            # Build text with speaker labels
            segments = []
            current_speaker = None
            for seg in result.segments:
                speaker = getattr(seg, "speaker_id", None) or getattr(seg, "speaker", None)
                text = seg.text.strip() if hasattr(seg, "text") else ""
                if not text:
                    continue
                if speaker != current_speaker:
                    current_speaker = speaker
                    label = f"Spreker {speaker}" if speaker is not None else "Spreker"
                    segments.append({"speaker": label, "text": text})
                else:
                    segments[-1]["text"] += " " + text
            return {"text": result.text, "segments": segments}

        return {"text": result.text}
    except Exception as e:
        logger.error(f"Batch transcription failed:\n{traceback.format_exc()}")
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/api/local-health")
async def local_health():
    """Check if the local vLLM server is reachable."""
    import urllib.request

    url = get_local_server_url()
    try:
        req = urllib.request.Request(f"{url}/health", method="GET")
        req.add_header("Accept", "application/json")
        with urllib.request.urlopen(req, timeout=5) as resp:
            return {"status": "ok", "url": url, "server_status": resp.status}
    except Exception as e:
        return JSONResponse(
            {"status": "unreachable", "url": url, "error": str(e)},
            status_code=200,  # Not a server error — informational
        )


# ── Local vLLM server management (Windows/WSL) ──

_vllm_process: "asyncio.subprocess.Process | None" = None


def _is_windows() -> bool:
    return sys.platform == "win32"


@app.get("/api/local-setup")
async def local_setup():
    """Detect WSL and vLLM installation status (Windows only).

    Returns a status object describing what's installed and what's missing,
    so the frontend can show appropriate setup instructions.
    """
    if not _is_windows():
        return {
            "platform": "linux",
            "wsl": "not_needed",
            "vllm": "unknown",
            "message": "Je draait al op Linux — WSL is niet nodig.",
        }

    result = {
        "platform": "windows",
        "wsl": "not_installed",
        "vllm": "not_installed",
        "venv": False,
        "model_downloaded": False,
    }

    # Check WSL
    try:
        proc = await asyncio.create_subprocess_exec(
            "wsl", "--status",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=10)
        if proc.returncode == 0:
            result["wsl"] = "installed"
        else:
            return result  # WSL not installed — can't check further
    except (FileNotFoundError, asyncio.TimeoutError):
        return result

    # Check if venv exists
    try:
        proc = await asyncio.create_subprocess_exec(
            "wsl", "bash", "-c", "test -f ~/vllm-env/bin/activate && echo yes || echo no",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=10)
        result["venv"] = stdout.decode().strip() == "yes"
    except (FileNotFoundError, asyncio.TimeoutError):
        pass

    # Check if vllm is installed in the venv
    if result["venv"]:
        try:
            proc = await asyncio.create_subprocess_exec(
                "wsl", "bash", "-c",
                "source ~/vllm-env/bin/activate && python -c 'import vllm; print(vllm.__version__)' 2>/dev/null",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=15)
            version = stdout.decode().strip()
            if version and proc.returncode == 0:
                result["vllm"] = "installed"
                result["vllm_version"] = version
        except (FileNotFoundError, asyncio.TimeoutError):
            pass

    # Check if model is already downloaded (look in HuggingFace cache)
    try:
        proc = await asyncio.create_subprocess_exec(
            "wsl", "bash", "-c",
            "ls -d ~/.cache/huggingface/hub/models--mistralai--Voxtral-Mini-4B-Realtime-2602 2>/dev/null && echo found || echo missing",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=10)
        result["model_downloaded"] = "found" in stdout.decode()
    except (FileNotFoundError, asyncio.TimeoutError):
        pass

    return result


@app.post("/api/local-start")
async def local_start(body: dict = None):
    """Start the vLLM server inside WSL (Windows) or directly (Linux).

    The server process runs in the background. Use /api/local-health to
    check when it's ready. Use /api/local-stop to shut it down.
    """
    global _vllm_process

    if _vllm_process is not None and _vllm_process.returncode is None:
        return {"status": "already_running", "message": "vLLM server draait al"}

    body = body or {}
    max_model_len = int(body.get("max_model_len", 8000))
    # Sanitize to prevent command injection
    if max_model_len < 1000 or max_model_len > 200000:
        max_model_len = 8000

    model = "mistralai/Voxtral-Mini-4B-Realtime-2602"

    if _is_windows():
        # Launch via WSL
        cmd = (
            f"source ~/vllm-env/bin/activate && "
            f"vllm serve {model} "
            f"--enforce-eager "
            f"--max-model-len {max_model_len} "
            f"--host 0.0.0.0 --port 8000"
        )
        try:
            _vllm_process = await asyncio.create_subprocess_exec(
                "wsl", "bash", "-c", cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
        except FileNotFoundError:
            return JSONResponse(
                {"status": "error", "message": "WSL niet gevonden. Installeer WSL eerst."},
                status_code=400,
            )
    else:
        # Direct Linux launch
        venv_activate = os.path.expanduser("~/vllm-env/bin/activate")
        if os.path.exists(venv_activate):
            cmd = f"source {venv_activate} && "
        else:
            cmd = ""
        cmd += (
            f"vllm serve {model} "
            f"--enforce-eager "
            f"--max-model-len {max_model_len} "
            f"--host 0.0.0.0 --port 8000"
        )
        _vllm_process = await asyncio.create_subprocess_shell(
            cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

    logger.info(f"vLLM server starting (PID: {_vllm_process.pid}, max_model_len={max_model_len})")
    return {
        "status": "starting",
        "pid": _vllm_process.pid,
        "max_model_len": max_model_len,
        "message": "vLLM server wordt gestart. Model wordt geladen...",
    }


@app.post("/api/local-stop")
async def local_stop():
    """Stop the vLLM server process."""
    global _vllm_process

    if _vllm_process is None or _vllm_process.returncode is not None:
        _vllm_process = None
        return {"status": "not_running", "message": "vLLM server draait niet"}

    logger.info(f"Stopping vLLM server (PID: {_vllm_process.pid})")
    try:
        _vllm_process.terminate()
        try:
            await asyncio.wait_for(_vllm_process.wait(), timeout=10)
        except asyncio.TimeoutError:
            _vllm_process.kill()
            await _vllm_process.wait()
    except ProcessLookupError:
        pass  # Already exited

    _vllm_process = None
    return {"status": "stopped", "message": "vLLM server gestopt"}


@app.get("/api/local-status")
async def local_server_status():
    """Check if the managed vLLM process is still running."""
    global _vllm_process

    if _vllm_process is None:
        return {"running": False, "managed": False}

    if _vllm_process.returncode is not None:
        # Process exited — try to capture why
        stderr_snippet = ""
        if _vllm_process.stderr:
            try:
                raw = await asyncio.wait_for(_vllm_process.stderr.read(2000), timeout=1)
                stderr_snippet = raw.decode(errors="replace").strip()[-500:]
            except (asyncio.TimeoutError, Exception):
                pass
        _vllm_process = None
        return {"running": False, "managed": True, "exit_code": _vllm_process.returncode if _vllm_process else -1, "error": stderr_snippet}

    return {"running": True, "managed": True, "pid": _vllm_process.pid}


# ── vLLM WebSocket proxy ──

async def _vllm_realtime_proxy(
    websocket: WebSocket,
    delay_ms: int,
    label: str | None = None,
):
    """Proxy browser audio to a local vLLM /v1/realtime WebSocket endpoint.

    Translates between:
    - Browser → server: raw PCM bytes
    - Server → vLLM:    JSON {"type": "input_audio.append", "audio": "<base64>"}
    - vLLM → server:    JSON {"type": "transcription.text.delta", "text": "..."}
    - Server → browser: JSON {"type": "delta", "text": "...", "stream": "<label>"}
    """
    import websockets

    base_url = get_local_server_url()
    # Convert http(s) to ws(s)
    ws_url = base_url.replace("https://", "wss://").replace("http://", "ws://")
    vllm_url = f"{ws_url}/v1/realtime"

    logger.info(f"Connecting to local vLLM: {vllm_url} (delay={delay_ms}ms, stream={label or 'single'})")

    vllm_ws = None
    ws_closed = False

    def _build_msg(msg_type: str, text: str = "") -> dict:
        """Build a message dict, adding stream label if present."""
        d: dict = {"type": msg_type}
        if text:
            d["text"] = text
        if label:
            d["stream"] = label
        return d

    try:
        vllm_ws = await websockets.connect(vllm_url, max_size=10 * 1024 * 1024)

        # Send session config
        session_update = {
            "type": "session.update",
            "session": {
                "audio_format": {
                    "encoding": "pcm_s16le",
                    "sample_rate": 16000,
                },
                "target_streaming_delay_ms": delay_ms,
            },
        }
        await vllm_ws.send(json.dumps(session_update))

        # Notify browser that session is ready
        await websocket.send_json(_build_msg("session_created"))

        async def forward_audio():
            """Receive PCM from browser, base64-encode, forward to vLLM."""
            nonlocal ws_closed
            try:
                while True:
                    data = await websocket.receive_bytes()
                    audio_b64 = base64.b64encode(data).decode("ascii")
                    msg = json.dumps({
                        "type": "input_audio.append",
                        "audio": audio_b64,
                    })
                    await vllm_ws.send(msg)
            except WebSocketDisconnect:
                ws_closed = True
                # Signal end of audio to vLLM
                try:
                    await vllm_ws.send(json.dumps({"type": "input_audio.end"}))
                except Exception:
                    pass
            except Exception:
                ws_closed = True

        async def forward_transcription():
            """Receive transcription events from vLLM, forward to browser."""
            nonlocal ws_closed
            try:
                async for raw_msg in vllm_ws:
                    if ws_closed:
                        break
                    msg = json.loads(raw_msg)
                    msg_type = msg.get("type", "")

                    if msg_type == "transcription.text.delta":
                        await websocket.send_json(
                            _build_msg("delta", msg.get("text", ""))
                        )
                    elif msg_type == "transcription.done":
                        await websocket.send_json(
                            _build_msg("done", msg.get("text", ""))
                        )
                    elif msg_type == "error":
                        err_msg = msg.get("error", {})
                        if isinstance(err_msg, dict):
                            err_msg = err_msg.get("message", str(err_msg))
                        logger.error(f"vLLM error: {err_msg}")
                        await websocket.send_json(
                            _build_msg("error", str(err_msg))
                        )
                    elif msg_type == "session.created":
                        # vLLM may also send session.created — already handled above
                        pass
                    elif msg_type == "session.updated":
                        logger.debug(f"vLLM session updated: {msg}")
                    else:
                        logger.debug(f"vLLM unknown message: {msg_type}")
            except websockets.ConnectionClosed:
                if not ws_closed:
                    logger.info("vLLM WebSocket closed")
            except Exception as e:
                if not ws_closed:
                    logger.error(f"vLLM forward error: {e}")
                    try:
                        await websocket.send_json(
                            _build_msg("error", str(e))
                        )
                    except Exception:
                        pass

        # Run both directions concurrently
        await asyncio.gather(forward_audio(), forward_transcription())

    except Exception as e:
        logger.error(f"vLLM proxy failed:\n{traceback.format_exc()}")
        if not ws_closed:
            try:
                await websocket.send_json(
                    _build_msg("error", f"Lokale server niet bereikbaar: {e}")
                )
            except Exception:
                pass
    finally:
        if vllm_ws:
            try:
                await vllm_ws.close()
            except Exception:
                pass


@app.websocket("/ws/transcribe")
async def ws_transcribe(websocket: WebSocket):
    """Realtime transcription via WebSocket. Browser sends PCM s16le 16kHz mono chunks."""
    global active_ws_count

    # Reject if too many concurrent connections
    if active_ws_count >= MAX_WS_CONNECTIONS:
        await websocket.close(code=1013, reason="Te veel gelijktijdige verbindingen")
        logger.warning(f"WebSocket rejected: {active_ws_count} active connections (max {MAX_WS_CONNECTIONS})")
        return

    await websocket.accept()
    active_ws_count += 1
    logger.info(f"WebSocket connected ({active_ws_count}/{MAX_WS_CONNECTIONS} active)")

    # Read delay from query parameter (default 1000ms)
    delay_ms = int(websocket.query_params.get("delay", "1000"))

    # Route to local vLLM backend if configured
    if get_backend() == "local-vllm":
        try:
            await _vllm_realtime_proxy(websocket, delay_ms)
        finally:
            active_ws_count -= 1
            logger.info(f"WebSocket closed ({active_ws_count}/{MAX_WS_CONNECTIONS} active)")
        return

    audio_queue: asyncio.Queue[bytes | None] = asyncio.Queue()
    ws_closed = False  # Guard: prevent sending after client disconnects

    async def audio_stream() -> AsyncIterator[bytes]:
        while True:
            chunk = await audio_queue.get()
            if chunk is None:
                return
            yield chunk

    async def receive_audio():
        nonlocal ws_closed
        try:
            while True:
                data = await websocket.receive_bytes()
                await audio_queue.put(data)
        except WebSocketDisconnect:
            ws_closed = True
            await audio_queue.put(None)
        except Exception:
            ws_closed = True
            await audio_queue.put(None)

    receiver = asyncio.create_task(receive_audio())

    try:
        client = get_client()
        logger.info("Starting Mistral realtime transcription stream...")
        async for event in client.audio.realtime.transcribe_stream(
            audio_stream=audio_stream(),
            model=get_realtime_model(),
            audio_format=AUDIO_FORMAT,
            target_streaming_delay_ms=delay_ms,
        ):
            if ws_closed:
                logger.info("Client disconnected, stopping event processing")
                break
            logger.info(f"Event received: {type(event).__name__}")
            if isinstance(event, TranscriptionStreamTextDelta):
                await websocket.send_json({"type": "delta", "text": event.text})
            elif isinstance(event, TranscriptionStreamDone):
                await websocket.send_json({"type": "done", "text": event.text})
            elif isinstance(event, RealtimeTranscriptionSessionCreated):
                await websocket.send_json({"type": "session_created"})
            elif isinstance(event, RealtimeTranscriptionError):
                logger.error(f"Transcription error event: {event}")
                await websocket.send_json({"type": "error", "message": str(event)})
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected by client")
    except Exception as e:
        logger.error(f"Realtime transcription failed:\n{traceback.format_exc()}")
        if not ws_closed:
            try:
                await websocket.send_json({"type": "error", "message": str(e)})
            except Exception:
                pass
    finally:
        active_ws_count -= 1
        logger.info(f"WebSocket closed ({active_ws_count}/{MAX_WS_CONNECTIONS} active)")
        receiver.cancel()


@app.websocket("/ws/transcribe-dual")
async def ws_transcribe_dual(websocket: WebSocket):
    """Dual-delay realtime transcription: two parallel Mistral streams (fast + slow).

    The fast stream (low delay) provides immediate feedback.
    The slow stream (high delay) provides more accurate text that replaces the fast output.
    Both receive identical audio data.
    """
    global active_ws_count

    if active_ws_count >= MAX_WS_CONNECTIONS:
        await websocket.close(code=1013, reason="Te veel gelijktijdige verbindingen")
        return

    await websocket.accept()
    active_ws_count += 1
    logger.info(f"Dual-delay WebSocket connected ({active_ws_count}/{MAX_WS_CONNECTIONS} active)")

    fast_delay = int(websocket.query_params.get("fast_delay", "240"))
    slow_delay = int(websocket.query_params.get("slow_delay", "2400"))

    # Route to local vLLM backend if configured
    if get_backend() == "local-vllm":
        try:
            # For dual-delay over vLLM we need to duplicate audio to two proxy sessions.
            # This is complex — for now, fall back to single-stream with the fast delay
            # and log a warning. Full dual-delay vLLM support can be added later.
            logger.warning("Dual-delay not yet supported with local vLLM — using single stream with fast delay")
            await _vllm_realtime_proxy(websocket, fast_delay)
        finally:
            active_ws_count -= 1
            logger.info(f"Dual-delay WebSocket closed ({active_ws_count}/{MAX_WS_CONNECTIONS} active)")
        return

    # Two queues: audio is duplicated to both streams
    fast_queue: asyncio.Queue[bytes | None] = asyncio.Queue()
    slow_queue: asyncio.Queue[bytes | None] = asyncio.Queue()
    ws_closed = False

    def make_audio_stream(queue: asyncio.Queue) -> AsyncIterator[bytes]:
        async def stream() -> AsyncIterator[bytes]:
            while True:
                chunk = await queue.get()
                if chunk is None:
                    return
                yield chunk
        return stream()

    async def receive_audio():
        nonlocal ws_closed
        try:
            while True:
                data = await websocket.receive_bytes()
                await fast_queue.put(data)
                await slow_queue.put(data)
        except WebSocketDisconnect:
            ws_closed = True
            await fast_queue.put(None)
            await slow_queue.put(None)
        except Exception:
            ws_closed = True
            await fast_queue.put(None)
            await slow_queue.put(None)

    async def run_stream(label: str, delay_ms: int, queue: asyncio.Queue):
        """Run a single Mistral realtime stream, tagging events with the stream label."""
        try:
            client = get_client()
            logger.info(f"Starting {label} stream (delay={delay_ms}ms)...")
            async for event in client.audio.realtime.transcribe_stream(
                audio_stream=make_audio_stream(queue),
                model=get_realtime_model(),
                audio_format=AUDIO_FORMAT,
                target_streaming_delay_ms=delay_ms,
            ):
                if ws_closed:
                    break
                if isinstance(event, TranscriptionStreamTextDelta):
                    await websocket.send_json({"type": "delta", "text": event.text, "stream": label})
                elif isinstance(event, TranscriptionStreamDone):
                    await websocket.send_json({"type": "done", "text": event.text, "stream": label})
                elif isinstance(event, RealtimeTranscriptionSessionCreated):
                    await websocket.send_json({"type": "session_created", "stream": label})
                elif isinstance(event, RealtimeTranscriptionError):
                    logger.error(f"{label} stream error: {event}")
                    await websocket.send_json({"type": "error", "message": str(event), "stream": label})
        except Exception as e:
            logger.error(f"{label} stream failed:\n{traceback.format_exc()}")
            if not ws_closed:
                try:
                    await websocket.send_json({"type": "error", "message": str(e), "stream": label})
                except Exception:
                    pass

    receiver = asyncio.create_task(receive_audio())

    try:
        # Run both streams concurrently
        await asyncio.gather(
            run_stream("fast", fast_delay, fast_queue),
            run_stream("slow", slow_delay, slow_queue),
        )
    except WebSocketDisconnect:
        logger.info("Dual-delay WebSocket disconnected by client")
    finally:
        active_ws_count -= 1
        logger.info(f"Dual-delay WebSocket closed ({active_ws_count}/{MAX_WS_CONNECTIONS} active)")
        receiver.cancel()


# ── Shutdown endpoint (for windowed/PyInstaller builds) ──

@app.post("/api/shutdown")
async def shutdown():
    """Gracefully shut down the server."""
    if not rate_limiter.is_allowed("shutdown", max_requests=2, window_seconds=60):
        return JSONResponse({"error": "Te veel verzoeken"}, status_code=429)

    import signal
    import threading

    logger.info("Shutdown requested via /api/shutdown")

    def _stop():
        os.kill(os.getpid(), signal.SIGTERM)

    # Delay slightly so the HTTP response can be sent first
    threading.Timer(0.5, _stop).start()
    return {"status": "shutting down"}


# Serve static files (must be last to not override API routes)
app.mount("/", StaticFiles(directory=_STATIC_DIR, html=True), name="static")

if __name__ == "__main__":
    import signal
    import threading
    import webbrowser

    import uvicorn

    # In windowed mode (PyInstaller --windowed), sys.stdout/stderr are None.
    # Uvicorn's logger calls sys.stderr.isatty() which crashes on None.
    # Redirect to devnull so logging works silently.
    if sys.stdout is None:
        sys.stdout = open(os.devnull, "w")
    if sys.stderr is None:
        sys.stderr = open(os.devnull, "w")

    # In windowed mode (no console), redirect crash logs to a file
    _LOG_FILE = os.path.join(_SCRIPT_DIR, "error.log")

    port = int(os.environ.get("PORT", 8000))
    url = f"http://127.0.0.1:{port}"

    # ── System tray icon ──

    def _create_tray_icon():
        """Create a system tray icon with Open/Quit menu.

        Falls back gracefully if pystray is not installed (e.g. dev mode
        without Pillow/pystray) — the server still runs, just without tray.
        """
        try:
            import pystray
            from PIL import Image, ImageDraw
        except ImportError as e:
            logger.info(f"pystray/Pillow not available, skipping tray icon: {e}")
            return None

        try:
            # Draw a simple microphone-style icon (green circle)
            size = 64
            img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
            draw = ImageDraw.Draw(img)
            draw.ellipse([8, 8, size - 8, size - 8], fill=(76, 175, 80))
            # White mic shape (simplified)
            cx, cy = size // 2, size // 2
            draw.rounded_rectangle(
                [cx - 6, cy - 16, cx + 6, cy + 4],
                radius=6,
                fill="white",
            )
            draw.rectangle([cx - 1, cy + 4, cx + 1, cy + 12], fill="white")
            draw.rectangle([cx - 8, cy + 12, cx + 8, cy + 14], fill="white")

            def on_open(_icon, _item):
                webbrowser.open(url)

            def on_quit(_icon, _item):
                logger.info("Quit requested from system tray")
                _icon.stop()
                os.kill(os.getpid(), signal.SIGTERM)

            icon = pystray.Icon(
                "voxtral",
                img,
                "Voxtral Transcribe",
                menu=pystray.Menu(
                    pystray.MenuItem("Openen in browser", on_open, default=True),
                    pystray.Menu.SEPARATOR,
                    pystray.MenuItem("Afsluiten", on_quit),
                ),
            )
            return icon
        except Exception as e:
            logger.error(f"Failed to create tray icon: {e}")
            return None

    try:
        # Start uvicorn in a daemon thread
        server_config = uvicorn.Config(
            app, host="127.0.0.1", port=port, log_level="info"
        )
        server = uvicorn.Server(server_config)

        server_thread = threading.Thread(target=server.run, daemon=True)
        server_thread.start()

        # Open browser after a short delay
        if os.environ.get("VOXTRAL_NO_BROWSER") != "1":
            threading.Timer(1.5, webbrowser.open, args=[url]).start()
            logger.info(f"Opening browser at {url}")

        # Run system tray on the main thread (required by Windows)
        tray_icon = _create_tray_icon()
        if tray_icon:
            logger.info("System tray icon active — right-click to quit")
            tray_icon.run()
        else:
            # No tray available — just wait for the server thread
            server_thread.join()

    except Exception:
        traceback.print_exc()
        try:
            with open(_LOG_FILE, "a", encoding="utf-8") as f:
                f.write(f"\n{'='*60}\n")
                f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')}\n")
                traceback.print_exc(file=f)
        except Exception:
            pass
        try:
            input("\nDruk op Enter om te sluiten...")
        except (EOFError, RuntimeError):
            pass  # no console (windowed mode)
