// Voxtral Transcribe — Copyright (c) 2026 Max Kloosterman
// Licensed under GPL-3.0 — see LICENSE for details
// https://github.com/maxonamission/voxtral-transcribe

/**
 * Voice command definitions and matching for the webapp.
 * Pure logic — no DOM dependencies. Testable in isolation.
 */

import {
    findMatch,
    getPatternsForCommand,
    getMishearings,
    phoneticNormalize,
    stripArticles,
    stripTrailingFillers,
    trySplitCompound,
} from "../../obsidian-plugin/src/shared/index.ts";

// ── Command definitions ──

export const COMMAND_DEFS = [
    { id: "newParagraph", insert: "\n\n", toast: "¶" },
    { id: "newLine", insert: "\n", toast: "↵" },
    { id: "heading1", insert: "\n\n# ", toast: "# H1" },
    { id: "heading2", insert: "\n\n## ", toast: "## H2" },
    { id: "heading3", insert: "\n\n### ", toast: "### H3" },
    { id: "bulletPoint", action: "bulletPoint", toast: "•" },
    { id: "todoItem", insert: "\n- [ ] ", toast: "☐" },
    { id: "numberedItem", action: "numberedItem", toast: "1." },
    { id: "stopRecording", action: "stopRecording", toast: "⏹ Stop" },
    { id: "deleteLastParagraph", action: "deleteLastParagraph", toast: "🗑" },
    { id: "deleteLastLine", action: "deleteLastLine", toast: "🗑" },
    { id: "undo", action: "undo", toast: "↩" },
    { id: "colon", insert: ": ", punctuation: true, toast: ":" },
];

/** LanguageProvider adapter for shared command matcher. */
export const webappLangProvider = {
    getPatterns: getPatternsForCommand,
    getMishearings,
    phoneticNormalize,
    stripArticles,
    stripTrailingFillers,
    trySplitCompound,
};

/**
 * Build VOICE_COMMANDS from COMMAND_DEFS + shared language data (JSON).
 */
export function buildVoiceCommands(lang) {
    return COMMAND_DEFS.map(def => ({
        ...def,
        patterns: getPatternsForCommand(def.id, lang),
    }));
}

/**
 * Find a voice command in text. Delegates to the shared 5-pass algorithm
 * and maps the result back to the webapp's command structure.
 *
 * @param {string} rawText — raw transcribed text (before normalization)
 * @param {Array} voiceCommands — current VOICE_COMMANDS array
 * @param {string} lang — active language code
 * @returns {{ cmd: object, textBefore: string } | null}
 */
export function findCommand(rawText, voiceCommands, lang) {
    const result = findMatch(rawText, voiceCommands, lang, webappLangProvider);
    if (!result) return null;
    const cmd = voiceCommands.find(c => c.id === result.commandId);
    if (!cmd) return null;
    return { cmd, textBefore: result.textBefore };
}

/**
 * Strip trailing punctuation before inserting a new punctuation mark.
 * E.g. "oké," + ": " → "oké: " (not "oké,: ")
 *
 * Note: this strips commas/semicolons too (different from shared
 * stripTrailingPunctuation which only strips .!? for sentence-end context).
 */
export function stripCommandPunctuation(str) {
    return str.replace(/[,;.!?]+\s*$/, "");
}
