# Project Status — Voxtral Transcribe

**Laatste update:** 2026-04-12

## Huidige staat: Werkende app (v20) + Obsidian Plugin (v0.8.10)

De app is volledig functioneel voor dagelijks gebruik. Alle kernfuncties werken betrouwbaar.

---

## Wat werkt

### Kern
- [x] Realtime streaming transcriptie via Mistral Voxtral API
- [x] Batch transcriptie (opnemen + versturen)
- [x] Sprekerherkenning (diarization) in batch modus
- [x] Auto-copy naar klembord na opname
- [x] Windows line ending normalisatie (`\r\n`)

### Stemcommando's
- [x] Structuur: nieuwe alinea, nieuwe regel
- [x] Koppen: kop 1/2/3
- [x] Lijsten: nieuw punt, nieuw to-do item
- [x] Bediening: beëindig opname, verwijder laatste alinea/regel, herstel (undo)
- [x] Suffix-matching (commando's werken ook als deel van een zin)
- [x] Unicode hyphen/dash normalisatie
- [x] Diacrieten-stripping
- [x] Voxtral mishearing correctie (`niveau` → `nieuwe`)

### Tekstcorrectie
- [x] Handmatige correctie via "Controleer" knop
- [x] Automatische correctie na opname (instelbaar)
- [x] Inline correctie-instructies ("voor de controle achteraf: ...")
- [x] Aangepaste systeemprompt voor jargon/vaktermen
- [x] Behoud van markdown opmaak bij correctie

### UI & UX
- [x] Dark mode (volledig)
- [x] Mid-text editing (klik om invoegpunt te verplaatsen)
- [x] Tekst selecteren en vervangen
- [x] Scroll volgt invoegpunt (35% van bovenkant)
- [x] Slim scrollen: auto-scroll pauzeert bij handmatig omhoog scrollen
- [x] Microfoon statuslampje (stabiel gemiddelde, geen flicker)
- [x] 50vh padding voor visuele ruimte onder tekst
- [x] Help panel met stemcommando-overzicht
- [x] Configureerbare sneltoets (standaard Ctrl+Space)
- [x] Streaming delay instelling (persistent)
- [x] Microfoon selectie (persistent)
- [x] Toast notificaties
- [x] Auto-reconnect bij verbindingsproblemen

### Beveiliging
- [x] Server luistert alleen op `127.0.0.1` (niet bereikbaar van buitenaf)
- [x] Rate limiting op API endpoints (sliding window, max 10/min)
- [x] Concurrent WebSocket limiet (max 2 gelijktijdige verbindingen)
- [x] API key niet in git (`.gitignore`)

### Obsidian Plugin
- [x] Realtime streaming transcriptie (desktop, via Node.js WebSocket)
- [x] Batch modus met tap-to-send (desktop + mobiel)
- [x] Stemcommando's (nieuwe alinea, koppen, lijsten, to-do, undo, etc.)
- [x] Automatische tekstcorrectie via Mistral Small
- [x] Inline correctie-instructies
- [x] Post-processing: strip LLM-commentaar dat niet in originele transcriptie stond
- [x] Zijpaneel met stemcommando-overzicht (desktop, niet automatisch op mobiel)
- [x] Send-knop in view header op mobiel (altijd zichtbaar boven toetsenbord)
- [x] Send-knop als ribbon icon op desktop
- [x] Microfoon selectie
- [x] Configureerbare instellingen (API key, taal, modellen, streaming delay, systeemprompt)

### Infra
- [x] PWA (installeerbaar, offline cache)
- [x] Offline queue (IndexedDB)
- [x] PyInstaller build scripts (Windows, macOS, RPi)
- [x] Start scripts (Windows, macOS/Linux)
- [x] Systemd service optie (RPi)
- [x] API key via UI of .env

---

## Bekende issues

### Scroll padding
- De 50vh padding werkt goed, maar bij window resize tijdens opname kan het scrollgedrag verstoord raken
- `scrollToInsertPoint()` met 35%/50% thresholds is een verbetering maar nog niet perfect in alle gevallen

### Commando false positives
- `endsWith`-matching kan false positives geven als je over commando's praat in context (bijv. "hallo nieuwe paragraaf" wordt als commando herkend)
- Mogelijke oplossing: minimum woordaantal check, of confidence scoring

### Inline correctie-instructies
- Werken gedeeltelijk — expliciete markers ("voor de correctie", "voor de controle achteraf") worden goed herkend
- Subtielere patronen (zelfcorrecties, gespelde woorden) worden niet altijd opgepakt door Mistral Small
- Afhankelijk van model-kwaliteit, niet altijd te verbeteren via prompt

---

## Te doen

### Prioriteit: GitHub & Build

- [x] **GitHub repo aanmaken** en code pushen
- [x] **Build testen** — PyInstaller windowed mode fix (sys.stdout/stderr None)
- [x] **`.gitignore` bijgewerkt** — `*.spec` verwijderd zodat spec files mee worden gecommit
- [x] **LICENSE bestand** toevoegen (GPL-3.0)

### Opschoning

- [x] **Debug logging** — omgezet naar `console.debug()`, standaard verborgen in browserconsole, zichtbaar via F12 → Verbose
- [ ] **Service worker cache versie** — sw.js cache versie synchroniseren met HTML cache bust versie, of een automatisch mechanisme

### Nice-to-have

- [ ] **Scroll bij window resize** — ResizeObserver toevoegen die `scrollToInsertPoint()` aanroept bij resize
- [ ] **Commando confidence** — false positives verminderen bij `endsWith` matching (bijv. minimum 2 woorden voor commando, of alleen matchen als het na een punt/pauze komt)
- [ ] **Export opties** — download als .md of .txt bestand
- [ ] **Meerdere transcripties** — tabs of sessies voor meerdere documenten
- [ ] **Woordenteller** — live woord-/tekentelling
- [ ] **Donker/licht thema toggle** — momenteel alleen dark mode
- [ ] **Sprekerherkenning in realtime** — nu alleen in batch modus

---

## Geparkeerde branches

### `claude/voxtral-code-review-LvDiN` (geparkeerd 2026-04-12)

Branch met 12 ongemergede commits, ver gedivergeerd van main. Bevat:
- **Webapp module splitting**: extractie van state.js, dom.js, correction.js, queue.js, audio.js, voice-commands uit monolithisch app.js
- **Shared language data convergentie**: webapp gebruikt nu dezelfde JSON-taalbestanden als de plugin
- **Esbuild voor webapp**: bundler toegevoegd, dubbele code vervangen door shared imports
- **Audio test infrastructure**: ElevenLabs TTS-script voor het genereren van testopnames, background noise mixing

**Status:** Werk is inhoudelijk waardevol maar de branch loopt ~90 commits achter op main (o.a. shared module extractie, VS Code extension, review bot fixes). Rebase vereist conflictresolutie. Beoordelen of het werk nog past bij de huidige architectuur voordat een merge wordt geprobeerd.

---

## Technische schuld

### `ScriptProcessorNode` is deprecated (niet actie-nodig)
`ScriptProcessorNode` is officieel deprecated ten gunste van `AudioWorklet`. In de praktijk wordt het nog door alle browsers ondersteund en zal dat voorlopig zo blijven. De app gebruikt het alleen voor simpele PCM-conversie en doorsturen — de performance-winst van `AudioWorklet` (aparte thread) is hier niet merkbaar. Mocht het ooit verwijderd worden uit browsers, dan is de migratie beperkt (~1 uur werk). **Besluit: niet migreren tenzij er een concrete aanleiding is.**

### Undo stack slaat volledige `innerHTML` op (niet actie-nodig)
De undo stack bewaart maximaal 20 snapshots van `transcript.innerHTML`. Voor typisch gebruik (een paar duizend woorden per sessie) is dit verwaarloosbaar qua geheugen (enkele honderden KB). Een diff-gebaseerd systeem zou complexer zijn voor nul merkbaar verschil. **Besluit: alleen heroverwegen als de app ooit wordt gebruikt voor zeer lange documenten (boek-lengte in één sessie).**

---

## Versiegeschiedenis

| Versie | Datum | Wijzigingen |
|---|---|---|
| v21 | 2026-03-08 | Obsidian plugin: realtime + batch, stemcommando's, correctie, mobiele send in view header, LLM-commentaar stripping |
| v20 | 2026-03-07 | Microfoon statuslampje, slim scrollen, PyInstaller windowed mode fix, start.bat verbeteringen |
| v18 | 2026-03-06 | Auto-reconnect, gebruiksvriendelijke foutmeldingen, rate limiting, WebSocket limiet |
| v17 | 2026-03-06 | Scroll padding fix (35%/50% thresholds) |
| v16 | 2026-03-05 | `scrollToInsertPoint()` vervangt `scrollToBottom()` |
| v15 | 2026-03-05 | Unicode hyphen fix, to-do items hersteld |
| v14 | 2026-03-05 | Dark scrollbar help panel |
| v13 | 2026-03-05 | Delay persistence, Windows line endings |
| v12 | 2026-03-05 | To-do greedy match fix, autocorrect debug |
| v10 | 2026-03-05 | Inline correctie-instructies, to-do commando |
| v7 | 2026-03-05 | `endsWith` matching, undo fix, WebSocket guard |
| v1 | 2026-03-04 | Initial release |
