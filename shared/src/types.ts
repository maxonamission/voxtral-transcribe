// Voxtral Transcribe — Copyright (c) 2026 Max Kloosterman
// Licensed under GPL-3.0 — see LICENSE for details
// https://github.com/maxonamission/voxtral-transcribe

export type FocusBehavior = "pause" | "keep-recording" | "pause-after-delay";

/** User-defined custom voice command */
export interface CustomCommand {
	/** Unique ID (auto-generated) */
	id: string;
	/** Trigger phrases per language (key = lang code, value = phrases) */
	triggers: Record<string, string[]>;
	/** Command type: insert text or open a slot */
	type: "insert" | "slot";
	/** Text to insert (for type "insert") */
	insertText?: string;
	/** Slot prefix (for type "slot") */
	slotPrefix?: string;
	/** Slot suffix (for type "slot") */
	slotSuffix?: string;
	/** Slot exit trigger (for type "slot") */
	slotExit?: "voice" | "enter" | "space" | "enter-or-space";
	/** Pre-configured built-in command (reset to defaults only touches these) */
	builtIn?: boolean;
	/** Human-readable label for the help panel per language (falls back to trigger phrase) */
	labels?: Record<string, string>;
}

export interface VoxtralSettings {
	settingsVersion: number;
	apiKey: string;
	apiBaseUrl: string; // base URL for Mistral-compatible API (e.g. "https://api.mistral.ai" or "http://localhost:8000" for local vLLM)
	language: string;
	realtimeModel: string;
	batchModel: string;
	correctModel: string;
	autoCorrect: boolean;
	streamingDelayMs: number;
	dualDelay: boolean; // dual-delay mode: fast + slow stream for speed + accuracy
	dualDelayFastMs: number;
	dualDelaySlowMs: number;
	systemPrompt: string;
	mode: "realtime" | "batch";
	microphoneDeviceId: string; // "" = system default
	focusBehavior: FocusBehavior;
	focusPauseDelaySec: number; // seconds before pausing (for "pause-after-delay")
	dismissMobileBatchNotice: boolean; // hide "using batch mode" notice on mobile
	enterToSend: boolean; // Enter key acts as tap-to-send when mic is live in batch mode
	typingCooldownMs: number; // ms of silence before mic unmutes after typing
	noiseSuppression: boolean; // browser-level noise suppression, echo cancellation, AGC
	customCommands: CustomCommand[];
	templatesFolder: string; // path to templates folder (e.g. "Templates"), empty = disabled
}

export const DEFAULT_SETTINGS: VoxtralSettings = {
	settingsVersion: 1,
	apiKey: "",
	apiBaseUrl: "https://api.mistral.ai",
	language: "nl",
	realtimeModel: "voxtral-mini-transcribe-realtime-2602",
	batchModel: "voxtral-mini-latest",
	correctModel: "mistral-small-latest",
	autoCorrect: true,
	streamingDelayMs: 480,
	dualDelay: false,
	dualDelayFastMs: 240,
	dualDelaySlowMs: 2400,
	systemPrompt: "",
	mode: "realtime",
	microphoneDeviceId: "",
	focusBehavior: "pause",
	focusPauseDelaySec: 30,
	dismissMobileBatchNotice: false,
	enterToSend: false,
	typingCooldownMs: 800,
	noiseSuppression: false,
	customCommands: [],
	templatesFolder: "",
};
