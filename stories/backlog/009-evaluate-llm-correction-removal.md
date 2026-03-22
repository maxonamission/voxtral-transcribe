# Story 009: Evaluate and potentially remove LLM text correction

**Epic:** Pipeline Simplification
**Status:** Backlog
**Priority:** Medium
**Estimate:** Small

## Summary

The `correctText()` function uses Mistral Small to clean up transcribed text (capitalisation, punctuation, speech recognition errors). This is a quality layer on top of Voxtral STT, not a functional requirement. Evaluate whether it can be removed to simplify the pipeline, reduce latency, and lower costs.

## Acceptance criteria

- [ ] Test the app/plugin with `autoCorrect: false` and evaluate output quality
- [ ] Document findings: is Voxtral STT output sufficient for daily use without post-processing?
- [ ] Decide: keep, keep-optional (current), or remove?
- [ ] If removing: hide `autoCorrect` toggle and `correctModel` field in settings tab (code stays intact but unreachable)
- [ ] Optional: remove ~360 lines of correction code if feature is permanently dropped

## What disappears

| Function | Location |
|----------|----------|
| Auto-correct after batch transcription | `main.ts:566-567`, `app.js:1700-1706` |
| Auto-correct on stop (realtime/dual) | `main.ts:741-742`, `main.ts:1058-1059` |
| Manual correction command | `main.ts:1260-1295` |
| `correctText()` | `mistral-api.ts:220-273` |
| `stripLlmCommentary()` + length guard | `mistral-api.ts:258-294` |
| `/api/correct` endpoint | `server.py:247-275` |
| `dictatedRanges` tracking (only used for correction scope) | `main.ts:1118-1242` |
| Settings: toggle + model input | `settings-tab.ts` |

## What stays unchanged

- Voxtral STT transcription (core)
- Voice commands (regex/Levenshtein)
- Hallucination detection (heuristics)
- Noise suppression, typing mute, focus pause
- Offline queue, diarize, mic level

## Observable difference without LLM

- Capitalisation slightly less consistent
- Missing punctuation not filled in
- Speech recognition errors remain as-is
- Inline correction instructions ("voor de correctie: ...") stay literally in the text
- **Benefit**: faster processing, lower cost (no Mistral Small tokens)

## Interim solution: hide the setting

Before removing code, the setting can be hidden in the settings tab:
- Hide `autoCorrect` toggle → default becomes `false`
- Hide `correctModel` input
- Code stays intact but unreachable for users
- Easy to revert if correction proves valuable after all

## Reference

- Impact analysis: [`AUDIO-FLOW-EXLLM.md`](../../AUDIO-FLOW-EXLLM.md)
- Flow diagrams: [`AUDIO-FLOW.md`](../../AUDIO-FLOW.md)
