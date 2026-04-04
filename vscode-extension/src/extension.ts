// Voxtral Transcribe — Copyright (c) 2026 Max Kloosterman
// Licensed under GPL-3.0 — see LICENSE for details
// https://github.com/maxonamission/voxtral-transcribe

import * as vscode from "vscode";
import { VscodeEditorAdapter } from "./vscode-editor-adapter";
import { createHttpRequest } from "./vscode-http-adapter";
import { getSettings } from "./settings";
import { AudioWebviewProvider } from "./webview-provider";
import type { HttpRequestFn } from "../../shared/src/http-adapter";
import type { NotifyFn, EditorAdapter } from "../../shared/src/editor-adapter";
import type { SessionCallbacks } from "../../shared/src/realtime-session";
import { RealtimeSession } from "../../shared/src/realtime-session";
import { DualDelaySession } from "../../shared/src/dual-delay-session";
import { DictationTracker } from "../../shared/src/dictation-tracker";
import {
	transcribeBatch,
	correctText as correctTextApi,
	isLikelyHallucination,
} from "../../shared/src/mistral-api";
import {
	processText,
	matchCommand,
	setLanguage,
	loadCustomCommands,
	loadCustomCommandTriggers,
} from "../../shared/src/voice-commands";

let statusBarItem: vscode.StatusBarItem;
let isRecording = false;
let webviewProvider: AudioWebviewProvider | null = null;
let realtimeSession: RealtimeSession | null = null;
let dualDelaySession: DualDelaySession | null = null;
let tracker = new DictationTracker();
let extensionPath = "";

const httpRequest: HttpRequestFn = createHttpRequest();

const notify: NotifyFn = (message: string) => {
	vscode.window.showInformationMessage(message);
};

function getActiveEditorAdapter(): EditorAdapter | null {
	const editor = vscode.window.activeTextEditor;
	return editor ? new VscodeEditorAdapter(editor) : null;
}

function getSessionCallbacks(): SessionCallbacks {
	return {
		updateStatusBar: (state) => updateStatusBar(state === "slot" ? "recording" : state),
		stopRecording: () => { void stopRecording(); },
		isRecording: () => isRecording,
		getEditor: () => getActiveEditorAdapter(),
		notify,
	};
}

function updateStatusBar(state: "idle" | "recording" | "processing"): void {
	switch (state) {
		case "idle":
			statusBarItem.text = "$(mic) Voxtral";
			statusBarItem.tooltip = "Click to start recording";
			statusBarItem.backgroundColor = undefined;
			break;
		case "recording":
			statusBarItem.text = "$(pulse) Recording...";
			statusBarItem.tooltip = "Click to stop recording";
			statusBarItem.backgroundColor = new vscode.ThemeColor(
				"statusBarItem.warningBackground",
			);
			break;
		case "processing":
			statusBarItem.text = "$(sync~spin) Processing...";
			statusBarItem.tooltip = "Transcribing audio";
			statusBarItem.backgroundColor = undefined;
			break;
	}
}

async function toggleRecording(): Promise<void> {
	if (isRecording) {
		await stopRecording();
	} else {
		await startRecording();
	}
}

async function startRecording(): Promise<void> {
	const settings = getSettings();
	if (!settings.apiKey) {
		vscode.window.showErrorMessage(
			"Voxtral: Please set your Mistral API key in the extension settings.",
		);
		return;
	}

	const editor = getActiveEditorAdapter();
	if (!editor) {
		vscode.window.showWarningMessage(
			"Voxtral: No active text editor. Open a file first.",
		);
		return;
	}

	// Initialize language and commands
	setLanguage(settings.language);
	loadCustomCommands(settings.customCommands);
	loadCustomCommandTriggers(settings.customCommands);

	isRecording = true;
	updateStatusBar("recording");

	// Start realtime session if applicable
	if (settings.mode === "realtime") {
		tracker.reset();
		if (settings.dualDelay) {
			dualDelaySession = new DualDelaySession(settings, tracker, getSessionCallbacks());
			await dualDelaySession.start(editor);
		} else {
			realtimeSession = new RealtimeSession(settings, tracker, getSessionCallbacks());
			await realtimeSession.start(editor);
		}
	}

	// Create and start the audio webview
	if (!webviewProvider) {
		webviewProvider = new AudioWebviewProvider(extensionPath, {
			onReady: () => {
				// Webview is ready, send start command
				webviewProvider!.send({
					type: "start",
					deviceId: settings.microphoneDeviceId || "",
					noiseSuppression: settings.noiseSuppression,
					mode: settings.mode,
				});
			},
			onStarted: (micLabel, fallbackUsed) => {
				if (fallbackUsed) {
					notify("Selected mic unavailable — using default");
				}
				notify(`Voxtral: Recording started (${micLabel})`);
			},
			onPcmChunk: (pcmData) => {
				if (dualDelaySession) {
					dualDelaySession.sendAudio(pcmData);
				} else if (realtimeSession) {
					realtimeSession.sendAudio(pcmData);
				}
			},
			onBatchBlob: () => { /* unused */ },
			onFlushed: (data, mimeType, durationSec) => {
				void handleBatchChunk(data, mimeType, durationSec);
			},
			onStopped: (data, mimeType, durationSec) => {
				void handleBatchStop(data, mimeType, durationSec);
			},
			onError: (message) => {
				vscode.window.showErrorMessage(`Voxtral recording error: ${message}`);
				isRecording = false;
				updateStatusBar("idle");
			},
		});
	}
	webviewProvider.ensurePanel();
	// If webview was already ready (retained context), send start directly
	webviewProvider.send({
		type: "start",
		deviceId: settings.microphoneDeviceId || "",
		noiseSuppression: settings.noiseSuppression,
		mode: settings.mode,
	});
}

async function stopRecording(): Promise<void> {
	isRecording = false;
	updateStatusBar("processing");

	const settings = getSettings();

	if (settings.mode === "realtime") {
		const editor = getActiveEditorAdapter();
		if (dualDelaySession) {
			await dualDelaySession.stop();
			dualDelaySession = null;
		} else if (realtimeSession) {
			if (editor) {
				await realtimeSession.stop(editor);
			}
			realtimeSession = null;
		}

		// Auto-correct after realtime stop
		if (settings.autoCorrect && editor) {
			await tracker.autoCorrectAfterStop(editor, settings, httpRequest);
		}
		tracker.reset();
	}

	// Tell webview to stop recording
	if (webviewProvider) {
		webviewProvider.send({ type: "stop" });
	}

	updateStatusBar("idle");
	notify("Voxtral: Recording stopped");
}

async function sendChunk(): Promise<void> {
	if (!isRecording || getSettings().mode !== "batch") return;
	if (webviewProvider) {
		webviewProvider.send({ type: "flush" });
	}
}

async function handleBatchChunk(data: Uint8Array, mimeType: string, durationSec: number): Promise<void> {
	if (data.length === 0) {
		updateStatusBar("recording");
		return;
	}

	const settings = getSettings();
	const editor = getActiveEditorAdapter();
	if (!editor) return;

	try {
		updateStatusBar("processing");
		const blob = new Blob([data], { type: mimeType });

		let text = await transcribeBatch(blob, settings, httpRequest);

		if (text && isLikelyHallucination(text, durationSec)) {
			updateStatusBar("recording");
			return;
		}

		const hasCommand = text ? matchCommand(text) !== null : false;

		if (settings.autoCorrect && text && !hasCommand) {
			text = await correctTextApi(text, settings, httpRequest);
		}

		updateStatusBar("recording");
		if (text) {
			const offsetBefore = editor.posToOffset(editor.getCursor());
			const stopRequested = processText(editor, text);
			const offsetAfter = editor.posToOffset(editor.getCursor());
			if (offsetAfter > offsetBefore) {
				tracker.addRange(offsetBefore, offsetAfter);
			}
			if (stopRequested) {
				await stopRecording();
			}
		}
	} catch (e: any) {
		updateStatusBar("recording");
		vscode.window.showErrorMessage(`Voxtral chunk failed: ${e.message}`);
	}
}

async function handleBatchStop(data: Uint8Array, mimeType: string, durationSec: number): Promise<void> {
	if (data.length === 0) return;

	const settings = getSettings();
	const editor = getActiveEditorAdapter();
	if (!editor) return;

	try {
		const blob = new Blob([data], { type: mimeType });
		let text = await transcribeBatch(blob, settings, httpRequest);

		if (text && isLikelyHallucination(text, durationSec)) {
			return;
		}

		const hasCommand = text ? matchCommand(text) !== null : false;

		if (settings.autoCorrect && text && !hasCommand) {
			text = await correctTextApi(text, settings, httpRequest);
		}

		if (text) {
			processText(editor, text);
		}
	} catch (e: any) {
		vscode.window.showErrorMessage(`Voxtral transcription failed: ${e.message}`);
	}
}

async function correctText(): Promise<void> {
	const settings = getSettings();
	if (!settings.apiKey) {
		vscode.window.showErrorMessage(
			"Voxtral: Please set your Mistral API key in the extension settings.",
		);
		return;
	}

	const vsEditor = vscode.window.activeTextEditor;
	if (!vsEditor) {
		vscode.window.showWarningMessage("Voxtral: No active text editor.");
		return;
	}

	const selection = vsEditor.document.getText(vsEditor.selection);
	if (!selection) {
		vscode.window.showWarningMessage("Voxtral: Select text to correct first.");
		return;
	}

	updateStatusBar("processing");
	try {
		const corrected = await correctTextApi(selection, settings, httpRequest);
		if (corrected && corrected !== selection) {
			await vsEditor.edit((editBuilder) => {
				editBuilder.replace(vsEditor.selection, corrected);
			});
			notify("Voxtral: Text corrected");
		} else {
			notify("Voxtral: No corrections needed");
		}
	} catch (err: any) {
		vscode.window.showErrorMessage(`Voxtral correction failed: ${err.message}`);
	} finally {
		updateStatusBar(isRecording ? "recording" : "idle");
	}
}

export function activate(context: vscode.ExtensionContext): void {
	extensionPath = context.extensionPath;

	// Status bar
	statusBarItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Right,
		100,
	);
	statusBarItem.command = "voxtral.toggleRecording";
	updateStatusBar("idle");
	statusBarItem.show();
	context.subscriptions.push(statusBarItem);

	// Commands
	context.subscriptions.push(
		vscode.commands.registerCommand("voxtral.toggleRecording", toggleRecording),
		vscode.commands.registerCommand("voxtral.startRecording", startRecording),
		vscode.commands.registerCommand("voxtral.stopRecording", stopRecording),
		vscode.commands.registerCommand("voxtral.sendChunk", sendChunk),
		vscode.commands.registerCommand("voxtral.correctText", correctText),
	);

	// Cleanup on deactivate
	context.subscriptions.push({
		dispose: () => {
			if (webviewProvider) {
				webviewProvider.dispose();
				webviewProvider = null;
			}
		},
	});
}

export function deactivate(): void {
	isRecording = false;
	if (webviewProvider) {
		webviewProvider.dispose();
		webviewProvider = null;
	}
	realtimeSession = null;
	dualDelaySession = null;
}
