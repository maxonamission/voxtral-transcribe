package io.github.maxonamission.voxtral.keyboard.ime

import android.inputmethodservice.InputMethodService
import android.view.LayoutInflater
import android.view.View
import android.widget.Button
import io.github.maxonamission.voxtral.keyboard.R

class KeyboardService : InputMethodService() {

    override fun onCreateInputView(): View {
        val view = LayoutInflater.from(this).inflate(R.layout.keyboard_view, null)
        view.findViewById<Button>(R.id.smoke_button).setOnClickListener {
            currentInputConnection?.commitText("voxtral", 1)
        }
        return view
    }
}
