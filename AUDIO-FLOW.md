# Audio Processing Flow — Voxtral Transcribe (Gedetailleerd)

Alle audioverwerkingsstromen in de **Web App** en **Obsidian Plugin**, tot op functie-niveau.

---

## 1. Audio Capture

```mermaid
flowchart TB
    MIC["getUserMedia()"]

    MIC --> DEV{"deviceId\ngeselecteerd?"}
    DEV -- ja --> EXACT["deviceId: exact"]
    DEV -- nee --> DEFMIC["Systeem default"]
    EXACT -- mislukt --> FALL["Fallback default mic\n+ Notice waarschuwing"]
    EXACT -- ok --> NS
    FALL --> NS
    DEFMIC --> NS

    NS{"noiseSuppression\nenabled?"}
    NS -- ja --> NS_ON["MediaTrackConstraints:\nnoiseSuppression: true\nechoCancellation: true\nautoGainControl: true\n\naudio-recorder.ts:93-97\napp.js:1358-1361"]
    NS -- nee --> NS_OFF["channelCount: 1\n(geen filtering)"]
    NS_ON --> STREAM["MediaStream"]
    NS_OFF --> STREAM

    STREAM --> CTX["AudioContext\nsampleRate: 16000"]
    CTX --> SOURCE["createMediaStreamSource()"]

    SOURCE --> PCM_PATH
    SOURCE --> BLOB_PATH
    SOURCE -.->|"web only"| MIC_LVL

    subgraph PCM_PATH["PCM pad (realtime modi)"]
        WK_P["Plugin: AudioWorklet\npcm-processor"]
        WK_W["Web: ScriptProcessor\nbufferSize=4096"]
        WK_P --> PCM16_P["Float32 to Int16\nin worklet process()"]
        WK_W --> PCM16_W["floatTo16BitPCM()\n+ downsample()"]
        PCM16_P --> PCM_OUT["PCM s16le 16kHz mono\nArrayBuffer chunks"]
        PCM16_W --> PCM_OUT
    end

    subgraph BLOB_PATH["Blob pad (batch mode)"]
        MR["MediaRecorder\nmimeType: audio/webm;codecs=opus\ntimeslice: 1000ms"]
        MR --> CHUNKS["ondataavailable\n-> chunks[]"]
        CHUNKS --> STOP["stop() -> complete Blob"]
        CHUNKS --> FLUSH["flushChunk():\nstop + restart recorder\n(nieuwe container headers)"]
    end

    subgraph MIC_LVL["Mic Level (web only)"]
        ANA["AnalyserNode fftSize=256"]
        ANA --> RMS["RMS berekening"]
        RMS --> EMA["Slow EMA smoothing\nalpha=0.02"]
        EMA --> LBL{"Niveau?"}
        LBL -- "<0.06" --> SIL["stil"]
        LBL -- "<0.12" --> ZACHT["te zacht"]
        LBL -- "<0.45" --> OK["in orde"]
        LBL -- "<0.75" --> HARD["hard"]
        LBL -- ">=0.75" --> TEHARD["te hard"]
    end

    subgraph TYPING["Typing Mute (plugin only)\nmain.ts:438-547"]
        KEY["keydown event\n(capture phase)"]
        KEY --> MOD{"Modifier/nav\nkey?"}
        MOD -- ja --> IGNORE["Negeer\n(Ctrl/Alt/Shift/Meta\npijltjes/F-toetsen)"]
        MOD -- nee --> MUTE["recorder.mute()\ntrack.enabled = false"]
        MUTE --> COOL["Cooldown timer\ntypingCooldownMs\n(default 800ms)"]
        COOL --> UNMUTE["recorder.unmute()\ntrack.enabled = true"]
    end

    subgraph FOCUS["Focus Pause (plugin only)\nmain.ts:379-427"]
        VIS["visibilitychange"]
        VIS --> HIDDEN{"document.hidden?"}
        HIDDEN -- ja --> BEH{"focusBehavior?"}
        BEH -- pause --> IMMPAUSE["Direct pauzeren\nrecorder.pause()"]
        BEH -- pause-after-delay --> DELAY["setTimeout\nfocusPauseDelaySec"]
        BEH -- keep-recording --> KEEP["Niets doen"]
        HIDDEN -- nee --> RESUME["recorder.resume()\ntrack.enabled = true"]
    end
```

---

## 2. Batch Mode

```mermaid
flowchart TB
    BLOB["Audio Blob\n(WebM/Opus)"]

    TRIG{"Trigger?"}
    BLOB --> TRIG
    TRIG -- "Stop opname\nrecorder.stop()" --> UPLOAD
    TRIG -- "sendChunk()\ntap-to-send" --> UPLOAD
    TRIG -- "Enter toets\n(plugin only)" --> ENTER_CHECK

    ENTER_CHECK{"enterToSend=true\nAND batch mode\nAND !isTypingMuted\nAND !typingResumeTimer\nmain.ts:480-493"}
    ENTER_CHECK -- ja --> UPLOAD
    ENTER_CHECK -- nee --> NEWLINE["Gewone newline\nin editor"]

    UPLOAD["Upload audio"]
    UPLOAD -- "Web App" --> WEB_API["POST /api/transcribe\nserver.py:278-316\n+ FormData"]
    UPLOAD -- "Plugin" --> PLG_API["POST /v1/audio/transcriptions\nmistral-api.ts:157-216\nmultipart via requestUrl"]
    UPLOAD -. "netwerk fout\n(web only)" .-> OFFLINE

    WEB_API --> MODEL["Mistral Batch Model\nbatchModel setting\ndefault: voxtral-mini-latest"]
    PLG_API --> MODEL

    MODEL --> DIARIZE{"diarize=true?\n(web only)"}
    DIARIZE -- ja --> SEGMENTS["Segmenten met\nspreker-labels\nSpreker 1: ...\nSpreker 2: ..."]
    DIARIZE -- nee --> RAW_TEXT["Platte tekst"]
    SEGMENTS --> RESULT["Transcriptie tekst"]
    RAW_TEXT --> RESULT

    RESULT --> HALLUC{"Hallucination check\nmistral-api.ts:104-153"}
    HALLUC -- ">5 woorden/sec\nEN >20 woorden" --> DISCARD["Verworpen"]
    HALLUC -- "3+ blokken\ngescheiden door ---" --> DISCARD
    HALLUC -- "3+ identieke\nzinnen" --> DISCARD
    HALLUC -- "OK" --> CMD_PRE

    CMD_PRE{"matchCommand()\nVOOR correctie"}
    CMD_PRE -- "command gevonden" --> SKIP_CORR["Skip auto-correct\n(LLM mangelt commands)"]
    CMD_PRE -- "geen command" --> AC_CHECK

    AC_CHECK{"autoCorrect\nenabled?"}
    AC_CHECK -- ja --> CORRECT["correctText()\nMistral Chat API"]
    AC_CHECK -- nee --> PROCESS
    CORRECT --> PROCESS
    SKIP_CORR --> PROCESS

    PROCESS["processText(editor, text)\nof feedText() in web"]

    subgraph OFFLINE["Offline Queue (web only)\napp.js:1114-1215"]
        IDB["saveToQueue()\nIndexedDB store"]
        IDB --> RETRY{"Retry trigger?"}
        RETRY -- "window online event" --> PROC["processQueue()"]
        RETRY -- "elke 30 seconden" --> PROC
        RETRY -- "klik op badge" --> PROC
        PROC --> UPLOAD
    end
```

---

## 3. Streaming Single

```mermaid
flowchart TB
    PCM["PCM s16le 16kHz mono\n(uit Audio Capture)"]

    PCM --> WS_CONN{"Platform?"}
    WS_CONN -- "Web App" --> WS_WEB["Browser WebSocket\nws://host/ws/transcribe\n?delay=delayMs"]
    WS_CONN -- "Plugin" --> WS_PLG["Node.js https upgrade\nwss://api.mistral.ai/v1/\naudio/transcriptions/realtime\n+ Authorization: Bearer header\nmistral-api.ts:344-552"]

    WS_WEB --> SERVER["server.py:319-396\naudio_queue.put(data)\nasync audio_stream()\nyield chunks"]
    SERVER --> MISTRAL["Mistral SDK\nclient.audio.realtime\n.transcribe_stream()\ntarget_streaming_delay_ms"]
    WS_PLG --> MISTRAL_D["Mistral Realtime API\nsession.update:\naudio_format: pcm_s16le/16kHz\ntarget_streaming_delay_ms"]

    MISTRAL --> EVENTS
    MISTRAL_D --> EVENTS

    EVENTS{"Server Event?"}

    EVENTS -- "session.created" --> SESSION["Plugin: sendSessionUpdate()\naudio_format + delay_ms\nmistral-api.ts:669-683"]

    EVENTS -- "text.delta" --> DELTA_SPLIT{"Platform?"}
    DELTA_SPLIT -- "Web" --> FEED["feedText(text)\nauto-spacing\nlowercase mid-sentence"]
    DELTA_SPLIT -- "Plugin" --> PEND["pendingText += text\nbuffer accumulator"]

    FEED --> PROC_SENT["processCompletedSentences()\nregex: /[^.!?]+[.!?]+/\nbij elke .!? in tekst"]
    PEND --> FLUSH_CHECK{"sentenceEnd .!?\nor > 120 chars?"}
    FLUSH_CHECK -- ja --> TRACK["trackProcessText()\n+ dictatedRanges tracking"]
    FLUSH_CHECK -- nee --> WAIT["Wacht op meer tekst"]

    PROC_SENT --> CMD_CHECK["findCommand() per zin\n(zie Voice Commands)"]
    TRACK --> CMD_CHECK2["matchCommand()\n+ stop-opname patterns"]

    EVENTS -- "transcription.done" --> DONE_SPLIT{"Platform?"}
    DONE_SPLIT -- "Web" --> FINALIZE["finalizeInsertPoint()\nstrip trailing punct\nauto-space after\nauto-capitalize next"]
    DONE_SPLIT -- "Plugin" --> FLUSH_PEND["Flush remaining\npendingText"]

    EVENTS -- "error" --> ERR["Log + Notice"]

    EVENTS -- "WS close" --> RECONN{"Reconnect"}
    RECONN -- "Web" --> RECONN_W["setTimeout 1500ms\nstartRealtime()\napp.js:1415-1436"]
    RECONN -- "Plugin" --> RECONN_P["Exponential backoff\n500ms * failures\nmax 3000ms\nmax 5 pogingen\nmain.ts:779-827"]
    RECONN_P -- "gelukt" --> MISTRAL_D
    RECONN_W -- "gelukt" --> WS_WEB
    RECONN_P -- "5x mislukt" --> STOP["Stop opname"]

    STOP_REC["Bij stop opname"] --> DRAIN["endAudio()\nwacht 1000ms\nflush pendingText"]
    DRAIN --> AC_STOP{"autoCorrect?"}
    AC_STOP -- "Web" --> AC_WEB["autoCorrectAfterStop()\nhele transcript"]
    AC_STOP -- "Plugin" --> AC_PLG["autoCorrectAfterStop(editor)\nalleen dictatedRanges\nmerge + sort eind-naar-begin\nmain.ts:1565-1604"]
    AC_STOP -- nee --> DONE["Klaar"]
    AC_WEB --> DONE
    AC_PLG --> DONE
```

---

## 4. Dual-Delay Mode

```mermaid
flowchart TB
    PCM["PCM s16le 16kHz mono\n(uit Audio Capture)"]

    PCM --> DUP["Audio dupliceren"]

    DUP --> FAST_Q["Fast queue / stream\ndelay = 240ms"]
    DUP --> SLOW_Q["Slow queue / stream\ndelay = 2400ms"]

    ARCH{"Platform?"}
    FAST_Q --> ARCH
    SLOW_Q --> ARCH

    ARCH -- "Web App" --> WEB_DUAL["1 WebSocket\n/ws/transcribe-dual\n?fast_delay=240&slow_delay=2400"]
    WEB_DUAL --> SRV_DUP["server.py:399-493\nreceive_audio() dupliceert\nnaar fast_queue + slow_queue"]
    SRV_DUP --> SRV_GATHER["asyncio.gather(\nrun_stream fast,\nrun_stream slow\n)"]
    SRV_GATHER --> FAST_M["Mistral stream\ndelay=240ms"]
    SRV_GATHER --> SLOW_M["Mistral stream\ndelay=2400ms"]

    ARCH -- "Plugin" --> PLG_DUAL["2 aparte\nRealtimeTranscriber\ninstanties\nmain.ts:974-1047"]
    PLG_DUAL --> FAST_M2["Mistral WS\ndelayOverride=240ms"]
    PLG_DUAL --> SLOW_M2["Mistral WS\ndelayOverride=2400ms"]

    FAST_M --> FAST_EV{"Fast events\nstream=fast"}
    FAST_M2 --> FAST_EV
    SLOW_M --> SLOW_EV{"Slow events\nstream=slow"}
    SLOW_M2 --> SLOW_EV

    FAST_EV -- delta --> FAST_ACC["dualFastText += text"]
    FAST_EV -- done --> FAST_ACC
    FAST_ACC --> RENDER

    SLOW_EV -- delta --> SLOW_ACC["dualSlowText += text"]
    SLOW_EV -- done --> SLOW_DONE["dualSlowText = msg.text\n(volledige finalized tekst)"]
    SLOW_ACC --> RENDER
    SLOW_DONE --> RENDER

    RENDER["renderDualText()\nmain.ts:1146-1207"]
    RENDER --> STRIP_WS{"kolom 0 EN\ndualDisplayLen=0?"}
    STRIP_WS -- ja --> STRIP_DO["Strip leading\nwhitespace"]
    STRIP_WS -- nee --> DISPLAY
    STRIP_DO --> DISPLAY{"fastLen > slowLen?"}
    DISPLAY -- ja --> COMBINED["slow tekst (bevestigd/wit)\n+ fast voorbij slow (preview/grijs)"]
    DISPLAY -- nee --> SLOW_ONLY["alleen slow tekst"]

    SLOW_ACC --> PROC_SLOW
    SLOW_DONE --> PROC_SLOW

    PROC_SLOW["processDualSlowCommands()"]
    PROC_SLOW --> SENT_MATCH["Regex: voltooide zinnen\n/[^.!?]+[.!?]+/"]
    SENT_MATCH --> PER_SENT{"Per zin:"}
    PER_SENT -- "matchCommand()" --> CMD_EXEC["Voer commando uit\n(insert/delete/stop)"]
    PER_SENT -- "geen command" --> TXT_COMMIT["Commit tekst permanent\nals span / editor insert"]
    CMD_EXEC --> REBASE
    TXT_COMMIT --> REBASE

    REBASE["Cursor rebase:\ndualInsertOffset =\neditor.posToOffset(cursor)\ndualDisplayLen = 0\nmain.ts:1232, 1268"]
    REBASE --> TRIM

    TRIM["Trim accumulators:\ndualSlowText = remainder\ndualFastText.substring(matched)\nupdate offset"]
    TRIM --> RENDER

    RECONN_D["Per-stream reconnect\nfast en slow onafhankelijk\nzelfde backoff als single\nmain.ts:1049-1140"]
    FAST_M -. disconnect .-> RECONN_D
    SLOW_M -. disconnect .-> RECONN_D
    FAST_M2 -. disconnect .-> RECONN_D
    SLOW_M2 -. disconnect .-> RECONN_D

    STOP_D["Bij stop opname"] --> END_BOTH["endAudio() op beide\nwacht 1000ms"]
    END_BOTH --> FINAL_PROC["processDualSlowCommands()\nlaatste zinnen"]
    FINAL_PROC --> FINAL_TXT["Finalize:\nslow tekst prioriteit\nof fast als fallback"]
    FINAL_TXT --> AC_D{"autoCorrect?"}
    AC_D -- ja --> AC_RANGES["correctText() op\ndictatedRanges[]"]
    AC_D -- nee --> DONE_D["Klaar"]
    AC_RANGES --> DONE_D
```

---

## 5. Voice Command Pipeline

```mermaid
flowchart TB
    RAW["Ruwe zin van transcriptie"]

    RAW --> PREMATCH{"preMatchHook?\n(template matching)"}
    PREMATCH -- "template match" --> TEMPLATE["Template invoegen\n(zie Slot System)"]
    PREMATCH -- "geen match" --> NORM

    NORM["normalizeCommand()\nvoice-commands.ts:97-105\n1. NFD + strip combining chars\n   (e met trema -> e)\n2. replace hyphens met spaties\n3. strip leestekens (.,!?;:'\n   en haakjes)\n4. toLowerCase()\n5. trim()"]
    NORM --> MISHEAR["fixMishearings(lang)\nTaalspecifieke regex:\nnl: niveau->nieuwe, niva->nieuwe\nnl: beeindigde->beeindig de\nnl: linea->alinea, linie->alinea\nnl: nieuw alinea->nieuwe alinea\nnl: nieuw regel->nieuwe regel\nfr: nouveau ligne->nouvelle ligne\nfr: nouvelle paragraphe->nouveau paragraphe\nde: neue absatz->neuer absatz\nde: neues zeile->neue zeile"]

    MISHEAR --> PASS1["Pass 1: Exact match\nnormalized.endsWith(pattern)?"]
    PASS1 -- match --> SPLIT["Splits textBefore + command\nop basis van woordtelling"]
    PASS1 -- "geen match" --> PASS2["Pass 2: Strip trailing fillers\n(alsjeblieft, please, etc.)\n+ hermatchen"]
    PASS2 -- match --> SPLIT
    PASS2 -- "geen match" --> PASS2B["Pass 2b: Strip leading articles\nuit trailing portion\n(de, het, een, the, a, etc.)"]
    PASS2B -- match --> SPLIT
    PASS2B -- "geen match" --> PASS3["Pass 3: Phonetic match\nphoneticNormalize() op\nboth sides, dan endsWith"]
    PASS3 -- match --> SPLIT
    PASS3 -- "geen match" --> PASS4["Pass 4: Compound-word split\n(nieuwealinea -> nieuwe alinea)\ntrySplitCompound() +\nre-run exact match"]
    PASS4 -- match --> SPLIT
    PASS4 -- "geen match" --> PASS5["Pass 5: Fuzzy match\nLevenshtein distance < 3\nalleen als hele zin\nmin 6 chars, max 3 len verschil"]
    PASS5 -- "match" --> SPLIT2["textBefore = leeg\n(hele zin is command)"]
    PASS5 -- "geen match" --> PLAIN["Gewone tekst invoegen\ninsertAtCursor()"]

    SPLIT --> EXEC
    SPLIT2 --> EXEC

    EXEC["Execute command"]
    EXEC --> TB_CHECK{"textBefore\naanwezig?"}
    TB_CHECK -- ja --> INSERT_TB["Insert textBefore\nin editor/transcript"]
    TB_CHECK -- nee --> ACTION

    INSERT_TB --> PUNCT{"command.punctuation\n= true?"}
    PUNCT -- ja --> STRIP_P["Strip trailing\npunctuation van\ntextBefore"]
    PUNCT -- nee --> ACTION
    STRIP_P --> ACTION

    ACTION{"Command type?"}

    ACTION -- "Insert commands" --> INS_CMDS
    ACTION -- "Slot commands\n(plugin only)" --> SLOT_CMDS
    ACTION -- "Delete/control" --> DEL_CMDS
    ACTION -- "Custom command" --> CUSTOM_CMDS

    subgraph INS_CMDS["Insert Commands"]
        A1["newParagraph: \\n\\n"]
        A2["newLine: \\n"]
        A3["heading1/2/3: \\n\\n# / ## / ###"]
        A4["bulletPoint: \\n- "]
        A5["todoItem: \\n- [ ] "]
        A6["numberedItem: auto-increment\nzoek laatste N. -> \\nN+1. "]
        A7["colon: strip trailing punct\n+ insert ': '"]
    end

    subgraph SLOT_CMDS["Slot Commands (plugin only)\nvoice-commands.ts:263-339"]
        S1["wikilink: [[ cursor ]]"]
        S2["bold: ** cursor **"]
        S3["italic: * cursor *"]
        S4["inlineCode: `` cursor ``"]
        S5["tag: # cursor\n(exit bij enter of spatie)"]
    end

    subgraph DEL_CMDS["Delete / Control"]
        A8["deleteLastParagraph:\nverwijder na laatste \\n\\n"]
        A9["deleteLastLine:\nverwijder na laatste .!? of \\n"]
        A10["undo: editor.undo()"]
        A11["stopRecording:\nsetTimeout 0ms stopRecording()"]
    end

    subgraph CUSTOM_CMDS["Custom Commands\nvoice-commands.ts:349-380"]
        CC1{"type?"}
        CC1 -- insert --> CC_INS["insertText invoegen\n(zoals gewone commands)"]
        CC1 -- slot --> CC_SLOT["Open slot met\nslotPrefix/slotSuffix\nexit via slotExit trigger"]
    end

    SLOT_CMDS --> SLOT_SYS

    subgraph SLOT_SYS["Slot System\nvoice-commands.ts:43-94"]
        SL_OPEN["openSlot(): prefix invoegen\nactiveSlot instellen"]
        SL_OPEN --> SL_BUFF["slotBuffer: dictatie\naccumuleert in buffer"]
        SL_BUFF --> SL_EXIT{"Exit trigger?\n(enter / space /\nenter-or-space)"}
        SL_EXIT -- ja --> SL_CLOSE["closeSlot(): suffix invoegen\nflushSlotBuffer()"]
        SL_EXIT -- "cancel command" --> SL_CANCEL["cancelSlot(): suffix\noverslaan, buffer flushen"]
    end
```

---

## 6. Text Correction Pipeline

```mermaid
flowchart TB
    INPUT["Tekst om te corrigeren"]

    WHEN{"Wanneer?"}
    WHEN -- "Batch: direct\nna transcriptie" --> SCOPE_B["Hele chunk"]
    WHEN -- "Realtime/Dual:\nbij stop opname" --> SCOPE_R
    WHEN -- "Handmatig:\ncorrectSelection() /\ncorrectAll()\nmain.ts:1616-1664" --> SCOPE_M["Selectie of\nhele note"]

    subgraph SCOPE_R["Plugin: dictatedRanges scope"]
        MERGE["mergeRanges()\noverlapping samenvoegen"]
        MERGE --> SORT["Sort eind naar begin\n(offsets blijven geldig)"]
        SORT --> PER_RANGE["Per range:\nextract tekst uit editor"]
    end

    SCOPE_B --> CMD_SKIP
    PER_RANGE --> CMD_SKIP
    SCOPE_M --> CMD_SKIP

    CMD_SKIP{"matchCommand()\naanwezig?"}
    CMD_SKIP -- ja --> SKIP["Skip correctie\n(voorkom mangling\nvan commando-tekst)"]
    CMD_SKIP -- nee --> API_CALL

    API_CALL{"Platform?"}
    API_CALL -- "Web" --> WEB_C["POST /api/correct\nserver.py:247-275"]
    API_CALL -- "Plugin" --> PLG_C["POST /v1/chat/completions\nmistral-api.ts:220-273"]

    WEB_C --> MODEL_C["Mistral Chat Model\ncorrectModel setting\ndefault: mistral-small-latest\ntemperature: 0.1"]
    PLG_C --> MODEL_C

    MODEL_C --> PROMPT["System prompt:\n- Fix capitalisatie\n- Fix spraakherkenningsfouten\n- Fix leestekens\n- Behoud structuur/stijl/markdown\n- Volg inline correctie-instructies\n  (voor de correctie, nee niet X\n   maar Y, met een hoofdletter)\n- Verwijder meta-commentaar\n+ optioneel: user systemPrompt"]

    PROMPT --> RESULT["LLM response"]

    RESULT --> GUARD1["Guard 1:\nstripLlmCommentary()\nVerwijder (commentaar)\nblokken >10 chars\ndie niet in input stonden\nmistral-api.ts:279-294"]
    GUARD1 --> GUARD2{"Guard 2:\noutput.length >\ninput.length * 1.5 + 50?"}
    GUARD2 -- ja --> REJECT["Correctie verworpen\n(hallucinatie)\nOrigineel behouden"]
    GUARD2 -- nee --> ACCEPT["Gecorrigeerde tekst\ngebruiken"]

    ACCEPT --> REPLACE{"Platform?"}
    REPLACE -- "Web" --> REPL_W["transcript.innerHTML\nvervangen"]
    REPLACE -- "Plugin" --> REPL_P["editor.replaceRange()\nper dictatedRange"]
```

---

## Waar wordt elke optie toegepast?

| Optie | Waar in code | Wanneer | Effect |
|-------|-------------|---------|--------|
| **noiseSuppression** | `audio-recorder.ts:93-97`, `app.js:1358-1361` | Bij `getUserMedia()` start | Browser WebRTC: noiseSuppression + echoCancellation + autoGainControl |
| **Typing mute** | `main.ts:438-547` | Elke keydown tijdens opname (plugin) | `track.enabled=false`, unmute na `typingCooldownMs` (800ms) |
| **Focus pause** | `main.ts:379-427` | `visibilitychange` event (plugin) | `recorder.pause()` + `track.enabled=false` |
| **Hallucination check** | `mistral-api.ts:104-153` | Na batch transcriptie (plugin) | Verwerp als >5w/s, herhaalde blokken, of identieke zinnen |
| **Auto-correct** | `main.ts:707-708`, `main.ts:1463-1464`, `app.js:1953-1976` | Batch: direct. Realtime: bij stop | `correctText()` via Mistral Chat, skip bij voice commands |
| **Manual correction** | `main.ts:1616-1664` | Handmatig via knop/command (plugin) | `correctSelection()` of `correctAll()` onafhankelijk van auto-correct |
| **Correction guards** | `mistral-api.ts:258-273` | Na elke correctie-response | `stripLlmCommentary()` + lengte-check (1.5x + 50) |
| **Enter-to-send** | `main.ts:480-493` | Keydown Enter in batch mode (plugin) | `sendChunk()` als mic niet gedempt |
| **Diarize** | `server.py:291-311` | Batch transcriptie (web only) | Spreker-segmenten in response |
| **Offline queue** | `app.js:1114-1215` | Netwerk fout bij batch upload (web) | IndexedDB opslag, auto-retry |
| **dictatedRanges** | `main.ts:1484-1531`, `main.ts:1565-1604` | Tijdens realtime/dual dictatie (plugin) | Track ingevoegde bereiken voor precise auto-correct |
| **Mic level** | `app.js:1265-1320` | Tijdens opname (web only) | AnalyserNode RMS + slow EMA → status indicator |
| **Custom commands** | `voice-commands.ts:349-380` | Bij alle transcriptie modi | Gebruiker-gedefinieerde commando's, type insert of slot |
| **Slot system** | `voice-commands.ts:43-94`, `main.ts:906-920` | Bij slot-commands (wikilink, bold, etc.) | Prefix/suffix patroon met gebufferde dictatie |

---

## Platform-architectuur verschil

| Aspect | Web App | Plugin |
|--------|---------|--------|
| **Audio capture** | `ScriptProcessor` (legacy) | `AudioWorklet` (modern) |
| **WS transport** | Browser WS → server.py proxy → Mistral SDK | Node.js `https` manual upgrade → direct Mistral API |
| **WS auth** | Geen (lokale server beheert key) | `Authorization: Bearer` header op upgrade request |
| **Dual-delay** | 1 WS, server dupliceert naar 2 Mistral streams | 2 aparte WS verbindingen naar Mistral (2x API quota) |
| **Reconnect** | `setTimeout(1500ms)` → `startRealtime()` | Exponential backoff `500ms * n`, max 3000ms, max 5x |
| **Voice commands** | `processCompletedSentences()` bij elke delta | Buffer in `pendingText`, flush bij `.!?` of >120 chars |
| **Auto-correct scope** | Hele transcript na stop | Alleen `dictatedRanges[]` (precise tracking) |
| **Typing mute** | Niet beschikbaar | `keydown` → `mute()` → cooldown → `unmute()` |
| **Focus handling** | Niet beschikbaar | pause / pause-after-delay / keep-recording |
| **Custom commands** | Niet beschikbaar | `loadCustomCommands()` + UI editor modal |
| **Slot commands** | Niet beschikbaar | wikilink, bold, italic, inlineCode, tag |
| **Manual correction** | Niet beschikbaar | `correctSelection()` + `correctAll()` commands |
| **Mobile** | Volledig (PWA + offline queue) | Forced batch (geen WS custom headers) |
| **Rate limiting** | `MAX_WS_CONNECTIONS=4` (server) | Geen (directe API) |

---

## 7. Obsidian Plugin: Mobiel vs Desktop

```mermaid
flowchart TB
    START["Plugin gestart"]
    START --> PLATFORM{"Platform.isMobile?\ncanRealtime getter\nmain.ts:119-121"}
    START --> EFFMODE["effectiveMode getter\nmain.ts:124-129\nreturn canRealtime ?\nsettings.mode : batch"]

    PLATFORM -- "Desktop" --> DESK
    PLATFORM -- "Mobiel" --> MOB

    subgraph DESK["Desktop Obsidian"]
        D_MODE{"settings.mode?"}
        D_MODE -- realtime --> D_RT["Realtime modus\n(streaming single)"]
        D_MODE -- batch --> D_BATCH["Batch modus"]
        D_RT --> D_DUAL{"dualDelay\nenabled?"}
        D_DUAL -- ja --> D_DD["Dual-Delay modus\n(2 WS streams)"]
        D_DUAL -- nee --> D_SINGLE["Single stream\n(1 WS)"]

        D_STATUS["StatusBar\naddStatusBarItem()\nmain.ts:148-150"]
        D_HELP["Auto-open help panel\nmain.ts:587-589"]
        D_TYPING["Typing mute\nkeydown → mute/unmute\nmain.ts:438-547"]
        D_FOCUS["Focus pause\nvisibilitychange\nmain.ts:379-427"]
    end

    subgraph MOB["Mobiel Obsidian"]
        M_MODE["effectiveMode = batch\n(altijd, ongeacht instelling)\nmain.ts:124-129"]
        M_MODE --> M_BATCH["Batch modus\n(enige optie)"]

        M_SEND["Mobiele send-knop\nview.addAction('send')\nmain.ts:350-363"]
        M_NOTICE["Eenmalige batch-notice\ndismissMobileBatchNotice\nmain.ts:597-619"]
        M_NO_STATUS["Geen StatusBar"]
        M_NO_HELP["Help panel niet\nauto-geopend\nmain.ts:587"]
        M_NO_TYPING["Geen typing mute\n(geen fysiek toetsenbord)"]
        M_FOCUS_REL["Focus pause = relevant\n(app wisselen = background)"]
    end
```

### Settings per platform

| Setting | Desktop | Mobiel | Reden |
|---------|---------|--------|-------|
| **mode** | `realtime` of `batch` (keuze) | Altijd `batch` (geforceerd) | `canRealtime = !Platform.isMobile` — geen custom WS headers op mobiel |
| **dualDelay** | Beschikbaar (als mode=realtime) | Niet bereikbaar | Realtime niet beschikbaar |
| **dualDelayFastMs / SlowMs** | Configureerbaar | Niet bereikbaar | Vereist realtime |
| **streamingDelayMs** | Configureerbaar | Niet bereikbaar | Vereist realtime |
| **enterToSend** | Ja, bij batch mode | Ja, bij batch mode | Op mobiel relevant met extern toetsenbord |
| **typingCooldownMs** | Actief (keydown handler) | Niet actief | Geen fysiek toetsenbord / geen handler |
| **focusBehavior** | Werkt (window focus) | Werkt (app-switch = background) | Relevanter op mobiel (vaker app-wissel) |
| **focusPauseDelaySec** | Werkt | Werkt | Alleen bij `pause-after-delay` |
| **noiseSuppression** | Werkt | Werkt | Browser-level via `getUserMedia()` |
| **autoCorrect** | Werkt | Werkt | Zelfde Mistral Chat API |
| **microphoneDeviceId** | Werkt (meerdere mics) | Werkt (meestal 1 mic) | Fallback bij fout |
| **customCommands** | Niet beschikbaar | Werkt (UI editor modal) | Gebruiker-gedefinieerde commands met triggers per taal |
| **dismissMobileBatchNotice** | Niet getoond | Getoond (eenmalig) | Alleen zichtbaar op mobiel |

### Bereikbare verwerkingsstromen

```mermaid
flowchart LR
    subgraph DESKTOP["Desktop"]
        D1["Batch"] --> D_OUT["Diagram 2"]
        D2["Streaming Single"] --> D_OUT2["Diagram 3"]
        D3["Dual-Delay"] --> D_OUT3["Diagram 4"]
    end

    subgraph MOBILE["Mobiel"]
        M1["Batch"] --> M_OUT["Diagram 2"]
        M2["Streaming Single\n🚫 niet beschikbaar"]
        M3["Dual-Delay\n🚫 niet beschikbaar"]
    end

    style M2 fill:#fee,stroke:#c33,color:#933
    style M3 fill:#fee,stroke:#c33,color:#933
```
