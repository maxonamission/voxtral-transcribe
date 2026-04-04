import { describe, it, expect } from "vitest";
import type { ToWebviewMessage, FromWebviewMessage } from "../src/webview/messages";

/**
 * Type-level tests for the Webview message protocol.
 * Ensures message types are well-formed and all expected message
 * variants exist. These are compile-time + runtime assertions.
 */

describe("Webview message protocol", () => {
	describe("ToWebviewMessage (Extension Host → Webview)", () => {
		it("start message has required fields", () => {
			const msg: ToWebviewMessage = {
				type: "start",
				deviceId: "mic-123",
				noiseSuppression: true,
				mode: "realtime",
			};
			expect(msg.type).toBe("start");
			expect(msg.deviceId).toBe("mic-123");
			expect(msg.noiseSuppression).toBe(true);
			expect(msg.mode).toBe("realtime");
		});

		it("start message supports batch mode", () => {
			const msg: ToWebviewMessage = {
				type: "start",
				deviceId: "",
				noiseSuppression: false,
				mode: "batch",
			};
			expect(msg.mode).toBe("batch");
		});

		it("control messages have only type field", () => {
			const stop: ToWebviewMessage = { type: "stop" };
			const pause: ToWebviewMessage = { type: "pause" };
			const resume: ToWebviewMessage = { type: "resume" };
			const mute: ToWebviewMessage = { type: "mute" };
			const unmute: ToWebviewMessage = { type: "unmute" };
			const flush: ToWebviewMessage = { type: "flush" };

			expect(stop.type).toBe("stop");
			expect(pause.type).toBe("pause");
			expect(resume.type).toBe("resume");
			expect(mute.type).toBe("mute");
			expect(unmute.type).toBe("unmute");
			expect(flush.type).toBe("flush");
		});
	});

	describe("FromWebviewMessage (Webview → Extension Host)", () => {
		it("ready message", () => {
			const msg: FromWebviewMessage = { type: "ready" };
			expect(msg.type).toBe("ready");
		});

		it("started message has mic info", () => {
			const msg: FromWebviewMessage = {
				type: "started",
				micLabel: "Built-in Microphone",
				fallbackUsed: false,
			};
			expect(msg.micLabel).toBe("Built-in Microphone");
			expect(msg.fallbackUsed).toBe(false);
		});

		it("pcm-chunk message contains number array", () => {
			const msg: FromWebviewMessage = {
				type: "pcm-chunk",
				data: [100, -200, 300],
			};
			expect(msg.data).toEqual([100, -200, 300]);
		});

		it("flushed message has audio data and metadata", () => {
			const msg: FromWebviewMessage = {
				type: "flushed",
				data: [0, 1, 2, 3],
				mimeType: "audio/webm;codecs=opus",
				durationSec: 3.5,
			};
			expect(msg.data.length).toBe(4);
			expect(msg.mimeType).toContain("audio/");
			expect(msg.durationSec).toBe(3.5);
		});

		it("stopped message has audio data", () => {
			const msg: FromWebviewMessage = {
				type: "stopped",
				data: [10, 20],
				mimeType: "audio/webm",
				durationSec: 1.0,
			};
			expect(msg.type).toBe("stopped");
		});

		it("error message has description", () => {
			const msg: FromWebviewMessage = {
				type: "error",
				message: "Permission denied",
			};
			expect(msg.message).toBe("Permission denied");
		});
	});
});
