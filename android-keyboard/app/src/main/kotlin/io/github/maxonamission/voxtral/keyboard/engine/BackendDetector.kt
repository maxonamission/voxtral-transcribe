package io.github.maxonamission.voxtral.keyboard.engine

import android.os.Build

/**
 * Hardware detection for the on-device NPU. Returns true when the SoC is a
 * Qualcomm Snapdragon (carrier of the QNN NPU we target).
 *
 * Note: this is a necessary but not sufficient condition — even on Snapdragon,
 * the actual ExecuTorch QNN runtime may fail to initialise on a specific
 * device. The engine layer catches that and falls back to XNNPACK CPU.
 */
object BackendDetector {

    fun npuAvailable(): Boolean = isQualcommSoC()

    private fun isQualcommSoC(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Android 12+ exposes SOC fields reliably.
            val manufacturer = Build.SOC_MANUFACTURER.orEmpty().lowercase()
            if (manufacturer == "qti" || manufacturer == "qualcomm") return true
        }
        val hardware = Build.HARDWARE.orEmpty().lowercase()
        val board = Build.BOARD.orEmpty().lowercase()
        return hardware.contains("qcom") || board.contains("msm") || board.contains("sdm") || board.contains("sm8")
    }
}
