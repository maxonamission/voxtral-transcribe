# Story 006: Custom voice commands — learning mode

**Epic:** Custom Commands & Extensibility
**Status:** Backlog
**Priority:** Medium
**Estimate:** Large

## Summary

Users can define their own voice commands via a "learning mode" in the settings. This allows adding commands beyond the 13 built-in ones — e.g., "kop 4" for heading 4, or a personal shortcut like "handtekening" to insert a fixed block of text.

## Problem

The current command set is hardcoded in `lang.ts` and `voice-commands.ts`. Power users with specific workflows (academic writing, journaling, meeting notes) need commands the plugin doesn't ship with.

## Proposed design

### Data model

```typescript
interface CustomCommand {
  id: string;                          // auto-generated UUID
  patterns: Record<string, string[]>;  // per-language trigger phrases
  action: CustomAction;
}

type CustomAction =
  | { type: "insert"; text: string }           // insert fixed text
  | { type: "heading"; level: number }         // heading 1-6
  | { type: "wrap"; before: string; after: string }  // e.g., bold **…**
  | { type: "templater"; template: string }    // see story 008
```

### Storage

- Persisted in Obsidian's `data.json` alongside existing settings (`settings.customCommands: CustomCommand[]`)
- Imported/exported as JSON for sharing between vaults

### Learning mode UI

Settings tab gains a new section "Custom commands":

```
┌─────────────────────────────────────────────────┐
│  Custom commands                          [+ Add] │
├─────────────────────────────────────────────────┤
│  "kop 4"  →  Heading 4              [Edit] [Del] │
│  "handtekening"  →  Insert: "Met vriendelij..."  │
│  "dikgedrukt"  →  Wrap: **…**        [Edit] [Del] │
└─────────────────────────────────────────────────┘
```

Adding a command opens a sub-modal:

1. **Trigger phrase(s)** — text input per active language
2. **Action type** — dropdown (Insert text / Heading / Wrap / Templater)
3. **Action config** — depends on type (text area, level picker, etc.)

### Integration with matching pipeline

- Custom commands are appended to the pattern list before matching
- Same 2-pass algorithm (exact → Levenshtein) applies
- Custom commands take priority over built-in if patterns overlap
- `processText()` routes to a `executeCustomAction()` handler

## Acceptance criteria

- [ ] User can add, edit, and delete custom voice commands in settings
- [ ] Custom patterns participate in both exact and fuzzy matching
- [ ] "Insert text" action inserts literal text at cursor
- [ ] "Heading" action works for levels 1-6
- [ ] "Wrap" action wraps preceding text or selection
- [ ] Commands persist across plugin reloads
- [ ] JSON import/export for command sharing
- [ ] Help panel shows custom commands in a separate section

## Notes

- Keep built-in commands non-deletable; custom commands are user-owned
- Pattern collisions should show a warning in the UI
- Consider a "record pattern" button that listens to mic and captures the recognized phrase directly — reduces typos
