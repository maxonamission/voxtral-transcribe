package io.github.maxonamission.voxtral.keyboard.core

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class OnboardingTest {
    @Test
    fun freshInstall_promptsToEnable() {
        val state = OnboardingState(imeEnabled = false, imeDefault = false, micPermitted = false)
        assertEquals(OnboardingStep.EnableInSettings, state.currentStep)
        assertFalse(state.isComplete)
    }

    @Test
    fun enabledButNotDefault_promptsToSelect() {
        val state = OnboardingState(imeEnabled = true, imeDefault = false, micPermitted = false)
        assertEquals(OnboardingStep.SelectAsKeyboard, state.currentStep)
    }

    @Test
    fun defaultButNoMic_promptsForMic() {
        val state = OnboardingState(imeEnabled = true, imeDefault = true, micPermitted = false)
        assertEquals(OnboardingStep.GrantMicrophone, state.currentStep)
    }

    @Test
    fun allGranted_isReady() {
        val state = OnboardingState(imeEnabled = true, imeDefault = true, micPermitted = true)
        assertEquals(OnboardingStep.Ready, state.currentStep)
        assertTrue(state.isComplete)
    }

    @Test
    fun stepsAreSequential_micDoesNotShortCircuit() {
        // Mic permission granted but IME not yet enabled: must still go through enable step
        val state = OnboardingState(imeEnabled = false, imeDefault = false, micPermitted = true)
        assertEquals(OnboardingStep.EnableInSettings, state.currentStep)
    }
}
