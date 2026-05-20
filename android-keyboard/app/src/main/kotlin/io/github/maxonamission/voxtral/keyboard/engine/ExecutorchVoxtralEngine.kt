package io.github.maxonamission.voxtral.keyboard.engine

import android.util.Log
import io.github.maxonamission.voxtral.keyboard.core.EngineEvent
import io.github.maxonamission.voxtral.keyboard.core.TextDelta
import io.github.maxonamission.voxtral.keyboard.core.VoxtralBackend
import io.github.maxonamission.voxtral.keyboard.core.VoxtralEngine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.File

/**
 * Real on-device Voxtral via `org.pytorch:executorch-android`.
 *
 * **Status**: skeleton — the JNI/Kotlin surface of ExecuTorch is not fully
 * verified in this codebase yet. The bring-up plan:
 *
 *  1. Story 028 produces a downloaded `.pte` artefact on disk.
 *  2. On a real Snapdragon-class device, replace the placeholder calls below
 *     with the actual ExecuTorch Module/Tensor/EValue APIs as documented in
 *     https://github.com/pytorch/executorch/tree/main/examples/models/voxtral
 *  3. Streaming-state management (sliding-window attention, KV-cache) follows
 *     the upstream Voxtral example.
 *
 * Until then [StubVoxtralEngine][io.github.maxonamission.voxtral.keyboard.core.StubVoxtralEngine]
 * is the engine used by the IME so the rest of the pipeline (029, 031) can
 * be built and tested.
 */
class ExecutorchVoxtralEngine : VoxtralEngine {

    private val mutex = Mutex()
    @Volatile private var loaded = false
    @Volatile private var backend: VoxtralBackend = VoxtralBackend.XNNPACK_CPU

    // private var module: org.pytorch.executorch.Module? = null
    // private var streamingState: Any? = null  // model-specific KV cache + window

    override val isLoaded: Boolean get() = loaded

    override suspend fun load(modelPath: String, backend: VoxtralBackend): EngineEvent =
        mutex.withLock {
            withContext(Dispatchers.IO) {
                val file = File(modelPath)
                if (!file.exists()) {
                    return@withContext EngineEvent.Failed("Model file not found: $modelPath")
                }
                val started = System.nanoTime()
                val attempted = tryLoadBackend(file, backend)
                if (attempted is EngineEvent.Loaded) {
                    this@ExecutorchVoxtralEngine.backend = attempted.backend
                    loaded = true
                    val ms = (System.nanoTime() - started) / 1_000_000
                    Log.i(TAG, "ExecuTorch engine loaded — backend=${attempted.backend}, model=${file.name}, loadTimeMs=$ms")
                    return@withContext attempted
                }
                // Requested backend failed — try CPU fallback unless caller already asked for CPU.
                if (backend != VoxtralBackend.XNNPACK_CPU) {
                    Log.w(TAG, "Backend $backend failed, falling back to XNNPACK_CPU")
                    val fallback = tryLoadBackend(file, VoxtralBackend.XNNPACK_CPU)
                    if (fallback is EngineEvent.Loaded) {
                        this@ExecutorchVoxtralEngine.backend = fallback.backend
                        loaded = true
                        val ms = (System.nanoTime() - started) / 1_000_000
                        Log.i(TAG, "ExecuTorch engine loaded (fallback) — backend=${fallback.backend}, loadTimeMs=$ms")
                        return@withContext fallback
                    }
                }
                attempted
            }
        }

    private fun tryLoadBackend(file: File, backend: VoxtralBackend): EngineEvent {
        return try {
            // TODO(device): module = Module.load(file.absolutePath, /* extra_files */ null)
            // TODO(device): bind to the requested backend; QNN delegates need the
            // QNN AAR (executorch-android-qnn 1.1.0 is on the classpath).
            EngineEvent.Loaded(backend)
        } catch (t: Throwable) {
            EngineEvent.Failed("Init $backend failed: ${t.message ?: t::class.simpleName}")
        }
    }

    override fun feedAudio(chunk: FloatArray): Flow<TextDelta> = flow {
        if (!loaded) return@flow
        // TODO(device): convert chunk to ExecuTorch Tensor (1, N) float32
        // TODO(device): call module.forward(EValue.from(tensor), streamingState) etc.
        // TODO(device): tokenizer.decode(logits) → emit TextDelta as they stream
        // Intentionally emit nothing in the skeleton — callers should default
        // to StubVoxtralEngine until this implementation is verified on device.
    }

    override suspend fun unload() = mutex.withLock {
        withContext(Dispatchers.IO) {
            // TODO(device): module?.destroy(); release tokenizer + streaming state
            loaded = false
            Log.i(TAG, "ExecuTorch engine unloaded (skeleton)")
        }
    }

    private companion object {
        const val TAG = "VoxtralExecutorch"
    }
}
