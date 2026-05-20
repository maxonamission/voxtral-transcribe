pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "voxtral-voice-keyboard"
include(":core")

// The :app module is only included when an Android SDK is available. This lets
// :core be built and tested on JVM-only machines (CI without Android SDK,
// sandboxed environments). Set VOXTRAL_INCLUDE_APP=true or ensure
// ANDROID_HOME is set to include the Android app module.
val androidSdkAvailable = providers.environmentVariable("ANDROID_HOME").isPresent ||
    providers.environmentVariable("ANDROID_SDK_ROOT").isPresent ||
    providers.environmentVariable("VOXTRAL_INCLUDE_APP").orNull == "true"

if (androidSdkAvailable) {
    include(":app")
}
