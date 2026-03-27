// ── State ──
let isRecording = false;
let ws = null;
let audioContext = null;
let mediaStream = null;
let processorNode = null;
let useRealtime = true;
let useDiarize = JSON.parse(localStorage.getItem("voxtral-diarize") || "false");
let useDualDelay = JSON.parse(localStorage.getItem("voxtral-dual-delay") || "false");
let activeInsert = null; // span where incoming text is inserted
let isMidSentenceInsert = false; // true when inserting inside a sentence (not after . ! ?)
let analyserNode = null;
let micLevelAnimId = null;
let smoothLevel = 0; // smoothed mic level (0–1)
let lastLabel = ""; // current displayed label text
let userScrolledAway = false; // true when user manually scrolled up

// ── Dual-delay state ──
let dualFastText = ""; // accumulated fast stream text (to be replaced by slow)
let dualSlowText = ""; // accumulated slow stream text (final/accurate)
let dualFastInsert = null; // span for fast (preliminary) text
let dualSlowConfirmed = ""; // how much text has been confirmed by slow stream
let dualFastPrevRaw = ""; // raw cumulative text from fast API (for delta detection)
let dualSlowPrevRaw = ""; // raw cumulative text from slow API (for delta detection)

// ── Realtime state ──
let realtimePrevRaw = ""; // raw cumulative text from API (for delta detection)

// ── Correction settings ──
let autoCorrect = JSON.parse(localStorage.getItem("voxtral-autocorrect") || "false");
let noiseSuppression = JSON.parse(localStorage.getItem("voxtral-noise-suppression") || "false");
let systemPrompt = localStorage.getItem("voxtral-system-prompt") || "";

// ── Language ──
let activeLang = localStorage.getItem("voxtral-language") || "nl";

// ── Keyboard shortcut ──
const DEFAULT_SHORTCUT = { ctrl: true, shift: false, alt: false, meta: false, key: " " };
let recordShortcut = loadShortcut();

function loadShortcut() {
    try {
        const stored = localStorage.getItem("voxtral-shortcut");
        if (stored) return JSON.parse(stored);
    } catch {}
    return { ...DEFAULT_SHORTCUT };
}

function saveShortcut(sc) {
    recordShortcut = sc;
    localStorage.setItem("voxtral-shortcut", JSON.stringify(sc));
    updateShortcutDisplays();
}

function shortcutLabel(sc) {
    const parts = [];
    if (sc.ctrl) parts.push("Ctrl");
    if (sc.alt) parts.push("Alt");
    if (sc.shift) parts.push("Shift");
    if (sc.meta) parts.push("Meta");
    const keyName = sc.key === " " ? "Space" : sc.key.length === 1 ? sc.key.toUpperCase() : sc.key;
    parts.push(keyName);
    return parts.join("+");
}

function updateShortcutDisplays() {
    const label = shortcutLabel(recordShortcut);
    const helpEl = document.getElementById("help-shortcut-display");
    if (helpEl) helpEl.textContent = label.replace(/\+/g, " + ");
}

function matchesShortcut(e, sc) {
    return e.ctrlKey === sc.ctrl && e.shiftKey === sc.shift
        && e.altKey === sc.alt && e.metaKey === sc.meta
        && e.key === sc.key;
}

// ── DOM ──
const transcript = document.getElementById("transcript");
const btnRecord = document.getElementById("btn-record");
const btnCopy = document.getElementById("btn-copy");
const btnClear = document.getElementById("btn-clear");
const modeToggle = document.getElementById("mode-toggle");
const statusText = document.getElementById("status-text");
const delaySelect = document.getElementById("delay-select");

// Restore saved delay from localStorage
const savedDelay = localStorage.getItem("voxtral-delay");
if (savedDelay && [...delaySelect.options].some(o => o.value === savedDelay)) {
    delaySelect.value = savedDelay;
}

// Persist delay when changed
delaySelect.addEventListener("change", () => {
    localStorage.setItem("voxtral-delay", delaySelect.value);
});
const replaceHint = document.getElementById("replace-hint");
const micLevel = document.getElementById("mic-level");
const micLevelBar = document.getElementById("mic-level-bar");
const micLevelLabel = document.getElementById("mic-level-label");

// ── Auto-scroll: pause when user scrolls up, resume when they scroll back down ──
(function initScrollTracking() {
    const main = transcript.closest("main");
    if (!main) return;
    let programmaticScroll = false;

    // Intercept programmatic scrollTo to distinguish from user scrolls
    const origScrollTo = main.scrollTo.bind(main);
    main.scrollTo = function (...args) {
        programmaticScroll = true;
        origScrollTo(...args);
        // smooth scroll takes time; reset flag after it settles
        setTimeout(() => { programmaticScroll = false; }, 600);
    };

    main.addEventListener("scroll", () => {
        if (programmaticScroll) return;
        // User is scrolling manually. Check if they're near the bottom.
        const distFromBottom = main.scrollHeight - main.scrollTop - main.clientHeight;
        if (distFromBottom > 80) {
            userScrolledAway = true;
        } else {
            userScrolledAway = false;
        }
    });
})();
const queueInfo = document.getElementById("queue-info");
const queueCount = document.getElementById("queue-count");
const toast = document.getElementById("toast");
const settingsOverlay = document.getElementById("settings-overlay");
const inputApiKey = document.getElementById("input-apikey");
const settingsStatus = document.getElementById("settings-status");
const selectLanguage = document.getElementById("select-language");

const LANG_NAMES = {
    nl: "Nederlands", en: "English", fr: "Français", de: "Deutsch",
    es: "Español", pt: "Português", it: "Italiano",
    ru: "Русский", zh: "中文", hi: "हिन्दी", ar: "العربية", ja: "日本語", ko: "한국어",
};

// Populate language dropdown
for (const [code, name] of Object.entries(LANG_NAMES)) {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = `${name} (${code})`;
    selectLanguage.appendChild(opt);
}
selectLanguage.value = activeLang;

// ── Mode toggle ──
const diarizeToggle = document.getElementById("diarize-toggle");
const diarizeLabel = document.getElementById("diarize-label");

function updateModeUI() {
    if (isRecording) return;
    statusText.textContent = useRealtime
        ? (useDualDelay ? "Realtime (dual-delay)" : "Realtime")
        : "Opname";
    // Show delay selector only in realtime + non-dual mode
    delaySelect.disabled = !useRealtime || useDualDelay;
    if (useRealtime && useDualDelay) {
        delaySelect.style.opacity = "0.4";
        delaySelect.title = "Dual-delay actief (snel 240ms + nauwkeurig 2400ms)";
    } else {
        delaySelect.style.opacity = "";
        delaySelect.title = "Streaming delay";
    }
    // Diarize toggle: only visible in opname (batch) mode
    const showDiarize = !useRealtime;
    diarizeToggle.closest(".toggle").classList.toggle("hidden-toggle", !showDiarize);
    diarizeLabel.classList.toggle("hidden-toggle", !showDiarize);
}

modeToggle.addEventListener("change", () => {
    if (isRecording) { modeToggle.checked = useRealtime; return; }
    useRealtime = modeToggle.checked;
    updateModeUI();
});

diarizeToggle.checked = useDiarize;
diarizeToggle.addEventListener("change", () => {
    if (isRecording) { diarizeToggle.checked = useDiarize; return; }
    useDiarize = diarizeToggle.checked;
    localStorage.setItem("voxtral-diarize", JSON.stringify(useDiarize));
});

// ── Active insert point management ──
// This is the core concept: a single span that receives all incoming text.
// By default it's at the end. Click in the transcript to move it.
// Select text to replace it.

function ensureInsertPoint() {
    // Must be inside transcript specifically — not just any parentNode
    if (activeInsert && transcript.contains(activeInsert)) return activeInsert;
    // If activeInsert exists but escaped transcript, remove it from wherever it is
    if (activeInsert && activeInsert.parentNode) activeInsert.remove();
    activeInsert = document.createElement("span");
    activeInsert.className = "partial";
    transcript.appendChild(activeInsert);
    return activeInsert;
}

// ── Auto-spacing helpers ──
function getTextBefore(node) {
    let prev = node.previousSibling;
    while (prev) {
        const t = prev.textContent;
        if (t.length > 0) return t;
        prev = prev.previousSibling;
    }
    return "";
}

function getTextAfter(node) {
    let next = node.nextSibling;
    while (next) {
        const t = next.textContent;
        if (t.length > 0) return t;
        next = next.nextSibling;
    }
    return "";
}

function needsSpaceBefore(target) {
    if (target.textContent !== "") return false; // only on first insert
    const before = getTextBefore(target);
    if (!before) return false;
    const last = before[before.length - 1];
    return last !== " " && last !== "\n" && last !== "\t";
}

function needsSpaceAfter(target) {
    const after = getTextAfter(target);
    if (!after) return false;
    const first = after[0];
    const content = target.textContent;
    if (!content) return false;
    const last = content[content.length - 1];
    return last !== " " && last !== "\n" && first !== " " && first !== "\n";
}

function capitalizeAfterSentenceEnd(node) {
    const content = node.textContent;
    if (!content) return;
    // Check if inserted text ends with sentence-ending punctuation
    const trimmed = content.trimEnd();
    const lastChar = trimmed[trimmed.length - 1];
    if (lastChar !== "." && lastChar !== "!" && lastChar !== "?") return;
    // Find next sibling with actual text
    let next = node.nextSibling;
    while (next) {
        if (next.textContent.trim().length > 0) break;
        next = next.nextSibling;
    }
    if (!next) return;
    const nextText = next.textContent;
    // Match optional leading whitespace then a lowercase letter (including accented)
    const match = nextText.match(/^(\s*)([a-zàáâãäåæçèéêëìíîïñòóôõöùúûüýÿ])/);
    if (match) {
        next.textContent = match[1] + match[2].toUpperCase() + nextText.slice(match[1].length + 1);
    }
}

function finalizeInsertPoint() {
    if (activeInsert) {
        if (activeInsert.textContent) {
            // Mid-sentence: strip trailing punctuation added by the API
            if (isMidSentenceInsert) {
                activeInsert.textContent = activeInsert.textContent.replace(/[.!?]+\s*$/, "");
            }
            // Auto-space: add trailing space if needed before next text
            if (needsSpaceAfter(activeInsert)) {
                activeInsert.textContent += " ";
            }
            // Auto-capitalize: uppercase first letter of next text after . ! ?
            if (!isMidSentenceInsert) {
                capitalizeAfterSentenceEnd(activeInsert);
            }
        }
        activeInsert.classList.remove("partial", "replacing");
        activeInsert = null;
        isMidSentenceInsert = false;
    }
    replaceHint.classList.add("hidden");
}

// ── Voice commands — language-driven ──

const LANG_PATTERNS = {
    nl: {
        newParagraph: ["nieuwe alinea", "nieuw alinea", "nieuwe paragraaf", "nieuwe linie"],
        newLine: ["nieuwe regel", "nieuwe lijn", "volgende regel"],
        heading1: ["kop een", "kop 1"],
        heading2: ["kop twee", "kop 2"],
        heading3: ["kop drie", "kop 3"],
        bulletPoint: ["nieuw punt", "nieuw lijstitem", "lijst punt", "nieuw item", "nieuwe item", "volgend item", "volgend punt"],
        todoItem: ["nieuw to-do item", "nieuw todo item", "nieuw todo", "nieuwe taak"],
        numberedItem: ["nieuw genummerd item", "nieuw genummerd punt", "genummerd punt", "genummerd item", "volgend nummer", "nummer punt"],
        stopRecording: ["beeindig opname", "beeindig de opname", "stop opname", "stopopname", "stop de opname"],
        deleteLastParagraph: ["verwijder laatste alinea", "verwijder laatste paragraaf", "wis laatste alinea"],
        deleteLastLine: ["verwijder laatste regel", "verwijder laatste zin", "wis laatste regel", "wist laatste regel"],
        undo: ["herstel", "ongedaan maken"],
        colon: ["dubbele punt", "double punt", "dubbelepunt"],
    },
    en: {
        newParagraph: ["new paragraph"],
        newLine: ["new line", "next line"],
        heading1: ["heading one", "heading 1"],
        heading2: ["heading two", "heading 2"],
        heading3: ["heading three", "heading 3"],
        bulletPoint: ["new item", "next item", "bullet", "bullet point", "new bullet"],
        todoItem: ["new todo", "new to-do", "todo item", "to-do item"],
        numberedItem: ["numbered item", "new numbered item", "next number"],
        stopRecording: ["stop recording"],
        deleteLastParagraph: ["delete last paragraph"],
        deleteLastLine: ["delete last line", "delete last sentence"],
        undo: ["undo"],
        colon: ["colon"],
    },
    fr: {
        newParagraph: ["nouveau paragraphe", "nouvelle section", "nouveau alinea"],
        newLine: ["nouvelle ligne", "a la ligne", "retour a la ligne"],
        heading1: ["titre un", "titre 1"],
        heading2: ["titre deux", "titre 2"],
        heading3: ["titre trois", "titre 3"],
        bulletPoint: ["nouveau point", "nouvelle puce", "point suivant", "nouvel element"],
        todoItem: ["nouvelle tache", "nouveau todo", "nouveau to-do"],
        numberedItem: ["point numero", "element numero", "nouveau numero"],
        stopRecording: ["arreter enregistrement", "arreter l enregistrement", "stop enregistrement"],
        deleteLastParagraph: ["supprimer dernier paragraphe", "effacer dernier paragraphe"],
        deleteLastLine: ["supprimer derniere ligne", "effacer derniere ligne"],
        undo: ["annuler"],
        colon: ["deux points"],
    },
    de: {
        newParagraph: ["neuer absatz", "neuer paragraph"],
        newLine: ["neue zeile", "nachste zeile"],
        heading1: ["uberschrift eins", "uberschrift 1"],
        heading2: ["uberschrift zwei", "uberschrift 2"],
        heading3: ["uberschrift drei", "uberschrift 3"],
        bulletPoint: ["neuer punkt", "neuer aufzahlungspunkt", "nachster punkt", "neues element"],
        todoItem: ["neue aufgabe", "neues todo", "neues to-do"],
        numberedItem: ["nummerierter punkt", "neuer nummerierter punkt", "nachste nummer"],
        stopRecording: ["aufnahme beenden", "aufnahme stoppen"],
        deleteLastParagraph: ["letzten absatz loschen", "absatz loschen"],
        deleteLastLine: ["letzte zeile loschen", "letzten satz loschen"],
        undo: ["ruckgangig", "ruckgangig machen"],
        colon: ["doppelpunkt"],
    },
    es: {
        newParagraph: ["nuevo parrafo", "nueva seccion"],
        newLine: ["nueva linea", "siguiente linea"],
        heading1: ["titulo uno", "titulo 1"],
        heading2: ["titulo dos", "titulo 2"],
        heading3: ["titulo tres", "titulo 3"],
        bulletPoint: ["nuevo punto", "nueva vineta", "siguiente punto", "nuevo elemento"],
        todoItem: ["nueva tarea", "nuevo todo", "nuevo to-do"],
        numberedItem: ["punto numerado", "nuevo numero", "siguiente numero"],
        stopRecording: ["parar grabacion", "detener grabacion"],
        deleteLastParagraph: ["borrar ultimo parrafo", "eliminar ultimo parrafo"],
        deleteLastLine: ["borrar ultima linea", "eliminar ultima linea"],
        undo: ["deshacer"],
        colon: ["dos puntos"],
    },
    pt: {
        newParagraph: ["novo paragrafo", "nova secao"],
        newLine: ["nova linha", "proxima linha"],
        heading1: ["titulo um", "titulo 1"],
        heading2: ["titulo dois", "titulo 2"],
        heading3: ["titulo tres", "titulo 3"],
        bulletPoint: ["novo ponto", "novo item", "proximo ponto", "novo elemento"],
        todoItem: ["nova tarefa", "novo todo", "novo to-do"],
        numberedItem: ["ponto numerado", "novo numero", "proximo numero"],
        stopRecording: ["parar gravacao", "encerrar gravacao"],
        deleteLastParagraph: ["apagar ultimo paragrafo", "excluir ultimo paragrafo"],
        deleteLastLine: ["apagar ultima linha", "excluir ultima linha"],
        undo: ["desfazer"],
        colon: ["dois pontos"],
    },
    it: {
        newParagraph: ["nuovo paragrafo", "nuova sezione", "nuovo capoverso"],
        newLine: ["nuova riga", "a capo", "riga successiva"],
        heading1: ["titolo uno", "titolo 1"],
        heading2: ["titolo due", "titolo 2"],
        heading3: ["titolo tre", "titolo 3"],
        bulletPoint: ["nuovo punto", "nuovo elemento", "punto successivo", "nuovo elenco"],
        todoItem: ["nuovo compito", "nuova attivita", "nuovo todo"],
        numberedItem: ["punto numerato", "nuovo numero", "numero successivo"],
        stopRecording: ["ferma registrazione", "interrompi registrazione", "stop registrazione"],
        deleteLastParagraph: ["cancella ultimo paragrafo", "elimina ultimo paragrafo"],
        deleteLastLine: ["cancella ultima riga", "elimina ultima riga"],
        undo: ["annulla"],
        colon: ["due punti"],
    },
};

const LANG_MISHEARINGS = {
    nl: [
        [/\bniveau\b/g, "nieuwe"],
        [/\bniva\b/g, "nieuwe"],
        [/\bnieuw alinea\b/g, "nieuwe alinea"],
        [/\bnieuw regel\b/g, "nieuwe regel"],
        [/\blinea\b/g, "alinea"],
        [/\blinie\b/g, "alinea"],
        [/\bbeeindigde\b/g, "beeindig de"],
    ],
    fr: [[/\bnouveau ligne\b/g, "nouvelle ligne"], [/\bnouvelle paragraphe\b/g, "nouveau paragraphe"]],
    de: [[/\bneue absatz\b/g, "neuer absatz"], [/\bneues zeile\b/g, "neue zeile"]],
};

// Command definitions: id → {insert/action, punctuation, toast}
const COMMAND_DEFS = [
    { id: "newParagraph", insert: "\n\n", toast: "¶" },
    { id: "newLine", insert: "\n", toast: "↵" },
    { id: "heading1", insert: "\n\n# ", toast: "# H1" },
    { id: "heading2", insert: "\n\n## ", toast: "## H2" },
    { id: "heading3", insert: "\n\n### ", toast: "### H3" },
    { id: "bulletPoint", action: "bulletPoint", toast: "•" },
    { id: "todoItem", insert: "\n- [ ] ", toast: "☐" },
    { id: "numberedItem", action: "numberedItem", toast: "1." },
    { id: "stopRecording", action: "stopRecording", toast: "⏹ Stop" },
    { id: "deleteLastParagraph", action: "deleteLastParagraph", toast: "🗑" },
    { id: "deleteLastLine", action: "deleteLastLine", toast: "🗑" },
    { id: "undo", action: "undo", toast: "↩" },
    { id: "colon", insert: ": ", punctuation: true, toast: ":" },
];

/** Build VOICE_COMMANDS from COMMAND_DEFS + active language patterns + EN fallback */
function buildVoiceCommands(lang) {
    const langData = LANG_PATTERNS[lang] || {};
    const enData = lang === "en" ? {} : (LANG_PATTERNS.en || {});
    return COMMAND_DEFS.map(def => {
        const langP = langData[def.id] || [];
        const enP = enData[def.id] || [];
        // Merge: active language first, then English fallback, deduplicated
        const seen = new Set();
        const patterns = [];
        for (const p of [...langP, ...enP]) {
            if (!seen.has(p)) { seen.add(p); patterns.push(p); }
        }
        return { ...def, patterns };
    });
}

let VOICE_COMMANDS = buildVoiceCommands(activeLang);

// Remove trailing punctuation before inserting a new punctuation mark.
// E.g. "oké," + ": " → "oké: " (not "oké,: ")
function stripTrailingPunctuation(str) {
    return str.replace(/[,;.!?]+\s*$/, "");
}

// Strip diacritics: ë→e, é→e, ï→i etc.
function stripDiacritics(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Levenshtein edit distance between two strings
function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
        }
    }
    return dp[m][n];
}

// ── Phonetic normalization — lightweight rules per language ──
// Maps phonetically equivalent sounds to canonical forms to catch ASR mishearings.

const PHONETIC_RULES = {
    nl: [
        [/ij/g, "ei"], [/au/g, "ou"], [/dt\b/g, "t"], [/\bsch/g, "sg"],
        [/ck/g, "k"], [/ph/g, "f"], [/th/g, "t"],
        [/ie/g, "i"], [/oe/g, "u"], [/ee/g, "e"], [/oo/g, "o"], [/uu/g, "u"], [/aa/g, "a"],
    ],
    en: [
        [/ph/g, "f"], [/th/g, "t"], [/ck/g, "k"], [/ght/g, "t"],
        [/wh/g, "w"], [/kn/g, "n"], [/wr/g, "r"],
        [/tion/g, "shun"], [/sion/g, "shun"],
    ],
    fr: [
        [/eau/g, "o"], [/aux/g, "o"], [/ai/g, "e"], [/ei/g, "e"],
        [/ph/g, "f"], [/qu/g, "k"], [/gn/g, "ny"],
        [/oi/g, "wa"], [/ou/g, "u"], [/an/g, "on"], [/en/g, "on"],
    ],
    de: [
        [/sch/g, "sh"], [/ei/g, "ai"], [/ie/g, "i"], [/ck/g, "k"],
        [/ph/g, "f"], [/th/g, "t"], [/v/g, "f"], [/tz/g, "ts"], [/dt\b/g, "t"],
        [/aa/g, "a"], [/ee/g, "e"], [/oo/g, "o"],
    ],
    es: [
        [/ll/g, "y"], [/v/g, "b"], [/ce/g, "se"], [/ci/g, "si"],
        [/qu/g, "k"], [/h/g, ""],
    ],
    pt: [
        [/lh/g, "ly"], [/nh/g, "ny"], [/ch/g, "sh"],
        [/qu/g, "k"], [/ção/g, "saun"], [/ss/g, "s"],
    ],
    it: [
        [/gn/g, "ny"], [/ch/g, "k"], [/gh/g, "g"],
        [/sc(?=[ei])/g, "sh"], [/zz/g, "ts"],
    ],
};

const LANG_ARTICLES = {
    nl: ["een", "de", "het", "die", "dat", "deze"],
    en: ["a", "an", "the"],
    fr: ["un", "une", "le", "la", "les", "l", "du", "des"],
    de: ["ein", "eine", "einen", "einem", "einer", "der", "die", "das", "den", "dem", "des"],
    es: ["un", "una", "el", "la", "los", "las"],
    pt: ["um", "uma", "o", "a", "os", "as"],
    it: ["un", "uno", "una", "il", "lo", "la", "i", "gli", "le"],
};

const LANG_TRAILING_FILLERS = {
    nl: ["alsjeblieft", "graag", "even", "maar", "eens", "dan", "nu", "hoor"],
    en: ["please", "now", "then", "thanks"],
    fr: ["s il vous plait", "s il te plait", "merci"],
    de: ["bitte", "mal", "jetzt", "dann"],
    es: ["por favor", "ahora", "gracias"],
    pt: ["por favor", "agora", "obrigado"],
    it: ["per favore", "ora", "adesso", "grazie"],
};

function phoneticNormalize(text, lang) {
    const rules = PHONETIC_RULES[lang];
    if (!rules) return text;
    let result = text;
    for (const [pattern, replacement] of rules) {
        result = result.replace(pattern, replacement);
    }
    return result;
}

function stripArticlesFromText(text, lang) {
    const articles = LANG_ARTICLES[lang];
    if (!articles || articles.length === 0) return text;
    const words = text.split(/\s+/);
    let stripped = 0;
    while (stripped < Math.min(2, words.length - 1)) {
        if (articles.includes(words[stripped])) stripped++;
        else break;
    }
    return stripped > 0 ? words.slice(stripped).join(" ") : text;
}

function stripTrailingFillersFromText(text, lang) {
    const fillers = LANG_TRAILING_FILLERS[lang];
    if (!fillers || fillers.length === 0) return text;
    let result = text;
    for (const filler of fillers.sort((a, b) => b.length - a.length)) {
        if (result.endsWith(" " + filler)) {
            result = result.slice(0, -(filler.length + 1)).trimEnd();
        }
    }
    return result;
}

function trySplitCompound(text, knownPhrases) {
    if (text.includes(" ") || text.length < 4) return text;
    for (const phrase of knownPhrases) {
        const words = phrase.split(/\s+/);
        if (words.length < 2) continue;
        if (text === words.join("")) return phrase;
    }
    return text;
}

// Normalize spoken text for command matching
function normalizeCommand(text) {
    let norm = text.toLowerCase().trim();
    norm = stripDiacritics(norm);
    // Strip punctuation including all dash/hyphen variants (ASCII, Unicode hyphen, en-dash, em-dash)
    norm = norm.replace(/[,;:'"…\u002D\u2010\u2011\u2012\u2013\u2014\u2015]/g, "");
    // Language-specific mishearing corrections
    for (const [pattern, replacement] of (LANG_MISHEARINGS[activeLang] || [])) {
        norm = norm.replace(pattern, replacement);
    }
    return norm.trim();
}

function findCommand(normalized, rawText) {
    // Helper: extract trailing N words
    function trailingWords(text, n) {
        const words = text.trimEnd().split(/\s+/);
        return words.slice(-n).join(" ");
    }

    // Helper: get all known command phrases for compound splitting
    function getAllPhrases() {
        const phrases = [];
        for (const cmd of VOICE_COMMANDS) {
            for (const pattern of cmd.patterns) {
                phrases.push(normalizeCommand(pattern));
            }
        }
        return phrases;
    }

    // Pass 1: exact match (full or suffix)
    for (const cmd of VOICE_COMMANDS) {
        for (const pattern of cmd.patterns) {
            const p = normalizeCommand(pattern);
            if (normalized === p) return { cmd, textBefore: "" };
            if (normalized.endsWith(" " + p)) {
                const patternWordCount = p.split(/\s+/).length;
                const rawWords = (rawText || "").trimEnd().split(/\s+/);
                const textBefore = rawWords.slice(0, -patternWordCount).join(" ");
                return { cmd, textBefore };
            }
        }
    }

    // Pass 2: match after stripping trailing fillers
    const strippedFillers = stripTrailingFillersFromText(normalized, activeLang);
    if (strippedFillers !== normalized) {
        for (const cmd of VOICE_COMMANDS) {
            for (const pattern of cmd.patterns) {
                const p = normalizeCommand(pattern);
                if (strippedFillers === p) return { cmd, textBefore: "" };
                if (strippedFillers.endsWith(" " + p)) {
                    const patternWordCount = p.split(/\s+/).length;
                    const fillerWordCount = normalized.split(/\s+/).length - strippedFillers.split(/\s+/).length;
                    const rawWords = (rawText || "").trimEnd().split(/\s+/);
                    const textBefore = rawWords.slice(0, -(patternWordCount + fillerWordCount)).join(" ");
                    return { cmd, textBefore };
                }
            }
        }
    }

    // Pass 2b: strip leading articles from trailing portion
    for (const cmd of VOICE_COMMANDS) {
        for (const pattern of cmd.patterns) {
            const p = normalizeCommand(pattern);
            const patternWordCount = p.split(/\s+/).length;
            const tail = trailingWords(normalized, patternWordCount + 1);
            const stripped = stripArticlesFromText(tail, activeLang);
            if (stripped === p) {
                const tailWordCount = tail.split(/\s+/).length;
                const rawWords = (rawText || "").trimEnd().split(/\s+/);
                const textBefore = rawWords.slice(0, -tailWordCount).join(" ");
                return { cmd, textBefore };
            }
        }
    }

    // Pass 3: phonetic match
    const phoneticText = phoneticNormalize(normalized, activeLang);
    for (const cmd of VOICE_COMMANDS) {
        for (const pattern of cmd.patterns) {
            const normP = normalizeCommand(pattern);
            const phoneticP = phoneticNormalize(normP, activeLang);
            if (phoneticP !== normP || phoneticText !== normalized) {
                if (phoneticText === phoneticP) return { cmd, textBefore: "" };
                if (phoneticText.endsWith(" " + phoneticP)) {
                    const patternWordCount = pattern.split(/\s+/).length;
                    const rawWords = (rawText || "").trimEnd().split(/\s+/);
                    const textBefore = rawWords.slice(0, -patternWordCount).join(" ");
                    return { cmd, textBefore };
                }
            }
        }
    }

    // Pass 4: compound-word splitting
    const lastWord = normalized.split(/\s+/).pop() || "";
    if (lastWord.length >= 4) {
        const split = trySplitCompound(lastWord, getAllPhrases());
        if (split !== lastWord) {
            const words = normalized.split(/\s+/);
            words[words.length - 1] = split;
            const resplit = words.join(" ");
            for (const cmd of VOICE_COMMANDS) {
                for (const pattern of cmd.patterns) {
                    const p = normalizeCommand(pattern);
                    if (resplit === p || resplit.endsWith(" " + p)) {
                        const rawWords = (rawText || "").trimEnd().split(/\s+/);
                        const textBefore = rawWords.slice(0, -1).join(" ");
                        return { cmd, textBefore };
                    }
                }
            }
        }
    }

    // Pass 5: fuzzy match for standalone sentences only (Levenshtein ≤ 2)
    let bestMatch = null;
    let bestDist = 3;
    for (const cmd of VOICE_COMMANDS) {
        for (const pattern of cmd.patterns) {
            const p = normalizeCommand(pattern);
            const dist = levenshtein(normalized, p);
            if (dist > 0 && dist < bestDist) {
                bestDist = dist;
                bestMatch = { cmd, textBefore: "" };
            }
        }
    }
    return bestMatch;
}

function checkForCommand() {
    if (!activeInsert || !activeInsert.textContent) return false;
    const raw = activeInsert.textContent.replace(/[.!?]/g, "");
    const norm = normalizeCommand(raw);
    if (!norm) return false;
    const result = findCommand(norm, raw);
    if (result) {
        // Insert any text that came before the command
        if (result.textBefore) {
            const span = document.createElement("span");
            if (result.cmd.punctuation) {
                // Punctuation attaches directly to preceding text
                // Strip trailing punctuation to avoid ",:" or ".:" combos
                span.textContent = stripTrailingPunctuation(result.textBefore) + result.cmd.insert;
                activeInsert.parentNode.insertBefore(span, activeInsert);
                activeInsert.textContent = "";
                showToast(result.cmd.toast);
                return true;
            }
            span.textContent = result.textBefore + " ";
            activeInsert.parentNode.insertBefore(span, activeInsert);
        }
        executeCommand(result.cmd);
        return true;
    }
    return false;
}

// Process completed sentences in real-time as periods arrive in deltas.
// This is essential because the Mistral realtime API may not send "done"
// events between sentences during continuous speech.
function processCompletedSentences() {
    if (!activeInsert || !activeInsert.textContent) return;

    const text = activeInsert.textContent;

    // Match complete sentences: text followed by sentence-ending punctuation
    const parts = text.match(/\s*[^.!?]+[.!?]+/g);
    if (!parts) return; // no complete sentence yet

    // Calculate remainder (incomplete text after the last matched sentence)
    const matchedLength = parts.join("").length;
    const remainder = text.substring(matchedLength);

    // First pass: classify each part as command or text
    const actions = parts.map(part => {
        const trimmedPart = part.trim();
        const textOnly = trimmedPart.replace(/[.!?]+$/, "").trim();
        const norm = normalizeCommand(textOnly);
        const result = findCommand(norm, textOnly);
        // Log hex codes for debugging hyphen issues
        const hexCodes = [...textOnly].map(c => c.charCodeAt(0) > 127 ? `U+${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}` : c).join("");
        console.debug(`[voice] "${textOnly}" [${hexCodes}] → norm="${norm}" → ${result ? "CMD: " + result.cmd.toast : "text"}`);
        return { trimmedPart, result };
    });

    // Save undo state BEFORE modifying the transcript — but ONLY if there are
    // actual text parts being committed. Pure command sentences (like "Herstel.")
    // should NOT save undo, otherwise restoreUndo() pops the wrong state.
    // (Destructive commands like deleteLastBlock already call saveUndo() internally.)
    const hasTextParts = actions.some(a => !a.result);
    if (hasTextParts) {
        saveUndo();
    }

    // Clear command text from activeInsert BEFORE executing commands
    // so deleteLastBlock/restoreUndo won't see command text in transcript
    activeInsert.textContent = remainder;

    // Second pass: execute actions
    let stopRequested = false;
    for (const { trimmedPart, result } of actions) {
        // After destructive commands (delete/undo), activeInsert may be detached
        // Re-attach it so subsequent text insertions work — must be inside transcript
        if (!transcript.contains(activeInsert)) {
            if (activeInsert.parentNode) activeInsert.remove();
            transcript.appendChild(activeInsert);
        }

        if (result) {
            const { cmd, textBefore } = result;
            // Insert text that preceded the command
            if (textBefore) {
                const prefixSpan = document.createElement("span");
                if (cmd.punctuation) {
                    // Punctuation attaches directly (no space before)
                    // Strip trailing punctuation to avoid ",:" or ".:" combos
                    prefixSpan.textContent = stripTrailingPunctuation(textBefore) + cmd.insert;
                    activeInsert.parentNode.insertBefore(prefixSpan, activeInsert);
                    showToast(cmd.toast);
                    continue;
                }
                prefixSpan.textContent = textBefore + " ";
                activeInsert.parentNode.insertBefore(prefixSpan, activeInsert);
            }
            if (cmd.insert) {
                // For punctuation commands without textBefore, clean the previous span
                if (cmd.punctuation) {
                    const prev = activeInsert.previousSibling;
                    if (prev && prev.textContent) {
                        prev.textContent = stripTrailingPunctuation(prev.textContent);
                    }
                }
                const span = document.createElement("span");
                span.textContent = cmd.insert;
                activeInsert.parentNode.insertBefore(span, activeInsert);
            }
            if (cmd.action === "stopRecording") stopRequested = true;
            if (cmd.action === "deleteLastParagraph") deleteLastBlock("paragraph");
            if (cmd.action === "deleteLastLine") deleteLastBlock("line");
            if (cmd.action === "undo") restoreUndo();
            if (cmd.action === "numberedItem") insertNumberedItem();
            showToast(cmd.toast);
        } else {
            // Finalize as regular text (white, not gray)
            const span = document.createElement("span");
            span.textContent = trimmedPart + " ";
            activeInsert.parentNode.insertBefore(span, activeInsert);
        }
    }

    isMidSentenceInsert = false; // after a sentence boundary, next text starts fresh

    if (stopRequested) {
        // Clear activeInsert so stopRecording doesn't leave command text behind
        if (activeInsert) { activeInsert.remove(); activeInsert = null; }
        setTimeout(() => { if (isRecording) btnRecord.click(); }, 0);
    }
}

function executeCommand(cmd) {
    // Single command: clear text and execute
    if (activeInsert) {
        activeInsert.textContent = "";
    }

    if (cmd.insert) {
        if (activeInsert) {
            // For punctuation, strip trailing punctuation from previous span
            if (cmd.punctuation) {
                const prev = activeInsert.previousSibling;
                if (prev && prev.textContent) {
                    prev.textContent = stripTrailingPunctuation(prev.textContent);
                }
            }
            activeInsert.textContent = cmd.insert;
            activeInsert.classList.remove("partial", "replacing");
            activeInsert = null;
        }
    } else if (cmd.action === "stopRecording") {
        if (activeInsert) { activeInsert.remove(); activeInsert = null; }
        if (isRecording) btnRecord.click();
    } else if (cmd.action === "deleteLastParagraph") {
        if (activeInsert) { activeInsert.remove(); activeInsert = null; }
        deleteLastBlock("paragraph");
    } else if (cmd.action === "deleteLastLine") {
        if (activeInsert) { activeInsert.remove(); activeInsert = null; }
        deleteLastBlock("line");
    } else if (cmd.action === "undo") {
        if (activeInsert) { activeInsert.remove(); activeInsert = null; }
        restoreUndo();
    } else if (cmd.action === "numberedItem") {
        insertNumberedItem();
    } else if (cmd.action === "bulletPoint") {
        insertContextBullet();
    }

    isMidSentenceInsert = false;
    replaceHint.classList.add("hidden");
    showToast(cmd.toast);
}

function insertContextBullet() {
    // Context-aware: detect current list type and continue it
    const text = transcript.textContent || "";
    const lastLine = text.split("\n").filter(l => l.trim()).pop() || "";

    let insertText;
    if (/^\d+\.\s/.test(lastLine)) {
        // Numbered list — continue numbering
        const num = parseInt(lastLine.match(/^(\d+)/)?.[1] ?? "0", 10);
        insertText = `\n${num + 1}. `;
    } else if (/^- \[[ x]\]\s/.test(lastLine)) {
        // Todo list — continue with unchecked
        insertText = "\n- [ ] ";
    } else {
        // Default: unordered bullet
        insertText = "\n- ";
    }

    const span = document.createElement("span");
    span.textContent = insertText;
    if (activeInsert && activeInsert.parentNode) {
        activeInsert.parentNode.insertBefore(span, activeInsert);
    } else {
        transcript.appendChild(span);
    }
}

function insertNumberedItem() {
    const text = transcript.textContent;
    // Find the last numbered item pattern (e.g. "1. ", "2. ") on any line
    const match = text.match(/(\d+)\.\s[^\n]*$/);
    const nextNum = match ? parseInt(match[1], 10) + 1 : 1;
    const span = document.createElement("span");
    span.textContent = `\n${nextNum}. `;
    if (activeInsert && activeInsert.parentNode) {
        activeInsert.parentNode.insertBefore(span, activeInsert);
    } else {
        transcript.appendChild(span);
    }
}

// ── Undo stack ──
let undoStack = [];

function saveUndo() {
    undoStack.push(transcript.innerHTML);
    if (undoStack.length > 20) undoStack.shift(); // max 20 states
}

function restoreUndo() {
    if (undoStack.length === 0) return false;
    transcript.innerHTML = undoStack.pop();
    return true;
}

function deleteLastBlock(type) {
    const fullText = transcript.innerText;
    if (!fullText || !fullText.trim()) return;

    saveUndo();

    let newText;
    if (type === "paragraph") {
        // Delete everything after the last double newline
        const idx = fullText.lastIndexOf("\n\n");
        newText = idx > 0 ? fullText.substring(0, idx) : "";
    } else {
        // Delete last sentence: find the last sentence-ending punctuation before the final one
        const trimmed = fullText.trimEnd();
        // Find second-to-last sentence boundary (. ! ?)
        let cutIdx = -1;
        for (let i = trimmed.length - 2; i >= 0; i--) {
            const ch = trimmed[i];
            if (ch === "." || ch === "!" || ch === "?") {
                cutIdx = i + 1; // keep the period
                break;
            }
            if (ch === "\n") {
                cutIdx = i + 1; // keep the newline as boundary
                break;
            }
        }
        newText = cutIdx > 0 ? fullText.substring(0, cutIdx) : "";
    }

    transcript.innerHTML = "";
    if (newText && newText.trim()) {
        const span = document.createElement("span");
        span.textContent = newText;
        transcript.appendChild(span);
    } else {
        transcript.innerHTML = '<span class="placeholder">Druk op opnemen om te beginnen...</span>';
    }
}

function isAfterSentenceEnd(node) {
    const before = getTextBefore(node);
    if (!before) return true; // start of transcript = treat as sentence start
    const trimmed = before.trimEnd();
    if (!trimmed) return true;
    const last = trimmed[trimmed.length - 1];
    // Also treat markdown markers (#, -, \n) as sentence starts (after voice command inserts)
    return last === "." || last === "!" || last === "?" || last === "#" || last === "\n" || last === "-";
}

function lowercaseFirstLetter(text) {
    // Handle leading whitespace: " En" → " en"
    const match = text.match(/^(\s*)([A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝŸ])/);
    if (match) {
        return match[1] + match[2].toLowerCase() + text.slice(match[1].length + 1);
    }
    return text;
}

function feedText(text) {
    clearPlaceholder();
    const target = ensureInsertPoint();

    // Auto-space: add leading space on first text if previous text has no trailing space
    if (needsSpaceBefore(target) && text.length > 0 && text[0] !== " " && text[0] !== "\n") {
        target.textContent = " ";
    }

    // Prevent double spaces: trim leading spaces from text if we already have one
    if (target.textContent.endsWith(" ") && text.startsWith(" ")) {
        text = text.replace(/^ +/, "");
    }
    // Also when target is still empty but before text already ends with space
    if (target.textContent === "" && text.startsWith(" ")) {
        const before = getTextBefore(target);
        if (before && before.endsWith(" ")) {
            text = text.replace(/^ +/, "");
        }
    }

    // On first real text: determine if this is a mid-sentence or new-sentence insertion
    if (target.textContent.replace(/ /g, "") === "") {
        isMidSentenceInsert = !isAfterSentenceEnd(target);
        if (isMidSentenceInsert) {
            text = lowercaseFirstLetter(text);
        }
    }

    target.textContent += text;

    // Safety: if target somehow escaped transcript, move it back
    if (!transcript.contains(target)) {
        if (target.parentNode) target.remove();
        transcript.appendChild(target);
    }

    scrollToInsertPoint();

    // Process completed sentences in real-time (commands + finalize text)
    processCompletedSentences();
}

// ── Click-to-move cursor — works during AND before recording ──
transcript.addEventListener("mouseup", () => {
    // Ignore if transcript only has the placeholder
    if (transcript.querySelector(".placeholder")) return;

    setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        // Both anchor and focus must be inside transcript
        if (!transcript.contains(sel.anchorNode)) return;
        if (!transcript.contains(sel.focusNode)) return;

        // Finalize current insert point and reset dual-delay accumulators
        // so old text doesn't leak into the new insert point
        processDualSlowCommands();
        finalizeInsertPoint();
        dualFastText = "";
        dualSlowText = "";
        dualSlowConfirmed = "";
        // Note: do NOT reset dualFastPrevRaw/dualSlowPrevRaw — the API stream continues

        if (!sel.isCollapsed) {
            // ── Selection: replace mode ──
            // Clamp range to stay within transcript
            const range = sel.getRangeAt(0);
            const transcriptRange = document.createRange();
            transcriptRange.selectNodeContents(transcript);

            // If selection extends beyond transcript, clamp it
            if (range.compareBoundaryPoints(Range.START_TO_START, transcriptRange) < 0) {
                range.setStart(transcriptRange.startContainer, transcriptRange.startOffset);
            }
            if (range.compareBoundaryPoints(Range.END_TO_END, transcriptRange) > 0) {
                range.setEnd(transcriptRange.endContainer, transcriptRange.endOffset);
            }

            saveUndo(); // save state before text is replaced/cleared
            const marker = document.createElement("span");
            marker.className = "replacing";
            try {
                range.surroundContents(marker);
            } catch {
                const fragment = range.extractContents();
                marker.appendChild(fragment);
                range.insertNode(marker);
            }
            marker.textContent = "";

            // Safety: ensure marker ended up inside transcript
            if (!transcript.contains(marker)) {
                marker.remove();
                transcript.appendChild(marker);
            }

            activeInsert = marker;
            replaceHint.classList.remove("hidden");
            sel.removeAllRanges();
        } else {
            // ── Click: move insertion point ──
            const range = sel.getRangeAt(0);
            const newInsert = document.createElement("span");
            newInsert.className = "partial";
            range.insertNode(newInsert);

            // Safety: ensure insert ended up inside transcript
            if (!transcript.contains(newInsert)) {
                newInsert.remove();
                transcript.appendChild(newInsert);
            }

            activeInsert = newInsert;
            sel.removeAllRanges();
        }
    }, 10);
});

// ── IndexedDB for offline queue ──
function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open("voxtral-queue", 1);
        req.onupgradeneeded = () => {
            req.result.createObjectStore("recordings", { autoIncrement: true });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function saveToQueue(blob, diarize = false) {
    const db = await openDB();
    const tx = db.transaction("recordings", "readwrite");
    tx.objectStore("recordings").add({ blob, diarize, retries: 0 });
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
    updateQueueBadge();
}

async function clearQueue() {
    const db = await openDB();
    const tx = db.transaction("recordings", "readwrite");
    tx.objectStore("recordings").clear();
    await new Promise((res) => { tx.oncomplete = res; });
    updateQueueBadge();
    showToast("Wachtrij gewist");
}

async function getQueueCount() {
    const db = await openDB();
    const tx = db.transaction("recordings", "readonly");
    const store = tx.objectStore("recordings");
    return new Promise((res) => {
        const req = store.count();
        req.onsuccess = () => res(req.result);
        req.onerror = () => res(0);
    });
}

let isProcessingQueue = false;

async function processQueue() {
    if (isProcessingQueue) return;
    const count = await getQueueCount();
    if (count === 0) return;
    isProcessingQueue = true;
    showToast(`Wachtrij verwerken (${count})...`);

    const db = await openDB();
    const tx = db.transaction("recordings", "readonly");
    const store = tx.objectStore("recordings");
    const allKeys = await new Promise((res) => {
        const req = store.getAllKeys();
        req.onsuccess = () => res(req.result);
        req.onerror = () => res([]);
    });

    const MAX_RETRIES = 3;
    let processed = 0;
    for (const key of allKeys) {
        const getTx = db.transaction("recordings", "readonly");
        const record = await new Promise((res) => {
            const req = getTx.objectStore("recordings").get(key);
            req.onsuccess = () => res(req.result);
            req.onerror = () => res(null);
        });
        if (!record) continue;
        // Support old format (bare blob), {blob, diarize}, and {blob, diarize, retries}
        const blob = record instanceof Blob ? record : record.blob;
        const diarize = record instanceof Blob ? false : !!record.diarize;
        const retries = record instanceof Blob ? 0 : (record.retries || 0);
        if (!blob) continue;
        try {
            const formData = new FormData();
            formData.append("file", blob, "recording.webm");
            if (diarize) formData.append("diarize", "true");
            const resp = await fetch("/api/transcribe", { method: "POST", body: formData });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                const errMsg = err.error || `Status ${resp.status}`;
                console.error(`Queue item ${key} failed:`, errMsg);
                const newRetries = retries + 1;
                if (newRetries >= MAX_RETRIES) {
                    // Max retries reached — remove permanently
                    const delTx = db.transaction("recordings", "readwrite");
                    delTx.objectStore("recordings").delete(key);
                    await new Promise((res) => { delTx.oncomplete = res; });
                    showToast(`Opname verwijderd na ${MAX_RETRIES} pogingen: ${errMsg}`, 4000);
                } else {
                    // Increment retry counter
                    const updTx = db.transaction("recordings", "readwrite");
                    updTx.objectStore("recordings").put({ blob, diarize, retries: newRetries }, key);
                    await new Promise((res) => { updTx.oncomplete = res; });
                    showToast(`Wachtrij-item mislukt (${newRetries}/${MAX_RETRIES}): ${errMsg}`, 4000);
                }
                continue;
            }
            const data = await resp.json();
            if (data.segments && data.segments.length > 0) {
                clearPlaceholder();
                appendDiarizedText(data.segments);
            } else if (data.text) {
                appendFinalText(data.text + " ");
            }
            // Delete successfully processed item
            const delTx = db.transaction("recordings", "readwrite");
            delTx.objectStore("recordings").delete(key);
            await new Promise((res) => { delTx.oncomplete = res; });
            processed++;
        } catch (err) {
            console.warn("Queue processing failed (offline?):", err.message);
            if (!navigator.onLine) break; // truly offline — stop and retry later
            continue; // other errors — try remaining items
        }
    }
    isProcessingQueue = false;
    updateQueueBadge();
    if (processed > 0) {
        showToast(`${processed} opname(s) verwerkt`);
    }
}

async function updateQueueBadge() {
    const count = await getQueueCount();
    queueCount.textContent = count;
    queueInfo.classList.toggle("hidden", count === 0);
}

// ── Transcript helpers ──
function clearPlaceholder() {
    const ph = transcript.querySelector(".placeholder");
    if (ph) ph.remove();
}

function appendFinalText(text) {
    clearPlaceholder();
    const span = document.createElement("span");
    span.textContent = text;
    transcript.appendChild(span);
    scrollToInsertPoint();
}

function appendDiarizedText(segments) {
    for (const seg of segments) {
        const label = document.createElement("span");
        label.className = "speaker-label";
        label.textContent = seg.speaker + ": ";
        transcript.appendChild(label);

        const text = document.createElement("span");
        text.textContent = seg.text + "\n\n";
        transcript.appendChild(text);
    }
    scrollToInsertPoint();
}

function scrollToInsertPoint() {
    // Don't auto-scroll if user has scrolled away to read earlier text
    if (userScrolledAway) return;

    const main = transcript.closest("main");
    if (!main) return;

    if (activeInsert && transcript.contains(activeInsert)) {
        const mainRect = main.getBoundingClientRect();
        const insertRect = activeInsert.getBoundingClientRect();

        // How far down is the insert point in the visible area? (0 = top, 1 = bottom)
        const relativePos = (insertRect.top - mainRect.top) / mainRect.height;

        if (relativePos < 0 || relativePos > 0.5) {
            // Insert point is off-screen above, or in the lower half of the viewport.
            // Scroll so insert point sits at ~35% from the top — keeps the 50vh
            // padding visible as black space below the active text.
            const targetOffset = mainRect.height * 0.35;
            const insertOffsetInMain = insertRect.top - mainRect.top + main.scrollTop;
            main.scrollTo({ top: insertOffsetInMain - targetOffset, behavior: "smooth" });
        }
        // If already in the upper half (0–50%), don't scroll — position is fine.
    } else {
        // Fallback: scroll to bottom (e.g. when appending without active insert)
        main.scrollTop = main.scrollHeight;
    }
}

// ── Mic level indicator ──
function startMicLevel(source) {
    analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 256;
    source.connect(analyserNode);
    micLevel.classList.remove("hidden");
    micLevelLabel.classList.remove("hidden");
    updateMicLevel();
}

function updateMicLevel() {
    if (!analyserNode) return;
    const data = new Uint8Array(analyserNode.fftSize);
    analyserNode.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length);
    const rawLevel = Math.min(1, rms * 3); // amplify for visibility

    // Only update the speech average when there's actual speech (above silence floor).
    // This gives a stable overall assessment instead of a jumpy real-time meter.
    const SILENCE_FLOOR = 0.06;
    if (rawLevel > SILENCE_FLOOR) {
        // Very slow EMA: assessment changes gradually over ~3-5 seconds of speech
        smoothLevel = smoothLevel === 0
            ? rawLevel
            : smoothLevel * 0.98 + rawLevel * 0.02;
    }
    // During silence: keep previous smoothLevel (= last speech assessment)

    // Determine status: one stable assessment based on average speech level
    let newLabel, dotColor;
    if (smoothLevel < SILENCE_FLOOR) {
        // Not spoken yet or only silence
        newLabel = ""; dotColor = "#555";
    } else if (smoothLevel < 0.12) {
        newLabel = "te zacht"; dotColor = "#ef4444";
    } else if (smoothLevel > 0.75) {
        newLabel = "te hard"; dotColor = "#ef4444";
    } else if (smoothLevel > 0.45) {
        newLabel = "hard"; dotColor = "#eab308";
    } else {
        newLabel = "in orde"; dotColor = "#4ade80";
    }

    // Update dot color
    micLevel.style.background = dotColor;

    // Update label (only when it actually changes)
    if (newLabel !== lastLabel) {
        micLevelLabel.textContent = newLabel;
        micLevelLabel.style.color = dotColor;
        lastLabel = newLabel;
    }
    micLevelAnimId = requestAnimationFrame(updateMicLevel);
}

function stopMicLevel() {
    if (micLevelAnimId) { cancelAnimationFrame(micLevelAnimId); micLevelAnimId = null; }
    if (analyserNode) { analyserNode.disconnect(); analyserNode = null; }
    smoothLevel = 0;
    lastLabel = "";
    micLevel.classList.add("hidden");
    micLevelLabel.classList.add("hidden");
    micLevel.style.background = "#555";
    micLevelLabel.textContent = "";
}

// ── Audio: PCM s16le 16kHz mono ──
function floatTo16BitPCM(float32Array) {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
        let s = Math.max(-1, Math.min(1, float32Array[i]));
        view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return new Uint8Array(buffer);
}

function downsample(buffer, fromRate, toRate) {
    if (fromRate === toRate) return buffer;
    const ratio = fromRate / toRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
        result[i] = buffer[Math.round(i * ratio)];
    }
    return result;
}

// ── Mic helper: try selected device, fallback to default ──
async function acquireMic(extraConstraints = {}) {
    const constraints = { channelCount: 1, ...extraConstraints };
    if (noiseSuppression) {
        constraints.noiseSuppression = { ideal: true };
        constraints.echoCancellation = { ideal: true };
        constraints.autoGainControl = { ideal: true };
    }
    if (selectedMicId) constraints.deviceId = { exact: selectedMicId };
    try {
        return await navigator.mediaDevices.getUserMedia({ audio: constraints });
    } catch (err) {
        // If a specific device was requested and failed, retry with default mic
        if (selectedMicId) {
            console.warn("Selected mic failed, falling back to default:", err.message);
            const fallback = { channelCount: 1, ...extraConstraints };
            const stream = await navigator.mediaDevices.getUserMedia({ audio: fallback });
            showToast("Geselecteerde microfoon niet beschikbaar — standaard gebruikt");
            // Update selection to match what we actually got
            const track = stream.getAudioTracks()[0];
            if (track && track.getSettings().deviceId) {
                selectedMicId = track.getSettings().deviceId;
                localStorage.setItem("selectedMicId", selectedMicId);
            }
            return stream;
        }
        throw err;
    }
}

// ── Realtime recording ──
async function startRealtime() {
    const delay = delaySelect.value;
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${protocol}//${location.host}/ws/transcribe?delay=${delay}`);
    realtimePrevRaw = "";

    ws.onopen = () => {
        statusText.textContent = "Opnemen (realtime)";
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "delta") {
            // Handle both cumulative and incremental deltas from the API
            const isCumulative = realtimePrevRaw && msg.text.startsWith(realtimePrevRaw);
            const newText = isCumulative ? msg.text.substring(realtimePrevRaw.length) : msg.text;
            realtimePrevRaw = isCumulative ? msg.text : realtimePrevRaw + msg.text;
            if (newText) feedText(newText);
        } else if (msg.type === "done") {
            if (!checkForCommand()) finalizeInsertPoint();
        } else if (msg.type === "error") {
            console.error("Transcription error (full):", msg.message);
            // Show short user-friendly message, not the full gRPC stack trace
            showToast("Serverfout — herverbinden...");
        }
    };

    ws.onerror = (err) => console.error("WebSocket error:", err);

    ws.onclose = () => {
        if (isRecording) {
            // Transient error: try to reconnect automatically
            console.log("WebSocket closed while recording — attempting reconnect...");
            stopAudioCapture();
            finalizeInsertPoint();
            showToast("Verbinding verbroken — herverbinden...");
            // Brief delay then reconnect
            setTimeout(async () => {
                if (!isRecording) return; // user stopped in the meantime
                try {
                    await startRealtime();
                    showToast("Herverbonden");
                } catch (err) {
                    console.error("Reconnect failed:", err);
                    isRecording = false;
                    btnRecord.classList.remove("active");
                    btnRecord.textContent = "Opnemen";
                    updateModeUI();
                    showToast("Herverbinden mislukt");
                }
            }, 1500);
        }
    };

    await new Promise((resolve, reject) => {
        ws.addEventListener("open", resolve, { once: true });
        ws.addEventListener("error", reject, { once: true });
    });

    mediaStream = await acquireMic({ sampleRate: 16000 });
    audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(mediaStream);

    processorNode = audioContext.createScriptProcessor(4096, 1, 1);
    processorNode.onaudioprocess = (e) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const downsampled = downsample(inputData, audioContext.sampleRate, 16000);
        const pcm = floatTo16BitPCM(downsampled);
        ws.send(pcm.buffer);
    };

    source.connect(processorNode);
    processorNode.connect(audioContext.destination);

    startMicLevel(source);
}

function stopRealtime() {
    if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    ws = null;
    stopAudioCapture();
}

// ── Dual-delay realtime recording ──
async function startDualDelay() {
    const fastDelay = 240;
    const slowDelay = 2400;
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${protocol}//${location.host}/ws/transcribe-dual?fast_delay=${fastDelay}&slow_delay=${slowDelay}`);

    // Reset dual-delay state
    dualFastText = "";
    dualSlowText = "";
    dualSlowConfirmed = "";
    dualFastPrevRaw = "";
    dualSlowPrevRaw = "";
    dualFastInsert = null;

    ws.onopen = () => {
        statusText.textContent = "Opnemen (dual-delay)";
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.stream === "fast") {
            if (msg.type === "delta") {
                // Handle both cumulative and incremental deltas from the API
                const isCumulative = dualFastPrevRaw && msg.text.startsWith(dualFastPrevRaw);
                if (isCumulative) {
                    const newPart = msg.text.substring(dualFastPrevRaw.length);
                    if (newPart) dualFastText += newPart;
                } else {
                    dualFastText += msg.text;
                }
                dualFastPrevRaw = isCumulative ? msg.text : dualFastPrevRaw + msg.text;
                renderDualText();
            } else if (msg.type === "done") {
                // Fast stream done — finalize but keep as preliminary
                renderDualText();
            }
        } else if (msg.stream === "slow") {
            if (msg.type === "delta") {
                // Handle both cumulative and incremental deltas from the API
                const isCumulative = dualSlowPrevRaw && msg.text.startsWith(dualSlowPrevRaw);
                if (isCumulative) {
                    const newPart = msg.text.substring(dualSlowPrevRaw.length);
                    if (newPart) dualSlowText += newPart;
                } else {
                    dualSlowText += msg.text;
                }
                dualSlowPrevRaw = isCumulative ? msg.text : dualSlowPrevRaw + msg.text;
                renderDualText();
                // Check for voice commands in slow stream (more accurate than fast)
                processDualSlowCommands();
            } else if (msg.type === "done") {
                // Stream done — process any remaining text, don't replace
                // accumulators with msg.text (which would re-inject already-committed text)
                renderDualText();
                processDualSlowCommands();
                dualSlowConfirmed = dualSlowText;
            }
        } else if (msg.type === "error") {
            console.error("Dual-delay error:", msg.message, msg.stream);
            showToast("Serverfout — herverbinden...");
        }
    };

    ws.onerror = (err) => console.error("Dual-delay WebSocket error:", err);

    ws.onclose = () => {
        if (isRecording) {
            console.log("Dual-delay WebSocket closed while recording — attempting reconnect...");
            stopAudioCapture();
            finalizeInsertPoint();
            showToast("Verbinding verbroken — herverbinden...");
            setTimeout(async () => {
                if (!isRecording) return;
                try {
                    await startDualDelay();
                    showToast("Herverbonden");
                } catch (err) {
                    console.error("Reconnect failed:", err);
                    isRecording = false;
                    btnRecord.classList.remove("active");
                    btnRecord.textContent = "Opnemen";
                    updateModeUI();
                    showToast("Herverbinden mislukt");
                }
            }, 1500);
        }
    };

    await new Promise((resolve, reject) => {
        ws.addEventListener("open", resolve, { once: true });
        ws.addEventListener("error", reject, { once: true });
    });

    mediaStream = await acquireMic({ sampleRate: 16000 });
    audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(mediaStream);

    processorNode = audioContext.createScriptProcessor(4096, 1, 1);
    processorNode.onaudioprocess = (e) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const downsampled = downsample(inputData, audioContext.sampleRate, 16000);
        const pcm = floatTo16BitPCM(downsampled);
        ws.send(pcm.buffer);
    };

    source.connect(processorNode);
    processorNode.connect(audioContext.destination);

    startMicLevel(source);
}

function renderDualText() {
    clearPlaceholder();
    const target = ensureInsertPoint();

    // The slow stream is authoritative. Show:
    // 1. Confirmed slow text (normal style)
    // 2. Any fast text beyond the slow text (dimmed/preliminary)
    //
    // Simple approach: slow text is the "true" prefix, fast text that extends
    // beyond it is shown as preliminary.

    const slowLen = dualSlowText.length;
    const fastLen = dualFastText.length;

    if (fastLen > slowLen) {
        // Show slow text (confirmed) + remainder from fast (preliminary)
        const confirmedPart = dualSlowText;
        const preliminaryPart = dualFastText.substring(slowLen);
        target.innerHTML = "";

        if (confirmedPart) {
            const confirmedSpan = document.createElement("span");
            confirmedSpan.textContent = confirmedPart;
            confirmedSpan.className = "dual-confirmed";
            target.appendChild(confirmedSpan);
        }
        if (preliminaryPart) {
            const prelimSpan = document.createElement("span");
            prelimSpan.textContent = preliminaryPart;
            prelimSpan.className = "dual-preliminary";
            target.appendChild(prelimSpan);
        }
    } else {
        // Slow has caught up or surpassed fast — show only slow text
        target.textContent = dualSlowText;
        target.className = "partial dual-confirmed";
    }

    scrollToInsertPoint();
}

/**
 * Process voice commands from the slow stream in dual-delay mode.
 * The slow stream has better accuracy and reliably recognizes commands
 * like "nieuwe alinea", "dubbele punt", etc.
 *
 * Scans dualSlowText for completed sentences (ending with .!?) and checks
 * each for voice commands. When found: finalizes preceding text, executes
 * the command, and trims both slow and fast accumulators.
 */
function processDualSlowCommands() {
    if (!dualSlowText) return;

    // Match completed sentences (text ending with sentence punctuation)
    const parts = dualSlowText.match(/\s*[^.!?]+[.!?]+/g);
    if (!parts) return;

    const matchedLength = parts.join("").length;
    const remainder = dualSlowText.substring(matchedLength);

    // Check each completed sentence for voice commands
    const actions = parts.map(part => {
        const trimmedPart = part.trim();
        const textOnly = trimmedPart.replace(/[.!?]+$/, "").trim();
        const norm = normalizeCommand(textOnly);
        const result = findCommand(norm, textOnly);
        console.debug(`[dual-voice] "${textOnly}" → norm="${norm}" → ${result ? "CMD: " + result.cmd.toast : "text"}`);
        return { trimmedPart, result };
    });

    // Always flush completed sentences — even without commands.
    // This keeps accumulators small (preventing performance degradation)
    // and moves confirmed text to permanent spans (preventing grey flicker).

    // Save undo state before modifying transcript
    const hasTextParts = actions.some(a => !a.result);
    if (hasTextParts) saveUndo();

    // Finalize the activeInsert: clear it and commit text/commands
    const target = ensureInsertPoint();
    target.innerHTML = "";
    target.textContent = "";

    let stopRequested = false;
    for (const { trimmedPart, result } of actions) {
        // Re-attach activeInsert if needed
        if (!transcript.contains(activeInsert)) {
            if (activeInsert.parentNode) activeInsert.remove();
            transcript.appendChild(activeInsert);
        }

        if (result) {
            const { cmd, textBefore } = result;
            if (textBefore) {
                const prefixSpan = document.createElement("span");
                if (cmd.punctuation) {
                    prefixSpan.textContent = stripTrailingPunctuation(textBefore) + cmd.insert;
                    activeInsert.parentNode.insertBefore(prefixSpan, activeInsert);
                    showToast(cmd.toast);
                    continue;
                }
                prefixSpan.textContent = textBefore + " ";
                activeInsert.parentNode.insertBefore(prefixSpan, activeInsert);
            }
            if (cmd.insert) {
                if (cmd.punctuation) {
                    const prev = activeInsert.previousSibling;
                    if (prev && prev.textContent) {
                        prev.textContent = stripTrailingPunctuation(prev.textContent);
                    }
                }
                const span = document.createElement("span");
                span.textContent = cmd.insert;
                activeInsert.parentNode.insertBefore(span, activeInsert);
            }
            if (cmd.action === "stopRecording") stopRequested = true;
            if (cmd.action === "deleteLastParagraph") deleteLastBlock("paragraph");
            if (cmd.action === "deleteLastLine") deleteLastBlock("line");
            if (cmd.action === "undo") restoreUndo();
            if (cmd.action === "numberedItem") insertNumberedItem();
            showToast(cmd.toast);
        } else {
            // Regular text — finalize into transcript
            const span = document.createElement("span");
            span.textContent = trimmedPart + " ";
            activeInsert.parentNode.insertBefore(span, activeInsert);
        }
    }

    isMidSentenceInsert = false;

    // Trim accumulators: remove the processed portion, keep remainder
    dualSlowText = remainder;
    // Also trim fast text — remove at least as much as we consumed from slow
    if (dualFastText.length >= matchedLength) {
        dualFastText = dualFastText.substring(matchedLength);
    } else {
        dualFastText = "";
    }
    dualSlowConfirmed = dualSlowText;

    // Re-render with trimmed state
    renderDualText();

    if (stopRequested) {
        // Clear accumulators so stopDualDelay() won't re-insert command text
        dualSlowText = "";
        dualFastText = "";
        dualSlowConfirmed = "";
        if (activeInsert) { activeInsert.remove(); activeInsert = null; }
        setTimeout(() => { if (isRecording) btnRecord.click(); }, 0);
    }
}

function stopDualDelay() {
    if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    ws = null;
    stopAudioCapture();
    // Process any remaining voice commands before finalizing
    processDualSlowCommands();
    // Finalize: use slow text preferentially, fall back to fast text for any remainder
    if (activeInsert) {
        const finalText = dualSlowText || dualFastText;
        activeInsert.innerHTML = "";
        if (finalText) {
            activeInsert.textContent = finalText;
            activeInsert.className = "partial";
        }
    }
    finalizeInsertPoint();
    dualFastText = "";
    dualSlowText = "";
    dualSlowConfirmed = "";
    dualFastPrevRaw = "";
    dualSlowPrevRaw = "";
}

// ── Offline / batch recording ──
let mediaRecorder = null;
let offlineChunks = [];

async function startOffline() {
    statusText.textContent = "Opnemen...";

    mediaStream = await acquireMic();

    // Create AudioContext for mic level monitoring
    audioContext = new AudioContext();
    const monitorSource = audioContext.createMediaStreamSource(mediaStream);
    startMicLevel(monitorSource);

    offlineChunks = [];
    mediaRecorder = new MediaRecorder(mediaStream, { mimeType: "audio/webm;codecs=opus" });

    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) offlineChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
        if (offlineChunks.length > 0) {
            const blob = new Blob(offlineChunks, { type: "audio/webm" });
            statusText.textContent = "Transcriberen...";
            try {
                const formData = new FormData();
                formData.append("file", blob, "recording.webm");
                if (useDiarize) formData.append("diarize", "true");
                const resp = await fetch("/api/transcribe", { method: "POST", body: formData });
                if (resp.ok) {
                    const data = await resp.json();
                    if (data.segments && data.segments.length > 0) {
                        // Diarized output: show speaker labels
                        clearPlaceholder();
                        appendDiarizedText(data.segments);
                    } else if (data.text) {
                        clearPlaceholder();
                        feedText(data.text);
                        checkForCommand();
                    }
                } else {
                    const err = await resp.json().catch(() => ({}));
                    const msg = err.error || `Server error ${resp.status}`;
                    console.error("Transcriptie mislukt:", msg);
                    showToast(`Transcriptie mislukt: ${msg}`, 4000);
                    await saveToQueue(blob, useDiarize);
                }
            } catch (e) {
                console.error("Transcriptie mislukt:", e.message);
                showToast(`Transcriptie mislukt: ${e.message}`, 4000);
                await saveToQueue(blob, useDiarize);
            }
            updateModeUI();
        }
        offlineChunks = [];
        finalizeInsertPoint(); // no-op if command already handled
        autoCorrectAfterStop().then(() => copyTranscript()); // correct then copy
    };

    mediaRecorder.start(1000);
}

function stopOffline() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
    mediaRecorder = null;
    stopAudioCapture();
}

function stopAudioCapture() {
    stopMicLevel();
    if (processorNode) { processorNode.disconnect(); processorNode = null; }
    if (audioContext) { audioContext.close(); audioContext = null; }
    if (mediaStream) { mediaStream.getTracks().forEach((t) => t.stop()); mediaStream = null; }
}

// ── Record button ──
btnRecord.addEventListener("click", async () => {
    if (isRecording) {
        isRecording = false;
        btnRecord.classList.remove("active");
        btnRecord.textContent = "Opnemen";

        if (useRealtime && useDualDelay && ws) {
            stopDualDelay();
            finalizeInsertPoint();
            autoCorrectAfterStop().then(() => copyTranscript());
        } else if (useRealtime && ws) {
            stopRealtime();
            finalizeInsertPoint();
            autoCorrectAfterStop().then(() => copyTranscript()); // correct then copy
        } else {
            stopOffline();
            // Don't finalize here — onstop handler does it after inserting text
            // Auto-correct + copy happens in onstop handler after transcription
        }

        updateModeUI();
    } else {
        isRecording = true;
        btnRecord.classList.add("active");
        btnRecord.textContent = "Stop";

        try {
            if (useRealtime && useDualDelay) {
                await startDualDelay();
            } else if (useRealtime) {
                await startRealtime();
            } else {
                await startOffline();
            }
        } catch (err) {
            console.error("Failed to start recording:", err);
            isRecording = false;
            btnRecord.classList.remove("active");
            btnRecord.textContent = "Opnemen";
            finalizeInsertPoint();
            const msg = err.name === "NotReadableError" || err.name === "NotFoundError"
                ? "Microfoon niet beschikbaar — controleer je apparaat of kies een andere microfoon in de instellingen"
                : err.name === "NotAllowedError"
                ? "Geen toestemming voor microfoon — sta toegang toe in je browser"
                : "Fout: " + err.message;
            statusText.textContent = msg;
        }
    }
});

// ── Copy helpers ──
async function copyTranscript() {
    let text = transcript.innerText.trim();
    if (!text || text === "Druk op opnemen om te beginnen...") return;
    // Normalize line endings: use \r\n for Windows compatibility
    text = text.replace(/\r?\n/g, "\r\n");
    try {
        await navigator.clipboard.writeText(text);
        showToast("Gekopieerd");
    } catch {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        showToast("Gekopieerd");
    }
}

btnCopy.addEventListener("click", copyTranscript);

// ── Text correction ──
const btnCorrect = document.getElementById("btn-correct");

async function correctText(text) {
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

// Manual: correct entire transcript
btnCorrect.addEventListener("click", async () => {
    const text = transcript.innerText.trim();
    if (!text || text === "Druk op opnemen om te beginnen...") return;
    if (isRecording) return;

    btnCorrect.textContent = "...";
    btnCorrect.disabled = true;

    try {
        const corrected = await correctText(text);
        if (corrected && corrected !== text) {
            transcript.innerHTML = "";
            const span = document.createElement("span");
            span.textContent = corrected;
            span.classList.add("corrected");
            transcript.appendChild(span);
            showToast("Tekst gecorrigeerd");
        } else {
            showToast("Geen correcties nodig");
        }
    } catch (err) {
        showToast("Correctie mislukt: " + err.message);
    } finally {
        btnCorrect.textContent = "Controleer";
        btnCorrect.disabled = false;
    }
});

// Auto-correct: correct full transcript after recording stops
async function autoCorrectAfterStop() {
    console.debug(`[autocorrect] autoCorrect=${autoCorrect}, called after stop`);
    if (!autoCorrect) return;

    const text = transcript.innerText.trim();
    if (!text || text === "Druk op opnemen om te beginnen...") return;

    btnCorrect.textContent = "...";
    btnCorrect.disabled = true;

    try {
        const corrected = await correctText(text);
        if (corrected && corrected.trim() !== text) {
            transcript.innerHTML = "";
            const span = document.createElement("span");
            span.textContent = corrected;
            span.classList.add("corrected");
            transcript.appendChild(span);
            showToast("Tekst gecorrigeerd");
        }
    } catch {
        // Silent fail for auto-correct
    } finally {
        btnCorrect.textContent = "Controleer";
        btnCorrect.disabled = false;
    }
}

// ── Clear button ──
btnClear.addEventListener("click", () => {
    if (isRecording) return;
    transcript.innerHTML = '<span class="placeholder">Druk op opnemen om te beginnen...</span>';
    activeInsert = null;
    undoStack = []; // clear undo history — deliberate wipe shouldn't be undoable
});

// ── Toast ──
function showToast(message, durationMs = 1500) {
    toast.textContent = message;
    toast.classList.remove("hidden");
    setTimeout(() => toast.classList.add("hidden"), durationMs);
}

// ── Queue: auto-retry when back online + periodic + click to retry ──
window.addEventListener("online", () => {
    console.log("Back online — processing queue");
    processQueue();
});

// Retry queue every 30 seconds if there are items
setInterval(async () => {
    const count = await getQueueCount();
    if (count > 0 && navigator.onLine) processQueue();
}, 30000);

// Click on queue text to manually retry
queueInfo.style.cursor = "pointer";
queueInfo.title = "Klik om wachtrij opnieuw te verwerken";
queueInfo.addEventListener("click", (e) => {
    if (e.target.id === "queue-clear") return; // handled separately
    if (!isProcessingQueue) processQueue();
});

// Clear queue button
document.getElementById("queue-clear").addEventListener("click", (e) => {
    e.stopPropagation();
    if (confirm("Wachtrij wissen? Alle opnames in de wachtrij worden verwijderd.")) {
        clearQueue();
    }
});

// ── Settings modal ──
const toggleDualDelay = document.getElementById("toggle-dual-delay");
const toggleAutocorrect = document.getElementById("toggle-autocorrect");
const toggleNoiseSuppression = document.getElementById("toggle-noise-suppression");
const inputSystemPrompt = document.getElementById("input-system-prompt");
const selectMicrophone = document.getElementById("select-microphone");
const selectRealtimeModel = document.getElementById("select-realtime-model");
const selectBatchModel = document.getElementById("select-batch-model");
const selectCorrectModel = document.getElementById("select-correct-model");
let selectedMicId = localStorage.getItem("voxtral-mic") || "";
let cachedModels = null;

async function loadMicrophones() {
    try {
        // Request permission first (needed to get device labels)
        await navigator.mediaDevices.getUserMedia({ audio: true }).then(s => s.getTracks().forEach(t => t.stop()));
        const devices = await navigator.mediaDevices.enumerateDevices();
        const mics = devices.filter(d => d.kind === "audioinput");
        selectMicrophone.innerHTML = "";
        for (const mic of mics) {
            const opt = document.createElement("option");
            opt.value = mic.deviceId;
            opt.textContent = mic.label || `Microfoon ${selectMicrophone.options.length + 1}`;
            if (mic.deviceId === selectedMicId) opt.selected = true;
            selectMicrophone.appendChild(opt);
        }
        // If no saved selection, default is the first (system default)
        if (!selectedMicId && mics.length > 0) {
            selectedMicId = mics[0].deviceId;
        }
    } catch {
        selectMicrophone.innerHTML = '<option>Geen toegang tot microfoon</option>';
    }
}

async function loadModels(currentSettings) {
    const realtimeVal = currentSettings?.realtime_model || "";
    const batchVal = currentSettings?.batch_model || "";
    const correctVal = currentSettings?.correct_model || "";

    // Show current values immediately
    function setInitial(select, val) {
        select.innerHTML = "";
        if (val) {
            const opt = document.createElement("option");
            opt.value = val;
            opt.textContent = val;
            select.appendChild(opt);
        }
    }
    setInitial(selectRealtimeModel, realtimeVal);
    setInitial(selectBatchModel, batchVal);
    setInitial(selectCorrectModel, correctVal);

    try {
        if (!cachedModels) {
            const resp = await fetch("/api/models");
            if (!resp.ok) return;
            const data = await resp.json();
            cachedModels = data.models || [];
        }

        const realtimeModels = cachedModels.filter(m => m.id.includes("realtime"));
        const allTranscription = cachedModels.filter(m => !!m.capabilities?.audio_transcription);
        const batchModels = allTranscription.filter(m => !m.id.includes("realtime"));
        const chatModels = cachedModels.filter(m =>
            !!m.capabilities?.completion_chat &&
            !m.capabilities?.audio_transcription &&
            !m.id.startsWith("voxtral"));

        function populate(select, models, currentVal) {
            select.innerHTML = "";
            const ids = models.map(m => m.id);
            if (currentVal && !ids.includes(currentVal)) {
                const opt = document.createElement("option");
                opt.value = currentVal;
                opt.textContent = currentVal + " (huidig)";
                select.appendChild(opt);
            }
            for (const model of models) {
                const opt = document.createElement("option");
                opt.value = model.id;
                opt.textContent = model.id;
                select.appendChild(opt);
            }
            if (currentVal) select.value = currentVal;
        }

        populate(selectRealtimeModel, realtimeModels, realtimeVal);
        populate(selectBatchModel, batchModels, batchVal);
        populate(selectCorrectModel, chatModels, correctVal);
    } catch {
        // Keep current values shown
    }
}

function openSettings() {
    settingsOverlay.classList.remove("hidden");
    settingsStatus.textContent = "";
    settingsStatus.className = "modal-status";
    inputApiKey.value = "";
    // Load current masked key as placeholder
    fetch("/api/settings").then(r => r.json()).then(data => {
        inputApiKey.placeholder = data.has_key ? data.masked_key : "Plak je API key hier...";
        if (data.language) {
            selectLanguage.value = data.language;
        }
        loadModels(data);
    }).catch(() => {});
    // Load correction settings
    toggleDualDelay.checked = useDualDelay;
    toggleAutocorrect.checked = autoCorrect;
    toggleNoiseSuppression.checked = noiseSuppression;
    inputSystemPrompt.value = systemPrompt;
    selectLanguage.value = activeLang;
    // Load microphone list
    loadMicrophones();
}

function closeSettings() {
    settingsOverlay.classList.add("hidden");
}

document.getElementById("btn-settings").addEventListener("click", openSettings);
document.getElementById("btn-close-settings").addEventListener("click", closeSettings);
settingsOverlay.addEventListener("click", (e) => {
    if (e.target === settingsOverlay) closeSettings();
});

// Toggle key visibility
document.getElementById("btn-toggle-key").addEventListener("click", () => {
    inputApiKey.type = inputApiKey.type === "password" ? "text" : "password";
});

// Save key
document.getElementById("btn-save-key").addEventListener("click", async () => {
    // Always save all settings
    useDualDelay = toggleDualDelay.checked;
    localStorage.setItem("voxtral-dual-delay", JSON.stringify(useDualDelay));
    updateModeUI();
    autoCorrect = toggleAutocorrect.checked;
    localStorage.setItem("voxtral-autocorrect", JSON.stringify(autoCorrect));
    noiseSuppression = toggleNoiseSuppression.checked;
    localStorage.setItem("voxtral-noise-suppression", JSON.stringify(noiseSuppression));
    systemPrompt = inputSystemPrompt.value;
    localStorage.setItem("voxtral-system-prompt", systemPrompt);
    selectedMicId = selectMicrophone.value;
    localStorage.setItem("voxtral-mic", selectedMicId);

    // Save language (rebuild commands immediately)
    const newLang = selectLanguage.value;
    if (newLang !== activeLang) {
        activeLang = newLang;
        localStorage.setItem("voxtral-language", activeLang);
        VOICE_COMMANDS = buildVoiceCommands(activeLang);
        updateBmcLink();
    }

    // Build the server payload: language + models always, API key only if entered
    const key = inputApiKey.value.trim();
    const payload = {
        language: activeLang,
        realtime_model: selectRealtimeModel.value,
        batch_model: selectBatchModel.value,
        correct_model: selectCorrectModel.value,
    };
    if (key) payload.api_key = key;

    if (!key) {
        // Save language to server (no key validation needed)
        fetch("/api/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }).catch(() => {});
        settingsStatus.textContent = "Instellingen opgeslagen";
        settingsStatus.className = "modal-status success";
        setTimeout(closeSettings, 1500);
        return;
    }
    settingsStatus.textContent = "Valideren...";
    settingsStatus.className = "modal-status";
    try {
        const resp = await fetch("/api/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const data = await resp.json();
        if (resp.ok) {
            settingsStatus.textContent = "Opgeslagen en gevalideerd";
            settingsStatus.className = "modal-status success";
            setTimeout(closeSettings, 1500);
        } else {
            settingsStatus.textContent = data.error || "Opslaan mislukt";
            settingsStatus.className = "modal-status error";
        }
    } catch (err) {
        settingsStatus.textContent = "Verbindingsfout: " + err.message;
        settingsStatus.className = "modal-status error";
    }
});

// ── Keyboard shortcut for recording ──
document.addEventListener("keydown", (e) => {
    // Don't trigger while typing in inputs or settings modal
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (!settingsOverlay.classList.contains("hidden")) return;

    if (matchesShortcut(e, recordShortcut)) {
        e.preventDefault();
        btnRecord.click();
    }
});

// ── Help panel ──
const helpPanel = document.getElementById("help-panel");
const helpTitle = document.getElementById("help-title");
const helpContent = document.getElementById("help-content");
const btnHelp = document.getElementById("btn-help");
const btnCloseHelp = document.getElementById("btn-close-help");

const HELP_UI = {
    nl: { title: "Stemcommando's", shortcutLabel: "Sneltoets", shortcutDesc: "Start / stop opname" },
    en: { title: "Voice Commands", shortcutLabel: "Shortcut", shortcutDesc: "Start / stop recording" },
    fr: { title: "Commandes vocales", shortcutLabel: "Raccourci", shortcutDesc: "Démarrer / arrêter" },
    de: { title: "Sprachbefehle", shortcutLabel: "Tastenkürzel", shortcutDesc: "Aufnahme starten / stoppen" },
    es: { title: "Comandos de voz", shortcutLabel: "Atajo", shortcutDesc: "Iniciar / detener" },
    pt: { title: "Comandos de voz", shortcutLabel: "Atalho", shortcutDesc: "Iniciar / parar" },
    it: { title: "Comandi vocali", shortcutLabel: "Scorciatoia", shortcutDesc: "Avvia / ferma" },
};

// Command grouping for the help panel
const HELP_GROUPS = [
    { ids: ["newParagraph", "newLine"], label: { nl: "Structuur", en: "Structure", fr: "Structure", de: "Struktur", es: "Estructura", pt: "Estrutura", it: "Struttura" } },
    { ids: ["heading1", "heading2", "heading3"], label: { nl: "Koppen", en: "Headings", fr: "Titres", de: "Überschriften", es: "Títulos", pt: "Títulos", it: "Titoli" } },
    { ids: ["bulletPoint", "todoItem", "numberedItem"], label: { nl: "Lijst", en: "Lists", fr: "Listes", de: "Listen", es: "Listas", pt: "Listas", it: "Elenchi" } },
    { ids: ["stopRecording", "deleteLastParagraph", "deleteLastLine", "undo"], label: { nl: "Bediening", en: "Controls", fr: "Contrôles", de: "Steuerung", es: "Controles", pt: "Controles", it: "Controlli" } },
    { ids: ["colon"], label: { nl: "Leestekens", en: "Punctuation", fr: "Ponctuation", de: "Satzzeichen", es: "Puntuación", pt: "Pontuação", it: "Punteggiatura" } },
];

function renderHelpPanel() {
    const lang = activeLang;
    const ui = HELP_UI[lang] || HELP_UI.en;
    helpTitle.textContent = ui.title;
    helpContent.innerHTML = "";

    for (const group of HELP_GROUPS) {
        const h3 = document.createElement("h3");
        h3.textContent = group.label[lang] || group.label.en;
        helpContent.appendChild(h3);
        const dl = document.createElement("dl");
        for (const id of group.ids) {
            const cmd = VOICE_COMMANDS.find(c => c.id === id);
            if (!cmd || cmd.patterns.length === 0) continue;
            const dt = document.createElement("dt");
            dt.textContent = cmd.patterns.slice(0, 2).map(p => `"${p}"`).join(" / ");
            const dd = document.createElement("dd");
            dd.textContent = cmd.toast;
            dl.appendChild(dt);
            dl.appendChild(dd);
        }
        helpContent.appendChild(dl);
    }

    // Shortcut section
    const h3 = document.createElement("h3");
    h3.textContent = ui.shortcutLabel;
    helpContent.appendChild(h3);
    const dl = document.createElement("dl");
    const dt = document.createElement("dt");
    dt.id = "help-shortcut-display";
    dt.textContent = shortcutLabel(recordShortcut).replace(/\+/g, " + ");
    const dd = document.createElement("dd");
    dd.textContent = ui.shortcutDesc;
    dl.appendChild(dt);
    dl.appendChild(dd);
    helpContent.appendChild(dl);
}

// Initial render
renderHelpPanel();

btnHelp.addEventListener("click", () => {
    renderHelpPanel(); // re-render with current language
    updateShortcutDisplays();
    helpPanel.classList.toggle("visible");
});

btnCloseHelp.addEventListener("click", () => {
    helpPanel.classList.remove("visible");
});


// ── Shortcut configuration in settings ──
const inputShortcut = document.getElementById("input-shortcut");
const btnResetShortcut = document.getElementById("btn-reset-shortcut");
let pendingShortcut = null;

inputShortcut.addEventListener("keydown", (e) => {
    e.preventDefault();
    // Ignore standalone modifier keys
    if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;

    pendingShortcut = {
        ctrl: e.ctrlKey,
        shift: e.shiftKey,
        alt: e.altKey,
        meta: e.metaKey,
        key: e.key
    };
    inputShortcut.value = shortcutLabel(pendingShortcut);
});

btnResetShortcut.addEventListener("click", () => {
    pendingShortcut = { ...DEFAULT_SHORTCUT };
    inputShortcut.value = shortcutLabel(pendingShortcut);
});

// Show current shortcut when settings open
document.getElementById("btn-settings").addEventListener("click", () => {
    pendingShortcut = null;
    inputShortcut.value = shortcutLabel(recordShortcut);
});

// Save shortcut alongside API key
document.getElementById("btn-save-key").addEventListener("click", () => {
    if (pendingShortcut) {
        saveShortcut(pendingShortcut);
        pendingShortcut = null;
    }
});

// ── Footer: time-based Buy Me A Coffee message ──
// Button text is fixed (BMC branding); only the tagline above is localised.
const BMC_BUTTONS = [
    "☕ Buy me a coffee",  // morning
    "📖 Buy me a book",   // afternoon
    "🍺 Buy me a beer",   // evening
    "🛏️ I like what you built!", // night
];
const BMC_TAGLINES = {
    // [morning, afternoon, evening, night]
    en: [
        "Need a coffee to process all this? Me too!",
        "Writing a book? I like books too!",
        "Worked so fast you have time for a beer? Let me join you!",
        "Time to go to bed! No more coffee.",
    ],
    nl: [
        "Een koffie nodig om dit allemaal te verwerken? Ik ook!",
        "Een boek aan het schrijven? Ik hou ook van boeken!",
        "Zo snel gewerkt dat je tijd hebt voor een biertje? Ik doe mee!",
        "Tijd om naar bed te gaan! Geen koffie meer.",
    ],
    fr: [
        "Besoin d'un café pour digérer tout ça ? Moi aussi !",
        "Tu écris un livre ? J'aime les livres aussi !",
        "Tu as travaillé si vite qu'il te reste du temps pour une bière ? Je t'accompagne !",
        "C'est l'heure d'aller dormir ! Plus de café.",
    ],
    de: [
        "Brauchst du einen Kaffee, um das alles zu verarbeiten? Ich auch!",
        "Schreibst du ein Buch? Ich mag Bücher auch!",
        "So schnell gearbeitet, dass du Zeit für ein Bier hast? Ich bin dabei!",
        "Zeit, ins Bett zu gehen! Kein Kaffee mehr.",
    ],
    es: [
        "¿Necesitas un café para procesar todo esto? ¡Yo también!",
        "¿Escribiendo un libro? ¡A mí también me gustan los libros!",
        "¿Trabajaste tan rápido que tienes tiempo para una cerveza? ¡Me apunto!",
        "¡Hora de irse a la cama! No más café.",
    ],
    pt: [
        "Precisa de um café para processar tudo isto? Eu também!",
        "Escrevendo um livro? Também gosto de livros!",
        "Trabalhou tão rápido que tem tempo para uma cerveja? Eu vou junto!",
        "Hora de ir dormir! Chega de café.",
    ],
    it: [
        "Hai bisogno di un caffè per elaborare tutto questo? Anch'io!",
        "Stai scrivendo un libro? Anche a me piacciono i libri!",
        "Hai lavorato così veloce che hai tempo per una birra? Mi unisco!",
        "È ora di andare a dormire! Basta caffè.",
    ],
    ru: [
        "Нужен кофе, чтобы всё это переварить? Мне тоже!",
        "Пишешь книгу? Я тоже люблю книги!",
        "Работал так быстро, что есть время на пиво? Я с тобой!",
        "Пора спать! Хватит кофе.",
    ],
    zh: [
        "需要一杯咖啡来消化这一切？我也是！",
        "在写书？我也喜欢书！",
        "工作这么快，有时间喝杯啤酒？我也来一杯！",
        "该睡觉了！别再喝咖啡了。",
    ],
    hi: [
        "इतना सब समझने के लिए कॉफ़ी चाहिए? मुझे भी!",
        "किताब लिख रहे हो? मुझे भी किताबें पसंद हैं!",
        "इतनी तेज़ी से काम किया कि बीयर का टाइम है? मैं भी आता हूँ!",
        "सोने का टाइम! अब और कॉफ़ी नहीं।",
    ],
    ar: [
        "تحتاج قهوة لمعالجة كل هذا؟ أنا أيضاً!",
        "تكتب كتاباً؟ أنا أحب الكتب أيضاً!",
        "عملت بسرعة وعندك وقت لبيرة؟ أنا معك!",
        "حان وقت النوم! لا مزيد من القهوة.",
    ],
    ja: [
        "これを全部処理するのにコーヒーが必要？私も！",
        "本を書いてるの？私も本が好き！",
        "こんなに早く仕事してビールの時間？一緒に飲もう！",
        "もう寝る時間！コーヒーはおしまい。",
    ],
    ko: [
        "이걸 다 처리하려면 커피가 필요하지? 나도!",
        "책 쓰고 있어? 나도 책 좋아해!",
        "일을 너무 빨리 해서 맥주 마실 시간이 있다고? 나도 낄게!",
        "이제 잘 시간이야! 커피는 그만.",
    ],
};

function updateBmcLink() {
    const tagline = document.getElementById("bmc-tagline");
    const link = document.getElementById("bmc-link");
    if (!tagline || !link) return;

    const tags = BMC_TAGLINES[activeLang] || BMC_TAGLINES.en;
    const hour = new Date().getHours();
    let idx;
    if (hour >= 6 && hour < 12) idx = 0;       // morning → coffee
    else if (hour >= 12 && hour < 18) idx = 1;  // afternoon → book
    else if (hour >= 18 && hour < 22) idx = 2;  // evening → beer
    else idx = 3;                                // night → bed

    tagline.textContent = tags[idx];
    link.textContent = BMC_BUTTONS[idx];
}
updateBmcLink();

// ── Init ──
updateModeUI();
updateQueueBadge();
updateShortcutDisplays();
processQueue();

// Register service worker for PWA install
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
}

// Check if API key is configured on load
fetch("/api/health").then(r => r.json()).then(data => {
    if (data.status === "no_key") {
        openSettings();
    }
}).catch(() => {});
