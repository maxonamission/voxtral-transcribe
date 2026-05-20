package io.github.maxonamission.voxtral.keyboard.benchmark

import android.content.Context
import androidx.test.platform.app.InstrumentationRegistry
import io.github.maxonamission.voxtral.keyboard.core.VoxtralBackend
import io.github.maxonamission.voxtral.keyboard.core.VoxtralEngine
import io.github.maxonamission.voxtral.keyboard.core.Wer
import io.github.maxonamission.voxtral.keyboard.engine.ExecutorchVoxtralEngine
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import java.io.File

/**
 * On-device benchmark — runs the engine against the bundled audio corpus
 * (see assets/benchmark/manifest.json) and writes a Markdown report.
 *
 * NOT part of regular CI — instrumentation requires an Android device with
 * a downloaded model file. Trigger manually:
 *
 *   adb shell am instrument -w -e class \
 *     io.github.maxonamission.voxtral.keyboard.benchmark.BenchmarkRunnerTest \
 *     io.github.maxonamission.voxtral.keyboard.test/androidx.test.runner.AndroidJUnitRunner
 */
class BenchmarkRunner(
    private val context: Context = InstrumentationRegistry.getInstrumentation().targetContext,
    private val engine: VoxtralEngine = ExecutorchVoxtralEngine(),
) {

    data class SampleResult(
        val id: String,
        val lang: String,
        val backend: VoxtralBackend,
        val reference: String,
        val hypothesis: String,
        val wer: Double,
        val firstTokenMs: Long,
        val totalMs: Long,
    )

    fun run(backend: VoxtralBackend, modelPath: String): List<SampleResult> {
        val manifestJson = context.assets.open("benchmark/manifest.json")
            .bufferedReader().use { it.readText() }
        val manifest = JSONObject(manifestJson)
        val samples = manifest.getJSONArray("samples")
        val results = mutableListOf<SampleResult>()

        runBlocking {
            val loadEvent = engine.load(modelPath, backend)
            check(loadEvent is io.github.maxonamission.voxtral.keyboard.core.EngineEvent.Loaded) {
                "Engine load failed: $loadEvent"
            }
            for (i in 0 until samples.length()) {
                val sample = samples.getJSONObject(i)
                results += runSample(sample, backend)
            }
            engine.unload()
        }
        return results
    }

    private suspend fun runSample(sample: JSONObject, backend: VoxtralBackend): SampleResult {
        val id = sample.getString("id")
        val lang = sample.getString("lang")
        val audioPath = sample.getString("audio")
        val reference = sample.getString("reference")

        val audio = loadWav(audioPath)
        val started = System.nanoTime()
        var firstTokenAt = 0L
        val pieces = StringBuilder()
        engine.feedAudio(audio).toList().forEach { delta ->
            if (firstTokenAt == 0L) firstTokenAt = System.nanoTime() - started
            pieces.append(delta.text)
        }
        val total = System.nanoTime() - started
        val hyp = pieces.toString()

        return SampleResult(
            id = id,
            lang = lang,
            backend = backend,
            reference = reference,
            hypothesis = hyp,
            wer = Wer.wer(reference, hyp),
            firstTokenMs = firstTokenAt / 1_000_000,
            totalMs = total / 1_000_000,
        )
    }

    /**
     * Read a 16 kHz mono PCM WAV asset, return the audio as float32 in [-1, 1].
     * Bare-bones WAV reader — assumes a standard 44-byte header followed by
     * 16-bit PCM samples. Sufficient for the bundled corpus.
     */
    private fun loadWav(assetPath: String): FloatArray {
        return context.assets.open("benchmark/$assetPath").use { input ->
            val header = ByteArray(44)
            check(input.read(header) == 44) { "Truncated WAV header" }
            val pcm = input.readBytes()
            val samples = FloatArray(pcm.size / 2)
            for (i in samples.indices) {
                val lo = pcm[2 * i].toInt() and 0xFF
                val hi = pcm[2 * i + 1].toInt()
                val s = (hi shl 8) or lo
                samples[i] = s.toShort() / 32768f
            }
            samples
        }
    }

    /**
     * Format results as a Markdown report to disk for inspection.
     */
    fun writeReport(results: List<SampleResult>, outFile: File) {
        outFile.parentFile?.mkdirs()
        outFile.writeText(buildString {
            appendLine("# Voxtral on-device benchmark")
            appendLine()
            appendLine("| ID | Lang | Backend | WER | First token (ms) | Total (ms) |")
            appendLine("|----|------|---------|-----|------------------|------------|")
            for (r in results) {
                appendLine("| ${r.id} | ${r.lang} | ${r.backend} | ${"%.3f".format(r.wer)} | ${r.firstTokenMs} | ${r.totalMs} |")
            }
        })
    }
}
