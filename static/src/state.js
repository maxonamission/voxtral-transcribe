// Voxtral Transcribe — Copyright (c) 2026 Max Kloosterman
// Licensed under GPL-3.0 — see LICENSE for details
// https://github.com/maxonamission/voxtral-transcribe

/**
 * Shared mutable state for the webapp.
 * All modules import this object and read/write properties directly.
 */

function loadShortcut() {
    try {
        const stored = localStorage.getItem("voxtral-shortcut");
        if (stored) return JSON.parse(stored);
    } catch {}
    return { ctrl: true, shift: false, alt: false, meta: false, key: " " };
}

export const state = {
    // Recording
    isRecording: false,
    ws: null,
    audioContext: null,
    mediaStream: null,
    processorNode: null,
    useRealtime: true,
    useDiarize: false,
    useDualDelay: JSON.parse(localStorage.getItem("voxtral-dual-delay") || "false"),

    // Insert point
    activeInsert: null,
    isMidSentenceInsert: false,
    isListOrHeadingInsert: false,

    // Mic level
    analyserNode: null,
    micLevelAnimId: null,
    smoothLevel: 0,
    lastLabel: "",

    // Scroll
    userScrolledAway: false,

    // Dual-delay
    dualFastText: "",
    dualSlowText: "",
    dualFastInsert: null,
    dualSlowConfirmed: "",
    dualFastPrevRaw: "",
    dualSlowPrevRaw: "",

    // Realtime
    realtimePrevRaw: "",

    // Correction
    autoCorrect: JSON.parse(localStorage.getItem("voxtral-autocorrect") || "false"),
    noiseSuppression: JSON.parse(localStorage.getItem("voxtral-noise-suppression") || "false"),
    systemPrompt: localStorage.getItem("voxtral-system-prompt") || "",

    // Language
    activeLang: localStorage.getItem("voxtral-language") || "nl",

    // Keyboard shortcut
    DEFAULT_SHORTCUT: { ctrl: true, shift: false, alt: false, meta: false, key: " " },
    recordShortcut: loadShortcut(),
};
