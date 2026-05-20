package io.github.maxonamission.voxtral.keyboard.settings

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import io.github.maxonamission.voxtral.keyboard.core.BackendPreference
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "voxtral_settings")

enum class MicTrigger { TAP, PUSH }

data class VoxtralSettings(
    val language: String = "nl",
    val backendPreference: BackendPreference = BackendPreference.AUTO,
    val micTrigger: MicTrigger = MicTrigger.TAP,
    val streamingDelayMs: Int = 480,
)

class SettingsRepository(context: Context) {

    private val store = context.applicationContext.dataStore

    val settings: Flow<VoxtralSettings> = store.data.map { it.toSettings() }

    suspend fun setLanguage(value: String) = update { it[LANGUAGE] = value }
    suspend fun setBackend(value: BackendPreference) = update { it[BACKEND] = value.name }
    suspend fun setMicTrigger(value: MicTrigger) = update { it[MIC_TRIGGER] = value.name }
    suspend fun setStreamingDelayMs(value: Int) = update { it[STREAMING_DELAY_MS] = value }

    private suspend inline fun update(crossinline block: (androidx.datastore.preferences.core.MutablePreferences) -> Unit) {
        store.edit { block(it) }
    }

    private fun Preferences.toSettings(): VoxtralSettings = VoxtralSettings(
        language = this[LANGUAGE] ?: "nl",
        backendPreference = this[BACKEND]?.let { runCatching { BackendPreference.valueOf(it) }.getOrNull() }
            ?: BackendPreference.AUTO,
        micTrigger = this[MIC_TRIGGER]?.let { runCatching { MicTrigger.valueOf(it) }.getOrNull() }
            ?: MicTrigger.TAP,
        streamingDelayMs = this[STREAMING_DELAY_MS] ?: 480,
    )

    companion object {
        private val LANGUAGE = stringPreferencesKey("language")
        private val BACKEND = stringPreferencesKey("backend_preference")
        private val MIC_TRIGGER = stringPreferencesKey("mic_trigger")
        private val STREAMING_DELAY_MS = intPreferencesKey("streaming_delay_ms")

        val SUPPORTED_LANGUAGES = listOf("nl", "en")
        val STREAMING_DELAYS_MS = listOf(240, 480, 1000, 2400)
    }
}
