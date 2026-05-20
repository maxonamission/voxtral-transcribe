package io.github.maxonamission.voxtral.keyboard.core

enum class VoiceCommand {
    NEW_PARAGRAPH,
    NEW_LINE,
    UNDO,
    STOP_RECORDING,
}

data class CommandMatch(
    val command: VoiceCommand,
    /** Text before the command suffix, with trailing whitespace stripped. */
    val residual: String,
)

/**
 * Recognises voice commands at the end of an utterance (suffix-matching).
 *
 * Mirrors the webapp's `shared/src/voice-commands.ts` and command patterns
 * from `shared/src/languages/{nl,en}.json` — kept as a manual port for
 * clarity; sync on each release via the test diff if patterns drift.
 *
 * v1 set: new paragraph, new line, undo, stop recording. Heading/list/to-do
 * commands are out of scope until we have markdown-aware insertion (story
 * 008 in the obsidian-plugin epics).
 */
class CommandMatcher(private val language: String = "nl") {

    private val patterns: Map<VoiceCommand, List<String>> = if (language == "en") EN_PATTERNS else NL_PATTERNS

    fun match(text: String): CommandMatch? {
        val normalized = normalize(text)
        if (normalized.length < MIN_UTTERANCE_LENGTH) return null
        for ((command, phrases) in patterns) {
            for (phrase in phrases) {
                if (normalized.endsWith(phrase)) {
                    val residual = normalized.removeSuffix(phrase).trimEnd { it.isWhitespace() || it == ',' }
                    return CommandMatch(command, residual)
                }
            }
        }
        return null
    }

    companion object {
        private const val MIN_UTTERANCE_LENGTH = 3

        private val NL_PATTERNS = linkedMapOf(
            VoiceCommand.NEW_PARAGRAPH to listOf("nieuwe alinea", "nieuw alinea", "nieuwe paragraaf", "nieuw paragraaf", "nieuwe linie"),
            VoiceCommand.NEW_LINE to listOf("nieuwe regel", "nieuwe lijn", "volgende regel"),
            VoiceCommand.UNDO to listOf("herstel", "ongedaan maken"),
            VoiceCommand.STOP_RECORDING to listOf(
                "stop opname",
                "stop de opname",
                "beeindig opname",
                "beeindig de opname",
            ),
        )

        private val EN_PATTERNS = linkedMapOf(
            VoiceCommand.NEW_PARAGRAPH to listOf("new paragraph"),
            VoiceCommand.NEW_LINE to listOf("new line", "next line"),
            VoiceCommand.UNDO to listOf("undo"),
            VoiceCommand.STOP_RECORDING to listOf("stop recording"),
        )

        /** Lowercase, strip trailing punctuation and whitespace. */
        internal fun normalize(text: String): String {
            return text.lowercase()
                .trim()
                .trimEnd { it == '.' || it == '!' || it == '?' || it == ',' || it.isWhitespace() }
        }
    }
}
