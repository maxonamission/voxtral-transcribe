package io.github.maxonamission.voxtral.keyboard.core

import kotlinx.coroutines.flow.Flow

enum class VoxtralBackend { XNNPACK_CPU, QNN_NPU }

data class TextDelta(val text: String, val isFinal: Boolean = false)

sealed interface EngineEvent {
    data class Loaded(val backend: VoxtralBackend) : EngineEvent
    data class Failed(val reason: String) : EngineEvent
    data object Unloaded : EngineEvent
}

/**
 * Streaming transcription engine — backend-agnostic.
 *
 * Implementations:
 *  - StubVoxtralEngine (:core) — mock deltas for tests and developer bring-up.
 *  - ExecutorchVoxtralEngine (:app) — real on-device Voxtral via ExecuTorch.
 */
interface VoxtralEngine {

    /** Load the model from [modelPath] on the requested [backend]. */
    suspend fun load(modelPath: String, backend: VoxtralBackend): EngineEvent

    /**
     * Feed a chunk of 16 kHz mono float32 PCM (range [-1, 1]).
     * Returns a flow of text deltas as decoding progresses.
     *
     * Multiple feeds are concatenated into the same stream — the caller is
     * responsible for chunk pacing.
     */
    fun feedAudio(chunk: FloatArray): Flow<TextDelta>

    /** Release model resources. Engine becomes unusable until [load] again. */
    suspend fun unload()

    /** True between load() success and unload(). */
    val isLoaded: Boolean
}
