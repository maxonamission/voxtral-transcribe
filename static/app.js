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

  // obsidian-plugin/src/languages/nl.json
  var nl_default = {
    code: "nl",
    name: "Nederlands",
    patterns: {
      newParagraph: ["nieuwe alinea", "nieuw alinea", "nieuwe paragraaf", "nieuw paragraaf", "nieuwe linie"],
      newLine: ["nieuwe regel", "nieuwe lijn", "volgende regel"],
      heading1: ["kop een", "kop 1"],
      heading2: ["kop twee", "kop 2"],
      heading3: ["kop drie", "kop 3"],
      bulletPoint: ["nieuw punt", "nieuw lijstpunt", "nieuw lijstitem", "lijst punt", "nieuw bullet", "nieuw item", "nieuwe item", "volgend item", "volgend punt"],
      todoItem: ["nieuw to do item", "nieuw todo item", "nieuw todo", "nieuwe to do", "nieuwe todo", "nieuw taak", "nieuwe taak"],
      numberedItem: ["nieuw genummerd item", "nieuw genummerd punt", "genummerd punt", "genummerd item", "volgend nummer", "nummer punt"],
      deleteLastParagraph: ["verwijder laatste alinea", "verwijder laatste paragraaf", "wis laatste alinea"],
      deleteLastLine: ["verwijder laatste regel", "verwijder laatste zin", "wis laatste regel", "wist laatste regel"],
      undo: ["herstel", "ongedaan maken"],
      stopRecording: ["beeindig opname", "beeindig de opname", "stop opname", "stopopname", "stop de opname"],
      colon: ["dubbele punt", "double punt", "dubbelepunt"],
      wikilink: ["wikilink", "wiki link", "link"],
      boldOpen: ["vet openen", "dikgedrukt openen", "vet open"],
      boldClose: ["vet sluiten", "dikgedrukt sluiten", "vet dicht"],
      italicOpen: ["cursief openen", "schuingedrukt openen", "cursief open"],
      italicClose: ["cursief sluiten", "schuingedrukt sluiten", "cursief dicht"],
      inlineCodeOpen: ["code openen", "code open"],
      inlineCodeClose: ["code sluiten", "code dicht"],
      tagOpen: ["tag openen", "label openen", "tag open"],
      tagClose: ["tag sluiten", "label sluiten", "tag dicht"],
      codeBlockOpen: ["codeblok openen", "code blok openen", "codeblok open"],
      codeBlockClose: ["codeblok sluiten", "code blok sluiten", "codeblok dicht"]
    },
    labels: {
      newParagraph: "Nieuwe alinea",
      newLine: "Nieuwe regel",
      heading1: "Kop 1",
      heading2: "Kop 2",
      heading3: "Kop 3",
      bulletPoint: "Lijstpunt",
      todoItem: "To-do item",
      numberedItem: "Genummerd punt",
      deleteLastParagraph: "Verwijder laatste alinea",
      deleteLastLine: "Verwijder laatste regel",
      undo: "Ongedaan maken",
      stopRecording: "Stop opname",
      colon: "Dubbele punt",
      wikilink: "Wikilink [[\u2026]]",
      boldOpen: "Vet openen **",
      boldClose: "Vet sluiten **",
      italicOpen: "Cursief openen *",
      italicClose: "Cursief sluiten *",
      inlineCodeOpen: "Code openen `",
      inlineCodeClose: "Code sluiten `",
      tagOpen: "Tag openen #",
      tagClose: "Tag sluiten",
      codeBlockOpen: "Codeblok openen ```",
      codeBlockClose: "Codeblok sluiten ```"
    },
    mishearings: [
      { pattern: "\\bniveau\\b", flags: "g", replacement: "nieuwe" },
      { pattern: "\\bniva\\b", flags: "g", replacement: "nieuwe" },
      { pattern: "\\bnieuw alinea\\b", flags: "g", replacement: "nieuwe alinea" },
      { pattern: "\\bnieuw regel\\b", flags: "g", replacement: "nieuwe regel" },
      { pattern: "\\bnieuw punt\\b", flags: "g", replacement: "nieuw punt" },
      { pattern: "\\blinea\\b", flags: "g", replacement: "alinea" },
      { pattern: "\\blinie\\b", flags: "g", replacement: "alinea" },
      { pattern: "\\bbeeindigde\\b", flags: "g", replacement: "beeindig de" }
    ],
    phonetics: [
      { pattern: "ij", flags: "g", replacement: "ei" },
      { pattern: "au", flags: "g", replacement: "ou" },
      { pattern: "dt\\b", flags: "g", replacement: "t" },
      { pattern: "\\bsch", flags: "g", replacement: "sg" },
      { pattern: "ck", flags: "g", replacement: "k" },
      { pattern: "ph", flags: "g", replacement: "f" },
      { pattern: "th", flags: "g", replacement: "t" },
      { pattern: "ie", flags: "g", replacement: "i" },
      { pattern: "oe", flags: "g", replacement: "u" },
      { pattern: "ee", flags: "g", replacement: "e" },
      { pattern: "oo", flags: "g", replacement: "o" },
      { pattern: "uu", flags: "g", replacement: "u" },
      { pattern: "aa", flags: "g", replacement: "a" }
    ],
    articles: ["een", "de", "het", "die", "dat", "deze"],
    fillers: ["alsjeblieft", "graag", "even", "maar", "eens", "dan", "nu", "hoor"]
  };

  // obsidian-plugin/src/languages/en.json
  var en_default = {
    code: "en",
    name: "English",
    patterns: {
      newParagraph: ["new paragraph"],
      newLine: ["new line", "next line"],
      heading1: ["heading one", "heading 1"],
      heading2: ["heading two", "heading 2"],
      heading3: ["heading three", "heading 3"],
      bulletPoint: ["new item", "next item", "bullet", "bullet point", "new bullet"],
      todoItem: ["new todo", "new to do", "todo item", "to do item"],
      numberedItem: ["numbered item", "new numbered item", "next number"],
      deleteLastParagraph: ["delete last paragraph"],
      deleteLastLine: ["delete last line", "delete last sentence"],
      undo: ["undo"],
      stopRecording: ["stop recording"],
      colon: ["colon"],
      wikilink: ["wiki link", "wikilink", "link"],
      boldOpen: ["open bold", "bold open", "start bold"],
      boldClose: ["close bold", "bold close", "end bold"],
      italicOpen: ["open italic", "italic open", "start italic"],
      italicClose: ["close italic", "italic close", "end italic"],
      inlineCodeOpen: ["open code", "code open", "start code"],
      inlineCodeClose: ["close code", "code close", "end code"],
      tagOpen: ["open tag", "tag open", "start tag"],
      tagClose: ["close tag", "tag close", "end tag"],
      codeBlockOpen: ["open code block", "code block open", "start code block"],
      codeBlockClose: ["close code block", "code block close", "end code block"]
    },
    labels: {
      newParagraph: "New paragraph",
      newLine: "New line",
      heading1: "Heading 1",
      heading2: "Heading 2",
      heading3: "Heading 3",
      bulletPoint: "Bullet point",
      todoItem: "To-do item",
      numberedItem: "Numbered item",
      deleteLastParagraph: "Delete last paragraph",
      deleteLastLine: "Delete last line",
      undo: "Undo",
      stopRecording: "Stop recording",
      colon: "Colon",
      wikilink: "Wikilink [[\u2026]]",
      boldOpen: "Open bold **",
      boldClose: "Close bold **",
      italicOpen: "Open italic *",
      italicClose: "Close italic *",
      inlineCodeOpen: "Open code `",
      inlineCodeClose: "Close code `",
      tagOpen: "Open tag #",
      tagClose: "Close tag",
      codeBlockOpen: "Open code block ```",
      codeBlockClose: "Close code block ```"
    },
    mishearings: [],
    phonetics: [
      { pattern: "ph", flags: "g", replacement: "f" },
      { pattern: "th", flags: "g", replacement: "t" },
      { pattern: "ck", flags: "g", replacement: "k" },
      { pattern: "ght", flags: "g", replacement: "t" },
      { pattern: "wh", flags: "g", replacement: "w" },
      { pattern: "kn", flags: "g", replacement: "n" },
      { pattern: "wr", flags: "g", replacement: "r" },
      { pattern: "tion", flags: "g", replacement: "shun" },
      { pattern: "sion", flags: "g", replacement: "shun" },
      { pattern: "([aeiou])ll", flags: "g", replacement: "$1l" },
      { pattern: "([aeiou])dd", flags: "g", replacement: "$1d" },
      { pattern: "([aeiou])tt", flags: "g", replacement: "$1t" }
    ],
    articles: ["a", "an", "the"],
    fillers: ["please", "now", "then", "thanks"]
  };

  // obsidian-plugin/src/languages/fr.json
  var fr_default = {
    code: "fr",
    name: "Fran\xE7ais",
    patterns: {
      newParagraph: ["nouveau paragraphe", "nouvelle section", "nouveau alinea"],
      newLine: ["nouvelle ligne", "a la ligne", "retour a la ligne"],
      heading1: ["titre un", "titre 1"],
      heading2: ["titre deux", "titre 2"],
      heading3: ["titre trois", "titre 3"],
      bulletPoint: ["nouveau point", "nouvelle puce", "point suivant", "nouvel element", "nouvel item"],
      todoItem: ["nouvelle tache", "nouveau todo", "nouveau to do"],
      numberedItem: ["point numero", "element numero", "nouveau numero"],
      deleteLastParagraph: ["supprimer dernier paragraphe", "effacer dernier paragraphe"],
      deleteLastLine: ["supprimer derniere ligne", "effacer derniere ligne", "supprimer derniere phrase"],
      undo: ["annuler"],
      stopRecording: ["arreter enregistrement", "arreter l enregistrement", "stop enregistrement"],
      colon: ["deux points"],
      wikilink: ["wiki lien", "lien wiki"],
      boldOpen: ["ouvrir gras", "gras ouvrir"],
      boldClose: ["fermer gras", "gras fermer"],
      italicOpen: ["ouvrir italique", "italique ouvrir"],
      italicClose: ["fermer italique", "italique fermer"],
      inlineCodeOpen: ["ouvrir code", "code ouvrir"],
      inlineCodeClose: ["fermer code", "code fermer"],
      tagOpen: ["ouvrir etiquette", "ouvrir tag"],
      tagClose: ["fermer etiquette", "fermer tag"],
      codeBlockOpen: ["ouvrir bloc de code"],
      codeBlockClose: ["fermer bloc de code"]
    },
    labels: {
      newParagraph: "Nouveau paragraphe",
      newLine: "Nouvelle ligne",
      heading1: "Titre 1",
      heading2: "Titre 2",
      heading3: "Titre 3",
      bulletPoint: "Puce",
      todoItem: "T\xE2che",
      numberedItem: "Point num\xE9rot\xE9",
      deleteLastParagraph: "Supprimer dernier paragraphe",
      deleteLastLine: "Supprimer derni\xE8re ligne",
      undo: "Annuler",
      stopRecording: "Arr\xEAter l'enregistrement",
      colon: "Deux-points",
      wikilink: "Wikilink [[\u2026]]",
      boldOpen: "Ouvrir gras **",
      boldClose: "Fermer gras **",
      italicOpen: "Ouvrir italique *",
      italicClose: "Fermer italique *",
      inlineCodeOpen: "Ouvrir code `",
      inlineCodeClose: "Fermer code `",
      tagOpen: "Ouvrir \xE9tiquette #",
      tagClose: "Fermer \xE9tiquette",
      codeBlockOpen: "Ouvrir bloc de code ```",
      codeBlockClose: "Fermer bloc de code ```"
    },
    mishearings: [
      { pattern: "\\bnouveau ligne\\b", flags: "g", replacement: "nouvelle ligne" },
      { pattern: "\\bnouvelle paragraphe\\b", flags: "g", replacement: "nouveau paragraphe" }
    ],
    phonetics: [
      { pattern: "eau", flags: "g", replacement: "o" },
      { pattern: "aux", flags: "g", replacement: "o" },
      { pattern: "ai", flags: "g", replacement: "e" },
      { pattern: "ei", flags: "g", replacement: "e" },
      { pattern: "ph", flags: "g", replacement: "f" },
      { pattern: "qu", flags: "g", replacement: "k" },
      { pattern: "gn", flags: "g", replacement: "ny" },
      { pattern: "oi", flags: "g", replacement: "wa" },
      { pattern: "ou", flags: "g", replacement: "u" },
      { pattern: "an", flags: "g", replacement: "on" },
      { pattern: "en", flags: "g", replacement: "on" }
    ],
    articles: ["un", "une", "le", "la", "les", "l", "du", "des"],
    fillers: ["s il vous plait", "s il te plait", "merci"]
  };

  // obsidian-plugin/src/languages/de.json
  var de_default = {
    code: "de",
    name: "Deutsch",
    patterns: {
      newParagraph: ["neuer absatz", "neuer paragraph"],
      newLine: ["neue zeile", "nachste zeile"],
      heading1: ["uberschrift eins", "uberschrift 1"],
      heading2: ["uberschrift zwei", "uberschrift 2"],
      heading3: ["uberschrift drei", "uberschrift 3"],
      bulletPoint: ["neuer punkt", "neuer aufzahlungspunkt", "nachster punkt", "neues element"],
      todoItem: ["neue aufgabe", "neues todo", "neues to do"],
      numberedItem: ["nummerierter punkt", "neuer nummerierter punkt", "nachste nummer"],
      deleteLastParagraph: ["letzten absatz loschen", "absatz loschen"],
      deleteLastLine: ["letzte zeile loschen", "letzten satz loschen"],
      undo: ["ruckgangig", "ruckgangig machen"],
      stopRecording: ["aufnahme beenden", "aufnahme stoppen"],
      colon: ["doppelpunkt"],
      wikilink: ["wikilink", "wiki link"],
      boldOpen: ["fett offnen", "fett auf"],
      boldClose: ["fett schliessen", "fett zu"],
      italicOpen: ["kursiv offnen", "kursiv auf"],
      italicClose: ["kursiv schliessen", "kursiv zu"],
      inlineCodeOpen: ["code offnen", "code auf"],
      inlineCodeClose: ["code schliessen", "code zu"],
      tagOpen: ["tag offnen", "tag auf"],
      tagClose: ["tag schliessen", "tag zu"],
      codeBlockOpen: ["codeblock offnen", "code block offnen"],
      codeBlockClose: ["codeblock schliessen", "code block schliessen"]
    },
    labels: {
      newParagraph: "Neuer Absatz",
      newLine: "Neue Zeile",
      heading1: "\xDCberschrift 1",
      heading2: "\xDCberschrift 2",
      heading3: "\xDCberschrift 3",
      bulletPoint: "Aufz\xE4hlungspunkt",
      todoItem: "Aufgabe",
      numberedItem: "Nummerierter Punkt",
      deleteLastParagraph: "Letzten Absatz l\xF6schen",
      deleteLastLine: "Letzte Zeile l\xF6schen",
      undo: "R\xFCckg\xE4ngig",
      stopRecording: "Aufnahme beenden",
      colon: "Doppelpunkt",
      wikilink: "Wikilink [[\u2026]]",
      boldOpen: "Fett \xF6ffnen **",
      boldClose: "Fett schlie\xDFen **",
      italicOpen: "Kursiv \xF6ffnen *",
      italicClose: "Kursiv schlie\xDFen *",
      inlineCodeOpen: "Code \xF6ffnen `",
      inlineCodeClose: "Code schlie\xDFen `",
      tagOpen: "Tag \xF6ffnen #",
      tagClose: "Tag schlie\xDFen",
      codeBlockOpen: "Codeblock \xF6ffnen ```",
      codeBlockClose: "Codeblock schlie\xDFen ```"
    },
    mishearings: [
      { pattern: "\\bneue absatz\\b", flags: "g", replacement: "neuer absatz" },
      { pattern: "\\bneues zeile\\b", flags: "g", replacement: "neue zeile" }
    ],
    phonetics: [
      { pattern: "sch", flags: "g", replacement: "sh" },
      { pattern: "ei", flags: "g", replacement: "ai" },
      { pattern: "ie", flags: "g", replacement: "i" },
      { pattern: "ck", flags: "g", replacement: "k" },
      { pattern: "ph", flags: "g", replacement: "f" },
      { pattern: "th", flags: "g", replacement: "t" },
      { pattern: "v", flags: "g", replacement: "f" },
      { pattern: "tz", flags: "g", replacement: "ts" },
      { pattern: "dt\\b", flags: "g", replacement: "t" },
      { pattern: "aa", flags: "g", replacement: "a" },
      { pattern: "ee", flags: "g", replacement: "e" },
      { pattern: "oo", flags: "g", replacement: "o" }
    ],
    articles: ["ein", "eine", "einen", "einem", "einer", "der", "die", "das", "den", "dem", "des"],
    fillers: ["bitte", "mal", "jetzt", "dann"]
  };

  // obsidian-plugin/src/languages/es.json
  var es_default = {
    code: "es",
    name: "Espa\xF1ol",
    patterns: {
      newParagraph: ["nuevo parrafo", "nueva seccion"],
      newLine: ["nueva linea", "siguiente linea"],
      heading1: ["titulo uno", "titulo 1"],
      heading2: ["titulo dos", "titulo 2"],
      heading3: ["titulo tres", "titulo 3"],
      bulletPoint: ["nuevo punto", "nueva vineta", "siguiente punto", "nuevo elemento"],
      todoItem: ["nueva tarea", "nuevo todo", "nuevo to do"],
      numberedItem: ["punto numerado", "nuevo numero", "siguiente numero"],
      deleteLastParagraph: ["borrar ultimo parrafo", "eliminar ultimo parrafo"],
      deleteLastLine: ["borrar ultima linea", "eliminar ultima linea", "borrar ultima frase"],
      undo: ["deshacer"],
      stopRecording: ["parar grabacion", "detener grabacion"],
      colon: ["dos puntos"],
      wikilink: ["wikilink", "enlace wiki"],
      boldOpen: ["abrir negrita", "negrita abrir"],
      boldClose: ["cerrar negrita", "negrita cerrar"],
      italicOpen: ["abrir cursiva", "cursiva abrir"],
      italicClose: ["cerrar cursiva", "cursiva cerrar"],
      inlineCodeOpen: ["abrir codigo", "codigo abrir"],
      inlineCodeClose: ["cerrar codigo", "codigo cerrar"],
      tagOpen: ["abrir etiqueta", "abrir tag"],
      tagClose: ["cerrar etiqueta", "cerrar tag"],
      codeBlockOpen: ["abrir bloque de codigo"],
      codeBlockClose: ["cerrar bloque de codigo"]
    },
    labels: {
      newParagraph: "Nuevo p\xE1rrafo",
      newLine: "Nueva l\xEDnea",
      heading1: "T\xEDtulo 1",
      heading2: "T\xEDtulo 2",
      heading3: "T\xEDtulo 3",
      bulletPoint: "Vi\xF1eta",
      todoItem: "Tarea",
      numberedItem: "Punto numerado",
      deleteLastParagraph: "Borrar \xFAltimo p\xE1rrafo",
      deleteLastLine: "Borrar \xFAltima l\xEDnea",
      undo: "Deshacer",
      stopRecording: "Parar grabaci\xF3n",
      colon: "Dos puntos",
      wikilink: "Wikilink [[\u2026]]",
      boldOpen: "Abrir negrita **",
      boldClose: "Cerrar negrita **",
      italicOpen: "Abrir cursiva *",
      italicClose: "Cerrar cursiva *",
      inlineCodeOpen: "Abrir c\xF3digo `",
      inlineCodeClose: "Cerrar c\xF3digo `",
      tagOpen: "Abrir etiqueta #",
      tagClose: "Cerrar etiqueta",
      codeBlockOpen: "Abrir bloque de c\xF3digo ```",
      codeBlockClose: "Cerrar bloque de c\xF3digo ```"
    },
    mishearings: [],
    phonetics: [
      { pattern: "ll", flags: "g", replacement: "y" },
      { pattern: "v", flags: "g", replacement: "b" },
      { pattern: "ce", flags: "g", replacement: "se" },
      { pattern: "ci", flags: "g", replacement: "si" },
      { pattern: "qu", flags: "g", replacement: "k" },
      { pattern: "gu(?=[ei])", flags: "g", replacement: "g" },
      { pattern: "h", flags: "g", replacement: "" }
    ],
    articles: ["un", "una", "el", "la", "los", "las", "unos", "unas"],
    fillers: ["por favor", "ahora", "gracias"]
  };

  // obsidian-plugin/src/languages/pt.json
  var pt_default = {
    code: "pt",
    name: "Portugu\xEAs",
    patterns: {
      newParagraph: ["novo paragrafo", "nova secao"],
      newLine: ["nova linha", "proxima linha"],
      heading1: ["titulo um", "titulo 1"],
      heading2: ["titulo dois", "titulo 2"],
      heading3: ["titulo tres", "titulo 3"],
      bulletPoint: ["novo ponto", "novo item", "proximo ponto", "novo elemento"],
      todoItem: ["nova tarefa", "novo todo", "novo to do"],
      numberedItem: ["ponto numerado", "novo numero", "proximo numero"],
      deleteLastParagraph: ["apagar ultimo paragrafo", "excluir ultimo paragrafo"],
      deleteLastLine: ["apagar ultima linha", "excluir ultima linha", "apagar ultima frase"],
      undo: ["desfazer"],
      stopRecording: ["parar gravacao", "encerrar gravacao"],
      colon: ["dois pontos"],
      wikilink: ["wikilink", "link wiki"],
      boldOpen: ["abrir negrito", "negrito abrir"],
      boldClose: ["fechar negrito", "negrito fechar"],
      italicOpen: ["abrir italico", "italico abrir"],
      italicClose: ["fechar italico", "italico fechar"],
      inlineCodeOpen: ["abrir codigo", "codigo abrir"],
      inlineCodeClose: ["fechar codigo", "codigo fechar"],
      tagOpen: ["abrir etiqueta", "abrir tag"],
      tagClose: ["fechar etiqueta", "fechar tag"],
      codeBlockOpen: ["abrir bloco de codigo"],
      codeBlockClose: ["fechar bloco de codigo"]
    },
    labels: {
      newParagraph: "Novo par\xE1grafo",
      newLine: "Nova linha",
      heading1: "T\xEDtulo 1",
      heading2: "T\xEDtulo 2",
      heading3: "T\xEDtulo 3",
      bulletPoint: "Ponto",
      todoItem: "Tarefa",
      numberedItem: "Ponto numerado",
      deleteLastParagraph: "Apagar \xFAltimo par\xE1grafo",
      deleteLastLine: "Apagar \xFAltima linha",
      undo: "Desfazer",
      stopRecording: "Parar grava\xE7\xE3o",
      colon: "Dois pontos",
      wikilink: "Wikilink [[\u2026]]",
      boldOpen: "Abrir negrito **",
      boldClose: "Fechar negrito **",
      italicOpen: "Abrir it\xE1lico *",
      italicClose: "Fechar it\xE1lico *",
      inlineCodeOpen: "Abrir c\xF3digo `",
      inlineCodeClose: "Fechar c\xF3digo `",
      tagOpen: "Abrir etiqueta #",
      tagClose: "Fechar etiqueta",
      codeBlockOpen: "Abrir bloco de c\xF3digo ```",
      codeBlockClose: "Fechar bloco de c\xF3digo ```"
    },
    mishearings: [],
    phonetics: [
      { pattern: "lh", flags: "g", replacement: "ly" },
      { pattern: "nh", flags: "g", replacement: "ny" },
      { pattern: "ch", flags: "g", replacement: "sh" },
      { pattern: "qu", flags: "g", replacement: "k" },
      { pattern: "\xE7\xE3o", flags: "g", replacement: "saun" },
      { pattern: "ss", flags: "g", replacement: "s" }
    ],
    articles: ["um", "uma", "o", "a", "os", "as", "uns", "umas"],
    fillers: ["por favor", "agora", "obrigado"]
  };

  // obsidian-plugin/src/languages/it.json
  var it_default = {
    code: "it",
    name: "Italiano",
    patterns: {
      newParagraph: ["nuovo paragrafo", "nuova sezione", "nuovo capoverso"],
      newLine: ["nuova riga", "a capo", "riga successiva"],
      heading1: ["titolo uno", "titolo 1"],
      heading2: ["titolo due", "titolo 2"],
      heading3: ["titolo tre", "titolo 3"],
      bulletPoint: ["nuovo punto", "nuovo elemento", "punto successivo", "nuovo elenco"],
      todoItem: ["nuovo compito", "nuova attivita", "nuovo todo", "nuovo to do"],
      numberedItem: ["punto numerato", "nuovo numero", "numero successivo"],
      deleteLastParagraph: ["cancella ultimo paragrafo", "elimina ultimo paragrafo"],
      deleteLastLine: ["cancella ultima riga", "elimina ultima riga", "cancella ultima frase"],
      undo: ["annulla"],
      stopRecording: ["ferma registrazione", "interrompi registrazione", "stop registrazione"],
      colon: ["due punti"],
      wikilink: ["wikilink", "link wiki"],
      boldOpen: ["apri grassetto", "grassetto apri"],
      boldClose: ["chiudi grassetto", "grassetto chiudi"],
      italicOpen: ["apri corsivo", "corsivo apri"],
      italicClose: ["chiudi corsivo", "corsivo chiudi"],
      inlineCodeOpen: ["apri codice", "codice apri"],
      inlineCodeClose: ["chiudi codice", "codice chiudi"],
      tagOpen: ["apri tag", "apri etichetta"],
      tagClose: ["chiudi tag", "chiudi etichetta"],
      codeBlockOpen: ["apri blocco di codice"],
      codeBlockClose: ["chiudi blocco di codice"]
    },
    labels: {
      newParagraph: "Nuovo paragrafo",
      newLine: "Nuova riga",
      heading1: "Titolo 1",
      heading2: "Titolo 2",
      heading3: "Titolo 3",
      bulletPoint: "Punto elenco",
      todoItem: "Attivit\xE0",
      numberedItem: "Punto numerato",
      deleteLastParagraph: "Cancella ultimo paragrafo",
      deleteLastLine: "Cancella ultima riga",
      undo: "Annulla",
      stopRecording: "Ferma registrazione",
      colon: "Due punti",
      wikilink: "Wikilink [[\u2026]]",
      boldOpen: "Apri grassetto **",
      boldClose: "Chiudi grassetto **",
      italicOpen: "Apri corsivo *",
      italicClose: "Chiudi corsivo *",
      inlineCodeOpen: "Apri codice `",
      inlineCodeClose: "Chiudi codice `",
      tagOpen: "Apri tag #",
      tagClose: "Chiudi tag",
      codeBlockOpen: "Apri blocco di codice ```",
      codeBlockClose: "Chiudi blocco di codice ```"
    },
    mishearings: [],
    phonetics: [
      { pattern: "gn", flags: "g", replacement: "ny" },
      { pattern: "gl(?=[i])", flags: "g", replacement: "ly" },
      { pattern: "ch", flags: "g", replacement: "k" },
      { pattern: "gh", flags: "g", replacement: "g" },
      { pattern: "sc(?=[ei])", flags: "g", replacement: "sh" },
      { pattern: "zz", flags: "g", replacement: "ts" },
      { pattern: "cc(?=[ei])", flags: "g", replacement: "ch" }
    ],
    articles: ["un", "uno", "una", "il", "lo", "la", "i", "gli", "le"],
    fillers: ["per favore", "ora", "adesso", "grazie"]
  };

  // obsidian-plugin/src/languages/ru.json
  var ru_default = {
    code: "ru",
    name: "\u0420\u0443\u0441\u0441\u043A\u0438\u0439",
    patterns: {
      newParagraph: ["\u043D\u043E\u0432\u044B\u0439 \u0430\u0431\u0437\u0430\u0446", "\u043D\u043E\u0432\u044B\u0439 \u043F\u0430\u0440\u0430\u0433\u0440\u0430\u0444"],
      newLine: ["\u043D\u043E\u0432\u0430\u044F \u0441\u0442\u0440\u043E\u043A\u0430", "\u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0430\u044F \u0441\u0442\u0440\u043E\u043A\u0430"],
      heading1: ["\u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A \u043E\u0434\u0438\u043D", "\u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A 1"],
      heading2: ["\u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A \u0434\u0432\u0430", "\u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A 2"],
      heading3: ["\u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A \u0442\u0440\u0438", "\u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A 3"],
      bulletPoint: ["\u043D\u043E\u0432\u044B\u0439 \u043F\u0443\u043D\u043A\u0442", "\u043D\u043E\u0432\u044B\u0439 \u044D\u043B\u0435\u043C\u0435\u043D\u0442", "\u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u043F\u0443\u043D\u043A\u0442"],
      todoItem: ["\u043D\u043E\u0432\u0430\u044F \u0437\u0430\u0434\u0430\u0447\u0430", "\u043D\u043E\u0432\u043E\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u0435"],
      numberedItem: ["\u043D\u0443\u043C\u0435\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u043F\u0443\u043D\u043A\u0442", "\u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u043D\u043E\u043C\u0435\u0440"],
      deleteLastParagraph: ["\u0443\u0434\u0430\u043B\u0438\u0442\u044C \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0439 \u0430\u0431\u0437\u0430\u0446"],
      deleteLastLine: ["\u0443\u0434\u0430\u043B\u0438\u0442\u044C \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u044E\u044E \u0441\u0442\u0440\u043E\u043A\u0443", "\u0443\u0434\u0430\u043B\u0438\u0442\u044C \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0435\u0435 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0435"],
      undo: ["\u043E\u0442\u043C\u0435\u043D\u0438\u0442\u044C", "\u043E\u0442\u043C\u0435\u043D\u0430"],
      stopRecording: ["\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u0437\u0430\u043F\u0438\u0441\u044C", "\u0441\u0442\u043E\u043F \u0437\u0430\u043F\u0438\u0441\u044C"],
      colon: ["\u0434\u0432\u043E\u0435\u0442\u043E\u0447\u0438\u0435"],
      wikilink: ["\u0432\u0438\u043A\u0438 \u0441\u0441\u044B\u043B\u043A\u0430", "\u0432\u0438\u043A\u0438 \u043B\u0438\u043D\u043A"],
      boldOpen: ["\u043E\u0442\u043A\u0440\u044B\u0442\u044C \u0436\u0438\u0440\u043D\u044B\u0439", "\u0436\u0438\u0440\u043D\u044B\u0439 \u043E\u0442\u043A\u0440\u044B\u0442\u044C"],
      boldClose: ["\u0437\u0430\u043A\u0440\u044B\u0442\u044C \u0436\u0438\u0440\u043D\u044B\u0439", "\u0436\u0438\u0440\u043D\u044B\u0439 \u0437\u0430\u043A\u0440\u044B\u0442\u044C"],
      italicOpen: ["\u043E\u0442\u043A\u0440\u044B\u0442\u044C \u043A\u0443\u0440\u0441\u0438\u0432", "\u043A\u0443\u0440\u0441\u0438\u0432 \u043E\u0442\u043A\u0440\u044B\u0442\u044C"],
      italicClose: ["\u0437\u0430\u043A\u0440\u044B\u0442\u044C \u043A\u0443\u0440\u0441\u0438\u0432", "\u043A\u0443\u0440\u0441\u0438\u0432 \u0437\u0430\u043A\u0440\u044B\u0442\u044C"],
      inlineCodeOpen: ["\u043E\u0442\u043A\u0440\u044B\u0442\u044C \u043A\u043E\u0434", "\u043A\u043E\u0434 \u043E\u0442\u043A\u0440\u044B\u0442\u044C"],
      inlineCodeClose: ["\u0437\u0430\u043A\u0440\u044B\u0442\u044C \u043A\u043E\u0434", "\u043A\u043E\u0434 \u0437\u0430\u043A\u0440\u044B\u0442\u044C"],
      tagOpen: ["\u043E\u0442\u043A\u0440\u044B\u0442\u044C \u0442\u0435\u0433", "\u0442\u0435\u0433 \u043E\u0442\u043A\u0440\u044B\u0442\u044C"],
      tagClose: ["\u0437\u0430\u043A\u0440\u044B\u0442\u044C \u0442\u0435\u0433", "\u0442\u0435\u0433 \u0437\u0430\u043A\u0440\u044B\u0442\u044C"],
      codeBlockOpen: ["\u043E\u0442\u043A\u0440\u044B\u0442\u044C \u0431\u043B\u043E\u043A \u043A\u043E\u0434\u0430"],
      codeBlockClose: ["\u0437\u0430\u043A\u0440\u044B\u0442\u044C \u0431\u043B\u043E\u043A \u043A\u043E\u0434\u0430"]
    },
    labels: {
      newParagraph: "\u041D\u043E\u0432\u044B\u0439 \u0430\u0431\u0437\u0430\u0446",
      newLine: "\u041D\u043E\u0432\u0430\u044F \u0441\u0442\u0440\u043E\u043A\u0430",
      heading1: "\u0417\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A 1",
      heading2: "\u0417\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A 2",
      heading3: "\u0417\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A 3",
      bulletPoint: "\u041D\u043E\u0432\u044B\u0439 \u043F\u0443\u043D\u043A\u0442",
      todoItem: "\u041D\u043E\u0432\u0430\u044F \u0437\u0430\u0434\u0430\u0447\u0430",
      numberedItem: "\u041D\u0443\u043C\u0435\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u043F\u0443\u043D\u043A\u0442",
      deleteLastParagraph: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0439 \u0430\u0431\u0437\u0430\u0446",
      deleteLastLine: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u044E\u044E \u0441\u0442\u0440\u043E\u043A\u0443",
      undo: "\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C",
      stopRecording: "\u041E\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u0437\u0430\u043F\u0438\u0441\u044C",
      colon: "\u0414\u0432\u043E\u0435\u0442\u043E\u0447\u0438\u0435",
      wikilink: "\u0412\u0438\u043A\u0438-\u0441\u0441\u044B\u043B\u043A\u0430 [[\u2026]]",
      boldOpen: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0436\u0438\u0440\u043D\u044B\u0439 **",
      boldClose: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u0436\u0438\u0440\u043D\u044B\u0439 **",
      italicOpen: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043A\u0443\u0440\u0441\u0438\u0432 *",
      italicClose: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u043A\u0443\u0440\u0441\u0438\u0432 *",
      inlineCodeOpen: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043A\u043E\u0434 `",
      inlineCodeClose: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u043A\u043E\u0434 `",
      tagOpen: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0442\u0435\u0433 #",
      tagClose: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u0442\u0435\u0433",
      codeBlockOpen: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0431\u043B\u043E\u043A \u043A\u043E\u0434\u0430 ```",
      codeBlockClose: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u0431\u043B\u043E\u043A \u043A\u043E\u0434\u0430 ```"
    },
    mishearings: [],
    phonetics: [],
    articles: [],
    fillers: []
  };

  // obsidian-plugin/src/languages/zh.json
  var zh_default = {
    code: "zh",
    name: "\u4E2D\u6587",
    patterns: {
      newParagraph: ["\u65B0\u6BB5\u843D", "\u65B0\u7684\u6BB5\u843D"],
      newLine: ["\u6362\u884C", "\u65B0\u884C", "\u4E0B\u4E00\u884C"],
      heading1: ["\u6807\u9898\u4E00", "\u6807\u98981", "\u4E00\u7EA7\u6807\u9898"],
      heading2: ["\u6807\u9898\u4E8C", "\u6807\u98982", "\u4E8C\u7EA7\u6807\u9898"],
      heading3: ["\u6807\u9898\u4E09", "\u6807\u98983", "\u4E09\u7EA7\u6807\u9898"],
      bulletPoint: ["\u65B0\u9879\u76EE", "\u5217\u8868\u9879", "\u65B0\u7684\u9879\u76EE"],
      todoItem: ["\u65B0\u4EFB\u52A1", "\u65B0\u5F85\u529E", "\u5F85\u529E\u4E8B\u9879"],
      numberedItem: ["\u7F16\u53F7\u9879", "\u65B0\u7F16\u53F7", "\u4E0B\u4E00\u4E2A\u7F16\u53F7"],
      deleteLastParagraph: ["\u5220\u9664\u4E0A\u4E00\u6BB5", "\u5220\u9664\u6700\u540E\u4E00\u6BB5"],
      deleteLastLine: ["\u5220\u9664\u4E0A\u4E00\u884C", "\u5220\u9664\u4E0A\u4E00\u53E5"],
      undo: ["\u64A4\u9500", "\u64A4\u56DE"],
      stopRecording: ["\u505C\u6B62\u5F55\u97F3", "\u7ED3\u675F\u5F55\u97F3"],
      colon: ["\u5192\u53F7"],
      wikilink: ["\u7EF4\u57FA\u94FE\u63A5", "\u94FE\u63A5"],
      boldOpen: ["\u5F00\u59CB\u52A0\u7C97", "\u52A0\u7C97\u5F00\u59CB", "\u6253\u5F00\u7C97\u4F53"],
      boldClose: ["\u7ED3\u675F\u52A0\u7C97", "\u52A0\u7C97\u7ED3\u675F", "\u5173\u95ED\u7C97\u4F53"],
      italicOpen: ["\u5F00\u59CB\u659C\u4F53", "\u659C\u4F53\u5F00\u59CB", "\u6253\u5F00\u659C\u4F53"],
      italicClose: ["\u7ED3\u675F\u659C\u4F53", "\u659C\u4F53\u7ED3\u675F", "\u5173\u95ED\u659C\u4F53"],
      inlineCodeOpen: ["\u5F00\u59CB\u4EE3\u7801", "\u4EE3\u7801\u5F00\u59CB", "\u6253\u5F00\u4EE3\u7801"],
      inlineCodeClose: ["\u7ED3\u675F\u4EE3\u7801", "\u4EE3\u7801\u7ED3\u675F", "\u5173\u95ED\u4EE3\u7801"],
      tagOpen: ["\u5F00\u59CB\u6807\u7B7E", "\u6253\u5F00\u6807\u7B7E"],
      tagClose: ["\u7ED3\u675F\u6807\u7B7E", "\u5173\u95ED\u6807\u7B7E"],
      codeBlockOpen: ["\u5F00\u59CB\u4EE3\u7801\u5757", "\u6253\u5F00\u4EE3\u7801\u5757"],
      codeBlockClose: ["\u7ED3\u675F\u4EE3\u7801\u5757", "\u5173\u95ED\u4EE3\u7801\u5757"]
    },
    labels: {
      newParagraph: "\u65B0\u6BB5\u843D",
      newLine: "\u6362\u884C",
      heading1: "\u6807\u9898 1",
      heading2: "\u6807\u9898 2",
      heading3: "\u6807\u9898 3",
      bulletPoint: "\u5217\u8868\u9879",
      todoItem: "\u5F85\u529E\u4E8B\u9879",
      numberedItem: "\u7F16\u53F7\u9879",
      deleteLastParagraph: "\u5220\u9664\u4E0A\u4E00\u6BB5",
      deleteLastLine: "\u5220\u9664\u4E0A\u4E00\u884C",
      undo: "\u64A4\u9500",
      stopRecording: "\u505C\u6B62\u5F55\u97F3",
      colon: "\u5192\u53F7",
      wikilink: "\u7EF4\u57FA\u94FE\u63A5 [[\u2026]]",
      boldOpen: "\u5F00\u59CB\u52A0\u7C97 **",
      boldClose: "\u7ED3\u675F\u52A0\u7C97 **",
      italicOpen: "\u5F00\u59CB\u659C\u4F53 *",
      italicClose: "\u7ED3\u675F\u659C\u4F53 *",
      inlineCodeOpen: "\u5F00\u59CB\u4EE3\u7801 `",
      inlineCodeClose: "\u7ED3\u675F\u4EE3\u7801 `",
      tagOpen: "\u5F00\u59CB\u6807\u7B7E #",
      tagClose: "\u7ED3\u675F\u6807\u7B7E",
      codeBlockOpen: "\u5F00\u59CB\u4EE3\u7801\u5757 ```",
      codeBlockClose: "\u7ED3\u675F\u4EE3\u7801\u5757 ```"
    },
    mishearings: [],
    phonetics: [],
    articles: [],
    fillers: []
  };

  // obsidian-plugin/src/languages/hi.json
  var hi_default = {
    code: "hi",
    name: "\u0939\u093F\u0928\u094D\u0926\u0940",
    patterns: {
      newParagraph: ["\u0928\u092F\u093E \u092A\u0948\u0930\u093E\u0917\u094D\u0930\u093E\u092B", "\u0928\u092F\u093E \u0905\u0928\u0941\u091A\u094D\u091B\u0947\u0926"],
      newLine: ["\u0928\u0908 \u0932\u093E\u0907\u0928", "\u0905\u0917\u0932\u0940 \u0932\u093E\u0907\u0928"],
      heading1: ["\u0936\u0940\u0930\u094D\u0937\u0915 \u090F\u0915", "\u0936\u0940\u0930\u094D\u0937\u0915 1", "\u0939\u0947\u0921\u093F\u0902\u0917 1"],
      heading2: ["\u0936\u0940\u0930\u094D\u0937\u0915 \u0926\u094B", "\u0936\u0940\u0930\u094D\u0937\u0915 2", "\u0939\u0947\u0921\u093F\u0902\u0917 2"],
      heading3: ["\u0936\u0940\u0930\u094D\u0937\u0915 \u0924\u0940\u0928", "\u0936\u0940\u0930\u094D\u0937\u0915 3", "\u0939\u0947\u0921\u093F\u0902\u0917 3"],
      bulletPoint: ["\u0928\u092F\u093E \u092C\u093F\u0902\u0926\u0941", "\u0928\u092F\u093E \u092A\u0949\u0907\u0902\u091F", "\u0905\u0917\u0932\u093E \u092A\u0949\u0907\u0902\u091F"],
      todoItem: ["\u0928\u092F\u093E \u0915\u093E\u0930\u094D\u092F", "\u0928\u092F\u093E \u091F\u0942\u0921\u0942"],
      numberedItem: ["\u0915\u094D\u0930\u092E\u093E\u0902\u0915\u093F\u0924 \u092C\u093F\u0902\u0926\u0941", "\u0905\u0917\u0932\u093E \u0928\u0902\u092C\u0930"],
      deleteLastParagraph: ["\u092A\u093F\u091B\u0932\u093E \u092A\u0948\u0930\u093E\u0917\u094D\u0930\u093E\u092B \u0939\u091F\u093E\u0913"],
      deleteLastLine: ["\u092A\u093F\u091B\u0932\u0940 \u0932\u093E\u0907\u0928 \u0939\u091F\u093E\u0913", "\u0905\u0902\u0924\u093F\u092E \u0932\u093E\u0907\u0928 \u0939\u091F\u093E\u0913"],
      undo: ["\u092A\u0942\u0930\u094D\u0935\u0935\u0924", "\u0905\u0928\u0921\u0942"],
      stopRecording: ["\u0930\u093F\u0915\u0949\u0930\u094D\u0921\u093F\u0902\u0917 \u092C\u0902\u0926 \u0915\u0930\u094B", "\u0930\u093F\u0915\u0949\u0930\u094D\u0921\u093F\u0902\u0917 \u0930\u094B\u0915\u094B"],
      colon: ["\u0915\u094B\u0932\u0928"],
      wikilink: ["\u0935\u093F\u0915\u093F \u0932\u093F\u0902\u0915", "\u0932\u093F\u0902\u0915"],
      boldOpen: ["\u092C\u094B\u0932\u094D\u0921 \u0916\u094B\u0932\u094B", "\u092E\u094B\u091F\u093E \u0916\u094B\u0932\u094B"],
      boldClose: ["\u092C\u094B\u0932\u094D\u0921 \u092C\u0902\u0926 \u0915\u0930\u094B", "\u092E\u094B\u091F\u093E \u092C\u0902\u0926 \u0915\u0930\u094B"],
      italicOpen: ["\u0907\u091F\u0948\u0932\u093F\u0915 \u0916\u094B\u0932\u094B", "\u0924\u093F\u0930\u091B\u093E \u0916\u094B\u0932\u094B"],
      italicClose: ["\u0907\u091F\u0948\u0932\u093F\u0915 \u092C\u0902\u0926 \u0915\u0930\u094B", "\u0924\u093F\u0930\u091B\u093E \u092C\u0902\u0926 \u0915\u0930\u094B"],
      inlineCodeOpen: ["\u0915\u094B\u0921 \u0916\u094B\u0932\u094B"],
      inlineCodeClose: ["\u0915\u094B\u0921 \u092C\u0902\u0926 \u0915\u0930\u094B"],
      tagOpen: ["\u091F\u0948\u0917 \u0916\u094B\u0932\u094B"],
      tagClose: ["\u091F\u0948\u0917 \u092C\u0902\u0926 \u0915\u0930\u094B"],
      codeBlockOpen: ["\u0915\u094B\u0921 \u092C\u094D\u0932\u0949\u0915 \u0916\u094B\u0932\u094B"],
      codeBlockClose: ["\u0915\u094B\u0921 \u092C\u094D\u0932\u0949\u0915 \u092C\u0902\u0926 \u0915\u0930\u094B"]
    },
    labels: {
      newParagraph: "\u0928\u092F\u093E \u092A\u0948\u0930\u093E\u0917\u094D\u0930\u093E\u092B",
      newLine: "\u0928\u0908 \u0932\u093E\u0907\u0928",
      heading1: "\u0936\u0940\u0930\u094D\u0937\u0915 1",
      heading2: "\u0936\u0940\u0930\u094D\u0937\u0915 2",
      heading3: "\u0936\u0940\u0930\u094D\u0937\u0915 3",
      bulletPoint: "\u0928\u092F\u093E \u092C\u093F\u0902\u0926\u0941",
      todoItem: "\u0928\u092F\u093E \u0915\u093E\u0930\u094D\u092F",
      numberedItem: "\u0915\u094D\u0930\u092E\u093E\u0902\u0915\u093F\u0924 \u092C\u093F\u0902\u0926\u0941",
      deleteLastParagraph: "\u092A\u093F\u091B\u0932\u093E \u092A\u0948\u0930\u093E\u0917\u094D\u0930\u093E\u092B \u0939\u091F\u093E\u0913",
      deleteLastLine: "\u092A\u093F\u091B\u0932\u0940 \u0932\u093E\u0907\u0928 \u0939\u091F\u093E\u0913",
      undo: "\u092A\u0942\u0930\u094D\u0935\u0935\u0924",
      stopRecording: "\u0930\u093F\u0915\u0949\u0930\u094D\u0921\u093F\u0902\u0917 \u092C\u0902\u0926 \u0915\u0930\u094B",
      colon: "\u0915\u094B\u0932\u0928",
      wikilink: "\u0935\u093F\u0915\u093F \u0932\u093F\u0902\u0915 [[\u2026]]",
      boldOpen: "\u092C\u094B\u0932\u094D\u0921 \u0916\u094B\u0932\u094B **",
      boldClose: "\u092C\u094B\u0932\u094D\u0921 \u092C\u0902\u0926 \u0915\u0930\u094B **",
      italicOpen: "\u0907\u091F\u0948\u0932\u093F\u0915 \u0916\u094B\u0932\u094B *",
      italicClose: "\u0907\u091F\u0948\u0932\u093F\u0915 \u092C\u0902\u0926 \u0915\u0930\u094B *",
      inlineCodeOpen: "\u0915\u094B\u0921 \u0916\u094B\u0932\u094B `",
      inlineCodeClose: "\u0915\u094B\u0921 \u092C\u0902\u0926 \u0915\u0930\u094B `",
      tagOpen: "\u091F\u0948\u0917 \u0916\u094B\u0932\u094B #",
      tagClose: "\u091F\u0948\u0917 \u092C\u0902\u0926 \u0915\u0930\u094B",
      codeBlockOpen: "\u0915\u094B\u0921 \u092C\u094D\u0932\u0949\u0915 \u0916\u094B\u0932\u094B ```",
      codeBlockClose: "\u0915\u094B\u0921 \u092C\u094D\u0932\u0949\u0915 \u092C\u0902\u0926 \u0915\u0930\u094B ```"
    },
    mishearings: [],
    phonetics: [],
    articles: [],
    fillers: []
  };

  // obsidian-plugin/src/languages/ar.json
  var ar_default = {
    code: "ar",
    name: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629",
    patterns: {
      newParagraph: ["\u0641\u0642\u0631\u0629 \u062C\u062F\u064A\u062F\u0629"],
      newLine: ["\u0633\u0637\u0631 \u062C\u062F\u064A\u062F", "\u0627\u0644\u0633\u0637\u0631 \u0627\u0644\u062A\u0627\u0644\u064A"],
      heading1: ["\u0639\u0646\u0648\u0627\u0646 \u0648\u0627\u062D\u062F", "\u0639\u0646\u0648\u0627\u0646 1"],
      heading2: ["\u0639\u0646\u0648\u0627\u0646 \u0627\u062B\u0646\u064A\u0646", "\u0639\u0646\u0648\u0627\u0646 2"],
      heading3: ["\u0639\u0646\u0648\u0627\u0646 \u062B\u0644\u0627\u062B\u0629", "\u0639\u0646\u0648\u0627\u0646 3"],
      bulletPoint: ["\u0646\u0642\u0637\u0629 \u062C\u062F\u064A\u062F\u0629", "\u0639\u0646\u0635\u0631 \u062C\u062F\u064A\u062F"],
      todoItem: ["\u0645\u0647\u0645\u0629 \u062C\u062F\u064A\u062F\u0629"],
      numberedItem: ["\u0639\u0646\u0635\u0631 \u0645\u0631\u0642\u0645", "\u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u062A\u0627\u0644\u064A"],
      deleteLastParagraph: ["\u0627\u062D\u0630\u0641 \u0627\u0644\u0641\u0642\u0631\u0629 \u0627\u0644\u0623\u062E\u064A\u0631\u0629"],
      deleteLastLine: ["\u0627\u062D\u0630\u0641 \u0627\u0644\u0633\u0637\u0631 \u0627\u0644\u0623\u062E\u064A\u0631", "\u0627\u062D\u0630\u0641 \u0627\u0644\u062C\u0645\u0644\u0629 \u0627\u0644\u0623\u062E\u064A\u0631\u0629"],
      undo: ["\u062A\u0631\u0627\u062C\u0639"],
      stopRecording: ["\u0623\u0648\u0642\u0641 \u0627\u0644\u062A\u0633\u062C\u064A\u0644", "\u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u062A\u0633\u062C\u064A\u0644"],
      colon: ["\u0646\u0642\u0637\u062A\u0627\u0646"],
      wikilink: ["\u0631\u0627\u0628\u0637 \u0648\u064A\u0643\u064A", "\u0631\u0627\u0628\u0637"],
      boldOpen: ["\u0627\u0641\u062A\u062D \u063A\u0627\u0645\u0642", "\u063A\u0627\u0645\u0642 \u0627\u0641\u062A\u062D"],
      boldClose: ["\u0623\u063A\u0644\u0642 \u063A\u0627\u0645\u0642", "\u063A\u0627\u0645\u0642 \u0623\u063A\u0644\u0642"],
      italicOpen: ["\u0627\u0641\u062A\u062D \u0645\u0627\u0626\u0644", "\u0645\u0627\u0626\u0644 \u0627\u0641\u062A\u062D"],
      italicClose: ["\u0623\u063A\u0644\u0642 \u0645\u0627\u0626\u0644", "\u0645\u0627\u0626\u0644 \u0623\u063A\u0644\u0642"],
      inlineCodeOpen: ["\u0627\u0641\u062A\u062D \u0643\u0648\u062F", "\u0643\u0648\u062F \u0627\u0641\u062A\u062D"],
      inlineCodeClose: ["\u0623\u063A\u0644\u0642 \u0643\u0648\u062F", "\u0643\u0648\u062F \u0623\u063A\u0644\u0642"],
      tagOpen: ["\u0627\u0641\u062A\u062D \u0648\u0633\u0645", "\u0648\u0633\u0645 \u0627\u0641\u062A\u062D"],
      tagClose: ["\u0623\u063A\u0644\u0642 \u0648\u0633\u0645", "\u0648\u0633\u0645 \u0623\u063A\u0644\u0642"],
      codeBlockOpen: ["\u0627\u0641\u062A\u062D \u0643\u062A\u0644\u0629 \u0643\u0648\u062F"],
      codeBlockClose: ["\u0623\u063A\u0644\u0642 \u0643\u062A\u0644\u0629 \u0643\u0648\u062F"]
    },
    labels: {
      newParagraph: "\u0641\u0642\u0631\u0629 \u062C\u062F\u064A\u062F\u0629",
      newLine: "\u0633\u0637\u0631 \u062C\u062F\u064A\u062F",
      heading1: "\u0639\u0646\u0648\u0627\u0646 1",
      heading2: "\u0639\u0646\u0648\u0627\u0646 2",
      heading3: "\u0639\u0646\u0648\u0627\u0646 3",
      bulletPoint: "\u0646\u0642\u0637\u0629 \u062C\u062F\u064A\u062F\u0629",
      todoItem: "\u0645\u0647\u0645\u0629 \u062C\u062F\u064A\u062F\u0629",
      numberedItem: "\u0639\u0646\u0635\u0631 \u0645\u0631\u0642\u0645",
      deleteLastParagraph: "\u0627\u062D\u0630\u0641 \u0627\u0644\u0641\u0642\u0631\u0629 \u0627\u0644\u0623\u062E\u064A\u0631\u0629",
      deleteLastLine: "\u0627\u062D\u0630\u0641 \u0627\u0644\u0633\u0637\u0631 \u0627\u0644\u0623\u062E\u064A\u0631",
      undo: "\u062A\u0631\u0627\u062C\u0639",
      stopRecording: "\u0623\u0648\u0642\u0641 \u0627\u0644\u062A\u0633\u062C\u064A\u0644",
      colon: "\u0646\u0642\u0637\u062A\u0627\u0646",
      wikilink: "[[\u2026]] \u0631\u0627\u0628\u0637 \u0648\u064A\u0643\u064A",
      boldOpen: "** \u0627\u0641\u062A\u062D \u063A\u0627\u0645\u0642",
      boldClose: "** \u0623\u063A\u0644\u0642 \u063A\u0627\u0645\u0642",
      italicOpen: "* \u0627\u0641\u062A\u062D \u0645\u0627\u0626\u0644",
      italicClose: "* \u0623\u063A\u0644\u0642 \u0645\u0627\u0626\u0644",
      inlineCodeOpen: "` \u0627\u0641\u062A\u062D \u0643\u0648\u062F",
      inlineCodeClose: "` \u0623\u063A\u0644\u0642 \u0643\u0648\u062F",
      tagOpen: "# \u0627\u0641\u062A\u062D \u0648\u0633\u0645",
      tagClose: "\u0623\u063A\u0644\u0642 \u0648\u0633\u0645",
      codeBlockOpen: "``` \u0627\u0641\u062A\u062D \u0643\u062A\u0644\u0629 \u0643\u0648\u062F",
      codeBlockClose: "``` \u0623\u063A\u0644\u0642 \u0643\u062A\u0644\u0629 \u0643\u0648\u062F"
    },
    mishearings: [],
    phonetics: [],
    articles: ["\u0627\u0644"],
    fillers: []
  };

  // obsidian-plugin/src/languages/ja.json
  var ja_default = {
    code: "ja",
    name: "\u65E5\u672C\u8A9E",
    patterns: {
      newParagraph: ["\u65B0\u3057\u3044\u6BB5\u843D", "\u65B0\u6BB5\u843D"],
      newLine: ["\u6539\u884C", "\u65B0\u3057\u3044\u884C", "\u6B21\u306E\u884C"],
      heading1: ["\u898B\u51FA\u30571", "\u898B\u51FA\u3057\u3044\u3061"],
      heading2: ["\u898B\u51FA\u30572", "\u898B\u51FA\u3057\u306B"],
      heading3: ["\u898B\u51FA\u30573", "\u898B\u51FA\u3057\u3055\u3093"],
      bulletPoint: ["\u7B87\u6761\u66F8\u304D", "\u65B0\u3057\u3044\u9805\u76EE", "\u6B21\u306E\u9805\u76EE"],
      todoItem: ["\u65B0\u3057\u3044\u30BF\u30B9\u30AF", "\u30BF\u30B9\u30AF\u8FFD\u52A0"],
      numberedItem: ["\u756A\u53F7\u4ED8\u304D", "\u6B21\u306E\u756A\u53F7"],
      deleteLastParagraph: ["\u6700\u5F8C\u306E\u6BB5\u843D\u3092\u524A\u9664"],
      deleteLastLine: ["\u6700\u5F8C\u306E\u884C\u3092\u524A\u9664", "\u6700\u5F8C\u306E\u6587\u3092\u524A\u9664"],
      undo: ["\u5143\u306B\u623B\u3059", "\u53D6\u308A\u6D88\u3057"],
      stopRecording: ["\u9332\u97F3\u505C\u6B62", "\u9332\u97F3\u3092\u6B62\u3081\u3066"],
      colon: ["\u30B3\u30ED\u30F3"],
      wikilink: ["\u30A6\u30A3\u30AD\u30EA\u30F3\u30AF", "\u30EA\u30F3\u30AF"],
      boldOpen: ["\u592A\u5B57\u958B\u59CB", "\u30DC\u30FC\u30EB\u30C9\u958B\u59CB", "\u592A\u5B57\u958B\u304F"],
      boldClose: ["\u592A\u5B57\u7D42\u4E86", "\u30DC\u30FC\u30EB\u30C9\u7D42\u4E86", "\u592A\u5B57\u9589\u3058\u308B"],
      italicOpen: ["\u659C\u4F53\u958B\u59CB", "\u30A4\u30BF\u30EA\u30C3\u30AF\u958B\u59CB", "\u659C\u4F53\u958B\u304F"],
      italicClose: ["\u659C\u4F53\u7D42\u4E86", "\u30A4\u30BF\u30EA\u30C3\u30AF\u7D42\u4E86", "\u659C\u4F53\u9589\u3058\u308B"],
      inlineCodeOpen: ["\u30B3\u30FC\u30C9\u958B\u59CB", "\u30B3\u30FC\u30C9\u958B\u304F"],
      inlineCodeClose: ["\u30B3\u30FC\u30C9\u7D42\u4E86", "\u30B3\u30FC\u30C9\u9589\u3058\u308B"],
      tagOpen: ["\u30BF\u30B0\u958B\u59CB", "\u30BF\u30B0\u958B\u304F"],
      tagClose: ["\u30BF\u30B0\u7D42\u4E86", "\u30BF\u30B0\u9589\u3058\u308B"],
      codeBlockOpen: ["\u30B3\u30FC\u30C9\u30D6\u30ED\u30C3\u30AF\u958B\u59CB", "\u30B3\u30FC\u30C9\u30D6\u30ED\u30C3\u30AF\u958B\u304F"],
      codeBlockClose: ["\u30B3\u30FC\u30C9\u30D6\u30ED\u30C3\u30AF\u7D42\u4E86", "\u30B3\u30FC\u30C9\u30D6\u30ED\u30C3\u30AF\u9589\u3058\u308B"]
    },
    labels: {
      newParagraph: "\u65B0\u3057\u3044\u6BB5\u843D",
      newLine: "\u6539\u884C",
      heading1: "\u898B\u51FA\u3057 1",
      heading2: "\u898B\u51FA\u3057 2",
      heading3: "\u898B\u51FA\u3057 3",
      bulletPoint: "\u7B87\u6761\u66F8\u304D",
      todoItem: "\u65B0\u3057\u3044\u30BF\u30B9\u30AF",
      numberedItem: "\u756A\u53F7\u4ED8\u304D",
      deleteLastParagraph: "\u6700\u5F8C\u306E\u6BB5\u843D\u3092\u524A\u9664",
      deleteLastLine: "\u6700\u5F8C\u306E\u884C\u3092\u524A\u9664",
      undo: "\u5143\u306B\u623B\u3059",
      stopRecording: "\u9332\u97F3\u505C\u6B62",
      colon: "\u30B3\u30ED\u30F3",
      wikilink: "\u30A6\u30A3\u30AD\u30EA\u30F3\u30AF [[\u2026]]",
      boldOpen: "\u592A\u5B57\u958B\u59CB **",
      boldClose: "\u592A\u5B57\u7D42\u4E86 **",
      italicOpen: "\u659C\u4F53\u958B\u59CB *",
      italicClose: "\u659C\u4F53\u7D42\u4E86 *",
      inlineCodeOpen: "\u30B3\u30FC\u30C9\u958B\u59CB `",
      inlineCodeClose: "\u30B3\u30FC\u30C9\u7D42\u4E86 `",
      tagOpen: "\u30BF\u30B0\u958B\u59CB #",
      tagClose: "\u30BF\u30B0\u7D42\u4E86",
      codeBlockOpen: "\u30B3\u30FC\u30C9\u30D6\u30ED\u30C3\u30AF\u958B\u59CB ```",
      codeBlockClose: "\u30B3\u30FC\u30C9\u30D6\u30ED\u30C3\u30AF\u7D42\u4E86 ```"
    },
    mishearings: [],
    phonetics: [],
    articles: [],
    fillers: []
  };

  // obsidian-plugin/src/languages/ko.json
  var ko_default = {
    code: "ko",
    name: "\uD55C\uAD6D\uC5B4",
    patterns: {
      newParagraph: ["\uC0C8 \uB2E8\uB77D", "\uC0C8 \uBB38\uB2E8"],
      newLine: ["\uC0C8 \uC904", "\uB2E4\uC74C \uC904", "\uC904 \uBC14\uAFC8"],
      heading1: ["\uC81C\uBAA9 1", "\uC81C\uBAA9 \uD558\uB098"],
      heading2: ["\uC81C\uBAA9 2", "\uC81C\uBAA9 \uB458"],
      heading3: ["\uC81C\uBAA9 3", "\uC81C\uBAA9 \uC14B"],
      bulletPoint: ["\uC0C8 \uD56D\uBAA9", "\uB2E4\uC74C \uD56D\uBAA9", "\uAE00\uBA38\uB9AC \uAE30\uD638"],
      todoItem: ["\uC0C8 \uD560\uC77C", "\uD560\uC77C \uCD94\uAC00"],
      numberedItem: ["\uBC88\uD638 \uD56D\uBAA9", "\uB2E4\uC74C \uBC88\uD638"],
      deleteLastParagraph: ["\uB9C8\uC9C0\uB9C9 \uB2E8\uB77D \uC0AD\uC81C"],
      deleteLastLine: ["\uB9C8\uC9C0\uB9C9 \uC904 \uC0AD\uC81C", "\uB9C8\uC9C0\uB9C9 \uBB38\uC7A5 \uC0AD\uC81C"],
      undo: ["\uC2E4\uD589 \uCDE8\uC18C", "\uB418\uB3CC\uB9AC\uAE30"],
      stopRecording: ["\uB179\uC74C \uC911\uC9C0", "\uB179\uC74C \uBA48\uCDB0"],
      colon: ["\uCF5C\uB860"],
      wikilink: ["\uC704\uD0A4\uB9C1\uD06C", "\uB9C1\uD06C"],
      boldOpen: ["\uAD75\uAC8C \uC5F4\uAE30", "\uBCFC\uB4DC \uC5F4\uAE30"],
      boldClose: ["\uAD75\uAC8C \uB2EB\uAE30", "\uBCFC\uB4DC \uB2EB\uAE30"],
      italicOpen: ["\uAE30\uC6B8\uC784 \uC5F4\uAE30", "\uC774\uD0E4\uB9AD \uC5F4\uAE30"],
      italicClose: ["\uAE30\uC6B8\uC784 \uB2EB\uAE30", "\uC774\uD0E4\uB9AD \uB2EB\uAE30"],
      inlineCodeOpen: ["\uCF54\uB4DC \uC5F4\uAE30"],
      inlineCodeClose: ["\uCF54\uB4DC \uB2EB\uAE30"],
      tagOpen: ["\uD0DC\uADF8 \uC5F4\uAE30"],
      tagClose: ["\uD0DC\uADF8 \uB2EB\uAE30"],
      codeBlockOpen: ["\uCF54\uB4DC\uBE14\uB85D \uC5F4\uAE30", "\uCF54\uB4DC \uBE14\uB85D \uC5F4\uAE30"],
      codeBlockClose: ["\uCF54\uB4DC\uBE14\uB85D \uB2EB\uAE30", "\uCF54\uB4DC \uBE14\uB85D \uB2EB\uAE30"]
    },
    labels: {
      newParagraph: "\uC0C8 \uB2E8\uB77D",
      newLine: "\uC0C8 \uC904",
      heading1: "\uC81C\uBAA9 1",
      heading2: "\uC81C\uBAA9 2",
      heading3: "\uC81C\uBAA9 3",
      bulletPoint: "\uC0C8 \uD56D\uBAA9",
      todoItem: "\uC0C8 \uD560\uC77C",
      numberedItem: "\uBC88\uD638 \uD56D\uBAA9",
      deleteLastParagraph: "\uB9C8\uC9C0\uB9C9 \uB2E8\uB77D \uC0AD\uC81C",
      deleteLastLine: "\uB9C8\uC9C0\uB9C9 \uC904 \uC0AD\uC81C",
      undo: "\uC2E4\uD589 \uCDE8\uC18C",
      stopRecording: "\uB179\uC74C \uC911\uC9C0",
      colon: "\uCF5C\uB860",
      wikilink: "\uC704\uD0A4\uB9C1\uD06C [[\u2026]]",
      boldOpen: "\uAD75\uAC8C \uC5F4\uAE30 **",
      boldClose: "\uAD75\uAC8C \uB2EB\uAE30 **",
      italicOpen: "\uAE30\uC6B8\uC784 \uC5F4\uAE30 *",
      italicClose: "\uAE30\uC6B8\uC784 \uB2EB\uAE30 *",
      inlineCodeOpen: "\uCF54\uB4DC \uC5F4\uAE30 `",
      inlineCodeClose: "\uCF54\uB4DC \uB2EB\uAE30 `",
      tagOpen: "\uD0DC\uADF8 \uC5F4\uAE30 #",
      tagClose: "\uD0DC\uADF8 \uB2EB\uAE30",
      codeBlockOpen: "\uCF54\uB4DC\uBE14\uB85D \uC5F4\uAE30 ```",
      codeBlockClose: "\uCF54\uB4DC\uBE14\uB85D \uB2EB\uAE30 ```"
    },
    mishearings: [],
    phonetics: [],
    articles: [],
    fillers: []
  };

  // obsidian-plugin/src/shared/lang-data.ts
  var ALL_LANGS = {
    nl: nl_default,
    en: en_default,
    fr: fr_default,
    de: de_default,
    es: es_default,
    pt: pt_default,
    it: it_default,
    ru: ru_default,
    zh: zh_default,
    hi: hi_default,
    ar: ar_default,
    ja: ja_default,
    ko: ko_default
  };
  var SUPPORTED_LANGUAGES = [
    "nl",
    "en",
    "fr",
    "de",
    "es",
    "pt",
    "it",
    "ru",
    "zh",
    "hi",
    "ar",
    "ja",
    "ko"
  ];
  function compileRegexRules(data) {
    return data.map(({ pattern, flags, replacement }) => [
      new RegExp(pattern, flags),
      replacement
    ]);
  }
  var PHONETIC_RULES = Object.fromEntries(
    SUPPORTED_LANGUAGES.filter((code) => ALL_LANGS[code].phonetics.length > 0).map((code) => [code, compileRegexRules(ALL_LANGS[code].phonetics)])
  );
  var MISHEARINGS = Object.fromEntries(
    SUPPORTED_LANGUAGES.filter((code) => ALL_LANGS[code].mishearings.length > 0).map((code) => [code, compileRegexRules(ALL_LANGS[code].mishearings)])
  );
  var ARTICLES = Object.fromEntries(
    SUPPORTED_LANGUAGES.map((code) => [code, ALL_LANGS[code].articles])
  );
  var TRAILING_FILLERS = Object.fromEntries(
    SUPPORTED_LANGUAGES.filter((code) => ALL_LANGS[code].fillers.length > 0).map((code) => [code, ALL_LANGS[code].fillers])
  );
  var PATTERNS = Object.fromEntries(
    SUPPORTED_LANGUAGES.map((code) => [code, ALL_LANGS[code].patterns])
  );
  var LABELS = Object.fromEntries(
    SUPPORTED_LANGUAGES.map((code) => [code, ALL_LANGS[code].labels])
  );
  var LANGUAGE_NAMES = Object.fromEntries(
    SUPPORTED_LANGUAGES.map((code) => [code, ALL_LANGS[code].name])
  );
  function phoneticNormalize(text, lang) {
    const rules = PHONETIC_RULES[lang];
    if (!rules) return text;
    let result = text;
    for (const [pattern, replacement] of rules) {
      result = result.replace(pattern, replacement);
    }
    return result;
  }
  function stripArticles(text, lang) {
    const articles = ARTICLES[lang];
    if (!articles || articles.length === 0) return text;
    const words = text.split(/\s+/);
    let stripped = 0;
    while (stripped < Math.min(2, words.length - 1)) {
      if (articles.includes(words[stripped])) {
        stripped++;
      } else {
        break;
      }
    }
    return stripped > 0 ? words.slice(stripped).join(" ") : text;
  }
  function stripTrailingFillers(text, lang) {
    const fillers = TRAILING_FILLERS[lang];
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
  function getMishearings(lang) {
    return MISHEARINGS[lang] ?? [];
  }
  function getPatternsForCommand(commandId, lang) {
    const langPatterns = PATTERNS[lang]?.[commandId] ?? [];
    const enPatterns = lang === "en" ? [] : PATTERNS.en?.[commandId] ?? [];
    const seen = /* @__PURE__ */ new Set();
    const result = [];
    for (const p of [...langPatterns, ...enPatterns]) {
      if (!seen.has(p)) {
        seen.add(p);
        result.push(p);
      }
    }
    return result;
  }

  // static/src/voice-commands.js
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
  var webappLangProvider = {
    getPatterns: getPatternsForCommand,
    getMishearings,
    phoneticNormalize,
    stripArticles,
    stripTrailingFillers,
    trySplitCompound
  };
  function buildVoiceCommands(lang) {
    return COMMAND_DEFS.map((def) => ({
      ...def,
      patterns: getPatternsForCommand(def.id, lang)
    }));
  }
  function findCommand(rawText, voiceCommands, lang) {
    const result = findMatch(rawText, voiceCommands, lang, webappLangProvider);
    if (!result) return null;
    const cmd = voiceCommands.find((c) => c.id === result.commandId);
    if (!cmd) return null;
    return { cmd, textBefore: result.textBefore };
  }
  function stripCommandPunctuation(str) {
    return str.replace(/[,;.!?]+\s*$/, "");
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
  var VOICE_COMMANDS = buildVoiceCommands(activeLang);
  function checkForCommand() {
    if (!activeInsert || !activeInsert.textContent) return false;
    const raw = activeInsert.textContent.replace(/[.!?]/g, "");
    if (!raw.trim()) return false;
    const result = findCommand(raw, VOICE_COMMANDS, activeLang);
    if (result) {
      if (result.textBefore) {
        const span = document.createElement("span");
        if (result.cmd.punctuation) {
          span.textContent = stripCommandPunctuation(result.textBefore) + result.cmd.insert;
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
      const result = findCommand(textOnly, VOICE_COMMANDS, activeLang);
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
            prefixSpan.textContent = stripCommandPunctuation(textBefore) + cmd.insert;
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
              prev.textContent = stripCommandPunctuation(prev.textContent);
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
            prev.textContent = stripCommandPunctuation(prev.textContent);
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
      const result = findCommand(textOnly, VOICE_COMMANDS, activeLang);
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
            prefixSpan.textContent = stripCommandPunctuation(textBefore) + cmd.insert;
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
              prev.textContent = stripCommandPunctuation(prev.textContent);
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
