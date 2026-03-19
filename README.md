# Voxtral Transcribe

Local speech-to-text application with real-time streaming via the [Mistral](https://mistral.ai) Voxtral API. Dictate text with voice commands for structure, automatic correction, and copy the result to your clipboard.

## Features

- **Real-time transcription** — text appears as you speak, with configurable streaming delay
- **Voice commands** — new paragraph, headings, lists, to-do items, clear and undo, all by voice
- **Text correction** — automatic or manual correction via Mistral Small (spelling, punctuation, capitalization)
- **Inline correction instructions** — give the corrector instructions mid-dictation ("for the correction: change X to Y")
- **Mid-text editing** — click anywhere in the text to insert there, or select text to replace it
- **Auto-copy** — after each recording the text is automatically copied to the clipboard
- **Offline queue** — recordings are saved locally when the server is unreachable
- **PWA** — installable as a standalone app
- **Auto-reconnect** — automatically reconnects on connection issues
- **Speaker recognition** — optional diarization in batch mode
- **Microphone status** — status indicator with stable assessment of your microphone level
- **Smart scrolling** — scroll up to review while dictating, auto-scroll resumes when you scroll back down

Need coffee to process all this? Me too.

<a href="https://buymeacoffee.com/maxonamission" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="50"></a>

## Requirements

- Python 3.10+
- [Mistral API key](https://console.mistral.ai/api-keys)

## Installation

```bash
git clone https://github.com/maxonamission/voxtral-transcribe.git
cd voxtral-transcribe
```

### Windows

Double-click `start.bat` — this automatically creates a virtual environment, installs dependencies, and starts the server.

### macOS / Linux

```bash
chmod +x start.sh
./start.sh
```

### Manual

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python server.py
```

Then open [http://127.0.0.1:8000](http://127.0.0.1:8000) in your browser. On first use you will be asked for your Mistral API key.

## Voice Commands

| Command | Action |
|---|---|
| "new paragraph" | Double line break |
| "new line" | Single line break |
| "heading one" / "heading two" / "heading three" | Markdown heading H1–H3 |
| "new bullet" | List item (`- `) |
| "new to-do item" | To-do checkbox (`- [ ] `) |
| "delete last paragraph" | Removes the last paragraph |
| "delete last line" | Removes the last sentence |
| "undo" | Undo |
| "stop recording" | Stops the recording |

Commands are recognized as a suffix — you can keep talking and end with the command (e.g. "and then new paragraph").

## Build (standalone executable)

### Windows

```bash
build.bat
```

### macOS

```bash
chmod +x build-mac.sh
./build-mac.sh
```

### Raspberry Pi / Linux

```bash
chmod +x build-rpi.sh
./build-rpi.sh
```

The build uses PyInstaller and creates a standalone executable in `dist/`. The RPi build can optionally install a systemd service for autostart.

## Configuration

The API key can be set in two ways:

1. **Via the app** — click the gear icon and paste your key (saved in `config.json`)
2. **Via environment** — create a `.env` file with `MISTRAL_API_KEY=...`

### Settings (via gear icon)

| Setting | Description |
|---|---|
| Streaming delay | Delay for more accurate transcription (240–2400ms) |
| Auto-correct | Automatically correct text after each recording |
| System prompt | Extra instructions for the corrector (jargon, terminology) |
| Microphone | Select the desired microphone |
| Hotkey | Configurable recording hotkey (default: Ctrl+Space) |

## Obsidian Plugin

Voxtral Transcribe is also available as an **Obsidian plugin** — dictate directly into your Obsidian notes.

### Features

- **Real-time streaming** on desktop (Windows, macOS, Linux)
- **Batch mode with tap-to-send** on mobile (Android, iOS) — send audio chunks while you keep talking
- **Voice commands** — new paragraph, headings, lists, to-do items, undo
- **Automatic text correction** — spelling, punctuation, capitalization via Mistral Small
- **Inline correction instructions** — give the corrector instructions mid-dictation
- **Side panel** with voice command overview (desktop)

### Installation

See [`obsidian-plugin/INSTALL.md`](obsidian-plugin/INSTALL.md) for full installation instructions.

Quick start:
```bash
cd obsidian-plugin
npm install && npm run build
```
Copy `main.js`, `manifest.json` and `styles.css` to `.obsidian/plugins/voxtral-transcribe/` in your vault.

### Mobile

On mobile (Android/iOS) batch mode is used automatically. A **send button** appears in the view header when you start a recording, so you can send chunks without stopping. The voice command side panel does not open automatically on mobile to avoid blocking the screen.

## Project Structure

```
voxtral-transcribe/
├── server.py              # FastAPI backend
├── requirements.txt       # Python dependencies
├── .env.example           # Example environment
├── start.bat / start.sh   # Start scripts
├── build.bat              # Windows build
├── build-mac.sh           # macOS build
├── build-rpi.sh           # RPi/Linux build
├── static/
│   ├── index.html         # Frontend UI
│   ├── app.js             # Frontend logic
│   ├── style.css          # Styling (dark mode)
│   ├── sw.js              # Service worker
│   ├── manifest.json      # PWA manifest
│   └── icon-*.svg         # App icons
├── obsidian-plugin/       # Obsidian plugin
│   ├── src/               # TypeScript source files
│   ├── main.js            # Built plugin
│   ├── manifest.json      # Obsidian plugin manifest
│   ├── styles.css         # Plugin styling
│   └── INSTALL.md         # Installation instructions
├── TECHNICAL.md           # Technical documentation
└── STATUS.md              # Project status & roadmap
```

## License

[GPL-3.0](LICENSE) — Copyright (c) 2026 Max Kloosterman
