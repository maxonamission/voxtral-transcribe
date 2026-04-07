# MarkdownTranscriber — Projectplan

**Repo:** [maxonamission/MarkdownTranscriber](https://github.com/maxonamission/MarkdownTranscriber)
**Doel:** Android-app voor voice-to-markdown met **on-device** transcriptie via Voxtral Mini 4B Realtime.
**Aanpak:** Nieuw Kotlin/Compose project, geïnspireerd op SimpleMarkdown maar eigen codebase.

---

## Uitgangspunten

- **Model:** Voxtral Mini 4B Realtime 2602 (`mistralai/Voxtral-Mini-4B-Realtime-2602`)
- **Quantisatie:** Q4 GGUF (~2.5 GB) — past in het geheugen van moderne Android-telefoons (8GB+ RAM)
- **On-device:** Het model draait lokaal op de telefoon. Geen server, geen internet vereist.
- **Runtime:** llama.cpp via Android NDK (JNI bindings) — de GGUF community builds zijn hier specifiek voor bedoeld
- **Fallback:** Optioneel Mistral API als cloud-backend voor wie geen lokaal model wil downloaden
- **Audio:** PCM s16le, 16kHz, mono — standaard voor Voxtral

---

## Architectuur

```
┌──────────────────────────────────────────────┐
│  MarkdownTranscriber (Android)               │
│                                              │
│  ┌───────────┐  ┌────────────────┐           │
│  │ Markdown   │  │ Audio Capture  │           │
│  │ Editor     │  │ (AudioRecord)  │           │
│  │ (Compose)  │  │ PCM 16kHz mono │           │
│  └─────┬─────┘  └───────┬────────┘           │
│        │                 │                    │
│  ┌─────┴─────────────────┴────────┐           │
│  │     TranscriptionViewModel     │           │
│  │  - Delta accumulation          │           │
│  │  - Voice commands (optioneel)  │           │
│  └────────────┬───────────────────┘           │
│               │                               │
│  ┌────────────┴───────────────────┐           │
│  │     TranscriptionEngine        │           │
│  │  (interface)                   │           │
│  ├────────────────────────────────┤           │
│  │  ┌─────────────┐ ┌──────────┐ │           │
│  │  │ LocalEngine  │ │ ApiEngine│ │           │
│  │  │ llama.cpp    │ │ WebSocket│ │           │
│  │  │ GGUF Q4      │ │ Mistral  │ │           │
│  │  │ (on-device)  │ │ (cloud)  │ │           │
│  │  └─────────────┘ └──────────┘ │           │
│  └────────────────────────────────┘           │
└──────────────────────────────────────────────┘
     Alles draait op het device. Geen server nodig.
```

---

## On-device inferentie: GGUF op Android

### Model

| Eigenschap | Waarde |
|---|---|
| **Model** | `andrijdavid/Voxtral-Mini-4B-Realtime-2602-GGUF` (community) |
| **Quantisatie** | Q4_K_M (beste balans kwaliteit/grootte) |
| **Grootte** | ~2.5 GB |
| **RAM-gebruik** | ~3-4 GB (model + KV-cache + runtime overhead) |
| **Audio-invoer** | PCM s16le, 16kHz, mono |

### Runtime: llama.cpp via JNI

Llama.cpp is de meest gebruikte GGUF-runtime en heeft Android-ondersteuning:

- **NDK build:** llama.cpp compileert als shared library (`.so`) voor arm64-v8a
- **JNI bridge:** Kotlin roept native functies aan via JNI (`System.loadLibrary("llama")`)
- **Threading:** Inferentie draait op achtergrondthreads, UI blijft responsief
- **GPU-acceleratie:** Optioneel via Vulkan compute (beschikbaar op de meeste moderne Android devices)

### Minimale device-vereisten

| Component | Vereiste |
|---|---|
| **RAM** | 8 GB+ (model ~3-4 GB, Android ~3 GB, app ~0.5 GB) |
| **Opslag** | ~3 GB vrij (voor model download) |
| **CPU** | ARM v8.2+ met NEON (alle telefoons vanaf ~2018) |
| **Android** | 8.0+ (API 26) |

Dit dekt high-end en mid-range telefoons: Samsung S21+, Pixel 6+, OnePlus 9+, etc.

### Model download flow

1. Eerste keer app openen → "Download transcriptiemodel (2.5 GB)"
2. Download naar app-interne opslag (`getFilesDir()`)
3. Voortgangsbalk in UI
4. Model blijft lokaal staan, hoeft maar 1x gedownload
5. Optie om model te verwijderen in settings

---

## Epics

### Epic 0: Project setup
> Basis Android-project met build pipeline.

- Nieuw Android project (Kotlin, Compose, Material 3)
- Min SDK 26 (Android 8.0 — dekt 95%+ devices)
- Gradle met version catalogs
- Modules: `app`, `core` (transcription engine)
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
- Geen Hilt nodig voor v1 — handmatige DI via `ViewModelProvider.Factory`

### Epic 2: Audio capture
> Microfoon-opname met correcte parameters voor Voxtral.

- `AudioRecord` API (niet MediaRecorder — we moeten raw PCM)
- Format: PCM signed 16-bit little-endian, 16kHz, mono
- Achtergrond-opname via `Foreground Service` met notificatie
- Permissie-handling: `RECORD_AUDIO` + `FOREGROUND_SERVICE_MICROPHONE`
- Audio chunks van ~480ms (7680 samples × 2 bytes = 15360 bytes)
- Mute/unmute zonder stream te stoppen

### Epic 3: On-device transcription engine
> Voxtral 4B Q4 GGUF draaien op het device via llama.cpp.

**3a. llama.cpp NDK integratie:**
- CMake build van llama.cpp als Android native library (arm64-v8a)
- JNI wrapper class: `LlamaEngine.kt` ↔ `llama_jni.cpp`
- Functies: `loadModel(path)`, `startSession(config)`, `feedAudio(pcmBytes)`, `getTranscription()`, `endSession()`, `unloadModel()`
- Achtergrondthread voor inferentie (Kotlin coroutines + `Dispatchers.Default`)

**3b. Model management:**
- Download GGUF van Hugging Face (`andrijdavid/Voxtral-Mini-4B-Realtime-2602-GGUF`)
- Opslag in `getFilesDir()/models/`
- Download met `DownloadManager` of OkHttp (resume-support bij onderbreking)
- Integriteitscheck (SHA256)
- UI: downloadvoortgang, model verwijderen, opslagruimte-indicator

**3c. Streaming interface:**
- `TranscriptionEngine` interface:
  ```kotlin
  interface TranscriptionEngine {
      suspend fun start(config: TranscriptionConfig)
      suspend fun feedAudio(pcm: ByteArray)
      fun transcriptionFlow(): Flow<TranscriptionEvent>
      suspend fun stop()
  }
  
  sealed class TranscriptionEvent {
      data class Delta(val text: String) : TranscriptionEvent()
      data class Done(val text: String) : TranscriptionEvent()
      data class Error(val message: String) : TranscriptionEvent()
  }
  ```
- `LocalEngine` implementeert dit via llama.cpp JNI
- `ApiEngine` implementeert dit via WebSocket (Mistral API fallback)

### Epic 4: Integratie editor ↔ transcriptie
> Getranscribeerde tekst verschijnt live in de editor.

- FAB (Floating Action Button) met microfoon-icoon
- Tijdens opname: FAB wordt rood, pulserende animatie
- Transcriptie-deltas worden aan cursor-positie toegevoegd
- `Done` events sluiten het huidige segment af
- Status-indicator: "On-device" vs "Cloud" icoon
- Graceful degradatie als model niet geladen is → prompt om te downloaden

### Epic 5: Settings
> Configuratie voor model, taal, en audio.

- **Model:** download/verwijder, opslagruimte-info, modelversie
- **Transcriptie-modus:** On-device (default) / Mistral API (fallback)
- **Taal:** dropdown (NL, EN, FR, DE, etc.)
- **Latency/delay:** slider (240ms – 2400ms, default 480ms)
- **Mistral API key:** alleen nodig voor cloud-modus
- **GPU-acceleratie:** toggle voor Vulkan compute (experimenteel)
- Opslaan via Preferences DataStore

### Epic 6: Polish & testen
> App-kwaliteit en testbaarheid.

- Unit tests voor transcription engine interface
- Unit tests voor audio chunking
- Instrumented tests voor editor state management
- Error handling: model niet geladen, onvoldoende geheugen, microfoon in gebruik
- ProGuard/R8 configuratie (behoud JNI symbolen)
- App-icoon en theming
- Performance profiling: inferentie-snelheid, geheugengebruik, batterijverbruik

---

## Technologiekeuzes

| Keuze | Beslissing | Reden |
|---|---|---|
| **UI** | Jetpack Compose + Material 3 | Modern, SimpleMarkdown bewijst dat het werkt |
| **Markdown** | CommonMark (Java) | Bewezen, extensible, zelfde als SimpleMarkdown |
| **Preview** | WebView + HTML | Compose-native markdown rendering is te beperkt |
| **Inference** | llama.cpp (NDK/JNI) | Meest volwassen GGUF-runtime, Android-ondersteuning |
| **Model** | Voxtral 4B Q4_K_M GGUF | ~2.5 GB, past on-device, goede kwaliteit/grootte balans |
| **JSON** | Kotlinx.serialization | Kotlin-native, compile-time veilig |
| **Audio** | AudioRecord | Directe PCM-toegang, geen container overhead |
| **DI** | Handmatig / Koin | Hilt is overkill voor een app met 2-3 ViewModels |
| **Persistence** | Preferences DataStore | Modern alternatief voor SharedPreferences |
| **Min SDK** | 26 | 95%+ dekking, AudioRecord verbeteringen |

---

## Wat we NIET overnemen van SimpleMarkdown

- ~~Hilt dependency injection~~ — te zwaar voor v1
- ~~Free/non-free flavors~~ — geen ads, geen Play billing
- ~~ACRA crash reporting~~ — standaard Android vitals volstaat
- ~~WebDAV sync~~ — out of scope voor v1
- ~~Forgejo/GitLab CI~~ — alleen GitHub Actions
- ~~Syllable counter~~ — niet relevant

---

## Code die herbruikbaar is uit voxtral-transcribe

De `shared/` module bevat platform-agnostische logica in TypeScript. De transcriptie-logica (delta accumulation, hallucination detection, voice commands) kan naar Kotlin geport worden:

| Shared module (TS) | Android equivalent (Kotlin) | Effort |
|---|---|---|
| `realtime-session.ts` — delta accumulation | `TranscriptionSession.kt` | Port, ~150 regels |
| `hallucination.ts` — herhalingsdetectie | `HallucinationDetector.kt` | Directe port, ~50 regels |
| `voice-commands.ts` — commando-matching | `VoiceCommands.kt` | Directe port, ~100 regels |
| `types.ts` — settings, interfaces | `Models.kt` — data classes | Directe port, ~50 regels |
| `lang.ts` — taaldata | `Languages.kt` | Directe port, ~30 regels |

Het WebSocket-protocol uit `mistral-api.ts` is alleen nodig voor de `ApiEngine` (cloud-fallback), niet voor de on-device engine.

**Totaal:** ~380 regels Kotlin voor de herbruikbare transcriptie-logica.

---

## Volgorde en afhankelijkheden

```
Epic 0 (setup)
  │
  ├── Epic 1 (editor) ──────────┐
  │                              │
  ├── Epic 2 (audio) ───────┐   │
  │                          │   │
  └── Epic 3 (on-device) ───┤   │
                             │   │
                        Epic 4 (integratie)
                             │
                        Epic 5 (settings)
                             │
                        Epic 6 (polish)
```

Epics 1, 2, en 3 kunnen parallel ontwikkeld worden. Epic 4 brengt ze samen.

---

## Risico's en mitigatie

| Risico | Impact | Mitigatie |
|---|---|---|
| **llama.cpp Voxtral-support is experimenteel** | Model laadt niet of geeft slechte resultaten | Vroeg testen in Epic 3, fallback naar Mistral API |
| **Geheugen op low-end devices** | OOM crashes | Minimaal 8GB RAM vereisen, geheugenmonitor in app |
| **Inferentiesnelheid op CPU** | Trager dan realtime | Vulkan GPU-acceleratie, Q4 quantisatie, latency-instelling verhogen |
| **Model download (2.5 GB)** | Gebruiker haakt af | Resume-support, WiFi-only optie, duidelijke voortgangsinfo |
| **Batterijverbruik** | Snel lege batterij bij langdurig gebruik | Foreground service notificatie, waarschuwing bij laag batterijniveau |

---

## Open vragen

1. **Llama.cpp Voxtral-compatibiliteit:** Hoe goed werkt de GGUF community build met llama.cpp op Android? Dit moet vroeg gevalideerd worden (Epic 3 prototype). Als dit niet werkt, is ExecuTorch of een andere runtime het alternatief.
2. **Batch-transcriptie:** Wil je naast realtime ook een batch-modus (opnemen → achteraf transcriberen)? Kan efficiënter zijn qua batterij.
3. **LLM-correctie:** De Obsidian plugin corrigeert transcripties met Mistral Small. On-device correctie vereist een apart (kleiner) LLM. Uitstellen naar v2?
4. **File sync:** Moeten markdown-bestanden synchroniseren met Obsidian vault? Zo ja, via welk mechanisme (gedeelde map, Syncthing)?
