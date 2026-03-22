# Epic: Custom Commands & Extensibility

## Scope
Idee 1 (Slots), 2 (Custom Commands), 4 (Context-Awareness), 5 (Templates).
Idee 3 (Command Palette) is expliciet out-of-scope voor nu.
Focus: Obsidian plugin als primair platform, webapp volgt waar relevant.

---

## Fase 1: Fundament — Betere Matching Engine

### 1A. Talisman integreren voor fonetische matching
- `talisman` als dependency toevoegen aan obsidian-plugin
- Per taal het juiste fonetische algoritme selecteren:
  - NL/DE: Kölner Phonetik
  - EN: Double Metaphone
  - FR: French Soundex (Talisman)
  - RU: russian_soundex of Double Metaphone fallback
  - Overige: fallback op bestaande Levenshtein
- In `voice-commands.ts`: `matchCommand()` uitbreiden met een fonetische vergelijkingsstap vóór de Levenshtein-fallback
- Matching volgorde wordt: exact → fonetisch → fuzzy (Levenshtein ≤ 2)

### 1B. Prefix-matching & lidwoord-stripping
- Lidwoorden strippen per taal aan begin van potentiële commands:
  - NL: "een", "de", "het"
  - EN: "a", "the"
  - FR: "un", "une", "le", "la", "les"
  - DE: "ein", "eine", "der", "die", "das"
  - (etc. voor overige talen)
- Trailing woorden na een command-match negeren ("nieuwe alinea alsjeblieft")
- Samengeplakte woorden detecteren ("nieuwealinea" → "nieuwe alinea")

### 1C. Webapp synchroon houden
- Dezelfde matching-verbeteringen doorvoeren in `app.js` LANG_PATTERNS/matchCommand

---

## Fase 2: Context-Aware Commands

### 2A. Lijst-type detectie
- Bij "nieuw punt" / "new item": check vorige regel
  - `- [ ] ...` → voeg `\n- [ ] ` in (todo voortzetten)
  - `1. ...` / `2. ...` → voeg `\n{n+1}. ` in (nummering doortellen)
  - `- ...` → voeg `\n- ` in (bullet voortzetten, zoals nu)
  - Leeg → start nieuwe bullet `\n- `
- Dit vervangt de noodzaak voor aparte `todoItem` en `numberedItem` commands (die blijven werken als expliciete override)

### 2B. Heading-niveau detectie
- Bij "kop" / "heading" (zonder nummer): check huidige sectie-niveau
  - Onder `## Sectie` → maak `### ` (één niveau dieper)
  - Begin document → maak `# `
  - Expliciete "kop twee" overrulet altijd

### 2C. Selectie-awareness
- Bij "wikilink" met geselecteerde tekst → wrap selectie in `[[selectie]]`
- Bij "bold"/"vet" met selectie → wrap in `**selectie**`
- Zonder selectie → open slot (zie Fase 3)

### 2D. Webapp synchroon houden
- Context-detectie logica delen/dupliceren in app.js

---

## Fase 3: Slots — Voice + Keyboard Hybride

### 3A. Slot-mechanisme bouwen (Obsidian plugin)
- Nieuw command-type `slot` in de command registry
- Een slot heeft: `prefix` (bijv. `[[`), `suffix` (bijv. `]]`), `exitTrigger` (Enter/Escape/voice "klaar")
- Bij activatie:
  1. Voeg prefix in op cursor-positie
  2. Pauzeer transcriptie (mic blijft optioneel aan, maar output wordt gebufferd)
  3. Gebruiker typt met toetsenbord
  4. Bij exit-trigger: voeg suffix in, hervat transcriptie
- Eerste slot-commands:
  - "wikilink" → `[[` ... `]]`
  - "tag" → `#` ... (exit bij spatie of Enter)
  - "vet" / "bold" → `**` ... `**`
  - "cursief" / "italic" → `*` ... `*`
  - "code" → `` ` `` ... `` ` ``

### 3B. Visuele feedback
- Statusbar toont "Slot actief: wikilink — typ en druk Enter"
- Optioneel: highlight de open prefix in de editor

### 3C. Webapp implementatie
- Vergelijkbaar mechanisme in app.js met textarea focus
- Visueel: indicator in de UI dat een slot open is

---

## Fase 4: User-Defined Commands

### 4A. Command Registry architectuur
- Nieuwe interface `VoiceCommandDefinition`:
  ```typescript
  interface VoiceCommandDefinition {
    id: string;
    triggers: Record<string, string[]>; // per taal
    type: 'insert' | 'slot';
    // Voor insert:
    insertText?: string;
    // Voor slot:
    prefix?: string;
    suffix?: string;
    exitTrigger?: 'enter' | 'space' | 'voice';
  }
  ```
- Built-in commands migreren naar deze interface
- User-defined commands laden uit plugin settings

### 4B. Settings UI voor custom commands
- Nieuw tabblad of sectie in settings-tab.ts
- Tabel met: Trigger (tekst), Type (insert/slot), Tekst/Prefix/Suffix
- Add/Edit/Delete knoppen
- Geen JSON editing nodig voor de gebruiker
- Voorbeeld-commands als inspiratie tonen

### 4C. "Dit was een commando" feedback-flow
- Wanneer tekst wordt ingevoegd die lijkt op een command (maar niet matched):
  - Optioneel: subtiele "Was dit een commando?" hint
- Alternatief: gebruiker selecteert tekst → rechtermuisklik/command → "Dit was een commando"
- Dropdown met bekende commands
- Slaat de mapping lokaal op als persoonlijke mishearing-correctie
- Optionele "Deel met developer" knop → genereert GitHub issue template

### 4D. Webapp custom commands
- Vergelijkbare UI in settings-modal
- Opslag in localStorage

---

## Fase 5: Template-integratie (Obsidian-specifiek)

### 5A. Template-commands uit Obsidian templates
- Scan de gebruiker's templates-folder (core Templates plugin of Templater)
- Registreer elk template automatisch als voice command: "template {naam}"
- Bij activatie: voeg template-inhoud in op cursor-positie
- Templater-variabelen ({{date}}, {{title}}) worden normaal verwerkt

### 5B. Ingebouwde quick-templates
- Een paar standaard-templates als built-in commands:
  - "tabel" → markdown tabel-scaffold
  - "codeblok" → ``` ... ``` met slot voor taal
  - "callout" → `> [!note]` met slot voor type

---

## Implementatievolgorde & Prioriteit

| # | Fase | Wat | Waarom eerst |
|---|------|-----|-------------|
| 1 | 1A+1B | Fonetische matching + prefix-strip | Fundament: alles wordt beter |
| 2 | 2A | Context-aware lijsten | Quick win, groot effect |
| 3 | 3A | Wikilink slot | De "hero feature" |
| 4 | 4A+4B | Custom command registry + UI | Extensibility |
| 5 | 2B+2C | Context-aware headings + selectie | Verfijning |
| 6 | 3A ext | Overige slots (bold, tag, code) | Uitbreiding slots |
| 7 | 4C | "Dit was een commando" feedback | Quality loop |
| 8 | 5A+5B | Templates | Obsidian-specifiek |
| 9 | 1C+2D+3C+4D | Webapp sync | Webapp bijwerken |

Elke fase is onafhankelijk deploybaar als nieuwe versie.

---

## Technische notities

- **Talisman bundle size**: library is modulair, alleen phonetics-modules importeren
- **Obsidian API**: `editor.getLine()`, `editor.getCursor()`, `editor.replaceRange()` voor context-detectie en slot-insertie
- **Geen breaking changes**: bestaande commands blijven exact werken, nieuwe matching is additief
- **Testen**: voor elke taal een set test-cases met bekende mishearings
