import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EditorAdapter, EditorPosition } from "../src/editor-adapter";

/**
 * EditorAdapter conformance tests.
 * Any implementation of EditorAdapter must pass these tests.
 * Tests use a simple in-memory text buffer implementation.
 */

/** Simple in-memory EditorAdapter for testing */
class MockEditorAdapter implements EditorAdapter {
	private lines: string[];
	private cursor: EditorPosition = { line: 0, ch: 0 };
	private selectionStart: EditorPosition = { line: 0, ch: 0 };
	private selectionEnd: EditorPosition = { line: 0, ch: 0 };
	private undoStack: string[][] = [];

	constructor(text: string) {
		this.lines = text.split("\n");
	}

	getCursor(): EditorPosition {
		return { ...this.cursor };
	}

	setCursor(pos: EditorPosition): void {
		this.cursor = { ...pos };
		this.selectionStart = { ...pos };
		this.selectionEnd = { ...pos };
	}

	replaceRange(text: string, from: EditorPosition, to?: EditorPosition): void {
		this.undoStack.push([...this.lines]);
		const end = to ?? from;
		const before = this.lines[from.line].substring(0, from.ch);
		const after = this.lines[end.line].substring(end.ch);
		const newLines = (before + text + after).split("\n");

		this.lines.splice(from.line, end.line - from.line + 1, ...newLines);

		// Move cursor to end of insertion
		const lastNewLine = newLines.length - 1;
		this.cursor = {
			line: from.line + lastNewLine,
			ch: lastNewLine === 0 ? from.ch + text.length : newLines[lastNewLine].length - after.length,
		};
	}

	getLine(n: number): string {
		return this.lines[n] ?? "";
	}

	getValue(): string {
		return this.lines.join("\n");
	}

	getRange(from: EditorPosition, to: EditorPosition): string {
		if (from.line === to.line) {
			return this.lines[from.line].substring(from.ch, to.ch);
		}
		const result = [this.lines[from.line].substring(from.ch)];
		for (let i = from.line + 1; i < to.line; i++) {
			result.push(this.lines[i]);
		}
		result.push(this.lines[to.line].substring(0, to.ch));
		return result.join("\n");
	}

	posToOffset(pos: EditorPosition): number {
		let offset = 0;
		for (let i = 0; i < pos.line; i++) {
			offset += this.lines[i].length + 1; // +1 for newline
		}
		return offset + pos.ch;
	}

	offsetToPos(offset: number): EditorPosition {
		let remaining = offset;
		for (let line = 0; line < this.lines.length; line++) {
			if (remaining <= this.lines[line].length) {
				return { line, ch: remaining };
			}
			remaining -= this.lines[line].length + 1;
		}
		const lastLine = this.lines.length - 1;
		return { line: lastLine, ch: this.lines[lastLine].length };
	}

	getSelection(): string {
		return this.getRange(this.selectionStart, this.selectionEnd);
	}

	replaceSelection(text: string): void {
		this.replaceRange(text, this.selectionStart, this.selectionEnd);
	}

	undo(): void {
		if (this.undoStack.length > 0) {
			this.lines = this.undoStack.pop()!;
		}
	}

	// Test helper: set selection range
	setSelection(start: EditorPosition, end: EditorPosition): void {
		this.selectionStart = { ...start };
		this.selectionEnd = { ...end };
		this.cursor = { ...end };
	}
}

describe("EditorAdapter conformance", () => {
	let editor: MockEditorAdapter;

	beforeEach(() => {
		editor = new MockEditorAdapter("Hello World\nSecond line\nThird line");
	});

	describe("getCursor / setCursor", () => {
		it("returns initial cursor at origin", () => {
			expect(editor.getCursor()).toEqual({ line: 0, ch: 0 });
		});

		it("setCursor updates position", () => {
			editor.setCursor({ line: 1, ch: 3 });
			expect(editor.getCursor()).toEqual({ line: 1, ch: 3 });
		});

		it("getCursor returns a copy (not a reference)", () => {
			editor.setCursor({ line: 1, ch: 5 });
			const pos = editor.getCursor();
			pos.line = 99;
			expect(editor.getCursor().line).toBe(1);
		});
	});

	describe("getLine", () => {
		it("returns correct line text", () => {
			expect(editor.getLine(0)).toBe("Hello World");
			expect(editor.getLine(1)).toBe("Second line");
			expect(editor.getLine(2)).toBe("Third line");
		});
	});

	describe("getValue", () => {
		it("returns full document text", () => {
			expect(editor.getValue()).toBe("Hello World\nSecond line\nThird line");
		});
	});

	describe("getRange", () => {
		it("returns text within a single line", () => {
			expect(editor.getRange({ line: 0, ch: 0 }, { line: 0, ch: 5 })).toBe("Hello");
		});

		it("returns text spanning multiple lines", () => {
			expect(editor.getRange({ line: 0, ch: 6 }, { line: 1, ch: 6 })).toBe("World\nSecond");
		});
	});

	describe("posToOffset / offsetToPos", () => {
		it("converts position to offset correctly", () => {
			// "Hello World\nSecond line\nThird line"
			expect(editor.posToOffset({ line: 0, ch: 0 })).toBe(0);
			expect(editor.posToOffset({ line: 0, ch: 5 })).toBe(5);
			expect(editor.posToOffset({ line: 1, ch: 0 })).toBe(12); // after "Hello World\n"
			expect(editor.posToOffset({ line: 2, ch: 0 })).toBe(24); // after "Second line\n"
		});

		it("converts offset to position correctly", () => {
			expect(editor.offsetToPos(0)).toEqual({ line: 0, ch: 0 });
			expect(editor.offsetToPos(5)).toEqual({ line: 0, ch: 5 });
			expect(editor.offsetToPos(12)).toEqual({ line: 1, ch: 0 });
			expect(editor.offsetToPos(24)).toEqual({ line: 2, ch: 0 });
		});

		it("roundtrips correctly", () => {
			const pos = { line: 1, ch: 7 };
			const offset = editor.posToOffset(pos);
			expect(editor.offsetToPos(offset)).toEqual(pos);
		});
	});

	describe("replaceRange", () => {
		it("inserts text at a position (from === to)", () => {
			editor.replaceRange("INSERTED ", { line: 0, ch: 0 });
			expect(editor.getLine(0)).toBe("INSERTED Hello World");
		});

		it("replaces a range within a single line", () => {
			editor.replaceRange("Goodbye", { line: 0, ch: 0 }, { line: 0, ch: 5 });
			expect(editor.getLine(0)).toBe("Goodbye World");
		});

		it("replaces across multiple lines", () => {
			editor.replaceRange("REPLACED", { line: 0, ch: 6 }, { line: 1, ch: 6 });
			expect(editor.getValue()).toBe("Hello REPLACED line\nThird line");
		});
	});

	describe("getSelection / replaceSelection", () => {
		it("returns empty string when no selection", () => {
			expect(editor.getSelection()).toBe("");
		});

		it("returns selected text", () => {
			(editor as any).setSelection({ line: 0, ch: 0 }, { line: 0, ch: 5 });
			expect(editor.getSelection()).toBe("Hello");
		});

		it("replaces selected text", () => {
			(editor as any).setSelection({ line: 0, ch: 0 }, { line: 0, ch: 5 });
			editor.replaceSelection("Goodbye");
			expect(editor.getLine(0)).toBe("Goodbye World");
		});
	});

	describe("undo", () => {
		it("undoes the last replaceRange", () => {
			const before = editor.getValue();
			editor.replaceRange("X", { line: 0, ch: 0 });
			expect(editor.getValue()).not.toBe(before);
			editor.undo();
			expect(editor.getValue()).toBe(before);
		});
	});
});
