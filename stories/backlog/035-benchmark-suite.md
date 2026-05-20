# Story 035: On-device benchmark suite (WER + latency)

**Epic:** Android Voice Keyboard — Reliability & distribution
**Target:** `android-keyboard/`
**Status:** Backlog
**Priority:** Medium
**Estimate:** Medium

## Summary

We moeten weten of on-device Voxtral Realtime daadwerkelijk goed genoeg is — niet
op papier, op een echt toestel. Bouw een herhaalbare benchmark die op een
referentie-toestel (S25 Ultra of vergelijkbaar) WER, latency, battery-drain en
thermal throttling meet.

## Acceptance criteria

- [ ] `android-keyboard/benchmark` module met instrumented tests
- [ ] Test-corpus: 10 Nederlandse en 10 Engelse audio-fragmenten (5–30 s elk)
  met ground-truth transcripten. Hergebruik audio-testset uit `tests/` waar mogelijk
- [ ] Meet per fragment: WER (Word Error Rate), first-token-latency, end-of-utterance-latency
- [ ] Run dezelfde set op QNN en XNNPACK backend; vergelijk
- [ ] Continu-meting: 5 min onafgebroken dicteren, meet battery drop en SoC temp
- [ ] Output: Markdown-rapport in `android-keyboard/benchmark/results/<date>-<device>.md`
- [ ] CI: benchmark draait **niet** in CI (heeft device nodig), maar de WER-evaluator wel als unit test

## Proposed approach

1. WER via `jiwer`-Kotlin port of eigen simpele implementatie (Levenshtein op
   tokens)
2. Audio-fragmenten als asset, ground-truth als JSON
3. Test draait via `connectedAndroidTest`; rapporteert via `Logcat` en file dump
4. Battery-meting via `BatteryManager` snapshot pre/post

## Open questions

- Welke audio-testset? Voxtral-repo heeft al een set in `tests/` (zie story 022).
  Hergebruiken en aanvullen.
- WER threshold die we acceptabel vinden? Plan: **< 10% NL** op rustige audio
  als pass-criterion voor v1.

## Dependencies

- 027 (engine), 030 (backend selectie), 022 (audio-tests) — al gebracht via
  `Adopt audio test tooling from parked LvDiN branch`

## References

- Story 022 — audio integration tests in webapp
- jiwer (Python) — https://github.com/jitsi/jiwer
