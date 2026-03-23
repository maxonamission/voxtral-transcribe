# Story 010: Split main.ts into focused modules

**Epic:** Code Quality & Maintainability
**Target:** Obsidian plugin (`obsidian-plugin/`)
**Status:** Backlog
**Priority:** High
**Estimate:** Large

## Summary

`obsidian-plugin/src/main.ts` is 1,740 lines and carries nearly all responsibilities: plugin lifecycle, recording control, realtime/batch/dual-delay flows, editor integration, UI state, focus handling, typing mute, logging, templates and voice command dispatch. This "god object" pattern makes the code hard to review, test, blame and refactor.

## Current state

All plugin logic lives in a single `VoxtralPlugin` class in `src/main.ts`. Other modules (`mistral-api.ts`, `audio-recorder.ts`, `voice-commands.ts`, etc.) are already well-separated, but main.ts consumes them all and contains significant business logic inline.

## Proposed design

Extract the following concerns into dedicated modules:

| New module | Responsibility | Approx. lines |
|------------|----------------|---------------|
| `recording-controller.ts` | `startRecording()`, `stopRecording()`, `toggleRecording()`, `sendChunk()`, pause/resume, state machine | ~300 |
| `realtime-session.ts` | `startRealtimeRecording()`, `connectRealtimeWebSocket()`, chunk handling, reconnect logic | ~250 |
| `dual-delay-session.ts` | `startDualDelayRecording()`, fast/slow stream reconciliation, buffer management | ~200 |
| `editor-integration.ts` | Text insertion, cursor management, slot handling, `dictatedRanges` tracking | ~200 |
| `ui-state.ts` | Status bar, ribbon icon, notices, recording indicator | ~100 |
| `focus-handler.ts` | `handleVisibilityChange()`, focus loss behaviour, typing mute cooldown | ~100 |
| `plugin-logger.ts` | Ring buffer, log levels, `exportLogs()` | ~80 |

`main.ts` becomes a thin orchestrator (~200 lines) that wires these modules together in `onload()` / `onunload()`.

## Constraints

- Each module should be independently testable (no direct Obsidian API calls where avoidable; pass dependencies via constructor or factory).
- Existing public API surface (commands, settings keys) must not change.
- The bundled `main.js` output stays a single file (esbuild handles this).

## Acceptance criteria

- [ ] `main.ts` is under 300 lines
- [ ] Each extracted module has a single, clearly defined responsibility
- [ ] No circular dependencies between modules
- [ ] Plugin behaviour is identical before and after (manual smoke test)
- [ ] All existing commands and settings still work
- [ ] `npm run build` succeeds without errors or new warnings

## Risks

- This is a large refactor that touches almost every code path. Must be done on a dedicated branch with careful before/after testing.
- Other in-flight stories should be merged or rebased before starting this work.

## Notes

This story is a prerequisite for stories 011, 012, 013 and 014 — those stories become much easier once main.ts is modular.
