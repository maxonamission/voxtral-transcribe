# Voxtral Voice — Android Keyboard

Offline Android voice keyboard (Input Method Editor) for on-device Voxtral
transcription. See [`../stories/android-keyboard-plan.md`](../stories/android-keyboard-plan.md)
for the full plan.

> **Status**: scaffold (story 024). No transcription yet — placeholder keyboard
> with a smoke-test button that inserts the literal text `voxtral`.

## Modules

- **`:app`** — Android IME application. Requires the Android SDK to build.
- **`:core`** — Pure Kotlin/JVM library (no Android dependencies). Will house
  the voice-command matcher and other framework-independent logic.

The `:app` module is **only included** when an Android SDK is detected
(`ANDROID_HOME` / `ANDROID_SDK_ROOT` env var) or when
`VOXTRAL_INCLUDE_APP=true` is set. This lets `:core` be built on JVM-only
machines (CI shards, sandboxed environments).

## Requirements

- JDK 17 (also works with JDK 21)
- Android SDK with platform `android-35` and build-tools `35.0.0` (only for `:app`)

## Build & test

```bash
# :core only (no Android SDK needed)
./gradlew :core:test

# Full debug APK
export VOXTRAL_INCLUDE_APP=true    # or set ANDROID_HOME
./gradlew :app:assembleDebug
# → app/build/outputs/apk/debug/app-debug.apk
```

## Install & try (sideload)

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Then on the device:

1. **Instellingen → Toetsenborden** → enable **Voxtral Voice**
2. Open any text field → tap the keyboard switcher (globe icon) → pick
   **Voxtral Voice**
3. Tap the **Insert "voxtral"** button — the literal text `voxtral` should
   appear in the field.

This proves the IME is registered, visible in the picker, and that
`InputConnection.commitText` works. Real transcription comes in stories 027–029.

## Layout

```
android-keyboard/
├── app/                                    # Android IME application
│   └── src/main/
│       ├── AndroidManifest.xml             # IME service declaration
│       ├── kotlin/io/.../ime/
│       │   └── KeyboardService.kt          # InputMethodService entry point
│       └── res/
│           ├── layout/keyboard_view.xml    # Placeholder IME view
│           ├── values/{strings,themes}.xml
│           └── xml/method.xml              # IME subtype declaration
├── core/                                   # Pure Kotlin/JVM library
│   └── src/main/kotlin/io/.../core/
│       └── Voxtral.kt                      # Placeholder
├── gradle/
│   ├── libs.versions.toml                  # Version catalog
│   └── wrapper/
├── settings.gradle.kts                     # Conditional :app inclusion
└── build.gradle.kts                        # Empty root (plugins per-module)
```

## Package name

`io.github.maxonamission.voxtral.keyboard` — reverse-domain to the GitHub owner
of this repo. Not tied to any trademark.

## Naming note

The product label is currently **Voxtral Voice**. Voxtral is a Mistral
trademark, so this name is provisional — if the model is ever swapped, or
trademark concerns arise, the label and `applicationId` will need to change.
The reverse-domain package name above stays stable.

## CI

See [`.github/workflows/android-ci.yml`](../.github/workflows/android-ci.yml).
Two jobs: `:core` (JVM only) and `:app` (full APK, uploads as artifact).
