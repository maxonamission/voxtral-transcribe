package io.github.maxonamission.voxtral.keyboard.core

/**
 * User preference for which engine backend to use. The resolver in :app
 * combines this with hardware detection to pick the actual [VoxtralBackend].
 */
enum class BackendPreference { AUTO, FORCE_NPU, FORCE_CPU }

/**
 * Pure logic for resolving a preference against detected hardware. Lives in
 * :core so it can be unit-tested independently of Android Build constants.
 */
object BackendResolver {
    fun resolve(preference: BackendPreference, npuAvailable: Boolean): VoxtralBackend = when (preference) {
        BackendPreference.FORCE_CPU -> VoxtralBackend.XNNPACK_CPU
        BackendPreference.FORCE_NPU -> VoxtralBackend.QNN_NPU
        BackendPreference.AUTO -> if (npuAvailable) VoxtralBackend.QNN_NPU else VoxtralBackend.XNNPACK_CPU
    }
}
