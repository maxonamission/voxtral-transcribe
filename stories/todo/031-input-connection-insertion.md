# Story 031: Text insertion via InputConnection (preview + commit)

**Epic:** Android Voice Keyboard — Dictation parity
**Target:** `android-keyboard/`
**Status:** Backlog
**Priority:** High
**Estimate:** Medium

## Summary

Vertaal de `TranscriptionState` (029) naar `InputConnection`-calls met dezelfde
semantiek als de webapp: preliminary text via `setComposingText()` met
underline-styling, gevolgd door `commitText()` op sentence boundaries. Cursor en
selectie-respect: dicteren midden in een veld vervangt de selectie of voegt
in op de cursor — geen kapotte tekst.

## Acceptance criteria

- [ ] Preliminary text verschijnt onderlined in het invoerveld via `setComposingText`
- [ ] Op commit-event: `finishComposingText` + `commitText` met formatted output
- [ ] Cursor positie respecteren: insert op huidige cursor; selectie wordt vervangen
- [ ] `commitText` met `newCursorPosition = 1` (na inserted text)
- [ ] Stop-recording (mic-knop uit): finalize composing zonder verlies
- [ ] Backspace-knop op IME werkt normaal (proxy naar host)
- [ ] Testen tegen verschillende EditText-types: plain, multiline, search, password (geen mic in password)
- [ ] Wachtwoord-velden: detecteer `InputType.TYPE_TEXT_VARIATION_PASSWORD` en disable mic met uitleg

## Proposed approach

1. `InputConnectionAdapter` consumeert `TranscriptionState`-flow
2. Houdt eigen "wat is op het scherm vs wat is committed" administratie bij —
   nodig omdat sommige apps composing text negeren
3. Diff-based update: alleen het veranderde deel via `setComposingText`
4. Fallback: als `setComposingText` niet werkt (sommige apps), `commitText` per delta

## Open questions

- Apps die composing text breken (terminal-emulators, sommige IDE's) — detect en
  fallback?
- Hoe gedragen we ons bij undo? Android-systeem-undo werkt per commit; lijkt OK.

## Dependencies

- 026 (UI), 029 (pipeline emit state)

## References

- https://developer.android.com/reference/android/view/inputmethod/InputConnection
- Webapp tekst-insertie logica (`obsidian-plugin/src/...`) — concepten zijn
  vergelijkbaar maar API verschilt
