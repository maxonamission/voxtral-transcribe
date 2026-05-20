# Story 027: ExecuTorch runtime + Voxtral engine

**Epic:** Android Voice Keyboard — On-device inference
**Target:** `android-keyboard/`
**Status:** Done (skeleton + stub) — JNI wiring blocked on device verification
**Priority:** High
**Estimate:** Large

## Summary

Integreer de ExecuTorch Android runtime en bouw een `VoxtralEngine`-facade die
een `.pte` model laadt, audio-chunks accepteert (16 kHz mono float32) en
text-deltas emit. Dit is het kerntechnische risico van het hele plan — Mistral
zelf noemt streaming on-device "sharp edges".

## Acceptance criteria

- [x] Dependency `org.pytorch:executorch-android:1.2.0` toegevoegd aan `:app`
  (1.x op Maven Central; story spec van "1.x" gehaald)
- [x] `VoxtralEngine`-interface in `:core` met:
  - `suspend fun load(modelPath: String, backend: VoxtralBackend): EngineEvent`
  - `fun feedAudio(chunk: FloatArray): Flow<TextDelta>`
  - `suspend fun unload()`
- [x] Backend enum: `XNNPACK_CPU`, `QNN_NPU` (selectie volgt in 030)
- [x] `StubVoxtralEngine` in `:core` met unit tests (vervangt smoke test op
  instrumentation runner totdat device-verificatie kan)
- [x] `ExecutorchVoxtralEngine` skeleton in `:app` met JNI-call sites
  gemarkeerd als `TODO(device)` — wachten op device-bring-up
- [ ] Engine survival na config changes — komt in 029 (IME-wiring)
- [ ] `onTrimMemory(TRIM_MEMORY_RUNNING_CRITICAL)` → unload — komt in 034
  (battery/thermal management)

## Proposed approach

1. Lees de ExecuTorch Android example voor Voxtral grondig (zie referenties)
2. JNI/Java-API van ExecuTorch wrappen in idiomatic Kotlin met `suspend`/`Flow`
3. Audio-conversie: AudioRecord PCM16 → float32 normalized [-1, 1]
4. Streaming-protocol van het Realtime-model gebruiken (sliding window attention,
   stateful decoding). Begin met fixed delay 480 ms — sweet spot uit story 017
5. Tokenizer in `assets/` (klein bestand, mag wel in APK)
6. Model **niet** in APK — komt via story 028

## Open questions

- Welke `.pte` artefact-versie? Voxtral-Mini-3B-2507 of 4B-Realtime-2602? **Plan:
  3B** — kleiner, sneller; minder accuraat maar passender voor mobiel-budget.
- Hoe verwerken we end-of-utterance / sentence boundaries on-device? Het Realtime
  model emit tokens, geen segmentatie. Eigen heuristiek (stilte > 700 ms +
  punctuatie-aanwezig) — uitwerken in 029.
- Concurrency: ExecuTorch session is **niet** thread-safe; lock-protect of single
  worker thread met channel?
- Wat te doen als model laden faalt? IME moet niet crashen — degradeer naar
  "Voxtral niet beschikbaar" status, link naar download-flow (028).

## Risks

- ExecuTorch streaming-API kan instabiel zijn; reserveer tijd voor debug-iteraties.
- Op niet-Snapdragon devices krijg je XNNPACK-only; latency kan tegenvallen.
- JNI memory leaks zijn een klassieke valkuil — gebruik `AutoCloseable`/`use {}`.

## Dependencies

- 024 (scaffold), 026 (audio capture beschikbaar)

## Notes from implementation

- **Maven coordinates verified**: `org.pytorch:executorch-android` is published
  on Maven Central up to 1.2.0; `executorch-android-qnn` separately to 1.1.0
  (komt in story 030).
- **Two engines side-by-side**: pure-Kotlin `StubVoxtralEngine` voor tests en
  dev-bring-up; `ExecutorchVoxtralEngine` met de echte dep is een skeleton
  totdat de JNI-API op een echt toestel geverifieerd is. Story 029 (pipeline)
  en 031 (insertion) kunnen dus al getest worden tegen de Stub.
- **Wat niet gedaan kon worden in deze sandbox**:
  - Daadwerkelijke JNI-aanroepen naar `org.pytorch.executorch.Module` — de
    Maven-jar is niet getest in deze omgeving (geen Android SDK, geen device).
    Alle JNI-call sites zijn gemarkeerd met `TODO(device)`.
  - Tokenizer-laden — wacht op story 028 die het tokenizer-bestand levert.
  - Streaming KV-cache / sliding-window state management — vereist het echte
    model en de PyTorch ExecuTorch Voxtral-example.
- **Thread safety**: engine state is beschermd met een `Mutex`; ExecuTorch
  `Module` is single-threaded dus alle inference-calls moeten serieel.

## References

- ExecuTorch Voxtral example — https://github.com/pytorch/executorch/tree/main/examples/models/voxtral
- Voxtral Mini 3B — https://huggingface.co/mistralai/Voxtral-Mini-3B-2507
- ExecuTorch Android docs — https://pytorch.org/executorch/stable/android.html
- Story 017 — feasibility verkenning
