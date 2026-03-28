# Story 019: Webapp module splitting

**Epic:** Architecture
**Status:** Backlog
**Priority:** Low
**Estimate:** Medium
**Depends on:** Story 018 (done)

## Summary

The webapp `static/src/main.js` is still a single 2,134-line file. Now that shared imports have eliminated code duplication (Story 018), the remaining code is all webapp-specific DOM logic that could be organized into focused modules for maintainability.

This is purely a code organization improvement — no functional changes, no new features.

## Proposed split

```
static/src/
  ├── main.js              (~300 lines) — init, state, event binding, imports
  ├── voice-commands.js    (~250 lines) — checkForCommand, processCompletedSentences,
  │                                       executeCommand, DOM text insertion
  ├── recording.js         (~450 lines) — realtime, dual-delay, batch recording,
  │                                       WebSocket management, audio processing
  ├── transcript.js        (~200 lines) — insert point management, spacing,
  │                                       undo stack, click-to-cursor
  ├── transcript-queue.js  (~100 lines) — IndexedDB offline queue
  ├── settings-ui.js       (~200 lines) — settings modal, language selector
  ├── help-ui.js           (~120 lines) — help panel, keyboard shortcuts
  └── correction.js        (~100 lines) — manual/auto text correction
```

## Considerations

- All modules share global state (recording flags, DOM refs, active language). Either pass as parameters or use a shared state module.
- The current IIFE bundle format works — esbuild handles module imports at build time.
- No new dependencies needed.

## Acceptance criteria

- [ ] `src/main.js` is split into ≤8 focused modules
- [ ] Each module has a clear single responsibility
- [ ] esbuild still produces a working `app.js` bundle
- [ ] Manual testing confirms no regressions in recording, commands, correction
