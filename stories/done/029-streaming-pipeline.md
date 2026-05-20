# Story 029: Streaming audio → text pipeline

**Epic:** Android Voice Keyboard — On-device inference
**Target:** `android-keyboard/`
**Status:** Done
**Priority:** High
**Estimate:** Medium

## Summary

Knoop `AudioCapture` (026) en `VoxtralEngine` (027) aan elkaar tot een end-to-end
streaming pipeline: audio in chunks → engine → text deltas → consumer. Eindigt
hier nog niet in `InputConnection` — dat is story 031 — maar wel in een
testbare `Flow<TranscriptionState>` die in de candidate strip kan worden getoond.

## Acceptance criteria

- [x] `TranscriptionPipeline`-klasse in `:core`: start()/stop() + StateFlow met
  `{ preliminary, committed, level }`
- [x] Audio in chunks van ~100 ms (16 kHz mono = 1600 samples). Hertimebaar
  via chunk size in `AudioCapture`. 480 ms-tuning is een latere optimalisatie.
- [x] Backpressure: `AudioCapture.audio` is een `SharedFlow` met
  `DROP_OLDEST` zodat een trage engine niet OOM veroorzaakt
- [x] Voicing-detectie: `lastVoicedAt` bijhouden via `voicingThreshold` op
  level-flow; silenceWatcher triggert commit zodra stilte > drempel
- [x] Sentence-boundary: stilte > `silenceMillisToCommit` (default 700 ms) ⇒ commit.
  Het punctuatie-deel van de heuristiek is **niet** v1 — wachten op echte
  model-output om te tunen (verschuift naar 035 benchmarks)
- [x] Candidate strip toont preliminary real-time vanuit
  `pipeline.state.preliminary`; bij commit verschijnt placeholder weer
- [x] Unit-tests in `:core` met `StubVoxtralEngine` + fake Channel-flow
  (3 tests, alle gegroend op real-time wall-clock binnen 3 s)

## Proposed approach

1. Producer (AudioCapture) emit `FloatArray` chunks naar een `Channel`
2. Worker coroutine leest chunks, feed naar engine, verzamelt deltas
3. Boundary-detector emit commit-events bij stilte/punctuatie
4. State exposed via StateFlow; UI en consumer subscriben

## Open questions

- Welke chunk-grootte voor laagste latency zonder NPU te verzuipen? Start 480 ms,
  evalueer in 035.
- Hoe omgaan met overlapping tussen chunks (window/stride)? Volg ExecuTorch
  example default; tunen bij benchmark.
- Wat doen we bij mic-permissie ingetrokken tijdens streaming? Stop, foutstatus.

## Dependencies

- 026 (audio capture), 027 (engine)

## Notes from implementation

- Pipeline is **pure-Kotlin** (`:core`) en consumeert `Flow<FloatArray>` +
  `Flow<Float>`. AudioCapture wrapt AudioRecord aan de Android-zijde en
  exposeert een `SharedFlow<FloatArray>` van 16 kHz mono float32.
- KeyboardService draait nu met `StubVoxtralEngine` als default — preliminary
  tekst verschijnt in de candidate strip wanneer de gebruiker dicteert
  (proof-of-life voor de hele pipeline). 031 wisselt de stub-output naar
  echte `InputConnection.commitText`.
- Commit-events worden via `SharedFlow<CommitEvent>` gepubliceerd zodat 031
  alleen het einde van een zin hoeft te bedraden zonder de UI-laag aan te
  raken.

## References

- Story 017 — streaming model architectuur
- Webapp `static/app.js` — `RealtimeSession`/`DualDelaySession` als conceptuele blueprint
