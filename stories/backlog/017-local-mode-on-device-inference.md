# Story 017: Local mode — on-device transcription without API

**Epic:** Privacy & Offline
**Status:** Backlog
**Priority:** Should have
**Estimate:** Large

## Summary

Add a "local mode" that runs Voxtral Mini 4B Realtime on-device, eliminating the need for a Mistral API key and keeping all audio data fully private. The open-weight model (Apache 2.0) is compact enough (~2.5 GB quantised) to run on laptops, and potentially on modern phones/tablets with NPU acceleration.

## Context

Mistral released [Voxtral-Mini-4B-Realtime-2602](https://huggingface.co/mistralai/Voxtral-Mini-4B-Realtime-2602) under Apache 2.0. Key facts:

- ~4B parameters (~3.4B LM + ~0.6B encoder)
- Q4 GGUF quantisation brings it to ~2.5 GB
- Sliding-window + causal attention → infinite streaming
- Configurable latency: 80 ms – 2.4 s
- At 480 ms delay: within 1-2% WER of the batch model
- Runs in real-time on a single GPU with ≥ 16 GB, or CPU with quantisation

### Existing on-device runtimes

| Runtime | Platform | Notes |
|---------|----------|-------|
| [ExecuTorch](https://github.com/pytorch/executorch/tree/main/examples/models/voxtral) | iOS, Android, macOS, Linux | PyTorch-native; supports CPU, Metal, CUDA, Qualcomm NPU, MediaTek NPU. Android+Voxtral tracked in [pytorch/executorch#15238](https://github.com/pytorch/executorch/issues/15238) |
| [voxtral.c](https://github.com/antirez/voxtral.c) | macOS (Metal), Linux (OpenBLAS) | Pure C, zero dependencies, by antirez |
| [voxtral-mini-realtime-rs](https://github.com/TrevorS/voxtral-mini-realtime-rs) | Native + browser (WebGPU/WASM) | Pure Rust (Burn framework) |
| GGUF via llama.cpp | Cross-platform | Community GGUF quants available |

### Mobile / NPU feasibility

- Mistral claims the model targets "laptops, phones, smartwatches"
- ExecuTorch supports Qualcomm NPU, Apple Neural Engine, MediaTek, ARM backends
- No published mobile NPU benchmarks yet — needs hands-on validation
- Q4 at 2.5 GB fits modern high-end phone RAM; mid-range may be tight

## Proposed approach

### Phase 1: Desktop local mode (Python backend)

1. Add a `local_mode` toggle in settings (UI + config)
2. When enabled, load the GGUF model via a Python binding (e.g. `llama-cpp-python` or `ctransformers`)
3. Replace API WebSocket stream with local inference in `server.py`
4. First-run: prompt user to download the model (~2.5 GB), store in app data dir
5. Auto-detect GPU (CUDA/Metal) and fall back to CPU

### Phase 2: Optimised builds

- Bundle a pre-quantised model with PyInstaller builds (opt-in, increases artifact size)
- Or: separate "local model pack" download from GitHub Releases

### Phase 3: Mobile (future)

- Evaluate ExecuTorch for a native Android/iOS companion app
- Or: explore browser-based inference via WebGPU (voxtral-mini-realtime-rs)

## Acceptance criteria

- [ ] Settings toggle to switch between API mode and local mode
- [ ] Local mode transcribes audio without any network calls
- [ ] Model download flow with progress indicator
- [ ] GPU auto-detection (CUDA, Metal) with CPU fallback
- [ ] Latency and accuracy comparable to API mode at equivalent delay settings
- [ ] Documentation for hardware requirements

## Trade-offs

- **Pro:** Full privacy, no API costs, works offline
- **Con:** Significant increase in complexity; model download size; hardware requirements exclude low-end machines
- **Con:** No diarisation in local mode (realtime model doesn't support it)
- **Con:** Mobile NPU path is immature — ExecuTorch Android support is still in development

## References

- [Voxtral Transcribe 2 announcement](https://mistral.ai/news/voxtral-transcribe-2)
- [HuggingFace model card](https://huggingface.co/mistralai/Voxtral-Mini-4B-Realtime-2602)
- [ExecuTorch Voxtral example](https://github.com/pytorch/executorch/tree/main/examples/models/voxtral)
- [Mistral docs: Voxtral Realtime](https://docs.mistral.ai/models/voxtral-mini-transcribe-realtime-26-02)
