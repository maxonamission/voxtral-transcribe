# Epic: Overweeg verwijdering LLM-correctie (autoCorrect)

**Status**: Open
**Type**: Enhancement / Evaluatie

---

## Context

De `correctText()`-functie gebruikt Mistral Small om getranscribeerde tekst op te schonen (capitalisatie, leestekens, spraakfouten). Dit is een kwaliteitslaag bovenop de Voxtral STT-transcriptie, geen functionele vereiste.

Zie [`AUDIO-FLOW-EXLLM.md`](./AUDIO-FLOW-EXLLM.md) voor een volledige impact-analyse.

## Stappen

- [ ] **Test**: Gebruik de app/plugin met `autoCorrect: false` en evalueer de output-kwaliteit zonder LLM-correctie
- [ ] **Evalueer**: Is de Voxtral STT-output voldoende voor dagelijks gebruik zonder nabewerking?
- [ ] **Besluit**: Correctie behouden, optioneel maken (huidige staat), of verwijderen?
- [ ] **Indien verwijderen**: Verberg de `autoCorrect` toggle en `correctModel` veld in de settings tab (maak de code onbereikbaar zonder te slopen)
- [ ] **Optioneel**: Verwijder de ~360 regels correctie-code volledig als de feature definitief geschrapt wordt

## Wat verdwijnt

| Functie | Locatie |
|---------|--------|
| Auto-correct na batch transcriptie | `main.ts:566-567`, `app.js:1700-1706` |
| Auto-correct bij stop (realtime/dual) | `main.ts:741-742`, `main.ts:1058-1059` |
| Handmatige correctie command | `main.ts:1260-1295` |
| `correctText()` | `mistral-api.ts:220-273` |
| `stripLlmCommentary()` + lengte-guard | `mistral-api.ts:258-294` |
| `/api/correct` endpoint | `server.py:247-275` |
| `dictatedRanges` tracking (alleen voor correctie-scope) | `main.ts:1118-1242` |
| Settings: toggle + model input | `settings-tab.ts` |

## Wat NIET verandert

- Voxtral STT transcriptie (kern)
- Voice commands (regex/Levenshtein)
- Hallucination detection (heuristiek)
- Noise suppression, typing mute, focus pause
- Offline queue, diarize, mic level

## Merkbaar verschil zonder LLM

- Capitalisatie iets minder consistent
- Ontbrekende leestekens worden niet aangevuld
- Spraakherkenningsfouten blijven staan
- Inline correctie-instructies ("voor de correctie: ...") blijven letterlijk in de tekst
- **Voordeel**: snellere verwerking, lagere kosten (geen Mistral Small tokens)

## Tussenoplossing: instelling verbergen

Voordat de code verwijderd wordt, kan de instelling onzichtbaar gemaakt worden in de settings tab:
- `autoCorrect` toggle verbergen → default wordt `false`
- `correctModel` input verbergen
- Code blijft intact maar is onbereikbaar voor gebruikers
- Makkelijk terug te draaien als de correctie toch waardevol blijkt

## Referentie

- Impact-analyse: [`AUDIO-FLOW-EXLLM.md`](./AUDIO-FLOW-EXLLM.md)
- Flow-diagrammen: [`AUDIO-FLOW.md`](./AUDIO-FLOW.md)
