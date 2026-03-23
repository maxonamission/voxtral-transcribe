# Story 013: Abstract WebSocket upgrade mechanism

**Epic:** Code Quality & Maintainability
**Target:** Obsidian plugin (`obsidian-plugin/`)
**Status:** Backlog
**Priority:** Medium
**Estimate:** Small

## Summary

The realtime transcription WebSocket in the Obsidian plugin requires a Bearer token in the HTTP upgrade request. Since browser-native `WebSocket` does not support custom headers, `obsidian-plugin/src/mistral-api.ts` contains ~100 lines of manual HTTP upgrade code using Node.js `https` and `crypto` modules. This is tightly coupled to Electron internals and fragile across Electron version updates.

## Current state

- `connectWebSocket()` in `mistral-api.ts` manually constructs an HTTP upgrade request with `Sec-WebSocket-Key`, parses the `101 Switching Protocols` response, and wraps the raw socket
- Uses `require('https')` and `require('crypto')` — only available in Electron/Node.js context
- Mobile (Capacitor) is already excluded from this path (uses batch mode), but the desktop path has no fallback if Electron changes its Node.js integration
- No unit tests for the upgrade handshake

## Proposed design

1. **Extract** `AuthenticatedWebSocket` class into `src/authenticated-websocket.ts`
2. **Encapsulate** the manual upgrade logic behind a clean interface:
   ```typescript
   class AuthenticatedWebSocket {
     constructor(url: string, token: string, options?: { timeout?: number });
     onopen: () => void;
     onmessage: (data: Buffer) => void;
     onclose: (code: number, reason: string) => void;
     onerror: (err: Error) => void;
     send(data: ArrayBuffer | Buffer): void;
     close(): void;
   }
   ```
3. **Add** a version check or feature detection for Node.js availability
4. **Document** why this manual approach is necessary (browser WebSocket limitation)

## Acceptance criteria

- [ ] WebSocket upgrade logic extracted into a self-contained module
- [ ] `RealtimeTranscriber` uses the new abstraction instead of inline socket code
- [ ] Manual upgrade rationale documented in code comments
- [ ] Existing realtime transcription works identically (manual test)

## Notes

- This is a pure extraction/encapsulation — no behaviour change. Low risk if done carefully.
- Future benefit: could add a proxy-based alternative for environments where Node.js `https` is unavailable.
