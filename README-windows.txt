╔══════════════════════════════════════════════════════════════╗
║              Voxtral Transcribe - Windows                    ║
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
1. Dubbelklik op "Start Voxtral Transcribe.bat"
   - De applicatie start op de achtergrond
   - Je browser opent automatisch naar http://127.0.0.1:8000

   Of start VoxtralTranscribe.exe direct (de browser opent dan
   ook automatisch).

2. Bij eerste gebruik verschijnt een instellingenscherm waar je
   je Mistral API-sleutel moet invullen (zie hieronder).


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

• Geen transcriptie?
  → Controleer je API-sleutel in de instellingen
  → Controleer of je microfoon correct is geselecteerd

• Microfoon werkt niet?
  → Geef je browser toestemming om de microfoon te gebruiken
  → Selecteer de juiste microfoon in de instellingen

• Windows Firewall melding?
  → De app draait alleen lokaal (127.0.0.1), je kunt de
    firewall-melding veilig weigeren


STOPPEN
═══════
Klik met rechtermuisknop op het Voxtral Transcribe icoon in het
systeemvak (system tray, rechtsonder) en kies "Quit".


MEER INFORMATIE
═══════════════
Website: https://github.com/maxonamission/voxtral-transcribe
Licentie: MIT
