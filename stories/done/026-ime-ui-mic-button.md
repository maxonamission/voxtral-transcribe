# Story 026: IME UI — mic button, level meter, candidate strip

**Epic:** Android Voice Keyboard — Foundation
**Target:** `android-keyboard/`
**Status:** Done
**Priority:** High
**Estimate:** Medium

## Summary

De zichtbare IME bestaat uit drie zones: (a) candidate strip bovenaan voor
preliminary tekst, (b) een grote mic-knop in het midden, (c) een statusregel met
mic-level en backend (NPU/CPU). Géén volledig QWERTY in v1 — gebruikers wisselen
voor typen terug naar Gboard via de keyboard-picker.

## Acceptance criteria

- [x] IME view-hoogte 280 dp (vaste hoogte; landscape-tuning is een latere verfijning)
- [x] Candidate strip toont placeholder ("Tap de microfoon om te dicteren…");
  invulling vanuit transcriptie komt in 029
- [x] Mic-knop: tap-to-toggle (default, geen push-to-talk in 026)
- [x] Mic-level meter (horizontale `ProgressBar`) reageert op `AudioRecord`
  RMS via `core` `AudioLevel.rmsInt16` + smoothing
- [x] Status-regel toont taal (NL) en backend-placeholder (CPU); echte detectie
  komt in 030 (backend) en 033 (taal-setting)
- [x] Switch-keyboard-knop (globe-icoon) roept `showInputMethodPicker()` aan
- [x] Thema `Theme.DeviceDefault.DayNight.NoActionBar` — volgt systeem dark/light

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

## Notes from implementation

- `AudioCapture` opent `AudioRecord` met `VOICE_RECOGNITION` source (geeft
  Android-side noise suppression / AGC). Sample rate 16 kHz mono PCM — exact
  wat Voxtral verwacht (027/029).
- Level-berekening (`AudioLevel.rmsInt16` + `smooth`) zit in `:core` met unit
  tests — geen Android-deps, snel testbaar.
- IME-hoogte is voor nu vast op 280 dp. Story 034 (battery/lifecycle) en latere
  UX-iteraties kunnen dat per oriëntatie / scherm tuning bijstellen.
- Push-to-talk is bewust niet geïmplementeerd in v1; comes in 033 (settings).
- De vorige "Insert voxtral"-smoke-knop uit 024 is verwijderd — de mic-knop
  is nu de centrale interactie. Tot 029 doet hij wel audio capture maar
  schrijft geen tekst.

## References

- https://developer.android.com/reference/android/media/AudioRecord
- Existing webapp UI als referentie voor candidate strip semantiek (`static/app.js`)
