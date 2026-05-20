package io.github.maxonamission.voxtral.keyboard.core

import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class StubVoxtralEngineTest {

    @Test
    fun startsUnloaded() {
        val engine = StubVoxtralEngine()
        assertFalse(engine.isLoaded)
    }

    @Test
    fun loadMakesItUsable() = runTest {
        val engine = StubVoxtralEngine()
        val event = engine.load("dummy.pte", VoxtralBackend.XNNPACK_CPU)
        assertTrue(event is EngineEvent.Loaded)
        assertEquals(VoxtralBackend.XNNPACK_CPU, (event as EngineEvent.Loaded).backend)
        assertTrue(engine.isLoaded)
    }

    @Test
    fun feedAudioEmitsDeltas() = runTest {
        val engine = StubVoxtralEngine(script = "hallo wereld ")
        engine.load("dummy.pte", VoxtralBackend.XNNPACK_CPU)
        // 16000 samples = ~1 s of audio → 10 chunks of 1600
        val chunk = FloatArray(16_000)
        val deltas = engine.feedAudio(chunk).toList()
        assertTrue(deltas.isNotEmpty())
        val joined = deltas.joinToString("") { it.text }
        assertTrue(joined.contains("hallo") || joined.contains("wereld"))
    }

    @Test
    fun feedAudioWithoutLoadEmitsNothing() = runTest {
        val engine = StubVoxtralEngine()
        val deltas = engine.feedAudio(FloatArray(16_000)).toList()
        assertTrue(deltas.isEmpty())
    }

    @Test
    fun unloadResetsState() = runTest {
        val engine = StubVoxtralEngine()
        engine.load("dummy.pte", VoxtralBackend.XNNPACK_CPU)
        engine.unload()
        assertFalse(engine.isLoaded)
    }
}
