# Story 015: Extract language definitions to data format

**Epic:** Code Quality & Maintainability
**Target:** Obsidian plugin (`obsidian-plugin/`)
**Status:** Backlog
**Priority:** Low
**Estimate:** Medium

## Summary

`obsidian-plugin/src/lang.ts` (670 lines) and `obsidian-plugin/src/phonetics.ts` (216 lines) are almost entirely static data: command patterns, mishearing corrections, phonetic rules and filler words per language. Storing this as TypeScript code means only developers can maintain it, while this data is ideally editable by translators and linguists.

## Current state

- `lang.ts` exports language-specific objects with command patterns, labels and mishearing corrections
- `phonetics.ts` exports phonetic normalization rules and compound-splitting dictionaries
- Both files are pure data with no logic beyond simple array/object literals
- Adding a new language or fixing a mishearing requires editing TypeScript source and rebuilding

## Proposed design

1. Extract language data into JSON or YAML files under `obsidian-plugin/src/languages/`:
   ```
   languages/
   ├── nl.json    # Dutch commands, mishearings, phonetics
   ├── en.json    # English
   ├── fr.json    # French
   ├── de.json    # German
   └── ...
   ```
2. Define a JSON schema for validation
3. Import the JSON files in a thin `lang.ts` loader that provides the same typed API
4. Keep `phonetics.ts` as a thin processing layer that reads rules from the JSON data

## Acceptance criteria

- [ ] Language data lives in separate JSON/YAML files, one per language
- [ ] A JSON schema validates the structure of each language file
- [ ] `lang.ts` and `phonetics.ts` still export the same typed interfaces
- [ ] Adding a new language requires only a new data file (no TypeScript changes)
- [ ] Build output unchanged (esbuild bundles JSON imports)
- [ ] All existing command matching behaviour preserved

## Notes

- This also benefits the webapp (`static/app.js`) if it shares language data in the future — but that's a separate story.
- Consider whether the webapp's `server.py` could consume the same JSON files to avoid drift. Out of scope for this story but worth noting.
