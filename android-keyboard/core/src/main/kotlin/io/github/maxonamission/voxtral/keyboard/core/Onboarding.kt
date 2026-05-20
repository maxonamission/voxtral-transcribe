package io.github.maxonamission.voxtral.keyboard.core

enum class OnboardingStep {
    EnableInSettings,
    SelectAsKeyboard,
    GrantMicrophone,
    Ready,
}

data class OnboardingState(
    val imeEnabled: Boolean,
    val imeDefault: Boolean,
    val micPermitted: Boolean,
) {
    val currentStep: OnboardingStep = when {
        !imeEnabled -> OnboardingStep.EnableInSettings
        !imeDefault -> OnboardingStep.SelectAsKeyboard
        !micPermitted -> OnboardingStep.GrantMicrophone
        else -> OnboardingStep.Ready
    }

    val isComplete: Boolean = currentStep == OnboardingStep.Ready
}
