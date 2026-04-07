# MarkdownTranscriber — Projectplan

**Repo:** [maxonamission/MarkdownTranscriber](https://github.com/maxonamission/MarkdownTranscriber)
**Doel:** Android-app voor voice-to-markdown met **on-device** transcriptie via Voxtral Mini 4B Realtime.
**Aanpak:** Nieuw Kotlin/Compose project, geïnspireerd op SimpleMarkdown maar eigen codebase.

---

## Uitgangspunten

- **Model:** Voxtral Mini 4B Realtime 2602 (`mistralai/Voxtral-Mini-4B-Realtime-2602`)
- **On-device:** Het model draait lokaal op de telefoon. Geen server, geen internet vereist.
- **Runtime:** ExecuTorch — Mistral levert een dedicated variant (`Voxtral-Mini-4B-Realtime-2602-ExecuTorch`) specifiek voor on-device deployment
- **Transformers:** Sinds `transformers >= 5.2.0` wordt het model officieel ondersteund via `VoxtralRealtimeForConditionalGeneration` + `AutoProcessor`. Dit is de referentie-implementatie waarop de ExecuTorch export gebaseerd is.
- **Fallback:** Optioneel Mistral API als cloud-backend (WebSocket naar `/v1/realtime`)
- **Audio:** PCM s16le, 16kHz, mono — standaard voor Voxtral

---

## Ecosystem overzicht

Het Voxtral 4B model heeft meerdere deployment-paden. Dit plan kiest ExecuTorch voor on-device.

| Runtime | Status | Platform | Geschiktheid voor Android |
|---|---|---|---|
| **vLLM** | Officieel, productie-klaar | GPU server | Nee — vereist CUDA GPU |
| **Transformers** | Officieel (>= 5.2.0) | Python/PyTorch | Referentie-implementatie, basis voor export |
| **ExecuTorch** | Mistral-variant beschikbaar, "untested" | Mobile/laptop | **Ja — primaire keuze voor on-device Android** |
| **voxtral.c** | Community (antirez) | macOS/Linux | Nee — geen Android |
| **GGUF/llama.cpp** | Community, niet upstream | CPU/GPU | Mogelijk alternatief, maar experimenteel |
| **ONNX** | Community | Cross-platform | Mogelijk alternatief via ONNX Runtime Mobile |
| **MLX** | Community | Apple Silicon | Nee — alleen macOS |
| **Rust/WASM** | Community | Browser | Nee — niet Android-native |

### Waarom ExecuTorch?

1. **Officieel pad:** Mistral levert zelf een ExecuTorch-variant van het model
2. **Android-native:** ExecuTorch is Meta's framework specifiek voor PyTorch-modellen op mobile (Android/iOS)
3. **Hardware-acceleratie:** Ondersteunt Android NNAPI, Qualcomm QNN, GPU delegate
4. **Maven-pakket:** `org.pytorch:executorch-android` beschikbaar
5. **Gebaseerd op Transformers:** De ExecuTorch export komt voort uit dezelfde `VoxtralRealtimeForConditionalGeneration` class

### Kanttekening

Mistral markeert ExecuTorch-support als "untested" — er kunnen scherpe randjes zijn. Dit maakt vroege validatie (Epic 3) cruciaal. Als ExecuTorch niet werkt, zijn ONNX Runtime Mobile en GGUF/llama.cpp de alternatieven.

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
│  │  ┌──────────────┐ ┌─────────┐ │           │
│  │  │ LocalEngine   │ │ApiEngine│ │           │
│  │  │ ExecuTorch    │ │WebSocket│ │           │
│  │  │ Voxtral 4B    │ │Mistral  │ │           │
│  │  │ (on-device)   │ │(cloud)  │ │           │
│  │  └──────────────┘ └─────────┘ │           │
│  └────────────────────────────────┘           │
└──────────────────────────────────────────────┘
     Alles draait op het device. Geen server nodig.
```

---

## On-device inferentie: ExecuTorch op Android

### Model

| Eigenschap | Waarde |
|---|---|
| **Model** | `mistralai/Voxtral-Mini-4B-Realtime-2602-ExecuTorch` |
| **Basis** | `VoxtralRealtimeForConditionalGeneration` (Transformers >= 5.2.0) |
| **Formaat** | ExecuTorch `.pte` (geëxporteerd + geoptimaliseerd voor mobile) |
| **Audio-invoer** | PCM s16le, 16kHz, mono |
| **Architectuur** | ~970M audio encoder + ~3.4B LLM decoder |
| **Streaming** | Causale audio encoder met sliding window attention |

### ExecuTorch Android-integratie

ExecuTorch is Meta's deployment-framework voor PyTorch-modellen op mobile:

- **Maven dependency:** `org.pytorch:executorch-android`
- **API:** Java/Kotlin bindings via `Module.load()`, `Module.forward()`
- **Hardware backends:**
  - CPU (XNNPACK delegate) — standaard, werkt overal
  - GPU (Vulkan delegate) — sneller op devices met Vulkan-support
  - NNAPI delegate — gebruikt Android Neural Networks API (Qualcomm Hexagon, Mali GPU, etc.)
  - Qualcomm QNN — directe NPU-toegang op Snapdragon SoCs
- **Quantisatie:** ExecuTorch ondersteunt PTQ (post-training quantization) voor kleinere modellen

### Transformers referentie-implementatie

De Transformers-code toont hoe het model werkt — dit is de basis waaruit ExecuTorch exporteert:

```python
from transformers import VoxtralRealtimeForConditionalGeneration, AutoProcessor
from mistral_common.tokens.tokenizers.audio import Audio

processor = AutoProcessor.from_pretrained("mistralai/Voxtral-Mini-4B-Realtime-2602")
model = VoxtralRealtimeForConditionalGeneration.from_pretrained(
    "mistralai/Voxtral-Mini-4B-Realtime-2602", device_map="auto"
)

audio = Audio.from_file("recording.wav", strict=False)
audio.resample(processor.feature_extractor.sampling_rate)

inputs = processor(audio.audio_array, return_tensors="pt")
inputs = inputs.to(model.device, dtype=model.dtype)

outputs = model.generate(**inputs)
text = processor.batch_decode(outputs, skip_special_tokens=True)[0]
```

### Minimale device-vereisten

| Component | Vereiste |
|---|---|
| **RAM** | 8 GB+ (model + KV-cache + Android overhead) |
| **Opslag** | ~3-5 GB vrij (voor ExecuTorch model) |
| **CPU** | ARM v8.2+ met NEON (alle telefoons vanaf ~2018) |
| **Android** | 8.0+ (API 26) |
| **Aanbevolen** | Snapdragon 8 Gen 1+ of Tensor G2+ voor NPU-acceleratie |

### Model download flow

1. Eerste keer app openen → "Download transcriptiemodel"
2. Download ExecuTorch `.pte` van Hugging Face naar app-interne opslag
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
> Voxtral 4B draaien op het device via ExecuTorch.

Dit is de meest risicovolle epic — vroeg beginnen en snel valideren.

**3a. ExecuTorch integratie:**
- Gradle dependency: `org.pytorch:executorch-android`
- Model laden: `Module.load(modelPath)`
- Audio preprocessing: PCM → mel spectrogram (128 bins, 16kHz, Hann window)
- Inferentie: `Module.forward(inputTensor)` → token IDs → tekst
- Streaming: causale encoder ondersteunt incrementele audio-chunks
- Achtergrondthread voor inferentie (Kotlin coroutines + `Dispatchers.Default`)

**3b. Model management:**
- Download ExecuTorch `.pte` van Hugging Face
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
- `LocalEngine` implementeert dit via ExecuTorch
- `ApiEngine` implementeert dit via WebSocket (Mistral API fallback)

**3d. Vroege validatie (spike):**
- Minimaal werkend prototype: laad model, feed audio, krijg tekst terug
- Meet: laadtijd, inferentiesnelheid (tokens/sec), geheugengebruik
- Test op minimaal 2 devices (high-end + mid-range)
- **Go/no-go beslissing:** als ExecuTorch niet werkt, evalueer alternatieven (ONNX Runtime Mobile, GGUF/llama.cpp)

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
- **Hardware backend:** CPU / GPU / NPU (indien beschikbaar)
- Opslaan via Preferences DataStore

### Epic 6: Polish & testen
> App-kwaliteit en testbaarheid.

- Unit tests voor transcription engine interface
- Unit tests voor audio chunking en mel spectrogram
- Instrumented tests voor editor state management
- Error handling: model niet geladen, onvoldoende geheugen, microfoon in gebruik
- ProGuard/R8 configuratie
- App-icoon en theming
- Performance profiling: inferentie-snelheid, geheugengebruik, batterijverbruik

---

## Technologiekeuzes

| Keuze | Beslissing | Reden |
|---|---|---|
| **UI** | Jetpack Compose + Material 3 | Modern, SimpleMarkdown bewijst dat het werkt |
| **Markdown** | CommonMark (Java) | Bewezen, extensible, zelfde als SimpleMarkdown |
| **Preview** | WebView + HTML | Compose-native markdown rendering is te beperkt |
| **Inference** | ExecuTorch | Officieel on-device pad van Mistral, Android-native, hardware-acceleratie |
| **Model** | Voxtral 4B ExecuTorch variant | Officiële Mistral export voor on-device |
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

Het WebSocket-protocol uit `mistral-api.ts` is alleen nodig voor de `ApiEngine` (cloud-fallback).

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
       ↑ start hier!        │   │
       spike = go/no-go     │   │
                             │   │
                        Epic 4 (integratie)
                             │
                        Epic 5 (settings)
                             │
                        Epic 6 (polish)
```

**Aanbevolen startvolgorde:** Begin met Epic 3 spike (ExecuTorch validatie) parallel aan Epic 0+1. De spike bepaalt of ExecuTorch werkt voordat je veel investeert in de rest.

---

## Risico's en mitigatie

| Risico | Impact | Mitigatie |
|---|---|---|
| **ExecuTorch Voxtral is "untested"** | Model laadt niet of slechte resultaten | Spike in Epic 3 als go/no-go; alternatieven: ONNX Runtime, GGUF |
| **Geheugen op low-end devices** | OOM crashes | 8GB+ RAM vereisen, geheugenmonitor in app |
| **Inferentiesnelheid** | Trager dan realtime (< 12.5 tok/s) | NPU/GPU delegate, latency-instelling verhogen |
| **Model download** | Gebruiker haakt af bij grote download | Resume-support, WiFi-only optie, voortgangsinfo |
| **Batterijverbruik** | Snel lege batterij bij langdurig gebruik | Foreground service notificatie, batterijwaarschuwing |
| **Audio preprocessing** | Mel spectrogram moet identiek zijn aan training | Gebruik dezelfde parameters: 128 bins, Hann window 400 samples, hop 160 |

---

## Open vragen

1. **ExecuTorch model-grootte:** Hoe groot is de `.pte` file? BF16 is ~9 GB, maar ExecuTorch kan quantizen. Moet gevalideerd worden.
2. **Streaming via ExecuTorch:** De causale encoder ondersteunt streaming, maar hoe map je dit op ExecuTorch's `Module.forward()` API? Mogelijk is step-wise inference nodig (meerdere forward calls met encoder KV-cache).
3. **Batch-transcriptie:** Wil je naast realtime ook een batch-modus (opnemen → achteraf transcriberen)? Kan efficiënter zijn qua batterij.
4. **LLM-correctie:** De Obsidian plugin corrigeert transcripties met Mistral Small. On-device correctie vereist een apart (kleiner) LLM. Uitstellen naar v2?
5. **File sync:** Moeten markdown-bestanden synchroniseren met Obsidian vault? Zo ja, via welk mechanisme (gedeelde map, Syncthing)?
