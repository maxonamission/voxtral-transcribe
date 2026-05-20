package io.github.maxonamission.voxtral.keyboard.audio

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import androidx.core.content.ContextCompat
import io.github.maxonamission.voxtral.keyboard.core.AudioLevel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlin.math.max

/**
 * Captures 16 kHz mono PCM audio and exposes a smoothed level in [0f, 1f].
 *
 * Stream of PCM chunks to a transcription engine comes in story 029; for now
 * this class only feeds the UI level meter.
 */
class AudioCapture(private val context: Context) {

    companion object {
        const val SAMPLE_RATE_HZ = 16_000
        private val CHANNEL = AudioFormat.CHANNEL_IN_MONO
        private val ENCODING = AudioFormat.ENCODING_PCM_16BIT
        private const val LEVEL_SMOOTH_ALPHA = 0.3f
    }

    private val _level = MutableStateFlow(0f)
    val level: StateFlow<Float> = _level

    private val _isCapturing = MutableStateFlow(false)
    val isCapturing: StateFlow<Boolean> = _isCapturing

    private var record: AudioRecord? = null
    private var job: Job? = null
    private val scope = CoroutineScope(Dispatchers.Default)

    @SuppressLint("MissingPermission")
    fun start() {
        if (_isCapturing.value) return
        if (!hasMicPermission()) return

        val minBuffer = AudioRecord.getMinBufferSize(SAMPLE_RATE_HZ, CHANNEL, ENCODING)
        val bufferBytes = max(minBuffer, SAMPLE_RATE_HZ / 10 * 2) // ~100 ms
        val rec = AudioRecord(
            MediaRecorder.AudioSource.VOICE_RECOGNITION,
            SAMPLE_RATE_HZ,
            CHANNEL,
            ENCODING,
            bufferBytes,
        )
        if (rec.state != AudioRecord.STATE_INITIALIZED) {
            rec.release()
            return
        }
        record = rec
        rec.startRecording()
        _isCapturing.value = true

        val samples = ShortArray(bufferBytes / 2)
        job = scope.launch {
            var smoothed = 0f
            while (_isCapturing.value) {
                val read = rec.read(samples, 0, samples.size)
                if (read <= 0) continue
                val rms = AudioLevel.rmsInt16(samples, read)
                smoothed = AudioLevel.smooth(smoothed, rms, LEVEL_SMOOTH_ALPHA)
                _level.value = smoothed
            }
        }
    }

    fun stop() {
        if (!_isCapturing.value) return
        _isCapturing.value = false
        job?.cancel()
        job = null
        record?.let {
            try {
                it.stop()
            } catch (_: IllegalStateException) {
                // already stopped
            }
            it.release()
        }
        record = null
        _level.value = 0f
    }

    private fun hasMicPermission(): Boolean = ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.RECORD_AUDIO,
    ) == PackageManager.PERMISSION_GRANTED
}
