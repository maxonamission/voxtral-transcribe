package io.github.maxonamission.voxtral.keyboard.core

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.consumeAsFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.take
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/**
 * Real wall-clock tests — the pipeline's silenceWatcher uses real time
 * via the caller's dispatcher and we exercise the full coroutine plumbing.
 * Audio source is a Channel so emissions buffer until the pipeline's
 * collector subscribes (avoids a startup race).
 */
class TranscriptionPipelineTest {

    @Test
    fun preliminaryAccumulatesFromEngineDeltas() = runBlocking {
        val engine = StubVoxtralEngine(script = "een twee drie ")
        engine.load("dummy.pte", VoxtralBackend.XNNPACK_CPU)
        val audio = Channel<FloatArray>(Channel.UNLIMITED)
        val level = MutableStateFlow(0.5f)
        val pipelineScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
        var clock = 0L
        val pipeline = TranscriptionPipeline(
            scope = pipelineScope,
            engine = engine,
            audio = audio.consumeAsFlow(),
            level = level,
            silenceMillisToCommit = 10_000L,
            now = { clock },
        )
        pipeline.start()
        try {
            audio.send(FloatArray(16_000))
            withTimeout(3_000) {
                pipeline.state.first { it.preliminary.contains("een") }
            }
        } finally {
            pipelineScope.cancel()
        }
    }

    @Test
    fun silenceCommitsPreliminary() = runBlocking {
        val engine = StubVoxtralEngine(script = "hallo wereld ")
        engine.load("dummy.pte", VoxtralBackend.XNNPACK_CPU)
        val audio = Channel<FloatArray>(Channel.UNLIMITED)
        val level = MutableStateFlow(0.5f)
        val pipelineScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
        var clock = 0L
        val pipeline = TranscriptionPipeline(
            scope = pipelineScope,
            engine = engine,
            audio = audio.consumeAsFlow(),
            level = level,
            silenceMillisToCommit = 500L,
            now = { clock },
        )
        pipeline.start()
        try {
            audio.send(FloatArray(3_200))
            withTimeout(3_000) {
                pipeline.state.first { it.preliminary.isNotEmpty() }
            }
            level.value = 0.0f
            clock = 5_000L
            val commit = withTimeout(3_000) {
                pipeline.commits.take(1).toList().first()
            }
            assertTrue(commit.text.isNotEmpty(), "commit text should not be empty")
            assertEquals("", pipeline.state.value.preliminary)
        } finally {
            pipelineScope.cancel()
        }
    }

    @Test
    fun stopResetsState() = runBlocking {
        val engine = StubVoxtralEngine()
        engine.load("dummy.pte", VoxtralBackend.XNNPACK_CPU)
        val audio = Channel<FloatArray>(Channel.UNLIMITED)
        val level = MutableStateFlow(0.5f)
        val pipelineScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
        val pipeline = TranscriptionPipeline(
            scope = pipelineScope,
            engine = engine,
            audio = audio.consumeAsFlow(),
            level = level,
            silenceMillisToCommit = 10_000L,
        )
        pipeline.start()
        try {
            audio.send(FloatArray(3_200))
            withTimeout(3_000) { pipeline.state.first { it.preliminary.isNotEmpty() } }
            pipeline.stop()
            assertEquals("", pipeline.state.value.preliminary)
            assertEquals("", pipeline.state.value.committed)
            assertEquals(0f, pipeline.state.value.level)
        } finally {
            pipelineScope.cancel()
        }
    }
}
