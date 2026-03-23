# Story 020: Automatische versie-ophogingsstap voor releases

**Epic:** Distribution
**Status:** Backlog
**Priority:** Medium
**Estimate:** Medium

## Summary

Het ophogen van versienummers in `package.json`, `manifest.json` en `versions.json` gebeurt nu volledig handmatig. Dit is foutgevoelig — het is makkelijk om één bestand te vergeten of inconsistente versies te introduceren. Er is behoefte aan een geautomatiseerd bumpmechanisme.

## Huidige situatie

- Versienummers moeten handmatig worden bijgewerkt in drie bestanden:
  - `obsidian-plugin/package.json` → `version`
  - `obsidian-plugin/manifest.json` → `version`
  - `obsidian-plugin/versions.json` → nieuwe entry `"x.y.z": "minAppVersion"`
- De CI valideert achteraf dat de versies consistent zijn, maar voorkomt niet dat je vergeet te bumpen

## Mogelijke implementaties

1. **npm script**: `npm run bump -- patch|minor|major` dat alle drie bestanden bijwerkt
2. **Pre-commit hook**: die waarschuwt als versies niet consistent zijn
3. **GitHub Action**: workflow_dispatch met versie-input die automatisch bumpt en commit

## Acceptatiecriteria

- [ ] Eén commando of actie om de versie op te hogen in alle drie bestanden
- [ ] `versions.json` krijgt automatisch een nieuwe entry met de juiste `minAppVersion`
- [ ] Het mechanisme voorkomt dat bestanden uit sync raken
