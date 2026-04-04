// Voxtral Transcribe — Copyright (c) 2026 Max Kloosterman
// Licensed under GPL-3.0 — see LICENSE for details
// https://github.com/maxonamission/voxtral-transcribe

/**
 * Platform-independent HTTP request options.
 * Covers all three Mistral API call patterns:
 * - GET /v1/models (JSON response)
 * - POST /v1/audio/transcriptions (multipart/form-data, ArrayBuffer body)
 * - POST /v1/chat/completions (JSON body/response)
 */
export interface HttpRequestOptions {
	url: string;
	method: "GET" | "POST";
	headers: Record<string, string>;
	body?: string | ArrayBuffer;
	contentType?: string;
}

export interface HttpResponse {
	status: number;
	json: any;
	text: string;
}

/**
 * Platform-independent HTTP request function.
 * Obsidian: wraps `requestUrl` from the Obsidian API
 * VS Code: wraps Node.js `fetch`
 */
export type HttpRequestFn = (options: HttpRequestOptions) => Promise<HttpResponse>;
