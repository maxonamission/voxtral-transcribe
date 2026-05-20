# Story 026: IME UI — mic button, level meter, candidate strip

**Epic:** Android Voice Keyboard — Foundation
**Target:** `android-keyboard/`
**Status:** Backlog
**Priority:** High
**Estimate:** Medium

## Summary

De zichtbare IME bestaat uit drie zones: (a) candidate strip bovenaan voor
preliminary tekst, (b) een grote mic-knop in het midden, (c) een statusregel met
mic-level en backend (NPU/CPU). Géén volledig QWERTY in v1 — gebruikers wisselen
voor typen terug naar Gboard via de keyboard-picker.

## Acceptance criteria

- [ ] IME view-hoogte ~40% van scherm (typische IME-hoogte), responsief op landscape
- [ ] Candidate strip toont preliminary text (hardcoded placeholder; echte vulling in 029)
- [ ] Mic-knop: tap-to-toggle of push-to-talk (configureerbaar; default tap-to-toggle)
- [ ] Mic-level meter (horizontale bar) reageert in realtime op input van `AudioRecord`
- [ ] Status-regel toont actieve backend ("NPU" / "CPU") en taal-indicator
- [ ] Switch-keyboard-knop ("globe"-icon) toont system keyboard picker
- [ ] Dark/light mode via Android-systeem-theme

## Proposed approach

1. `KeyboardView : LinearLayout` met drie kind-views — keep it boring, geen Compose
2. `AudioCapture.kt`: opent `AudioRecord` (16 kHz mono PCM), exposeert level via
   StateFlow; nog geen processing pipeline (komt in 029)
3. `MicButton`-state: idle / listening / processing
4. Tekenwerk via XML drawables; één custom view voor de level-meter (Canvas)

## Open questions

- Push-to-talk default? **Nee, tap-to-toggle.** Push-to-talk vermoeit de duim;
  later configureerbaar in settings (033).
- Hoogte van candidate strip? Begin met ~48 dp, evalueer met echt model output.
- Hoe gedragen we ons in landscape (laptop-mode)? IME compact maken, niet 40% van
  het horizontale scherm — voelt absurd.

## Dependencies

- 024 (scaffold), 025 (permissions — mic moet werken)

## References

- https://developer.android.com/reference/android/media/AudioRecord
- Existing webapp UI als referentie voor candidate strip semantiek (`static/app.js`)
