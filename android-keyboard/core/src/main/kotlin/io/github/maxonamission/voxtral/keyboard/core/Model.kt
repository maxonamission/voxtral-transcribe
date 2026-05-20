package io.github.maxonamission.voxtral.keyboard.core

/**
 * Description of a downloadable model artefact. Stored as a compile-time
 * constant so the SHA256 is part of the signed APK and can't be swapped.
 */
data class ModelManifest(
    val id: String,
    val displayName: String,
    val url: String,
    val sizeBytes: Long,
    val sha256: String,
    val fileName: String,
)

sealed interface ModelStatus {
    data object NotDownloaded : ModelStatus
    data class Downloading(
        val bytesDownloaded: Long,
        val totalBytes: Long,
        val bytesPerSecond: Long,
    ) : ModelStatus {
        val percent: Int get() =
            if (totalBytes > 0) ((bytesDownloaded * 100) / totalBytes).toInt() else 0
        val secondsRemaining: Long? get() {
            if (bytesPerSecond <= 0) return null
            val left = totalBytes - bytesDownloaded
            if (left <= 0) return 0
            return left / bytesPerSecond
        }
    }
    data object Verifying : ModelStatus
    data object Ready : ModelStatus
    data class Failed(val reason: String) : ModelStatus
}
