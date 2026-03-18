# Story 005: Settings modal two-column landscape layout

**Epic:** UX & Responsiveness
**Status:** Backlog
**Priority:** Low

## Summary

The settings modal currently uses a single-column layout. With the growing number of settings (API key, dual-delay, noise suppression, autocorrect, system prompt, language, microphone, models, shortcut), the modal is getting long.

Redesign the settings modal to use a two-column layout in landscape/wide viewports, distributing settings across both columns for a more compact overview.

## Proposed layout

```
┌─────────────────────────────────────────────────────────┐
│  Instellingen                                           │
├────────────────────────────┬────────────────────────────┤
│  Mistral API Key           │  Taal / Language           │
│  [____________________]    │  [dropdown________]        │
│                            │                            │
│  Dual-delay (experimenteel)│  Microfoon                 │
│  [toggle]                  │  [dropdown________]        │
│                            │                            │
│  Ruisonderdrukking         │  Realtime model            │
│  [toggle]                  │  [dropdown________]        │
│                            │                            │
│  Tekstcorrectie            │  Batch model               │
│  [toggle]                  │  [dropdown________]        │
│                            │                            │
│  Systeemprompt             │  Correctiemodel            │
│  [textarea_____]           │  [dropdown________]        │
│                            │                            │
│                            │  Sneltoets opnemen         │
│                            │  [____________________]    │
├────────────────────────────┴────────────────────────────┤
│              [Opslaan]  [Sluiten]                       │
└─────────────────────────────────────────────────────────┘
```

## Approach

- Use CSS grid or flexbox with two columns
- `max-width` increased from 440px to ~700px for wide screens
- Fallback to single column on narrow/portrait screens via media query
- Left column: toggles and text inputs (API key, prompts)
- Right column: dropdowns and selectors (language, mic, models)

## Acceptance criteria

- [ ] Two-column layout on screens wider than ~600px
- [ ] Single-column fallback on narrow screens (mobile, portrait)
- [ ] All settings remain accessible and functional
- [ ] Modal still scrollable if content overflows
- [ ] Buttons (Opslaan/Sluiten) span full width at bottom
