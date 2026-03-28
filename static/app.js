(() => {
  // obsidian-plugin/src/shared/similarity.ts
  function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    const dp = Array.from(
      { length: m + 1 },
      () => Array(n + 1).fill(0)
    );
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
      }
    }
    return dp[m][n];
  }
  function normalizeCommand(text) {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/-/g, " ").replace(/[.,!?;:'"()[\]{}]/g, "").toLowerCase().trim();
  }

  // obsidian-plugin/src/shared/text-context.ts
  function detectContext(lineBefore) {
    if (!lineBefore) return "new-line";
    const trimmed = lineBefore.trimEnd();
    if (!trimmed) return "new-line";
    if (/^>+\s/.test(lineBefore)) {
      const afterMarker = lineBefore.replace(/^>+\s(?:\[!.*?\]\s*)?/, "");
      if (!afterMarker.trim()) return "comment";
    }
    if (/^(?:[-*]\s|[-*]\s\[.\]\s|#{1,6}\s|\d+[.)]\s)/.test(lineBefore)) {
      const afterMarker = lineBefore.replace(
        /^(?:[-*]\s(?:\[.\]\s)?|#{1,6}\s|\d+[.)]\s)/,
        ""
      );
      if (!afterMarker.trim()) return "list-or-heading";
    }
    const lastChar = trimmed[trimmed.length - 1];
    if (lastChar === "." || lastChar === "!" || lastChar === "?") {
      return "sentence-start";
    }
    return "mid-sentence";
  }
  function lowercaseFirstLetter(text) {
    const match = text.match(
      /^(\s*)([A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝŸ])/
    );
    if (match) {
      return match[1] + match[2].toLowerCase() + text.slice(match[1].length + 1);
    }
    return text;
  }

  // obsidian-plugin/src/shared/command-matcher.ts
  function trailingWords(text, n) {
    const words = text.split(/\s+/);
    if (n >= words.length) return text;
    return words.slice(-n).join(" ");
  }
  function findMatch(rawText, commands, lang, provider) {
    let normalized = normalizeCommand(rawText);
    for (const [pattern, replacement] of provider.getMishearings(lang)) {
      normalized = normalized.replace(pattern, replacement);
    }
    const rawWords = rawText.trimEnd().split(/\s+/);
    const allPhrases = [];
    for (const cmd of commands) {
      const patterns = provider.getPatterns(cmd.id, lang);
      for (const pattern of patterns) {
        allPhrases.push(normalizeCommand(pattern));
        const normPattern = normalizeCommand(pattern);
        if (normalized.endsWith(normPattern)) {
          const patternWordCount = pattern.split(/\s+/).length;
          const textBefore = rawWords.slice(0, -patternWordCount).join(" ").trimEnd();
          return { commandId: cmd.id, textBefore };
        }
      }
    }
    const strippedFillers = provider.stripTrailingFillers(normalized, lang);
    if (strippedFillers !== normalized) {
      for (const cmd of commands) {
        const patterns = provider.getPatterns(cmd.id, lang);
        for (const pattern of patterns) {
          const normPattern = normalizeCommand(pattern);
          if (strippedFillers.endsWith(normPattern)) {
            const patternWordCount = pattern.split(/\s+/).length;
            const fillerWordCount = normalized.split(/\s+/).length - strippedFillers.split(/\s+/).length;
            const textBefore = rawWords.slice(0, -(patternWordCount + fillerWordCount)).join(" ").trimEnd();
            return { commandId: cmd.id, textBefore };
          }
        }
      }
    }
    for (const cmd of commands) {
      const patterns = provider.getPatterns(cmd.id, lang);
      for (const pattern of patterns) {
        const normPattern = normalizeCommand(pattern);
        const patternWordCount = normPattern.split(/\s+/).length;
        const tail = trailingWords(normalized, patternWordCount + 1);
        const stripped = provider.stripArticles(tail, lang);
        if (stripped === normPattern) {
          const tailWordCount = tail.split(/\s+/).length;
          const textBefore = rawWords.slice(0, -tailWordCount).join(" ").trimEnd();
          return { commandId: cmd.id, textBefore };
        }
      }
    }
    const phoneticText = provider.phoneticNormalize(normalized, lang);
    for (const cmd of commands) {
      const patterns = provider.getPatterns(cmd.id, lang);
      for (const pattern of patterns) {
        const normPattern = normalizeCommand(pattern);
        const phoneticPattern = provider.phoneticNormalize(normPattern, lang);
        if (phoneticPattern !== normPattern || phoneticText !== normalized) {
          if (phoneticText.endsWith(phoneticPattern)) {
            const patternWordCount = pattern.split(/\s+/).length;
            const textBefore = rawWords.slice(0, -patternWordCount).join(" ").trimEnd();
            return { commandId: cmd.id, textBefore };
          }
        }
      }
    }
    const lastWord = normalized.split(/\s+/).pop() ?? "";
    if (lastWord.length >= 4 && !lastWord.includes(" ")) {
      const split = provider.trySplitCompound(lastWord, allPhrases);
      if (split !== lastWord) {
        const words = normalized.split(/\s+/);
        words[words.length - 1] = split;
        const resplit = words.join(" ");
        for (const cmd of commands) {
          const patterns = provider.getPatterns(cmd.id, lang);
          for (const pattern of patterns) {
            const normPattern = normalizeCommand(pattern);
            if (resplit.endsWith(normPattern)) {
              const textBefore = rawWords.slice(0, -1).join(" ").trimEnd();
              return { commandId: cmd.id, textBefore };
            }
          }
        }
      }
    }
    let bestMatch = null;
    let bestDist = 3;
    for (const cmd of commands) {
      const patterns = provider.getPatterns(cmd.id, lang);
      for (const pattern of patterns) {
        const normPattern = normalizeCommand(pattern);
        if (normalized.length < 6 || normPattern.length < 6) continue;
        if (Math.abs(normalized.length - normPattern.length) > 3) continue;
        const dist = levenshtein(normalized, normPattern);
        if (dist > 0 && dist < bestDist) {
          bestDist = dist;
          bestMatch = { commandId: cmd.id, textBefore: "" };
        }
      }
    }
    return bestMatch;
  }

  // static/src/main.js
  var isRecording = false;
  var ws = null;
  var audioContext = null;
  var mediaStream = null;
  var processorNode = null;
  var useRealtime = true;
  var useDiarize = false;
  var useDualDelay = JSON.parse(localStorage.getItem("voxtral-dual-delay") || "false");
  var activeInsert = null;
  var isMidSentenceInsert = false;
  var isListOrHeadingInsert = false;
  var analyserNode = null;
  var micLevelAnimId = null;
  var smoothLevel = 0;
  var lastLabel = "";
  var userScrolledAway = false;
  var dualFastText = "";
  var dualSlowText = "";
  var dualFastInsert = null;
  var dualSlowConfirmed = "";
  var dualFastPrevRaw = "";
  var dualSlowPrevRaw = "";
  var realtimePrevRaw = "";
  var autoCorrect = JSON.parse(localStorage.getItem("voxtral-autocorrect") || "false");
  var noiseSuppression = JSON.parse(localStorage.getItem("voxtral-noise-suppression") || "false");
  var systemPrompt = localStorage.getItem("voxtral-system-prompt") || "";
  var activeLang = localStorage.getItem("voxtral-language") || "nl";
  var DEFAULT_SHORTCUT = { ctrl: true, shift: false, alt: false, meta: false, key: " " };
  var recordShortcut = loadShortcut();
  function loadShortcut() {
    try {
      const stored = localStorage.getItem("voxtral-shortcut");
      if (stored) return JSON.parse(stored);
    } catch {
    }
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
    return e.ctrlKey === sc.ctrl && e.shiftKey === sc.shift && e.altKey === sc.alt && e.metaKey === sc.meta && e.key === sc.key;
  }
  var transcript = document.getElementById("transcript");
  var btnRecord = document.getElementById("btn-record");
  var btnCopy = document.getElementById("btn-copy");
  var btnClear = document.getElementById("btn-clear");
  var modeToggle = document.getElementById("mode-toggle");
  var statusText = document.getElementById("status-text");
  var delaySelect = document.getElementById("delay-select");
  var savedDelay = localStorage.getItem("voxtral-delay");
  if (savedDelay && [...delaySelect.options].some((o) => o.value === savedDelay)) {
    delaySelect.value = savedDelay;
  }
  delaySelect.addEventListener("change", () => {
    localStorage.setItem("voxtral-delay", delaySelect.value);
  });
  var replaceHint = document.getElementById("replace-hint");
  var micLevel = document.getElementById("mic-level");
  var micLevelBar = document.getElementById("mic-level-bar");
  var micLevelLabel = document.getElementById("mic-level-label");
  (function initScrollTracking() {
    const main = transcript.closest("main");
    if (!main) return;
    let programmaticScroll = false;
    const origScrollTo = main.scrollTo.bind(main);
    main.scrollTo = function(...args) {
      programmaticScroll = true;
      origScrollTo(...args);
      setTimeout(() => {
        programmaticScroll = false;
      }, 600);
    };
    main.addEventListener("scroll", () => {
      if (programmaticScroll) return;
      const distFromBottom = main.scrollHeight - main.scrollTop - main.clientHeight;
      if (distFromBottom > 80) {
        userScrolledAway = true;
      } else {
        userScrolledAway = false;
      }
    });
  })();
  var queueInfo = document.getElementById("queue-info");
  var queueCount = document.getElementById("queue-count");
  var toast = document.getElementById("toast");
  var settingsOverlay = document.getElementById("settings-overlay");
  var inputApiKey = document.getElementById("input-apikey");
  var settingsStatus = document.getElementById("settings-status");
  var selectLanguage = document.getElementById("select-language");
  var LANG_NAMES = {
    nl: "Nederlands",
    en: "English",
    fr: "Fran\xE7ais",
    de: "Deutsch",
    es: "Espa\xF1ol",
    pt: "Portugu\xEAs",
    it: "Italiano",
    ru: "\u0420\u0443\u0441\u0441\u043A\u0438\u0439",
    zh: "\u4E2D\u6587",
    hi: "\u0939\u093F\u0928\u094D\u0926\u0940",
    ar: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629",
    ja: "\u65E5\u672C\u8A9E",
    ko: "\uD55C\uAD6D\uC5B4"
  };
  for (const [code, name] of Object.entries(LANG_NAMES)) {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = `${name} (${code})`;
    selectLanguage.appendChild(opt);
  }
  selectLanguage.value = activeLang;
  var diarizeToggle = document.getElementById("diarize-toggle");
  var diarizeLabel = document.getElementById("diarize-label");
  function updateModeUI() {
    if (isRecording) return;
    statusText.textContent = useRealtime ? useDualDelay ? "Realtime (dual-delay)" : "Realtime" : "Opname";
    delaySelect.disabled = !useRealtime || useDualDelay;
    if (useRealtime && useDualDelay) {
      delaySelect.style.opacity = "0.4";
      delaySelect.title = "Dual-delay actief (snel 240ms + nauwkeurig 2400ms)";
    } else {
      delaySelect.style.opacity = "";
      delaySelect.title = "Streaming delay";
    }
    const showDiarize = !useRealtime;
    diarizeToggle.closest(".toggle").classList.toggle("hidden-toggle", !showDiarize);
    diarizeLabel.classList.toggle("hidden-toggle", !showDiarize);
  }
  modeToggle.addEventListener("change", () => {
    if (isRecording) {
      modeToggle.checked = useRealtime;
      return;
    }
    useRealtime = modeToggle.checked;
    updateModeUI();
  });
  diarizeToggle.addEventListener("change", () => {
    if (isRecording) {
      diarizeToggle.checked = useDiarize;
      return;
    }
    useDiarize = diarizeToggle.checked;
  });
  function ensureInsertPoint() {
    if (activeInsert && transcript.contains(activeInsert)) return activeInsert;
    if (activeInsert && activeInsert.parentNode) activeInsert.remove();
    activeInsert = document.createElement("span");
    activeInsert.className = "partial";
    transcript.appendChild(activeInsert);
    return activeInsert;
  }
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
    if (target.textContent !== "") return false;
    const before = getTextBefore(target);
    if (!before) return false;
    const last = before[before.length - 1];
    return last !== " " && last !== "\n" && last !== "	";
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
    const trimmed = content.trimEnd();
    const lastChar = trimmed[trimmed.length - 1];
    if (lastChar !== "." && lastChar !== "!" && lastChar !== "?") return;
    let next = node.nextSibling;
    while (next) {
      if (next.textContent.trim().length > 0) break;
      next = next.nextSibling;
    }
    if (!next) return;
    const nextText = next.textContent;
    const match = nextText.match(/^(\s*)([a-zàáâãäåæçèéêëìíîïñòóôõöùúûüýÿ])/);
    if (match) {
      next.textContent = match[1] + match[2].toUpperCase() + nextText.slice(match[1].length + 1);
    }
  }
  function finalizeInsertPoint() {
    if (activeInsert) {
      if (activeInsert.textContent) {
        if (isMidSentenceInsert || isListOrHeadingInsert) {
          activeInsert.textContent = activeInsert.textContent.replace(/[.!?]+\s*$/, "");
        }
        if (needsSpaceAfter(activeInsert)) {
          activeInsert.textContent += " ";
        }
        if (!isMidSentenceInsert && !isListOrHeadingInsert) {
          capitalizeAfterSentenceEnd(activeInsert);
        }
      }
      activeInsert.classList.remove("partial", "replacing");
      activeInsert = null;
      isMidSentenceInsert = false;
      isListOrHeadingInsert = false;
    }
    replaceHint.classList.add("hidden");
  }
  var LANG_PATTERNS = {
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
      colon: ["dubbele punt", "double punt", "dubbelepunt"]
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
      colon: ["colon"]
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
      colon: ["deux points"]
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
      colon: ["doppelpunkt"]
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
      colon: ["dos puntos"]
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
      colon: ["dois pontos"]
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
      colon: ["due punti"]
    }
  };
  var LANG_MISHEARINGS = {
    nl: [
      [/\bniveau\b/g, "nieuwe"],
      [/\bniva\b/g, "nieuwe"],
      [/\bnieuw alinea\b/g, "nieuwe alinea"],
      [/\bnieuw regel\b/g, "nieuwe regel"],
      [/\blinea\b/g, "alinea"],
      [/\blinie\b/g, "alinea"],
      [/\bbeeindigde\b/g, "beeindig de"]
    ],
    fr: [[/\bnouveau ligne\b/g, "nouvelle ligne"], [/\bnouvelle paragraphe\b/g, "nouveau paragraphe"]],
    de: [[/\bneue absatz\b/g, "neuer absatz"], [/\bneues zeile\b/g, "neue zeile"]]
  };
  var COMMAND_DEFS = [
    { id: "newParagraph", insert: "\n\n", toast: "\xB6" },
    { id: "newLine", insert: "\n", toast: "\u21B5" },
    { id: "heading1", insert: "\n\n# ", toast: "# H1" },
    { id: "heading2", insert: "\n\n## ", toast: "## H2" },
    { id: "heading3", insert: "\n\n### ", toast: "### H3" },
    { id: "bulletPoint", action: "bulletPoint", toast: "\u2022" },
    { id: "todoItem", insert: "\n- [ ] ", toast: "\u2610" },
    { id: "numberedItem", action: "numberedItem", toast: "1." },
    { id: "stopRecording", action: "stopRecording", toast: "\u23F9 Stop" },
    { id: "deleteLastParagraph", action: "deleteLastParagraph", toast: "\u{1F5D1}" },
    { id: "deleteLastLine", action: "deleteLastLine", toast: "\u{1F5D1}" },
    { id: "undo", action: "undo", toast: "\u21A9" },
    { id: "colon", insert: ": ", punctuation: true, toast: ":" }
  ];
  function buildVoiceCommands(lang) {
    const langData = LANG_PATTERNS[lang] || {};
    const enData = lang === "en" ? {} : LANG_PATTERNS.en || {};
    return COMMAND_DEFS.map((def) => {
      const langP = langData[def.id] || [];
      const enP = enData[def.id] || [];
      const seen = /* @__PURE__ */ new Set();
      const patterns = [];
      for (const p of [...langP, ...enP]) {
        if (!seen.has(p)) {
          seen.add(p);
          patterns.push(p);
        }
      }
      return { ...def, patterns };
    });
  }
  var VOICE_COMMANDS = buildVoiceCommands(activeLang);
  function stripTrailingPunctuation2(str) {
    return str.replace(/[,;.!?]+\s*$/, "");
  }
  var PHONETIC_RULES = {
    nl: [
      [/ij/g, "ei"],
      [/au/g, "ou"],
      [/dt\b/g, "t"],
      [/\bsch/g, "sg"],
      [/ck/g, "k"],
      [/ph/g, "f"],
      [/th/g, "t"],
      [/ie/g, "i"],
      [/oe/g, "u"],
      [/ee/g, "e"],
      [/oo/g, "o"],
      [/uu/g, "u"],
      [/aa/g, "a"]
    ],
    en: [
      [/ph/g, "f"],
      [/th/g, "t"],
      [/ck/g, "k"],
      [/ght/g, "t"],
      [/wh/g, "w"],
      [/kn/g, "n"],
      [/wr/g, "r"],
      [/tion/g, "shun"],
      [/sion/g, "shun"]
    ],
    fr: [
      [/eau/g, "o"],
      [/aux/g, "o"],
      [/ai/g, "e"],
      [/ei/g, "e"],
      [/ph/g, "f"],
      [/qu/g, "k"],
      [/gn/g, "ny"],
      [/oi/g, "wa"],
      [/ou/g, "u"],
      [/an/g, "on"],
      [/en/g, "on"]
    ],
    de: [
      [/sch/g, "sh"],
      [/ei/g, "ai"],
      [/ie/g, "i"],
      [/ck/g, "k"],
      [/ph/g, "f"],
      [/th/g, "t"],
      [/v/g, "f"],
      [/tz/g, "ts"],
      [/dt\b/g, "t"],
      [/aa/g, "a"],
      [/ee/g, "e"],
      [/oo/g, "o"]
    ],
    es: [
      [/ll/g, "y"],
      [/v/g, "b"],
      [/ce/g, "se"],
      [/ci/g, "si"],
      [/qu/g, "k"],
      [/h/g, ""]
    ],
    pt: [
      [/lh/g, "ly"],
      [/nh/g, "ny"],
      [/ch/g, "sh"],
      [/qu/g, "k"],
      [/ção/g, "saun"],
      [/ss/g, "s"]
    ],
    it: [
      [/gn/g, "ny"],
      [/ch/g, "k"],
      [/gh/g, "g"],
      [/sc(?=[ei])/g, "sh"],
      [/zz/g, "ts"]
    ]
  };
  var LANG_ARTICLES = {
    nl: ["een", "de", "het", "die", "dat", "deze"],
    en: ["a", "an", "the"],
    fr: ["un", "une", "le", "la", "les", "l", "du", "des"],
    de: ["ein", "eine", "einen", "einem", "einer", "der", "die", "das", "den", "dem", "des"],
    es: ["un", "una", "el", "la", "los", "las"],
    pt: ["um", "uma", "o", "a", "os", "as"],
    it: ["un", "uno", "una", "il", "lo", "la", "i", "gli", "le"]
  };
  var LANG_TRAILING_FILLERS = {
    nl: ["alsjeblieft", "graag", "even", "maar", "eens", "dan", "nu", "hoor"],
    en: ["please", "now", "then", "thanks"],
    fr: ["s il vous plait", "s il te plait", "merci"],
    de: ["bitte", "mal", "jetzt", "dann"],
    es: ["por favor", "ahora", "gracias"],
    pt: ["por favor", "agora", "obrigado"],
    it: ["per favore", "ora", "adesso", "grazie"]
  };
  var webappLangProvider = {
    getPatterns(commandId, lang) {
      const cmd = VOICE_COMMANDS.find((c) => c.id === commandId);
      return cmd ? cmd.patterns : [];
    },
    getMishearings(lang) {
      return LANG_MISHEARINGS[lang] || [];
    },
    phoneticNormalize(text, lang) {
      const rules = PHONETIC_RULES[lang];
      if (!rules) return text;
      let result = text;
      for (const [pattern, replacement] of rules) {
        result = result.replace(pattern, replacement);
      }
      return result;
    },
    stripArticles(text, lang) {
      const articles = LANG_ARTICLES[lang];
      if (!articles || articles.length === 0) return text;
      const words = text.split(/\s+/);
      let stripped = 0;
      while (stripped < Math.min(2, words.length - 1)) {
        if (articles.includes(words[stripped])) stripped++;
        else break;
      }
      return stripped > 0 ? words.slice(stripped).join(" ") : text;
    },
    stripTrailingFillers(text, lang) {
      const fillers = LANG_TRAILING_FILLERS[lang];
      if (!fillers || fillers.length === 0) return text;
      let result = text;
      for (const filler of fillers.sort((a, b) => b.length - a.length)) {
        if (result.endsWith(" " + filler)) {
          result = result.slice(0, -(filler.length + 1)).trimEnd();
        }
      }
      return result;
    },
    trySplitCompound(text, knownPhrases) {
      if (text.includes(" ") || text.length < 4) return text;
      for (const phrase of knownPhrases) {
        const words = phrase.split(/\s+/);
        if (words.length < 2) continue;
        if (text === words.join("")) return phrase;
      }
      return text;
    }
  };
  function findCommand(rawText) {
    const result = findMatch(rawText, VOICE_COMMANDS, activeLang, webappLangProvider);
    if (!result) return null;
    const cmd = VOICE_COMMANDS.find((c) => c.id === result.commandId);
    if (!cmd) return null;
    return { cmd, textBefore: result.textBefore };
  }
  function checkForCommand() {
    if (!activeInsert || !activeInsert.textContent) return false;
    const raw = activeInsert.textContent.replace(/[.!?]/g, "");
    if (!raw.trim()) return false;
    const result = findCommand(raw);
    if (result) {
      if (result.textBefore) {
        const span = document.createElement("span");
        if (result.cmd.punctuation) {
          span.textContent = stripTrailingPunctuation2(result.textBefore) + result.cmd.insert;
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
  function processCompletedSentences() {
    if (!activeInsert || !activeInsert.textContent) return;
    const text = activeInsert.textContent;
    const parts = text.match(/\s*[^.!?]+[.!?]+/g);
    if (!parts) return;
    const matchedLength = parts.join("").length;
    const remainder = text.substring(matchedLength);
    const actions = parts.map((part) => {
      const trimmedPart = part.trim();
      const textOnly = trimmedPart.replace(/[.!?]+$/, "").trim();
      const result = findCommand(textOnly);
      const hexCodes = [...textOnly].map((c) => c.charCodeAt(0) > 127 ? `U+${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}` : c).join("");
      console.debug(`[voice] "${textOnly}" [${hexCodes}] \u2192 ${result ? "CMD: " + result.cmd.toast : "text"}`);
      return { trimmedPart, result };
    });
    const hasTextParts = actions.some((a) => !a.result);
    if (hasTextParts) {
      saveUndo();
    }
    activeInsert.textContent = remainder;
    let stopRequested = false;
    for (const { trimmedPart, result } of actions) {
      if (!transcript.contains(activeInsert)) {
        if (activeInsert.parentNode) activeInsert.remove();
        transcript.appendChild(activeInsert);
      }
      if (result) {
        const { cmd, textBefore } = result;
        if (textBefore) {
          const prefixSpan = document.createElement("span");
          if (cmd.punctuation) {
            prefixSpan.textContent = stripTrailingPunctuation2(textBefore) + cmd.insert;
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
              prev.textContent = stripTrailingPunctuation2(prev.textContent);
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
        const span = document.createElement("span");
        span.textContent = trimmedPart + " ";
        activeInsert.parentNode.insertBefore(span, activeInsert);
      }
    }
    isMidSentenceInsert = false;
    isListOrHeadingInsert = false;
    if (stopRequested) {
      if (activeInsert) {
        activeInsert.remove();
        activeInsert = null;
      }
      setTimeout(() => {
        if (isRecording) btnRecord.click();
      }, 0);
    }
  }
  function executeCommand(cmd) {
    if (activeInsert) {
      activeInsert.textContent = "";
    }
    if (cmd.insert) {
      if (activeInsert) {
        if (cmd.punctuation) {
          const prev = activeInsert.previousSibling;
          if (prev && prev.textContent) {
            prev.textContent = stripTrailingPunctuation2(prev.textContent);
          }
        }
        activeInsert.textContent = cmd.insert;
        activeInsert.classList.remove("partial", "replacing");
        activeInsert = null;
      }
    } else if (cmd.action === "stopRecording") {
      if (activeInsert) {
        activeInsert.remove();
        activeInsert = null;
      }
      if (isRecording) btnRecord.click();
    } else if (cmd.action === "deleteLastParagraph") {
      if (activeInsert) {
        activeInsert.remove();
        activeInsert = null;
      }
      deleteLastBlock("paragraph");
    } else if (cmd.action === "deleteLastLine") {
      if (activeInsert) {
        activeInsert.remove();
        activeInsert = null;
      }
      deleteLastBlock("line");
    } else if (cmd.action === "undo") {
      if (activeInsert) {
        activeInsert.remove();
        activeInsert = null;
      }
      restoreUndo();
    } else if (cmd.action === "numberedItem") {
      insertNumberedItem();
    } else if (cmd.action === "bulletPoint") {
      insertContextBullet();
    }
    isMidSentenceInsert = false;
    isListOrHeadingInsert = false;
    replaceHint.classList.add("hidden");
    showToast(cmd.toast);
  }
  function insertContextBullet() {
    const text = transcript.textContent || "";
    const lastLine = text.split("\n").filter((l) => l.trim()).pop() || "";
    let insertText;
    if (/^\d+\.\s/.test(lastLine)) {
      const num = parseInt(lastLine.match(/^(\d+)/)?.[1] ?? "0", 10);
      insertText = `
${num + 1}. `;
    } else if (/^- \[[ x]\]\s/.test(lastLine)) {
      insertText = "\n- [ ] ";
    } else {
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
    const match = text.match(/(\d+)\.\s[^\n]*$/);
    const nextNum = match ? parseInt(match[1], 10) + 1 : 1;
    const span = document.createElement("span");
    span.textContent = `
${nextNum}. `;
    if (activeInsert && activeInsert.parentNode) {
      activeInsert.parentNode.insertBefore(span, activeInsert);
    } else {
      transcript.appendChild(span);
    }
  }
  var undoStack = [];
  function saveUndo() {
    undoStack.push(transcript.innerHTML);
    if (undoStack.length > 20) undoStack.shift();
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
      const idx = fullText.lastIndexOf("\n\n");
      newText = idx > 0 ? fullText.substring(0, idx) : "";
    } else {
      const trimmed = fullText.trimEnd();
      let cutIdx = -1;
      for (let i = trimmed.length - 2; i >= 0; i--) {
        const ch = trimmed[i];
        if (ch === "." || ch === "!" || ch === "?") {
          cutIdx = i + 1;
          break;
        }
        if (ch === "\n") {
          cutIdx = i + 1;
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
  function detectInsertContextFromNode(node) {
    const before = getTextBefore(node);
    if (!before) return "sentence-start";
    const lastLine = before.split("\n").pop() || "";
    return detectContext(lastLine) === "new-line" ? "sentence-start" : detectContext(lastLine);
  }
  function feedText(text) {
    clearPlaceholder();
    const target = ensureInsertPoint();
    if (needsSpaceBefore(target) && text.length > 0 && text[0] !== " " && text[0] !== "\n") {
      target.textContent = " ";
    }
    if (target.textContent.endsWith(" ") && text.startsWith(" ")) {
      text = text.replace(/^ +/, "");
    }
    if (target.textContent === "" && text.startsWith(" ")) {
      const before = getTextBefore(target);
      if (before && before.endsWith(" ")) {
        text = text.replace(/^ +/, "");
      }
    }
    if (target.textContent.replace(/ /g, "") === "") {
      const context = detectInsertContextFromNode(target);
      isMidSentenceInsert = context === "mid-sentence";
      isListOrHeadingInsert = context === "list-or-heading";
      if (isMidSentenceInsert) {
        text = lowercaseFirstLetter(text);
      }
    }
    target.textContent += text;
    if (!transcript.contains(target)) {
      if (target.parentNode) target.remove();
      transcript.appendChild(target);
    }
    scrollToInsertPoint();
    processCompletedSentences();
  }
  transcript.addEventListener("mouseup", () => {
    if (transcript.querySelector(".placeholder")) return;
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      if (!transcript.contains(sel.anchorNode)) return;
      if (!transcript.contains(sel.focusNode)) return;
      processDualSlowCommands();
      finalizeInsertPoint();
      dualFastText = "";
      dualSlowText = "";
      dualSlowConfirmed = "";
      if (!sel.isCollapsed) {
        const range = sel.getRangeAt(0);
        const transcriptRange = document.createRange();
        transcriptRange.selectNodeContents(transcript);
        if (range.compareBoundaryPoints(Range.START_TO_START, transcriptRange) < 0) {
          range.setStart(transcriptRange.startContainer, transcriptRange.startOffset);
        }
        if (range.compareBoundaryPoints(Range.END_TO_END, transcriptRange) > 0) {
          range.setEnd(transcriptRange.endContainer, transcriptRange.endOffset);
        }
        saveUndo();
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
        if (!transcript.contains(marker)) {
          marker.remove();
          transcript.appendChild(marker);
        }
        activeInsert = marker;
        replaceHint.classList.remove("hidden");
        sel.removeAllRanges();
      } else {
        const range = sel.getRangeAt(0);
        const newInsert = document.createElement("span");
        newInsert.className = "partial";
        range.insertNode(newInsert);
        if (!transcript.contains(newInsert)) {
          newInsert.remove();
          transcript.appendChild(newInsert);
        }
        activeInsert = newInsert;
        sel.removeAllRanges();
      }
    }, 10);
  });
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
  async function saveToQueue(blob) {
    const db = await openDB();
    const tx = db.transaction("recordings", "readwrite");
    tx.objectStore("recordings").add(blob);
    await new Promise((res, rej) => {
      tx.oncomplete = res;
      tx.onerror = rej;
    });
    updateQueueBadge();
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
  var isProcessingQueue = false;
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
    let processed = 0;
    for (const key of allKeys) {
      const getTx = db.transaction("recordings", "readonly");
      const blob = await new Promise((res) => {
        const req = getTx.objectStore("recordings").get(key);
        req.onsuccess = () => res(req.result);
        req.onerror = () => res(null);
      });
      if (!blob) continue;
      try {
        const formData = new FormData();
        formData.append("file", blob, "recording.webm");
        const resp = await fetch("/api/transcribe", { method: "POST", body: formData });
        if (!resp.ok) {
          console.warn(`Queue item ${key}: server returned ${resp.status}, skipping for now`);
          continue;
        }
        const data = await resp.json();
        if (data.text) appendFinalText(data.text + " ");
        const delTx = db.transaction("recordings", "readwrite");
        delTx.objectStore("recordings").delete(key);
        await new Promise((res) => {
          delTx.oncomplete = res;
        });
        processed++;
      } catch (err) {
        console.warn("Queue processing failed (offline?):", err.message);
        break;
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
    if (userScrolledAway) return;
    const main = transcript.closest("main");
    if (!main) return;
    if (activeInsert && transcript.contains(activeInsert)) {
      const mainRect = main.getBoundingClientRect();
      const insertRect = activeInsert.getBoundingClientRect();
      const relativePos = (insertRect.top - mainRect.top) / mainRect.height;
      if (relativePos < 0 || relativePos > 0.5) {
        const targetOffset = mainRect.height * 0.35;
        const insertOffsetInMain = insertRect.top - mainRect.top + main.scrollTop;
        main.scrollTo({ top: insertOffsetInMain - targetOffset, behavior: "smooth" });
      }
    } else {
      main.scrollTop = main.scrollHeight;
    }
  }
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
    const rawLevel = Math.min(1, rms * 3);
    const SILENCE_FLOOR = 0.06;
    if (rawLevel > SILENCE_FLOOR) {
      smoothLevel = smoothLevel === 0 ? rawLevel : smoothLevel * 0.98 + rawLevel * 0.02;
    }
    let newLabel, dotColor;
    if (smoothLevel < SILENCE_FLOOR) {
      newLabel = "";
      dotColor = "#555";
    } else if (smoothLevel < 0.12) {
      newLabel = "te zacht";
      dotColor = "#ef4444";
    } else if (smoothLevel > 0.75) {
      newLabel = "te hard";
      dotColor = "#ef4444";
    } else if (smoothLevel > 0.45) {
      newLabel = "hard";
      dotColor = "#eab308";
    } else {
      newLabel = "in orde";
      dotColor = "#4ade80";
    }
    micLevel.style.background = dotColor;
    if (newLabel !== lastLabel) {
      micLevelLabel.textContent = newLabel;
      micLevelLabel.style.color = dotColor;
      lastLabel = newLabel;
    }
    micLevelAnimId = requestAnimationFrame(updateMicLevel);
  }
  function stopMicLevel() {
    if (micLevelAnimId) {
      cancelAnimationFrame(micLevelAnimId);
      micLevelAnimId = null;
    }
    if (analyserNode) {
      analyserNode.disconnect();
      analyserNode = null;
    }
    smoothLevel = 0;
    lastLabel = "";
    micLevel.classList.add("hidden");
    micLevelLabel.classList.add("hidden");
    micLevel.style.background = "#555";
    micLevelLabel.textContent = "";
  }
  function floatTo16BitPCM(float32Array) {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(i * 2, s < 0 ? s * 32768 : s * 32767, true);
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
      if (selectedMicId) {
        console.warn("Selected mic failed, falling back to default:", err.message);
        const fallback = { channelCount: 1, ...extraConstraints };
        const stream = await navigator.mediaDevices.getUserMedia({ audio: fallback });
        showToast("Geselecteerde microfoon niet beschikbaar \u2014 standaard gebruikt");
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
        const isCumulative = realtimePrevRaw && msg.text.startsWith(realtimePrevRaw);
        const newText = isCumulative ? msg.text.substring(realtimePrevRaw.length) : msg.text;
        realtimePrevRaw = isCumulative ? msg.text : realtimePrevRaw + msg.text;
        if (newText) feedText(newText);
      } else if (msg.type === "done") {
        if (!checkForCommand()) finalizeInsertPoint();
      } else if (msg.type === "error") {
        console.error("Transcription error (full):", msg.message);
        showToast("Serverfout \u2014 herverbinden...");
      }
    };
    ws.onerror = (err) => console.error("WebSocket error:", err);
    ws.onclose = () => {
      if (isRecording) {
        console.log("WebSocket closed while recording \u2014 attempting reconnect...");
        stopAudioCapture();
        finalizeInsertPoint();
        showToast("Verbinding verbroken \u2014 herverbinden...");
        setTimeout(async () => {
          if (!isRecording) return;
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
    mediaStream = await acquireMic({ sampleRate: 16e3 });
    audioContext = new AudioContext({ sampleRate: 16e3 });
    const source = audioContext.createMediaStreamSource(mediaStream);
    processorNode = audioContext.createScriptProcessor(4096, 1, 1);
    processorNode.onaudioprocess = (e) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const inputData = e.inputBuffer.getChannelData(0);
      const downsampled = downsample(inputData, audioContext.sampleRate, 16e3);
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
  async function startDualDelay() {
    const fastDelay = 240;
    const slowDelay = 2400;
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${protocol}//${location.host}/ws/transcribe-dual?fast_delay=${fastDelay}&slow_delay=${slowDelay}`);
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
          renderDualText();
        }
      } else if (msg.stream === "slow") {
        if (msg.type === "delta") {
          const isCumulative = dualSlowPrevRaw && msg.text.startsWith(dualSlowPrevRaw);
          if (isCumulative) {
            const newPart = msg.text.substring(dualSlowPrevRaw.length);
            if (newPart) dualSlowText += newPart;
          } else {
            dualSlowText += msg.text;
          }
          dualSlowPrevRaw = isCumulative ? msg.text : dualSlowPrevRaw + msg.text;
          renderDualText();
          processDualSlowCommands();
        } else if (msg.type === "done") {
          renderDualText();
          processDualSlowCommands();
          dualSlowConfirmed = dualSlowText;
        }
      } else if (msg.type === "error") {
        console.error("Dual-delay error:", msg.message, msg.stream);
        showToast("Serverfout \u2014 herverbinden...");
      }
    };
    ws.onerror = (err) => console.error("Dual-delay WebSocket error:", err);
    ws.onclose = () => {
      if (isRecording) {
        console.log("Dual-delay WebSocket closed while recording \u2014 attempting reconnect...");
        stopAudioCapture();
        finalizeInsertPoint();
        showToast("Verbinding verbroken \u2014 herverbinden...");
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
    mediaStream = await acquireMic({ sampleRate: 16e3 });
    audioContext = new AudioContext({ sampleRate: 16e3 });
    const source = audioContext.createMediaStreamSource(mediaStream);
    processorNode = audioContext.createScriptProcessor(4096, 1, 1);
    processorNode.onaudioprocess = (e) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const inputData = e.inputBuffer.getChannelData(0);
      const downsampled = downsample(inputData, audioContext.sampleRate, 16e3);
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
    const slowLen = dualSlowText.length;
    const fastLen = dualFastText.length;
    if (fastLen > slowLen) {
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
      target.textContent = dualSlowText;
      target.className = "partial dual-confirmed";
    }
    scrollToInsertPoint();
  }
  function processDualSlowCommands() {
    if (!dualSlowText) return;
    const parts = dualSlowText.match(/\s*[^.!?]+[.!?]+/g);
    if (!parts) return;
    const matchedLength = parts.join("").length;
    const remainder = dualSlowText.substring(matchedLength);
    const actions = parts.map((part) => {
      const trimmedPart = part.trim();
      const textOnly = trimmedPart.replace(/[.!?]+$/, "").trim();
      const result = findCommand(textOnly);
      console.debug(`[dual-voice] "${textOnly}" \u2192 ${result ? "CMD: " + result.cmd.toast : "text"}`);
      return { trimmedPart, result };
    });
    const hasTextParts = actions.some((a) => !a.result);
    if (hasTextParts) saveUndo();
    const target = ensureInsertPoint();
    target.innerHTML = "";
    target.textContent = "";
    let stopRequested = false;
    for (const { trimmedPart, result } of actions) {
      if (!transcript.contains(activeInsert)) {
        if (activeInsert.parentNode) activeInsert.remove();
        transcript.appendChild(activeInsert);
      }
      if (result) {
        const { cmd, textBefore } = result;
        if (textBefore) {
          const prefixSpan = document.createElement("span");
          if (cmd.punctuation) {
            prefixSpan.textContent = stripTrailingPunctuation2(textBefore) + cmd.insert;
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
              prev.textContent = stripTrailingPunctuation2(prev.textContent);
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
        const span = document.createElement("span");
        span.textContent = trimmedPart + " ";
        activeInsert.parentNode.insertBefore(span, activeInsert);
      }
    }
    isMidSentenceInsert = false;
    isListOrHeadingInsert = false;
    dualSlowText = remainder;
    if (dualFastText.length >= matchedLength) {
      dualFastText = dualFastText.substring(matchedLength);
    } else {
      dualFastText = "";
    }
    dualSlowConfirmed = dualSlowText;
    renderDualText();
    if (stopRequested) {
      dualSlowText = "";
      dualFastText = "";
      dualSlowConfirmed = "";
      if (activeInsert) {
        activeInsert.remove();
        activeInsert = null;
      }
      setTimeout(() => {
        if (isRecording) btnRecord.click();
      }, 0);
    }
  }
  function stopDualDelay() {
    if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    ws = null;
    stopAudioCapture();
    processDualSlowCommands();
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
  var mediaRecorder = null;
  var offlineChunks = [];
  async function startOffline() {
    statusText.textContent = "Opnemen...";
    mediaStream = await acquireMic();
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
              clearPlaceholder();
              appendDiarizedText(data.segments);
            } else if (data.text) {
              clearPlaceholder();
              feedText(data.text);
              checkForCommand();
            }
          } else {
            await saveToQueue(blob);
          }
        } catch {
          await saveToQueue(blob);
        }
        updateModeUI();
      }
      offlineChunks = [];
      finalizeInsertPoint();
      autoCorrectAfterStop().then(() => copyTranscript());
    };
    mediaRecorder.start(1e3);
  }
  function stopOffline() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
    mediaRecorder = null;
    stopAudioCapture();
  }
  function stopAudioCapture() {
    stopMicLevel();
    if (processorNode) {
      processorNode.disconnect();
      processorNode = null;
    }
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
    }
  }
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
        autoCorrectAfterStop().then(() => copyTranscript());
      } else {
        stopOffline();
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
        const msg = err.name === "NotReadableError" || err.name === "NotFoundError" ? "Microfoon niet beschikbaar \u2014 controleer je apparaat of kies een andere microfoon in de instellingen" : err.name === "NotAllowedError" ? "Geen toestemming voor microfoon \u2014 sta toegang toe in je browser" : "Fout: " + err.message;
        statusText.textContent = msg;
      }
    }
  });
  async function copyTranscript() {
    let text = transcript.innerText.trim();
    if (!text || text === "Druk op opnemen om te beginnen...") return;
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
  var btnCorrect = document.getElementById("btn-correct");
  async function correctText(text) {
    const resp = await fetch("/api/correct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, system_prompt: systemPrompt })
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
    } finally {
      btnCorrect.textContent = "Controleer";
      btnCorrect.disabled = false;
    }
  }
  btnClear.addEventListener("click", () => {
    if (isRecording) return;
    transcript.innerHTML = '<span class="placeholder">Druk op opnemen om te beginnen...</span>';
    activeInsert = null;
    undoStack = [];
  });
  function showToast(message) {
    toast.textContent = message;
    toast.classList.remove("hidden");
    setTimeout(() => toast.classList.add("hidden"), 1500);
  }
  window.addEventListener("online", () => {
    console.log("Back online \u2014 processing queue");
    processQueue();
  });
  setInterval(async () => {
    const count = await getQueueCount();
    if (count > 0 && navigator.onLine) processQueue();
  }, 3e4);
  queueInfo.style.cursor = "pointer";
  queueInfo.title = "Klik om wachtrij opnieuw te verwerken";
  queueInfo.addEventListener("click", () => {
    if (!isProcessingQueue) processQueue();
  });
  var toggleDualDelay = document.getElementById("toggle-dual-delay");
  var toggleAutocorrect = document.getElementById("toggle-autocorrect");
  var toggleNoiseSuppression = document.getElementById("toggle-noise-suppression");
  var inputSystemPrompt = document.getElementById("input-system-prompt");
  var selectMicrophone = document.getElementById("select-microphone");
  var selectRealtimeModel = document.getElementById("select-realtime-model");
  var selectBatchModel = document.getElementById("select-batch-model");
  var selectCorrectModel = document.getElementById("select-correct-model");
  var selectedMicId = localStorage.getItem("voxtral-mic") || "";
  var cachedModels = null;
  async function loadMicrophones() {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => s.getTracks().forEach((t) => t.stop()));
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter((d) => d.kind === "audioinput");
      selectMicrophone.innerHTML = "";
      for (const mic of mics) {
        const opt = document.createElement("option");
        opt.value = mic.deviceId;
        opt.textContent = mic.label || `Microfoon ${selectMicrophone.options.length + 1}`;
        if (mic.deviceId === selectedMicId) opt.selected = true;
        selectMicrophone.appendChild(opt);
      }
      if (!selectedMicId && mics.length > 0) {
        selectedMicId = mics[0].deviceId;
      }
    } catch {
      selectMicrophone.innerHTML = "<option>Geen toegang tot microfoon</option>";
    }
  }
  async function loadModels(currentSettings) {
    const realtimeVal = currentSettings?.realtime_model || "";
    const batchVal = currentSettings?.batch_model || "";
    const correctVal = currentSettings?.correct_model || "";
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
      let populate = function(select, models, currentVal) {
        select.innerHTML = "";
        const ids = models.map((m) => m.id);
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
      };
      if (!cachedModels) {
        const resp = await fetch("/api/models");
        if (!resp.ok) return;
        const data = await resp.json();
        cachedModels = data.models || [];
      }
      const realtimeModels = cachedModels.filter((m) => m.id.includes("realtime"));
      const allTranscription = cachedModels.filter((m) => !!m.capabilities?.audio_transcription);
      const batchModels = allTranscription.filter((m) => !m.id.includes("realtime"));
      const chatModels = cachedModels.filter((m) => !!m.capabilities?.completion_chat && !m.capabilities?.audio_transcription && !m.id.startsWith("voxtral"));
      populate(selectRealtimeModel, realtimeModels, realtimeVal);
      populate(selectBatchModel, batchModels, batchVal);
      populate(selectCorrectModel, chatModels, correctVal);
    } catch {
    }
  }
  function openSettings() {
    settingsOverlay.classList.remove("hidden");
    settingsStatus.textContent = "";
    settingsStatus.className = "modal-status";
    inputApiKey.value = "";
    fetch("/api/settings").then((r) => r.json()).then((data) => {
      inputApiKey.placeholder = data.has_key ? data.masked_key : "Plak je API key hier...";
      if (data.language) {
        selectLanguage.value = data.language;
      }
      loadModels(data);
    }).catch(() => {
    });
    toggleDualDelay.checked = useDualDelay;
    toggleAutocorrect.checked = autoCorrect;
    toggleNoiseSuppression.checked = noiseSuppression;
    inputSystemPrompt.value = systemPrompt;
    selectLanguage.value = activeLang;
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
  document.getElementById("btn-toggle-key").addEventListener("click", () => {
    inputApiKey.type = inputApiKey.type === "password" ? "text" : "password";
  });
  document.getElementById("btn-save-key").addEventListener("click", async () => {
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
    const newLang = selectLanguage.value;
    if (newLang !== activeLang) {
      activeLang = newLang;
      localStorage.setItem("voxtral-language", activeLang);
      VOICE_COMMANDS = buildVoiceCommands(activeLang);
      updateBmcLink();
    }
    const key = inputApiKey.value.trim();
    const payload = {
      language: activeLang,
      realtime_model: selectRealtimeModel.value,
      batch_model: selectBatchModel.value,
      correct_model: selectCorrectModel.value
    };
    if (key) payload.api_key = key;
    if (!key) {
      fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).catch(() => {
      });
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
        body: JSON.stringify(payload)
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
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (!settingsOverlay.classList.contains("hidden")) return;
    if (matchesShortcut(e, recordShortcut)) {
      e.preventDefault();
      btnRecord.click();
    }
  });
  var helpPanel = document.getElementById("help-panel");
  var helpTitle = document.getElementById("help-title");
  var helpContent = document.getElementById("help-content");
  var btnHelp = document.getElementById("btn-help");
  var btnCloseHelp = document.getElementById("btn-close-help");
  var HELP_UI = {
    nl: { title: "Stemcommando's", shortcutLabel: "Sneltoets", shortcutDesc: "Start / stop opname" },
    en: { title: "Voice Commands", shortcutLabel: "Shortcut", shortcutDesc: "Start / stop recording" },
    fr: { title: "Commandes vocales", shortcutLabel: "Raccourci", shortcutDesc: "D\xE9marrer / arr\xEAter" },
    de: { title: "Sprachbefehle", shortcutLabel: "Tastenk\xFCrzel", shortcutDesc: "Aufnahme starten / stoppen" },
    es: { title: "Comandos de voz", shortcutLabel: "Atajo", shortcutDesc: "Iniciar / detener" },
    pt: { title: "Comandos de voz", shortcutLabel: "Atalho", shortcutDesc: "Iniciar / parar" },
    it: { title: "Comandi vocali", shortcutLabel: "Scorciatoia", shortcutDesc: "Avvia / ferma" }
  };
  var HELP_GROUPS = [
    { ids: ["newParagraph", "newLine"], label: { nl: "Structuur", en: "Structure", fr: "Structure", de: "Struktur", es: "Estructura", pt: "Estrutura", it: "Struttura" } },
    { ids: ["heading1", "heading2", "heading3"], label: { nl: "Koppen", en: "Headings", fr: "Titres", de: "\xDCberschriften", es: "T\xEDtulos", pt: "T\xEDtulos", it: "Titoli" } },
    { ids: ["bulletPoint", "todoItem", "numberedItem"], label: { nl: "Lijst", en: "Lists", fr: "Listes", de: "Listen", es: "Listas", pt: "Listas", it: "Elenchi" } },
    { ids: ["stopRecording", "deleteLastParagraph", "deleteLastLine", "undo"], label: { nl: "Bediening", en: "Controls", fr: "Contr\xF4les", de: "Steuerung", es: "Controles", pt: "Controles", it: "Controlli" } },
    { ids: ["colon"], label: { nl: "Leestekens", en: "Punctuation", fr: "Ponctuation", de: "Satzzeichen", es: "Puntuaci\xF3n", pt: "Pontua\xE7\xE3o", it: "Punteggiatura" } }
  ];
  function renderHelpPanel() {
    const lang = activeLang;
    const ui = HELP_UI[lang] || HELP_UI.en;
    helpTitle.textContent = ui.title;
    helpContent.innerHTML = "";
    for (const group of HELP_GROUPS) {
      const h32 = document.createElement("h3");
      h32.textContent = group.label[lang] || group.label.en;
      helpContent.appendChild(h32);
      const dl2 = document.createElement("dl");
      for (const id of group.ids) {
        const cmd = VOICE_COMMANDS.find((c) => c.id === id);
        if (!cmd || cmd.patterns.length === 0) continue;
        const dt2 = document.createElement("dt");
        dt2.textContent = cmd.patterns.slice(0, 2).map((p) => `"${p}"`).join(" / ");
        const dd2 = document.createElement("dd");
        dd2.textContent = cmd.toast;
        dl2.appendChild(dt2);
        dl2.appendChild(dd2);
      }
      helpContent.appendChild(dl2);
    }
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
  renderHelpPanel();
  btnHelp.addEventListener("click", () => {
    renderHelpPanel();
    updateShortcutDisplays();
    helpPanel.classList.toggle("visible");
  });
  btnCloseHelp.addEventListener("click", () => {
    helpPanel.classList.remove("visible");
  });
  var inputShortcut = document.getElementById("input-shortcut");
  var btnResetShortcut = document.getElementById("btn-reset-shortcut");
  var pendingShortcut = null;
  inputShortcut.addEventListener("keydown", (e) => {
    e.preventDefault();
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
  document.getElementById("btn-settings").addEventListener("click", () => {
    pendingShortcut = null;
    inputShortcut.value = shortcutLabel(recordShortcut);
  });
  document.getElementById("btn-save-key").addEventListener("click", () => {
    if (pendingShortcut) {
      saveShortcut(pendingShortcut);
      pendingShortcut = null;
    }
  });
  var BMC_BUTTONS = [
    "\u2615 Buy me a coffee",
    // morning
    "\u{1F4D6} Buy me a book",
    // afternoon
    "\u{1F37A} Buy me a beer",
    // evening
    "\u{1F6CF}\uFE0F I like what you built!"
    // night
  ];
  var BMC_TAGLINES = {
    // [morning, afternoon, evening, night]
    en: [
      "Need a coffee to process all this? Me too!",
      "Writing a book? I like books too!",
      "Worked so fast you have time for a beer? Let me join you!",
      "Time to go to bed! No more coffee."
    ],
    nl: [
      "Een koffie nodig om dit allemaal te verwerken? Ik ook!",
      "Een boek aan het schrijven? Ik hou ook van boeken!",
      "Zo snel gewerkt dat je tijd hebt voor een biertje? Ik doe mee!",
      "Tijd om naar bed te gaan! Geen koffie meer."
    ],
    fr: [
      "Besoin d'un caf\xE9 pour dig\xE9rer tout \xE7a ? Moi aussi !",
      "Tu \xE9cris un livre ? J'aime les livres aussi !",
      "Tu as travaill\xE9 si vite qu'il te reste du temps pour une bi\xE8re ? Je t'accompagne !",
      "C'est l'heure d'aller dormir ! Plus de caf\xE9."
    ],
    de: [
      "Brauchst du einen Kaffee, um das alles zu verarbeiten? Ich auch!",
      "Schreibst du ein Buch? Ich mag B\xFCcher auch!",
      "So schnell gearbeitet, dass du Zeit f\xFCr ein Bier hast? Ich bin dabei!",
      "Zeit, ins Bett zu gehen! Kein Kaffee mehr."
    ],
    es: [
      "\xBFNecesitas un caf\xE9 para procesar todo esto? \xA1Yo tambi\xE9n!",
      "\xBFEscribiendo un libro? \xA1A m\xED tambi\xE9n me gustan los libros!",
      "\xBFTrabajaste tan r\xE1pido que tienes tiempo para una cerveza? \xA1Me apunto!",
      "\xA1Hora de irse a la cama! No m\xE1s caf\xE9."
    ],
    pt: [
      "Precisa de um caf\xE9 para processar tudo isto? Eu tamb\xE9m!",
      "Escrevendo um livro? Tamb\xE9m gosto de livros!",
      "Trabalhou t\xE3o r\xE1pido que tem tempo para uma cerveja? Eu vou junto!",
      "Hora de ir dormir! Chega de caf\xE9."
    ],
    it: [
      "Hai bisogno di un caff\xE8 per elaborare tutto questo? Anch'io!",
      "Stai scrivendo un libro? Anche a me piacciono i libri!",
      "Hai lavorato cos\xEC veloce che hai tempo per una birra? Mi unisco!",
      "\xC8 ora di andare a dormire! Basta caff\xE8."
    ],
    ru: [
      "\u041D\u0443\u0436\u0435\u043D \u043A\u043E\u0444\u0435, \u0447\u0442\u043E\u0431\u044B \u0432\u0441\u0451 \u044D\u0442\u043E \u043F\u0435\u0440\u0435\u0432\u0430\u0440\u0438\u0442\u044C? \u041C\u043D\u0435 \u0442\u043E\u0436\u0435!",
      "\u041F\u0438\u0448\u0435\u0448\u044C \u043A\u043D\u0438\u0433\u0443? \u042F \u0442\u043E\u0436\u0435 \u043B\u044E\u0431\u043B\u044E \u043A\u043D\u0438\u0433\u0438!",
      "\u0420\u0430\u0431\u043E\u0442\u0430\u043B \u0442\u0430\u043A \u0431\u044B\u0441\u0442\u0440\u043E, \u0447\u0442\u043E \u0435\u0441\u0442\u044C \u0432\u0440\u0435\u043C\u044F \u043D\u0430 \u043F\u0438\u0432\u043E? \u042F \u0441 \u0442\u043E\u0431\u043E\u0439!",
      "\u041F\u043E\u0440\u0430 \u0441\u043F\u0430\u0442\u044C! \u0425\u0432\u0430\u0442\u0438\u0442 \u043A\u043E\u0444\u0435."
    ],
    zh: [
      "\u9700\u8981\u4E00\u676F\u5496\u5561\u6765\u6D88\u5316\u8FD9\u4E00\u5207\uFF1F\u6211\u4E5F\u662F\uFF01",
      "\u5728\u5199\u4E66\uFF1F\u6211\u4E5F\u559C\u6B22\u4E66\uFF01",
      "\u5DE5\u4F5C\u8FD9\u4E48\u5FEB\uFF0C\u6709\u65F6\u95F4\u559D\u676F\u5564\u9152\uFF1F\u6211\u4E5F\u6765\u4E00\u676F\uFF01",
      "\u8BE5\u7761\u89C9\u4E86\uFF01\u522B\u518D\u559D\u5496\u5561\u4E86\u3002"
    ],
    hi: [
      "\u0907\u0924\u0928\u093E \u0938\u092C \u0938\u092E\u091D\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F \u0915\u0949\u092B\u093C\u0940 \u091A\u093E\u0939\u093F\u090F? \u092E\u0941\u091D\u0947 \u092D\u0940!",
      "\u0915\u093F\u0924\u093E\u092C \u0932\u093F\u0916 \u0930\u0939\u0947 \u0939\u094B? \u092E\u0941\u091D\u0947 \u092D\u0940 \u0915\u093F\u0924\u093E\u092C\u0947\u0902 \u092A\u0938\u0902\u0926 \u0939\u0948\u0902!",
      "\u0907\u0924\u0928\u0940 \u0924\u0947\u091C\u093C\u0940 \u0938\u0947 \u0915\u093E\u092E \u0915\u093F\u092F\u093E \u0915\u093F \u092C\u0940\u092F\u0930 \u0915\u093E \u091F\u093E\u0907\u092E \u0939\u0948? \u092E\u0948\u0902 \u092D\u0940 \u0906\u0924\u093E \u0939\u0942\u0901!",
      "\u0938\u094B\u0928\u0947 \u0915\u093E \u091F\u093E\u0907\u092E! \u0905\u092C \u0914\u0930 \u0915\u0949\u092B\u093C\u0940 \u0928\u0939\u0940\u0902\u0964"
    ],
    ar: [
      "\u062A\u062D\u062A\u0627\u062C \u0642\u0647\u0648\u0629 \u0644\u0645\u0639\u0627\u0644\u062C\u0629 \u0643\u0644 \u0647\u0630\u0627\u061F \u0623\u0646\u0627 \u0623\u064A\u0636\u0627\u064B!",
      "\u062A\u0643\u062A\u0628 \u0643\u062A\u0627\u0628\u0627\u064B\u061F \u0623\u0646\u0627 \u0623\u062D\u0628 \u0627\u0644\u0643\u062A\u0628 \u0623\u064A\u0636\u0627\u064B!",
      "\u0639\u0645\u0644\u062A \u0628\u0633\u0631\u0639\u0629 \u0648\u0639\u0646\u062F\u0643 \u0648\u0642\u062A \u0644\u0628\u064A\u0631\u0629\u061F \u0623\u0646\u0627 \u0645\u0639\u0643!",
      "\u062D\u0627\u0646 \u0648\u0642\u062A \u0627\u0644\u0646\u0648\u0645! \u0644\u0627 \u0645\u0632\u064A\u062F \u0645\u0646 \u0627\u0644\u0642\u0647\u0648\u0629."
    ],
    ja: [
      "\u3053\u308C\u3092\u5168\u90E8\u51E6\u7406\u3059\u308B\u306E\u306B\u30B3\u30FC\u30D2\u30FC\u304C\u5FC5\u8981\uFF1F\u79C1\u3082\uFF01",
      "\u672C\u3092\u66F8\u3044\u3066\u308B\u306E\uFF1F\u79C1\u3082\u672C\u304C\u597D\u304D\uFF01",
      "\u3053\u3093\u306A\u306B\u65E9\u304F\u4ED5\u4E8B\u3057\u3066\u30D3\u30FC\u30EB\u306E\u6642\u9593\uFF1F\u4E00\u7DD2\u306B\u98F2\u3082\u3046\uFF01",
      "\u3082\u3046\u5BDD\u308B\u6642\u9593\uFF01\u30B3\u30FC\u30D2\u30FC\u306F\u304A\u3057\u307E\u3044\u3002"
    ],
    ko: [
      "\uC774\uAC78 \uB2E4 \uCC98\uB9AC\uD558\uB824\uBA74 \uCEE4\uD53C\uAC00 \uD544\uC694\uD558\uC9C0? \uB098\uB3C4!",
      "\uCC45 \uC4F0\uACE0 \uC788\uC5B4? \uB098\uB3C4 \uCC45 \uC88B\uC544\uD574!",
      "\uC77C\uC744 \uB108\uBB34 \uBE68\uB9AC \uD574\uC11C \uB9E5\uC8FC \uB9C8\uC2E4 \uC2DC\uAC04\uC774 \uC788\uB2E4\uACE0? \uB098\uB3C4 \uB084\uAC8C!",
      "\uC774\uC81C \uC798 \uC2DC\uAC04\uC774\uC57C! \uCEE4\uD53C\uB294 \uADF8\uB9CC."
    ]
  };
  function updateBmcLink() {
    const tagline = document.getElementById("bmc-tagline");
    const link = document.getElementById("bmc-link");
    if (!tagline || !link) return;
    const tags = BMC_TAGLINES[activeLang] || BMC_TAGLINES.en;
    const hour = (/* @__PURE__ */ new Date()).getHours();
    let idx;
    if (hour >= 6 && hour < 12) idx = 0;
    else if (hour >= 12 && hour < 18) idx = 1;
    else if (hour >= 18 && hour < 22) idx = 2;
    else idx = 3;
    tagline.textContent = tags[idx];
    link.textContent = BMC_BUTTONS[idx];
  }
  updateBmcLink();
  updateModeUI();
  updateQueueBadge();
  updateShortcutDisplays();
  processQueue();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {
    });
  }
  fetch("/api/health").then((r) => r.json()).then((data) => {
    if (data.status === "no_key") {
      openSettings();
    }
  }).catch(() => {
  });
})();
