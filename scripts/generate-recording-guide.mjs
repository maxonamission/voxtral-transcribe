#!/usr/bin/env node
// Voxtral Transcribe — Copyright (c) 2026 Max Kloosterman
// Licensed under GPL-3.0 — see LICENSE for details
// https://github.com/maxonamission/voxtral-transcribe

/**
 * Generate a recording guide (Markdown) for audio integration tests.
 *
 * Reads all language JSON files and outputs a guide listing every
 * voice command with its trigger phrases, grouped by language.
 * This guide helps contributors record the right audio samples.
 *
 * Usage: node scripts/generate-recording-guide.mjs > tests/audio-integration/RECORDING-GUIDE.md
 */

import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const langDir = join(__dirname, "..", "obsidian-plugin", "src", "languages");

const files = readdirSync(langDir).filter(f => f.endsWith(".json")).sort();

const langs = files.map(f => {
    const data = JSON.parse(readFileSync(join(langDir, f), "utf-8"));
    return data;
});

// Header
console.log("# Voice Command Recording Guide");
console.log();
console.log("This guide is auto-generated from the language JSON files.");
console.log("Regenerate with: `node scripts/generate-recording-guide.mjs > tests/audio-integration/RECORDING-GUIDE.md`");
console.log();
console.log(`Last generated: ${new Date().toISOString().split("T")[0]}`);
console.log();

// Recording instructions
console.log("## Recording instructions");
console.log();
console.log("### Equipment");
console.log("- Use a standard laptop microphone, phone, or headset — the same equipment end users would use.");
console.log("- No studio microphone needed — we want realistic conditions.");
console.log();
console.log("### Environment");
console.log("- **Quiet room** preferred for the primary sample set.");
console.log("- Optionally record a separate set with **light background noise** (cafe, office) to test robustness.");
console.log("- Avoid echo-heavy rooms (bathrooms, stairwells).");
console.log();
console.log("### How to record");
console.log("1. Use any audio recorder (Audacity, phone voice memo, `arecord`, etc.).");
console.log("2. Format: **WAV, 16kHz, mono, 16-bit PCM** (native Voxtral input format).");
console.log("   - If your recorder outputs a different format, convert with: `ffmpeg -i input.m4a -ar 16000 -ac 1 -sample_fmt s16 output.wav`");
console.log("3. Each recording should be **2-5 seconds** — just the command phrase, no extra silence.");
console.log("4. Speak at **normal conversational speed** — not overly careful or slow.");
console.log("5. Leave ~0.5s silence at the start and end (natural pause before/after speaking).");
console.log();
console.log("### File naming");
console.log("- Pattern: `{lang}/{command-id}--{variant}.wav`");
console.log("- Examples: `nl/newParagraph--nieuwe-alinea.wav`, `nl/stopRecording--stopopname.wav`");
console.log("- For negative samples (normal speech): `{lang}/negative--{description}.wav`");
console.log();
console.log("### What to record per language");
console.log("- **At minimum**: the **first** (most common) trigger phrase for each command.");
console.log("- **Ideally**: 2-3 variants per command, especially for commands with many trigger phrases.");
console.log("- **Negative samples**: 3-5 normal sentences that should NOT match any command.");
console.log("  - Example: \"Het weer is mooi vandaag\" (NL), \"I went to the store\" (EN)");
console.log();
console.log("### Priority commands");
console.log("Focus on these commands first — they are most commonly used:");
console.log("- `newParagraph`, `newLine`, `bulletPoint`, `todoItem`, `stopRecording`");
console.log("- Then: `heading1`-`heading3`, `numberedItem`, `undo`, `colon`");
console.log("- Then: formatting commands (`boldOpen`, `italicOpen`, etc.)");
console.log();

// Per-language command tables
console.log("---");
console.log();
console.log("## Commands per language");
console.log();

for (const lang of langs) {
    console.log(`### ${lang.name} (\`${lang.code}\`)`);
    console.log();
    console.log("| Command | Label | Trigger phrases | Priority |");
    console.log("|---------|-------|-----------------|----------|");

    const priority1 = ["newParagraph", "newLine", "bulletPoint", "todoItem", "stopRecording"];
    const priority2 = ["heading1", "heading2", "heading3", "numberedItem", "undo", "colon",
                        "deleteLastParagraph", "deleteLastLine"];

    for (const [cmdId, phrases] of Object.entries(lang.patterns)) {
        const label = lang.labels[cmdId] || cmdId;
        const phraseList = phrases.map(p => `\`${p}\``).join(", ");
        const prio = priority1.includes(cmdId) ? "High" :
                     priority2.includes(cmdId) ? "Medium" : "Low";
        console.log(`| ${cmdId} | ${label} | ${phraseList} | ${prio} |`);
    }
    console.log();
}
