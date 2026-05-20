# Story 036: APK release pipeline + sideload docs

**Epic:** Android Voice Keyboard — Reliability & distribution
**Target:** `android-keyboard/`
**Status:** Done (workflow + signing + docs; first tag pending)
**Priority:** Medium
**Estimate:** Small

## Summary

Lever de Android-IME uit als signed APK via GitHub Releases (zoals de desktop
builds nu in story 004 worden gedaan). Geen Play Store voor v1 — de
onboarding-friction is laag genoeg voor early-testers, en Play Store-policy
rond accessibility en mic-only-keyboards wil ik niet als eerste obstakel.

## Acceptance criteria

- [x] `.github/workflows/release-android.yml` met trigger op
  `android-v*.*.*`
- [x] Signing-secrets uit repository secrets:
  `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
  `ANDROID_KEY_PASSWORD`
- [x] Workflow produceert signed `app-release.apk` + `SHA256SUMS` +
  automatisch gegenereerde release notes
- [x] APK + checksums via `softprops/action-gh-release@v2` als GitHub Release
- [x] README in `android-keyboard/` documenteert one-time setup
  (keystore-generatie, secrets) en het uitrollen (`git tag android-vX.Y.Z`)
- [x] Versie wordt uit de tag afgeleid en via `VOXTRAL_VERSION_NAME`
  env-var in `versionName` gezet zonder source-edit
- [ ] **Eerste tag**: de eigenaar van de repo moet keystore aanmaken en
  secrets configureren voordat de eerste release loopt

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

## Notes from implementation

- **Sideload-only voor v1**: geen Play Store / F-Droid. Argument blijft
  hetzelfde — minder reviewfriction, en de minimalistische dicteer-IME
  zonder QWERTY past niet bij Play Store-verwachtingen.
- **Versie uit tag**: workflow extraheert `X.Y.Z` uit `android-vX.Y.Z` en
  set die als env-var; build.gradle.kts leest `VOXTRAL_VERSION_NAME`. Geen
  source-edit per release nodig.
- **Versionscode**: nu hardcoded 1 met optie via `VOXTRAL_VERSION_CODE`. Voor
  Play Store wordt dat later een monotone teller; voor sideload niet kritiek.
- **Keystore-handling**: base64-encoded keystore in een GitHub secret is een
  bekend patroon. Het kost discipline om de originele JKS niet kwijt te raken
  — README waarschuwt expliciet voor dit risico.

## References

- Story 004 — GitHub Releases CI voor de desktop builds
- Story 020 — Version bump automation
- https://github.com/softprops/action-gh-release
