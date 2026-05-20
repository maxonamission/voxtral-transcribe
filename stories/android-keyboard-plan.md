# Android Voice Keyboard — Offline Voxtral IME

**Datum:** 2026-05-20
**Status:** Plan
**Branch:** `claude/mobile-voice-input-CCBcT`

## Visie

Een Android-toetsenbord (Input Method Editor, IME) dat **volledig offline** dicteert
via Voxtral Mini Realtime op het toestel zelf. Geen netwerk, geen API-key, geen
abonnement — privacy en eigenaarschap zijn de bestaansreden.

Online/cloud-varianten houden we expliciet **buiten scope**. Dat is het terrein van
Speechnotes (Google Cloud STT via `SpeechRecognizer`) en commerciële alternatieven.
Als we ooit een cloud-variant willen, wordt dat een aparte app of een betaalde
tier — niet vermengd met deze IME.

## Scope

### In scope (v1)

- Eigen Android IME-module in deze monorepo (`android-keyboard/`)
- Mic-knop op een minimalistisch toetsenbord-oppervlak; dicteren in elk invoerveld
- On-device transcriptie via **ExecuTorch + Voxtral Mini 3B Realtime** (kleinere variant, beter voor mobiel dan 4B)
- Tekst-insertie via `InputConnection` met streaming/preview-semantiek (zoals dual-delay)
- Beperkte set voicecommands (paragraph, line, undo, stop) — ported naar Kotlin
- Settings: taal, streaming-delay, mic-gain
- Sideload-distributie (APK uit GitHub Releases); Play Store/F-Droid komt later

### Uit scope (v1)

- iOS (Apple staat mic in keyboard-extensies in praktijk niet toe — aparte app overwegen)
- Cloud/API-fallback in dezelfde build
- Diarisatie (Realtime-model ondersteunt dit niet)
- LLM-correctie (Mistral Small is API-gebonden)
- Volledig fysiek QWERTY-toetsenbord — dit blijft een **dicteer-IME**, niet een
  volledige typvervanging. Gebruiker schakelt voor typen terug naar Gboard.

## Architectuur

```
┌─────────────────────────────────────────────────────────┐
│  IME UI (Kotlin/Compose)                                │
│  - mic button, level meter, status                      │
│  - candidate strip (preliminary text)                   │
└──────────────┬──────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────┐
│  AudioCapture (AudioRecord, 16 kHz mono PCM)            │
└──────────────┬──────────────────────────────────────────┘
               │ PCM chunks
┌──────────────▼──────────────────────────────────────────┐
│  VoxtralEngine (Kotlin facade over ExecuTorch)          │
│   ├── ExecuTorch runtime (.pte model)                   │
│   ├── backend: QNN (NPU) → XNNPACK (CPU) fallback       │
│   └── streaming decoder state                           │
└──────────────┬──────────────────────────────────────────┘
               │ text deltas
┌──────────────▼──────────────────────────────────────────┐
│  TextPipeline                                           │
│   ├── voice command matcher (Kotlin port van shared/)   │
│   └── formatting (paragraph, list, heading)             │
└──────────────┬──────────────────────────────────────────┘
               │ formatted text + commit boundaries
┌──────────────▼──────────────────────────────────────────┐
│  InputConnection adapter                                │
│   - setComposingText() voor preliminary                 │
│   - commitText() bij commit boundary                    │
└─────────────────────────────────────────────────────────┘
```

## Tech-stack

| Laag | Keuze | Reden |
|---|---|---|
| Taal | Kotlin | Standaard, eerstkeus voor Android |
| UI | Jetpack Compose (waar mogelijk) + klassieke IME views | Compose in IME-context werkt sinds API 31, fallback nodig voor minSdk |
| Runtime | `org.pytorch:executorch-android:1.x` | Eerste-klas Voxtral-support, gedocumenteerd in PyTorch examples |
| Model | Voxtral Mini 3B Realtime ExecuTorch (int4/int8) | Kleiner dan 4B, ~1.8 GB; nog steeds ruime kwaliteit |
| Backends | QNN (Snapdragon NPU) → XNNPACK (CPU) | QNN primair op moderne Snapdragon-devices; XNNPACK als universele fallback |
| Audio | AudioRecord, 16 kHz mono PCM | Voxtral verwacht 16 kHz |
| Build | Gradle (Kotlin DSL) | Standaard |
| MinSdk | 28 (Android 9) | NNAPI, recente AudioRecord-features; sluit goedkope toestellen uit maar past bij doelgroep |
| TargetSdk | 35 | Recent |

## Module-layout

Nieuw top-level in monorepo, vergelijkbaar met `obsidian-plugin/` en `vscode-extension/`:

```
android-keyboard/
├── README.md
├── build.gradle.kts
├── settings.gradle.kts
├── gradle/
├── app/                      # IME app module
│   ├── build.gradle.kts
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── kotlin/voxtral/keyboard/
│       │   ├── ime/          # InputMethodService, views
│       │   ├── audio/        # AudioCapture
│       │   ├── engine/       # VoxtralEngine (ExecuTorch facade)
│       │   ├── pipeline/     # commands, formatting
│       │   └── settings/     # SettingsActivity
│       ├── res/
│       └── assets/           # ExecuTorch model wordt NIET hier gebundeld (te groot)
└── core/                     # pure Kotlin lib: command matcher, formatting
    └── src/main/kotlin/...
```

## Faseplan

### Fase 1 — Foundation (stories 024–026)

Een leeg, werkend IME dat zichtbaar is in Android's keyboard-picker, een mic-knop
toont, mic-permissie netjes vraagt, en audio capture werkt — nog zonder
transcriptie. Output: APK die "Hello World van een mic" doet en tekst kan
inserten via `commitText("test")` als hardcoded smoke test.

### Fase 2 — On-device inference (stories 027–030)

ExecuTorch-runtime + Voxtral-model integreren. Model wordt bij eerste gebruik
gedownload (geen ~2 GB in de APK). Streaming pipeline werkt end-to-end: praten →
tekst in invoerveld. Backend-selectie met QNN-detectie en CPU-fallback.

### Fase 3 — Dicteer-parity (stories 031–033)

InputConnection-semantiek matcht de webapp (preliminary text via
`setComposingText`, commit op pauze/punctuation). Voicecommands geport vanuit
`shared/`. Settings-scherm.

### Fase 4 — Betrouwbaarheid & distributie (stories 034–036)

Battery/thermal management, on-device benchmark suite (WER & latency op een
testdataset), APK-release pipeline.

## Risico's & open vragen

1. **ExecuTorch on Android voor Voxtral: "sharp edges"** — Mistral waarschuwt
   expliciet dat streaming on-device experimenteel is. Fase 2 is het echte
   technische risico; alles ervóór is keyboard-engineering.
2. **QNN backend werkt alleen op Snapdragon** — Samsung Exynos, MediaTek
   krijgen CPU. We moeten voor Fase 2 een Snapdragon-testdevice hebben. S25
   Ultra (Snapdragon 8 Elite) is de referentie uit story 017.
3. **Model-grootte ~1.8 GB** — niet bundelen in APK. Download-flow met progress,
   storage check, en sha256-verificatie.
4. **IME microfoon-permissie UX** — Android vereist dat de gebruiker (a) de IME
   inschakelt in Instellingen, (b) hem als actief toetsenbord kiest, (c)
   mic-permissie geeft. Drie stappen, makkelijk om kwijt te raken. Story 025 is
   hier specifiek voor.
5. **Compose in InputMethodService** — werkt vanaf API 31 redelijk goed maar
   heeft nog edge cases (window tokens, IME-insets). Klassieke `View`-hierarchie
   is veiliger voor de IME view; Compose binnen de SettingsActivity is prima.
6. **Voice command-logica delen met webapp** — `shared/` is TypeScript. Direct
   delen vereist ofwel een JS-runtime in de IME (overhead) of een Kotlin-port.
   Plan: Kotlin-port, met dezelfde testcases als referentie. Story 032.
7. **Battery** — een actief LLM in de IME is energie-intensief. Model moet idle
   unloaden na X seconden inactiviteit; warm-load tijd meten in story 035.

## Referenties

- Story 017 — On-device inference verkenning (`stories/backlog/017-local-mode-on-device-inference.md`)
- "Explore on device transcription" — ExecuTorch-context (`stories/explore on device transcription.md`)
- ExecuTorch Voxtral example — https://github.com/pytorch/executorch/tree/main/examples/models/voxtral
- Voxtral Mini 3B Realtime — https://huggingface.co/mistralai/Voxtral-Mini-3B-2507
- Voxtral Mini 4B Realtime ExecuTorch — https://huggingface.co/mistralai/Voxtral-Mini-4B-Realtime-2602-ExecuTorch
- Android IME guide — https://developer.android.com/develop/ui/views/touch-and-input/creating-input-method
