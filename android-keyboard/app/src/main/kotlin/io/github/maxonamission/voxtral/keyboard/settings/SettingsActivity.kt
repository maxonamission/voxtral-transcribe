package io.github.maxonamission.voxtral.keyboard.settings

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import io.github.maxonamission.voxtral.keyboard.core.BackendPreference
import io.github.maxonamission.voxtral.keyboard.model.ModelRegistry
import io.github.maxonamission.voxtral.keyboard.model.ModelStorage
import kotlinx.coroutines.launch

class SettingsActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    SettingsScreen()
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SettingsScreen() {
    val context = LocalContext.current
    val repo = remember { SettingsRepository(context) }
    val storage = remember { ModelStorage(context) }
    val settings by repo.settings.collectAsState(initial = VoxtralSettings())
    val scope = rememberCoroutineScope()
    val manifest = ModelRegistry.active

    Scaffold(topBar = { TopAppBar(title = { Text("Voxtral Voice instellingen") }) }) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .padding(16.dp)
                .fillMaxSize()
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {

            Section("Taal") {
                ChoiceRow(
                    options = SettingsRepository.SUPPORTED_LANGUAGES,
                    selected = settings.language,
                    label = { it.uppercase() },
                    onSelect = { scope.launch { repo.setLanguage(it) } },
                )
            }

            Section("Backend") {
                ChoiceRow(
                    options = BackendPreference.values().toList(),
                    selected = settings.backendPreference,
                    label = { it.name.replace('_', ' ') },
                    onSelect = { scope.launch { repo.setBackend(it) } },
                )
            }

            Section("Microfoon-trigger") {
                ChoiceRow(
                    options = MicTrigger.values().toList(),
                    selected = settings.micTrigger,
                    label = { if (it == MicTrigger.TAP) "Tap (toggle)" else "Push (vasthouden)" },
                    onSelect = { scope.launch { repo.setMicTrigger(it) } },
                )
            }

            Section("Streaming delay (ms)") {
                ChoiceRow(
                    options = SettingsRepository.STREAMING_DELAYS_MS,
                    selected = settings.streamingDelayMs,
                    label = { "$it" },
                    onSelect = { scope.launch { repo.setStreamingDelayMs(it) } },
                )
            }

            Section("Model") {
                var deleted by remember { mutableStateOf(false) }
                val present = storage.isPresent(manifest)
                val sizeMb = (storage.finalFile(manifest).length() / 1_000_000)
                Text(
                    when {
                        deleted -> "Model verwijderd. Heropen de Voxtral-app om opnieuw te downloaden."
                        present -> "${manifest.displayName} — $sizeMb MB"
                        else -> "${manifest.displayName} — nog niet gedownload"
                    },
                    style = MaterialTheme.typography.bodyMedium,
                )
                if (present && !deleted) {
                    Button(onClick = {
                        storage.delete(manifest)
                        deleted = true
                    }) { Text("Verwijder model") }
                }
            }
        }
    }
}

@Composable
private fun Section(title: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, style = MaterialTheme.typography.titleMedium)
        content()
    }
}

@Composable
private fun <T> ChoiceRow(
    options: List<T>,
    selected: T,
    label: (T) -> String,
    onSelect: (T) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        options.forEach { option ->
            if (option == selected) {
                Button(onClick = { onSelect(option) }) { Text(label(option)) }
            } else {
                OutlinedButton(onClick = { onSelect(option) }) { Text(label(option)) }
            }
        }
    }
}
