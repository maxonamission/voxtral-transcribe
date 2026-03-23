# Story 016: Privacy documentation and log redaction

**Epic:** Code Quality & Maintainability
**Target:** Obsidian plugin (`obsidian-plugin/`)
**Status:** Backlog
**Priority:** Medium
**Estimate:** Small

## Summary

The Obsidian plugin handles sensitive data: spoken audio, transcribed text, and a user-provided API key. While the current implementation is reasonably careful (API keys are not logged, `sanitizeApiError` strips raw responses), there is no explicit documentation for users about what data goes where, and the log export feature could inadvertently include transcribed text fragments from error paths.

## Current state

- API key stored in Obsidian's `data.json` (plugin data), masked as password field in UI
- Audio sent to Mistral API over HTTPS/WSS, not persisted to disk
- In-memory ring buffer (500 entries) exportable to clipboard via command
- `sanitizeApiError()` strips raw API response bodies
- Hallucination detection logs may contain transcribed text snippets at debug level
- No user-facing privacy documentation in the plugin or README

## Proposed changes

### 1. User-facing privacy notice

Add a concise privacy section to the plugin's README and/or help panel (`help-view.ts`):

- Where audio is sent (Mistral API endpoint)
- What is stored locally (settings including API key in `data.json`, nothing else persisted)
- What the log export contains and does NOT contain
- That no audio or text is stored on disk beyond the active session

### 2. Log redaction

- Add a `redactForExport()` function that strips potential transcription fragments from log entries before clipboard export
- Ensure hallucination detection logs are tagged so they can be filtered
- Add explicit log levels: `debug` (includes text), `info` (no text), `error` (sanitized)

### 3. API key storage note

Add a brief note in the settings tab near the API key input:

> "Your API key is stored in Obsidian's plugin data folder. It is not encrypted. Do not share your `data.json` file."

## Acceptance criteria

- [ ] README contains a "Privacy" section explaining data flow
- [ ] Help panel includes a brief privacy note
- [ ] Log export strips transcribed text fragments
- [ ] Settings tab shows API key storage disclaimer
- [ ] No API key, audio data or full transcription text appears in exported logs

## Notes

- The webapp (`server.py` + `static/`) has its own privacy characteristics (server-side processing, potential disk logging). A separate story should address webapp privacy if needed — this story is strictly about the Obsidian plugin.
