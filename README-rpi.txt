╔══════════════════════════════════════════════════════════════╗
║        Voxtral Transcribe - Raspberry Pi (ARM64)             ║
║        Speech-to-text with Mistral AI                        ║
╚══════════════════════════════════════════════════════════════╝

WHAT IS VOXTRAL TRANSCRIBE?
════════════════════════════
Voxtral Transcribe is a local speech-to-text application that
uses the Mistral Voxtral API for real-time audio transcription.

Features:
  • Real-time streaming transcription
  • Voice commands for document structure (paragraphs, headings, lists)
  • Automatic text correction via Mistral Small
  • Offline queue when the server is unreachable
  • Auto-copy to clipboard after recording
  • Dark mode interface

This version is built for Raspberry Pi with a 64-bit OS
(aarch64/ARM64). Tested on Raspberry Pi 4 and 5.


REQUIREMENTS
════════════
  • Raspberry Pi 4 or 5 (64-bit OS required)
  • Raspberry Pi OS (64-bit) or Ubuntu Server 22.04+ (arm64)
  • USB microphone or audio interface
  • Internet connection (for the Mistral API)


GETTING STARTED
═══════════════
1. Extract the archive:
     tar -xzf VoxtralTranscribe-linux-arm64-rpi.tar.gz

2. Navigate to the folder:
     cd voxtral-transcribe

3. Make the file executable (one time only):
     chmod +x voxtral-transcribe

4. Start the application:
     ./voxtral-transcribe

5. Open a browser on the Pi or on another device on your
   network at http://127.0.0.1:8000

Tip: If you're using the Pi headless (without a monitor), you
can connect from another device on the same network.
Start with:
  VOXTRAL_HOST=0.0.0.0 ./voxtral-transcribe
And open http://<pi-ip-address>:8000 in your browser.

To run the app as a service on startup:
  Create a systemd service file in
  /etc/systemd/system/voxtral.service


OBTAINING A MISTRAL API KEY
═══════════════════════════
You need a Mistral API key to use Voxtral Transcribe.
Here's how to get one:

1. Go to https://console.mistral.ai/
2. Create an account or log in
3. Go to "API Keys" in the menu
4. Click "Create new key"
5. Copy the key and paste it into the Voxtral Transcribe
   settings screen

Note: there are costs associated with using the Mistral API.
See pricing at https://mistral.ai/pricing/


CONFIGURATION
═════════════
You can set the API key in two ways:

Via the app (recommended):
  Click the gear icon in the app and enter your key.

Via .env file:
  Rename ".env.example" to ".env" and enter your key:
    MISTRAL_API_KEY=your_key_here

Via environment variable:
  export MISTRAL_API_KEY=your_key_here
  ./voxtral-transcribe


USAGE
═════
1. Click "Record" to start a recording
2. Speak into your microphone - text appears in real time
3. Use voice commands:
   - "new paragraph"      → new paragraph
   - "heading one"        → adds a heading
   - "new bullet"         → starts a bullet list
   - "new to-do"          → adds a to-do item
4. Click "Record" again to stop
5. The text is automatically copied to your clipboard


TROUBLESHOOTING
═══════════════
• The app won't start?
  → Make sure you're running a 64-bit OS: uname -m (should
    show "aarch64")
  → Make sure no other application is using port 8000

• No audio input?
  → Check that your USB microphone is recognized: arecord -l
  → Install ALSA utils if not already done:
    sudo apt install alsa-utils

• No transcription?
  → Check your API key in the settings
  → Check your internet connection

• Poor audio quality?
  → Use a dedicated USB microphone instead of the built-in
    audio jack (better quality)

• App is slow?
  → The Raspberry Pi only sends audio and receives text -
    the heavy processing happens in the cloud. Slow
    performance usually indicates a slow internet connection.


STOPPING
════════
Press Ctrl+C in the terminal, or:
  kill $(pgrep -f voxtral-transcribe)


MORE INFORMATION
════════════════
Website: https://github.com/maxonamission/voxtral-transcribe
License: GPL-3.0
