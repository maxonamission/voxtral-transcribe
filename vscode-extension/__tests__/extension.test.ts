import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSubscriptions: any[] = [];
const mockStatusBarItem = {
	text: "",
	tooltip: "",
	command: "",
	backgroundColor: undefined as any,
	show: vi.fn(),
	dispose: vi.fn(),
};

vi.mock("vscode", () => ({
	window: {
		createStatusBarItem: vi.fn(() => mockStatusBarItem),
		createWebviewPanel: vi.fn(() => ({
			webview: { html: "", postMessage: vi.fn(), onDidReceiveMessage: vi.fn() },
			onDidDispose: vi.fn(),
			dispose: vi.fn(),
		})),
		activeTextEditor: undefined,
		showInformationMessage: vi.fn(),
		showErrorMessage: vi.fn(),
		showWarningMessage: vi.fn(),
	},
	StatusBarAlignment: { Right: 2 },
	ViewColumn: { Beside: 2 },
	ThemeColor: class ThemeColor {
		constructor(public id: string) {}
	},
	commands: {
		registerCommand: vi.fn((id: string, callback: any) => ({
			dispose: vi.fn(),
			id,
			callback,
		})),
		executeCommand: vi.fn(),
	},
	workspace: {
		getConfiguration: vi.fn(() => ({
			get: vi.fn((_key: string, defaultValue: any) => defaultValue),
		})),
	},
}));

import { activate, deactivate } from "../src/extension";
import * as vscode from "vscode";

describe("extension", () => {
	let context: any;

	beforeEach(() => {
		vi.clearAllMocks();
		mockSubscriptions.length = 0;
		context = {
			subscriptions: mockSubscriptions,
			extensionPath: "/mock/extension/path",
		};
	});

	it("activate creates status bar item and registers commands", () => {
		activate(context);

		expect(vscode.window.createStatusBarItem).toHaveBeenCalled();
		expect(mockStatusBarItem.show).toHaveBeenCalled();
		expect(mockStatusBarItem.command).toBe("voxtral.toggleRecording");
		expect(mockStatusBarItem.text).toContain("Voxtral");

		// Status bar + 5 commands + 1 dispose = 7 subscriptions
		expect(context.subscriptions.length).toBe(7);

		// Verify all 5 commands were registered
		expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
			"voxtral.toggleRecording",
			expect.any(Function),
		);
		expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
			"voxtral.startRecording",
			expect.any(Function),
		);
		expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
			"voxtral.stopRecording",
			expect.any(Function),
		);
		expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
			"voxtral.sendChunk",
			expect.any(Function),
		);
		expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
			"voxtral.correctText",
			expect.any(Function),
		);
	});

	it("deactivate runs without error", () => {
		expect(() => deactivate()).not.toThrow();
	});
});
