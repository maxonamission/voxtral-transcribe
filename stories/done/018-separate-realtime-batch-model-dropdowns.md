# Story 018: Separate realtime and batch models in settings dropdowns

**Epic:** Settings & Configuration
**Status:** Done
**Priority:** Medium
**Estimate:** Small

## Summary

The "Realtime model" and "Batch model" dropdowns in settings both showed the same unfiltered list of all models with `audio_transcription` capability. This made it possible to accidentally select a batch model for realtime streaming (which uses a WebSocket) or a realtime model for batch transcription (which uses the REST endpoint).

## Problem

The Mistral `/v1/models` API returns a single `audio_transcription` capability flag for both realtime-streaming and batch-REST transcription models. There is no separate capability to distinguish them. The only reliable differentiator is the model ID: realtime models contain `realtime` in their name (e.g. `voxtral-mini-transcribe-realtime-2602`), batch models do not.

## Solution

Filter by model ID convention:

- **Realtime dropdown:** any model where `id.includes("realtime")` (capability flag not required — the Mistral API may not set `audio_transcription` for realtime models)
- **Batch dropdown:** only models where `!id.includes("realtime")` AND `audio_transcription === true`

Both dropdowns retain the "(huidig)" fallback for a currently-configured model that doesn't appear in the filtered list.

## Changes

| File | Change |
|------|--------|
| `static/app.js` | Split `transcriptionModels` into `realtimeModels` and `batchModels` based on `id.includes("realtime")` |
| `obsidian-plugin/src/settings-tab.ts` | Replace single `isTranscriptionModel` filter with `isRealtimeModel` and `isBatchModel` |

## Acceptance criteria

- [x] Realtime dropdown only shows realtime-capable models
- [x] Batch dropdown only shows batch-capable models
- [x] A model configured before this change still appears with "(huidig)" suffix if it's not in the filtered list
- [x] Obsidian plugin compiles without errors
