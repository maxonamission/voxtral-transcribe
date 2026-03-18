# Story 003: Advanced noise suppression with RNNoise WASM

**Epic:** Audio Quality
**Status:** Backlog
**Priority:** Medium
**Estimate:** Medium

## Summary

Browser-native `noiseSuppression` (story implemented inline) provides basic noise reduction, but is often insufficient for truly noisy environments (cafes, open offices, background music). RNNoise is a Mozilla-developed ML-based noise suppression library that can run client-side via WebAssembly with minimal latency (~2-3ms).

## Current state

- Browser-native constraints (`noiseSuppression`, `echoCancellation`, `autoGainControl`) are now available via the "Ruisonderdrukking" toggle in settings
- These are lightweight but limited — they won't fully suppress background chatter or music

## Proposed solution

Integrate [RNNoise](https://github.com/nickscha/rnnoise-wasm) or [rnnoise-wasm](https://github.com/nickscha/rnnoise-wasm) as an AudioWorklet processor:

1. Load RNNoise WASM module (~200KB)
2. Create an `AudioWorkletProcessor` that runs RNNoise on each audio frame
3. Insert the worklet between the mic source and the existing processing chain
4. Only activate when the noise suppression toggle is enabled
5. Gracefully degrade to browser-native if WASM fails to load

## Architecture

```
Mic → [RNNoise AudioWorklet] → ScriptProcessor (downsample + send)
                                    ↓
                              WebSocket → Server
```

## Acceptance criteria

- [ ] RNNoise WASM loads and processes audio in an AudioWorklet
- [ ] No perceptible additional latency (<5ms)
- [ ] Effectively suppresses background noise (cafe, music, chatter)
- [ ] Falls back to browser-native if WASM unavailable
- [ ] Toggle in settings controls activation
- [ ] Works in Chrome, Firefox, Safari (AudioWorklet support)

## Alternatives considered

- **Server-side noise reduction**: Adds latency, increases server load. Rejected.
- **Web Audio API AnalyserNode + custom filter**: Too basic for speech extraction. Rejected.
- **Krisp SDK**: Commercial, not open source. Rejected for now.

## References

- [RNNoise paper](https://arxiv.org/abs/1709.08243)
- [RNNoise WASM implementations](https://github.com/nickscha/rnnoise-wasm)
- [AudioWorklet spec](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)
