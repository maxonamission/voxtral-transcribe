# Story 030: Backend selection — QNN NPU with CPU fallback

**Epic:** Android Voice Keyboard — On-device inference
**Target:** `android-keyboard/`
**Status:** Done (logic + CI; real NPU activation device-verify)
**Priority:** Medium
**Estimate:** Medium

## Summary

Detecteer of het toestel een Snapdragon SoC met QNN-ondersteuning heeft en
gebruik dan de Qualcomm AI Engine (NPU) backend in ExecuTorch. Val anders terug
op XNNPACK (CPU). Vermijd silent failures — toon altijd in de IME-statusregel
welke backend draait.

## Acceptance criteria

- [x] `BackendDetector.npuAvailable()` met `Build.SOC_MANUFACTURER` (API 31+)
  en `Build.HARDWARE` / `Build.BOARD` fallback voor oudere Android versies
- [x] `BackendResolver` in `:core` met `AUTO / FORCE_NPU / FORCE_CPU` —
  unit-tested in :core (geen Android-deps)
- [x] Engine fallback: `ExecutorchVoxtralEngine` probeert de gevraagde backend
  en valt naar XNNPACK_CPU bij init-fout
- [ ] Settings-screen wisselt tussen Auto/NPU/CPU — komt in 033
- [x] Status-regel toont actuele backend ("NPU"/"CPU") op basis van de
  resolver-uitkomst
- [x] Log-entry per load met backend + load-tijd (ms)
- [x] Geen crash op niet-Snapdragon devices: detector retourneert `false` →
  resolver kiest CPU → engine doet XNNPACK
- [x] `executorch-android-qnn:1.1.0` toegevoegd zodat de QNN delegate op de
  classpath staat wanneer de echte JNI gewired wordt

## Proposed approach

1. Bij `VoxtralEngine.load(...)` probeert engine de aangevraagde backend; vangt
   `ExecuTorchException` op en retried met `XNNPACK_CPU`
2. QNN-libraries via een aparte AAR/dependency; alleen meeleveren als
   build-variant het ondersteunt. Voor v1: één universele build met fallback.
3. Build-flavors later overwegen (apk-size optimization) — niet in deze story

## Open questions

- Hebben we voor v1 één APK of split-APKs per ABI/backend? Eén universele APK,
  download-flow (028) levert al de bulk; binnen-APK overhead van QNN-libs is
  beperkt.
- Vulkan-backend als tussenstap (GPU op niet-Snapdragon)? Buiten scope v1 —
  evaluatie in 035.

## Dependencies

- 027 (engine), 029 (pipeline draait)

## Notes from implementation

- Resolver-logica is **pure-Kotlin** in `:core` → unit-tested (4 tests).
  Detection is in `:app` (gebruikt `android.os.Build`).
- `executorch-android-qnn:1.1.0` is op de classpath maar wordt nog niet
  daadwerkelijk via JNI gebruikt — dat gebeurt zodra de echte ExecuTorch
  module-API werkend is (zie 027).
- `FORCE_NPU` op een niet-NPU device leidt tot een gecontroleerde init-fout
  + fallback naar CPU. We honoreren de voorkeur expliciet zodat de gebruiker
  een duidelijke foutmelding ziet ipv stiekem CPU.
- Status-strip wordt nu in `onCreateInputView` ingesteld; later (033) kan dit
  reactief worden gemaakt wanneer de gebruiker live van backend wisselt.

## References

- ExecuTorch Qualcomm backend — https://docs.pytorch.org/executorch/stable/backends-qualcomm.html
- Story 017 — backend tabel
