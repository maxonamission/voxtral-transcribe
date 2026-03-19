╔══════════════════════════════════════════════════════════════╗
║        Voxtral Transcribe - Raspberry Pi (ARM64)             ║
║        Spraak-naar-tekst met Mistral AI                      ║
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

Deze versie is gebouwd voor Raspberry Pi met een 64-bit OS
(aarch64/ARM64). Getest op Raspberry Pi 4 en 5.


VEREISTEN
═════════
  • Raspberry Pi 4 of 5 (64-bit OS vereist)
  • Raspberry Pi OS (64-bit) of Ubuntu Server 22.04+ (arm64)
  • USB-microfoon of audio-interface
  • Internetverbinding (voor de Mistral API)


STARTEN
═══════
1. Pak het archief uit:
     tar -xzf VoxtralTranscribe-linux-arm64-rpi.tar.gz

2. Navigeer naar de map:
     cd voxtral-transcribe

3. Maak het bestand uitvoerbaar (eenmalig):
     chmod +x voxtral-transcribe

4. Start de applicatie:
     ./voxtral-transcribe

5. Open een browser op de Pi of op een ander apparaat in je
   netwerk naar http://127.0.0.1:8000

Tip: Als je de Pi headless gebruikt (zonder scherm), kun je
vanaf een ander apparaat in hetzelfde netwerk verbinden.
Start dan met:
  VOXTRAL_HOST=0.0.0.0 ./voxtral-transcribe
En open http://<pi-ip-adres>:8000 in je browser.

Om de app als service te draaien bij het opstarten:
  Maak een systemd service bestand aan in
  /etc/systemd/system/voxtral.service


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
  → Zorg dat je een 64-bit OS draait: uname -m (moet "aarch64"
    tonen)
  → Zorg dat er geen andere applicatie op poort 8000 draait

• Geen audio-invoer?
  → Controleer of je USB-microfoon herkend wordt: arecord -l
  → Installeer ALSA-utils als dat nog niet gedaan is:
    sudo apt install alsa-utils

• Geen transcriptie?
  → Controleer je API-sleutel in de instellingen
  → Controleer je internetverbinding

• Slechte audiokwaliteit?
  → Gebruik een dedicated USB-microfoon in plaats van de
    ingebouwde audio-jack (betere kwaliteit)

• App is traag?
  → De Raspberry Pi doet alleen het versturen van audio en
    ontvangen van tekst - de zware verwerking gebeurt in de
    cloud. Trage prestaties duiden meestal op een trage
    internetverbinding.


STOPPEN
═══════
Druk op Ctrl+C in de terminal, of:
  kill $(pgrep -f voxtral-transcribe)


MEER INFORMATIE
═══════════════
Website: https://github.com/maxonamission/voxtral-transcribe
Licentie: MIT
