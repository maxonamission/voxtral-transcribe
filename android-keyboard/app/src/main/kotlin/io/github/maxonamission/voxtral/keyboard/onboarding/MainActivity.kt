package io.github.maxonamission.voxtral.keyboard.onboarding

import android.Manifest
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.view.inputmethod.InputMethodManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    OnboardingScreen()
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun OnboardingScreen() {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    var state by remember { mutableStateOf(IMEStatus.snapshot(context)) }
    var permissionDeniedPermanently by remember { mutableStateOf(false) }

    // Re-check status whenever this screen becomes visible (returning from Settings, etc.).
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                state = IMEStatus.snapshot(context)
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
    ) { granted ->
        state = IMEStatus.snapshot(context)
        val activity = context.findActivity()
        if (!granted && activity != null && !activity.shouldShowRequestPermissionRationale(
                Manifest.permission.RECORD_AUDIO,
            )
        ) {
            permissionDeniedPermanently = true
        }
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Voxtral Voice") }) },
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .padding(16.dp)
                .fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Drie stappen tot dicteren:", style = MaterialTheme.typography.titleMedium)

            StepRow(
                index = 1,
                title = "Activeer Voxtral Voice in Instellingen",
                done = state.imeEnabled,
                actionLabel = if (state.imeEnabled) "Klaar" else "Open instellingen",
                enabled = !state.imeEnabled,
                onClick = { openInputMethodSettings(context) },
            )

            StepRow(
                index = 2,
                title = "Kies Voxtral Voice als toetsenbord",
                done = state.imeDefault,
                actionLabel = if (state.imeDefault) "Klaar" else "Kies toetsenbord",
                enabled = state.imeEnabled && !state.imeDefault,
                onClick = { showInputMethodPicker(context) },
            )

            StepRow(
                index = 3,
                title = "Geef toegang tot de microfoon",
                done = state.micPermitted,
                actionLabel = if (state.micPermitted) "Klaar" else "Vraag toegang",
                enabled = !state.micPermitted,
                onClick = {
                    if (permissionDeniedPermanently) {
                        openAppDetailsSettings(context)
                    } else {
                        permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                    }
                },
            )

            if (permissionDeniedPermanently && !state.micPermitted) {
                Text(
                    "Microfoontoegang is geweigerd. Open de app-instellingen om dit alsnog toe te staan.",
                    style = MaterialTheme.typography.bodyMedium,
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            if (state.isComplete) {
                ModelDownloadSection()

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    "Klaar — probeer Voxtral Voice hieronder:",
                    style = MaterialTheme.typography.titleMedium,
                )
                var test by remember { mutableStateOf("") }
                OutlinedTextField(
                    value = test,
                    onValueChange = { test = it },
                    label = { Text("Test-veld") },
                    modifier = Modifier.fillMaxSize(),
                )
            }
        }
    }

    // Trigger one refresh after first composition in case state changed while compose was setting up
    LaunchedEffect(Unit) { state = IMEStatus.snapshot(context) }
}

@Composable
private fun StepRow(
    index: Int,
    title: String,
    done: Boolean,
    actionLabel: String,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            text = "${if (done) "✓" else "$index."} $title",
            style = MaterialTheme.typography.titleSmall,
        )
        Button(onClick = onClick, enabled = enabled) {
            Text(actionLabel)
        }
    }
}

private fun openInputMethodSettings(context: Context) {
    context.startActivity(
        Intent(Settings.ACTION_INPUT_METHOD_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
    )
}

private fun showInputMethodPicker(context: Context) {
    val imm = context.getSystemService(InputMethodManager::class.java)
    imm?.showInputMethodPicker()
}

private fun openAppDetailsSettings(context: Context) {
    val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
        data = Uri.fromParts("package", context.packageName, null)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    context.startActivity(intent)
}

private tailrec fun Context.findActivity(): android.app.Activity? = when (this) {
    is android.app.Activity -> this
    is android.content.ContextWrapper -> baseContext.findActivity()
    else -> null
}
