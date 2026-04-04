import { describe, it, expect, vi, beforeEach } from "vitest";

import { createHttpRequest } from "../src/vscode-http-adapter";

describe("createHttpRequest", () => {
	const mockFetch = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal("fetch", mockFetch);
	});

	it("sends GET request with correct parameters", async () => {
		mockFetch.mockResolvedValue({
			status: 200,
			text: async () => '{"data":[]}',
		});

		const httpRequest = createHttpRequest();
		const response = await httpRequest({
			url: "https://api.mistral.ai/v1/models",
			method: "GET",
			headers: { Authorization: "Bearer test-key" },
		});

		expect(mockFetch).toHaveBeenCalledWith(
			"https://api.mistral.ai/v1/models",
			expect.objectContaining({
				method: "GET",
				headers: { Authorization: "Bearer test-key" },
			}),
		);
		expect(response.status).toBe(200);
		expect(response.json).toEqual({ data: [] });
	});

	it("sends POST request with JSON body", async () => {
		mockFetch.mockResolvedValue({
			status: 200,
			text: async () => '{"choices":[{"message":{"content":"hello"}}]}',
		});

		const httpRequest = createHttpRequest();
		const body = JSON.stringify({ model: "test", messages: [] });
		const response = await httpRequest({
			url: "https://api.mistral.ai/v1/chat/completions",
			method: "POST",
			headers: {
				Authorization: "Bearer test-key",
			},
			contentType: "application/json",
			body,
		});

		expect(mockFetch).toHaveBeenCalledWith(
			"https://api.mistral.ai/v1/chat/completions",
			expect.objectContaining({
				method: "POST",
				headers: {
					Authorization: "Bearer test-key",
					"Content-Type": "application/json",
				},
				body,
			}),
		);
		expect(response.status).toBe(200);
		expect(response.json.choices[0].message.content).toBe("hello");
	});

	it("sends POST request with ArrayBuffer body (multipart)", async () => {
		mockFetch.mockResolvedValue({
			status: 200,
			text: async () => '{"text":"transcribed text"}',
		});

		const httpRequest = createHttpRequest();
		const buffer = new ArrayBuffer(16);
		const response = await httpRequest({
			url: "https://api.mistral.ai/v1/audio/transcriptions",
			method: "POST",
			headers: { Authorization: "Bearer test-key" },
			contentType: "multipart/form-data; boundary=---",
			body: buffer,
		});

		expect(mockFetch).toHaveBeenCalledWith(
			"https://api.mistral.ai/v1/audio/transcriptions",
			expect.objectContaining({
				method: "POST",
				body: buffer,
			}),
		);
		expect(response.status).toBe(200);
		expect(response.json.text).toBe("transcribed text");
	});

	it("returns null json for non-JSON response", async () => {
		mockFetch.mockResolvedValue({
			status: 500,
			text: async () => "Internal Server Error",
		});

		const httpRequest = createHttpRequest();
		const response = await httpRequest({
			url: "https://api.mistral.ai/v1/models",
			method: "GET",
			headers: {},
		});

		expect(response.status).toBe(500);
		expect(response.json).toBeNull();
		expect(response.text).toBe("Internal Server Error");
	});

	it("does not set Content-Type when contentType is not provided", async () => {
		mockFetch.mockResolvedValue({
			status: 200,
			text: async () => "{}",
		});

		const httpRequest = createHttpRequest();
		await httpRequest({
			url: "https://api.mistral.ai/v1/models",
			method: "GET",
			headers: { Authorization: "Bearer key" },
		});

		const calledHeaders = mockFetch.mock.calls[0][1].headers;
		expect(calledHeaders).not.toHaveProperty("Content-Type");
	});
});
