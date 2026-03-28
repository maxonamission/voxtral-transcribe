// Voxtral Transcribe — Copyright (c) 2026 Max Kloosterman
// Licensed under GPL-3.0 — see LICENSE for details
// https://github.com/maxonamission/voxtral-transcribe

/**
 * Platform-independent 5-pass voice command matching algorithm.
 *
 * Both the Obsidian plugin and the webapp use this same algorithm.
 * The platform layer provides language data and command definitions
 * via the LanguageProvider and MatchableCommand interfaces.
 */

import { levenshtein, normalizeCommand } from "./similarity";

// ── Interfaces ──

/** Minimal command definition for matching (platform layer adds actions). */
export interface MatchableCommand {
	id: string;
}

/** Language data provider — abstracts JSON-based and hardcoded sources. */
export interface LanguageProvider {
	/** Get trigger phrases for a command in the given language (with EN fallback). */
	getPatterns(commandId: string, lang: string): string[];
	/** Language-specific mishearing corrections (compiled regex). */
	getMishearings(lang: string): [RegExp, string][];
	/** Phonetic normalization rules. */
	phoneticNormalize(text: string, lang: string): string;
	/** Strip leading articles/determiners. */
	stripArticles(text: string, lang: string): string;
	/** Strip trailing filler words like "alsjeblieft", "please". */
	stripTrailingFillers(text: string, lang: string): string;
	/** Try to split a compound word using known phrases as dictionary. */
	trySplitCompound(text: string, knownPhrases: string[]): string;
}

/** Result of a successful command match. */
export interface MatchResult {
	commandId: string;
	textBefore: string;
}

// ── Helpers ──

function trailingWords(text: string, n: number): string {
	const words = text.split(/\s+/);
	if (n >= words.length) return text;
	return words.slice(-n).join(" ");
}

// ── Core 5-pass matching ──

/**
 * Check if text ends with a voice command. Returns the match
 * (command id + preceding text) or null.
 *
 * Matching pipeline (in order):
 * 1. Exact match (text ends with a known pattern)
 * 2. Match after stripping trailing filler words
 * 2b. Match after stripping leading articles from trailing portion
 * 3. Phonetic match (phonetically normalized text matches pattern)
 * 4. Compound-word match (concatenated words like "nieuwealinea")
 * 5. Fuzzy match (Levenshtein ≤ 2, standalone sentences only)
 */
export function findMatch(
	rawText: string,
	commands: MatchableCommand[],
	lang: string,
	provider: LanguageProvider
): MatchResult | null {
	// Normalize + fix mishearings
	let normalized = normalizeCommand(rawText);
	for (const [pattern, replacement] of provider.getMishearings(lang)) {
		normalized = normalized.replace(pattern, replacement);
	}

	const rawWords = rawText.trimEnd().split(/\s+/);

	// Collect all known phrases for compound splitting (used in pass 4)
	const allPhrases: string[] = [];

	// ── Pass 1: exact match (full or suffix) ──
	for (const cmd of commands) {
		const patterns = provider.getPatterns(cmd.id, lang);
		for (const pattern of patterns) {
			allPhrases.push(normalizeCommand(pattern));
			const normPattern = normalizeCommand(pattern);
			if (normalized.endsWith(normPattern)) {
				const patternWordCount = pattern.split(/\s+/).length;
				const textBefore = rawWords
					.slice(0, -patternWordCount)
					.join(" ")
					.trimEnd();
				return { commandId: cmd.id, textBefore };
			}
		}
	}

	// ── Pass 2: strip trailing filler words ──
	const strippedFillers = provider.stripTrailingFillers(normalized, lang);
	if (strippedFillers !== normalized) {
		for (const cmd of commands) {
			const patterns = provider.getPatterns(cmd.id, lang);
			for (const pattern of patterns) {
				const normPattern = normalizeCommand(pattern);
				if (strippedFillers.endsWith(normPattern)) {
					const patternWordCount = pattern.split(/\s+/).length;
					const fillerWordCount =
						normalized.split(/\s+/).length -
						strippedFillers.split(/\s+/).length;
					const textBefore = rawWords
						.slice(0, -(patternWordCount + fillerWordCount))
						.join(" ")
						.trimEnd();
					return { commandId: cmd.id, textBefore };
				}
			}
		}
	}

	// ── Pass 2b: strip leading articles from trailing portion ──
	for (const cmd of commands) {
		const patterns = provider.getPatterns(cmd.id, lang);
		for (const pattern of patterns) {
			const normPattern = normalizeCommand(pattern);
			const patternWordCount = normPattern.split(/\s+/).length;
			const tail = trailingWords(normalized, patternWordCount + 1);
			const stripped = provider.stripArticles(tail, lang);
			if (stripped === normPattern) {
				const tailWordCount = tail.split(/\s+/).length;
				const textBefore = rawWords
					.slice(0, -tailWordCount)
					.join(" ")
					.trimEnd();
				return { commandId: cmd.id, textBefore };
			}
		}
	}

	// ── Pass 3: phonetic match ──
	const phoneticText = provider.phoneticNormalize(normalized, lang);
	for (const cmd of commands) {
		const patterns = provider.getPatterns(cmd.id, lang);
		for (const pattern of patterns) {
			const normPattern = normalizeCommand(pattern);
			const phoneticPattern = provider.phoneticNormalize(normPattern, lang);
			if (phoneticPattern !== normPattern || phoneticText !== normalized) {
				if (phoneticText.endsWith(phoneticPattern)) {
					const patternWordCount = pattern.split(/\s+/).length;
					const textBefore = rawWords
						.slice(0, -patternWordCount)
						.join(" ")
						.trimEnd();
					return { commandId: cmd.id, textBefore };
				}
			}
		}
	}

	// ── Pass 4: compound-word splitting ──
	const lastWord = normalized.split(/\s+/).pop() ?? "";
	if (lastWord.length >= 4 && !lastWord.includes(" ")) {
		const split = provider.trySplitCompound(lastWord, allPhrases);
		if (split !== lastWord) {
			const words = normalized.split(/\s+/);
			words[words.length - 1] = split;
			const resplit = words.join(" ");
			for (const cmd of commands) {
				const patterns = provider.getPatterns(cmd.id, lang);
				for (const pattern of patterns) {
					const normPattern = normalizeCommand(pattern);
					if (resplit.endsWith(normPattern)) {
						const textBefore = rawWords
							.slice(0, -1)
							.join(" ")
							.trimEnd();
						return { commandId: cmd.id, textBefore };
					}
				}
			}
		}
	}

	// ── Pass 5: fuzzy match (Levenshtein ≤ 2, standalone only) ──
	// Guard: both text and pattern must be ≥ 6 chars and similar in
	// length to avoid false positives on short words.
	let bestMatch: MatchResult | null = null;
	let bestDist = 3;
	for (const cmd of commands) {
		const patterns = provider.getPatterns(cmd.id, lang);
		for (const pattern of patterns) {
			const normPattern = normalizeCommand(pattern);
			if (normalized.length < 6 || normPattern.length < 6) continue;
			if (Math.abs(normalized.length - normPattern.length) > 3) continue;
			const dist = levenshtein(normalized, normPattern);
			if (dist > 0 && dist < bestDist) {
				bestDist = dist;
				bestMatch = { commandId: cmd.id, textBefore: "" };
			}
		}
	}
	return bestMatch;
}
