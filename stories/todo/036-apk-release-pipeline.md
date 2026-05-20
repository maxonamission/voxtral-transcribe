# Story 036: APK release pipeline + sideload docs

**Epic:** Android Voice Keyboard — Reliability & distribution
**Target:** `android-keyboard/`
**Status:** Backlog
**Priority:** Medium
**Estimate:** Small

## Summary

Lever de Android-IME uit als signed APK via GitHub Releases (zoals de desktop
builds nu in story 004 worden gedaan). Geen Play Store voor v1 — de
onboarding-friction is laag genoeg voor early-testers, en Play Store-policy
rond accessibility en mic-only-keyboards wil ik niet als eerste obstakel.

## Acceptance criteria

- [ ] GitHub Actions workflow `release-android.yml`
- [ ] Signing key in repository secrets (gegenereerd, niet de eigenaarssleutel
  van een ander project)
- [ ] Trigger op tag `android-v*.*.*`
- [ ] Produceert: signed release-APK + checksums + automatically generated changelog
- [ ] Asset published als GitHub Release
- [ ] README in `android-keyboard/` met sideload-instructies:
  - Toestel: Onbekende bronnen toestaan
  - APK installeren
  - Onboarding (zie 025)
- [ ] Versioning sync met host-app versie via een build-script (vergelijkbaar
  met `020-version-bump-automation.md`)

## Proposed approach

1. Kopieer patroon van `004-github-releases-ci.md` (Doing) waar mogelijk
2. APK signing via `signingConfig` in `app/build.gradle.kts` met secrets
   gemount uit GitHub Actions
3. ABI-splits later overwegen — v1 één universele APK

## Open questions

- F-Droid eventueel later? Vereist 100% open-source toolchain en geen prebuilt
  binaries — kan, maar de ExecuTorch-libraries zijn een grijs gebied. Later
  evalueren.
- Play Store later? Mogelijk met betaalde tier of bundeled cloud — past niet
  bij deze offline-only-IME-positionering.

## Dependencies

- Alle voorgaande Android-stories (024–035) — een release vraagt een werkend
  end-to-end product

## References

- Story 004 — GitHub Releases CI voor de desktop builds
- Story 020 — Version bump automation
