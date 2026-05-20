# Story 025: IME enable + microphone permission UX

**Epic:** Android Voice Keyboard — Foundation
**Target:** `android-keyboard/`
**Status:** Backlog
**Priority:** High
**Estimate:** Small

## Summary

Een Android IME inschakelen vereist drie stappen die makkelijk verkeerd gaan:
(1) IME activeren in Instellingen, (2) IME selecteren als actief toetsenbord,
(3) mic-permissie geven. Bouw een onboarding-flow in de host-app die elke stap
detecteert en de gebruiker er stap-voor-stap doorheen leidt.

## Acceptance criteria

- [ ] Host-app launcher activity met onboarding-stappen
- [ ] Stap 1: "Activeer Voxtral in Instellingen" → opent
  `Settings.ACTION_INPUT_METHOD_SETTINGS`, detecteert na terugkeer of de IME
  enabled is via `InputMethodManager.getEnabledInputMethodList()`
- [ ] Stap 2: "Kies Voxtral als toetsenbord" → toont `showInputMethodPicker()`,
  detecteert na terugkeer of de IME default is
- [ ] Stap 3: "Geef microfoon-toegang" → `RECORD_AUDIO`-permissie via
  `ActivityResultContracts.RequestPermission`
- [ ] Iedere stap toont status (✓ klaar / ✗ open)
- [ ] Bij volledig klaar: testveld om in te dicteren (placeholder voor v1)
- [ ] Als gebruiker permissie weigert: uitleg + knop "Open app-instellingen"

## Proposed approach

1. `OnboardingActivity` (Compose) met `OnboardingViewModel` die de status van
   elke stap polled in `onResume()`
2. Helpers in `IMEStatus.kt`: `isEnabled(context)`, `isDefault(context)`,
   `hasMicPermission(context)`
3. Permissie wordt gevraagd **in de host-app**, niet vanuit de IME zelf — Android
   staat permissie-dialogen vanuit IME-context niet goed toe
4. Permissie geldt voor het hele app-package; de `InputMethodService` kan
   `AudioRecord` openen mits de permissie is verleend

## Open questions

- Wat als gebruiker mic-permissie weigert maar IME wel activeert? IME moet
  netjes degraderen: toon een uitleg op de mic-knop ipv crash.
- Background mic-permissie (`FOREGROUND_SERVICE_MICROPHONE`) — pas nodig zodra
  we een service hebben (story 034).

## Dependencies

- 024 (scaffold)

## References

- https://developer.android.com/reference/android/view/inputmethod/InputMethodManager
- https://developer.android.com/training/permissions/requesting
