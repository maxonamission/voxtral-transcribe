# Story 018: Webapp refactoring — shared core module & language convergence

**Epic:** Architecture
**Status:** Done
**Priority:** Medium
**Completed:** 2026-03-28

## Summary

The webapp (`static/app.js`) was a 2,500-line monolithic file with ~1,200 lines of logic duplicated from the Obsidian plugin. Changes to shared logic (voice commands, phonetics, context-aware formatting, correction) had to be applied in two places independently. This story extracted shared platform-independent code into a reusable module and converged all language data to a single source of truth.

## What was done

### Phase 1: Shared core extraction

Created `obsidian-plugin/src/shared/` with platform-independent modules:

| Module | Contents |
|--------|----------|
| `similarity.ts` | `levenshtein()`, `normalizeCommand()` |
| `text-context.ts` | `InsertionContext`, `detectContext()`, `lowercaseFirstLetter()`, `stripTrailingPunctuation()`, `shouldStripTrailingPunctuation()`, `shouldLowercase()` |
| `correction.ts` | `DEFAULT_CORRECT_PROMPT`, `buildCustomCommandGuard()`, `stripLlmCommentary()`, `isLikelyHallucination()` |
| `index.ts` | Barrel export |

Plugin updated to import from `./shared` — ~210 lines removed from plugin-specific code.

**Note:** Shared modules live inside `obsidian-plugin/src/shared/` (not a root `shared/` directory) so the standalone `obsidian-voxtral` repo can build without the parent repo.

### Phase 2: Generic command matching

Extracted the 5-pass voice command matching algorithm into `shared/command-matcher.ts`:

```typescript
interface LanguageProvider {
    getPatterns(commandId: string, lang: string): string[];
    getMishearings(lang: string): [RegExp, string][];
    phoneticNormalize(text: string, lang: string): string;
    stripArticles(text: string, lang: string): string;
    stripTrailingFillers(text: string, lang: string): string;
    trySplitCompound(text: string, knownPhrases: string[]): string;
}

function findMatch(
    rawText: string,
    commands: MatchableCommand[],
    lang: string,
    provider: LanguageProvider
): MatchResult | null;
```

Both plugin and webapp implement a thin `LanguageProvider` adapter and delegate their `matchCommand()`/`findCommand()` to `findMatch()`. Plugin's `voice-commands.ts` lost ~159 lines.

### Phase 3: Webapp build step & deduplication

Added esbuild for the webapp:
- `static/src/main.js` — source file with ES module imports
- `static/esbuild.config.mjs` — bundles to `static/app.js` (IIFE)
- `package.json` at root with `build:webapp` script
- `index.html` unchanged (same output location)

Webapp now imports from shared: `findMatch`, `normalizeCommand`, `lowercaseFirstLetter`, `detectContext`.

### Phase 4: Language data convergence

Created `shared/lang-data.ts` that loads all 13 language JSON files and exports compiled data structures. The webapp's hardcoded language data (~120 lines of `LANG_PATTERNS`, `LANG_MISHEARINGS`, `PHONETIC_RULES`, `LANG_ARTICLES`, `LANG_TRAILING_FILLERS`) was removed entirely.

Also synced webapp-only patterns to JSON: added `"stopopname"` to `nl.json`.

**Result:** Webapp now supports all 13 languages (was 7) and gains richer pattern sets automatically.

## Final architecture

```
obsidian-plugin/src/
  ├── shared/                    ← platform-independent core
  │   ├── index.ts               # barrel export
  │   ├── similarity.ts          # levenshtein, normalizeCommand
  │   ├── text-context.ts        # InsertionContext, detectContext, casing
  │   ├── correction.ts          # correction prompt, hallucination detection
  │   ├── command-matcher.ts     # 5-pass matching algorithm + LanguageProvider
  │   └── lang-data.ts           # loads languages/*.json, exports compiled data
  ├── languages/*.json           # 13 language files (single source of truth)
  ├── voice-commands.ts          ← imports from ./shared
  ├── mistral-api.ts             ← imports from ./shared
  ├── types.ts                   ← re-exports from ./shared
  └── ...

static/
  ├── src/main.js                ← source (imports from shared)
  ├── app.js                     ← bundled output (esbuild)
  ├── esbuild.config.mjs
  └── index.html                 ← unchanged
```

## Results

| Metric | Before | After |
|--------|--------|-------|
| Webapp source (`src/main.js`) | 2,503 lines | 2,134 lines (-369) |
| Plugin `voice-commands.ts` | ~940 lines | ~640 lines (-300) |
| Languages in webapp | 7 | **13** |
| Duplicated functions | ~15 | **0** |
| Places to update language data | 2 | **1** (JSON files) |
| Plugin tests | 306 pass | 306 pass |

## What was NOT done (follow-up stories)

### Webapp module splitting → Story 019

The webapp `src/main.js` is still one file (2,134 lines). It could be split into ~6 focused modules (voice-commands, recording, settings-ui, etc.). This is pure code organization — no functional change, no deduplication remaining. Lower priority now that shared imports eliminated the duplication.

### Plugin phonetics.ts / lang.ts consolidation

The plugin still has its own `phonetics.ts` and `lang.ts` that duplicate some logic now in `shared/lang-data.ts`. These could be refactored to import from shared instead, but they work and the duplication is small (~150 lines with slightly different interfaces). Low risk, low urgency.

## Acceptance criteria

- [x] Shared modules exist with similarity, text-context, correction, command-matcher, lang-data
- [x] Plugin imports from shared instead of local duplicates
- [x] Webapp imports from shared via esbuild bundler
- [x] All existing tests pass (plugin: 306)
- [x] No logic duplication between webapp and plugin for matching, context, correction
- [x] Language data maintained in one place (languages/*.json)
- [ ] ~~`app.js` is split into ≤6 focused modules~~ → deferred to Story 019
