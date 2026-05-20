package io.github.maxonamission.voxtral.keyboard.core

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test

class CommandMatcherTest {

    private val nl = CommandMatcher(language = "nl")
    private val en = CommandMatcher(language = "en")

    @Test
    fun matchesNlSuffixCommands() {
        val m = nl.match("Hallo wereld nieuwe alinea")
        assertEquals(VoiceCommand.NEW_PARAGRAPH, m?.command)
        assertEquals("hallo wereld", m?.residual)
    }

    @Test
    fun matchesEnSuffixCommands() {
        val m = en.match("Some text new paragraph")
        assertEquals(VoiceCommand.NEW_PARAGRAPH, m?.command)
        assertEquals("some text", m?.residual)
    }

    @Test
    fun matchesUndoNl() {
        assertEquals(VoiceCommand.UNDO, nl.match("ongedaan maken")?.command)
        assertEquals(VoiceCommand.UNDO, nl.match("herstel")?.command)
    }

    @Test
    fun matchesStopRecording() {
        assertEquals(VoiceCommand.STOP_RECORDING, nl.match("dit moet weg stop opname")?.command)
        assertEquals(VoiceCommand.STOP_RECORDING, en.match("this is enough stop recording")?.command)
    }

    @Test
    fun stripTrailingPunctuationBeforeMatching() {
        assertEquals(VoiceCommand.NEW_PARAGRAPH, nl.match("hallo nieuwe alinea.")?.command)
        assertEquals(VoiceCommand.NEW_PARAGRAPH, nl.match("hallo nieuwe alinea!")?.command)
    }

    @Test
    fun residualHasNoTrailingComma() {
        val m = nl.match("hallo, nieuwe alinea")
        assertEquals("hallo", m?.residual)
    }

    @Test
    fun nonCommandReturnsNull() {
        assertNull(nl.match("dit is gewoon tekst"))
        assertNull(en.match("just some regular text"))
    }

    @Test
    fun veryShortUtteranceIsIgnored() {
        // Hallucination guard: anything under MIN_UTTERANCE_LENGTH chars is ignored
        // even if it could match as a command on its own.
        assertNull(nl.match("a"))
    }

    @Test
    fun newLineSeparateFromParagraph() {
        assertEquals(VoiceCommand.NEW_LINE, nl.match("klaar nieuwe regel")?.command)
        assertEquals(VoiceCommand.NEW_LINE, en.match("ok new line")?.command)
    }

    @Test
    fun caseInsensitive() {
        assertEquals(VoiceCommand.NEW_PARAGRAPH, nl.match("Hallo NIEUWE ALINEA")?.command)
    }
}
