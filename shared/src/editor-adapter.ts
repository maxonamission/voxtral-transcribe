// Voxtral Transcribe — Copyright (c) 2026 Max Kloosterman
// Licensed under GPL-3.0 — see LICENSE for details
// https://github.com/maxonamission/voxtral-transcribe

/**
 * Platform-independent editor position (line + character offset).
 * Compatible with Obsidian's EditorPosition and VS Code's Position.
 */
export interface EditorPosition {
	line: number;
	ch: number;
}

/**
 * Platform-independent editor abstraction.
 *
 * Obsidian's Editor natively implements this interface (no wrapper needed).
 * VS Code requires a thin adapter around vscode.TextEditor.
 */
export interface EditorAdapter {
	getCursor(): EditorPosition;
	setCursor(pos: EditorPosition): void;
	replaceRange(text: string, from: EditorPosition, to?: EditorPosition): void;
	getLine(n: number): string;
	getValue(): string;
	getRange(from: EditorPosition, to: EditorPosition): string;
	posToOffset(pos: EditorPosition): number;
	offsetToPos(offset: number): EditorPosition;
	getSelection(): string;
	replaceSelection(text: string): void;
	undo(): void;
}

/**
 * Platform-independent notification function.
 * Obsidian: wraps `new Notice(message, durationMs)`
 * VS Code: wraps `vscode.window.showInformationMessage(message)`
 */
export type NotifyFn = (message: string, durationMs?: number) => void;
