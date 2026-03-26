# Verkenning: Lokale transcriptie met Voxtral Mini 4B Realtime 2602

## Samenvatting

Het Voxtral Mini 4B Realtime 2602 model is open-source (Apache 2.0) en kan lokaal draaien. Dit document verkent de mogelijkheden om het model te integreren in de Obsidian plugin als alternatief voor de Mistral API, zodat gebruikers offline en privacyvriendelijk kunnen transcriberen.

---

## 1. Model overzicht

| Eigenschap | Waarde |
|---|---|
| **Model** | `mistralai/Voxtral-Mini-4B-Realtime-2602` |
| **Parameters** | 4 miljard |
| **Architectuur** | Causale audio encoder + Mistral LM decoder |
| **Licentie** | Apache 2.0 |
| **Talen** | 13 (NL, EN, FR, DE, ES, PT, IT, RU, ZH, JA, KO, HI, AR) |
| **Latency** | Configureerbaar 240ms – 2400ms (sweet spot: 480ms) |
| **Audio-invoer** | PCM s16le, 16kHz, mono |
| **Modelgrootte** | ~8.9 GB (BF16 weights) |

Het model heeft dezelfde talen als onze plugin al ondersteunt en gebruikt exact hetzelfde audioformaat (PCM s16le, 16kHz, mono) dat de plugin al produceert via AudioWorklet.

---

## 2. Opties voor lokale inferentie

### 2a. vLLM (meest volwassen)

- **Status:** Productie-klaar, officieel ondersteund door Mistral
- **Endpoint:** `ws://localhost:8000/v1/realtime` (WebSocket) + `POST /v1/audio/transcriptions` (batch)
- **Protocol:** Nagenoeg identiek aan Mistral API (dezelfde message types)
- **VRAM:** Minimaal 16GB GPU, maar in praktijk ~35GB door KV-cache pre-allocatie (instelbaar via `--max-model-len`)
- **Installatie:** `uv pip install vllm[audio]` → `vllm serve mistralai/Voxtral-Mini-4B-Realtime-2602 --enforce-eager`
- **Impact op plugin:** Minimaal — alleen de WebSocket URL wijzigen van `wss://api.mistral.ai/...` naar `ws://localhost:8000/v1/realtime`. Het protocol is compatible.

**Voordeel:** De plugin hoeft nauwelijks aangepast te worden. De `RealtimeTranscriber` class verbindt nu met `wss://api.mistral.ai/v1/audio/transcriptions/realtime` — bij lokaal gebruik wordt dit `ws://localhost:8000/v1/realtime`. De message types (`session.update`, `input_audio.append`, `transcription.text.delta`, `transcription.done`) zijn hetzelfde.

**Nadeel:** Vereist een GPU met voldoende VRAM. Niet geschikt voor laptops zonder dedicated GPU.

### 2b. voxtral.c (puur C, zero dependencies)

- **Status:** Werkend, gemaakt door antirez (Redis-maker), actief onderhouden
- **Platform:** macOS (Metal/MPS), Linux (OpenBLAS)
- **Performance:** ~2.5x sneller dan realtime op M3 Max
- **Geheugen:** ~8.9GB voor model weights
- **Streaming:** Ja, via `--from-mic` of `--stdin` met configureerbare interval (`-I` flag)
- **Impact op plugin:** Er zou een wrapper/bridge nodig zijn (child process of lokale HTTP/WS server die voxtral.c aanstuurt)

**Voordeel:** Geen Python, geen GPU driver stack nodig. Draait op Apple Silicon met Metal.

**Nadeel:** Geen native WebSocket server — vereist een bridge-laag. Alleen macOS (Metal) en Linux (OpenBLAS).

### 2c. Hugging Face Transformers

- **Status:** Recent toegevoegd (Transformers v5), werkend voor batch-transcriptie
- **Klasse:** `VoxtralRealtimeForConditionalGeneration` + `AutoProcessor`
- **VRAM:** ~16GB (BF16)
- **Streaming:** Beperkt — Transformers is primair batch-gericht. Real-time streaming vereist custom code.
- **Impact op plugin:** Zou een Python-backend vereisen die de Transformers pipeline draait en een WebSocket server aanbiedt.

**Voordeel:** Bekend ecosysteem, makkelijk te quantizen (4-bit, 8-bit).

**Nadeel:** Geen native streaming support. Extra Python backend nodig.

### 2d. GGUF (gekvantiseerd, community)

- **Status:** Community-builds beschikbaar (`andrijdavid/Voxtral-Mini-4B-Realtime-2602-GGUF`)
- **Formaten:** Q4, Q8, etc.
- **Grootte:** ~2.5 GB (Q4) vs 8.9 GB (BF16)
- **Runtime:** llama.cpp of compatible runtimes
- **Impact op plugin:** Vergelijkbaar met voxtral.c — bridge nodig

**Voordeel:** Veel kleiner, draait op CPU of kleine GPU.

**Nadeel:** Llama.cpp support voor dit model is nog experimenteel.

### 2e. ExecuTorch (Apple-apparaten)

- **Status:** Demo beschikbaar voor MacBook
- **Gebruik:** Offline demo, geoptimaliseerd voor Apple Neural Engine
- **Impact op plugin:** Niet direct bruikbaar vanuit Obsidian

### 2f. Rust/WASM (browser)

- **Status:** Proof-of-concept, Q4 GGUF draait in browser via WebGPU
- **Grootte:** ~2.5 GB download
- **Impact op plugin:** Theoretisch interessant voor Obsidian (Electron = Chromium = WebGPU), maar nog experimenteel

---

## 3. Aanbevolen aanpak voor de plugin

### Fase 1: vLLM backend (laagste effort, hoogste compatibiliteit)

De snelste weg naar lokale transcriptie:

1. **Nieuwe instelling toevoegen:** `transcriptionBackend: "mistral-api" | "local-vllm"`
2. **Nieuwe instelling:** `localServerUrl: string` (default: `ws://localhost:8000`)
3. **`RealtimeTranscriber.connect()` aanpassen:**
   - Bij `mistral-api`: huidige gedrag (wss://api.mistral.ai + Bearer token)
   - Bij `local-vllm`: verbind met lokale URL, geen auth header nodig
4. **`transcribeBatch()` aanpassen:** POST naar lokale server i.p.v. Mistral API
5. **`correctText()` apart houden:** Correctie vereist een LLM (Mistral Small) — kan optioneel ook lokaal via vLLM met een ander model, of uitgeschakeld worden
6. **Settings UI:** Toggle "Lokaal model" met URL-invoerveld + verbindingstest

**Geschatte wijzigingen:**
- `mistral-api.ts`: ~50 regels (URL-switching, optionele auth)
- `authenticated-websocket.ts`: Nieuwe codepath voor `ws://` (geen TLS/auth upgrade nodig)
- `settings-tab.ts`: ~30 regels (nieuwe UI-elementen)
- `types.ts`: ~5 regels (nieuwe settings)

### Fase 2: Bundled voxtral.c (zero-config ervaring)

Voor gevorderde gebruikers die geen vLLM willen installeren:

1. Bundel voxtral.c binaries per platform (macOS arm64, Linux x86_64)
2. Plugin start het proces automatisch bij eerste gebruik
3. Interne WebSocket bridge (of stdin pipe) voor communicatie
4. Model-download UI in settings

Dit is aanzienlijk meer werk maar geeft de beste gebruikerservaring.

---

## 4. Vereiste aanpassingen aan de huidige architectuur

### Wat al compatibel is (geen wijziging nodig)
- **Audio pipeline:** `AudioWorklet` produceert al PCM s16le, 16kHz, mono — exact wat het model verwacht
- **Message protocol:** vLLM's `/v1/realtime` gebruikt dezelfde message types als Mistral API
- **Delta-verwerking:** `RealtimeSession` behandelt deltas/done events generiek
- **Hallucination detection:** Werkt ongewijzigd
- **Voice commands:** Werken ongewijzigd

### Wat aangepast moet worden
| Component | Wijziging |
|---|---|
| `authenticated-websocket.ts` | Plain WebSocket optie toevoegen (ws:// zonder auth header) |
| `mistral-api.ts` (`RealtimeTranscriber`) | URL configureerbaar maken, auth optioneel |
| `mistral-api.ts` (`transcribeBatch`) | URL configureerbaar maken |
| `mistral-api.ts` (`correctText`) | URL configureerbaar maken of skip-optie |
| `types.ts` | Settings uitbreiden met backend-keuze + URL |
| `settings-tab.ts` | UI voor lokale backend configuratie |
| `main.ts` | Backend-keuze doorvoeren naar sessie-initialisatie |

### Wat NIET werkt voor lokale transcriptie
- **Obsidian Mobile:** Geen lokale GPU, vLLM kan niet draaien op telefoon. Batch mode via API blijft nodig als fallback.
- **Text correctie:** Vereist apart LLM (Mistral Small). Kan optioneel uitgeschakeld of via aparte lokale server.

---

## 5. Hardware-vereisten voor eindgebruikers

| Setup | VRAM/RAM | Geschikt voor |
|---|---|---|
| vLLM + BF16 (default) | ~35 GB VRAM | Workstation met A100/A6000 |
| vLLM + verlaagde max-model-len | ~16 GB VRAM | RTX 4080/4090, gaming PC |
| vLLM + quantized (INT8) | ~8 GB VRAM | RTX 3060/4060 |
| voxtral.c (Metal) | ~12 GB unified | MacBook Pro M1/M2/M3 (16GB+) |
| GGUF Q4 | ~4 GB | Oudere GPUs, high-end CPU |

---

## 6. Risico's en aandachtspunten

1. **vLLM installatie-complexiteit:** Vereist CUDA toolkit, Python, pip. Niet triviaal voor niet-technische gebruikers.
2. **Model download:** ~9 GB is groot. Moet eenmalig gedownload worden.
3. **VRAM-gebruik:** Onvoorspelbaar voor gebruikers die het niet kennen. Goede documentatie nodig.
4. **Versie-compatibiliteit:** vLLM evolueert snel. WebSocket protocol kan veranderen.
5. **Correctie-model:** Zonder Mistral Small lokaal is auto-correctie niet beschikbaar. Alternatieven: kleinere lokale LLMs (Phi-3, Llama 3B) of correctie uitschakelen.
6. **Dual-delay modus:** Gebruikt 2 gelijktijdige streams — lokaal betekent dit 2x GPU-belasting.

---

## 7. Conclusie

Lokale transcriptie met Voxtral Mini 4B Realtime is **zeer haalbaar** en vereist **minimale wijzigingen** aan de plugin dankzij protocol-compatibiliteit met vLLM.

**Aanbevolen eerste stap:** Een `local-vllm` backend-optie toevoegen die de bestaande WebSocket-verbinding hergebruikt met een configureerbare URL. Dit is een relatief kleine wijziging (~100 regels) die de volledige lokale transcriptie-ervaring ontsluit voor gebruikers met geschikte hardware.

De plugin-architectuur is al goed voorbereid: het audioformaat is identiek, de message types zijn compatible, en de sessie-logica is backend-agnostisch.
