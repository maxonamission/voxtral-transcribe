// Voxtral Transcribe — Copyright (c) 2026 Max Kloosterman
// Licensed under GPL-3.0 — see LICENSE for details
// https://github.com/maxonamission/voxtral-transcribe

import * as vscode from "vscode";
import { VscodeEditorAdapter } from "./vscode-editor-adapter";
import { createHttpRequest } from "./vscode-http-adapter";
import { getSettings } from "./settings";
import type { HttpRequestFn } from "../../shared/src/http-adapter";
import type { NotifyFn } from "../../shared/src/editor-adapter";

let statusBarItem: vscode.StatusBarItem;
let isRecording = false;

const httpRequest: HttpRequestFn = createHttpRequest();

const notify: NotifyFn = (message: string) => {
	vscode.window.showInformationMessage(message);
};

function getActiveEditor(): VscodeEditorAdapter | null {
	const editor = vscode.window.activeTextEditor;
	return editor ? new VscodeEditorAdapter(editor) : null;
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

	const editor = getActiveEditor();
	if (!editor) {
		vscode.window.showWarningMessage(
			"Voxtral: No active text editor. Open a file first.",
		);
		return;
	}

	isRecording = true;
	updateStatusBar("recording");

	// TODO: Epic 4 — Audio capture via Webview will provide actual recording
	notify("Voxtral: Recording started (audio capture pending Epic 4)");
}

async function stopRecording(): Promise<void> {
	isRecording = false;
	updateStatusBar("idle");
	notify("Voxtral: Recording stopped");
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
		const { correctText: correct } = await import("../../shared/src/mistral-api");
		const corrected = await correct(selection, settings, httpRequest);
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
		vscode.commands.registerCommand("voxtral.correctText", correctText),
	);
}

export function deactivate(): void {
	isRecording = false;
}
