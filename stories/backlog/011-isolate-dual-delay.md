# Story 011: Isolate and document dual-delay mode

**Epic:** Code Quality & Maintainability
**Target:** Obsidian plugin (`obsidian-plugin/`)
**Status:** Backlog
**Priority:** High
**Estimate:** Medium

## Summary

The dual-delay mode runs two parallel WebSocket streams (fast for immediate display, slow for accurate voice command detection) with reconciliation logic. This is the most complex feature in the plugin and currently lives entirely inline in `obsidian-plugin/src/main.ts` without clear abstraction or documentation of the reconciliation algorithm.

## Current state

- `startDualDelayRecording()` and related methods are embedded in the main plugin class
- Fast and slow streams share mutable state (text buffers, slot tracking, pending text)
- The reconciliation logic — deciding when to replace fast output with slow output — is implicit in the code flow
- No documentation explains the algorithm, timing assumptions or edge cases
- If this breaks, debugging requires understanding ~400 lines of interleaved async state

## Proposed design

1. **Extract** `DualDelaySession` class into `src/dual-delay-session.ts`
2. **Document** the reconciliation algorithm with an ASCII diagram and inline comments:
   - When does slow output replace fast output?
   - How are voice commands detected in the slow stream but applied to the fast stream's text?
   - What happens when streams drift apart?
3. **Define** a clear state machine with named states (e.g. `idle`, `fast-only`, `reconciling`, `slow-confirmed`)
4. **Emit events** rather than directly manipulating editor state — let the orchestrator handle insertion

## Acceptance criteria

- [ ] Dual-delay logic lives in its own module with no direct Obsidian editor manipulation
- [ ] Algorithm is documented with a diagram showing fast/slow stream interaction
- [ ] State transitions are explicit and logged at debug level
- [ ] Edge cases documented: what if slow stream disconnects? What if fast stream is ahead by N segments?
- [ ] Existing dual-delay behaviour unchanged (manual test with both streams active)

## Dependencies

- Ideally done after or as part of story 010 (split main.ts), but can be done standalone by extracting just this subsystem.

## References

- `src/main.ts` — `startDualDelayRecording()` and related methods
- `src/mistral-api.ts` — `RealtimeTranscriber` class (WebSocket management)
