package io.github.maxonamission.voxtral.keyboard.ime

import android.inputmethodservice.InputMethodService
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.inputmethod.InputMethodManager
import android.widget.ImageButton
import android.widget.ProgressBar
import android.widget.TextView
import io.github.maxonamission.voxtral.keyboard.R
import io.github.maxonamission.voxtral.keyboard.audio.AudioCapture
import io.github.maxonamission.voxtral.keyboard.core.BackendPreference
import io.github.maxonamission.voxtral.keyboard.core.BackendResolver
import io.github.maxonamission.voxtral.keyboard.core.CommitEvent
import io.github.maxonamission.voxtral.keyboard.core.StubVoxtralEngine
import io.github.maxonamission.voxtral.keyboard.core.TranscriptionPipeline
import io.github.maxonamission.voxtral.keyboard.core.TranscriptionState
import io.github.maxonamission.voxtral.keyboard.core.VoxtralBackend
import io.github.maxonamission.voxtral.keyboard.core.VoxtralEngine
import io.github.maxonamission.voxtral.keyboard.engine.BackendDetector
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

class KeyboardService : InputMethodService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val pipelineScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private lateinit var audio: AudioCapture
    private lateinit var engine: VoxtralEngine
    private var pipeline: TranscriptionPipeline? = null
    private var collectJobs: List<Job> = emptyList()

    private var rootView: View? = null
    private var micButton: ImageButton? = null
    private var levelMeter: ProgressBar? = null
    private var candidateStrip: TextView? = null
    private var statusBackend: TextView? = null

    private var resolvedBackend: VoxtralBackend = VoxtralBackend.XNNPACK_CPU

    override fun onCreate() {
        super.onCreate()
        audio = AudioCapture(this)
        resolvedBackend = BackendResolver.resolve(
            preference = BackendPreference.AUTO, // tied to settings in 033
            npuAvailable = BackendDetector.npuAvailable(),
        )
        // Default to StubVoxtralEngine while the ExecuTorch JNI wiring (027)
        // is still device-only. Switch via build flavor / setting (033).
        engine = StubVoxtralEngine()
        scope.launch { engine.load(modelPath = "stub", backend = resolvedBackend) }
    }

    override fun onCreateInputView(): View {
        val view = LayoutInflater.from(this).inflate(R.layout.keyboard_view, null)
        rootView = view
        candidateStrip = view.findViewById(R.id.candidate_strip)
        levelMeter = view.findViewById(R.id.level_meter)
        statusBackend = view.findViewById<TextView>(R.id.status_backend).also {
            it.text = when (resolvedBackend) {
                VoxtralBackend.QNN_NPU -> "NPU"
                VoxtralBackend.XNNPACK_CPU -> "CPU"
            }
        }
        micButton = view.findViewById<ImageButton>(R.id.mic_button).apply {
            setOnClickListener { toggleMic() }
        }
        view.findViewById<ImageButton>(R.id.switch_keyboard).setOnClickListener {
            (getSystemService(INPUT_METHOD_SERVICE) as? InputMethodManager)
                ?.showInputMethodPicker()
        }

        val pipeline = TranscriptionPipeline(
            scope = pipelineScope,
            engine = engine,
            audio = audio.audio,
            level = audio.level,
        )
        this.pipeline = pipeline

        collectJobs = listOf(
            scope.launch { audio.isCapturing.collect { onCapturingChanged(it) } },
            scope.launch { pipeline.state.collect { onTranscriptionState(it) } },
            scope.launch { pipeline.commits.collect { onCommit(it) } },
        )
        return view
    }

    override fun onFinishInputView(finishingInput: Boolean) {
        super.onFinishInputView(finishingInput)
        pipeline?.stop()
        audio.stop()
    }

    override fun onDestroy() {
        pipeline?.stop()
        audio.stop()
        collectJobs.forEach { it.cancel() }
        pipelineScope.cancel()
        scope.cancel()
        super.onDestroy()
    }

    private fun toggleMic() {
        if (audio.isCapturing.value) {
            pipeline?.stop()
            audio.stop()
        } else {
            audio.start()
            pipeline?.start()
        }
    }

    private fun onTranscriptionState(state: TranscriptionState) {
        levelMeter?.progress = (state.level * 1000f).toInt()
        if (state.preliminary.isNotEmpty()) {
            candidateStrip?.text = state.preliminary
        }
    }

    private fun onCommit(event: CommitEvent) {
        // 031 will wire this to InputConnection.commitText(). For 029 we just log
        // and clear the candidate strip so the user can see committed text moving on.
        Log.i(TAG, "commit: ${event.text}")
        candidateStrip?.setText(R.string.candidate_placeholder)
    }

    private fun onCapturingChanged(capturing: Boolean) {
        val button = micButton ?: return
        if (capturing) {
            button.setBackgroundResource(R.drawable.mic_button_listening)
            button.contentDescription = getString(R.string.mic_listening_content_description)
            candidateStrip?.text = ""
        } else {
            button.setBackgroundResource(R.drawable.mic_button_idle)
            button.contentDescription = getString(R.string.mic_idle_content_description)
            candidateStrip?.setText(R.string.candidate_placeholder)
            levelMeter?.progress = 0
        }
    }

    private companion object {
        const val TAG = "VoxtralIME"
    }
}
