# Audio Processing Flow — Voxtral Transcribe

Dit document beschrijft de volledige audioverwerkingsketen voor zowel de **Web App** (`static/app.js` + `server.py`) als de **Obsidian Plugin** (`obsidian-plugin/src/`). Gebruik dit om vreemd gedrag te analyseren door te traceren waar in de keten iets misgaat.

---

## Overzichtsdiagram — Alle modi

```mermaid
flowchart TB
    MIC[🎤 Microfoon]

    MIC --> AR{Modus-selectie}
    AR -->|"batch"| BATCH
    AR -->|"realtime single"| SINGLE
    AR -->|"realtime dual-delay"| DUAL

    subgraph BATCH["① Batch Mode"]
        direction TB
        B1["MediaRecorder<br/>(WebM/Opus, 1s chunks)"]
        B2{"Stop of<br/>FlushChunk?"}
        B3["Blob samenstellen"]
        B4["Mistral Batch API<br/>voxtral-mini-latest<br/>POST /v1/audio/transcriptions"]
        B5{"Hallucination<br/>check"}
        B6["matchCommand()"]
        B7{"Auto-correct<br/>aan?"}
        B8["correctText()<br/>Mistral Chat"]
        B9["processText() →<br/>editor / transcript"]

        B1 --> B2
        B2 -->|stop| B3
        B2 -->|"flushChunk<br/>(tap-to-send)"| B3
        B3 --> B4
        B4 --> B5
        B5 -->|"verworpen<br/>(>5 w/s of herhalingen)"| B_DISCARD[Tekst weggegooid]
        B5 -->|OK| B6
        B6 -->|"commando gevonden"| B7
        B6 -->|"geen commando"| B7
        B7 -->|"ja + geen commando"| B8
        B7 -->|"nee, of commando"| B9
        B8 --> B9
    end

    subgraph SINGLE["② Streaming Single"]
        direction TB
        S1["AudioWorklet / ScriptProcessor<br/>PCM s16le 16kHz mono"]
        S2["WebSocket transport"]
        S3["Mistral Realtime API<br/>voxtral-mini-transcribe-realtime<br/>target_streaming_delay_ms"]
        S4{"Event type"}
        S5["delta → feedText()<br/>accumuleer in activeInsert"]
        S6["processCompletedSentences()<br/>bij elke . ! ?"]
        S7["done → finalizeInsertPoint()"]
        S8["Commando- of tekstverwerking"]
        S9{"WS sluit<br/>tijdens opname?"}
        S10["Auto-reconnect<br/>(max 5 pogingen)"]

        S1 --> S2
        S2 --> S3
        S3 --> S4
        S4 -->|"delta"| S5
        S4 -->|"done"| S7
        S4 -->|"error"| S9
        S5 --> S6
        S6 --> S8
        S7 --> S8
        S9 -->|ja| S10
        S10 -->|"gelukt"| S3
        S10 -->|"mislukt ×5"| STOP_REC[Stop opname]
    end

    subgraph DUAL["③ Dual-Delay"]
        direction TB
        D1["AudioWorklet / ScriptProcessor<br/>PCM s16le 16kHz mono"]
        D2["Audio gedupliceerd"]
        D3["Fast stream<br/>delay=240ms<br/>snelle preview"]
        D4["Slow stream<br/>delay=2400ms<br/>nauwkeurige tekst"]
        D5["renderDualText()<br/>slow=confirmed + fast=dimmed"]
        D6["processDualSlowCommands()<br/>bij elke . ! ? in slow"]
        D7{"Commando?"}
        D8["Voer commando uit<br/>(insert/delete/stop)"]
        D9["Commit tekst<br/>naar editor/transcript"]
        D10["Trim accumulators<br/>dualSlowText, dualFastText"]

        D1 --> D2
        D2 -->|"zelfde PCM"| D3
        D2 -->|"zelfde PCM"| D4
        D3 --> D5
        D4 --> D5
        D4 --> D6
        D6 --> D7
        D7 -->|ja| D8
        D7 -->|nee| D9
        D8 --> D10
        D9 --> D10
        D10 --> D5
    end

    style BATCH fill:#1a2744,stroke:#3b82f6,color:#e2e8f0
    style SINGLE fill:#1a3a2a,stroke:#22c55e,color:#e2e8f0
    style DUAL fill:#3a1a2a,stroke:#f59e0b,color:#e2e8f0
```

---

## Gedetailleerd: Voice Command Processing

De commandoherkenning is identiek in alle drie de modi en in beide platformen. Dit is vaak de oorzaak van vreemd gedrag (commando's die niet herkend worden, of juist tekst die als commando wordt geinterpreteerd).

```mermaid
flowchart LR
    RAW["Ruwe tekst<br/>van transcriptie"]
    NORM["normalizeCommand()<br/>• lowercase<br/>• strip diacritics ë→e<br/>• strip leestekens<br/>• strip hyphens"]
    MISHEAR["fixMishearings()<br/>taalspecifiek<br/>bv: 'niveau'→'nieuwe'<br/>'beeindigde'→'beeindig de'"]
    EXACT{"Pass 1:<br/>Exact match<br/>suffix check"}
    FUZZY{"Pass 2:<br/>Levenshtein ≤ 2<br/>alleen hele zin"}
    CMD["Commando gevonden<br/>→ execute action"]
    TXT["Geen commando<br/>→ insert als tekst"]

    RAW --> NORM --> MISHEAR --> EXACT
    EXACT -->|match| CMD
    EXACT -->|"geen match"| FUZZY
    FUZZY -->|"dist < 3"| CMD
    FUZZY -->|"dist ≥ 3"| TXT
```

---

## Gedetailleerd: Tekst Correctie Pipeline

Wordt aangeroepen als `autoCorrect` aan staat. In batch mode: direct na transcriptie. In realtime/dual: na het stoppen van de opname, op alleen de gedicteerde ranges.

```mermaid
flowchart TB
    INPUT["Gedicteerde tekst"]
    SKIP{"Bevat voice<br/>command?"}
    CORRECT["correctText()<br/>Mistral Chat<br/>mistral-small-latest<br/>temperature=0.1"]
    PROMPT["System prompt:<br/>• Fix capitalisatie<br/>• Fix verkeerd gespelde woorden<br/>• Fix leestekens<br/>• Inline correctie-instructies opvolgen<br/>• Behoud markdown-opmaak<br/>• NIET herschrijven"]
    STRIP["stripLlmCommentary()<br/>Verwijder (toegevoegde uitleg)<br/>die niet in origineel stond"]
    GUARD{"Output ><br/>1.5× input<br/>+ 50 chars?"}
    USE["Gecorrigeerde<br/>tekst gebruiken"]
    REJECT["Correctie verworpen<br/>→ origineel behouden"]

    INPUT --> SKIP
    SKIP -->|"ja → skip correctie"| USE
    SKIP -->|nee| CORRECT
    CORRECT --> PROMPT
    PROMPT --> STRIP
    STRIP --> GUARD
    GUARD -->|nee| USE
    GUARD -->|"ja (hallucinatie)"| REJECT
```

---

## Gedetailleerd: Audio Capture Layer

```mermaid
flowchart TB
    subgraph CAPTURE["AudioRecorder (gedeeld)"]
        direction TB
        MIC["getUserMedia()<br/>channelCount: 1"]
        MIC_FAIL{"Specifieke mic<br/>mislukt?"}
        FALLBACK["Fallback naar<br/>standaard mic"]
        CTX["AudioContext<br/>sampleRate: 16000"]

        subgraph PCM_PATH["PCM pad (realtime)"]
            direction TB
            WK["AudioWorklet<br/>'pcm-processor'"]
            WK_MSG["port.onmessage<br/>→ Int16Array chunks"]
        end

        subgraph BLOB_PATH["Blob pad (batch)"]
            direction TB
            MR["MediaRecorder<br/>WebM/Opus"]
            MR_DATA["ondataavailable<br/>→ chunks[]"]
            MR_STOP["stop() → Blob"]
            MR_FLUSH["flushChunk()<br/>stop + restart<br/>→ Blob met headers"]
        end

        MIC --> MIC_FAIL
        MIC_FAIL -->|ja| FALLBACK
        MIC_FAIL -->|nee| CTX
        FALLBACK --> CTX
        CTX --> PCM_PATH
        CTX --> BLOB_PATH
    end

    PCM_PATH -->|"realtime/dual"| WS_SEND["sendAudio() →<br/>base64 via WS (plugin)<br/>raw bytes via WS (web)"]
    BLOB_PATH -->|batch| API_SEND["POST naar<br/>Mistral batch API"]

    style CAPTURE fill:#1a1a2e,stroke:#6366f1,color:#e2e8f0
```

---

## Platform-verschillen: Web App vs Obsidian Plugin

```mermaid
flowchart TB
    subgraph WEB["Web App"]
        direction TB
        W1["Browser WebSocket<br/>naar lokale server"]
        W2["server.py proxy:<br/>/ws/transcribe<br/>/ws/transcribe-dual"]
        W3["Server → Mistral SDK<br/>transcribe_stream()"]
        W4["DOM-based transcript<br/>activeInsert span"]
        W5["Offline queue<br/>IndexedDB → batch later"]
        W6["ScriptProcessor<br/>(legacy audio API)"]
        W7["Dual: server dupliceert<br/>audio naar 2 Mistral streams<br/>via asyncio.gather()"]

        W1 --> W2 --> W3
        W6 -.-> W1
    end

    subgraph PLUGIN["Obsidian Plugin"]
        direction TB
        P1["Direct Mistral WS<br/>wss://api.mistral.ai<br/>via Node.js https upgrade"]
        P2["Custom WebSocket client<br/>met Auth header"]
        P3["Editor API<br/>replaceRange / setCursor"]
        P4["Typing mute<br/>mic uit bij toetsaanslag<br/>cooldown timer"]
        P5["Focus pause<br/>pauze bij app-naar-achtergrond"]
        P6["AudioWorklet<br/>(moderne audio API)"]
        P7["Dual: 2 aparte<br/>RealtimeTranscriber instances<br/>zelfde PCM naar beide"]
        P8["dictatedRanges tracking<br/>voor auto-correct na stop"]
        P9["Hallucination detection<br/>isLikelyHallucination()"]

        P1 --> P2
        P6 -.-> P1
    end

    style WEB fill:#1a2744,stroke:#3b82f6,color:#e2e8f0
    style PLUGIN fill:#2a1a34,stroke:#a855f7,color:#e2e8f0
```

---

## Verschilanalyse: Waar gedrag kan afwijken

| Aspect | Web App | Plugin | Mogelijke issues |
|---|---|---|---|
| **Audio transport** | ScriptProcessor + raw PCM bytes via WS | AudioWorklet + base64 JSON via WS | Worklet registratie kan falen op sommige platforms |
| **WS connectie** | Via server.py proxy | Direct naar Mistral API (Node.js https upgrade) | Auth header vereist Node.js — werkt niet op mobile |
| **Dual-delay architectuur** | 1 WS → server dupliceert naar 2 Mistral streams | 2 onafhankelijke WS verbindingen | Plugin gebruikt 2× API quota; timing kan afwijken |
| **Sentence detection** | Regex `[^.!?]+[.!?]+` op accumulated text | Zelfde regex op `pendingText` buffer | Bij realtime single: plugin buffert tot `\.[!?]\s*$` of >120 chars |
| **Command timing** | Direct bij elke delta (processCompletedSentences) | Pas bij sentence-end of >120 chars flush | Plugin kan commando's trager herkennen |
| **Auto-correct scope** | Niet beschikbaar in realtime (alleen batch) | Na stop: alleen dictatedRanges | Ranges kunnen verschuiven bij delete/undo commands |
| **Offline fallback** | IndexedDB queue → batch later | Geen offline support | Web app kan recordings kwijtraken bij crash voor opslag |
| **Reconnect** | setTimeout 1500ms → startRealtime() | Exponential backoff 500ms × failures (max 5) | Plugin is agressiever in reconnect |
| **Mobile** | Volledig ondersteund (PWA) | Forced batch mode (geen realtime WS) | Mobile Obsidian kan geen custom WS headers |
| **Typing mute** | Niet aanwezig | Mute mic bij keystroke, unmute na cooldown | Kan tekst verliezen als cooldown te kort is |
| **Focus behavior** | Geen handling | pause / pause-after-delay / keep-recording | Audio buffer kan vollopen bij lange achtergrond-pause |

---

## Debug Checklist

Bij vreemd gedrag, volg deze stroom:

1. **Geen tekst verschijnt**: Check mic-niveau → AudioContext sampleRate → WS connectie status → API key geldigheid
2. **Hallucinaties (herhalende/onzin tekst)**: Check `isLikelyHallucination()` drempels → audio te kort/stil? → typing mute actief?
3. **Commando niet herkend**: Check `normalizeCommand()` output → taal correct? → `fixMishearings()` patterns → Levenshtein afstand
4. **Commando onterecht herkend**: Check of tekst toevallig matcht → patronen te breed? → fuzzy match te agressief?
5. **Dual-delay timing issues**: Check of slow stream ver achterloopt → accumulators groeien oneindig? → `processDualSlowCommands()` trim-logica
6. **Tekst verdwijnt**: Check `deleteLastBlock()` / `restoreUndo()` → undo stack correct? → `dictatedRanges` offset-tracking na delete
7. **Correctie verminkt tekst**: Check of LLM commando-tekst herschrijft → `hasCommand` check voor correctie → `stripLlmCommentary()` te agressief?
8. **Reconnect loop**: Check `consecutiveFailures` teller → API rate limits → WebSocket close codes
