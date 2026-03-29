// Voxtral Transcribe — Copyright (c) 2026 Max Kloosterman
// Licensed under GPL-3.0 — see LICENSE for details
// https://github.com/maxonamission/voxtral-transcribe

/**
 * Re-exports from shared/lang-data.ts.
 * Kept as a module boundary so existing imports don't break.
 */

export {
	SUPPORTED_LANGUAGES,
	type LangCode,
	type CommandId,
	LANGUAGE_NAMES,
	PATTERNS,
	LABELS,
	MISHEARINGS,
	getPatternsForCommand,
	getLabel,
	getMishearings,
} from "./shared";
