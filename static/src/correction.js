// Voxtral Transcribe — Copyright (c) 2026 Max Kloosterman
// Licensed under GPL-3.0 — see LICENSE for details
// https://github.com/maxonamission/voxtral-transcribe

/**
 * Text correction via the server API.
 * Pure async function — no DOM dependencies. Testable in isolation.
 */

/**
 * Send text to the correction API and return the corrected version.
 *
 * @param {string} text — text to correct
 * @param {string} systemPrompt — optional system prompt for the correction LLM
 * @returns {Promise<string>} corrected text
 */
export async function correctText(text, systemPrompt = "") {
    const resp = await fetch("/api/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, system_prompt: systemPrompt }),
    });
    const raw = await resp.text();
    let data;
    try {
        data = JSON.parse(raw);
    } catch {
        throw new Error(`Server fout (${resp.status}): ${raw.substring(0, 120)}`);
    }
    if (!resp.ok) throw new Error(data.error || `Server fout ${resp.status}`);
    return data.corrected;
}
