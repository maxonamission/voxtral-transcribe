# Story 025: IME enable + microphone permission UX

**Epic:** Android Voice Keyboard — Foundation
**Target:** `android-keyboard/`
**Status:** Done
**Priority:** High
**Estimate:** Small

## Summary

Een Android IME inschakelen vereist drie stappen die makkelijk verkeerd gaan:
(1) IME activeren in Instellingen, (2) IME selecteren als actief toetsenbord,
(3) mic-permissie geven. Bouw een onboarding-flow in de host-app die elke stap
detecteert en de gebruiker er stap-voor-stap doorheen leidt.

## Acceptance criteria

- [x] Host-app launcher activity met onboarding-stappen (`MainActivity`, Compose)
- [x] Stap 1: opent `Settings.ACTION_INPUT_METHOD_SETTINGS`, detecteert
  enabled status via `InputMethodManager.enabledInputMethodList`
- [x] Stap 2: toont `showInputMethodPicker()`, detecteert default IME via
  `Settings.Secure.DEFAULT_INPUT_METHOD`
- [x] Stap 3: `RECORD_AUDIO`-permissie via
  `ActivityResultContracts.RequestPermission`
- [x] Iedere stap toont status (✓ of stapnummer)
- [x] Bij volledig klaar: testveld zichtbaar
- [x] Permanent weigeren detecteren via `shouldShowRequestPermissionRationale`
  → knop schakelt naar "Open app-instellingen"
- [x] Pure-logica `OnboardingState` in `:core` met unit tests

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

## Notes from implementation

- `OnboardingState` lives in `:core` (pure Kotlin) and is unit-tested. The
  Android-specific snapshot lives in `:app` (`IMEStatus.snapshot(context)`).
- Compose adoption starts here: BOM 2024.12.01, Material 3, Activity Compose,
  and `lifecycle-runtime-compose` for the (relocated) `LocalLifecycleOwner`.
- Re-check on resume via `DisposableEffect` + `LifecycleEventObserver` — picks
  up changes after returning from system settings.
- Mic permission is requested in the host app, not from the IME. Android
  doesn't reliably let an IME show permission dialogs.

## References

- https://developer.android.com/reference/android/view/inputmethod/InputMethodManager
- https://developer.android.com/training/permissions/requesting
