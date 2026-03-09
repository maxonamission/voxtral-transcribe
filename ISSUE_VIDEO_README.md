# README: introducievideo toevoegen voor nieuwe gebruikers

## Doel

Een korte introducievideo opnemen die nieuwe gebruikers een soepele start geeft. De video wordt embedded in de README.

## Waarom

De tool zit intuïtief in elkaar, maar heeft genoeg features en concepten die baat hebben bij een visuele uitleg — vooral voor gebruikers die minder technisch zijn of het voor het eerst zien.

## Suggestie voor inhoud

### 1. Opstarten & API key instellen (~1 min)
- `start.bat` / `start.sh` dubbelklikken → browser opent
- Tandwiel-icoon → API key plakken (+ link naar Mistral console)
- Eventueel microfoon selecteren

### 2. Basis dictatie (~1–2 min)
- Opname starten met de knop of `Ctrl+Space`
- Laten zien dat tekst real-time verschijnt tijdens het spreken
- Opname stoppen → tekst blijft staan
- Kort benoemen dat de streaming delay instelbaar is (sneller vs nauwkeuriger)

### 3. Spraakcommando's — de belangrijkste (~1–2 min)
- "nieuwe alinea" en "nieuwe regel" — structuur aanbrengen
- "kop één/twee/drie" — kopjes maken
- "nieuw punt" — opsommingen
- "beëindig opname" — hands-free stoppen
- Tip: commando's zijn gewoon Nederlands aan het einde van je zin, geen speciale syntax nodig

### 4. Tekst corrigeren (~1 min)
- "Controleer" knop klikken → tekst wordt opgeschoond
- Automatische correctie aanzetten in instellingen
- Inline instructies: "voor de controle achteraf: schrijf dit als opsomming" — krachtige feature die makkelijk over het hoofd wordt gezien

### 5. Tekst bewerken en aanvullen (~30s)
- Klikken in bestaande tekst → cursor verplaatst, nieuwe dictatie gaat daar verder
- Tekst selecteren → dictatie vervangt de selectie

### 6. Bonus / nice-to-knows (~30s)
- Dark mode staat standaard aan
- Werkt offline (opnames worden bewaard en verstuurd zodra de server weer bereikbaar is)
- Installeerbaar als app (PWA)
- Er is ook een Obsidian-plugin

## Technische notities
- Ideale lengte: 3–5 minuten
- Taal: Nederlands (eventueel met ondertiteling)
- Formaat: embedded in README via een gif/mp4 of YouTube/Loom link
- Overweeg een aparte sectie "Snelstart" boven de huidige installatie-instructies

## Niet vergeten
- [ ] Video opnemen
- [ ] Video hosten (YouTube unlisted, of als asset in de repo als het klein genoeg is)
- [ ] README updaten met embed
- [ ] Eventueel een "Snelstart" sectie toevoegen die naar de video verwijst
