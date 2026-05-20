# Story 033: Settings screen — language, delay, gain

**Epic:** Android Voice Keyboard — Dictation parity
**Target:** `android-keyboard/`
**Status:** Backlog
**Priority:** Medium
**Estimate:** Small

## Summary

Een settings-scherm in de host-app voor de IME-configuratie. Geen settings binnen
de IME-view zelf — Android's IME-context is een rotplek voor preference-UI.

## Acceptance criteria

- [ ] `SettingsActivity` (Compose) met:
  - Taal: dropdown met 13 Voxtral-talen, default NL
  - Streaming delay: 240 / 480 / 1000 / 2400 ms (matcht webapp)
  - Mic gain: -6 / 0 / +6 / +12 dB
  - Backend: Auto / NPU / CPU (zie 030)
  - Mic-trigger: tap-to-toggle / push-to-talk
  - "Model beheren": grootte op disk, "verwijder model"-knop
- [ ] Persistent via `DataStore` (Preferences DataStore)
- [ ] IME leest settings via een gedeelde repository; reactief (Flow), pickt
  wijzigingen op zonder herstart
- [ ] Settings bereikbaar vanuit (a) host-app launcher, (b) lange-druk op IME
  mic-knop (opent activity)

## Proposed approach

1. `SettingsRepository` met DataStore
2. `SettingsViewModel` (Compose) met state hoist
3. IME-services injecteren de repository (geen DI-framework nodig — handmatige
   wire-up is voldoende voor deze schaal)

## Dependencies

- 024 (scaffold), 030 (backend selectie heeft een setting nodig)

## References

- https://developer.android.com/topic/libraries/architecture/datastore
