// Voxtral Transcribe — Copyright (c) 2026 Max Kloosterman
// Licensed under GPL-3.0 — see LICENSE for details
// https://github.com/maxonamission/voxtral-transcribe

import * as vscode from "vscode";
import type { EditorAdapter, EditorPosition } from "../../shared/src/editor-adapter";

/**
 * Adapts a vscode.TextEditor to the shared EditorAdapter interface.
 *
 * Note: replaceRange/replaceSelection/setCursor use async workspace edits
 * but the EditorAdapter interface is synchronous. We fire-and-forget the
 * edit promise — this matches how Obsidian's Editor works (synchronous API,
 * batched updates under the hood).
 */
export class VscodeEditorAdapter implements EditorAdapter {
	constructor(private readonly editor: vscode.TextEditor) {}

	getCursor(): EditorPosition {
		const pos = this.editor.selection.active;
		return { line: pos.line, ch: pos.character };
	}

	setCursor(pos: EditorPosition): void {
		const vpos = new vscode.Position(pos.line, pos.ch);
		this.editor.selection = new vscode.Selection(vpos, vpos);
		this.editor.revealRange(new vscode.Range(vpos, vpos));
	}

	replaceRange(text: string, from: EditorPosition, to?: EditorPosition): void {
		const start = new vscode.Position(from.line, from.ch);
		const end = to
			? new vscode.Position(to.line, to.ch)
			: start;
		void this.editor.edit((editBuilder) => {
			editBuilder.replace(new vscode.Range(start, end), text);
		});
	}

	getLine(n: number): string {
		return this.editor.document.lineAt(n).text;
	}

	getValue(): string {
		return this.editor.document.getText();
	}

	getRange(from: EditorPosition, to: EditorPosition): string {
		const range = new vscode.Range(
			new vscode.Position(from.line, from.ch),
			new vscode.Position(to.line, to.ch),
		);
		return this.editor.document.getText(range);
	}

	posToOffset(pos: EditorPosition): number {
		return this.editor.document.offsetAt(
			new vscode.Position(pos.line, pos.ch),
		);
	}

	offsetToPos(offset: number): EditorPosition {
		const pos = this.editor.document.positionAt(offset);
		return { line: pos.line, ch: pos.character };
	}

	getSelection(): string {
		return this.editor.document.getText(this.editor.selection);
	}

	replaceSelection(text: string): void {
		void this.editor.edit((editBuilder) => {
			editBuilder.replace(this.editor.selection, text);
		});
	}

	undo(): void {
		void vscode.commands.executeCommand("undo");
	}
}
