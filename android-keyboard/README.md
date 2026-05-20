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

Then on the device, open the **Voxtral Voice** app from the launcher — the
onboarding screen walks through three steps:

1. **Activeer Voxtral Voice in Instellingen** (opens system IME settings)
2. **Kies Voxtral Voice als toetsenbord** (shows the input method picker)
3. **Geef toegang tot de microfoon** (requests `RECORD_AUDIO`)

Each step shows a check mark when complete. When all three are done a test
text field appears so you can try the IME — the **Insert "voxtral"** button
in the keyboard inserts a placeholder. Real transcription comes in stories
027–029.

## Layout

```
android-keyboard/
├── app/                                    # Android IME application
│   └── src/main/
│       ├── AndroidManifest.xml             # IME service + launcher activity
│       ├── kotlin/io/.../
│       │   ├── ime/KeyboardService.kt      # InputMethodService entry point
│       │   └── onboarding/
│       │       ├── IMEStatus.kt            # Android-side status helpers
│       │       └── MainActivity.kt         # Compose onboarding screen
│       └── res/
│           ├── layout/keyboard_view.xml    # Placeholder IME view
│           ├── values/{strings,themes}.xml
│           └── xml/method.xml              # IME subtype declaration
├── core/                                   # Pure Kotlin/JVM library
│   └── src/main/kotlin/io/.../core/
│       ├── Voxtral.kt                      # Placeholder constants
│       └── Onboarding.kt                   # Step state machine (testable)
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

## Releasing

Signed release builds are produced by [`.github/workflows/release-android.yml`](../.github/workflows/release-android.yml)
when a tag matching `android-v*.*.*` is pushed.

### One-time setup (repository owner)

1. Generate a release keystore locally:

   ```bash
   keytool -genkeypair -v -keystore release.jks -keyalg RSA -keysize 2048 \
     -validity 10000 -alias voxtral
   ```

2. Base64-encode it and add the following repository secrets:

   | Secret | Value |
   |---|---|
   | `ANDROID_KEYSTORE_BASE64` | `base64 -w0 release.jks` |
   | `ANDROID_KEYSTORE_PASSWORD` | keystore password |
   | `ANDROID_KEY_ALIAS` | `voxtral` (or your alias) |
   | `ANDROID_KEY_PASSWORD` | key password |

   Keep the original `release.jks` somewhere safe (a password manager works).
   **Losing it means future updates can't be signed by the same key — Android
   refuses installs of differently-signed updates.**

### Cutting a release

```bash
git tag android-v0.1.0
git push origin android-v0.1.0
```

The workflow assembles `:app:assembleRelease`, signs the APK, generates
`SHA256SUMS`, and publishes a GitHub Release with the artefacts.

> No Play Store / F-Droid for v1 — distribution is sideload only. Users
> must enable "Install unknown apps" for whatever app they install the APK
> from (usually their browser or a file manager).
