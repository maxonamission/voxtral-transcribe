package io.github.maxonamission.voxtral.keyboard.core

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class AudioLevelTest {

    @Test
    fun silenceIsZero() {
        val samples = ShortArray(160)
        assertEquals(0f, AudioLevel.rmsInt16(samples))
    }

    @Test
    fun fullScaleIsOne() {
        val samples = ShortArray(160) { Short.MAX_VALUE }
        assertEquals(1f, AudioLevel.rmsInt16(samples), 0.001f)
    }

    @Test
    fun emptyArrayIsZero() {
        assertEquals(0f, AudioLevel.rmsInt16(ShortArray(0)))
    }

    @Test
    fun respectsLengthArgument() {
        val samples = ShortArray(160) { if (it < 80) Short.MAX_VALUE else 0 }
        // Only consider the first 80 samples (all max), so RMS should be 1.0
        assertEquals(1f, AudioLevel.rmsInt16(samples, length = 80), 0.001f)
    }

    @Test
    fun smoothMovesTowardsTarget() {
        val s1 = AudioLevel.smooth(previous = 0f, current = 1f, alpha = 0.5f)
        assertEquals(0.5f, s1, 0.001f)
        val s2 = AudioLevel.smooth(previous = s1, current = 1f, alpha = 0.5f)
        assertEquals(0.75f, s2, 0.001f)
        assertTrue(s2 < 1f, "smoothing should never overshoot")
    }
}
