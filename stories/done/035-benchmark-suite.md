# Story 035: On-device benchmark suite (WER + latency)

**Epic:** Android Voice Keyboard — Reliability & distribution
**Target:** `android-keyboard/`
**Status:** Done (WER + runner; audio corpus + real measurement device-only)
**Priority:** Medium
**Estimate:** Medium

## Summary

We moeten weten of on-device Voxtral Realtime daadwerkelijk goed genoeg is — niet
op papier, op een echt toestel. Bouw een herhaalbare benchmark die op een
referentie-toestel (S25 Ultra of vergelijkbaar) WER, latency, battery-drain en
thermal throttling meet.

## Acceptance criteria

- [x] **WER-implementatie** in `:core` (Wagner-Fischer op woord-niveau,
  punctuatie-strip + lowercase normalisatie) met 7 unit tests
- [x] **BenchmarkRunner** in `:app/src/androidTest`: leest manifest, runt
  engine per sample per backend, schrijft Markdown-rapport
- [x] **Asset-structuur**: `app/src/androidTest/assets/benchmark/{manifest.json, nl/*, en/*}`
  met placeholder-manifest die wacht op echte WAV-bestanden
- [x] **Documentatie**: `android-keyboard/benchmark/README.md` met
  draaiwijze, pass-thresholds en corpusvereisten
- [x] **CI-discipline**: instrumented tests draaien niet in CI (geen device);
  de WER-evaluator wordt wel via :core unit-tests gevalideerd
- [ ] **Echte audio-fragmenten** (10 NL + 10 EN) — wachten op opnames; manifest
  bevat TODO-entries
- [ ] **5-minuten battery/thermal continu-meting** — komt zodra het echte
  ExecuTorch-pad geldig is (anders is de meting niet representatief)

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

## Notes from implementation

- **Geen aparte Gradle-module**: instrumented tests leven in
  `:app/src/androidTest`. Een eigen `:benchmark` module geeft beperkte
  meerwaarde en zou de model + ExecuTorch-deps moeten dupliceren.
- **WER in `:core`**: pure Kotlin/JVM, makkelijk te draaien in CI. Mocht de
  webapp ooit dezelfde scoring willen, kan ze deze functie hergebruiken
  via een KMP-publicatie.
- **WAV-reader** is bewust naïef: 16 kHz mono PCM met 44-byte standaard
  header. Past bij wat we opnemen voor de testset; ondersteunt niet alle
  WAV-varianten.

## References

- Story 022 — audio integration tests in webapp
- Voxtral-transcribe `tests/audio-integration/RECORDING-GUIDE.md`
- jiwer (Python) — https://github.com/jitsi/jiwer
