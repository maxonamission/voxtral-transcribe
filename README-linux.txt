╔══════════════════════════════════════════════════════════════╗
║              Voxtral Transcribe - Linux (x64)                ║
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
1. Pak het archief uit:
     tar -xzf VoxtralTranscribe-linux-x64.tar.gz

2. Navigeer naar de map:
     cd voxtral-transcribe

3. Maak het bestand uitvoerbaar (eenmalig):
     chmod +x voxtral-transcribe

4. Start de applicatie:
     ./voxtral-transcribe

5. Je browser opent automatisch naar http://127.0.0.1:8000

Tip: je kunt de app op de achtergrond starten met:
     ./voxtral-transcribe &


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

Via environment variable:
  export MISTRAL_API_KEY=jouw_sleutel_hier
  ./voxtral-transcribe


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
  → Controleer met: ss -tlnp | grep 8000

• Geen audio-invoer?
  → Controleer of PulseAudio of PipeWire draait
  → Controleer je microfoontoegang met: pactl list sources short

• Geen transcriptie?
  → Controleer je API-sleutel in de instellingen
  → Controleer of je microfoon correct is geselecteerd

• Microfoon werkt niet in browser?
  → Geef je browser toestemming om de microfoon te gebruiken
  → Sommige Wayland-compositors vereisen extra configuratie


STOPPEN
═══════
Druk op Ctrl+C in de terminal, of als de app op de achtergrond
draait:
  kill $(pgrep -f voxtral-transcribe)


MEER INFORMATIE
═══════════════
Website: https://github.com/maxonamission/voxtral-transcribe
Licentie: MIT
