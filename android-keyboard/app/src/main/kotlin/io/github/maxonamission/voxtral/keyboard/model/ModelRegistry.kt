package io.github.maxonamission.voxtral.keyboard.model

import io.github.maxonamission.voxtral.keyboard.core.ModelManifest

/**
 * Pinned model artefact for this app version. Updating the model = new app
 * release with a new manifest entry (and a new SHA256).
 *
 * The URL/SHA below are placeholders until story 036 (release pipeline)
 * publishes the ExecuTorch artefact for Voxtral Mini 3B Realtime.
 */
object ModelRegistry {
    val voxtralMini3BRealtime = ModelManifest(
        id = "voxtral-mini-3b-realtime",
        displayName = "Voxtral Mini 3B Realtime",
        url = "https://github.com/maxonamission/voxtral-transcribe/releases/download/model-v1/voxtral-mini-3b-realtime.pte",
        // Placeholder size (~1.8 GB int4). Update with the real artefact size in story 036.
        sizeBytes = 1_800_000_000L,
        // Placeholder SHA256. Replace with the real artefact hash in story 036.
        sha256 = "0000000000000000000000000000000000000000000000000000000000000000",
        fileName = "voxtral-mini-3b-realtime.pte",
    )

    val active: ModelManifest get() = voxtralMini3BRealtime
}
