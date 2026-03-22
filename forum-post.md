# Voxtral Transcribe — dictate directly into your notes with voice commands (beta testers wanted!)

I built **Voxtral Transcribe**, a speech-to-text plugin for Obsidian that lets you dictate directly into your markdown notes — including inserting headings, lists, to-dos, and more, all by voice.

I've been using it daily for a while now and it's been working well for me, so I wanted to share it with the community. The plugin is not yet available in the community plugins list (submission is pending review), but you can already install it manually or via BRAT.

## What it does

Instead of typing, you just talk — and your words appear in your note. On desktop, text streams in real-time as you speak. On mobile, you tap a send button to transcribe chunks while the recording keeps going.

But what makes it more than "just" transcription is that you can **control your document structure by voice**:

- Say **"heading two"** → inserts `## `
- Say **"bullet point"** → inserts `- `
- Say **"new todo"** → inserts `- [ ] `
- Say **"new paragraph"** → double line break
- Say **"numbered item"** → auto-incrementing numbered list
- Say **"delete last paragraph"** or **"undo"** to fix mistakes
- Say **"stop recording"** to end the session

After you stop, the plugin can **automatically correct** your text — fixing spelling, capitalization, and punctuation — without changing your writing style or markdown formatting.

## Key features

- **Real-time streaming** on desktop — text appears as you speak
- **Batch mode with tap-to-send** on desktop + mobile — send audio chunks mid-dictation without stopping
- **Voice commands** for headings (H1-H3), bullet points, to-dos, numbered lists, paragraphs, line breaks, delete, and undo
- **13 languages** — Dutch, English, French, German, Spanish, Portuguese, Italian, Russian, Chinese, Hindi, Arabic, Japanese, Korean. Voice commands automatically adapt to the selected language; English always works as fallback
- **Auto-correction** — spelling, capitalization, and punctuation are fixed automatically after recording
- **Inline correction instructions** — say "for the correction: change X to Y" and the corrector will follow your spoken instructions
- **Self-correction** — say "no, not X but Y" and it handles it automatically
- **Microphone selection** — choose which mic to use
- **Auto-pause on focus loss** — configurable behavior when switching apps on mobile (pause immediately, pause after delay, or keep recording)
- **Voice command help panel** — side panel showing all available commands for your active language

## How it works

The plugin uses [Mistral's Voxtral](https://mistral.ai/) models for speech recognition. You'll need a free Mistral API key from [console.mistral.ai](https://console.mistral.ai/) — there is a generous free tier.

- **Desktop**: real-time mode uses a WebSocket connection for live streaming; batch mode is also available
- **Mobile**: batch mode with tap-to-send (real-time streaming requires Node.js which isn't available on mobile)

## Installation

### Via BRAT (recommended for beta testing)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) from Community Plugins if you haven't already
2. Open BRAT settings → **Add Beta Plugin**
3. Enter: `maxonamission/obsidian-voxtral`
4. Enable the plugin in **Settings** → **Community Plugins**
5. Go to **Settings** → **Voxtral Transcribe** and enter your Mistral API key

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/maxonamission/obsidian-voxtral/releases/latest)
2. Create a folder `.obsidian/plugins/voxtral-transcribe/` in your vault
3. Copy the three files into that folder
4. Restart Obsidian, enable the plugin, and enter your API key

## Feedback welcome!

I'd love to hear how it works for you — especially:

- How well does it work in your language?
- Are the voice commands intuitive?
- How's the experience on mobile?
- Any bugs or rough edges you run into?

Feel free to open issues on [GitHub](https://github.com/maxonamission/obsidian-voxtral) or reply here. PRs are also welcome!

---

**GitHub**: [maxonamission/obsidian-voxtral](https://github.com/maxonamission/obsidian-voxtral)
**License**: GPL-3.0, free and open source
