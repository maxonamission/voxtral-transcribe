package io.github.maxonamission.voxtral.keyboard.core

import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class ThermalPolicyTest {

    @Test
    fun unloadsAtSevereAndAbove() {
        assertTrue(ThermalPolicy.shouldUnload(ThermalLevel.SEVERE))
        assertTrue(ThermalPolicy.shouldUnload(ThermalLevel.CRITICAL))
        assertTrue(ThermalPolicy.shouldUnload(ThermalLevel.EMERGENCY))
        assertTrue(ThermalPolicy.shouldUnload(ThermalLevel.SHUTDOWN))
    }

    @Test
    fun keepsRunningBelowSevere() {
        assertFalse(ThermalPolicy.shouldUnload(ThermalLevel.NONE))
        assertFalse(ThermalPolicy.shouldUnload(ThermalLevel.LIGHT))
        assertFalse(ThermalPolicy.shouldUnload(ThermalLevel.MODERATE))
    }

    @Test
    fun lowBatteryWarning() {
        assertTrue(BatteryPolicy.shouldWarnLowBattery(percent = 10, isCharging = false))
        assertTrue(BatteryPolicy.shouldWarnLowBattery(percent = 14, isCharging = false))
        assertFalse(BatteryPolicy.shouldWarnLowBattery(percent = 15, isCharging = false))
        assertFalse(BatteryPolicy.shouldWarnLowBattery(percent = 10, isCharging = true))
    }
}
