package io.github.maxonamission.voxtral.keyboard.core

import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

/**
 * Mock engine that emits scripted text deltas — used in tests and as the
 * default engine until ExecuTorch wiring is verified on device.
 *
 * Each feedAudio call emits the next chunk of [script], roughly proportional
 * to the audio chunk's length, so streaming pipelines (story 029) can be
 * exercised without a real model.
 */
class StubVoxtralEngine(
    private val script: String = "dit is een teststring uit de stub engine. ",
) : VoxtralEngine {

    @Volatile private var loaded = false
    @Volatile private var emittedChars = 0

    override val isLoaded: Boolean get() = loaded

    override suspend fun load(modelPath: String, backend: VoxtralBackend): EngineEvent {
        delay(50) // simulate a tiny warm-up
        loaded = true
        emittedChars = 0
        return EngineEvent.Loaded(backend)
    }

    override fun feedAudio(chunk: FloatArray): Flow<TextDelta> = flow {
        if (!loaded) return@flow
        // One "word" per ~100 ms of audio (16 kHz mono → 1600 samples per 100 ms)
        val wordsToEmit = (chunk.size / 1600).coerceAtLeast(1)
        repeat(wordsToEmit) {
            val nextSpace = script.indexOf(' ', startIndex = emittedChars + 1).let {
                if (it < 0) script.length else it + 1
            }
            val piece = script.substring(emittedChars, nextSpace.coerceAtMost(script.length))
            if (piece.isEmpty()) {
                emittedChars = 0
                return@repeat
            }
            emittedChars += piece.length
            if (emittedChars >= script.length) emittedChars = 0
            delay(40)
            emit(TextDelta(piece, isFinal = false))
        }
    }

    override suspend fun unload() {
        loaded = false
        emittedChars = 0
    }
}
