import { describe, it, expect } from "vitest";
import * as shared from "../src/index";

/**
 * Contract tests: verify that every expected export from @voxtral/shared
 * exists and has the correct type. If any export is renamed, removed, or
 * changes signature, these tests will fail — catching accidental API breaks
 * before they propagate to consumers (obsidian-plugin, vscode-extension).
 */

describe("@voxtral/shared contract — value exports", () => {
	// ── similarity ──
	it("exports levenshtein as function", () => {
		expect(typeof shared.levenshtein).toBe("function");
	});
	it("exports normalizeCommand as function", () => {
		expect(typeof shared.normalizeCommand).toBe("function");
	});

	// ── text-context ──
	it("exports detectContext as function", () => {
		expect(typeof shared.detectContext).toBe("function");
	});
	it("exports shouldStripTrailingPunctuation as function", () => {
		expect(typeof shared.shouldStripTrailingPunctuation).toBe("function");
	});
	it("exports shouldLowercase as function", () => {
		expect(typeof shared.shouldLowercase).toBe("function");
	});
	it("exports lowercaseFirstLetter as function", () => {
		expect(typeof shared.lowercaseFirstLetter).toBe("function");
	});
	it("exports stripTrailingPunctuation as function", () => {
		expect(typeof shared.stripTrailingPunctuation).toBe("function");
	});

	// ── correction ──
	it("exports DEFAULT_CORRECT_PROMPT as string", () => {
		expect(typeof shared.DEFAULT_CORRECT_PROMPT).toBe("string");
		expect(shared.DEFAULT_CORRECT_PROMPT.length).toBeGreaterThan(0);
	});
	it("exports buildCustomCommandGuard as function", () => {
		expect(typeof shared.buildCustomCommandGuard).toBe("function");
	});
	it("exports stripLlmCommentary as function", () => {
		expect(typeof shared.stripLlmCommentary).toBe("function");
	});
	it("exports isLikelyHallucination as function", () => {
		expect(typeof shared.isLikelyHallucination).toBe("function");
	});

	// ── lang ──
	it("exports SUPPORTED_LANGUAGES as array", () => {
		expect(Array.isArray(shared.SUPPORTED_LANGUAGES)).toBe(true);
		expect(shared.SUPPORTED_LANGUAGES.length).toBeGreaterThan(0);
	});
	it("exports LANGUAGE_NAMES as object", () => {
		expect(typeof shared.LANGUAGE_NAMES).toBe("object");
		expect(shared.LANGUAGE_NAMES).not.toBeNull();
	});
	it("exports PATTERNS as object", () => {
		expect(typeof shared.PATTERNS).toBe("object");
	});
	it("exports LABELS as object", () => {
		expect(typeof shared.LABELS).toBe("object");
	});
	it("exports MISHEARINGS as object", () => {
		expect(typeof shared.MISHEARINGS).toBe("object");
	});
	it("exports getPatternsForCommand as function", () => {
		expect(typeof shared.getPatternsForCommand).toBe("function");
	});
	it("exports getLabel as function", () => {
		expect(typeof shared.getLabel).toBe("function");
	});
	it("exports getMishearings as function", () => {
		expect(typeof shared.getMishearings).toBe("function");
	});

	// ── phonetics ──
	it("exports phoneticNormalize as function", () => {
		expect(typeof shared.phoneticNormalize).toBe("function");
	});
	it("exports stripArticles as function", () => {
		expect(typeof shared.stripArticles).toBe("function");
	});
	it("exports stripTrailingFillers as function", () => {
		expect(typeof shared.stripTrailingFillers).toBe("function");
	});
	it("exports trySplitCompound as function", () => {
		expect(typeof shared.trySplitCompound).toBe("function");
	});

	// ── plugin-logger ──
	it("exports vlog as object with log methods", () => {
		expect(typeof shared.vlog).toBe("object");
		expect(typeof shared.vlog.debug).toBe("function");
		expect(typeof shared.vlog.warn).toBe("function");
		expect(typeof shared.vlog.error).toBe("function");
	});
	it("exports getLogText as function", () => {
		expect(typeof shared.getLogText).toBe("function");
	});
	it("exports getLogCount as function", () => {
		expect(typeof shared.getLogCount).toBe("function");
	});

	// ── authenticated-websocket ──
	it("exports WS_OPEN as number", () => {
		expect(typeof shared.WS_OPEN).toBe("number");
	});
	it("exports createAuthenticatedWebSocket as function", () => {
		expect(typeof shared.createAuthenticatedWebSocket).toBe("function");
	});

	// ── types ──
	it("exports DEFAULT_SETTINGS as object with all required fields", () => {
		expect(typeof shared.DEFAULT_SETTINGS).toBe("object");
		expect(shared.DEFAULT_SETTINGS).toHaveProperty("apiKey");
		expect(shared.DEFAULT_SETTINGS).toHaveProperty("language");
		expect(shared.DEFAULT_SETTINGS).toHaveProperty("mode");
		expect(shared.DEFAULT_SETTINGS).toHaveProperty("realtimeModel");
		expect(shared.DEFAULT_SETTINGS).toHaveProperty("batchModel");
		expect(shared.DEFAULT_SETTINGS).toHaveProperty("correctModel");
		expect(shared.DEFAULT_SETTINGS).toHaveProperty("autoCorrect");
		expect(shared.DEFAULT_SETTINGS).toHaveProperty("streamingDelayMs");
		expect(shared.DEFAULT_SETTINGS).toHaveProperty("dualDelay");
		expect(shared.DEFAULT_SETTINGS).toHaveProperty("customCommands");
		expect(shared.DEFAULT_SETTINGS).toHaveProperty("noiseSuppression");
		expect(shared.DEFAULT_SETTINGS).toHaveProperty("focusBehavior");
	});
});

describe("@voxtral/shared contract — function signatures", () => {
	it("levenshtein(a, b) returns number", () => {
		const result = shared.levenshtein("abc", "abd");
		expect(typeof result).toBe("number");
	});

	it("normalizeCommand(text) returns string", () => {
		const result = shared.normalizeCommand("Hello World");
		expect(typeof result).toBe("string");
	});

	it("detectContext(lineBefore) returns InsertionContext string", () => {
		const result = shared.detectContext("hello world");
		expect(typeof result).toBe("string");
	});

	it("isLikelyHallucination(text, durationSec) returns boolean", () => {
		const result = shared.isLikelyHallucination("test", 5.0);
		expect(typeof result).toBe("boolean");
	});

	it("phoneticNormalize(text, lang) returns string", () => {
		const result = shared.phoneticNormalize("test", "en");
		expect(typeof result).toBe("string");
	});

	it("stripArticles(text, lang) returns string", () => {
		const result = shared.stripArticles("the test", "en");
		expect(typeof result).toBe("string");
	});
});

describe("@voxtral/shared contract — non-index module exports", () => {
	it("voice-commands exports processText and matchCommand", async () => {
		const vc = await import("../src/voice-commands");
		expect(typeof vc.processText).toBe("function");
		expect(typeof vc.matchCommand).toBe("function");
		expect(typeof vc.setLanguage).toBe("function");
		expect(typeof vc.loadCustomCommands).toBe("function");
		expect(typeof vc.loadCustomCommandTriggers).toBe("function");
		expect(typeof vc.isSlotActive).toBe("function");
		expect(typeof vc.getActiveSlot).toBe("function");
		expect(typeof vc.closeSlot).toBe("function");
		expect(typeof vc.cancelSlot).toBe("function");
		expect(typeof vc.setPreMatchHook).toBe("function");
	});

	it("mistral-api exports transcribeBatch, correctText, isLikelyHallucination", async () => {
		const api = await import("../src/mistral-api");
		expect(typeof api.transcribeBatch).toBe("function");
		expect(typeof api.correctText).toBe("function");
		expect(typeof api.isLikelyHallucination).toBe("function");
	});

	it("realtime-session exports RealtimeSession class", async () => {
		const mod = await import("../src/realtime-session");
		expect(typeof mod.RealtimeSession).toBe("function"); // class constructor
	});

	it("dual-delay-session exports DualDelaySession class", async () => {
		const mod = await import("../src/dual-delay-session");
		expect(typeof mod.DualDelaySession).toBe("function");
	});

	it("dictation-tracker exports DictationTracker class", async () => {
		const mod = await import("../src/dictation-tracker");
		expect(typeof mod.DictationTracker).toBe("function");
	});
});
