# Story 017: Fix bold/italic slot mechanism met real-time transcriptie

**Epic:** Bug fixes
**Status:** Backlog
**Priority:** High
**Estimate:** Medium

## Summary

De stemcommando's voor **vet** (`**`) en *cursief* (`*`) openen correct de markdown-symbolen, maar de slot-mechanisme werkt niet goed samen met de real-time transcriptie. De tekst die na het openen wordt gedicteerd, komt buiten de formatting-symbolen terecht.

## Stappen om te reproduceren

1. Start dictatie
2. Geef het stemcommando "dikgedrukt" of "cursief"
3. De openings-symbolen (`**` of `*`) worden correct ingevoegd
4. Dicteer verdere tekst — transcriptie lijkt te pauzeren tot Enter wordt ingedrukt
5. Druk op Enter om de slot te sluiten

## Verwacht gedrag

- Na het invoegen van de openings-symbolen gaat de transcriptie direct door
- Gedicteerde tekst verschijnt tussen de openings- en sluit-symbolen
- Na Enter worden de sluit-symbolen direct na de tekst geplaatst: `**tekst**`

## Huidig gedrag

- Transcriptie pauzeert na het invoegen van de openings-symbolen
- Pas na Enter wordt de transcriptie hervat
- De sluit-symbolen worden toegevoegd direct na de openings-symbolen (zonder tekst ertussen): `****`
- De gedicteerde tekst komt na de sluit-symbolen terecht: `**** tekst`
- Er staat een spatie na het openings-symbool waardoor markdown sowieso niet rendert: `** tekst**`

## Relevante code

- `obsidian-plugin/src/voice-commands.ts` — `bold` command (regels 278-289), `italic` command (regels 291-302)
- Het `activeSlot` mechanisme en hoe het samenwerkt met inkomende transcriptie-chunks
- De `exitTrigger: "enter"` logica

## Mogelijke oorzaken

- De transcriptie-stream stopt niet automatisch met schrijven naar de cursor-positie binnen de slot
- Inkomende transcriptie-tekst wordt ingevoegd op een positie die niet binnen de openings/sluit-symbolen valt
- De spatie die wordt toegevoegd door de transcriptie-engine breekt de markdown-syntax

## Acceptatiecriteria

- [ ] Na het stemcommando "vet"/"dikgedrukt" gaat de transcriptie direct door binnen de `**`-symbolen
- [ ] Na het stemcommando "cursief"/"schuingedrukt" gaat de transcriptie direct door binnen de `*`-symbolen
- [ ] Bij het sluiten van de slot (Enter) wordt de tekst correct omsloten: `**tekst**` / `*tekst*`
- [ ] Geen extra spatie na het openings-symbool
- [ ] Werkt voor alle talen die bold/italic stemcommando's ondersteunen
