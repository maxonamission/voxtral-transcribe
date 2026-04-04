// Voxtral Transcribe — Copyright (c) 2026 Max Kloosterman
// Licensed under GPL-3.0 — see LICENSE for details
// https://github.com/maxonamission/voxtral-transcribe

/**
 * @voxtral/shared — Platform-independent core utilities shared
 * between the Obsidian plugin and the VS Code extension.
 */

export { levenshtein, normalizeCommand } from "./similarity";

export {
	type InsertionContext,
	detectContext,
	shouldStripTrailingPunctuation,
	shouldLowercase,
	lowercaseFirstLetter,
	stripTrailingPunctuation,
} from "./text-context";

export {
	DEFAULT_CORRECT_PROMPT,
	type CommandMarkers,
	buildCustomCommandGuard,
	stripLlmCommentary,
	isLikelyHallucination,
} from "./correction";

export {
	SUPPORTED_LANGUAGES,
	type LangCode,
	LANGUAGE_NAMES,
	type CommandId,
	PATTERNS,
	LABELS,
	MISHEARINGS,
	getPatternsForCommand,
	getLabel,
	getMishearings,
} from "./lang";

export {
	phoneticNormalize,
	stripArticles,
	stripTrailingFillers,
	trySplitCompound,
} from "./phonetics";

export { vlog, getLogText, getLogCount } from "./plugin-logger";

export {
	type AuthenticatedWsConnection,
	type AuthenticatedWsCallbacks,
	WS_OPEN,
	createAuthenticatedWebSocket,
} from "./authenticated-websocket";
