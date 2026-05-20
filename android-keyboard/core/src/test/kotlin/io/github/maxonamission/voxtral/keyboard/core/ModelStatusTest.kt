package io.github.maxonamission.voxtral.keyboard.core

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test

class ModelStatusTest {

    @Test
    fun percentRoundsDown() {
        val s = ModelStatus.Downloading(bytesDownloaded = 333, totalBytes = 1000, bytesPerSecond = 0)
        assertEquals(33, s.percent)
    }

    @Test
    fun percentClampsAtZeroWithEmptyTotal() {
        val s = ModelStatus.Downloading(bytesDownloaded = 0, totalBytes = 0, bytesPerSecond = 0)
        assertEquals(0, s.percent)
    }

    @Test
    fun secondsRemainingIsNullWhenSpeedUnknown() {
        val s = ModelStatus.Downloading(bytesDownloaded = 0, totalBytes = 1_000_000, bytesPerSecond = 0)
        assertNull(s.secondsRemaining)
    }

    @Test
    fun secondsRemainingFromSpeed() {
        val s = ModelStatus.Downloading(
            bytesDownloaded = 500_000,
            totalBytes = 1_500_000,
            bytesPerSecond = 100_000,
        )
        // 1_000_000 left at 100_000/s = 10 s
        assertEquals(10L, s.secondsRemaining)
    }
}
