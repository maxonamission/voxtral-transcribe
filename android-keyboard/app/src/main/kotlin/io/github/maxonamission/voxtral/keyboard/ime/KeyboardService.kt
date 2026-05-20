package io.github.maxonamission.voxtral.keyboard.ime

import android.inputmethodservice.InputMethodService
import android.view.LayoutInflater
import android.view.View
import android.view.inputmethod.InputMethodManager
import android.widget.ImageButton
import android.widget.ProgressBar
import android.widget.TextView
import io.github.maxonamission.voxtral.keyboard.R
import io.github.maxonamission.voxtral.keyboard.audio.AudioCapture
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class KeyboardService : InputMethodService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private lateinit var audio: AudioCapture
    private var collectJobs: List<Job> = emptyList()

    private var rootView: View? = null
    private var micButton: ImageButton? = null
    private var levelMeter: ProgressBar? = null
    private var candidateStrip: TextView? = null

    override fun onCreate() {
        super.onCreate()
        audio = AudioCapture(this)
    }

    override fun onCreateInputView(): View {
        val view = LayoutInflater.from(this).inflate(R.layout.keyboard_view, null)
        rootView = view
        candidateStrip = view.findViewById(R.id.candidate_strip)
        levelMeter = view.findViewById(R.id.level_meter)
        micButton = view.findViewById<ImageButton>(R.id.mic_button).apply {
            setOnClickListener { toggleMic() }
        }
        view.findViewById<ImageButton>(R.id.switch_keyboard).setOnClickListener {
            (getSystemService(INPUT_METHOD_SERVICE) as? InputMethodManager)
                ?.showInputMethodPicker()
        }

        collectJobs = listOf(
            scope.launch { audio.level.collect { onLevelChanged(it) } },
            scope.launch { audio.isCapturing.collect { onCapturingChanged(it) } },
        )
        return view
    }

    override fun onFinishInputView(finishingInput: Boolean) {
        super.onFinishInputView(finishingInput)
        audio.stop()
    }

    override fun onDestroy() {
        audio.stop()
        collectJobs.forEach { it.cancel() }
        super.onDestroy()
    }

    private fun toggleMic() {
        if (audio.isCapturing.value) {
            audio.stop()
        } else {
            audio.start()
        }
    }

    private fun onLevelChanged(level: Float) {
        levelMeter?.progress = (level * 1000f).toInt()
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
}
