#!/usr/bin/env node
// Voxtral Transcribe — Copyright (c) 2026 Max Kloosterman
// Licensed under GPL-3.0 — see LICENSE for details
// https://github.com/maxonamission/voxtral-transcribe

/**
 * Generate test audio samples for voice command integration tests
 * using ElevenLabs TTS API.
 *
 * Reads all language JSON files and generates a WAV file for the
 * primary trigger phrase of each command in each language.
 *
 * Prerequisites:
 *   npm install @elevenlabs/elevenlabs-js
 *   export ELEVENLABS_API_KEY=your-key
 *
 * Usage:
 *   node scripts/generate-test-audio.mjs                  # all languages
 *   node scripts/generate-test-audio.mjs --lang nl,en     # specific languages
 *   node scripts/generate-test-audio.mjs --dry-run        # show what would be generated
 *   node scripts/generate-test-audio.mjs --background     # also mix with background noise (requires ffmpeg)
 */

import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const langDir = join(__dirname, "..", "obsidian-plugin", "src", "languages");
const outputDir = join(__dirname, "..", "tests", "audio-integration", "samples");

// ── Parse args ──

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const withBackground = args.includes("--background");
const langFilter = args.find(a => a.startsWith("--lang="))?.split("=")[1]?.split(",")
    || (args.includes("--lang") ? args[args.indexOf("--lang") + 1]?.split(",") : null);

// ── Background noise files ──
// Place background audio files in tests/audio-integration/backgrounds/
// The script mixes each voice sample with each background at -15dB.
const backgroundDir = join(__dirname, "..", "tests", "audio-integration", "backgrounds");

// ── ElevenLabs voice IDs per language ──
// Using ElevenLabs' default/recommended voices.
// Override with --voice-id if needed.
const VOICE_MAP = {
    nl: { name: "Dutch", voiceId: "pNInz6obpgDQGcFmaJgB" }, // Adam (multilingual)
    en: { name: "English", voiceId: "pNInz6obpgDQGcFmaJgB" },
    fr: { name: "French", voiceId: "pNInz6obpgDQGcFmaJgB" },
    de: { name: "German", voiceId: "pNInz6obpgDQGcFmaJgB" },
    es: { name: "Spanish", voiceId: "pNInz6obpgDQGcFmaJgB" },
    pt: { name: "Portuguese", voiceId: "pNInz6obpgDQGcFmaJgB" },
    it: { name: "Italian", voiceId: "pNInz6obpgDQGcFmaJgB" },
    ru: { name: "Russian", voiceId: "pNInz6obpgDQGcFmaJgB" },
    zh: { name: "Chinese", voiceId: "pNInz6obpgDQGcFmaJgB" },
    hi: { name: "Hindi", voiceId: "pNInz6obpgDQGcFmaJgB" },
    ar: { name: "Arabic", voiceId: "pNInz6obpgDQGcFmaJgB" },
    ja: { name: "Japanese", voiceId: "pNInz6obpgDQGcFmaJgB" },
    ko: { name: "Korean", voiceId: "pNInz6obpgDQGcFmaJgB" },
};

// ── Load language data ──

const files = readdirSync(langDir).filter(f => f.endsWith(".json")).sort();
const langs = files.map(f => JSON.parse(readFileSync(join(langDir, f), "utf-8")));

// ── Priority ordering (generate high priority first to stay within free tier) ──

const HIGH_PRIORITY = ["newParagraph", "newLine", "bulletPoint", "todoItem", "stopRecording"];
const MED_PRIORITY = ["heading1", "heading2", "heading3", "numberedItem", "undo", "colon",
    "deleteLastParagraph", "deleteLastLine"];

function getPriority(cmdId) {
    if (HIGH_PRIORITY.includes(cmdId)) return 0;
    if (MED_PRIORITY.includes(cmdId)) return 1;
    return 2;
}

// ── Build generation plan ──

const plan = [];

for (const lang of langs) {
    if (langFilter && !langFilter.includes(lang.code)) continue;

    for (const [cmdId, phrases] of Object.entries(lang.patterns)) {
        if (!phrases || phrases.length === 0) continue;

        // Generate for the first (most common) trigger phrase
        const phrase = phrases[0];
        const filename = `${cmdId}--${phrase.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF\u0900-\u097F-]/g, "")}.mp3`;
        const outPath = join(outputDir, lang.code, filename);

        plan.push({
            lang: lang.code,
            langName: lang.name,
            cmdId,
            phrase,
            filename,
            outPath,
            priority: getPriority(cmdId),
            exists: existsSync(outPath),
        });
    }
}

// Sort by priority, then language
plan.sort((a, b) => a.priority - b.priority || a.lang.localeCompare(b.lang));

// ── Dry run ──

if (dryRun) {
    const byLang = {};
    for (const item of plan) {
        if (!byLang[item.lang]) byLang[item.lang] = [];
        byLang[item.lang].push(item);
    }

    let totalNew = 0;
    for (const [lang, items] of Object.entries(byLang)) {
        const langName = items[0].langName;
        const newItems = items.filter(i => !i.exists);
        totalNew += newItems.length;
        console.log(`\n${langName} (${lang}): ${items.length} commands, ${newItems.length} to generate`);
        for (const item of items) {
            const status = item.exists ? "EXISTS" : "NEW";
            const prio = ["HIGH", "MED", "LOW"][item.priority];
            console.log(`  [${status}] [${prio}] "${item.phrase}" → ${item.filename}`);
        }
    }
    console.log(`\nTotal: ${plan.length} samples, ${totalNew} new to generate`);
    process.exit(0);
}

// ── Generate audio ──

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
    console.error("Error: ELEVENLABS_API_KEY environment variable is required.");
    console.error("  export ELEVENLABS_API_KEY=your-key");
    process.exit(1);
}

// Dynamic import to avoid requiring the package when not generating
const { ElevenLabsClient } = await import("@elevenlabs/elevenlabs-js");
const client = new ElevenLabsClient({ apiKey });

let generated = 0;
let skipped = 0;
let failed = 0;

for (const item of plan) {
    if (item.exists) {
        skipped++;
        continue;
    }

    // Ensure output directory exists
    const langOutDir = join(outputDir, item.lang);
    mkdirSync(langOutDir, { recursive: true });

    try {
        console.log(`[${item.lang}] "${item.phrase}" (${item.cmdId})...`);

        const voiceId = VOICE_MAP[item.lang]?.voiceId || VOICE_MAP.en.voiceId;
        const audio = await client.textToSpeech.convert(voiceId, {
            text: item.phrase,
            model_id: "eleven_multilingual_v2",
            output_format: "mp3_22050_32",
        });

        // Collect chunks from async iterator
        const chunks = [];
        for await (const chunk of audio) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        writeFileSync(item.outPath, buffer);

        generated++;
        console.log(`  → ${item.filename} (${buffer.length} bytes)`);

        // Rate limit: small delay between requests
        await new Promise(r => setTimeout(r, 500));
    } catch (err) {
        failed++;
        console.error(`  ✗ Failed: ${err.message}`);
    }
}

console.log(`\nDone: ${generated} generated, ${skipped} skipped (exist), ${failed} failed`);

// ── Mix with background noise ──

let mixed = 0;

if (withBackground && existsSync(backgroundDir)) {
    // Check ffmpeg is available
    try {
        execSync("ffmpeg -version", { stdio: "ignore" });
    } catch {
        console.error("\nError: ffmpeg is required for --background mixing.");
        console.error("  Install with: apt install ffmpeg / brew install ffmpeg");
        process.exit(1);
    }

    const bgFiles = readdirSync(backgroundDir).filter(f =>
        f.endsWith(".mp3") || f.endsWith(".wav") || f.endsWith(".ogg")
    );

    if (bgFiles.length === 0) {
        console.warn("\nNo background files found in", backgroundDir);
        console.warn("  Add .mp3/.wav/.ogg files (e.g. cafe.mp3, office.mp3, street.mp3)");
    } else {
        console.log(`\nMixing with ${bgFiles.length} background(s): ${bgFiles.join(", ")}`);
        const bgOutputDir = join(outputDir, "..", "samples-with-background");

        for (const item of plan) {
            if (!existsSync(item.outPath)) continue;

            for (const bgFile of bgFiles) {
                const bgName = bgFile.replace(/\.[^.]+$/, "");
                const bgPath = join(backgroundDir, bgFile);
                const mixedDir = join(bgOutputDir, bgName, item.lang);
                const mixedPath = join(mixedDir, item.filename);

                if (existsSync(mixedPath)) continue;

                mkdirSync(mixedDir, { recursive: true });

                try {
                    // Mix: voice at full volume, background at -15dB (volume=0.18)
                    execSync(
                        `ffmpeg -y -i "${item.outPath}" -i "${bgPath}" ` +
                        `-filter_complex "[1]volume=0.18[bg];[0][bg]amix=inputs=2:duration=shortest" ` +
                        `"${mixedPath}" 2>/dev/null`
                    );
                    mixed++;
                } catch {
                    console.error(`  ✗ Mix failed: ${item.lang}/${item.filename} + ${bgFile}`);
                }
            }
        }
        console.log(`Mixed: ${mixed} samples with background noise`);
    }
} else if (withBackground) {
    console.warn(`\nNo backgrounds directory found at ${backgroundDir}`);
    console.warn("  Create it and add background audio files:");
    console.warn("  mkdir -p tests/audio-integration/backgrounds");
    console.warn("  # Add files like cafe.mp3, office.mp3, street.mp3");
}

// ── Generate manifest ──

// Collect all clean samples
const cleanSamples = plan
    .filter(item => existsSync(item.outPath))
    .map(item => ({
        file: `samples/${item.lang}/${item.filename}`,
        lang: item.lang,
        expectedCommand: item.cmdId,
        phrase: item.phrase,
        priority: ["high", "medium", "low"][item.priority],
        background: null,
    }));

// Collect background-mixed samples
const bgSamples = [];
const bgOutputDir = join(outputDir, "..", "samples-with-background");
if (existsSync(bgOutputDir)) {
    for (const bgName of readdirSync(bgOutputDir)) {
        const bgLangDir = join(bgOutputDir, bgName);
        if (!existsSync(bgLangDir)) continue;
        for (const lang of readdirSync(bgLangDir)) {
            const bgLangFiles = join(bgLangDir, lang);
            if (!existsSync(bgLangFiles)) continue;
            for (const file of readdirSync(bgLangFiles)) {
                const clean = cleanSamples.find(
                    s => s.file === `samples/${lang}/${file}`
                );
                if (clean) {
                    bgSamples.push({
                        ...clean,
                        file: `samples-with-background/${bgName}/${lang}/${file}`,
                        background: bgName,
                    });
                }
            }
        }
    }
}

const manifest = {
    generated: new Date().toISOString(),
    model: "eleven_multilingual_v2",
    samples: [...cleanSamples, ...bgSamples],
};

const manifestPath = join(outputDir, "..", "manifest.json");
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Manifest written: ${manifest.samples.length} samples in ${manifestPath}`);
