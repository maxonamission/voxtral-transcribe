// Voxtral Transcribe — Copyright (c) 2026 Max Kloosterman
// Licensed under GPL-3.0 — see LICENSE for details
// https://github.com/maxonamission/voxtral-transcribe

import type { HttpRequestFn, HttpRequestOptions, HttpResponse } from "../../shared/src/http-adapter";

/**
 * Creates an HttpRequestFn using Node.js native fetch (available in VS Code extension host).
 */
export function createHttpRequest(): HttpRequestFn {
	return async (options: HttpRequestOptions): Promise<HttpResponse> => {
		const headers: Record<string, string> = { ...options.headers };
		if (options.contentType) {
			headers["Content-Type"] = options.contentType;
		}

		const response = await fetch(options.url, {
			method: options.method,
			headers,
			body: options.body ?? undefined,
		});

		const text = await response.text();
		let json: any;
		try {
			json = JSON.parse(text);
		} catch {
			json = null;
		}

		return {
			status: response.status,
			json,
			text,
		};
	};
}
