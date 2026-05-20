package io.github.maxonamission.voxtral.keyboard.engine

import android.content.Context
import android.os.Build
import android.os.PowerManager
import io.github.maxonamission.voxtral.keyboard.core.ThermalLevel

/**
 * Maps Android's `PowerManager.THERMAL_STATUS_*` constants onto the
 * deps-free [ThermalLevel] in :core and exposes an idiomatic listener API.
 * Requires API 29+; lower API levels never report SEVERE.
 */
class ThermalMonitor(context: Context) {

    private val powerManager = context.applicationContext.getSystemService(PowerManager::class.java)
    private var androidListener: PowerManager.OnThermalStatusChangedListener? = null

    fun currentLevel(): ThermalLevel {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return ThermalLevel.NONE
        val status = powerManager?.currentThermalStatus ?: PowerManager.THERMAL_STATUS_NONE
        return mapStatus(status)
    }

    fun observe(listener: (ThermalLevel) -> Unit) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return
        val pm = powerManager ?: return
        val l = PowerManager.OnThermalStatusChangedListener { status -> listener(mapStatus(status)) }
        androidListener = l
        pm.addThermalStatusListener(l)
    }

    fun stop() {
        val pm = powerManager ?: return
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return
        androidListener?.let { pm.removeThermalStatusListener(it) }
        androidListener = null
    }

    private fun mapStatus(status: Int): ThermalLevel = when (status) {
        PowerManager.THERMAL_STATUS_NONE -> ThermalLevel.NONE
        PowerManager.THERMAL_STATUS_LIGHT -> ThermalLevel.LIGHT
        PowerManager.THERMAL_STATUS_MODERATE -> ThermalLevel.MODERATE
        PowerManager.THERMAL_STATUS_SEVERE -> ThermalLevel.SEVERE
        PowerManager.THERMAL_STATUS_CRITICAL -> ThermalLevel.CRITICAL
        PowerManager.THERMAL_STATUS_EMERGENCY -> ThermalLevel.EMERGENCY
        PowerManager.THERMAL_STATUS_SHUTDOWN -> ThermalLevel.SHUTDOWN
        else -> ThermalLevel.NONE
    }
}
