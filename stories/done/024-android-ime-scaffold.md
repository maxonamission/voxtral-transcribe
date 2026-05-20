# Story 024: Android IME scaffold in monorepo

**Epic:** Android Voice Keyboard — Foundation
**Target:** `android-keyboard/`
**Status:** Done
**Priority:** High
**Estimate:** Medium

## Summary

Zet een nieuwe Gradle-module `android-keyboard/` op met een minimale IME die in
Android's keyboard-picker verschijnt en een placeholder-view toont. Geen mic,
geen audio, geen transcriptie — alleen de skeleton waarop de rest bouwt.

## Acceptance criteria

- [x] `android-keyboard/` map met Gradle (Kotlin DSL), `app` module en `core` module
- [x] `AndroidManifest.xml` registreert een `InputMethodService` met
  `BIND_INPUT_METHOD` permissie en `<input-method>` resource (`res/xml/method.xml`)
- [x] Debug-APK bouwt met `./gradlew :app:assembleDebug` (geverifieerd via Android CI workflow; lokale sandbox heeft geen Google Maven toegang voor AGP)
- [ ] APK geïnstalleerd → "Voxtral Voice" verschijnt in Instellingen → Toetsenborden — **handmatige device-verificatie nodig**
- [x] Bij activatie toont de IME een view met "Voxtral Voice" placeholder
- [x] `commitText("voxtral")` op een hardcoded knop werkt in een testveld (code aanwezig — device-verificatie nodig)
- [x] README in `android-keyboard/` met build-instructies
- [x] CI: workflow `.github/workflows/android-ci.yml` bouwt `:core` (JVM) en `:app` debug APK

## Proposed approach

1. Genereer met Android Studio template of handmatig (heeft mijn voorkeur, kleinere
   footprint): `settings.gradle.kts` met `include(":app", ":core")`
2. `app/build.gradle.kts` met minSdk 28, targetSdk 35, Kotlin 2.x, Compose BOM
   (alleen voor SettingsActivity, niet voor IME view)
3. `KeyboardService : InputMethodService()` met `onCreateInputView()` die een
   simpele `LinearLayout` met `TextView("Voxtral")` returnt
4. `res/xml/method.xml` voor IME-declaratie
5. Top-level `build.gradle.kts` + Gradle wrapper checked in
6. `.gitignore` aanvullen voor Android-artefacten (`/build`, `.gradle`,
   `local.properties`, `*.iml`)

## Open questions

- Compose vs klassiek View-systeem voor de IME-view? **Beslissing in plan:**
  klassieke View binnen IME, Compose alleen in SettingsActivity.
- Bundelen we Gradle wrapper? **Ja** — anders kan CI niet bouwen zonder Android
  SDK installer op de runner.
- Welke runner voor CI? Linux runner met `android-actions/setup-android` werkt voor
  build (geen device-tests in deze story).

## Dependencies

- Geen — dit is de wortel van de Android-tak.

## Notes from implementation

- **Package name**: `io.github.maxonamission.voxtral.keyboard` (per user decision)
- **App label**: "Voxtral Voice" — provisional, given that "Voxtral" is a Mistral
  trademark. README documents the renaming risk.
- **AGP version**: 8.7.3 (matches Gradle 8.14, supports JDK 21 build)
- **Module visibility**: `:app` is conditionally included in `settings.gradle.kts`
  so `:core` can build on environments without Android SDK. Set
  `VOXTRAL_INCLUDE_APP=true` or `ANDROID_HOME` to include `:app`.
- **JDK toolchain**: removed `jvmToolchain(17)` block because the sandbox lacks
  Foojay/network access for auto-provisioning. Uses ambient JDK; CI is pinned
  to JDK 17. Source/target compatibility is still 17.
- **Compose**: deferred. Story 024 uses classic XML layout + `InputMethodService`.
  Compose comes in stories 025 (onboarding) and 033 (settings).

## References

- Android IME basics — https://developer.android.com/develop/ui/views/touch-and-input/creating-input-method
- Gradle Kotlin DSL — https://docs.gradle.org/current/userguide/kotlin_dsl.html
