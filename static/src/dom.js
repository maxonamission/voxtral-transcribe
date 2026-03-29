// Voxtral Transcribe — Copyright (c) 2026 Max Kloosterman
// Licensed under GPL-3.0 — see LICENSE for details
// https://github.com/maxonamission/voxtral-transcribe

/**
 * DOM element references used across the webapp.
 * Centralised so modules don't each call getElementById.
 */

export const transcript = document.getElementById("transcript");
export const btnRecord = document.getElementById("btn-record");
export const btnCopy = document.getElementById("btn-copy");
export const btnClear = document.getElementById("btn-clear");
export const modeToggle = document.getElementById("mode-toggle");
export const statusText = document.getElementById("status-text");
export const delaySelect = document.getElementById("delay-select");
export const replaceHint = document.getElementById("replace-hint");
export const micLevel = document.getElementById("mic-level");
export const micLevelBar = document.getElementById("mic-level-bar");
export const micLevelLabel = document.getElementById("mic-level-label");
export const queueInfo = document.getElementById("queue-info");
export const queueCount = document.getElementById("queue-count");
export const toastEl = document.getElementById("toast");
export const settingsOverlay = document.getElementById("settings-overlay");
export const inputApiKey = document.getElementById("input-apikey");
export const settingsStatus = document.getElementById("settings-status");
export const selectLanguage = document.getElementById("select-language");
export const diarizeToggle = document.getElementById("diarize-toggle");
export const diarizeLabel = document.getElementById("diarize-label");
