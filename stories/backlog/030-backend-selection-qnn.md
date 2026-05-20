# Story 030: Backend selection — QNN NPU with CPU fallback

**Epic:** Android Voice Keyboard — On-device inference
**Target:** `android-keyboard/`
**Status:** Backlog
**Priority:** Medium
**Estimate:** Medium

## Summary

Detecteer of het toestel een Snapdragon SoC met QNN-ondersteuning heeft en
gebruik dan de Qualcomm AI Engine (NPU) backend in ExecuTorch. Val anders terug
op XNNPACK (CPU). Vermijd silent failures — toon altijd in de IME-statusregel
welke backend draait.

## Acceptance criteria

- [ ] `BackendDetector` met:
  - `fun detect(context): Backend` → `QNN_NPU` of `XNNPACK_CPU`
  - Detectie op basis van `Build.SOC_MANUFACTURER` / `Build.HARDWARE` (Qualcomm)
    en QNN-runtime aanwezig
- [ ] Engine probeert eerst de gedetecteerde backend; bij init-fout fallback naar CPU
- [ ] Setting "Backend" in 033: Auto / Force NPU / Force CPU
- [ ] Status-regel in IME toont actieve backend ("NPU" / "CPU")
- [ ] Log-entry bij elke load met backend + load-tijd
- [ ] Geen crash op niet-Snapdragon devices

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

## References

- ExecuTorch Qualcomm backend — https://docs.pytorch.org/executorch/stable/backends-qualcomm.html
- Story 017 — backend tabel
