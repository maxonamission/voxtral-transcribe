# Story 002: Full i18n — translate all UI strings to 13 languages

**Epic:** Internationalization
**Status:** Backlog
**Priority:** Medium
**Estimate:** Large

## Summary

The app supports 13 languages for voice commands, help panel, and BMC taglines, but ~80+ UI strings are still hardcoded in Dutch. All user-facing text needs to be internationalized.

## Supported languages (13)

`nl`, `en`, `fr`, `de`, `es`, `pt`, `it`, `ru`, `zh`, `hi`, `ar`, `ja`, `ko`

## What's already translated

- Voice command patterns (13 languages)
- Help panel UI (HELP_UI, HELP_GROUPS) — 7 languages
- BMC footer taglines — 13 languages
- Language selection and storage system

## What needs translation (~80+ strings)

### A. Status & mode text (app.js)
- `"Realtime"`, `"Opname"` — mode display
- `"Opnemen (realtime)"`, `"Opnemen (dual-delay)"` — recording status
- `"Opnemen..."`, `"Transcriberen..."` — batch mode status
- `"Dual-delay actief (snel 240ms + nauwkeurig 2400ms)"` — tooltip

### B. Button labels (index.html + app.js)
- `"Opnemen"` / `"Stop"` — record button
- `"Controleer"`, `"Kopieer"`, `"Wis"` — action buttons
- `"Opslaan"`, `"Sluiten"` — settings modal
- `"Feedback"` — footer link

### C. Toast notifications (app.js)
- Connection: `"Herverbonden"`, `"Herverbinden mislukt"`, `"Serverfout — herverbinden..."`
- Mic: `"Geselecteerde microfoon niet beschikbaar — standaard gebruikt"`
- Copy: `"Gekopieerd"`
- Queue: `"Wachtrij verwerken (${count})..."`, `"${processed} opname(s) verwerkt"`
- Correction: `"Tekst gecorrigeerd"`, `"Geen correcties nodig"`, `"Correctie mislukt: "`
- Settings: `"Instellingen opgeslagen"`, `"Valideren..."`, `"Opgeslagen en gevalideerd"`, `"Opslaan mislukt"`

### D. Error messages (app.js)
- `"Microfoon niet beschikbaar — controleer je apparaat of kies een andere microfoon in de instellingen"`
- `"Geen toestemming voor microfoon — sta toegang toe in je browser"`
- `"Geen toegang tot microfoon"`
- `"Verbindingsfout: "`

### E. Placeholders & hints (index.html)
- `"Druk op opnemen om te beginnen..."` — transcript placeholder
- `"Plak je API key hier..."` — API key input
- `"Druk gewenste toetscombinatie..."` — shortcut input
- `"Bijv: Gebruik 'AI' niet als 'ik'..."` — system prompt placeholder

### F. Settings modal labels (index.html)
- `"Instellingen"`, `"Mistral API Key"`, `"Taal / Language"`, `"Microfoon"`
- `"Realtime model"`, `"Batch model"`, `"Correctiemodel"`
- `"Sneltoets opnemen"`, `"Dual-delay (experimenteel)"`, `"Tekstcorrectie"`
- All description/hint text beneath each setting

### G. Tooltips (index.html)
- `"Stemcommando's"`, `"Realtime of opname modus"`, `"Sprekerherkenning (alleen opname)"`
- `"Selecteer de microfoon voor opname"`, `"Reset naar Ctrl+Space"`

## Suggested approach

1. Create a `UI_STRINGS` translation object keyed by language code (similar to existing `HELP_UI` pattern)
2. Add a `t(key)` helper function that looks up `activeLang` with English fallback
3. Replace all hardcoded Dutch strings with `t("key")` calls
4. For HTML elements: update dynamically in `updateUILanguage()` called on language change
5. For interpolated strings: use template functions `t("queueProcessing", { count })`
6. Extend HELP_UI and HELP_GROUPS from 7 to 13 languages

## Notes

- English should be the fallback when a translation is missing
- Consider whether `<html lang="nl">` should also update dynamically
