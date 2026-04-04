import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock vscode module
const mockEdit = vi.fn(async (callback: any) => {
	callback(mockEditBuilder);
	return true;
});
const mockEditBuilder = {
	replace: vi.fn(),
};
const mockDocument = {
	lineAt: vi.fn((n: number) => ({ text: `line ${n}` })),
	getText: vi.fn((range?: any) => range ? "selected text" : "full document text"),
	offsetAt: vi.fn((pos: any) => pos.line * 100 + pos.character),
	positionAt: vi.fn((offset: number) => ({
		line: Math.floor(offset / 100),
		character: offset % 100,
	})),
};
const mockEditor = {
	selection: {
		active: { line: 5, character: 10 },
	},
	document: mockDocument,
	edit: mockEdit,
	revealRange: vi.fn(),
};

vi.mock("vscode", () => ({
	Position: class Position {
		constructor(public line: number, public character: number) {}
	},
	Range: class Range {
		constructor(public start: any, public end: any) {}
	},
	Selection: class Selection {
		constructor(public anchor: any, public active: any) {}
	},
	commands: {
		executeCommand: vi.fn(),
	},
}));

import { VscodeEditorAdapter } from "../src/vscode-editor-adapter";
import * as vscode from "vscode";

describe("VscodeEditorAdapter", () => {
	let adapter: VscodeEditorAdapter;

	beforeEach(() => {
		vi.clearAllMocks();
		mockEditor.selection = {
			active: { line: 5, character: 10 },
		};
		adapter = new VscodeEditorAdapter(mockEditor as any);
	});

	it("getCursor returns line and ch from selection.active", () => {
		const cursor = adapter.getCursor();
		expect(cursor).toEqual({ line: 5, ch: 10 });
	});

	it("setCursor updates selection and reveals range", () => {
		adapter.setCursor({ line: 3, ch: 7 });
		expect(mockEditor.selection).toBeDefined();
		expect(mockEditor.revealRange).toHaveBeenCalled();
	});

	it("getLine returns document line text", () => {
		expect(adapter.getLine(2)).toBe("line 2");
		expect(mockDocument.lineAt).toHaveBeenCalledWith(2);
	});

	it("getValue returns full document text", () => {
		expect(adapter.getValue()).toBe("full document text");
		expect(mockDocument.getText).toHaveBeenCalledWith();
	});

	it("getRange returns text for a given range", () => {
		const result = adapter.getRange({ line: 0, ch: 0 }, { line: 1, ch: 5 });
		expect(result).toBe("selected text");
		expect(mockDocument.getText).toHaveBeenCalled();
	});

	it("posToOffset converts position to offset", () => {
		const offset = adapter.posToOffset({ line: 2, ch: 15 });
		expect(offset).toBe(215);
		expect(mockDocument.offsetAt).toHaveBeenCalled();
	});

	it("offsetToPos converts offset to position", () => {
		const pos = adapter.offsetToPos(315);
		expect(pos).toEqual({ line: 3, ch: 15 });
		expect(mockDocument.positionAt).toHaveBeenCalledWith(315);
	});

	it("getSelection returns selected text", () => {
		expect(adapter.getSelection()).toBe("selected text");
	});

	it("replaceRange calls editor.edit with replace", () => {
		adapter.replaceRange("new text", { line: 1, ch: 0 }, { line: 1, ch: 5 });
		expect(mockEdit).toHaveBeenCalled();
		expect(mockEditBuilder.replace).toHaveBeenCalled();
	});

	it("replaceRange without `to` uses `from` as both start and end", () => {
		adapter.replaceRange("inserted", { line: 1, ch: 3 });
		expect(mockEdit).toHaveBeenCalled();
		expect(mockEditBuilder.replace).toHaveBeenCalled();
	});

	it("replaceSelection calls editor.edit with selection replace", () => {
		adapter.replaceSelection("replacement");
		expect(mockEdit).toHaveBeenCalled();
		expect(mockEditBuilder.replace).toHaveBeenCalled();
	});

	it("undo calls vscode undo command", () => {
		adapter.undo();
		expect(vscode.commands.executeCommand).toHaveBeenCalledWith("undo");
	});
});
