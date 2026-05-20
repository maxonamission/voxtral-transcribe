# Story 034: Battery & thermal management

**Epic:** Android Voice Keyboard — Reliability & distribution
**Target:** `android-keyboard/`
**Status:** Backlog
**Priority:** Medium
**Estimate:** Medium

## Summary

Een LLM-engine in een toetsenbord die voortdurend warm staat eet de batterij en
laat de SoC throttlen. Bouw lifecycle-regels die het model warm houden tijdens
actief gebruik, snel unloaden bij idle, en gracieus reageren op thermal
warnings.

## Acceptance criteria

- [ ] Model `load` happens lazy: pas wanneer IME visible wordt en mic geactiveerd
- [ ] Model blijft warm zolang IME visible is + N seconden na laatste mic-stop (default 30 s)
- [ ] Bij `onFinishInput` + idle timeout → `unload`
- [ ] `PowerManager.OnThermalStatusChangedListener`: bij `THERMAL_STATUS_SEVERE`
  → unload model, toon status "te warm — even afkoelen"
- [ ] Bij batterij `< 15%` zonder lader: model laad nog wel maar UI waarschuwt
  ("Voxtral op lage batterij — overweeg later te dicteren")
- [ ] Battery-stats meten in 035

## Proposed approach

1. `EngineLifecycleManager` met state machine: `unloaded → loading → ready →
   active → cooling → unloaded`
2. Observeer thermal status via `ContextCompat.getSystemService(PowerManager)`
3. Geen `ForegroundService` voor v1 — IME zelf houdt het model in proces

## Open questions

- Moet de IME na schermlock alle resources vrijgeven? Ja — `onWindowHidden` →
  start unload-timer.
- Wanneer is een ForegroundService nodig? Pas als we ergens audio willen
  doorverwerken nadat de IME niet zichtbaar meer is. Voor v1 niet nodig.

## Dependencies

- 027 (engine met `unload`-API), 029 (pipeline)

## References

- https://developer.android.com/reference/android/os/PowerManager#getCurrentThermalStatus()
