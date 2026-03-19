╔══════════════════════════════════════════════════════════════╗
║              Voxtral Transcribe - Linux (x64)                ║
║              Speech-to-text with Mistral AI                  ║
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


GETTING STARTED
═══════════════
1. Extract the archive:
     tar -xzf VoxtralTranscribe-linux-x64.tar.gz

2. Navigate to the folder:
     cd voxtral-transcribe

3. Make the file executable (one time only):
     chmod +x voxtral-transcribe

4. Start the application:
     ./voxtral-transcribe

5. Your browser opens automatically to http://127.0.0.1:8000

Tip: you can start the app in the background with:
     ./voxtral-transcribe &


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
  → Make sure no other application is using port 8000
  → Check with: ss -tlnp | grep 8000

• No audio input?
  → Check that PulseAudio or PipeWire is running
  → Check your microphone access with: pactl list sources short

• No transcription?
  → Check your API key in the settings
  → Check that your microphone is correctly selected

• Microphone not working in browser?
  → Give your browser permission to use the microphone
  → Some Wayland compositors require extra configuration


STOPPING
════════
Press Ctrl+C in the terminal, or if the app is running in
the background:
  kill $(pgrep -f voxtral-transcribe)


MORE INFORMATION
════════════════
Website: https://github.com/maxonamission/voxtral-transcribe
License: GPL-3.0
