# Story 018: Webapp refactoring — shared core module & modular architecture

**Epic:** Architecture
**Status:** Backlog
**Priority:** Medium
**Estimate:** X-Large (multi-phase)

## Summary

The webapp (`static/app.js`) is a 2,500-line monolithic file with ~1,200 lines of logic duplicated from the Obsidian plugin. Changes to shared logic (voice commands, phonetics, context-aware formatting, correction) must currently be applied in two places independently. This story extracts shared platform-independent code into a reusable module and splits the webapp into manageable files.

## Current state

### Plugin (well-structured)
```
obsidian-plugin/src/
  ├── types.ts              (223 LOC) — interfaces, defaults, built-in commands
  ├── lang.ts               (156 LOC) — language support, patterns, mishearings
  ├── phonetics.ts          (153 LOC) — normalization, article/filler stripping
  ├── voice-commands.ts     (938 LOC) — matching, context detection, insertion
  ├── mistral-api.ts        (511 LOC) — transcription, correction, hallucination
  ├── authenticated-websocket.ts  — WebSocket with auth header
  ├── audio-recorder.ts     — audio capture, PCM encoding
  ├── realtime-session.ts   — single-stream realtime
  ├── dual-delay-session.ts — dual-stream realtime
  ├── dictation-tracker.ts  — text range tracking, auto-correct
  ├── templates.ts          — template folder scanning
  ├── help-view.ts          — help panel UI
  ├── settings-tab.ts       — settings UI
  ├── settings-migration.ts — version migration
  ├── plugin-logger.ts      — debug logging
  └── main.ts               — plugin lifecycle
```

### Webapp (monolithic)
```
static/app.js  (2,503 LOC — everything in one file)
  ├── Global state & DOM refs          (1-185)
  ├── Insert point & spacing           (187-286)
  ├── Voice command patterns (7 talen) (288-427)
  ├── Fonetiek & normalisatie          (450-576)    ← duplicaat
  ├── Command matching (6-pass)        (578-709)    ← duplicaat
  ├── Command execution                (711-844)
  ├── Context-aware insertion          (885-1021)   ← duplicaat
  ├── Undo stack                       (926-978)
  ├── Click-to-cursor                  (1068-1143)
  ├── IndexedDB queue                  (1144-1233)
  ├── Audio/PCM processing             (1364-1413)
  ├── Realtime recording               (1415-1498)
  ├── Dual-delay recording             (1501-1790)
  ├── Batch recording                  (1791-1854)
  ├── Text correction                  (1934-2010)  ← duplicaat
  ├── Settings modal                   (2046-2246)
  ├── Help panel & shortcuts           (2261-2486)
  └── Initialization                   (2487-2503)
```

## Duplicated logic inventory

| Category | Webapp lines | Plugin equivalent | Identical? | Effort |
|----------|-------------|-------------------|-----------|--------|
| `stripDiacritics()` | 455-457 | voice-commands.ts:135 | Yes | Trivial |
| `phoneticNormalize()` | 533-541 | phonetics.ts:82-91 | Yes | Trivial |
| `stripArticles()` | 543-553 | phonetics.ts:97-112 | Yes | Trivial |
| `stripTrailingFillers()` | 555-565 | phonetics.ts:118-130 | Yes | Trivial |
| `trySplitCompound()` | 567-575 | phonetics.ts:138-153 | Yes | Trivial |
| `levenshtein()` | 460-473 | voice-commands.ts:152-165 | Yes | Trivial |
| `normalizeCommand()` | 578-588 | voice-commands.ts:133-141 | Near-identical | Trivial |
| `lowercaseFirstLetter()` | 1014-1021 | voice-commands.ts:224-234 | Yes | Trivial |
| Command matching (6-pass) | 590-709 | voice-commands.ts:693-837 | Same algorithm | Moderate |
| `detectInsertContext()` | 984-1007 | voice-commands.ts:178-218 | Same concept | Moderate |
| `correctText()` | 1937-1952 | mistral-api.ts:252-306 | Same flow | Moderate |
| `isLikelyHallucination()` | *missing* | mistral-api.ts:109-158 | Webapp lacks it | Easy to add |

**Total duplicated: ~1,200 lines** (~400 trivially extractable, ~500 with abstraction)

## Proposed target architecture

```
voxtral-transcribe/
  ├── shared/                          ← NEW: platform-independent core
  │   ├── package.json
  │   ├── tsconfig.json
  │   └── src/
  │       ├── phonetics.ts            # stripDiacritics, phoneticNormalize,
  │       │                           # stripArticles, stripTrailingFillers,
  │       │                           # trySplitCompound
  │       ├── similarity.ts           # levenshtein, normalizeCommand
  │       ├── text-context.ts         # InsertionContext type, detectContext rules,
  │       │                           # lowercaseFirstLetter, shouldStripPunctuation
  │       ├── command-matcher.ts      # Generic 6-pass matching algorithm
  │       ├── correction.ts           # DEFAULT_CORRECT_PROMPT,
  │       │                           # buildCustomCommandGuard,
  │       │                           # isLikelyHallucination,
  │       │                           # stripLlmCommentary
  │       ├── types.ts                # CommandDef, CommandMatch, InsertionContext,
  │       │                           # CustomCommand, language definitions
  │       └── languages/              # nl.json, en.json, etc. (shared patterns)
  │
  ├── obsidian-plugin/                 ← imports shared/
  │   └── src/
  │       ├── voice-commands.ts       # Obsidian-specific: insertAtCursor (Editor API),
  │       │                           # slot management, processText
  │       ├── mistral-api.ts          # Obsidian-specific: requestUrl, WebSocket auth
  │       └── ...                     # rest unchanged
  │
  └── static/                          ← webapp, imports shared/ via bundler
      ├── app.js → split into:
      │   ├── main.js                 # Init, event handlers, global state
      │   ├── voice-commands.js       # DOM-specific: command execution, text insertion
      │   ├── recording.js            # Realtime, dual-delay, batch recording
      │   ├── transcript-queue.js     # IndexedDB offline queue
      │   ├── settings-ui.js          # Settings modal
      │   └── imports shared/         # phonetics, matching, context, correction
      └── index.html                  # loads bundled JS
```

## Phased implementation

### Phase 1: Shared core extraction (low risk, high impact)

Extract platform-independent pure functions into `shared/src/`:

1. **phonetics.ts** — Move from plugin's `phonetics.ts` (already clean)
2. **similarity.ts** — `levenshtein()`, `normalizeCommand()`
3. **text-context.ts** — `InsertionContext` type, context detection rules (as pure data/functions that take "text before cursor" as string input, no Editor dependency)
4. **correction.ts** — `DEFAULT_CORRECT_PROMPT`, `buildCustomCommandGuard()`, `isLikelyHallucination()`, `stripLlmCommentary()`

**Plugin integration:** Replace imports in `phonetics.ts`, `voice-commands.ts`, `mistral-api.ts` to point at `shared/`.

**Webapp integration:** Requires a build step (esbuild or vite) to bundle `shared/` modules into the webapp. Currently `app.js` is loaded as a plain `<script>` — this changes to a bundled output.

**Impact:** ~400 lines of duplication eliminated. Single source of truth for all text processing.

### Phase 2: Generic command matching (moderate risk)

Abstract the 6-pass matching algorithm:

```typescript
// shared/command-matcher.ts
interface MatchableCommand {
  id: string;
  getPatterns(lang: string): string[];
}

interface MatchResult {
  commandId: string;
  textBefore: string;
}

function matchCommand(
  text: string,
  commands: MatchableCommand[],
  lang: string,
  mishearings: [RegExp, string][],
): MatchResult | null;
```

Both the plugin and webapp wrap this with their platform-specific command definitions and result handling.

**Impact:** ~500 lines of duplicated matching logic eliminated.

### Phase 3: Webapp modularization (moderate risk)

Split `app.js` into focused modules:

1. **main.js** (~300 lines) — Init, DOM refs, event binding, state
2. **voice-commands.js** (~250 lines) — DOM-specific command execution
3. **recording.js** (~450 lines) — Realtime, dual-delay, batch
4. **transcript-queue.js** (~100 lines) — IndexedDB queue
5. **settings-ui.js** (~200 lines) — Settings modal
6. **help-ui.js** (~120 lines) — Help panel, shortcuts

**Prerequisite:** Build step from Phase 1 (esbuild/vite).

### Phase 4: Webapp feature parity (optional)

Add features the webapp is missing:
- Hallucination detection (`isLikelyHallucination()` from shared)
- Custom command guard for correction (`buildCustomCommandGuard()`)
- 5-type context detection matching plugin (currently 3 types)

## Build tooling consideration

The webapp currently has no build step — `app.js` is served directly. To import from `shared/`, options are:

1. **esbuild** — Fast, minimal config, produces single bundle. Recommended.
2. **vite** — More features (HMR, dev server), heavier. Overkill for this.
3. **Inline shared code** — Copy shared functions at build time. Avoids runtime module system but doesn't solve the duplication problem.

Recommendation: **esbuild** with a simple build script in `package.json`.

## Risks

- **Build step for webapp** — Currently zero-tooling deployment. Adding esbuild is minimal but changes the workflow.
- **Breaking changes** — Extracting normalizeCommand() may surface minor differences (webapp strips more punctuation variants). Needs careful testing.
- **Language data format** — Plugin uses JSON files in `languages/`, webapp has inline objects. Need to converge on one format.

## Acceptance criteria

- [ ] `shared/` package exists with phonetics, similarity, text-context, correction modules
- [ ] Plugin imports from `shared/` instead of local duplicates
- [ ] Webapp imports from `shared/` via bundler
- [ ] All existing tests pass (plugin: 306+, webapp: manual testing)
- [ ] New tests for shared modules cover both plugin and webapp use cases
- [ ] `app.js` is split into ≤6 focused modules
- [ ] No logic duplication between webapp and plugin for shared functionality
