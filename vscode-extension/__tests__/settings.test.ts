import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGet = vi.fn();

vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn(() => ({
			get: mockGet,
		})),
	},
}));

import { getSettings } from "../src/settings";
import { DEFAULT_SETTINGS } from "../../shared/src/types";

describe("getSettings", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Return the default value (second argument) for all config.get calls
		mockGet.mockImplementation((_key: string, defaultValue: any) => defaultValue);
	});

	it("returns DEFAULT_SETTINGS when no config is set", () => {
		const settings = getSettings();
		expect(settings.apiKey).toBe(DEFAULT_SETTINGS.apiKey);
		expect(settings.language).toBe(DEFAULT_SETTINGS.language);
		expect(settings.mode).toBe(DEFAULT_SETTINGS.mode);
		expect(settings.autoCorrect).toBe(DEFAULT_SETTINGS.autoCorrect);
		expect(settings.realtimeModel).toBe(DEFAULT_SETTINGS.realtimeModel);
		expect(settings.batchModel).toBe(DEFAULT_SETTINGS.batchModel);
		expect(settings.correctModel).toBe(DEFAULT_SETTINGS.correctModel);
		expect(settings.streamingDelayMs).toBe(DEFAULT_SETTINGS.streamingDelayMs);
		expect(settings.dualDelay).toBe(DEFAULT_SETTINGS.dualDelay);
		expect(settings.noiseSuppression).toBe(DEFAULT_SETTINGS.noiseSuppression);
	});

	it("reads custom config values when set", () => {
		mockGet.mockImplementation((key: string, defaultValue: any) => {
			const overrides: Record<string, any> = {
				apiKey: "my-api-key",
				language: "en",
				mode: "batch",
				autoCorrect: false,
			};
			return key in overrides ? overrides[key] : defaultValue;
		});

		const settings = getSettings();
		expect(settings.apiKey).toBe("my-api-key");
		expect(settings.language).toBe("en");
		expect(settings.mode).toBe("batch");
		expect(settings.autoCorrect).toBe(false);
		// Non-overridden values should still be defaults
		expect(settings.realtimeModel).toBe(DEFAULT_SETTINGS.realtimeModel);
	});

	it("returns a complete VoxtralSettings object with all fields", () => {
		const settings = getSettings();
		const requiredKeys = Object.keys(DEFAULT_SETTINGS);
		for (const key of requiredKeys) {
			expect(settings).toHaveProperty(key);
		}
	});
});
