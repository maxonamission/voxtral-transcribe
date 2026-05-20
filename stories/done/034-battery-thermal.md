# Story 034: Battery & thermal management

**Epic:** Android Voice Keyboard — Reliability & distribution
**Target:** `android-keyboard/`
**Status:** Done (thermal + battery policies; idle-unload timer deferred to real-engine bring-up)
**Priority:** Medium
**Estimate:** Medium

## Summary

Een LLM-engine in een toetsenbord die voortdurend warm staat eet de batterij en
laat de SoC throttlen. Bouw lifecycle-regels die het model warm houden tijdens
actief gebruik, snel unloaden bij idle, en gracieus reageren op thermal
warnings.

## Acceptance criteria

- [ ] Lazy model load + 30 s warm-keep + idle-unload — **deferred**: pas
  zinvol wanneer de ExecuTorch-engine echt een model in geheugen houdt.
  StubVoxtralEngine heeft geen significante load-cost. Implementatie in
  KeyboardService is straightforward zodra 027 device-verified is.
- [x] `PowerManager.OnThermalStatusChangedListener` (API 29+) via
  `ThermalMonitor` in `:app`, gemapt op de deps-vrije `ThermalLevel` en
  `ThermalPolicy` in `:core`. Bij `SEVERE` of hoger: pipeline/audio stop,
  engine unload, candidate strip toont "Toestel is warm — Voxtral gepauzeerd".
  `toggleMic()` weigert te starten zolang thermal severe is.
- [x] `BatteryPolicy.shouldWarnLowBattery(percent, isCharging)` in `:core`
  met unit tests; `BatteryMonitor` in `:app` met `BatteryManager` voor
  percent + charging. Waarschuwing in candidate strip wanneer onder 15% en
  niet aan de lader.
- [ ] Battery-stats meten — komt in 035 (benchmark suite)

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

## Notes from implementation

- **Pure policies in `:core`** (`ThermalPolicy.shouldUnload`,
  `BatteryPolicy.shouldWarnLowBattery`) — 3 unit tests dekken de
  drempelwaarden. Android-side is een dunne brug.
- **Idle-unload timer is bewust uitgesteld**. De Stub-engine heeft nauwelijks
  geheugen of compute. Bij echte ExecuTorch (~1.8 GB resident) wordt
  unloaden na N seconden cruciaal — dat doe ik wanneer 027 device-verified
  is, zodat ik tegelijk kan meten wat de juiste N is.
- **Critical thermal**: bij CRITICAL/EMERGENCY/SHUTDOWN gedragen we ons net
  als SEVERE — er valt voor ons niets wezenlijks meer te doen.

## References

- https://developer.android.com/reference/android/os/PowerManager#getCurrentThermalStatus()
- https://developer.android.com/reference/android/os/BatteryManager
