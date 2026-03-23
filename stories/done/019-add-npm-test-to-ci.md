# Story 019: Voeg npm test toe aan plugin-ci.yml en sync-workflow

**Epic:** Code Quality & Maintainability (Obsidian plugin)
**Status:** Backlog
**Priority:** High
**Estimate:** Small

## Summary

De teststap (`npm test` / `vitest run`) wordt niet uitgevoerd in de CI-pipeline. Noch `plugin-ci.yml` noch `sync-obsidian-plugin.yml` draait tests. Dit betekent dat regressies ongemerkt door de pipeline kunnen en zelfs naar de publieke Obsidian plugin repo worden gesynchroniseerd.

## Huidige situatie

- `package.json` heeft `"test": "vitest run"` — tests bestaan en zijn lokaal uitvoerbaar
- `plugin-ci.yml` draait: install → ESLint → TypeScript check → build → version check
- `sync-obsidian-plugin.yml` draait: install → ESLint → TypeScript check → build → version verify
- Geen van beide voert `npm test` uit

## Gewenst gedrag

Tests worden als harde gate uitgevoerd in beide workflows, vóór de build-stap.

## Acceptatiecriteria

- [ ] `plugin-ci.yml` bevat een `npm test`-stap tussen TypeScript check en build
- [ ] `sync-obsidian-plugin.yml` bevat een `npm test`-stap in de validate-job
- [ ] Falende tests blokkeren de pipeline (exit code ≠ 0 faalt de workflow)
