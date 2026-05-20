# Story 032: Voice commands port to Kotlin

**Epic:** Android Voice Keyboard — Dictation parity
**Target:** `android-keyboard/core`
**Status:** Backlog
**Priority:** Medium
**Estimate:** Medium

## Summary

Port de minimale voicecommand-set uit `shared/` (TypeScript) naar Kotlin in
`android-keyboard/core`. Hergebruik de bestaande testcases als referentie.
v1 dekt: new paragraph, new line, undo, stop recording. Headings, lists en
to-do items komen later.

## Acceptance criteria

- [ ] `CommandMatcher.kt` in `:core` module
- [ ] Set met: `new paragraph`, `new line`, `undo`, `stop recording` (NL + EN)
- [ ] Suffix-matching: command moet aan het einde van een utterance staan (zoals
  in de webapp)
- [ ] Hallucination guard: commands met heel korte audio worden niet gematched
- [ ] Unit tests dekken minimaal dezelfde cases als `shared/__tests__/`
- [ ] Geen Android-dependencies in `:core` — pure Kotlin/JVM module

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

## References

- Webapp shared core — `shared/src/`
- Done stories 011, 012 — dual-delay en command-matching tests
