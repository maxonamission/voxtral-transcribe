# Story 031: Text insertion via InputConnection (preview + commit)

**Epic:** Android Voice Keyboard — Dictation parity
**Target:** `android-keyboard/`
**Status:** Done
**Priority:** High
**Estimate:** Medium

## Summary

Vertaal de `TranscriptionState` (029) naar `InputConnection`-calls met dezelfde
semantiek als de webapp: preliminary text via `setComposingText()` met
underline-styling, gevolgd door `commitText()` op sentence boundaries. Cursor en
selectie-respect: dicteren midden in een veld vervangt de selectie of voegt
in op de cursor — geen kapotte tekst.

## Acceptance criteria

- [x] Preliminary text via `setComposingText(text, 1)` — Android tekent dit
  standaard onderlined; geen aparte styling nodig
- [x] Op commit: `finishComposingText` + `commitText(text, 1)`
- [x] Cursor: `newCursorPosition = 1` plaatst cursor na de inserted text;
  Android-IC respecteert bestaande selectie (vervangt indien aanwezig)
- [x] Stop-recording: `pipeline.stop()` + `finishComposingIfNeeded()` zodat
  preliminary text niet verloren gaat
- [ ] Backspace-knop in IME — er staat geen backspace-knop in de v1-layout
  (bewust minimalistisch). Gebruiker swipet naar Gboard voor edits. Toevoegen
  als gebruikers er om vragen.
- [x] Wachtwoord-velden gedetecteerd in `isSensitiveInputType()` voor zowel
  `TEXT_VARIATION_PASSWORD`/`VISIBLE_PASSWORD`/`WEB_PASSWORD` als
  `NUMBER_VARIATION_PASSWORD`. Mic-knop dimt en candidate strip toont
  uitleg ipv placeholder.

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

## Notes from implementation

- `lastPreliminary` field tracked in KeyboardService → diff-based update:
  `setComposingText` alleen aanroepen als preliminary daadwerkelijk veranderd is.
- `finishComposingIfNeeded()` aangeroepen op stop, finishInput en finishInputView
  zodat we geen "hangende" composing text achterlaten.
- Sensitivity check op `onStartInput` zodat field-switches (bijv. naar
  wachtwoord-veld) live worden gedetecteerd zonder dat de IME hoeft te herladen.
- Het webapp-gedeelte met mid-text editing en list/heading-formatting is
  bewust niet geport — past niet bij dicteren in willekeurige Android-velden.

## References

- https://developer.android.com/reference/android/view/inputmethod/InputConnection
- https://developer.android.com/reference/android/text/InputType
- Webapp tekst-insertie logica (`obsidian-plugin/src/...`) — concepten zijn
  vergelijkbaar maar API verschilt
