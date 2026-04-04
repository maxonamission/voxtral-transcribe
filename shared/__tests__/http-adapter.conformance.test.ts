import { describe, it, expect, vi, beforeEach } from "vitest";
import type { HttpRequestFn, HttpRequestOptions, HttpResponse } from "../src/http-adapter";

/**
 * HttpRequestFn conformance tests.
 * Any implementation of HttpRequestFn must handle these patterns:
 * 1. GET /v1/models — JSON response
 * 2. POST /v1/audio/transcriptions — multipart/form-data with ArrayBuffer
 * 3. POST /v1/chat/completions — JSON body/response
 */

/** Mock HttpRequestFn that echoes back request details */
function createMockHttpRequest(): HttpRequestFn {
	return async (options: HttpRequestOptions): Promise<HttpResponse> => {
		// Simulate different responses based on URL
		if (options.url.includes("/v1/models")) {
			return {
				status: 200,
				json: { data: [{ id: "voxtral-mini-latest" }] },
				text: '{"data":[{"id":"voxtral-mini-latest"}]}',
			};
		}
		if (options.url.includes("/v1/audio/transcriptions")) {
			return {
				status: 200,
				json: { text: "transcribed text" },
				text: '{"text":"transcribed text"}',
			};
		}
		if (options.url.includes("/v1/chat/completions")) {
			return {
				status: 200,
				json: {
					choices: [{ message: { content: "corrected text" } }],
				},
				text: '{"choices":[{"message":{"content":"corrected text"}}]}',
			};
		}
		return { status: 404, json: null, text: "Not Found" };
	};
}

describe("HttpRequestFn conformance", () => {
	let httpRequest: HttpRequestFn;

	beforeEach(() => {
		httpRequest = createMockHttpRequest();
	});

	describe("GET /v1/models", () => {
		it("sends GET request and receives JSON response", async () => {
			const response = await httpRequest({
				url: "https://api.mistral.ai/v1/models",
				method: "GET",
				headers: { Authorization: "Bearer test-key" },
			});

			expect(response.status).toBe(200);
			expect(response.json).toBeDefined();
			expect(response.json.data).toBeInstanceOf(Array);
			expect(response.text).toBeTruthy();
		});
	});

	describe("POST /v1/audio/transcriptions (multipart)", () => {
		it("sends POST with ArrayBuffer body", async () => {
			const audioBuffer = new ArrayBuffer(16);

			const response = await httpRequest({
				url: "https://api.mistral.ai/v1/audio/transcriptions",
				method: "POST",
				headers: { Authorization: "Bearer test-key" },
				contentType: "multipart/form-data; boundary=---",
				body: audioBuffer,
			});

			expect(response.status).toBe(200);
			expect(response.json.text).toBe("transcribed text");
		});
	});

	describe("POST /v1/chat/completions (JSON)", () => {
		it("sends POST with JSON string body", async () => {
			const body = JSON.stringify({
				model: "mistral-small-latest",
				messages: [{ role: "user", content: "correct this" }],
			});

			const response = await httpRequest({
				url: "https://api.mistral.ai/v1/chat/completions",
				method: "POST",
				headers: {
					Authorization: "Bearer test-key",
					"Content-Type": "application/json",
				},
				body,
			});

			expect(response.status).toBe(200);
			expect(response.json.choices[0].message.content).toBe("corrected text");
		});
	});

	describe("HttpResponse contract", () => {
		it("response has status, json, and text fields", async () => {
			const response = await httpRequest({
				url: "https://api.mistral.ai/v1/models",
				method: "GET",
				headers: {},
			});

			expect(response).toHaveProperty("status");
			expect(response).toHaveProperty("json");
			expect(response).toHaveProperty("text");
			expect(typeof response.status).toBe("number");
			expect(typeof response.text).toBe("string");
		});
	});

	describe("HttpRequestOptions contract", () => {
		it("accepts all required fields", async () => {
			// Minimal request
			const response = await httpRequest({
				url: "https://example.com",
				method: "GET",
				headers: {},
			});
			expect(response).toBeDefined();
		});

		it("accepts optional contentType and body", async () => {
			const response = await httpRequest({
				url: "https://api.mistral.ai/v1/chat/completions",
				method: "POST",
				headers: { Authorization: "Bearer key" },
				contentType: "application/json",
				body: "{}",
			});
			expect(response).toBeDefined();
		});

		it("accepts ArrayBuffer body", async () => {
			const response = await httpRequest({
				url: "https://api.mistral.ai/v1/audio/transcriptions",
				method: "POST",
				headers: {},
				body: new ArrayBuffer(8),
			});
			expect(response).toBeDefined();
		});
	});
});
