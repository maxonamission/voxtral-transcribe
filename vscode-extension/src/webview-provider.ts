// Voxtral Transcribe — Copyright (c) 2026 Max Kloosterman
// Licensed under GPL-3.0 — see LICENSE for details
// https://github.com/maxonamission/voxtral-transcribe

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import type { ToWebviewMessage, FromWebviewMessage } from "./webview/messages";

export interface WebviewCallbacks {
	onReady(): void;
	onStarted(micLabel: string, fallbackUsed: boolean): void;
	onPcmChunk(pcmData: ArrayBuffer): void;
	onBatchBlob(data: Uint8Array, mimeType: string, durationSec: number): void;
	onFlushed(data: Uint8Array, mimeType: string, durationSec: number): void;
	onStopped(data: Uint8Array, mimeType: string, durationSec: number): void;
	onError(message: string): void;
}

/**
 * Manages a hidden Webview panel that handles audio capture.
 * The Webview runs in a browser context with access to getUserMedia,
 * AudioWorklet, and MediaRecorder. Audio data is sent to the extension
 * host via postMessage.
 */
export class AudioWebviewProvider {
	private panel: vscode.WebviewPanel | null = null;
	private callbacks: WebviewCallbacks;
	private extensionPath: string;
	private isReady = false;
	private pendingMessages: ToWebviewMessage[] = [];

	constructor(extensionPath: string, callbacks: WebviewCallbacks) {
		this.extensionPath = extensionPath;
		this.callbacks = callbacks;
	}

	/**
	 * Ensure the Webview panel exists and is ready.
	 * Creates the panel if it doesn't exist.
	 */
	ensurePanel(): void {
		if (this.panel) return;

		this.panel = vscode.window.createWebviewPanel(
			"voxtralRecorder",
			"Voxtral Audio",
			{ viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [],
			},
		);

		// Load the recorder HTML
		const htmlPath = path.join(this.extensionPath, "src", "webview", "recorder.html");
		let html: string;
		try {
			html = fs.readFileSync(htmlPath, "utf-8");
		} catch {
			// Fallback: try dist location (when packaged)
			const distPath = path.join(this.extensionPath, "dist", "webview", "recorder.html");
			html = fs.readFileSync(distPath, "utf-8");
		}
		this.panel.webview.html = html;

		// Handle messages from Webview
		this.panel.webview.onDidReceiveMessage(
			(msg: FromWebviewMessage) => this.handleMessage(msg),
		);

		// Handle panel disposal
		this.panel.onDidDispose(() => {
			this.panel = null;
			this.isReady = false;
			this.pendingMessages = [];
		});
	}

	/**
	 * Send a command to the Webview.
	 * Queues the message if the Webview isn't ready yet.
	 */
	send(message: ToWebviewMessage): void {
		if (!this.panel) {
			this.ensurePanel();
		}
		if (this.isReady) {
			void this.panel!.webview.postMessage(message);
		} else {
			this.pendingMessages.push(message);
		}
	}

	/** Dispose the Webview panel */
	dispose(): void {
		if (this.panel) {
			this.panel.dispose();
			this.panel = null;
			this.isReady = false;
		}
	}

	private handleMessage(msg: FromWebviewMessage): void {
		switch (msg.type) {
			case "ready":
				this.isReady = true;
				// Flush pending messages
				for (const pending of this.pendingMessages) {
					void this.panel!.webview.postMessage(pending);
				}
				this.pendingMessages = [];
				this.callbacks.onReady();
				break;

			case "started":
				this.callbacks.onStarted(msg.micLabel, msg.fallbackUsed);
				break;

			case "pcm-chunk": {
				// Convert number[] back to Int16Array → ArrayBuffer
				const int16 = new Int16Array(msg.data);
				this.callbacks.onPcmChunk(int16.buffer);
				break;
			}

			case "batch-blob":
				this.callbacks.onBatchBlob(
					new Uint8Array(msg.data),
					msg.mimeType,
					msg.durationSec,
				);
				break;

			case "flushed":
				this.callbacks.onFlushed(
					new Uint8Array(msg.data),
					msg.mimeType,
					msg.durationSec,
				);
				break;

			case "stopped":
				this.callbacks.onStopped(
					new Uint8Array(msg.data),
					msg.mimeType,
					msg.durationSec,
				);
				break;

			case "error":
				this.callbacks.onError(msg.message);
				break;
		}
	}
}
