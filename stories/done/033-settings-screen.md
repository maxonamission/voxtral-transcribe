# Story 033: Settings screen — language, delay, gain

**Epic:** Android Voice Keyboard — Dictation parity
**Target:** `android-keyboard/`
**Status:** Done (scope: NL/EN + backend + mic-trigger + delay + model delete; 13-lang + mic-gain deferred)
**Priority:** Medium
**Estimate:** Small

## Summary

Een settings-scherm in de host-app voor de IME-configuratie. Geen settings binnen
de IME-view zelf — Android's IME-context is een rotplek voor preference-UI.

## Acceptance criteria

- [x] `SettingsActivity` (Compose Material 3) met:
  - **Taal**: NL / EN (uitgebreid naar 13 talen wanneer `CommandMatcher`
    patronen voor de overige Voxtral-talen krijgt — story 032 follow-up)
  - **Streaming delay**: 240 / 480 / 1000 / 2400 ms
  - **Backend**: Auto / Force NPU / Force CPU
  - **Mic-trigger**: tap (toggle) / push (vasthouden)
  - **Model beheren**: grootte op disk + "Verwijder model"-knop
- [ ] **Mic gain**: deferred. `AudioRecord` heeft geen native gain-knop; vereist
  software-gain in AudioCapture met clipping detection. Pas zinvol na 035
  benchmarks. Note in `:app/audio/AudioCapture.kt` als follow-up.
- [x] Persistent via `androidx.datastore.preferences`
- [x] IME leest settings reactief via `SettingsRepository.settings` Flow;
  language en backend wisselen worden live opgepikt zonder restart
- [x] Settings bereikbaar via (a) "Open instellingen"-knop in `MainActivity`,
  (b) lange-druk op de mic-knop in de IME

## Proposed approach

1. `SettingsRepository` met DataStore
2. `SettingsViewModel` (Compose) met state hoist
3. IME-services injecteren de repository (geen DI-framework nodig — handmatige
   wire-up is voldoende voor deze schaal)

## Dependencies

- 024 (scaffold), 030 (backend selectie heeft een setting nodig)

## Notes from implementation

- **Mic gain weggesnijden** voor v1 — software-gain (sample × factor) is
  triviaal te implementeren maar zinvol tunen vereist clip-detectie en
  feedback in de level meter. Pas relevant als benchmark-story 035 laat zien
  dat audio te zacht is voor het model.
- **Slechts 2 talen** vooralsnog: de `CommandMatcher`-patronen (032) zijn
  alleen NL en EN. Uitbreiden naar de overige 11 Voxtral-talen is mechanisch
  zodra we besluiten welke we willen ondersteunen. Tot dan beperk ik de
  dropdown om te voorkomen dat gebruikers een taal kiezen waarvan de commands
  niet werken.
- **Live re-apply**: KeyboardService observeert `SettingsRepository.settings`
  in een launched coroutine en past `commandMatcher` + `resolvedBackend`
  direct toe. Mic-trigger en streaming delay zijn opgeslagen maar nog niet
  in het gedrag gebonden — een latere kleine wijziging in AudioCapture /
  pipeline.

## References

- https://developer.android.com/topic/libraries/architecture/datastore
