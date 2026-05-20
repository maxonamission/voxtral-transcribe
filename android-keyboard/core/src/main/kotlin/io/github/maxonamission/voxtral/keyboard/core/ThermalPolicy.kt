package io.github.maxonamission.voxtral.keyboard.core

/**
 * Thermal severity levels normalised across Android versions.
 * Mirrors `PowerManager.THERMAL_STATUS_*` but free of Android deps.
 */
enum class ThermalLevel { NONE, LIGHT, MODERATE, SEVERE, CRITICAL, EMERGENCY, SHUTDOWN }

object ThermalPolicy {
    /**
     * Decide whether to unload the engine to stop adding heat. We unload at
     * SEVERE and above — leaves headroom for the user's primary tasks
     * (phone/maps/etc.) before the system starts throttling them.
     */
    fun shouldUnload(level: ThermalLevel): Boolean = when (level) {
        ThermalLevel.NONE, ThermalLevel.LIGHT, ThermalLevel.MODERATE -> false
        ThermalLevel.SEVERE, ThermalLevel.CRITICAL, ThermalLevel.EMERGENCY, ThermalLevel.SHUTDOWN -> true
    }
}

object BatteryPolicy {
    /**
     * Warn the user when battery is below 15% and the device isn't charging.
     * Stays a soft warning — the user can still dictate. (Hard blocking would
     * be paternalistic and quickly annoying.)
     */
    fun shouldWarnLowBattery(percent: Int, isCharging: Boolean): Boolean =
        !isCharging && percent in 0..14
}
