package io.github.maxonamission.voxtral.keyboard.onboarding

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Button
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import io.github.maxonamission.voxtral.keyboard.core.ModelStatus
import io.github.maxonamission.voxtral.keyboard.model.ModelDownloader
import io.github.maxonamission.voxtral.keyboard.model.ModelRegistry
import io.github.maxonamission.voxtral.keyboard.model.ModelStorage
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch

@Composable
fun ModelDownloadSection(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val manifest = ModelRegistry.active
    val storage = remember { ModelStorage(context) }
    val downloader = remember { ModelDownloader(context) }
    val scope = rememberCoroutineScope()

    val statusFlow = remember {
        MutableStateFlow<ModelStatus>(
            if (storage.isPresent(manifest)) ModelStatus.Ready else ModelStatus.NotDownloaded,
        )
    }
    val status by statusFlow.collectAsState()
    var job by remember { mutableStateOf<Job?>(null) }

    fun start() {
        if (job?.isActive == true) return
        job = scope.launch {
            downloader.download(manifest).collect { statusFlow.value = it }
        }
    }

    fun cancel() {
        job?.cancel()
        job = null
        statusFlow.value =
            if (storage.isPresent(manifest)) ModelStatus.Ready else ModelStatus.NotDownloaded
    }

    LaunchedEffect(Unit) {
        // Re-check on entry — file might have been added by another launch.
        statusFlow.value =
            if (storage.isPresent(manifest)) ModelStatus.Ready else ModelStatus.NotDownloaded
    }

    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            "4. Download het Voxtral-model (${manifest.sizeBytes / 1_000_000} MB)",
            style = MaterialTheme.typography.titleSmall,
        )
        when (val s = status) {
            ModelStatus.NotDownloaded -> {
                Button(onClick = ::start) { Text("Download") }
            }
            is ModelStatus.Downloading -> {
                LinearProgressIndicator(
                    progress = { s.percent / 100f },
                    modifier = Modifier.fillMaxWidth(),
                )
                val mbDone = s.bytesDownloaded / 1_000_000
                val mbTotal = s.totalBytes / 1_000_000
                val speedMbps = "%.1f".format(s.bytesPerSecond / 1_000_000.0)
                val eta = s.secondsRemaining?.let { "${it / 60}m ${it % 60}s" } ?: "—"
                Text("$mbDone / $mbTotal MB · $speedMbps MB/s · ETA $eta")
                Button(onClick = ::cancel) { Text("Pauzeer") }
            }
            ModelStatus.Verifying -> {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                Text("Model controleren…")
            }
            ModelStatus.Ready -> {
                Text("✓ Klaar — model gereed (${storage.finalFile(manifest).length() / 1_000_000} MB)")
            }
            is ModelStatus.Failed -> {
                Text("✗ ${s.reason}", style = MaterialTheme.typography.bodyMedium)
                Button(onClick = ::start) { Text("Probeer opnieuw") }
            }
        }
    }
}
