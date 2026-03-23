# Story 014: Add versioned settings migration

**Epic:** Code Quality & Maintainability
**Target:** Obsidian plugin (`obsidian-plugin/`)
**Status:** Backlog
**Priority:** Medium
**Estimate:** Small

## Summary

`DEFAULT_SETTINGS` in `obsidian-plugin/src/types.ts` defines the Obsidian plugin's settings schema, but there is no migration strategy when the schema changes between plugin versions. Existing users who upgrade may encounter missing keys, type mismatches or silent failures when their stored `data.json` doesn't match the expected shape.

## Current state

- Settings are loaded with `Object.assign({}, DEFAULT_SETTINGS, await this.loadData())` which only provides shallow defaults
- New settings added in a plugin update will get default values, but renamed/removed/restructured settings are silently lost or ignored
- No `settingsVersion` field to detect schema drift
- Nested objects (if any are added in the future) won't get deep-merged

## Proposed design

1. Add a `settingsVersion: number` field to `VoxtralSettings` (current = 1)
2. Create `src/settings-migration.ts` with a migration registry:

```typescript
type Migration = (old: Record<string, unknown>) => Record<string, unknown>;

const migrations: Record<number, Migration> = {
  // 0 → 1: initial schema, no changes needed
  // 1 → 2: example — rename 'apiKey' to 'mistralApiKey'
};

export function migrateSettings(data: Record<string, unknown>): VoxtralSettings {
  let version = (data.settingsVersion as number) ?? 0;
  while (migrations[version]) {
    data = migrations[version](data);
    version++;
  }
  data.settingsVersion = version;
  return { ...DEFAULT_SETTINGS, ...data } as VoxtralSettings;
}
```

3. Call `migrateSettings()` in `onload()` instead of raw `Object.assign`

## Acceptance criteria

- [ ] `settingsVersion` field present in stored settings
- [ ] `migrateSettings()` function handles version 0 (pre-migration) gracefully
- [ ] Adding a new migration is straightforward (add entry to `migrations` map)
- [ ] Existing users' settings are preserved on upgrade (no data loss)
- [ ] Unit test: migration from v0 to current version with sample data

## Notes

- This is a low-risk preventive measure. No urgency until the next breaking settings change, but implementing it now (while the schema is still simple) is much easier than retrofitting later.
