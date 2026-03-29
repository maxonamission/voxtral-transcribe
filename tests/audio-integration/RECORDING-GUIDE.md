# Voice Command Recording Guide

This guide is auto-generated from the language JSON files.
Regenerate with: `node scripts/generate-recording-guide.mjs > tests/audio-integration/RECORDING-GUIDE.md`

Last generated: 2026-03-29

## Recording instructions

### Equipment
- Use a standard laptop microphone, phone, or headset — the same equipment end users would use.
- No studio microphone needed — we want realistic conditions.

### Environment
- **Quiet room** preferred for the primary sample set.
- Optionally record a separate set with **light background noise** (cafe, office) to test robustness.
- Avoid echo-heavy rooms (bathrooms, stairwells).

### How to record
1. Use any audio recorder (Audacity, phone voice memo, `arecord`, etc.).
2. Format: **WAV, 16kHz, mono, 16-bit PCM** (native Voxtral input format).
   - If your recorder outputs a different format, convert with: `ffmpeg -i input.m4a -ar 16000 -ac 1 -sample_fmt s16 output.wav`
3. Each recording should be **2-5 seconds** — just the command phrase, no extra silence.
4. Speak at **normal conversational speed** — not overly careful or slow.
5. Leave ~0.5s silence at the start and end (natural pause before/after speaking).

### File naming
- Pattern: `{lang}/{command-id}--{variant}.wav`
- Examples: `nl/newParagraph--nieuwe-alinea.wav`, `nl/stopRecording--stopopname.wav`
- For negative samples (normal speech): `{lang}/negative--{description}.wav`

### What to record per language
- **At minimum**: the **first** (most common) trigger phrase for each command.
- **Ideally**: 2-3 variants per command, especially for commands with many trigger phrases.
- **Negative samples**: 3-5 normal sentences that should NOT match any command.
  - Example: "Het weer is mooi vandaag" (NL), "I went to the store" (EN)

### Priority commands
Focus on these commands first — they are most commonly used:
- `newParagraph`, `newLine`, `bulletPoint`, `todoItem`, `stopRecording`
- Then: `heading1`-`heading3`, `numberedItem`, `undo`, `colon`
- Then: formatting commands (`boldOpen`, `italicOpen`, etc.)

---

## Commands per language

### العربية (`ar`)

| Command | Label | Trigger phrases | Priority |
|---------|-------|-----------------|----------|
| newParagraph | فقرة جديدة | `فقرة جديدة` | High |
| newLine | سطر جديد | `سطر جديد`, `السطر التالي` | High |
| heading1 | عنوان 1 | `عنوان واحد`, `عنوان 1` | Medium |
| heading2 | عنوان 2 | `عنوان اثنين`, `عنوان 2` | Medium |
| heading3 | عنوان 3 | `عنوان ثلاثة`, `عنوان 3` | Medium |
| bulletPoint | نقطة جديدة | `نقطة جديدة`, `عنصر جديد` | High |
| todoItem | مهمة جديدة | `مهمة جديدة` | High |
| numberedItem | عنصر مرقم | `عنصر مرقم`, `الرقم التالي` | Medium |
| deleteLastParagraph | احذف الفقرة الأخيرة | `احذف الفقرة الأخيرة` | Medium |
| deleteLastLine | احذف السطر الأخير | `احذف السطر الأخير`, `احذف الجملة الأخيرة` | Medium |
| undo | تراجع | `تراجع` | Medium |
| stopRecording | أوقف التسجيل | `أوقف التسجيل`, `إيقاف التسجيل` | High |
| colon | نقطتان | `نقطتان` | Medium |
| wikilink | [[…]] رابط ويكي | `رابط ويكي`, `رابط` | Low |
| boldOpen | ** افتح غامق | `افتح غامق`, `غامق افتح` | Low |
| boldClose | ** أغلق غامق | `أغلق غامق`, `غامق أغلق` | Low |
| italicOpen | * افتح مائل | `افتح مائل`, `مائل افتح` | Low |
| italicClose | * أغلق مائل | `أغلق مائل`, `مائل أغلق` | Low |
| inlineCodeOpen | ` افتح كود | `افتح كود`, `كود افتح` | Low |
| inlineCodeClose | ` أغلق كود | `أغلق كود`, `كود أغلق` | Low |
| tagOpen | # افتح وسم | `افتح وسم`, `وسم افتح` | Low |
| tagClose | أغلق وسم | `أغلق وسم`, `وسم أغلق` | Low |
| codeBlockOpen | ``` افتح كتلة كود | `افتح كتلة كود` | Low |
| codeBlockClose | ``` أغلق كتلة كود | `أغلق كتلة كود` | Low |

### Deutsch (`de`)

| Command | Label | Trigger phrases | Priority |
|---------|-------|-----------------|----------|
| newParagraph | Neuer Absatz | `neuer absatz`, `neuer paragraph` | High |
| newLine | Neue Zeile | `neue zeile`, `nachste zeile` | High |
| heading1 | Überschrift 1 | `uberschrift eins`, `uberschrift 1` | Medium |
| heading2 | Überschrift 2 | `uberschrift zwei`, `uberschrift 2` | Medium |
| heading3 | Überschrift 3 | `uberschrift drei`, `uberschrift 3` | Medium |
| bulletPoint | Aufzählungspunkt | `neuer punkt`, `neuer aufzahlungspunkt`, `nachster punkt`, `neues element` | High |
| todoItem | Aufgabe | `neue aufgabe`, `neues todo`, `neues to do` | High |
| numberedItem | Nummerierter Punkt | `nummerierter punkt`, `neuer nummerierter punkt`, `nachste nummer` | Medium |
| deleteLastParagraph | Letzten Absatz löschen | `letzten absatz loschen`, `absatz loschen` | Medium |
| deleteLastLine | Letzte Zeile löschen | `letzte zeile loschen`, `letzten satz loschen` | Medium |
| undo | Rückgängig | `ruckgangig`, `ruckgangig machen` | Medium |
| stopRecording | Aufnahme beenden | `aufnahme beenden`, `aufnahme stoppen` | High |
| colon | Doppelpunkt | `doppelpunkt` | Medium |
| wikilink | Wikilink [[…]] | `wikilink`, `wiki link` | Low |
| boldOpen | Fett öffnen ** | `fett offnen`, `fett auf` | Low |
| boldClose | Fett schließen ** | `fett schliessen`, `fett zu` | Low |
| italicOpen | Kursiv öffnen * | `kursiv offnen`, `kursiv auf` | Low |
| italicClose | Kursiv schließen * | `kursiv schliessen`, `kursiv zu` | Low |
| inlineCodeOpen | Code öffnen ` | `code offnen`, `code auf` | Low |
| inlineCodeClose | Code schließen ` | `code schliessen`, `code zu` | Low |
| tagOpen | Tag öffnen # | `tag offnen`, `tag auf` | Low |
| tagClose | Tag schließen | `tag schliessen`, `tag zu` | Low |
| codeBlockOpen | Codeblock öffnen ``` | `codeblock offnen`, `code block offnen` | Low |
| codeBlockClose | Codeblock schließen ``` | `codeblock schliessen`, `code block schliessen` | Low |

### English (`en`)

| Command | Label | Trigger phrases | Priority |
|---------|-------|-----------------|----------|
| newParagraph | New paragraph | `new paragraph` | High |
| newLine | New line | `new line`, `next line` | High |
| heading1 | Heading 1 | `heading one`, `heading 1` | Medium |
| heading2 | Heading 2 | `heading two`, `heading 2` | Medium |
| heading3 | Heading 3 | `heading three`, `heading 3` | Medium |
| bulletPoint | Bullet point | `new item`, `next item`, `bullet`, `bullet point`, `new bullet` | High |
| todoItem | To-do item | `new todo`, `new to do`, `todo item`, `to do item` | High |
| numberedItem | Numbered item | `numbered item`, `new numbered item`, `next number` | Medium |
| deleteLastParagraph | Delete last paragraph | `delete last paragraph` | Medium |
| deleteLastLine | Delete last line | `delete last line`, `delete last sentence` | Medium |
| undo | Undo | `undo` | Medium |
| stopRecording | Stop recording | `stop recording` | High |
| colon | Colon | `colon` | Medium |
| wikilink | Wikilink [[…]] | `wiki link`, `wikilink`, `link` | Low |
| boldOpen | Open bold ** | `open bold`, `bold open`, `start bold` | Low |
| boldClose | Close bold ** | `close bold`, `bold close`, `end bold` | Low |
| italicOpen | Open italic * | `open italic`, `italic open`, `start italic` | Low |
| italicClose | Close italic * | `close italic`, `italic close`, `end italic` | Low |
| inlineCodeOpen | Open code ` | `open code`, `code open`, `start code` | Low |
| inlineCodeClose | Close code ` | `close code`, `code close`, `end code` | Low |
| tagOpen | Open tag # | `open tag`, `tag open`, `start tag` | Low |
| tagClose | Close tag | `close tag`, `tag close`, `end tag` | Low |
| codeBlockOpen | Open code block ``` | `open code block`, `code block open`, `start code block` | Low |
| codeBlockClose | Close code block ``` | `close code block`, `code block close`, `end code block` | Low |

### Español (`es`)

| Command | Label | Trigger phrases | Priority |
|---------|-------|-----------------|----------|
| newParagraph | Nuevo párrafo | `nuevo parrafo`, `nueva seccion` | High |
| newLine | Nueva línea | `nueva linea`, `siguiente linea` | High |
| heading1 | Título 1 | `titulo uno`, `titulo 1` | Medium |
| heading2 | Título 2 | `titulo dos`, `titulo 2` | Medium |
| heading3 | Título 3 | `titulo tres`, `titulo 3` | Medium |
| bulletPoint | Viñeta | `nuevo punto`, `nueva vineta`, `siguiente punto`, `nuevo elemento` | High |
| todoItem | Tarea | `nueva tarea`, `nuevo todo`, `nuevo to do` | High |
| numberedItem | Punto numerado | `punto numerado`, `nuevo numero`, `siguiente numero` | Medium |
| deleteLastParagraph | Borrar último párrafo | `borrar ultimo parrafo`, `eliminar ultimo parrafo` | Medium |
| deleteLastLine | Borrar última línea | `borrar ultima linea`, `eliminar ultima linea`, `borrar ultima frase` | Medium |
| undo | Deshacer | `deshacer` | Medium |
| stopRecording | Parar grabación | `parar grabacion`, `detener grabacion` | High |
| colon | Dos puntos | `dos puntos` | Medium |
| wikilink | Wikilink [[…]] | `wikilink`, `enlace wiki` | Low |
| boldOpen | Abrir negrita ** | `abrir negrita`, `negrita abrir` | Low |
| boldClose | Cerrar negrita ** | `cerrar negrita`, `negrita cerrar` | Low |
| italicOpen | Abrir cursiva * | `abrir cursiva`, `cursiva abrir` | Low |
| italicClose | Cerrar cursiva * | `cerrar cursiva`, `cursiva cerrar` | Low |
| inlineCodeOpen | Abrir código ` | `abrir codigo`, `codigo abrir` | Low |
| inlineCodeClose | Cerrar código ` | `cerrar codigo`, `codigo cerrar` | Low |
| tagOpen | Abrir etiqueta # | `abrir etiqueta`, `abrir tag` | Low |
| tagClose | Cerrar etiqueta | `cerrar etiqueta`, `cerrar tag` | Low |
| codeBlockOpen | Abrir bloque de código ``` | `abrir bloque de codigo` | Low |
| codeBlockClose | Cerrar bloque de código ``` | `cerrar bloque de codigo` | Low |

### Français (`fr`)

| Command | Label | Trigger phrases | Priority |
|---------|-------|-----------------|----------|
| newParagraph | Nouveau paragraphe | `nouveau paragraphe`, `nouvelle section`, `nouveau alinea` | High |
| newLine | Nouvelle ligne | `nouvelle ligne`, `a la ligne`, `retour a la ligne` | High |
| heading1 | Titre 1 | `titre un`, `titre 1` | Medium |
| heading2 | Titre 2 | `titre deux`, `titre 2` | Medium |
| heading3 | Titre 3 | `titre trois`, `titre 3` | Medium |
| bulletPoint | Puce | `nouveau point`, `nouvelle puce`, `point suivant`, `nouvel element`, `nouvel item` | High |
| todoItem | Tâche | `nouvelle tache`, `nouveau todo`, `nouveau to do` | High |
| numberedItem | Point numéroté | `point numero`, `element numero`, `nouveau numero` | Medium |
| deleteLastParagraph | Supprimer dernier paragraphe | `supprimer dernier paragraphe`, `effacer dernier paragraphe` | Medium |
| deleteLastLine | Supprimer dernière ligne | `supprimer derniere ligne`, `effacer derniere ligne`, `supprimer derniere phrase` | Medium |
| undo | Annuler | `annuler` | Medium |
| stopRecording | Arrêter l'enregistrement | `arreter enregistrement`, `arreter l enregistrement`, `stop enregistrement` | High |
| colon | Deux-points | `deux points` | Medium |
| wikilink | Wikilink [[…]] | `wiki lien`, `lien wiki` | Low |
| boldOpen | Ouvrir gras ** | `ouvrir gras`, `gras ouvrir` | Low |
| boldClose | Fermer gras ** | `fermer gras`, `gras fermer` | Low |
| italicOpen | Ouvrir italique * | `ouvrir italique`, `italique ouvrir` | Low |
| italicClose | Fermer italique * | `fermer italique`, `italique fermer` | Low |
| inlineCodeOpen | Ouvrir code ` | `ouvrir code`, `code ouvrir` | Low |
| inlineCodeClose | Fermer code ` | `fermer code`, `code fermer` | Low |
| tagOpen | Ouvrir étiquette # | `ouvrir etiquette`, `ouvrir tag` | Low |
| tagClose | Fermer étiquette | `fermer etiquette`, `fermer tag` | Low |
| codeBlockOpen | Ouvrir bloc de code ``` | `ouvrir bloc de code` | Low |
| codeBlockClose | Fermer bloc de code ``` | `fermer bloc de code` | Low |

### हिन्दी (`hi`)

| Command | Label | Trigger phrases | Priority |
|---------|-------|-----------------|----------|
| newParagraph | नया पैराग्राफ | `नया पैराग्राफ`, `नया अनुच्छेद` | High |
| newLine | नई लाइन | `नई लाइन`, `अगली लाइन` | High |
| heading1 | शीर्षक 1 | `शीर्षक एक`, `शीर्षक 1`, `हेडिंग 1` | Medium |
| heading2 | शीर्षक 2 | `शीर्षक दो`, `शीर्षक 2`, `हेडिंग 2` | Medium |
| heading3 | शीर्षक 3 | `शीर्षक तीन`, `शीर्षक 3`, `हेडिंग 3` | Medium |
| bulletPoint | नया बिंदु | `नया बिंदु`, `नया पॉइंट`, `अगला पॉइंट` | High |
| todoItem | नया कार्य | `नया कार्य`, `नया टूडू` | High |
| numberedItem | क्रमांकित बिंदु | `क्रमांकित बिंदु`, `अगला नंबर` | Medium |
| deleteLastParagraph | पिछला पैराग्राफ हटाओ | `पिछला पैराग्राफ हटाओ` | Medium |
| deleteLastLine | पिछली लाइन हटाओ | `पिछली लाइन हटाओ`, `अंतिम लाइन हटाओ` | Medium |
| undo | पूर्ववत | `पूर्ववत`, `अनडू` | Medium |
| stopRecording | रिकॉर्डिंग बंद करो | `रिकॉर्डिंग बंद करो`, `रिकॉर्डिंग रोको` | High |
| colon | कोलन | `कोलन` | Medium |
| wikilink | विकि लिंक [[…]] | `विकि लिंक`, `लिंक` | Low |
| boldOpen | बोल्ड खोलो ** | `बोल्ड खोलो`, `मोटा खोलो` | Low |
| boldClose | बोल्ड बंद करो ** | `बोल्ड बंद करो`, `मोटा बंद करो` | Low |
| italicOpen | इटैलिक खोलो * | `इटैलिक खोलो`, `तिरछा खोलो` | Low |
| italicClose | इटैलिक बंद करो * | `इटैलिक बंद करो`, `तिरछा बंद करो` | Low |
| inlineCodeOpen | कोड खोलो ` | `कोड खोलो` | Low |
| inlineCodeClose | कोड बंद करो ` | `कोड बंद करो` | Low |
| tagOpen | टैग खोलो # | `टैग खोलो` | Low |
| tagClose | टैग बंद करो | `टैग बंद करो` | Low |
| codeBlockOpen | कोड ब्लॉक खोलो ``` | `कोड ब्लॉक खोलो` | Low |
| codeBlockClose | कोड ब्लॉक बंद करो ``` | `कोड ब्लॉक बंद करो` | Low |

### Italiano (`it`)

| Command | Label | Trigger phrases | Priority |
|---------|-------|-----------------|----------|
| newParagraph | Nuovo paragrafo | `nuovo paragrafo`, `nuova sezione`, `nuovo capoverso` | High |
| newLine | Nuova riga | `nuova riga`, `a capo`, `riga successiva` | High |
| heading1 | Titolo 1 | `titolo uno`, `titolo 1` | Medium |
| heading2 | Titolo 2 | `titolo due`, `titolo 2` | Medium |
| heading3 | Titolo 3 | `titolo tre`, `titolo 3` | Medium |
| bulletPoint | Punto elenco | `nuovo punto`, `nuovo elemento`, `punto successivo`, `nuovo elenco` | High |
| todoItem | Attività | `nuovo compito`, `nuova attivita`, `nuovo todo`, `nuovo to do` | High |
| numberedItem | Punto numerato | `punto numerato`, `nuovo numero`, `numero successivo` | Medium |
| deleteLastParagraph | Cancella ultimo paragrafo | `cancella ultimo paragrafo`, `elimina ultimo paragrafo` | Medium |
| deleteLastLine | Cancella ultima riga | `cancella ultima riga`, `elimina ultima riga`, `cancella ultima frase` | Medium |
| undo | Annulla | `annulla` | Medium |
| stopRecording | Ferma registrazione | `ferma registrazione`, `interrompi registrazione`, `stop registrazione` | High |
| colon | Due punti | `due punti` | Medium |
| wikilink | Wikilink [[…]] | `wikilink`, `link wiki` | Low |
| boldOpen | Apri grassetto ** | `apri grassetto`, `grassetto apri` | Low |
| boldClose | Chiudi grassetto ** | `chiudi grassetto`, `grassetto chiudi` | Low |
| italicOpen | Apri corsivo * | `apri corsivo`, `corsivo apri` | Low |
| italicClose | Chiudi corsivo * | `chiudi corsivo`, `corsivo chiudi` | Low |
| inlineCodeOpen | Apri codice ` | `apri codice`, `codice apri` | Low |
| inlineCodeClose | Chiudi codice ` | `chiudi codice`, `codice chiudi` | Low |
| tagOpen | Apri tag # | `apri tag`, `apri etichetta` | Low |
| tagClose | Chiudi tag | `chiudi tag`, `chiudi etichetta` | Low |
| codeBlockOpen | Apri blocco di codice ``` | `apri blocco di codice` | Low |
| codeBlockClose | Chiudi blocco di codice ``` | `chiudi blocco di codice` | Low |

### 日本語 (`ja`)

| Command | Label | Trigger phrases | Priority |
|---------|-------|-----------------|----------|
| newParagraph | 新しい段落 | `新しい段落`, `新段落` | High |
| newLine | 改行 | `改行`, `新しい行`, `次の行` | High |
| heading1 | 見出し 1 | `見出し1`, `見出しいち` | Medium |
| heading2 | 見出し 2 | `見出し2`, `見出しに` | Medium |
| heading3 | 見出し 3 | `見出し3`, `見出しさん` | Medium |
| bulletPoint | 箇条書き | `箇条書き`, `新しい項目`, `次の項目` | High |
| todoItem | 新しいタスク | `新しいタスク`, `タスク追加` | High |
| numberedItem | 番号付き | `番号付き`, `次の番号` | Medium |
| deleteLastParagraph | 最後の段落を削除 | `最後の段落を削除` | Medium |
| deleteLastLine | 最後の行を削除 | `最後の行を削除`, `最後の文を削除` | Medium |
| undo | 元に戻す | `元に戻す`, `取り消し` | Medium |
| stopRecording | 録音停止 | `録音停止`, `録音を止めて` | High |
| colon | コロン | `コロン` | Medium |
| wikilink | ウィキリンク [[…]] | `ウィキリンク`, `リンク` | Low |
| boldOpen | 太字開始 ** | `太字開始`, `ボールド開始`, `太字開く` | Low |
| boldClose | 太字終了 ** | `太字終了`, `ボールド終了`, `太字閉じる` | Low |
| italicOpen | 斜体開始 * | `斜体開始`, `イタリック開始`, `斜体開く` | Low |
| italicClose | 斜体終了 * | `斜体終了`, `イタリック終了`, `斜体閉じる` | Low |
| inlineCodeOpen | コード開始 ` | `コード開始`, `コード開く` | Low |
| inlineCodeClose | コード終了 ` | `コード終了`, `コード閉じる` | Low |
| tagOpen | タグ開始 # | `タグ開始`, `タグ開く` | Low |
| tagClose | タグ終了 | `タグ終了`, `タグ閉じる` | Low |
| codeBlockOpen | コードブロック開始 ``` | `コードブロック開始`, `コードブロック開く` | Low |
| codeBlockClose | コードブロック終了 ``` | `コードブロック終了`, `コードブロック閉じる` | Low |

### 한국어 (`ko`)

| Command | Label | Trigger phrases | Priority |
|---------|-------|-----------------|----------|
| newParagraph | 새 단락 | `새 단락`, `새 문단` | High |
| newLine | 새 줄 | `새 줄`, `다음 줄`, `줄 바꿈` | High |
| heading1 | 제목 1 | `제목 1`, `제목 하나` | Medium |
| heading2 | 제목 2 | `제목 2`, `제목 둘` | Medium |
| heading3 | 제목 3 | `제목 3`, `제목 셋` | Medium |
| bulletPoint | 새 항목 | `새 항목`, `다음 항목`, `글머리 기호` | High |
| todoItem | 새 할일 | `새 할일`, `할일 추가` | High |
| numberedItem | 번호 항목 | `번호 항목`, `다음 번호` | Medium |
| deleteLastParagraph | 마지막 단락 삭제 | `마지막 단락 삭제` | Medium |
| deleteLastLine | 마지막 줄 삭제 | `마지막 줄 삭제`, `마지막 문장 삭제` | Medium |
| undo | 실행 취소 | `실행 취소`, `되돌리기` | Medium |
| stopRecording | 녹음 중지 | `녹음 중지`, `녹음 멈춰` | High |
| colon | 콜론 | `콜론` | Medium |
| wikilink | 위키링크 [[…]] | `위키링크`, `링크` | Low |
| boldOpen | 굵게 열기 ** | `굵게 열기`, `볼드 열기` | Low |
| boldClose | 굵게 닫기 ** | `굵게 닫기`, `볼드 닫기` | Low |
| italicOpen | 기울임 열기 * | `기울임 열기`, `이탤릭 열기` | Low |
| italicClose | 기울임 닫기 * | `기울임 닫기`, `이탤릭 닫기` | Low |
| inlineCodeOpen | 코드 열기 ` | `코드 열기` | Low |
| inlineCodeClose | 코드 닫기 ` | `코드 닫기` | Low |
| tagOpen | 태그 열기 # | `태그 열기` | Low |
| tagClose | 태그 닫기 | `태그 닫기` | Low |
| codeBlockOpen | 코드블록 열기 ``` | `코드블록 열기`, `코드 블록 열기` | Low |
| codeBlockClose | 코드블록 닫기 ``` | `코드블록 닫기`, `코드 블록 닫기` | Low |

### Nederlands (`nl`)

| Command | Label | Trigger phrases | Priority |
|---------|-------|-----------------|----------|
| newParagraph | Nieuwe alinea | `nieuwe alinea`, `nieuw alinea`, `nieuwe paragraaf`, `nieuw paragraaf`, `nieuwe linie` | High |
| newLine | Nieuwe regel | `nieuwe regel`, `nieuwe lijn`, `volgende regel` | High |
| heading1 | Kop 1 | `kop een`, `kop 1` | Medium |
| heading2 | Kop 2 | `kop twee`, `kop 2` | Medium |
| heading3 | Kop 3 | `kop drie`, `kop 3` | Medium |
| bulletPoint | Lijstpunt | `nieuw punt`, `nieuw lijstpunt`, `nieuw lijstitem`, `lijst punt`, `nieuw bullet`, `nieuw item`, `nieuwe item`, `volgend item`, `volgend punt` | High |
| todoItem | To-do item | `nieuw to do item`, `nieuw todo item`, `nieuw todo`, `nieuwe to do`, `nieuwe todo`, `nieuw taak`, `nieuwe taak` | High |
| numberedItem | Genummerd punt | `nieuw genummerd item`, `nieuw genummerd punt`, `genummerd punt`, `genummerd item`, `volgend nummer`, `nummer punt` | Medium |
| deleteLastParagraph | Verwijder laatste alinea | `verwijder laatste alinea`, `verwijder laatste paragraaf`, `wis laatste alinea` | Medium |
| deleteLastLine | Verwijder laatste regel | `verwijder laatste regel`, `verwijder laatste zin`, `wis laatste regel`, `wist laatste regel` | Medium |
| undo | Ongedaan maken | `herstel`, `ongedaan maken` | Medium |
| stopRecording | Stop opname | `beeindig opname`, `beeindig de opname`, `stop opname`, `stopopname`, `stop de opname` | High |
| colon | Dubbele punt | `dubbele punt`, `double punt`, `dubbelepunt` | Medium |
| wikilink | Wikilink [[…]] | `wikilink`, `wiki link`, `link` | Low |
| boldOpen | Vet openen ** | `vet openen`, `dikgedrukt openen`, `vet open` | Low |
| boldClose | Vet sluiten ** | `vet sluiten`, `dikgedrukt sluiten`, `vet dicht` | Low |
| italicOpen | Cursief openen * | `cursief openen`, `schuingedrukt openen`, `cursief open` | Low |
| italicClose | Cursief sluiten * | `cursief sluiten`, `schuingedrukt sluiten`, `cursief dicht` | Low |
| inlineCodeOpen | Code openen ` | `code openen`, `code open` | Low |
| inlineCodeClose | Code sluiten ` | `code sluiten`, `code dicht` | Low |
| tagOpen | Tag openen # | `tag openen`, `label openen`, `tag open` | Low |
| tagClose | Tag sluiten | `tag sluiten`, `label sluiten`, `tag dicht` | Low |
| codeBlockOpen | Codeblok openen ``` | `codeblok openen`, `code blok openen`, `codeblok open` | Low |
| codeBlockClose | Codeblok sluiten ``` | `codeblok sluiten`, `code blok sluiten`, `codeblok dicht` | Low |

### Português (`pt`)

| Command | Label | Trigger phrases | Priority |
|---------|-------|-----------------|----------|
| newParagraph | Novo parágrafo | `novo paragrafo`, `nova secao` | High |
| newLine | Nova linha | `nova linha`, `proxima linha` | High |
| heading1 | Título 1 | `titulo um`, `titulo 1` | Medium |
| heading2 | Título 2 | `titulo dois`, `titulo 2` | Medium |
| heading3 | Título 3 | `titulo tres`, `titulo 3` | Medium |
| bulletPoint | Ponto | `novo ponto`, `novo item`, `proximo ponto`, `novo elemento` | High |
| todoItem | Tarefa | `nova tarefa`, `novo todo`, `novo to do` | High |
| numberedItem | Ponto numerado | `ponto numerado`, `novo numero`, `proximo numero` | Medium |
| deleteLastParagraph | Apagar último parágrafo | `apagar ultimo paragrafo`, `excluir ultimo paragrafo` | Medium |
| deleteLastLine | Apagar última linha | `apagar ultima linha`, `excluir ultima linha`, `apagar ultima frase` | Medium |
| undo | Desfazer | `desfazer` | Medium |
| stopRecording | Parar gravação | `parar gravacao`, `encerrar gravacao` | High |
| colon | Dois pontos | `dois pontos` | Medium |
| wikilink | Wikilink [[…]] | `wikilink`, `link wiki` | Low |
| boldOpen | Abrir negrito ** | `abrir negrito`, `negrito abrir` | Low |
| boldClose | Fechar negrito ** | `fechar negrito`, `negrito fechar` | Low |
| italicOpen | Abrir itálico * | `abrir italico`, `italico abrir` | Low |
| italicClose | Fechar itálico * | `fechar italico`, `italico fechar` | Low |
| inlineCodeOpen | Abrir código ` | `abrir codigo`, `codigo abrir` | Low |
| inlineCodeClose | Fechar código ` | `fechar codigo`, `codigo fechar` | Low |
| tagOpen | Abrir etiqueta # | `abrir etiqueta`, `abrir tag` | Low |
| tagClose | Fechar etiqueta | `fechar etiqueta`, `fechar tag` | Low |
| codeBlockOpen | Abrir bloco de código ``` | `abrir bloco de codigo` | Low |
| codeBlockClose | Fechar bloco de código ``` | `fechar bloco de codigo` | Low |

### Русский (`ru`)

| Command | Label | Trigger phrases | Priority |
|---------|-------|-----------------|----------|
| newParagraph | Новый абзац | `новый абзац`, `новый параграф` | High |
| newLine | Новая строка | `новая строка`, `следующая строка` | High |
| heading1 | Заголовок 1 | `заголовок один`, `заголовок 1` | Medium |
| heading2 | Заголовок 2 | `заголовок два`, `заголовок 2` | Medium |
| heading3 | Заголовок 3 | `заголовок три`, `заголовок 3` | Medium |
| bulletPoint | Новый пункт | `новый пункт`, `новый элемент`, `следующий пункт` | High |
| todoItem | Новая задача | `новая задача`, `новое задание` | High |
| numberedItem | Нумерованный пункт | `нумерованный пункт`, `следующий номер` | Medium |
| deleteLastParagraph | Удалить последний абзац | `удалить последний абзац` | Medium |
| deleteLastLine | Удалить последнюю строку | `удалить последнюю строку`, `удалить последнее предложение` | Medium |
| undo | Отменить | `отменить`, `отмена` | Medium |
| stopRecording | Остановить запись | `остановить запись`, `стоп запись` | High |
| colon | Двоеточие | `двоеточие` | Medium |
| wikilink | Вики-ссылка [[…]] | `вики ссылка`, `вики линк` | Low |
| boldOpen | Открыть жирный ** | `открыть жирный`, `жирный открыть` | Low |
| boldClose | Закрыть жирный ** | `закрыть жирный`, `жирный закрыть` | Low |
| italicOpen | Открыть курсив * | `открыть курсив`, `курсив открыть` | Low |
| italicClose | Закрыть курсив * | `закрыть курсив`, `курсив закрыть` | Low |
| inlineCodeOpen | Открыть код ` | `открыть код`, `код открыть` | Low |
| inlineCodeClose | Закрыть код ` | `закрыть код`, `код закрыть` | Low |
| tagOpen | Открыть тег # | `открыть тег`, `тег открыть` | Low |
| tagClose | Закрыть тег | `закрыть тег`, `тег закрыть` | Low |
| codeBlockOpen | Открыть блок кода ``` | `открыть блок кода` | Low |
| codeBlockClose | Закрыть блок кода ``` | `закрыть блок кода` | Low |

### 中文 (`zh`)

| Command | Label | Trigger phrases | Priority |
|---------|-------|-----------------|----------|
| newParagraph | 新段落 | `新段落`, `新的段落` | High |
| newLine | 换行 | `换行`, `新行`, `下一行` | High |
| heading1 | 标题 1 | `标题一`, `标题1`, `一级标题` | Medium |
| heading2 | 标题 2 | `标题二`, `标题2`, `二级标题` | Medium |
| heading3 | 标题 3 | `标题三`, `标题3`, `三级标题` | Medium |
| bulletPoint | 列表项 | `新项目`, `列表项`, `新的项目` | High |
| todoItem | 待办事项 | `新任务`, `新待办`, `待办事项` | High |
| numberedItem | 编号项 | `编号项`, `新编号`, `下一个编号` | Medium |
| deleteLastParagraph | 删除上一段 | `删除上一段`, `删除最后一段` | Medium |
| deleteLastLine | 删除上一行 | `删除上一行`, `删除上一句` | Medium |
| undo | 撤销 | `撤销`, `撤回` | Medium |
| stopRecording | 停止录音 | `停止录音`, `结束录音` | High |
| colon | 冒号 | `冒号` | Medium |
| wikilink | 维基链接 [[…]] | `维基链接`, `链接` | Low |
| boldOpen | 开始加粗 ** | `开始加粗`, `加粗开始`, `打开粗体` | Low |
| boldClose | 结束加粗 ** | `结束加粗`, `加粗结束`, `关闭粗体` | Low |
| italicOpen | 开始斜体 * | `开始斜体`, `斜体开始`, `打开斜体` | Low |
| italicClose | 结束斜体 * | `结束斜体`, `斜体结束`, `关闭斜体` | Low |
| inlineCodeOpen | 开始代码 ` | `开始代码`, `代码开始`, `打开代码` | Low |
| inlineCodeClose | 结束代码 ` | `结束代码`, `代码结束`, `关闭代码` | Low |
| tagOpen | 开始标签 # | `开始标签`, `打开标签` | Low |
| tagClose | 结束标签 | `结束标签`, `关闭标签` | Low |
| codeBlockOpen | 开始代码块 ``` | `开始代码块`, `打开代码块` | Low |
| codeBlockClose | 结束代码块 ``` | `结束代码块`, `关闭代码块` | Low |

