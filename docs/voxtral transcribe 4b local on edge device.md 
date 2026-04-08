# Voxtral Mini 4B Realtime — On-Device via ExecuTorch

**Datum:** 7 april 2026
**Context:** Verkenning van de mogelijkheid om Voxtral Mini 4B Realtime (2602) lokaal te draaien op mobiele hardware (Samsung Galaxy S25 Ultra) via ExecuTorch.

## Kernbevinding

Mistral's Voxtral Mini 4B Realtime is een open-source (Apache 2.0) streaming ASR-model dat met ExecuTorch lokaal kan draaien — op laptop én on-device. Er bestaat een specifieke ExecuTorch-variant (`Voxtral-Mini-4B-Realtime-2602-ExecuTorch`) en ExecuTorch 1.2 biedt een volwassen Qualcomm AI Engine backend die de Snapdragon 8 Elite NPU in de S25 Ultra kan aanspreken. Met int4-kwantisatie krimpt het model naar ~2.5 GB, ruim binnen het 12 GB RAM-budget van de S25 Ultra.

Mistral waarschuwt wel: "Running Voxtral-Realtime on-device with ExecuTorch is not thoroughly tested and hence there might be some sharp edges." De complexiteit zit vermoedelijk in de streaming-architectuur (stateful decoding, sliding window attention), niet in fundamentele hardwarebeperkingen.

## Modelarchitectuur

| Component | Omvang |
|---|---|
| Language Model (decoder) | ~3.4B parameters |
| Audio Encoder (causaal, sliding window attention) | ~0.6B parameters |
| **Totaal** | **~4B parameters** |

Kenmerken:
- Natively streaming architectuur met custom causal audio encoder
- Configureerbare transcriptievertraging: 240 ms – 2.4 s (sweet spot: 480 ms)
- 13 talen, waaronder Nederlands
- Bij 480 ms delay competitief met offline modellen (Voxtral Transcribe 2.0)
- Throughput >12.5 tokens/s op minimale hardware
- BF16 weights, ≥16 GB GPU VRAM voor vLLM-serving (ongekwantiseerd)

## Deployment-paden

### 1. vLLM (productie, server-side)
- Primair ondersteund pad, ontwikkeld in samenwerking met het vLLM-team
- Realtime API via WebSocket (`/v1/realtime`)
- Vereist: GPU ≥16 GB, vLLM nightly, `mistral_common ≥1.9.0`

### 2. ExecuTorch (on-device / lokaal)
- Export via `torch.export()` met int4/int8 kwantisatie
- Backends: XNNPACK (CPU), Metal (Apple GPU), CUDA (NVIDIA), **Qualcomm AI Engine (NPU)**
- Eén export serveert meerdere backends
- Status: experimenteel, "sharp edges" mogelijk

### 3. Transformers (offline, Python)
- `VoxtralRealtimeForConditionalGeneration` + `AutoProcessor`
- Geschikt voor batch-transcriptie, niet voor streaming

### 4. Community-implementaties
- **Rust/WASM** (Burn framework): draait in browser via WebGPU, Q4-kwantisatie (~2.5 GB)
- **GGUF**: community-kwantisaties beschikbaar, o.a. via `voxtral.cpp`
- **ONNX**: `onnx-community/Voxtral-Mini-4B-Realtime-2602-ONNX`
- **MLX**: 4-bit kwantisatie voor Apple Silicon via `mlx-audio`

## S25 Ultra haalbaarheid

| Factor | Beoordeling |
|---|---|
| RAM (12 GB) | Ruim voldoende voor ~2.5 GB gekwantiseerd model |
| SoC (Snapdragon 8 Elite) | Qualcomm AI Engine backend in ExecuTorch 1.2 |
| Precedent | Llama 3 3B op Android/Qualcomm is gedocumenteerd in ExecuTorch |
| Streaming-complexiteit | Onbekend risico — sliding window attention + stateful decoding op NPU |
| Thermische throttling | Reëel bij continue inferentie, maar model is klein genoeg |

## Relevantie voor huidige workflow

Het Voxtral Realtime-model is een **streaming ASR-model**, fundamenteel anders dan de Voxtral API die nu wordt gebruikt voor offline transcriptie met diarisatie (KNSB-interviews). On-device Voxtral Realtime zou relevant zijn voor:

- Live ondertiteling tijdens gesprekken of webinars
- On-device voice assistant functionaliteit
- Privacygevoelige real-time transcriptie zonder API-afhankelijkheid

Het vervangt **niet** de huidige pipeline voor interview-analyse (diarisatie, postprocessing, LLM-correctie).

## Patronen

1. **Convergentie van open-source ASR naar on-device**: Mistral positioneert 4B bewust als on-device-geschikt, met ExecuTorch als deployment-framework. Dit volgt het bredere patroon van PyTorch's investering in edge AI (ExecuTorch 1.2 ondersteunt Qualcomm, Samsung Exynos, MediaTek, ARM).

2. **Kwantisatie als enabler**: De stap van 8.86 GB (BF16) naar ~2.5 GB (int4) maakt het verschil tussen server-only en mobiel. Meerdere community-kwantisaties (GGUF, ONNX, MLX) binnen weken na release.

3. **Multi-runtime ecosysteem**: Eén model, meerdere deployment-targets — vLLM (server), ExecuTorch (edge), Transformers (research), Rust/WASM (browser). Apache 2.0-licentie faciliteert dit.

4. **Streaming als architectuurkeuze**: De causale audio encoder met sliding window attention is geen afterthought maar ontwerpbeslissing. Dit maakt het model fundamenteel anders dan offline ASR (Whisper, Voxtral Transcribe) en verklaart zowel de mogelijkheden als de "sharp edges" bij on-device deployment.

## Bronnen

| Bron | URL |
|---|---|
| HuggingFace model card (4B) | https://huggingface.co/mistralai/Voxtral-Mini-4B-Realtime-2602 |
| ExecuTorch variant | https://huggingface.co/mistralai/Voxtral-Mini-4B-Realtime-2602-ExecuTorch |
| ExecuTorch Qualcomm backend docs | https://docs.pytorch.org/executorch/1.2/backends-qualcomm.html |
| ExecuTorch Voxtral README | https://github.com/pytorch/executorch/blob/main/examples/models/voxtral/README.md |
| PyTorch blog — Voice Agents met ExecuTorch | https://pytorch.org/blog/building-voice-agents-with-executorch-a-cross-platform-foundation-for-on-device-audio/ |
| Rust/WASM implementatie | https://github.com/TrevorS/voxtral-mini-realtime-rs |
| GGUF kwantisatie + voxtral.cpp | https://huggingface.co/andrijdavid/Voxtral-Mini-4B-Realtime-2602-GGUF |
| ONNX variant | https://huggingface.co/onnx-community/Voxtral-Mini-4B-Realtime-2602-ONNX |
| MLX 4-bit variant | https://huggingface.co/mlx-community/Voxtral-Mini-4B-Realtime-2602-4bit |
| Voxtral 3B (2507) — ExecuTorch voorbeelden | https://github.com/pytorch/executorch/blob/main/examples/models/voxtral/README.md |
