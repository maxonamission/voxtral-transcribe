╔══════════════════════════════════════════════════════════════╗
║              Voxtral Transcribe - macOS                      ║
║              Spraak-naar-tekst met Mistral AI                ║
╚══════════════════════════════════════════════════════════════╝

WAT IS VOXTRAL TRANSCRIBE?
═══════════════════════════
Voxtral Transcribe is een lokale spraak-naar-tekst applicatie die
de Mistral Voxtral API gebruikt voor realtime audiotranscriptie.

Kenmerken:
  • Realtime streaming transcriptie
  • Spraakcommando's voor documentstructuur (alinea's, kopjes, lijsten)
  • Automatische tekstcorrectie via Mistral Small
  • Offline wachtrij als de server niet bereikbaar is
  • Automatisch kopiëren naar klembord na opname
  • Donkere modus interface


STARTEN
═══════
1. Open een Terminal en navigeer naar de uitgepakte map:
     cd ~/Downloads/Voxtral\ Transcribe

2. Maak het bestand uitvoerbaar (eenmalig):
     chmod +x "Voxtral Transcribe"

3. Start de applicatie:
     ./"Voxtral Transcribe"

4. Je browser opent automatisch naar http://127.0.0.1:8000

Opmerking: macOS kan een beveiligingswaarschuwing tonen omdat de
app niet via de App Store is geïnstalleerd. Ga naar Systeem-
instellingen → Privacy en beveiliging → en klik op "Toch openen".


MISTRAL API-SLEUTEL VERKRIJGEN
══════════════════════════════
Je hebt een API-sleutel van Mistral nodig om Voxtral Transcribe
te gebruiken. Zo krijg je er een:

1. Ga naar https://console.mistral.ai/
2. Maak een account aan of log in
3. Ga naar "API Keys" in het menu
4. Klik op "Create new key"
5. Kopieer de sleutel en plak deze in het instellingenscherm
   van Voxtral Transcribe

Let op: er zijn kosten verbonden aan het gebruik van de Mistral
API. Bekijk de prijzen op https://mistral.ai/pricing/


CONFIGURATIE
════════════
Je kunt de API-sleutel op twee manieren instellen:

Via de app (aanbevolen):
  Klik op het tandwiel-icoon in de app en vul je sleutel in.

Via .env bestand:
  Hernoem ".env.example" naar ".env" en vul je sleutel in:
    MISTRAL_API_KEY=jouw_sleutel_hier


GEBRUIK
═══════
1. Klik op "Opnemen" om een opname te starten
2. Spreek in je microfoon - de tekst verschijnt realtime
3. Gebruik spraakcommando's:
   - "nieuwe alinea"     → nieuwe paragraaf
   - "nieuw kopje [tekst]" → voegt een kop toe
   - "nieuw lijstje"     → start een opsomming
   - "nieuwe taak"       → voegt een to-do item toe
4. Klik nogmaals op "Opnemen" om te stoppen
5. De tekst wordt automatisch naar je klembord gekopieerd


PROBLEMEN OPLOSSEN
══════════════════
• De app start niet?
  → Zorg dat er geen andere applicatie op poort 8000 draait
  → Probeer: lsof -i :8000  om te zien wat poort 8000 gebruikt

• "App kan niet worden geopend" melding?
  → Ga naar Systeeminstellingen → Privacy en beveiliging
  → Klik op "Toch openen" naast de Voxtral Transcribe melding

• Geen transcriptie?
  → Controleer je API-sleutel in de instellingen
  → Controleer of je microfoon correct is geselecteerd

• Microfoon werkt niet?
  → Geef je browser toestemming om de microfoon te gebruiken
  → Ga naar Systeeminstellingen → Privacy en beveiliging →
    Microfoon en zorg dat je browser toegang heeft


STOPPEN
═══════
Sluit het terminalvenster of druk op Ctrl+C in de terminal.


MEER INFORMATIE
═══════════════
Website: https://github.com/maxonamission/voxtral-transcribe
Licentie: MIT
