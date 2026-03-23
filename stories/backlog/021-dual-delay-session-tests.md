# Story 021: Tests voor DualDelaySession — kernlogica en edge cases

**Epic:** Code Quality & Maintainability (Obsidian plugin)
**Status:** Backlog
**Priority:** High
**Estimate:** Large

## Summary

`DualDelaySession` (695 regels) is de meest complexe module in de plugin en heeft 0% testdekking. Het bevat dual-stream reconciliatie, reconnect-logica, command-detectie en offset-berekeningen. Dit is het hoogste regressierisico bij verdere uitbreiding.

## Waarom dit urgent is

- 14 state variables die op complexe manieren interacteren
- Dual-stream tekst-reconciliatie (`slowText + fastText.substring(slowLen)`) heeft veel edge cases
- Reconnect-logica met exponential backoff en state-reset
- Command-detectie concurrent met tekstrendering
- Geen enkel scenario is geautomatiseerd getest

## Te testen scenario's

### Reconciliatie
- [ ] Fast stream altijd ahead van slow stream — normaalgedrag
- [ ] Streams divergeren — geen tekstverlies of -duplicatie
- [ ] Cumulative delta handling (`text.startsWith(prevRaw)`)

### Reconnect
- [ ] Slow stream reconnect — state reset, flush pending text
- [ ] Fast stream reconnect — herstart zonder tekstverlies
- [ ] Maximale failures bereikt — graceful stop
- [ ] Exponential backoff timing

### Command execution
- [ ] Command gedetecteerd in slow stream — juiste actie
- [ ] Trailing punctuatie na command — correct afgehandeld
- [ ] Race condition: command + tekstrendering gelijktijdig

### Offset-berekeningen
- [ ] Cursor verplaatst door gebruiker — detectie en commit
- [ ] Insert offset na command execution
- [ ] Display length tracking bij tekst-updates

## Technische uitdaging

De module is sterk gekoppeld aan `Editor` en `RealtimeTranscriber`. Tests vereisen:
- Mock-implementaties van `Editor` en `SessionCallbacks`
- Gesimuleerde WebSocket delta-sequences
- Timing-controle voor reconnect-scenario's

## Acceptatiecriteria

- [ ] Minimaal 15 testcases die de bovenstaande scenario's dekken
- [ ] Tests draaien als onderdeel van `vitest run`
- [ ] Geen Obsidian runtime-dependency in tests (alleen mocks)
