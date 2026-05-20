package io.github.maxonamission.voxtral.keyboard.onboarding

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.provider.Settings
import android.view.inputmethod.InputMethodManager
import androidx.core.content.ContextCompat
import io.github.maxonamission.voxtral.keyboard.core.OnboardingState

object IMEStatus {

    fun isEnabled(context: Context): Boolean {
        val imm = context.getSystemService(InputMethodManager::class.java) ?: return false
        val pkg = context.packageName
        return imm.enabledInputMethodList.any { it.packageName == pkg }
    }

    fun isDefault(context: Context): Boolean {
        val defaultIme = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.DEFAULT_INPUT_METHOD,
        ) ?: return false
        return defaultIme.startsWith("${context.packageName}/")
    }

    fun hasMicPermission(context: Context): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.RECORD_AUDIO,
        ) == PackageManager.PERMISSION_GRANTED
    }

    fun snapshot(context: Context): OnboardingState = OnboardingState(
        imeEnabled = isEnabled(context),
        imeDefault = isDefault(context),
        micPermitted = hasMicPermission(context),
    )
}
