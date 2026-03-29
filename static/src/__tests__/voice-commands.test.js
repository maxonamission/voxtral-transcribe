import { describe, it, expect } from "vitest";
import {
    COMMAND_DEFS,
    buildVoiceCommands,
    findCommand,
    stripCommandPunctuation,
} from "../voice-commands.js";

// ── COMMAND_DEFS ──

describe("COMMAND_DEFS", () => {
    it("has 13 built-in commands", () => {
        expect(COMMAND_DEFS).toHaveLength(13);
    });

    it("each command has an id and toast", () => {
        for (const cmd of COMMAND_DEFS) {
            expect(cmd.id).toBeTruthy();
            expect(cmd.toast).toBeTruthy();
        }
    });

    it("each command has either insert or action", () => {
        for (const cmd of COMMAND_DEFS) {
            expect(cmd.insert || cmd.action).toBeTruthy();
        }
    });

    it("colon has punctuation flag", () => {
        const colon = COMMAND_DEFS.find(c => c.id === "colon");
        expect(colon.punctuation).toBe(true);
    });
});

// ── buildVoiceCommands ──

describe("buildVoiceCommands", () => {
    it("returns commands with patterns for Dutch", () => {
        const cmds = buildVoiceCommands("nl");
        expect(cmds.length).toBe(COMMAND_DEFS.length);
        const newPara = cmds.find(c => c.id === "newParagraph");
        expect(newPara.patterns).toContain("nieuwe alinea");
    });

    it("returns commands with patterns for English", () => {
        const cmds = buildVoiceCommands("en");
        const newPara = cmds.find(c => c.id === "newParagraph");
        expect(newPara.patterns).toContain("new paragraph");
    });

    it("includes English fallback patterns for non-English languages", () => {
        const cmds = buildVoiceCommands("nl");
        const undo = cmds.find(c => c.id === "undo");
        // Dutch patterns + English fallback
        expect(undo.patterns).toContain("herstel");
        expect(undo.patterns).toContain("undo");
    });

    it("supports all 13 languages", () => {
        const langs = ["nl", "en", "fr", "de", "es", "pt", "it", "ru", "zh", "hi", "ar", "ja", "ko"];
        for (const lang of langs) {
            const cmds = buildVoiceCommands(lang);
            expect(cmds.length).toBe(COMMAND_DEFS.length);
            // Every command should have at least one pattern (EN fallback)
            for (const cmd of cmds) {
                expect(cmd.patterns.length).toBeGreaterThan(0);
            }
        }
    });
});

// ── findCommand ──

describe("findCommand", () => {
    const nlCmds = buildVoiceCommands("nl");
    const enCmds = buildVoiceCommands("en");

    // -- Exact match (Pass 1) --

    it("matches exact Dutch command", () => {
        const result = findCommand("nieuwe alinea", nlCmds, "nl");
        expect(result).not.toBeNull();
        expect(result.cmd.id).toBe("newParagraph");
        expect(result.textBefore).toBe("");
    });

    it("matches exact English command", () => {
        const result = findCommand("new paragraph", enCmds, "en");
        expect(result).not.toBeNull();
        expect(result.cmd.id).toBe("newParagraph");
    });

    it("matches command at end of text with preceding text", () => {
        const result = findCommand("dit is wat tekst nieuwe alinea", nlCmds, "nl");
        expect(result).not.toBeNull();
        expect(result.cmd.id).toBe("newParagraph");
        expect(result.textBefore).toBe("dit is wat tekst");
    });

    it("returns null for non-command text", () => {
        const result = findCommand("dit is gewone tekst", nlCmds, "nl");
        expect(result).toBeNull();
    });

    it("matches stop recording command", () => {
        const result = findCommand("stop opname", nlCmds, "nl");
        expect(result).not.toBeNull();
        expect(result.cmd.id).toBe("stopRecording");
    });

    it("matches stopopname (no space) compound variant", () => {
        const result = findCommand("stopopname", nlCmds, "nl");
        expect(result).not.toBeNull();
        expect(result.cmd.id).toBe("stopRecording");
    });

    // -- Punctuation commands --

    it("matches colon command", () => {
        const result = findCommand("dubbele punt", nlCmds, "nl");
        expect(result).not.toBeNull();
        expect(result.cmd.id).toBe("colon");
        expect(result.cmd.punctuation).toBe(true);
    });

    // -- Heading commands --

    it("matches heading commands", () => {
        const h1 = findCommand("kop een", nlCmds, "nl");
        expect(h1).not.toBeNull();
        expect(h1.cmd.id).toBe("heading1");

        const h2 = findCommand("kop twee", nlCmds, "nl");
        expect(h2).not.toBeNull();
        expect(h2.cmd.id).toBe("heading2");
    });

    // -- Multiple languages --

    it("matches French commands", () => {
        const frCmds = buildVoiceCommands("fr");
        const result = findCommand("nouveau paragraphe", frCmds, "fr");
        expect(result).not.toBeNull();
        expect(result.cmd.id).toBe("newParagraph");
    });

    it("matches German commands", () => {
        const deCmds = buildVoiceCommands("de");
        const result = findCommand("neuer absatz", deCmds, "de");
        expect(result).not.toBeNull();
        expect(result.cmd.id).toBe("newParagraph");
    });
});

// ── stripCommandPunctuation ──

describe("stripCommandPunctuation", () => {
    it("strips trailing period", () => {
        expect(stripCommandPunctuation("hello.")).toBe("hello");
    });

    it("strips trailing comma", () => {
        expect(stripCommandPunctuation("hello,")).toBe("hello");
    });

    it("strips trailing semicolon", () => {
        expect(stripCommandPunctuation("hello;")).toBe("hello");
    });

    it("strips trailing punctuation with space", () => {
        expect(stripCommandPunctuation("hello. ")).toBe("hello");
    });

    it("preserves text without trailing punctuation", () => {
        expect(stripCommandPunctuation("hello world")).toBe("hello world");
    });

    it("preserves mid-text punctuation", () => {
        expect(stripCommandPunctuation("hello, world")).toBe("hello, world");
    });
});
