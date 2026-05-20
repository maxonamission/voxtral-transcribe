# Story 032: Voice commands port to Kotlin

**Epic:** Android Voice Keyboard — Dictation parity
**Target:** `android-keyboard/core`
**Status:** Done
**Priority:** Medium
**Estimate:** Medium

## Summary

Port de minimale voicecommand-set uit `shared/` (TypeScript) naar Kotlin in
`android-keyboard/core`. Hergebruik de bestaande testcases als referentie.
v1 dekt: new paragraph, new line, undo, stop recording. Headings, lists en
to-do items komen later.

## Acceptance criteria

- [x] `CommandMatcher.kt` in `:core` met `VoiceCommand` enum en
  `CommandMatch(command, residual)` return-type
- [x] NL + EN patronen geport vanuit `shared/src/languages/{nl,en}.json` voor:
  `NEW_PARAGRAPH`, `NEW_LINE`, `UNDO`, `STOP_RECORDING`
- [x] Suffix-matching met case-insensitive vergelijk + trailing-punctuation
  strip
- [x] Hallucination guard: utterances korter dan 3 tekens worden genegeerd
- [x] 10 unit tests in `:core` (suffix-match, undo, stop, punctuatie strip,
  case-insensitivity, etc.)
- [x] Geen Android-deps in `:core` — pure Kotlin/JVM
- [x] KeyboardService converteert `CommandMatch` naar
  `InputConnection`-acties: `commitText("\n\n")`, `commitText("\n")`,
  `performContextMenuAction(android.R.id.undo)`, en `pipeline.stop()`

## Proposed approach

1. Lees `shared/src/.../commands.ts` en bijbehorende tests
2. Port de matcher 1-op-1; gebruik dezelfde JSON met command-definities (eenvoudig
   te delen door het bestand mee te kopiëren of via een build-step te downloaden)
3. Tests in `:core/src/test/kotlin/`
4. `TranscriptionPipeline` (029) consumeert de matcher op committed text en
   converteert command-tekst naar `InputAction` (insert `\n\n`, undo via
   `performContextMenuAction(android.R.id.undo)`, stop pipeline)

## Open questions

- JSON-bron van commands: kopiëren of build-step? **Plan**: kopiëren voor v1.
  Tweesporenbeleid is overhead, en de set wijzigt zelden. Synchronisatie via
  CI-check (lint die diff'd) is een latere story als het pijnlijk wordt.
- Heading/list/to-do commands — buiten v1, want vereist Markdown-aware
  formatting in plain-text-editors (vaak ongewenst).

## Dependencies

- 029 (pipeline), 031 (insertion-API om commands te effectueren)

## Notes from implementation

- **Patroon-set bewust beperkt** tot v1-doel: 4 commands × 2 talen. De
  webapp ondersteunt ~20 commands × 13 talen (markdown-specifiek). Toevoegen
  is mechanisch (extra entries in `NL_PATTERNS`/`EN_PATTERNS`).
- **Geen JSON-import** — patronen zijn hardcoded Kotlin maps. Gerechtvaardigd
  omdat de set zelden wijzigt en JSON-parsing in `:core` zou kotlinx-serialization
  vereisen. Synchronisatie met de webapp is een handmatige check.
- **Phonetic normalisation en mishearing rules** uit `shared/` zijn nog niet
  geport. Pas relevant als blijkt dat het Voxtral-model op het toestel veel
  systematische fouten maakt — uitwerken in benchmark-story 035.
- **Taal-keuze hardcoded NL** in KeyboardService. Wisselbaar zodra setting 033
  taalkeuze toevoegt.

## References

- Webapp shared core — `shared/src/voice-commands.ts` en
  `shared/src/languages/{nl,en}.json`
- Done stories 011, 012 — dual-delay en command-matching tests
