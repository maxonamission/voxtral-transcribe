package io.github.maxonamission.voxtral.keyboard.core

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class WerTest {

    @Test
    fun identicalIsZero() {
        assertEquals(0.0, Wer.wer("hallo wereld", "hallo wereld"), 0.001)
    }

    @Test
    fun caseAndPunctuationNormalised() {
        assertEquals(0.0, Wer.wer("Hallo, wereld!", "hallo wereld"), 0.001)
    }

    @Test
    fun singleSubstitution() {
        assertEquals(1.0 / 2, Wer.wer("hallo wereld", "hallo wereldje"), 0.001)
    }

    @Test
    fun insertionAndDeletion() {
        // ref: 3 words, hyp adds a word in the middle → 1 insertion
        assertEquals(1.0 / 3, Wer.wer("een twee drie", "een twee tussen drie"), 0.001)
        // hyp drops a word → 1 deletion
        assertEquals(1.0 / 3, Wer.wer("een twee drie", "een drie"), 0.001)
    }

    @Test
    fun completelyDifferent() {
        assertEquals(1.0, Wer.wer("a b c", "x y z"), 0.001)
    }

    @Test
    fun emptyInputs() {
        assertEquals(0.0, Wer.wer("", ""), 0.001)
        assertEquals(3.0, Wer.wer("", "a b c"), 0.001)
        assertEquals(1.0, Wer.wer("a b c", ""), 0.001)
    }

    @Test
    fun tokeniseStripsPunctuation() {
        assertEquals(listOf("a", "b", "c"), Wer.tokenize("a, b! c."))
    }
}
