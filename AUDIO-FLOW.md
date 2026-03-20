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
    NS -- ja --> NS_ON["MediaTrackConstraints:\nnoiseSuppression: true\nechoCancellation: true\nautoGainControl: true\n\naudio-recorder.ts:93-97\napp.js:1133-1137"]
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

    subgraph TYPING["Typing Mute (plugin only)\nmain.ts:324-406"]
        KEY["keydown event\n(capture phase)"]
        KEY --> MOD{"Modifier/nav\nkey?"}
        MOD -- ja --> IGNORE["Negeer\n(Ctrl/Alt/Shift/Meta\npijltjes/F-toetsen)"]
        MOD -- nee --> MUTE["recorder.mute()\ntrack.enabled = false"]
        MUTE --> COOL["Cooldown timer\ntypingCooldownMs\n(default 800ms)"]
        COOL --> UNMUTE["recorder.unmute()\ntrack.enabled = true"]
    end

    subgraph FOCUS["Focus Pause (plugin only)\nmain.ts:265-320"]
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

    ENTER_CHECK{"enterToSend=true\nAND batch mode\nAND !isTypingMuted\nAND !typingResumeTimer\nmain.ts:339-352"}
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

    subgraph OFFLINE["Offline Queue (web only)\napp.js:889-978"]
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
    RECONN -- "Web" --> RECONN_W["setTimeout 1500ms\nstartRealtime()\napp.js:1186-1208"]
    RECONN -- "Plugin" --> RECONN_P["Exponential backoff\n500ms * failures\nmax 3000ms\nmax 5 pogingen\nmain.ts:635-680"]
    RECONN_P -- "gelukt" --> MISTRAL_D
    RECONN_W -- "gelukt" --> WS_WEB
    RECONN_P -- "5x mislukt" --> STOP["Stop opname"]

    STOP_REC["Bij stop opname"] --> DRAIN["endAudio()\nwacht 1000ms\nflush pendingText"]
    DRAIN --> AC_STOP{"autoCorrect?"}
    AC_STOP -- "Web" --> AC_WEB["autoCorrectAfterStop()\nhele transcript"]
    AC_STOP -- "Plugin" --> AC_PLG["autoCorrectAfterStop(editor)\nalleen dictatedRanges\nmerge + sort eind-naar-begin\nmain.ts:1203-1242"]
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

    ARCH -- "Plugin" --> PLG_DUAL["2 aparte\nRealtimeTranscriber\ninstanties\nmain.ts:769-821"]
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

    RENDER["renderDualText()"]
    RENDER --> DISPLAY{"fastLen > slowLen?"}
    DISPLAY -- ja --> COMBINED["slow tekst (bevestigd/wit)\n+ fast voorbij slow (preview/grijs)"]
    DISPLAY -- nee --> SLOW_ONLY["alleen slow tekst"]

    SLOW_ACC --> PROC_SLOW
    SLOW_DONE --> PROC_SLOW

    PROC_SLOW["processDualSlowCommands()"]
    PROC_SLOW --> SENT_MATCH["Regex: voltooide zinnen\n/[^.!?]+[.!?]+/"]
    SENT_MATCH --> PER_SENT{"Per zin:"}
    PER_SENT -- "matchCommand()" --> CMD_EXEC["Voer commando uit\n(insert/delete/stop)"]
    PER_SENT -- "geen command" --> TXT_COMMIT["Commit tekst permanent\nals span / editor insert"]
    CMD_EXEC --> TRIM
    TXT_COMMIT --> TRIM

    TRIM["Trim accumulators:\ndualSlowText = remainder\ndualFastText.substring(matched)\nupdate offset"]
    TRIM --> RENDER

    RECONN_D["Per-stream reconnect\nfast en slow onafhankelijk\nzelfde backoff als single"]
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

    RAW --> NORM["normalizeCommand()\n1. toLowerCase()\n2. NFD + strip combining chars\n   (e met trema -> e)\n3. strip hyphens (alle Unicode variants)\n4. strip leestekens (.,!?;:)"]
    NORM --> MISHEAR["fixMishearings(lang)\nTaalspecifieke regex:\nnl: niveau->nieuwe\nnl: beeindigde->beeindig de\nnl: linea->alinea\nnl: nieuw alinea->nieuwe alinea\nfr: nouveau ligne->nouvelle ligne\nde: neue absatz->neuer absatz"]

    MISHEAR --> PASS1["Pass 1: Exact match\nVoor elk commando:\nnormalized.endsWith(pattern)?\nof normalized === pattern?"]
    PASS1 -- match --> SPLIT["Splits textBefore + command\nop basis van woordtelling"]
    PASS1 -- "geen match" --> PASS2["Pass 2: Fuzzy match\nLevenshtein distance\nalleen als hele zin\ndrempel: distance < 3"]
    PASS2 -- "match" --> SPLIT2["textBefore = leeg\n(hele zin is command)"]
    PASS2 -- "geen match" --> PLAIN["Gewone tekst invoegen\ninsertAtCursor()"]

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

    ACTION{"Command ID?"}
    ACTION -- newParagraph --> A1["\\n\\n"]
    ACTION -- newLine --> A2["\\n"]
    ACTION -- heading1/2/3 --> A3["\\n\\n# / ## / ###"]
    ACTION -- bulletPoint --> A4["\\n- "]
    ACTION -- todoItem --> A5["\\n- [ ] "]
    ACTION -- numberedItem --> A6["Auto-increment:\nzoek laatste N. patroon\ninsert \\nN+1. "]
    ACTION -- colon --> A7["Strip trailing punct\n+ insert ': '"]
    ACTION -- deleteLastParagraph --> A8["Verwijder alles na\nlaatste \\n\\n"]
    ACTION -- deleteLastLine --> A9["Verwijder alles na\nlaatste .!? of \\n"]
    ACTION -- undo --> A10["Herstel vorige staat\nundoStack.pop()\nmax 20 entries"]
    ACTION -- stopRecording --> A11["setTimeout 0ms\nstopRecording()"]
```

---

## 6. Text Correction Pipeline

```mermaid
flowchart TB
    INPUT["Tekst om te corrigeren"]

    WHEN{"Wanneer?"}
    WHEN -- "Batch: direct\nna transcriptie" --> SCOPE_B["Hele chunk"]
    WHEN -- "Realtime/Dual:\nbij stop opname" --> SCOPE_R
    WHEN -- "Handmatig:\nknop/command" --> SCOPE_M["Selectie of\nhele note"]

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
| **noiseSuppression** | `audio-recorder.ts:93-97`, `app.js:1133-1137` | Bij `getUserMedia()` start | Browser WebRTC: noiseSuppression + echoCancellation + autoGainControl |
| **Typing mute** | `main.ts:324-406` | Elke keydown tijdens opname (plugin) | `track.enabled=false`, unmute na `typingCooldownMs` (800ms) |
| **Focus pause** | `main.ts:265-320` | `visibilitychange` event (plugin) | `recorder.pause()` + `track.enabled=false` |
| **Hallucination check** | `mistral-api.ts:104-153` | Na batch transcriptie (plugin) | Verwerp als >5w/s, herhaalde blokken, of identieke zinnen |
| **Auto-correct** | `main.ts:566`, `main.ts:1105`, `app.js:1723` | Batch: direct. Realtime: bij stop | `correctText()` via Mistral Chat, skip bij voice commands |
| **Correction guards** | `mistral-api.ts:258-273` | Na elke correctie-response | `stripLlmCommentary()` + lengte-check (1.5x + 50) |
| **Enter-to-send** | `main.ts:339-352` | Keydown Enter in batch mode (plugin) | `sendChunk()` als mic niet gedempt |
| **Diarize** | `server.py:291-311` | Batch transcriptie (web only) | Spreker-segmenten in response |
| **Offline queue** | `app.js:889-978` | Netwerk fout bij batch upload (web) | IndexedDB opslag, auto-retry |
| **dictatedRanges** | `main.ts:1118-1170`, `main.ts:1203-1242` | Tijdens realtime/dual dictatie (plugin) | Track ingevoegde bereiken voor precise auto-correct |
| **Mic level** | `app.js:1038-1106` | Tijdens opname (web only) | AnalyserNode RMS + slow EMA → status indicator |

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
| **Mobile** | Volledig (PWA + offline queue) | Forced batch (geen WS custom headers) |
| **Rate limiting** | `MAX_WS_CONNECTIONS=4` (server) | Geen (directe API) |
