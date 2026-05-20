# Story 029: Streaming audio → text pipeline

**Epic:** Android Voice Keyboard — On-device inference
**Target:** `android-keyboard/`
**Status:** Backlog
**Priority:** High
**Estimate:** Medium

## Summary

Knoop `AudioCapture` (026) en `VoxtralEngine` (027) aan elkaar tot een end-to-end
streaming pipeline: audio in chunks → engine → text deltas → consumer. Eindigt
hier nog niet in `InputConnection` — dat is story 031 — maar wel in een
testbare `Flow<TranscriptionState>` die in de candidate strip kan worden getoond.

## Acceptance criteria

- [ ] `TranscriptionPipeline`-klasse:
  - `fun start()`, `fun stop()`
  - `val state: StateFlow<TranscriptionState>` met `{ preliminary, committed, level }`
- [ ] Audio gebufferd in chunks van X ms (afgestemd op model — start 480 ms)
- [ ] Backpressure: als engine traag is mag audio droppen, niet OOM
- [ ] Voicing-detectie (simpele RMS-threshold) om silent chunks over te slaan
- [ ] Sentence-boundary heuristiek: stilte > 700 ms + laatst-emitted token is `.`/`!`/`?` ⇒ commit
- [ ] Candidate strip toont `preliminary` real-time, committed-deel verdwijnt uit strip en gaat naar consumer
- [ ] Unit/instrumentation test met een gefixeerde audio-file en gemockte engine

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

## References

- Story 017 — streaming model architectuur
- Webapp `static/app.js` — `RealtimeSession`/`DualDelaySession` als conceptuele blueprint
