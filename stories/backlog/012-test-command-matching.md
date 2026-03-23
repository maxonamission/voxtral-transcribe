# Story 012: Add test suite for command matching and hallucination detection

**Epic:** Code Quality & Maintainability
**Target:** Obsidian plugin (`obsidian-plugin/`)
**Status:** Backlog
**Priority:** High
**Estimate:** Medium

## Summary

The voice command matching pipeline (6-pass: exact → filler-stripping → article-stripping → phonetic → compound-splitting → fuzzy) and the hallucination detection heuristics are the highest-risk purely functional logic in the Obsidian plugin. Both are stateless and highly testable, yet have zero automated tests.

## Current state

- No test framework configured (`package.json` has no test script, no test dependencies)
- Command matching has known edge-case risks: short utterances triggering false positives, cross-language phonetic collisions, Levenshtein distance ≤ 2 matching unintended phrases
- Hallucination detection thresholds (>5 words/sec, repeated blocks) are hardcoded without documented rationale
- Phonetic normalization rules in `phonetics.ts` vary per language with no regression tests

## Proposed design

### Test framework setup

Add Vitest (lightweight, ESM-native, no config overhead):

```json
// package.json additions
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
},
"devDependencies": {
  "vitest": "^3.0.0"
}
```

### Test files

| File | Covers |
|------|--------|
| `src/__tests__/voice-commands.test.ts` | All 6 matching passes, per-language edge cases, false positive regression |
| `src/__tests__/phonetics.test.ts` | Phonetic normalization per language, compound splitting |
| `src/__tests__/hallucination.test.ts` | `isLikelyHallucination()` thresholds, boundary cases |
| `src/__tests__/mishearing.test.ts` | Language-specific mishearing corrections |

### Example test cases

```typescript
// voice-commands.test.ts
describe('Dutch command matching', () => {
  it('matches "nieuwe alinea" exactly', () => { ... });
  it('matches "nieuwealinea" via compound splitting', () => { ... });
  it('matches "nieuwe allinea" via fuzzy (Levenshtein 1)', () => { ... });
  it('does NOT match "nieuwe" alone (too short, false positive)', () => { ... });
  it('strips filler "alsjeblieft" before matching', () => { ... });
});

describe('hallucination detection', () => {
  it('flags text with >5 words per second of audio', () => { ... });
  it('flags repeated sentence blocks', () => { ... });
  it('accepts normal transcription output', () => { ... });
});
```

## Acceptance criteria

- [ ] Vitest configured and `npm test` runs successfully
- [ ] ≥ 50 test cases covering command matching across Dutch, English, French and German
- [ ] ≥ 10 test cases for hallucination detection boundary conditions
- [ ] ≥ 10 test cases for phonetic normalization
- [ ] All tests pass in CI (add `npm test` to release workflow)
- [ ] No false-positive regression tests for known short-phrase edge cases

## Notes

- Focus on the functional core: `matchCommand()`, `normalizePhonetic()`, `isLikelyHallucination()`, `fixMishearings()`. These functions have no Obsidian dependencies and can be tested in pure Node.js.
- This story can be done independently of story 010 (main.ts split) since the target functions are already in separate modules.
