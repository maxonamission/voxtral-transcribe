╔══════════════════════════════════════════════════════════════╗
║              Voxtral Transcribe - Windows                    ║
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
1. Double-click "Start Voxtral Transcribe.bat"
   - The application starts in the background
   - Your browser opens automatically to http://127.0.0.1:8000

   Or start VoxtralTranscribe.exe directly (the browser will
   also open automatically).

2. On first use a settings screen appears where you need to
   enter your Mistral API key (see below).


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

• No transcription?
  → Check your API key in the settings
  → Check that your microphone is correctly selected

• Microphone not working?
  → Give your browser permission to use the microphone
  → Select the correct microphone in the settings

• Windows Firewall prompt?
  → The app runs locally only (127.0.0.1), you can safely
    decline the firewall prompt


STOPPING
════════
Right-click the Voxtral Transcribe icon in the system tray
(bottom right) and choose "Quit".


MORE INFORMATION
════════════════
Website: https://github.com/maxonamission/voxtral-transcribe
License: GPL-3.0
