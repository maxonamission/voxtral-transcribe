# Handmatige testinstructies — refactoring validatie

**Datum:** 2026-03-29
**Branch:** `claude/voxtral-code-review-LvDiN`
**Doel:** Valideren dat alle functionele wijzigingen uit deze sessie correct werken in de praktijk.

---

## Overzicht te testen wijzigingen

| # | Wijziging | Betreft | Risico |
|---|-----------|---------|--------|
| 1 | Context-aware formatting (casing + punt) | Plugin + Webapp | Medium |
| 2 | Autocorrect bewaart custom command output | Plugin | Laag |
| 3 | Dual-delay als experimental | Plugin | Laag |
| 4 | Webapp command matching via shared module | Webapp | Medium |
| 5 | Webapp taaldata uit JSON (13 talen) | Webapp | Laag |

---

## Test 1: Context-aware formatting

**Wat is gewijzigd:** Tekst die je inspreekt wordt nu automatisch aangepast aan de context van de cursor:
- Midden in een zin → eerste letter klein, trailing punt gestript
- Na een afgeronde zin (`.!?`) → eerste letter groot, punt behouden
- Na een lijstitem (`- `, `* `, `1. `) of heading (`# `) → eerste letter groot, punt gestript
- Na een comment/blockquote (`> `, `>> `) → eerste letter groot, punt behouden

### Test 1a: Mid-sentence insertie (Plugin)
1. Open een notitie en typ: `Dit is een test`
2. Plaats de cursor na `een` (midden in de zin)
3. Start opname en spreek een kort stuk in, bijv. "belangrijk"
4. Stop opname
5. **Verwacht:** `Dit is een belangrijk test` — kleine letter 'b', geen punt na "belangrijk"

### Test 1b: Na afgeronde zin (Plugin)
1. In dezelfde notitie, plaats cursor na `test.` (na de punt)
2. Start opname en spreek: "Dit is de volgende zin"
3. Stop opname
4. **Verwacht:** `Dit is de volgende zin.` — hoofdletter 'D', punt behouden

### Test 1c: Na lijstitem marker (Plugin)
1. Spreek het commando "nieuw punt" (of typ `- `)
2. Spreek daarna: "Een item voor de lijst"
3. **Verwacht:** `- Een item voor de lijst` — hoofdletter, GEEN punt aan het einde

### Test 1d: Na heading marker (Plugin)
1. Spreek "kop een" (of typ `# `)
2. Spreek daarna: "Mijn titel"
3. **Verwacht:** `# Mijn titel` — hoofdletter, GEEN punt

### Test 1e: Na blockquote/comment (Plugin)
1. Gebruik het custom command voor review comments (`>>`) of typ `> `
2. Spreek: "Dit is een opmerking"
3. **Verwacht:** `>> Dit is een opmerking.` — hoofdletter, punt WEL behouden

### Test 1f: Context-aware formatting (Webapp)
1. Herhaal tests 1a t/m 1d in de webapp
2. De webapp heeft geen custom commands, maar `> ` blockquotes kunnen handmatig getypt worden

---

## Test 2: Autocorrect bewaart custom command output

**Wat is gewijzigd:** De correctie-LLM krijgt nu expliciet instructie om custom command markers (zoals `>>`) te bewaren.

### Test 2a: Review comment prefix bewaard (Plugin)
1. Zorg dat autocorrect aan staat (Settings → Auto-correct)
2. Definieer een custom command met `insertText: ">> "` (als dat nog niet bestaat)
3. Gebruik het review comment commando
4. Spreek een zin in na het `>>` prefix
5. Stop opname (autocorrect draait automatisch)
6. **Verwacht:** Het `>>` prefix is bewaard gebleven, niet weggehaald door de LLM

### Test 2b: Andere custom command markers (Plugin)
1. Test met andere custom commands die speciale tekens invoegen (bijv. callout `> [!note]`)
2. Stop opname met autocorrect aan
3. **Verwacht:** De markers zijn intact

### Test 2c: Reguliere correctie werkt nog (Plugin)
1. Spreek een zin in met een duidelijke spelfout of verkeerde hoofdletter
2. Stop opname
3. **Verwacht:** De fout is gecorrigeerd, maar de zinsstructuur is ongewijzigd

---

## Test 3: Dual-delay als experimental

**Wat is gewijzigd:** Het label in de settings is nu "Dual-delay mode (experimental)" met een waarschuwing over 2x API bandwidth.

### Test 3a: Settings label (Plugin)
1. Open Settings → Voxtral Transcribe
2. Zoek de dual-delay toggle
3. **Verwacht:** Label is "Dual-delay mode (experimental)" met beschrijving die "2x API bandwidth" en "may produce unexpected results" vermeldt

### Test 3b: Default uit (Plugin)
1. Installeer de plugin op een nieuw vault (of reset settings)
2. **Verwacht:** Dual-delay staat standaard UIT

---

## Test 4: Webapp command matching via shared module

**Wat is gewijzigd:** De webapp gebruikt nu hetzelfde 5-pass matching algoritme als de plugin (via `findMatch()` uit shared). De normalisatie is iets anders: de shared versie converteert hyphens naar spaties, de oude webapp-versie verwijderde ze.

### Test 4a: Basiscommando's (Webapp)
1. Open de webapp, start opname
2. Spreek: "Nieuwe alinea"
3. **Verwacht:** Nieuwe alinea wordt ingevoegd (dubbele regelbreak)

### Test 4b: Stop opname (Webapp)
1. Spreek: "Stop opname"
2. **Verwacht:** Opname stopt

### Test 4c: Commando met tekst ervoor (Webapp)
1. Spreek: "Dit is wat tekst nieuwe alinea"
2. **Verwacht:** "Dit is wat tekst" wordt ingevoegd, gevolgd door een nieuwe alinea

### Test 4d: Compound commando (Webapp)
1. Spreek: "Stopopname" (zonder spatie)
2. **Verwacht:** Opname stopt (compound word splitting zou dit moeten vangen)

### Test 4e: Filler words (Webapp)
1. Spreek: "Nieuwe alinea alsjeblieft"
2. **Verwacht:** Nieuwe alinea wordt ingevoegd, "alsjeblieft" genegeerd

### Test 4f: Meerdere talen (Webapp)
1. Wissel taal naar Engels in settings
2. Spreek: "New paragraph"
3. **Verwacht:** Nieuwe alinea wordt ingevoegd
4. Wissel naar Frans, spreek: "Nouveau paragraphe"
5. **Verwacht:** Nieuwe alinea wordt ingevoegd

---

## Test 5: Webapp taaldata uit JSON

**Wat is gewijzigd:** De webapp laadt nu alle 13 talen uit dezelfde JSON-bestanden als de plugin. Voorheen had de webapp maar 7 talen.

### Test 5a: Nieuwe talen beschikbaar (Webapp)
1. Open webapp settings
2. **Verwacht:** Alle 13 talen zijn zichtbaar in de taalkeuze: NL, EN, FR, DE, ES, PT, IT, RU, ZH, HI, AR, JA, KO

### Test 5b: Russisch commando (Webapp — indien Russisch gesproken wordt)
1. Wissel naar Russisch
2. Spreek: "Новый абзац" (novyj abzats)
3. **Verwacht:** Nieuwe alinea wordt ingevoegd

### Test 5c: Help panel toont correcte patronen (Webapp)
1. Open het help panel
2. Wissel tussen talen
3. **Verwacht:** De getoonde commando's en trigger phrases corresponderen met de actieve taal

---

## Regressietests

Naast bovenstaande wijzigingen, controleer dat de basis nog werkt:

### Batch mode (Plugin + Webapp)
- [ ] Opname starten/stoppen werkt
- [ ] Tekst verschijnt in editor/transcript
- [ ] Voice commands worden herkend in getranscribeerde tekst

### Realtime mode (Plugin + Webapp)
- [ ] Streaming opname werkt (tekst verschijnt real-time)
- [ ] Voice commands worden herkend tijdens streaming
- [ ] Opname stopt correct (handmatig + via stemcommando)

### Plugin-specifiek
- [ ] Auto-correct na opname werkt (indien ingeschakeld)
- [ ] Undo commando ("herstel") werkt
- [ ] Heading, bullet, todo commando's voegen correcte markdown in
- [ ] Custom commands werken (indien geconfigureerd)
- [ ] Help panel toont alle commando's

---

## Rapportage

Noteer per test:
- **PASS** / **FAIL** / **SKIP** (niet testbaar)
- Bij FAIL: wat je verwachtte vs. wat er gebeurde
- Screenshots of opnames bij onverwacht gedrag
