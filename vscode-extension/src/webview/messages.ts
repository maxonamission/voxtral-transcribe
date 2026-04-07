// Voxtral Transcribe — Copyright (c) 2026 Max Kloosterman
// Licensed under GPL-3.0 — see LICENSE for details
// https://github.com/maxonamission/voxtral-transcribe

/**
 * Messages from Extension Host → Webview
 */
export type ToWebviewMessage =
	| { type: "start"; deviceId: string; noiseSuppression: boolean; mode: "realtime" | "batch" }
	| { type: "stop" }
	| { type: "pause" }
	| { type: "resume" }
	| { type: "mute" }
	| { type: "unmute" }
	| { type: "flush" };

/**
 * Messages from Webview → Extension Host
 */
export type FromWebviewMessage =
	| { type: "ready" }
	| { type: "started"; micLabel: string; fallbackUsed: boolean }
	| { type: "pcm-chunk"; data: number[] }
	| { type: "batch-blob"; data: number[]; mimeType: string; durationSec: number }
	| { type: "flushed"; data: number[]; mimeType: string; durationSec: number }
	| { type: "stopped"; data: number[]; mimeType: string; durationSec: number }
	| { type: "error"; message: string };
