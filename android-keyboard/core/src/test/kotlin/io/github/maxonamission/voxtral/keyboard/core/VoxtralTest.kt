package io.github.maxonamission.voxtral.keyboard.core

import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class VoxtralTest {
    @Test
    fun versionIsNotBlank() {
        assertTrue(Voxtral.VERSION.isNotBlank())
    }
}
