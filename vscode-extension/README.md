# Voxtral Transcribe for VS Code

Speech-to-text dictation in VS Code using the [Mistral Voxtral](https://mistral.ai) API. Dictate directly into your editor with real-time streaming, voice commands, and automatic text correction.

## Features

- **Real-time transcription** — text appears in your editor as you speak
- **Batch transcription** — record first, transcribe after (higher accuracy)
- **Dual-delay streaming** — fast preview + accurate final text simultaneously
- **Voice commands** — new paragraph, headings, lists, to-do items, undo — all by voice
- **Auto-correct** — automatic spelling, punctuation, and capitalization correction via LLM
- **Hallucination filtering** — detects and discards false transcriptions
- **13 languages** — Arabic, Chinese, Dutch, English, French, German, Hindi, Italian, Japanese, Korean, Portuguese, Russian, Spanish
- **Tap-to-send** — in batch mode, send audio chunks without stopping the recording

## Requirements

- [Mistral API key](https://console.mistral.ai/api-keys) (Voxtral models)
- VS Code 1.85+

## Quick Start

1. Install the extension
2. Open Settings and search for `voxtral`
3. Enter your Mistral API key
4. Open a file and press `Ctrl+Shift+;` (`Cmd+Shift+;` on Mac) to start recording
5. Speak — text appears at your cursor position
6. Press the shortcut again to stop

## Commands

| Command | Description |
|---------|-------------|
| `Voxtral: Toggle Recording` | Start/stop recording (`Ctrl+Shift+;`) |
| `Voxtral: Start Recording` | Start recording |
| `Voxtral: Stop Recording` | Stop recording |
| `Voxtral: Send Audio Chunk` | Send current audio in batch mode (tap-to-send) |
| `Voxtral: Correct Selected Text` | Correct selected text via LLM |

## Voice Commands

| Command | Action |
|---------|--------|
| "new paragraph" | Double line break |
| "new line" | Single line break |
| "heading one/two/three" | Markdown heading H1-H3 |
| "new bullet" | List item (`- `) |
| "new to-do item" | Checkbox (`- [ ] `) |
| "delete last paragraph" | Remove last paragraph |
| "delete last line" | Remove last sentence |
| "undo" | Undo last action |
| "stop recording" | Stop recording |

Voice commands work as suffixes — keep talking and end with the command.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `voxtral.apiKey` | `""` | Mistral API key |
| `voxtral.language` | `nl` | Language for speech recognition |
| `voxtral.mode` | `realtime` | `realtime` or `batch` |
| `voxtral.autoCorrect` | `true` | Auto-correct transcribed text |
| `voxtral.dualDelay` | `false` | Dual-delay mode (fast + slow stream) |
| `voxtral.noiseSuppression` | `false` | Browser-level noise suppression |
| `voxtral.streamingDelayMs` | `480` | Streaming delay in ms |

## How It Works

The extension uses a hidden Webview panel for microphone access (VS Code extensions run in Node.js without Web Audio API). Audio is captured via `AudioWorklet` (realtime PCM) or `MediaRecorder` (batch WebM/Opus) and streamed to the Mistral Voxtral API for transcription. Transcribed text is inserted at your cursor position with context-aware formatting.

## License

GPL-3.0 — see [LICENSE](../LICENSE)
