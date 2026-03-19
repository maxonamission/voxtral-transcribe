# Story 007: User-defined mishearing corrections

**Epic:** Custom Commands & Extensibility
**Status:** Backlog
**Priority:** Medium
**Estimate:** Medium

## Summary

Allow users to add their own mishearing corrections per language, supplementing the built-in `MISHEARINGS` table. This is especially valuable for languages where Mistral's ASR makes consistent, predictable errors — e.g., confusing homophones in French or tonal mismatches in Chinese.

## Problem

The built-in `MISHEARINGS` in `lang.ts` only covers a handful of known Dutch, French, and German cases. Users in other languages (Russian, Chinese, Arabic, etc.) will encounter recurring ASR errors that we can't anticipate. Currently there's no way to fix these without editing source code.

## Proposed design

### Data model

```typescript
interface CustomMishearing {
  lang: string;       // language code
  pattern: string;    // regex pattern (string form)
  replacement: string;
  note?: string;      // optional user note, e.g. "Mistral hears 'sais' instead of 'c'est'"
}
```

### Storage

- `settings.customMishearings: CustomMishearing[]` in Obsidian's `data.json`
- Applied after built-in mishearings, before command matching

### Settings UI

New subsection under "Custom commands" or as its own collapsible section:

```
┌──────────────────────────────────────────────────────┐
│  Mishearing corrections                       [+ Add] │
├──────────────────────────────────────────────────────┤
│  [nl]  "niveau" → "nieuwe"  (built-in)               │
│  [fr]  "sais pas" → "c'est pas"           [Edit][Del] │
│  [zh]  "ma1 shang4" → "ma3 shang4"        [Edit][Del] │
└──────────────────────────────────────────────────────┘
```

Built-in entries shown grayed out (read-only), custom entries editable.

### Validation

- Validate regex on save (catch `SyntaxError`)
- Preview: show a test input field where user can type a phrase and see the corrected output live
- Warn if pattern is overly broad (e.g., single character)

### Pipeline integration

In `fixMishearings()` (`voice-commands.ts:44-50`):

```typescript
function fixMishearings(text: string, lang: string, customMishearings: CustomMishearing[]): string {
  // 1. Apply built-in mishearings
  for (const [pattern, replacement] of getMishearings(lang)) {
    text = text.replace(pattern, replacement);
  }
  // 2. Apply user-defined mishearings for active language
  for (const m of customMishearings.filter(m => m.lang === lang)) {
    text = text.replace(new RegExp(m.pattern, 'gi'), m.replacement);
  }
  return text;
}
```

## Acceptance criteria

- [ ] User can add, edit, delete custom mishearing corrections
- [ ] Each correction is scoped to a specific language
- [ ] Regex pattern validated on save with clear error message
- [ ] Live preview shows the effect of the correction
- [ ] Custom corrections applied after built-in ones, before command matching
- [ ] Built-in corrections visible but not editable
- [ ] Persists across plugin reloads

## Notes

- For non-technical users, consider a "simple mode" where they just type the misheard word and the correct word (auto-escaped to literal regex)
- Advanced users can toggle "regex mode" for pattern-based corrections
- Latency impact: negligible — same as built-in mishearings, just more entries in the loop
