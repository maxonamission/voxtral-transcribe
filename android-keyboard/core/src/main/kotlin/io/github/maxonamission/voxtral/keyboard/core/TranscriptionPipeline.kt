package io.github.maxonamission.voxtral.keyboard.core

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

data class TranscriptionState(
    /** Text emitted by the engine but not yet committed (still subject to revision). */
    val preliminary: String = "",
    /** Last committed sentence/segment — moves to the consumer for insertion. */
    val committed: String = "",
    /** Smoothed input level in [0f, 1f]. */
    val level: Float = 0f,
)

/** Fired once per commit event. Consumers (InputConnection wiring in 031) listen here. */
data class CommitEvent(val text: String)

/**
 * Glues a [VoxtralEngine] to an audio source. Maintains preliminary and
 * committed buffers, exposes them via a StateFlow, and emits CommitEvents
 * when a silence boundary is detected.
 *
 * The pipeline takes a [CoroutineScope] from the caller so the lifecycle
 * matches the surrounding IME service (or test scheduler).
 *
 * @param scope The scope that owns the pipeline's worker coroutines.
 * @param engine A loaded VoxtralEngine implementation (Stub or ExecuTorch).
 * @param audio Flow of 16 kHz mono float32 chunks (typically ~100 ms each).
 * @param level Flow of smoothed input level in [0f, 1f].
 * @param voicingThreshold RMS above which a chunk counts as voiced.
 * @param silenceMillisToCommit Stillness window after which preliminary commits.
 * @param now Pluggable clock — defaults to `System.currentTimeMillis()`,
 *   overridden by tests to drive determinism.
 */
class TranscriptionPipeline(
    private val scope: CoroutineScope,
    private val engine: VoxtralEngine,
    private val audio: Flow<FloatArray>,
    private val level: Flow<Float>,
    private val voicingThreshold: Float = 0.02f,
    private val silenceMillisToCommit: Long = 700L,
    private val now: () -> Long = System::currentTimeMillis,
) {

    private val _state = MutableStateFlow(TranscriptionState())
    val state: StateFlow<TranscriptionState> = _state

    private val _commits = MutableSharedFlow<CommitEvent>(extraBufferCapacity = 8)
    val commits: SharedFlow<CommitEvent> = _commits

    private val jobs = mutableListOf<Job>()
    private var lastVoicedAt: Long = 0L

    fun start() {
        if (jobs.isNotEmpty()) return
        lastVoicedAt = now()
        jobs += scope.launch { collectLevel() }
        jobs += scope.launch { collectAudio() }
        jobs += scope.launch { silenceWatcher() }
    }

    fun stop() {
        jobs.forEach { it.cancel() }
        jobs.clear()
        _state.value = TranscriptionState()
    }

    private suspend fun collectLevel() {
        level.collect { l ->
            _state.update { it.copy(level = l) }
            if (l >= voicingThreshold) lastVoicedAt = now()
        }
    }

    private suspend fun collectAudio() {
        audio.collect { chunk ->
            engine.feedAudio(chunk).collect { delta ->
                _state.update { it.copy(preliminary = it.preliminary + delta.text) }
                if (delta.isFinal) commitPreliminary()
            }
        }
    }

    private suspend fun silenceWatcher() {
        while (currentCoroutineIsActive()) {
            delay(100)
            val current = _state.value
            if (current.preliminary.isNotEmpty() && (now() - lastVoicedAt) >= silenceMillisToCommit) {
                commitPreliminary()
            }
        }
    }

    private fun commitPreliminary() {
        val current = _state.value
        if (current.preliminary.isEmpty()) return
        val text = current.preliminary
        _state.update { it.copy(preliminary = "", committed = text) }
        _commits.tryEmit(CommitEvent(text))
    }

    private suspend fun currentCoroutineIsActive(): Boolean {
        // Helper so the silenceWatcher can exit cleanly when its job is cancelled.
        return kotlin.coroutines.coroutineContext[Job]?.isActive ?: false
    }
}
