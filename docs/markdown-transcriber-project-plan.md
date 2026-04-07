# MarkdownTranscriber — Projectplan

**Repo:** [maxonamission/MarkdownTranscriber](https://github.com/maxonamission/MarkdownTranscriber)
**Doel:** Android-app voor voice-to-markdown met lokale transcriptie via Voxtral Mini 4B Realtime.
**Aanpak:** Nieuw Kotlin/Compose project, geïnspireerd op SimpleMarkdown maar eigen codebase.

---

## Uitgangspunten

- **Model:** Voxtral Mini 4B Realtime 2602 (`mistralai/Voxtral-Mini-4B-Realtime-2602`)
- **On-device:** Eerste versie draait tegen een lokale vLLM server (laptop/VPS), niet on-device op de telefoon zelf. Het 4B model vereist ~9GB VRAM, wat te zwaar is voor mobiel.
- **Protocol:** WebSocket naar `ws://<host>:8000/v1/realtime` — zelfde protocol als Mistral API.
- **Fallback:** Optioneel Mistral API als cloud-backend (zelfde protocol, andere URL).
- **Audio:** PCM s16le, 16kHz, mono — standaard voor Voxtral.

---

## Architectuur

```
┌─────────────────────────────────────┐
│  MarkdownTranscriber (Android)      │
│                                     │
│  ┌───────────┐  ┌────────────────┐  │
│  │ Markdown   │  │ Audio Capture  │  │
│  │ Editor     │  │ (AudioRecord)  │  │
│  │ (Compose)  │  │ PCM 16kHz mono │  │
│  └─────┬─────┘  └───────┬────────┘  │
│        │                 │           │
│  ┌─────┴─────────────────┴────────┐  │
│  │     TranscriptionViewModel     │  │
│  │  - WebSocket client            │  │
│  │  - Audio → base64 → JSON      │  │
│  │  - Delta accumulation          │  │
│  │  - Voice commands (optioneel)  │  │
│  └────────────┬───────────────────┘  │
└───────────────┼─────────────────────┘
                │ WebSocket
                ▼
     ┌─────────────────────┐
     │  vLLM / Mistral API │
     │  /v1/realtime       │
     └─────────────────────┘
```

---

## Epics

### Epic 0: Project setup
> Basis Android-project met build pipeline.

- Nieuw Android project (Kotlin, Compose, Material 3)
- Min SDK 26 (Android 8.0 — dekt 95%+ devices, vereist voor AudioRecord optimalisaties)
- Gradle met version catalogs
- Modules: `app`, `core` (transcription logic)
- CI: GitHub Actions (build + lint)
- README met projectbeschrijving
- Apache 2.0 licentie

### Epic 1: Markdown editor
> Basis markdown editing, geïnspireerd op SimpleMarkdown's aanpak.

**Cherry-pick van SimpleMarkdown (herschrijven, niet kopiëren):**

| Component | SimpleMarkdown referentie | Eigen implementatie |
|---|---|---|
| Editor | `MarkdownTextField` — Compose `BasicTextField` | Eigen `BasicTextField` met markdown syntax highlighting |
| Preview | WebView + CommonMark → HTML | Zelfde aanpak: CommonMark library + themed WebView |
| State | `EditorState` data class + `StateFlow` | Eigen `EditorState` in ViewModel |
| File I/O | SAF (Storage Access Framework) | SAF voor open/save, interne opslag voor autosave |

**Scope:**
- `BasicTextField` met monospace font
- Markdown preview via CommonMark → HTML → WebView
- Toggle editor/preview (telefoon) of side-by-side (tablet)
- Nieuw bestand / openen / opslaan via SAF
- Autosave naar interne opslag
- Unsaved changes waarschuwing

**Dependencies:**
- `org.commonmark:commonmark` + extensions (tables, strikethrough, task lists)
- Geen Hilt nodig voor v1 — handmatige DI via `ViewModelProvider.Factory` of Koin als het groeit

### Epic 2: Audio capture
> Microfoon-opname met correcte parameters voor Voxtral.

- `AudioRecord` API (niet MediaRecorder — we moeten raw PCM)
- Format: PCM signed 16-bit little-endian, 16kHz, mono
- Achtergrond-opname via `Foreground Service` met notificatie
- Permissie-handling: `RECORD_AUDIO` + `FOREGROUND_SERVICE_MICROPHONE`
- Audio chunks van ~480ms (7680 samples × 2 bytes = 15360 bytes)
- Mute/unmute zonder stream te stoppen

### Epic 3: WebSocket transcription client
> Verbinding met vLLM/Mistral API via WebSocket.

- OkHttp WebSocket client
- Protocol implementatie:
  ```
  → {"type": "session.update", "session": {"audio_format": "pcm_s16le_16000", "language": "nl", "latency": "480"}}
  → {"type": "input_audio.append", "audio": "<base64 PCM chunk>"}
  → {"type": "input_audio.end"}
  ← {"type": "transcription.text.delta", "text": "..."}
  ← {"type": "transcription.done", "text": "..."}
  ```
- Configureerbare server URL (default: `ws://192.168.x.x:8000/v1/realtime`)
- Reconnect-logica bij verbindingsverlies
- Kotlinx.serialization voor JSON

### Epic 4: Integratie editor ↔ transcriptie
> Getranscribeerde tekst verschijnt live in de editor.

- FAB (Floating Action Button) met microfoon-icoon
- Tijdens opname: FAB wordt rood, pulserende animatie
- Transcriptie-deltas worden aan cursor-positie toegevoegd
- `transcription.done` events sluiten het huidige segment af
- Optioneel: visueel onderscheid tussen getypte en gedicteerde tekst (achtergrondkleur)

### Epic 5: Settings
> Configuratie voor server, taal, en audio.

- Server URL (tekstveld + "test verbinding" knop)
- Taal (dropdown: NL, EN, FR, DE, etc.)
- Latency/delay (slider: 240ms – 2400ms, default 480ms)
- Model selectie (opgehaald van server via `GET /v1/models`)
- Optioneel: Mistral API key (voor cloud-fallback)
- Opslaan via Preferences DataStore

### Epic 6: Polish & testen
> App-kwaliteit en testbaarheid.

- Unit tests voor WebSocket protocol parsing
- Unit tests voor audio chunking
- Instrumented tests voor editor state management
- Error handling: geen server bereikbaar, microfoon in gebruik, permissie geweigerd
- ProGuard/R8 configuratie
- App-icoon en theming
- Baseline profile voor Compose performance

---

## Technologiekeuzes

| Keuze | Beslissing | Reden |
|---|---|---|
| **UI** | Jetpack Compose + Material 3 | Modern, SimpleMarkdown bewijst dat het werkt |
| **Markdown** | CommonMark (Java) | Bewezen, extensible, zelfde als SimpleMarkdown |
| **Preview** | WebView + HTML | Compose-native markdown rendering is te beperkt |
| **WebSocket** | OkHttp | Standaard voor Android, betrouwbaar |
| **JSON** | Kotlinx.serialization | Kotlin-native, compile-time veilig |
| **Audio** | AudioRecord | Directe PCM-toegang, geen container overhead |
| **DI** | Handmatig / Koin | Hilt is overkill voor een app met 2-3 ViewModels |
| **Persistence** | Preferences DataStore | Modern alternatief voor SharedPreferences |
| **Min SDK** | 26 | AudioRecord performance verbeteringen, 95%+ dekking |

---

## Wat we NIET overnemen van SimpleMarkdown

- ~~Hilt dependency injection~~ — te zwaar voor v1
- ~~Free/non-free flavors~~ — geen ads, geen Play billing
- ~~ACRA crash reporting~~ — standaard Android vitals volstaat
- ~~WebDAV sync~~ — out of scope voor v1
- ~~Forgejo/GitLab CI~~ — alleen GitHub Actions
- ~~Syllable counter~~ — niet relevant
- ~~BaselineProfile module~~ — optioneel in Epic 6

---

## Code die herbruikbaar is uit voxtral-transcribe

De `shared/` module bevat platform-agnostische logica die conceptueel herbruikbaar is, maar in TypeScript geschreven. Voor de Android-app moet dit naar Kotlin geport worden:

| Shared module (TS) | Android equivalent (Kotlin) | Effort |
|---|---|---|
| `mistral-api.ts` — WebSocket protocol | `TranscriptionClient.kt` — OkHttp WebSocket | Herschrijven, ~200 regels |
| `realtime-session.ts` — delta accumulation | `TranscriptionSession.kt` | Herschrijven, ~150 regels |
| `hallucination.ts` — herhalingsdetectie | `HallucinationDetector.kt` | Directe port, ~50 regels |
| `voice-commands.ts` — commando-matching | `VoiceCommands.kt` | Directe port, ~100 regels |
| `types.ts` — settings, interfaces | `Models.kt` — data classes | Directe port, ~50 regels |
| `lang.ts` — taaldata | `Languages.kt` | Directe port, ~30 regels |

**Totaal:** ~580 regels Kotlin voor de transcriptie-kern. De markdown editing is los hiervan.

---

## Volgorde en afhankelijkheden

```
Epic 0 (setup)
  │
  ├── Epic 1 (editor) ──────┐
  │                          │
  ├── Epic 2 (audio) ───┐   │
  │                      │   │
  └── Epic 3 (websocket) ┤   │
                         │   │
                    Epic 4 (integratie)
                         │
                    Epic 5 (settings)
                         │
                    Epic 6 (polish)
```

Epics 1, 2, en 3 kunnen parallel ontwikkeld worden. Epic 4 brengt ze samen.

---

## Hardware-setup voor ontwikkeling

De app verbindt met een vLLM server die het 4B model draait. Tijdens ontwikkeling:

```bash
# Op laptop met eGPU (RTX 5070 Ti, 16GB VRAM):
vllm serve mistralai/Voxtral-Mini-4B-Realtime-2602 \
  --enforce-eager \
  --max-model-len 8000 \
  --gpu-memory-utilization 0.95 \
  --host 0.0.0.0 \
  --port 8000
```

De Android-app (op telefoon of emulator) verbindt via het lokale netwerk:
- Fysiek device: `ws://192.168.x.x:8000/v1/realtime`
- Emulator: `ws://10.0.2.2:8000/v1/realtime`

---

## Open vragen

1. **Batch-transcriptie:** Wil je naast realtime ook een batch-modus (opnemen → achteraf transcriberen)? Dit gebruikt `POST /v1/audio/transcriptions` en is minder VRAM-intensief.
2. **LLM-correctie:** De huidige Obsidian plugin corrigeert transcripties met Mistral Small. Wil je dit ook in de Android-app? Dat vereist een apart model op de vLLM server of een API-call.
3. **File sync:** Moeten markdown-bestanden synchroniseren met Obsidian vault? Zo ja, via welk mechanisme (gedeelde map, Syncthing, git)?
4. **Offline-modus:** V1 vereist een netwerkverbinding naar de vLLM server. Echte offline transcriptie (on-device) is een apart traject met GGUF/voxtral.c.
