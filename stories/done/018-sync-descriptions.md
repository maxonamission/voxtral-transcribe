# Story 018: Synchroniseer plugin description in alle configuratiebestanden

**Epic:** Distribution
**Status:** Backlog
**Priority:** High
**Estimate:** Small

## Summary

De plugin description verschilt tussen `manifest.json`, `package.json` en `INSTALL.md`. De Obsidian community plugin review bot controleert dat descriptions identiek zijn. Dit moet gelijkgetrokken worden voordat een release wordt ingediend.

## Huidige situatie

| Bestand | Description |
|---------|-------------|
| `manifest.json` | "Speech-to-text dictation using Mistral Voxtral. Supports real-time streaming, voice commands (headings, lists, to-dos), and automatic text correction." |
| `package.json` | "Speech-to-text dictation for Obsidian using Mistral Voxtral" |
| `INSTALL.md` (community-plugins template) | "Speech-to-text dictation using Mistral Voxtral with real-time streaming, voice commands, and auto-correction." |

## Gewenst gedrag

Eén enkele description die overal identiek is. De `manifest.json`-versie is de meest volledige en zou leidend moeten zijn.

## Acceptatiecriteria

- [ ] Description in `package.json` is identiek aan `manifest.json`
- [ ] Description in `INSTALL.md` community-plugins template is identiek aan `manifest.json`
- [ ] CI-check of lintregeltoevoegen die description-consistentie valideert (optioneel)
