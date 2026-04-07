// Voxtral Transcribe — Copyright (c) 2026 Max Kloosterman
// Licensed under GPL-3.0 — see LICENSE for details
// https://github.com/maxonamission/voxtral-transcribe

import * as vscode from "vscode";
import { type VoxtralSettings, DEFAULT_SETTINGS } from "../../shared/src/types";

/**
 * Reads VS Code configuration and returns a VoxtralSettings object.
 * Falls back to DEFAULT_SETTINGS for any missing values.
 */
export function getSettings(): VoxtralSettings {
	const config = vscode.workspace.getConfiguration("voxtral");

	return {
		settingsVersion: DEFAULT_SETTINGS.settingsVersion,
		apiKey: config.get<string>("apiKey", DEFAULT_SETTINGS.apiKey),
		apiBaseUrl: config.get<string>("apiBaseUrl", DEFAULT_SETTINGS.apiBaseUrl),
		language: config.get<string>("language", DEFAULT_SETTINGS.language),
		realtimeModel: config.get<string>("realtimeModel", DEFAULT_SETTINGS.realtimeModel),
		batchModel: config.get<string>("batchModel", DEFAULT_SETTINGS.batchModel),
		correctModel: config.get<string>("correctModel", DEFAULT_SETTINGS.correctModel),
		autoCorrect: config.get<boolean>("autoCorrect", DEFAULT_SETTINGS.autoCorrect),
		streamingDelayMs: config.get<number>("streamingDelayMs", DEFAULT_SETTINGS.streamingDelayMs),
		dualDelay: config.get<boolean>("dualDelay", DEFAULT_SETTINGS.dualDelay),
		dualDelayFastMs: config.get<number>("dualDelayFastMs", DEFAULT_SETTINGS.dualDelayFastMs),
		dualDelaySlowMs: config.get<number>("dualDelaySlowMs", DEFAULT_SETTINGS.dualDelaySlowMs),
		systemPrompt: config.get<string>("systemPrompt", DEFAULT_SETTINGS.systemPrompt),
		mode: config.get<"realtime" | "batch">("mode", DEFAULT_SETTINGS.mode),
		microphoneDeviceId: DEFAULT_SETTINGS.microphoneDeviceId,
		focusBehavior: DEFAULT_SETTINGS.focusBehavior,
		focusPauseDelaySec: DEFAULT_SETTINGS.focusPauseDelaySec,
		dismissMobileBatchNotice: DEFAULT_SETTINGS.dismissMobileBatchNotice,
		enterToSend: DEFAULT_SETTINGS.enterToSend,
		typingCooldownMs: config.get<number>("typingCooldownMs", DEFAULT_SETTINGS.typingCooldownMs),
		noiseSuppression: config.get<boolean>("noiseSuppression", DEFAULT_SETTINGS.noiseSuppression),
		customCommands: DEFAULT_SETTINGS.customCommands,
		templatesFolder: DEFAULT_SETTINGS.templatesFolder,
	};
}
