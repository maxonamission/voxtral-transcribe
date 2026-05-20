# Story 024: Android IME scaffold in monorepo

**Epic:** Android Voice Keyboard — Foundation
**Target:** `android-keyboard/` (new)
**Status:** Backlog
**Priority:** High
**Estimate:** Medium

## Summary

Zet een nieuwe Gradle-module `android-keyboard/` op met een minimale IME die in
Android's keyboard-picker verschijnt en een placeholder-view toont. Geen mic,
geen audio, geen transcriptie — alleen de skeleton waarop de rest bouwt.

## Acceptance criteria

- [ ] `android-keyboard/` map met Gradle (Kotlin DSL), `app` module en `core` module
- [ ] `AndroidManifest.xml` registreert een `InputMethodService` met
  `BIND_INPUT_METHOD` permissie en `<input-method>` resource (`res/xml/method.xml`)
- [ ] Debug-APK bouwt met `./gradlew :app:assembleDebug`
- [ ] APK geïnstalleerd → "Voxtral" verschijnt in Instellingen → Toetsenborden
- [ ] Bij activatie toont de IME een lege view met "Voxtral" tekst (placeholder)
- [ ] `commitText("voxtral")` op een hardcoded knop werkt in een testveld
- [ ] README in `android-keyboard/` met build-instructies
- [ ] CI: minimaal een `./gradlew :app:assembleDebug` smoke build (geen Play Store sign nodig)

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

## References

- Android IME basics — https://developer.android.com/develop/ui/views/touch-and-input/creating-input-method
- Gradle Kotlin DSL — https://docs.gradle.org/current/userguide/kotlin_dsl.html
