# Story 008: Dynamic content actions & Templater integration

**Epic:** Custom Commands & Extensibility
**Status:** Backlog
**Priority:** Low
**Estimate:** Large

## Summary

Extend custom commands (story 006) with dynamic actions that go beyond inserting static text. This includes inserting today's date, timestamps, dynamic snippets, and — for users of the Templater plugin — triggering Templater templates by voice.

## Use cases

1. **"datum van vandaag"** → inserts `2026-03-19` (or user's preferred date format)
2. **"tijd"** → inserts `14:32`
3. **"scheiding"** → inserts `---\n` (horizontal rule)
4. **"vergadernotitie"** → inserts a full meeting-note template with date, attendees section, action items
5. **"sjabloon dagboek"** → triggers Templater template `Templates/dagboek.md`

## Proposed design

### Built-in dynamic variables

Extend the `CustomAction` type from story 006:

```typescript
type CustomAction =
  | { type: "insert"; text: string }
  | { type: "heading"; level: number }
  | { type: "wrap"; before: string; after: string }
  | { type: "dynamic"; template: string }      // NEW: supports variables
  | { type: "templater"; templatePath: string } // NEW: triggers Templater
```

#### `dynamic` action

The `text` field supports Mustache-style variables:

| Variable | Output | Example |
|----------|--------|---------|
| `{{date}}` | Today's date (YYYY-MM-DD) | `2026-03-19` |
| `{{date:DD-MM-YYYY}}` | Formatted date | `19-03-2026` |
| `{{time}}` | Current time (HH:mm) | `14:32` |
| `{{time:HH:mm:ss}}` | Formatted time | `14:32:07` |
| `{{title}}` | Active note title | `Meeting notes` |
| `{{clipboard}}` | Clipboard contents | *(whatever is copied)* |

Implementation uses simple regex replacement — no template engine dependency:

```typescript
function resolveDynamic(template: string): string {
  return template
    .replace(/\{\{date(?::([^}]+))?\}\}/g, (_, fmt) =>
      moment(fmt || 'YYYY-MM-DD'))  // Obsidian bundles moment.js
    .replace(/\{\{time(?::([^}]+))?\}\}/g, (_, fmt) =>
      moment(fmt || 'HH:mm'))
    .replace(/\{\{title\}\}/g, () =>
      app.workspace.getActiveFile()?.basename ?? '')
    .replace(/\{\{clipboard\}\}/g, () =>
      navigator.clipboard?.readText() ?? '');
}
```

#### `templater` action

For users with the Templater community plugin installed:

```typescript
async function triggerTemplater(templatePath: string): Promise<void> {
  const tp = app.plugins.plugins['templater-obsidian'];
  if (!tp) {
    new Notice('Templater plugin is not installed');
    return;
  }
  const file = app.vault.getAbstractFileByPath(templatePath);
  if (file instanceof TFile) {
    await tp.templater.append_template_to_active_file(file);
  }
}
```

### Settings UI (extends story 006)

When action type is "Dynamic text":
```
┌────────────────────────────────────────────┐
│  Action: Dynamic text                       │
│  Template: Vergadering {{date}} - {{title}} │
│  Preview:  Vergadering 2026-03-19 - Notes   │
│                                             │
│  Available: {{date}}, {{time}}, {{title}},  │
│             {{clipboard}}                   │
└────────────────────────────────────────────┘
```

When action type is "Templater template":
```
┌────────────────────────────────────────────┐
│  Action: Templater template                 │
│  Template file: [Templates/dagboek.md  ▾]  │
│  (lists .md files in Templates/ folder)     │
└────────────────────────────────────────────┘
```

## Acceptance criteria

- [ ] `{{date}}` and `{{time}}` variables resolve correctly with optional format
- [ ] `{{title}}` resolves to active note's basename
- [ ] `{{clipboard}}` reads from clipboard (with graceful fallback)
- [ ] Live preview in settings shows resolved variables
- [ ] Templater action triggers template insertion in active note
- [ ] Graceful error if Templater not installed (Notice, not crash)
- [ ] Template file picker shows files from vault's template folder
- [ ] Date/time formatting uses Obsidian's bundled moment.js (no new dependency)

## Dependencies

- Story 006 (Custom voice commands) — this extends its action system
- Templater plugin (optional) — only for `templater` action type

## Notes

- moment.js is already bundled with Obsidian, so date formatting adds zero bundle size
- Clipboard access may require user permission on some platforms; handle gracefully
- Consider caching Templater plugin reference to avoid repeated lookup
- Future: could extend variables with `{{frontmatter:key}}` to read YAML properties
