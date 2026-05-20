package io.github.maxonamission.voxtral.keyboard.ime

import android.content.Intent
import android.inputmethodservice.InputMethodService
import android.text.InputType
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.ImageButton
import android.widget.ProgressBar
import android.widget.TextView
import io.github.maxonamission.voxtral.keyboard.R
import io.github.maxonamission.voxtral.keyboard.audio.AudioCapture
import io.github.maxonamission.voxtral.keyboard.core.BackendPreference
import io.github.maxonamission.voxtral.keyboard.core.BackendResolver
import io.github.maxonamission.voxtral.keyboard.core.CommandMatcher
import io.github.maxonamission.voxtral.keyboard.core.CommitEvent
import io.github.maxonamission.voxtral.keyboard.core.VoiceCommand
import io.github.maxonamission.voxtral.keyboard.core.StubVoxtralEngine
import io.github.maxonamission.voxtral.keyboard.core.TranscriptionPipeline
import io.github.maxonamission.voxtral.keyboard.core.TranscriptionState
import io.github.maxonamission.voxtral.keyboard.core.VoxtralBackend
import io.github.maxonamission.voxtral.keyboard.core.VoxtralEngine
import io.github.maxonamission.voxtral.keyboard.engine.BackendDetector
import io.github.maxonamission.voxtral.keyboard.settings.SettingsActivity
import io.github.maxonamission.voxtral.keyboard.settings.SettingsRepository
import io.github.maxonamission.voxtral.keyboard.settings.VoxtralSettings
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
    private var lastPreliminary: String = ""
    private var isSensitiveField: Boolean = false
    @Volatile private var commandMatcher = CommandMatcher(language = "nl")
    private lateinit var settingsRepo: SettingsRepository

    override fun onCreate() {
        super.onCreate()
        audio = AudioCapture(this)
        settingsRepo = SettingsRepository(this)
        // Default to StubVoxtralEngine while the ExecuTorch JNI wiring (027)
        // is still device-only. Switch via build flavor when 027 is real.
        engine = StubVoxtralEngine()
        scope.launch { engine.load(modelPath = "stub", backend = resolvedBackend) }
        scope.launch { settingsRepo.settings.collect(::applySettings) }
    }

    private fun applySettings(s: VoxtralSettings) {
        commandMatcher = CommandMatcher(language = s.language)
        val newBackend = BackendResolver.resolve(s.backendPreference, BackendDetector.npuAvailable())
        if (newBackend != resolvedBackend) {
            resolvedBackend = newBackend
            statusBackend?.text = when (resolvedBackend) {
                VoxtralBackend.QNN_NPU -> "NPU"
                VoxtralBackend.XNNPACK_CPU -> "CPU"
            }
        }
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
            setOnLongClickListener {
                openSettings()
                true
            }
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

    override fun onStartInput(attribute: EditorInfo?, restarting: Boolean) {
        super.onStartInput(attribute, restarting)
        isSensitiveField = attribute?.let(::isSensitiveInputType) ?: false
        applySensitivityToUi()
    }

    override fun onFinishInputView(finishingInput: Boolean) {
        super.onFinishInputView(finishingInput)
        pipeline?.stop()
        audio.stop()
        finishComposingIfNeeded()
    }

    override fun onFinishInput() {
        super.onFinishInput()
        finishComposingIfNeeded()
        lastPreliminary = ""
        isSensitiveField = false
    }

    override fun onDestroy() {
        pipeline?.stop()
        audio.stop()
        collectJobs.forEach { it.cancel() }
        pipelineScope.cancel()
        scope.cancel()
        super.onDestroy()
    }

    private fun openSettings() {
        val intent = Intent(this, SettingsActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        startActivity(intent)
    }

    private fun toggleMic() {
        if (isSensitiveField) return
        if (audio.isCapturing.value) {
            pipeline?.stop()
            audio.stop()
            finishComposingIfNeeded()
        } else {
            audio.start()
            pipeline?.start()
        }
    }

    private fun onTranscriptionState(state: TranscriptionState) {
        levelMeter?.progress = (state.level * 1000f).toInt()
        if (state.preliminary == lastPreliminary) return

        if (state.preliminary.isEmpty()) {
            finishComposingIfNeeded()
            candidateStrip?.setText(R.string.candidate_placeholder)
        } else {
            currentInputConnection?.setComposingText(state.preliminary, 1)
            candidateStrip?.text = state.preliminary
            lastPreliminary = state.preliminary
        }
    }

    private fun onCommit(event: CommitEvent) {
        val ic = currentInputConnection ?: return
        ic.finishComposingText()
        lastPreliminary = ""

        val match = commandMatcher.match(event.text)
        if (match != null) {
            if (match.residual.isNotEmpty()) {
                ic.commitText(match.residual, 1)
            }
            executeCommand(match.command)
        } else {
            ic.commitText(event.text, 1)
        }
        candidateStrip?.setText(R.string.candidate_placeholder)
        Log.i(TAG, "commit: ${event.text}${if (match != null) " [cmd=${match.command}]" else ""}")
    }

    private fun executeCommand(command: VoiceCommand) {
        val ic = currentInputConnection ?: return
        when (command) {
            VoiceCommand.NEW_PARAGRAPH -> ic.commitText("\n\n", 1)
            VoiceCommand.NEW_LINE -> ic.commitText("\n", 1)
            VoiceCommand.UNDO -> ic.performContextMenuAction(android.R.id.undo)
            VoiceCommand.STOP_RECORDING -> {
                pipeline?.stop()
                audio.stop()
            }
        }
    }

    private fun finishComposingIfNeeded() {
        if (lastPreliminary.isNotEmpty()) {
            currentInputConnection?.finishComposingText()
            lastPreliminary = ""
        }
    }

    private fun applySensitivityToUi() {
        val button = micButton ?: return
        if (isSensitiveField) {
            button.alpha = 0.4f
            button.contentDescription = getString(R.string.status_no_mic_permission)
            candidateStrip?.setText(R.string.status_no_mic_permission)
        } else {
            button.alpha = 1f
            button.contentDescription = getString(R.string.mic_idle_content_description)
            candidateStrip?.setText(R.string.candidate_placeholder)
        }
    }

    private fun isSensitiveInputType(info: EditorInfo): Boolean {
        val inputType = info.inputType
        val cls = inputType and InputType.TYPE_MASK_CLASS
        val variation = inputType and InputType.TYPE_MASK_VARIATION
        return when {
            cls == InputType.TYPE_CLASS_TEXT && (
                variation == InputType.TYPE_TEXT_VARIATION_PASSWORD ||
                    variation == InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD ||
                    variation == InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD
                ) -> true
            cls == InputType.TYPE_CLASS_NUMBER &&
                variation == InputType.TYPE_NUMBER_VARIATION_PASSWORD -> true
            else -> false
        }
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
