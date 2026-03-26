# Feature: Lokale transcriptie met Voxtral Mini 4B Realtime 2602

## Samenvatting

Het Voxtral Mini 4B Realtime 2602 model is open-source (Apache 2.0) en kan lokaal draaien. Dit document verkent de mogelijkheden om het model te integreren als alternatief voor de Mistral API, zodat gebruikers offline en privacyvriendelijk kunnen transcriberen.

De integratie wordt in drie deployment-scenario's verkend:
1. **Lokale GPU** (eGPU / dedicated GPU)
2. **Eigen VPS** met GPU (cloud-hosted, maar eigen beheer)
3. **Mistral API** (huidige situatie, als fallback)

---

## 1. Model overzicht

| Eigenschap | Waarde |
|---|---|
| **Model** | `mistralai/Voxtral-Mini-4B-Realtime-2602` |
| **Parameters** | 4 miljard |
| **Architectuur** | Causale audio encoder + Mistral LM decoder |
| **Licentie** | Apache 2.0 |
| **Talen** | 13 (NL, EN, FR, DE, ES, PT, IT, RU, ZH, JA, KO, HI, AR) |
| **Latency** | Configureerbaar 240ms – 2400ms (sweet spot: 480ms) |
| **Audio-invoer** | PCM s16le, 16kHz, mono |
| **Modelgrootte** | ~8.9 GB (BF16 weights) |

Het model heeft dezelfde talen als onze plugin al ondersteunt en gebruikt exact hetzelfde audioformaat (PCM s16le, 16kHz, mono) dat de plugin al produceert via AudioWorklet.

---

## 2. Opties voor lokale inferentie

### 2a. vLLM (meest volwassen)

- **Status:** Productie-klaar, officieel ondersteund door Mistral
- **Endpoint:** `ws://localhost:8000/v1/realtime` (WebSocket) + `POST /v1/audio/transcriptions` (batch)
- **Protocol:** Nagenoeg identiek aan Mistral API (dezelfde message types)
- **VRAM:** Minimaal 16GB GPU, maar in praktijk ~35GB door KV-cache pre-allocatie (instelbaar via `--max-model-len`)
- **Installatie:** `uv pip install vllm[audio]` → `vllm serve mistralai/Voxtral-Mini-4B-Realtime-2602 --enforce-eager`
- **Impact op plugin:** Minimaal — alleen de WebSocket URL wijzigen van `wss://api.mistral.ai/...` naar `ws://localhost:8000/v1/realtime`. Het protocol is compatible.

**Voordeel:** De plugin hoeft nauwelijks aangepast te worden. De `RealtimeTranscriber` class verbindt nu met `wss://api.mistral.ai/v1/audio/transcriptions/realtime` — bij lokaal gebruik wordt dit `ws://localhost:8000/v1/realtime`. De message types (`session.update`, `input_audio.append`, `transcription.text.delta`, `transcription.done`) zijn hetzelfde.

**Nadeel:** Vereist een GPU met voldoende VRAM. Niet geschikt voor laptops zonder dedicated GPU.

### 2b. voxtral.c (puur C, zero dependencies)

- **Status:** Werkend, gemaakt door antirez (Redis-maker), actief onderhouden
- **Platform:** macOS (Metal/MPS), Linux (OpenBLAS)
- **Performance:** ~2.5x sneller dan realtime op M3 Max
- **Geheugen:** ~8.9GB voor model weights
- **Streaming:** Ja, via `--from-mic` of `--stdin` met configureerbare interval (`-I` flag)
- **Impact op plugin:** Er zou een wrapper/bridge nodig zijn (child process of lokale HTTP/WS server die voxtral.c aanstuurt)

**Voordeel:** Geen Python, geen GPU driver stack nodig. Draait op Apple Silicon met Metal.

**Nadeel:** Geen native WebSocket server — vereist een bridge-laag. Alleen macOS (Metal) en Linux (OpenBLAS).

### 2c. Hugging Face Transformers

- **Status:** Recent toegevoegd (Transformers v5), werkend voor batch-transcriptie
- **Klasse:** `VoxtralRealtimeForConditionalGeneration` + `AutoProcessor`
- **VRAM:** ~16GB (BF16)
- **Streaming:** Beperkt — Transformers is primair batch-gericht. Real-time streaming vereist custom code.
- **Impact op plugin:** Zou een Python-backend vereisen die de Transformers pipeline draait en een WebSocket server aanbiedt.

**Voordeel:** Bekend ecosysteem, makkelijk te quantizen (4-bit, 8-bit).

**Nadeel:** Geen native streaming support. Extra Python backend nodig.

### 2d. GGUF (gekvantiseerd, community)

- **Status:** Community-builds beschikbaar (`andrijdavid/Voxtral-Mini-4B-Realtime-2602-GGUF`)
- **Formaten:** Q4, Q8, etc.
- **Grootte:** ~2.5 GB (Q4) vs 8.9 GB (BF16)
- **Runtime:** llama.cpp of compatible runtimes
- **Impact op plugin:** Vergelijkbaar met voxtral.c — bridge nodig

**Voordeel:** Veel kleiner, draait op CPU of kleine GPU.

**Nadeel:** Llama.cpp support voor dit model is nog experimenteel.

### 2e. ExecuTorch (Apple-apparaten)

- **Status:** Demo beschikbaar voor MacBook
- **Gebruik:** Offline demo, geoptimaliseerd voor Apple Neural Engine
- **Impact op plugin:** Niet direct bruikbaar vanuit Obsidian

### 2f. Rust/WASM (browser)

- **Status:** Proof-of-concept, Q4 GGUF draait in browser via WebGPU
- **Grootte:** ~2.5 GB download
- **Impact op plugin:** Theoretisch interessant voor Obsidian (Electron = Chromium = WebGPU), maar nog experimenteel

---

## 3. Deployment-scenario's

### 3a. Lokale GPU (eGPU / dedicated)

Gebruiker draait vLLM op eigen hardware. Volledig offline, maximale privacy.

**Hardware-vereisten per GPU-klasse:**

| GPU | VRAM | `--max-model-len` | Sessieduur | Geschiktheid |
|---|---|---|---|---|
| **RTX 5070 Ti** (16GB GDDR7) | ~14-16 GB | 8000-12000 | ~10-16 min | Goed, met tuning |
| **RTX 4090** (24GB) | ~20-24 GB | 8000-16000 | ~10-20 min | Goed |
| **RTX 3090** (24GB) | ~20-24 GB | 8000-16000 | ~10-20 min | Goed, ~30% trager |
| **RTX 4080** (16GB) | ~16 GB | 4000-8000 | ~5-10 min | Krap |
| **A100/A6000** (48GB) | ~35 GB | 45000-131072 | 1-3+ uur | Comfortabel |

De `--max-model-len` bepaalt hoeveel audio-context in het KV-cache past (1 token ≈ 80ms audio). Default 131072 (~3 uur) vreet ~35GB; terugschroeven naar 8000 (~10 min) past op 16GB kaarten.

**eGPU-specifiek:** Thunderbolt 4 (40 Gbps) is geen bottleneck voor inference — weights worden eenmalig naar VRAM geladen, daarna draait alles lokaal op de GPU. Alleen kilobytes aan tokens gaan heen en weer.

**Referentie-setup (Lenovo T14 Gen4 + eGPU RTX 5070 Ti):**
```bash
vllm serve mistralai/Voxtral-Mini-4B-Realtime-2602 \
  --enforce-eager \
  --max-model-len 8000 \
  --gpu-memory-utilization 0.95
```

**voxtral.c op Apple Silicon:**

| Hardware | Geheugen | Performance |
|---|---|---|
| MacBook M3 Max (36GB+) | ~12 GB | 2.5x realtime |
| MacBook M2 Pro (16GB+) | ~12 GB | >1x realtime (verwacht) |
| MacBook M1 Pro (16GB) | ~12 GB | ~1x realtime (krap) |

### 3b. Eigen VPS met GPU

Gebruiker huurt een GPU-server en draait vLLM daarop. Audio gaat via internet, maar naar eigen server — geen derde partij verwerkt de data.

**Kosten-overzicht (maart 2026):**

| Provider | GPU | VRAM | Prijs/uur | Prijs/maand (24/7) | Prijs/maand (8u/dag) |
|---|---|---|---|---|---|
| **RunPod** | RTX 4090 | 24 GB | €0,49 | ~€360 | ~€120 |
| **Vast.ai** | RTX 4090 | 24 GB | €0,35-0,50 | ~€300 | ~€85 |
| **TensorDock** | RTX 4090 | 24 GB | €0,35 | ~€255 | ~€85 |
| **Lambda Labs** | A100 40GB | 40 GB | €1,29 | ~€940 | ~€310 |
| **Jarvislabs** | A100 80GB | 80 GB | €1,49 | ~€1085 | ~€360 |

**Vergelijking met Mistral API:**

| Gebruik | Mistral API kosten | VPS RTX 4090 (on-demand) |
|---|---|---|
| Licht (1 uur/dag) | ~€5-15/maand | ~€10-15/maand |
| Matig (4 uur/dag) | ~€20-50/maand | ~€40-60/maand |
| Zwaar (8+ uur/dag) | ~€50-150/maand | ~€85-120/maand |

**Wanneer is een VPS zinvol?**

- **Privacy:** Audio gaat naar eigen server i.p.v. Mistral. Relevant voor medische/juridische dictatie.
- **Geen lokale GPU:** Laptop zonder eGPU, maar wel behoefte aan lage latency.
- **Langere sessies:** Met 24GB VRAM op een RTX 4090 VPS kun je `--max-model-len 45000` instellen (~1 uur continu).
- **Team-gebruik:** Eén VPS kan meerdere gebruikers bedienen (vLLM ondersteunt concurrent requests).

**Wanneer NIET:**

- **Latency-gevoelig:** Audio moet heen en terug over internet. Bij een Europese VPS: +20-50ms. Bij US-server: +100-200ms. Vergelijk: Mistral API is ~50ms vanuit EU.
- **Kosten:** Voor licht gebruik is de Mistral API goedkoper en eenvoudiger.
- **Complexiteit:** VPS beheer, updates, monitoring. Niet voor niet-technische gebruikers.

**Setup:**
```bash
# Op de VPS:
pip install "vllm[audio]"
vllm serve mistralai/Voxtral-Mini-4B-Realtime-2602 \
  --enforce-eager \
  --max-model-len 45000 \
  --host 0.0.0.0 \
  --port 8000

# Beveilig met reverse proxy (nginx/caddy) + TLS + API key
```

In de plugin/webapp: server-URL wijzigen naar `wss://mijn-vps.example.com/v1/realtime`.

### 3c. Mistral API (huidige situatie, fallback)

Blijft de standaard voor gebruikers zonder eigen hardware. Geen wijziging nodig.

---

## 4. Teststrategie: eerst de webapp

### Waarom de webapp eerst?

De webapp (FastAPI + vanilla JS) is het beste testplatform voor lokale transcriptie:

1. **Snellere iteratiecyclus:** Geen esbuild/Obsidian plugin reload nodig, gewoon server herstarten.
2. **Directe hardware-meting:** Performance-metrics (latency, VRAM) zijn makkelijker te loggen in Python.
3. **Eenvoudiger architectuur:** De webapp's `server.py` fungeert als proxy tussen browser en Mistral SDK — deze proxy-laag is de plek waar we switchen tussen Mistral API en lokale vLLM.
4. **Zelfde audioformaat:** De browser produceert al PCM s16le 16kHz mono via `ScriptProcessorNode` → `downsample()` → `floatTo16BitPCM()`.

### Huidige webapp-architectuur (realtime)

```
Browser (app.js)
  │ WebSocket: ws://localhost:8765/ws/transcribe?delay=480
  │ Stuurt: raw PCM s16le binary chunks
  ▼
server.py (/ws/transcribe)
  │ asyncio queue → audio_stream() generator
  │ client.audio.realtime.transcribe_stream(audio_stream, model, ...)
  ▼
Mistral API (wss://api.mistral.ai)
  │ Retourneert: TranscriptionStreamTextDelta, TranscriptionStreamDone
  ▼
server.py
  │ Stuurt JSON naar browser: {"type": "delta", "text": "..."} / {"type": "done", ...}
  ▼
Browser (app.js)
  │ Toont tekst in editor
```

### Gewenste architectuur met vLLM-backend

```
Browser (app.js)
  │ WebSocket: ws://localhost:8765/ws/transcribe?delay=480
  │ Stuurt: raw PCM s16le binary chunks (ONGEWIJZIGD)
  ▼
server.py (/ws/transcribe)
  │ ALS backend == "vllm":
  │   WebSocket doorsturen naar vLLM (ws://localhost:8000/v1/realtime)
  │   Protocol vertalen: raw PCM → base64 + JSON envelop
  │ ANDERS:
  │   Mistral SDK (huidige code, ONGEWIJZIGD)
  ▼
vLLM server (lokaal of VPS)
  │ Retourneert: transcription.text.delta, transcription.done
  ▼
server.py
  │ Stuurt JSON naar browser: {"type": "delta", "text": "..."} (ONGEWIJZIGD)
  ▼
Browser (app.js)
  │ Toont tekst in editor (ONGEWIJZIGD)
```

### Verschil in protocol: Mistral SDK vs vLLM WebSocket

De server.py gebruikt nu de **Mistral Python SDK** (`client.audio.realtime.transcribe_stream()`) die intern een WebSocket beheert. vLLM biedt een **raw WebSocket** endpoint.

| Aspect | Mistral SDK (huidig) | vLLM WebSocket |
|---|---|---|
| **Verbinding** | SDK beheert intern | Directe WebSocket naar `ws://host:8000/v1/realtime` |
| **Audio sturen** | `audio_stream()` generator (raw bytes) | JSON: `{"type": "input_audio.append", "audio": "<base64>"}` |
| **Session config** | SDK parameters | JSON: `{"type": "session.update", "session": {...}}` |
| **Einde audio** | Generator stopt | JSON: `{"type": "input_audio.end"}` |
| **Ontvangen** | Python event objecten | JSON: `{"type": "transcription.text.delta", "text": "..."}` |

### Wat moet er veranderen in server.py?

Nieuwe functie `vllm_transcribe_stream()` als alternatief voor de Mistral SDK-aanroep:

1. **WebSocket openen** naar vLLM endpoint
2. **Session.update** sturen met audio format + delay
3. **Audio chunks** ontvangen van browser, base64-encoden, doorsturen als JSON
4. **Events** ontvangen van vLLM, vertalen naar huidige `{"type": "delta"/"done", "text": "..."}` formaat
5. **Connection lifecycle** beheren (reconnect, error handling)

Geschatte wijziging: ~80 regels Python in `server.py` + nieuwe config-opties.

### Concrete teststappen

1. **vLLM installeren** op machine met eGPU (RTX 5070 Ti)
2. **Model downloaden** (~9 GB, eenmalig)
3. **vLLM starten** met `--max-model-len 8000 --gpu-memory-utilization 0.95`
4. **Nieuwe endpoint** `/ws/transcribe-local` toevoegen aan server.py (of bestaande endpoint switchen op basis van config)
5. **Testen:** dicteer-sessie van 5 minuten, meet latency, VRAM-gebruik, transcriptiekwaliteit
6. **Vergelijken:** zelfde audio via Mistral API vs lokaal — WER (word error rate), latency

---

## 5. Aanbevolen aanpak voor de plugin (na webapp-validatie)

### Fase 1: vLLM backend (laagste effort, hoogste compatibiliteit)

De snelste weg naar lokale transcriptie:

1. **Nieuwe instelling toevoegen:** `transcriptionBackend: "mistral-api" | "local-vllm"`
2. **Nieuwe instelling:** `localServerUrl: string` (default: `ws://localhost:8000`)
3. **`RealtimeTranscriber.connect()` aanpassen:**
   - Bij `mistral-api`: huidige gedrag (wss://api.mistral.ai + Bearer token)
   - Bij `local-vllm`: verbind met lokale URL, geen auth header nodig
4. **`transcribeBatch()` aanpassen:** POST naar lokale server i.p.v. Mistral API
5. **`correctText()` apart houden:** Correctie vereist een LLM (Mistral Small) — kan optioneel ook lokaal via vLLM met een ander model, of uitgeschakeld worden
6. **Settings UI:** Toggle "Lokaal model" met URL-invoerveld + verbindingstest
7. **Auto-fallback:** Probeer lokale server → valt terug op Mistral API als onbereikbaar
8. **Statusbalk-indicator:** "lokaal" vs "cloud" icoontje

**Geschatte wijzigingen:**
- `mistral-api.ts`: ~50 regels (URL-switching, optionele auth)
- `authenticated-websocket.ts`: Nieuwe codepath voor `ws://` (geen TLS/auth upgrade nodig)
- `settings-tab.ts`: ~30 regels (nieuwe UI-elementen)
- `types.ts`: ~5 regels (nieuwe settings)

### Fase 2: Bundled voxtral.c (zero-config ervaring)

Voor gevorderde gebruikers die geen vLLM willen installeren:

1. Bundel voxtral.c binaries per platform (macOS arm64, Linux x86_64)
2. Plugin start het proces automatisch bij eerste gebruik
3. Interne WebSocket bridge (of stdin pipe) voor communicatie
4. Model-download UI in settings

Dit is aanzienlijk meer werk maar geeft de beste gebruikerservaring.

---

## 6. Vereiste aanpassingen aan de huidige architectuur

### Wat al compatibel is (geen wijziging nodig)
- **Audio pipeline:** `AudioWorklet` (plugin) / `ScriptProcessorNode` (webapp) produceert al PCM s16le, 16kHz, mono — exact wat het model verwacht
- **Delta-verwerking:** `RealtimeSession` (plugin) / `onmessage` handler (webapp) behandelt deltas/done events generiek
- **Hallucination detection:** Werkt ongewijzigd
- **Voice commands:** Werken ongewijzigd
- **Dual-delay modus:** Kan werken met vLLM (twee WebSocket-verbindingen), mits voldoende GPU

### Wat aangepast moet worden

**Webapp (server.py):**

| Component | Wijziging |
|---|---|
| Config (`config.json`) | Nieuwe velden: `backend`, `local_server_url` |
| `/ws/transcribe` | Backend-switch: Mistral SDK of vLLM WebSocket proxy |
| `/ws/transcribe-dual` | Idem, twee vLLM WebSocket-verbindingen |
| `/api/transcribe` (batch) | POST doorsturen naar vLLM `/v1/audio/transcriptions` |
| `/api/correct` | URL configureerbaar of skip-optie |
| Settings UI (app.js) | Backend-keuze dropdown + URL-invoerveld |

**Plugin (obsidian-plugin/src/):**

| Component | Wijziging |
|---|---|
| `authenticated-websocket.ts` | Plain WebSocket optie toevoegen (ws:// zonder auth header) |
| `mistral-api.ts` (`RealtimeTranscriber`) | URL configureerbaar maken, auth optioneel |
| `mistral-api.ts` (`transcribeBatch`) | URL configureerbaar maken |
| `mistral-api.ts` (`correctText`) | URL configureerbaar maken of skip-optie |
| `types.ts` | Settings uitbreiden met backend-keuze + URL |
| `settings-tab.ts` | UI voor lokale backend configuratie |
| `main.ts` | Backend-keuze doorvoeren naar sessie-initialisatie |

### Wat NIET werkt voor lokale transcriptie
- **Obsidian Mobile:** Geen lokale GPU, vLLM kan niet draaien op telefoon. Batch mode via API blijft nodig als fallback.
- **Text correctie:** Vereist apart LLM (Mistral Small). Kan optioneel uitgeschakeld of via aparte lokale server.

---

## 7. Risico's en aandachtspunten

1. **vLLM installatie-complexiteit:** Vereist CUDA toolkit, Python, pip. Niet triviaal voor niet-technische gebruikers.
2. **Model download:** ~9 GB is groot. Moet eenmalig gedownload worden.
3. **VRAM-gebruik:** Onvoorspelbaar voor gebruikers die het niet kennen. Goede documentatie nodig.
4. **Versie-compatibiliteit:** vLLM evolueert snel. WebSocket protocol kan veranderen.
5. **Correctie-model:** Zonder Mistral Small lokaal is auto-correctie niet beschikbaar. Alternatieven: kleinere lokale LLMs (Phi-3, Llama 3B) of correctie uitschakelen.
6. **Dual-delay modus:** Gebruikt 2 gelijktijdige streams — lokaal betekent dit 2x GPU-belasting.
7. **VPS-latency:** Audio heen en terug over internet voegt 20-200ms toe, afhankelijk van locatie.
8. **VPS-kosten:** Bij licht gebruik duurder dan Mistral API. Pas zinvol bij >4 uur/dag of privacy-eisen.

---

## 8. Conclusie

Lokale transcriptie met Voxtral Mini 4B Realtime is **zeer haalbaar** dankzij protocol-compatibiliteit met vLLM.

**Drie deployment-opties:**
1. **Lokale GPU** — gratis, maximale privacy, vereist 16GB+ VRAM
2. **Eigen VPS** — omzeilt hardware-eisen, ~€85-120/maand, eigen beheer
3. **Mistral API** — eenvoudigst, pay-per-use, fallback

**Volgende stap:** Hardware-performance test via de webapp (server.py) met een lokale vLLM instance op de RTX 5070 Ti eGPU. Dit valideert latency, VRAM-gebruik en transcriptiekwaliteit voordat we de plugin aanpassen.

De webapp is het ideale testplatform: snellere iteratie, directe performance-metrics, en het audioformaat is al identiek. Na validatie kunnen de bevindingen 1-op-1 worden overgenomen in de Obsidian plugin.
