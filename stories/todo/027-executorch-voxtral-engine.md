# Story 027: ExecuTorch runtime + Voxtral engine

**Epic:** Android Voice Keyboard — On-device inference
**Target:** `android-keyboard/`
**Status:** Backlog
**Priority:** High
**Estimate:** Large

## Summary

Integreer de ExecuTorch Android runtime en bouw een `VoxtralEngine`-facade die
een `.pte` model laadt, audio-chunks accepteert (16 kHz mono float32) en
text-deltas emit. Dit is het kerntechnische risico van het hele plan — Mistral
zelf noemt streaming on-device "sharp edges".

## Acceptance criteria

- [ ] Dependency `org.pytorch:executorch-android:1.x` toegevoegd aan `app`
- [ ] `VoxtralEngine`-klasse met API:
  - `suspend fun load(modelPath: File, backend: Backend)`
  - `fun feedAudio(chunk: FloatArray): Flow<TextDelta>`
  - `suspend fun unload()`
- [ ] Backend enum: `XNNPACK_CPU`, `QNN_NPU` (selectie volgt in 030)
- [ ] Engine survival na config changes: model blijft warm zolang IME visible is
- [ ] Smoke test op instrumentation runner: laad een klein test-model en feed
  een vaste audio buffer; verifieer dat output deterministic is
- [ ] Memory budget gerespecteerd: engine unload onder
  `onTrimMemory(TRIM_MEMORY_RUNNING_CRITICAL)`

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

## References

- ExecuTorch Voxtral example — https://github.com/pytorch/executorch/tree/main/examples/models/voxtral
- Voxtral Mini 3B — https://huggingface.co/mistralai/Voxtral-Mini-3B-2507
- ExecuTorch Android docs — https://pytorch.org/executorch/stable/android.html
- Story 017 — feasibility verkenning
