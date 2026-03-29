import { describe, it, expect, vi, beforeEach } from "vitest";
import { correctText } from "../correction.js";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
    mockFetch.mockReset();
});

describe("correctText", () => {
    it("returns corrected text on success", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            text: () => Promise.resolve(JSON.stringify({ corrected: "Hallo wereld." })),
        });

        const result = await correctText("hallo wereld");
        expect(result).toBe("Hallo wereld.");
        expect(mockFetch).toHaveBeenCalledWith("/api/correct", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: "hallo wereld", system_prompt: "" }),
        });
    });

    it("passes system prompt to API", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            text: () => Promise.resolve(JSON.stringify({ corrected: "OK" })),
        });

        await correctText("test", "custom prompt");
        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.system_prompt).toBe("custom prompt");
    });

    it("throws on HTTP error with error message", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            text: () => Promise.resolve(JSON.stringify({ error: "Rate limit exceeded" })),
        });

        await expect(correctText("test")).rejects.toThrow("Rate limit exceeded");
    });

    it("throws on non-JSON response", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 502,
            text: () => Promise.resolve("Bad Gateway"),
        });

        await expect(correctText("test")).rejects.toThrow("Server fout (502)");
    });

    it("throws on HTTP error without error field", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 429,
            text: () => Promise.resolve(JSON.stringify({ detail: "too many requests" })),
        });

        await expect(correctText("test")).rejects.toThrow("Server fout 429");
    });
});
