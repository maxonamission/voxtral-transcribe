// Voxtral Transcribe — Copyright (c) 2026 Max Kloosterman
// Licensed under GPL-3.0 — see LICENSE for details
// https://github.com/maxonamission/voxtral-transcribe

// ── In-memory log buffer (ring buffer, last 500 entries) ──

const LOG_BUFFER_SIZE = 500;
const logBuffer: string[] = [];

function pushLog(level: string, args: unknown[]): void {
	const ts = new Date().toISOString();
	const msg = args
		.map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
		.join(" ");
	logBuffer.push(`[${ts}] [${level}] ${msg}`);
	if (logBuffer.length > LOG_BUFFER_SIZE) {
		logBuffer.shift();
	}
}

/** Voxtral-specific logger that stores entries in the ring buffer. */
export const vlog = {
	debug: (...args: unknown[]): void => {
		pushLog("DEBUG", args);
		console.debug(...args);
	},
	warn: (...args: unknown[]): void => {
		pushLog("WARN", args);
		console.warn(...args);
	},
	error: (...args: unknown[]): void => {
		pushLog("ERROR", args);
		console.error(...args);
	},
};

/** Get all buffered log entries as a single string. */
export function getLogText(): string {
	return logBuffer.join("\n");
}

/** Get the number of buffered log entries. */
export function getLogCount(): number {
	return logBuffer.length;
}
