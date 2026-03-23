# Story 022: Tests voor RealtimeSession — delta handling en slot buffering

**Epic:** Code Quality & Maintainability (Obsidian plugin)
**Status:** Backlog
**Priority:** Medium
**Estimate:** Medium

## Summary

`RealtimeSession` (274 regels) heeft 0% testdekking. Het bevat single-stream transcriptie met cumulative delta handling, turn-boundary detectie, slot buffering en stop-pattern matching.

## Te testen scenario's

- [ ] Delta-accumulatie en turn-resets (`handleDelta` vs `handleDone`)
- [ ] Slot buffer isolatie van pending text
- [ ] Stop-pattern detectie (hardcoded Nederlandse en Engelse patronen)
- [ ] Reconnect met 5-attempt limiet en exponential backoff (500ms × failures, max 3000ms)
- [ ] Zin-einde punctuatie detectie

## Acceptatiecriteria

- [ ] Minimaal 8 testcases
- [ ] Tests draaien als onderdeel van `vitest run`
- [ ] Geen Obsidian runtime-dependency in tests
