// Plugins are declared per-module via the version catalog (gradle/libs.versions.toml).
// The Android Gradle Plugin is only loaded by the :app module, so :core can build
// on JVM-only machines without the Android SDK.
