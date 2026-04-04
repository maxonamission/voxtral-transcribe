import { describe, it, expect, vi, beforeEach } from "vitest";

let messageHandler: ((msg: any) => void) | null = null;
const mockPostMessage = vi.fn();
const mockDispose = vi.fn();

vi.mock("vscode", () => ({
	window: {
		createWebviewPanel: vi.fn(() => ({
			webview: {
				html: "",
				postMessage: mockPostMessage,
				onDidReceiveMessage: vi.fn((handler: any) => {
					messageHandler = handler;
					return { dispose: vi.fn() };
				}),
			},
			onDidDispose: vi.fn((handler: any) => {
				// Store for manual trigger if needed
				return { dispose: vi.fn() };
			}),
			dispose: mockDispose,
		})),
	},
	ViewColumn: { Beside: 2 },
}));

vi.mock("fs", () => ({
	readFileSync: vi.fn(() => "<html><body>mock</body></html>"),
}));

import { AudioWebviewProvider, type WebviewCallbacks } from "../src/webview-provider";
import * as vscode from "vscode";

describe("AudioWebviewProvider", () => {
	let callbacks: WebviewCallbacks;
	let provider: AudioWebviewProvider;

	beforeEach(() => {
		vi.clearAllMocks();
		messageHandler = null;

		callbacks = {
			onReady: vi.fn(),
			onStarted: vi.fn(),
			onPcmChunk: vi.fn(),
			onBatchBlob: vi.fn(),
			onFlushed: vi.fn(),
			onStopped: vi.fn(),
			onError: vi.fn(),
		};

		provider = new AudioWebviewProvider("/mock/path", callbacks);
	});

	it("creates a webview panel on ensurePanel", () => {
		provider.ensurePanel();
		expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
			"voxtralRecorder",
			"Voxtral Audio",
			expect.any(Object),
			expect.objectContaining({ enableScripts: true, retainContextWhenHidden: true }),
		);
	});

	it("queues messages until ready, then flushes", () => {
		provider.ensurePanel();

		// Send before ready — should be queued
		provider.send({ type: "start", deviceId: "", noiseSuppression: false, mode: "realtime" });
		expect(mockPostMessage).not.toHaveBeenCalled();

		// Simulate webview ready
		messageHandler!({ type: "ready" });
		expect(callbacks.onReady).toHaveBeenCalled();
		// Queued message should now be sent
		expect(mockPostMessage).toHaveBeenCalledWith(
			expect.objectContaining({ type: "start" }),
		);
	});

	it("sends messages directly when already ready", () => {
		provider.ensurePanel();
		messageHandler!({ type: "ready" });
		mockPostMessage.mockClear();

		provider.send({ type: "stop" });
		expect(mockPostMessage).toHaveBeenCalledWith({ type: "stop" });
	});

	it("handles 'started' message from webview", () => {
		provider.ensurePanel();
		messageHandler!({ type: "started", micLabel: "Test Mic", fallbackUsed: false });
		expect(callbacks.onStarted).toHaveBeenCalledWith("Test Mic", false);
	});

	it("handles 'pcm-chunk' message — converts number[] to ArrayBuffer", () => {
		provider.ensurePanel();
		const pcmData = [100, -200, 300, -400];
		messageHandler!({ type: "pcm-chunk", data: pcmData });
		expect(callbacks.onPcmChunk).toHaveBeenCalledWith(expect.any(ArrayBuffer));

		// Verify the data was correctly converted
		const receivedBuffer = (callbacks.onPcmChunk as any).mock.calls[0][0];
		const int16View = new Int16Array(receivedBuffer);
		expect(Array.from(int16View)).toEqual(pcmData);
	});

	it("handles 'flushed' message — converts number[] to Uint8Array", () => {
		provider.ensurePanel();
		messageHandler!({ type: "flushed", data: [1, 2, 3], mimeType: "audio/webm", durationSec: 2.5 });
		expect(callbacks.onFlushed).toHaveBeenCalledWith(
			new Uint8Array([1, 2, 3]),
			"audio/webm",
			2.5,
		);
	});

	it("handles 'stopped' message", () => {
		provider.ensurePanel();
		messageHandler!({ type: "stopped", data: [4, 5], mimeType: "audio/ogg", durationSec: 1.0 });
		expect(callbacks.onStopped).toHaveBeenCalledWith(
			new Uint8Array([4, 5]),
			"audio/ogg",
			1.0,
		);
	});

	it("handles 'error' message", () => {
		provider.ensurePanel();
		messageHandler!({ type: "error", message: "Mic permission denied" });
		expect(callbacks.onError).toHaveBeenCalledWith("Mic permission denied");
	});

	it("dispose cleans up the panel", () => {
		provider.ensurePanel();
		provider.dispose();
		expect(mockDispose).toHaveBeenCalled();
	});
});
