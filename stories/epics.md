# Epics & Stories

> **Scope note:** This repository contains two targets: the **Obsidian plugin** (`obsidian-plugin/`) and the **standalone webapp** (`static/` + `server.py`). Each story specifies which target it applies to. Learnings from one target may inform the other, but changes should only be made in the target specified by the story.

---

## Epic: Code Quality & Maintainability (Obsidian plugin)

Improve the Obsidian plugin's codebase structure, testability and long-term maintainability. Originated from code review (March 2025).

| # | Story | Status | Priority |
|---|-------|--------|----------|
| 010 | [Split main.ts into focused modules](backlog/010-split-main-ts.md) | Backlog | High |
| 011 | [Isolate and document dual-delay mode](backlog/011-isolate-dual-delay.md) | Backlog | High |
| 012 | [Add test suite for command matching and hallucination detection](done/012-test-command-matching.md) | Done | High |
| 013 | [Abstract WebSocket upgrade mechanism](backlog/013-websocket-upgrade-abstraction.md) | Backlog | Medium |
| 014 | [Add versioned settings migration](done/014-settings-migration.md) | Done | Medium |
| 015 | [Extract language definitions to data format](backlog/015-lang-data-extraction.md) | Backlog | Low |
| 016 | [Privacy documentation and log redaction](backlog/016-privacy-logging-docs.md) | Backlog | Medium |

### Dependencies within this epic

```
010 (split main.ts)
 ├── 011 (dual-delay isolation)  — much easier after 010, but can be done standalone
 ├── 013 (WebSocket abstraction) — much easier after 010, but can be done standalone
 └── unblocks future refactors

012 (tests)          — independent, no dependency on 010
014 (settings migration) — independent
015 (lang data)      — independent
016 (privacy/docs)   — independent
```

### Recommended execution order

1. **012** first — adds a safety net before any refactoring
2. **010** — the big refactor, now protected by tests
3. **011** + **013** — extraction stories that benefit from modular main.ts
4. **014** + **016** — low-risk, can be done anytime
5. **015** — lowest priority, nice-to-have

---

## Epic: UX & Responsiveness

Improve the user experience across different screen sizes, devices, and input methods.

| # | Story | Status | Priority |
|---|-------|--------|----------|
| 001 | [Settings modal not scrollable on small screens](done/001-settings-modal-scroll.md) | Done | High |
| 005 | [Settings modal two-column landscape layout](backlog/005-settings-two-column-layout.md) | Backlog | Low |

## Epic: Internationalization

Make the app fully usable in all 13 supported languages.

| # | Story | Status | Priority |
|---|-------|--------|----------|
| 002 | [Full i18n — translate all UI strings to 13 languages](backlog/002-full-i18n.md) | Backlog | Medium |

## Epic: Audio Quality

Improve audio capture quality in challenging environments.

| # | Story | Status | Priority |
|---|-------|--------|----------|
| 003 | [Advanced noise suppression with RNNoise WASM](backlog/003-rnnoise-wasm.md) | Backlog | Medium |

## Epic: Distribution

Make the app easy to download and run for testers and users.

| # | Story | Status | Priority |
|---|-------|--------|----------|
| 004 | [Automated GitHub Releases with cross-platform builds](doing/004-github-releases-ci.md) | Doing | High |

## Epic: Pipeline Simplification

Evaluate whether processing steps can be simplified or removed without losing essential functionality.

| # | Story | Status | Priority |
|---|-------|--------|----------|
| 009 | [Evaluate and potentially remove LLM text correction](backlog/009-evaluate-llm-correction-removal.md) | Backlog | Medium |

## Epic: Custom Commands & Extensibility

Allow users to define their own voice commands, mishearing corrections, and dynamic actions — making the plugin adaptable to any workflow or language.

| # | Story | Status | Priority |
|---|-------|--------|----------|
| 006 | [Custom voice commands — learning mode](backlog/006-custom-voice-commands.md) | Backlog | Medium |
| 007 | [User-defined mishearing corrections](backlog/007-custom-mishearings.md) | Backlog | Medium |
| 008 | [Dynamic content actions & Templater integration](backlog/008-dynamic-actions-templater.md) | Backlog | Low |

---

## Parallellisatie-advies: meerdere Claude Code sessies naast elkaar

### Kan het?

Ja, **mits** je stories kiest die geen overlappende bestanden raken. Nee als je twee sessies tegelijk aan `main.ts` laat werken — dat levert gegarandeerd merge-conflicten op.

### Veilige combinaties (geen file-overlap)

| Sessie A | Sessie B | Conflict-risico |
|----------|----------|-----------------|
| 012 (tests toevoegen) | 016 (privacy docs) | **Geen** — nieuwe bestanden vs README/help-view |
| 012 (tests toevoegen) | 014 (settings migration) | **Geen** — test files vs types.ts + nieuw bestand |
| 012 (tests toevoegen) | 015 (lang data extractie) | **Laag** — tests lezen lang.ts, extractie herschrijft het. Doe 015 eerst of stel tests af op de nieuwe structuur |

### Onveilige combinaties (niet doen)

| Sessie A | Sessie B | Probleem |
|----------|----------|----------|
| 010 (split main.ts) | 011 (dual-delay) | Beide raken main.ts fundamenteel |
| 010 (split main.ts) | 013 (WebSocket) | Beide raken mistral-api.ts / main.ts |
| 010 (split main.ts) | enige andere code-story | 010 raakt vrijwel alle bestanden |
| Obsidian plugin story | Webapp story die dezelfde logica deelt | Risico op verkeerde target |

### Vuistregels

1. **Story 010 altijd solo** — het is een repo-brede refactor, nooit combineren met andere code-stories
2. **Tests (012) zijn de veiligste parallelle taak** — ze voegen alleen nieuwe bestanden toe
3. **Documentatie-stories (016) zijn altijd veilig** naast code-stories
4. **Gebruik feature branches per story** — `feature/012-tests`, `feature/014-migration`, etc. Merge via PR, niet direct naar main
5. **Bij twijfel: niet parallel** — de tijdswinst weegt niet op tegen merge-conflict-herstel en regressierisico
6. **Webapp en plugin apart houden** — een sessie werkt aan `obsidian-plugin/` óf aan `static/` + `server.py`, nooit aan beide tegelijk

### Aanbeveling

Start met **012 (tests)** als eerste parallelle sessie naast je huidige werk. Dit is de enige story die puur additief is (nieuwe bestanden, geen bestaande code gewijzigd) en tegelijkertijd de meeste waarde toevoegt als vangnet voor toekomstige refactors.
