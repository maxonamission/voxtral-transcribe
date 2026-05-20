package io.github.maxonamission.voxtral.keyboard.core

import kotlin.math.min
import kotlin.math.sqrt

/**
 * Audio level utilities — pure math, no Android deps.
 */
object AudioLevel {

    /**
     * Root-mean-square of 16-bit PCM samples, normalised to [0f, 1f].
     */
    fun rmsInt16(samples: ShortArray, length: Int = samples.size): Float {
        if (length <= 0) return 0f
        var sumSquares = 0.0
        for (i in 0 until length) {
            val v = samples[i].toDouble()
            sumSquares += v * v
        }
        val rms = sqrt(sumSquares / length)
        // 32767 is the max amplitude of a signed 16-bit sample.
        return min(1f, (rms / 32767.0).toFloat())
    }

    /**
     * Apply gentle exponential smoothing — useful for UI bars that would
     * otherwise jitter on every frame.
     */
    fun smooth(previous: Float, current: Float, alpha: Float = 0.3f): Float {
        return previous + alpha * (current - previous)
    }
}
