package io.github.maxonamission.voxtral.keyboard.core

import kotlin.math.min

/**
 * Word Error Rate utilities — pure math, no platform deps.
 *
 * Used by the on-device benchmark suite (story 035) to score the engine's
 * transcription against ground-truth references.
 */
object Wer {

    /** Tokenise a sentence into lower-cased words, stripping common punctuation. */
    fun tokenize(text: String): List<String> = text
        .lowercase()
        .replace(Regex("[\\p{Punct}]+"), " ")
        .split(Regex("\\s+"))
        .filter { it.isNotBlank() }

    /**
     * Compute word-level edit distance between [reference] and [hypothesis]
     * via the standard Wagner-Fischer dynamic programming algorithm.
     */
    fun editDistance(reference: List<String>, hypothesis: List<String>): Int {
        if (reference.isEmpty()) return hypothesis.size
        if (hypothesis.isEmpty()) return reference.size

        val prev = IntArray(hypothesis.size + 1) { it }
        val curr = IntArray(hypothesis.size + 1)

        for (i in 1..reference.size) {
            curr[0] = i
            for (j in 1..hypothesis.size) {
                val cost = if (reference[i - 1] == hypothesis[j - 1]) 0 else 1
                curr[j] = min(
                    min(curr[j - 1] + 1, prev[j] + 1),
                    prev[j - 1] + cost,
                )
            }
            System.arraycopy(curr, 0, prev, 0, prev.size)
        }
        return prev[hypothesis.size]
    }

    /**
     * Word Error Rate = (substitutions + insertions + deletions) / reference word count.
     *
     * Returns 0.0 for two empty inputs; returns the hypothesis word count when
     * reference is empty (treating it as all-insertion).
     */
    fun wer(reference: String, hypothesis: String): Double {
        val ref = tokenize(reference)
        val hyp = tokenize(hypothesis)
        if (ref.isEmpty()) {
            return if (hyp.isEmpty()) 0.0 else hyp.size.toDouble()
        }
        return editDistance(ref, hyp).toDouble() / ref.size
    }
}
