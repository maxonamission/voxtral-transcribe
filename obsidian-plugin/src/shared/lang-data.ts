// Voxtral Transcribe — Copyright (c) 2026 Max Kloosterman
// Licensed under GPL-3.0 — see LICENSE for details
// https://github.com/maxonamission/voxtral-transcribe

/**
 * Shared language data loader.
 *
 * Imports all per-language JSON files and provides compiled,
 * ready-to-use data structures for phonetics, articles, fillers,
 * mishearings, and command patterns.
 *
 * Both the Obsidian plugin and the webapp use this module —
 * esbuild bundles the JSON imports at build time.
 */

// ── JSON imports (bundled by esbuild at build time) ──

import nlData from "../languages/nl.json";
import enData from "../languages/en.json";
import frData from "../languages/fr.json";
import deData from "../languages/de.json";
import esData from "../languages/es.json";
import ptData from "../languages/pt.json";
import itData from "../languages/it.json";
import ruData from "../languages/ru.json";
import zhData from "../languages/zh.json";
import hiData from "../languages/hi.json";
import arData from "../languages/ar.json";
import jaData from "../languages/ja.json";
import koData from "../languages/ko.json";

// ── Types ──

interface LangJsonData {
	code: string;
	name: string;
	patterns: Record<string, string[]>;
	labels: Record<string, string>;
	mishearings: { pattern: string; flags: string; replacement: string }[];
	phonetics: { pattern: string; flags: string; replacement: string }[];
	articles: string[];
	fillers: string[];
}

/** All loaded language data, keyed by language code */
const ALL_LANGS: Record<string, LangJsonData> = {
	nl: nlData, en: enData, fr: frData, de: deData,
	es: esData, pt: ptData, it: itData, ru: ruData,
	zh: zhData, hi: hiData, ar: arData, ja: jaData, ko: koData,
};

export const SUPPORTED_LANGUAGES = [
	"nl", "en", "fr", "de", "es", "pt", "it",
	"ru", "zh", "hi", "ar", "ja", "ko",
] as const;

export type LangCode = (typeof SUPPORTED_LANGUAGES)[number];

/** Command IDs — used as keys in language pattern data */
export type CommandId =
	| "newParagraph"
	| "newLine"
	| "heading1"
	| "heading2"
	| "heading3"
	| "bulletPoint"
	| "todoItem"
	| "numberedItem"
	| "deleteLastParagraph"
	| "deleteLastLine"
	| "undo"
	| "stopRecording"
	| "colon"
	| "wikilink"
	| "boldOpen"
	| "boldClose"
	| "italicOpen"
	| "italicClose"
	| "inlineCodeOpen"
	| "inlineCodeClose"
	| "tagOpen"
	| "tagClose"
	| "codeBlockOpen"
	| "codeBlockClose";

// ── Compiled data ──

function compileRegexRules(
	data: { pattern: string; flags: string; replacement: string }[]
): [RegExp, string][] {
	return data.map(({ pattern, flags, replacement }) => [
		new RegExp(pattern, flags),
		replacement,
	]);
}

/** Phonetic normalization rules per language (compiled RegExp). */
export const PHONETIC_RULES: Partial<Record<LangCode, [RegExp, string][]>> =
	Object.fromEntries(
		SUPPORTED_LANGUAGES
			.filter((code) => ALL_LANGS[code].phonetics.length > 0)
			.map((code) => [code, compileRegexRules(ALL_LANGS[code].phonetics)])
	) as Partial<Record<LangCode, [RegExp, string][]>>;

/** Mishearing corrections per language (compiled RegExp). */
export const MISHEARINGS: Partial<Record<LangCode, [RegExp, string][]>> =
	Object.fromEntries(
		SUPPORTED_LANGUAGES
			.filter((code) => ALL_LANGS[code].mishearings.length > 0)
			.map((code) => [code, compileRegexRules(ALL_LANGS[code].mishearings)])
	) as Partial<Record<LangCode, [RegExp, string][]>>;

/** Articles/determiners per language. */
export const ARTICLES: Partial<Record<LangCode, string[]>> = Object.fromEntries(
	SUPPORTED_LANGUAGES.map((code) => [code, ALL_LANGS[code].articles])
) as Partial<Record<LangCode, string[]>>;

/** Trailing filler words per language. */
export const TRAILING_FILLERS: Partial<Record<LangCode, string[]>> = Object.fromEntries(
	SUPPORTED_LANGUAGES
		.filter((code) => ALL_LANGS[code].fillers.length > 0)
		.map((code) => [code, ALL_LANGS[code].fillers])
) as Partial<Record<LangCode, string[]>>;

/** Command trigger patterns per language. */
export const PATTERNS: Partial<Record<LangCode, Record<string, string[]>>> =
	Object.fromEntries(
		SUPPORTED_LANGUAGES.map((code) => [code, ALL_LANGS[code].patterns])
	) as Partial<Record<LangCode, Record<string, string[]>>>;

/** Localized command labels per language. */
export const LABELS: Partial<Record<LangCode, Record<string, string>>> =
	Object.fromEntries(
		SUPPORTED_LANGUAGES.map((code) => [code, ALL_LANGS[code].labels])
	) as Partial<Record<LangCode, Record<string, string>>>;

/** Human-readable language names. */
export const LANGUAGE_NAMES: Record<LangCode, string> = Object.fromEntries(
	SUPPORTED_LANGUAGES.map((code) => [code, ALL_LANGS[code].name])
) as Record<LangCode, string>;

// ── Helper functions ──

/** Apply phonetic normalization rules for a language. */
export function phoneticNormalize(text: string, lang: string): string {
	const rules = PHONETIC_RULES[lang as LangCode];
	if (!rules) return text;
	let result = text;
	for (const [pattern, replacement] of rules) {
		result = result.replace(pattern, replacement);
	}
	return result;
}

/** Strip leading articles/determiners. */
export function stripArticles(text: string, lang: string): string {
	const articles = ARTICLES[lang as LangCode];
	if (!articles || articles.length === 0) return text;
	const words = text.split(/\s+/);
	let stripped = 0;
	while (stripped < Math.min(2, words.length - 1)) {
		if (articles.includes(words[stripped])) {
			stripped++;
		} else {
			break;
		}
	}
	return stripped > 0 ? words.slice(stripped).join(" ") : text;
}

/** Strip trailing filler words. */
export function stripTrailingFillers(text: string, lang: string): string {
	const fillers = TRAILING_FILLERS[lang as LangCode];
	if (!fillers || fillers.length === 0) return text;
	let result = text;
	for (const filler of fillers.sort((a, b) => b.length - a.length)) {
		if (result.endsWith(" " + filler)) {
			result = result.slice(0, -(filler.length + 1)).trimEnd();
		}
	}
	return result;
}

/** Try to split a compound word using known phrases as dictionary. */
export function trySplitCompound(text: string, knownPhrases: string[]): string {
	if (text.includes(" ") || text.length < 4) return text;
	for (const phrase of knownPhrases) {
		const words = phrase.split(/\s+/);
		if (words.length < 2) continue;
		if (text === words.join("")) return phrase;
	}
	return text;
}

/** Get mishearing corrections for a language. */
export function getMishearings(lang: string): [RegExp, string][] {
	return MISHEARINGS[lang as LangCode] ?? [];
}

/**
 * Get patterns for a command, merging the given language with English fallback.
 */
export function getPatternsForCommand(
	commandId: string,
	lang: string
): string[] {
	const langPatterns = PATTERNS[lang as LangCode]?.[commandId] ?? [];
	const enPatterns = lang === "en" ? [] : (PATTERNS.en?.[commandId] ?? []);
	const seen = new Set<string>();
	const result: string[] = [];
	for (const p of [...langPatterns, ...enPatterns]) {
		if (!seen.has(p)) {
			seen.add(p);
			result.push(p);
		}
	}
	return result;
}

/**
 * Get the localized label for a command, falling back to English.
 */
export function getLabel(commandId: string, lang: string): string {
	return LABELS[lang as LangCode]?.[commandId] ?? LABELS.en?.[commandId] ?? commandId;
}
