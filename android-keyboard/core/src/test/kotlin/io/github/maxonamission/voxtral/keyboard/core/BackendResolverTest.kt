package io.github.maxonamission.voxtral.keyboard.core

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class BackendResolverTest {

    @Test
    fun forceCpuIgnoresNpu() {
        assertEquals(VoxtralBackend.XNNPACK_CPU, BackendResolver.resolve(BackendPreference.FORCE_CPU, npuAvailable = true))
        assertEquals(VoxtralBackend.XNNPACK_CPU, BackendResolver.resolve(BackendPreference.FORCE_CPU, npuAvailable = false))
    }

    @Test
    fun forceNpuIgnoresAvailability() {
        // FORCE_NPU is honoured even when hardware lacks it — the engine will
        // catch the failure and the user sees a clear error rather than silent
        // CPU fallback that masks the user's preference.
        assertEquals(VoxtralBackend.QNN_NPU, BackendResolver.resolve(BackendPreference.FORCE_NPU, npuAvailable = true))
        assertEquals(VoxtralBackend.QNN_NPU, BackendResolver.resolve(BackendPreference.FORCE_NPU, npuAvailable = false))
    }

    @Test
    fun autoUsesNpuWhenAvailable() {
        assertEquals(VoxtralBackend.QNN_NPU, BackendResolver.resolve(BackendPreference.AUTO, npuAvailable = true))
    }

    @Test
    fun autoFallsBackToCpu() {
        assertEquals(VoxtralBackend.XNNPACK_CPU, BackendResolver.resolve(BackendPreference.AUTO, npuAvailable = false))
    }
}
