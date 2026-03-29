// Voxtral Transcribe — Copyright (c) 2026 Max Kloosterman
// Licensed under GPL-3.0 — see LICENSE for details
// https://github.com/maxonamission/voxtral-transcribe

/**
 * Audio processing utilities for recording and streaming.
 * Pure functions — no DOM or global state dependencies.
 */

/**
 * Convert Float32Array audio samples to 16-bit PCM (little-endian).
 * Used for sending audio to the Voxtral realtime API.
 *
 * @param {Float32Array} float32Array — audio samples in -1..1 range
 * @returns {Uint8Array} PCM s16le encoded audio
 */
export function floatTo16BitPCM(float32Array) {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
        let s = Math.max(-1, Math.min(1, float32Array[i]));
        view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return new Uint8Array(buffer);
}

/**
 * Downsample audio buffer from one sample rate to another.
 * Simple point-sampling (no interpolation — sufficient for speech).
 *
 * @param {Float32Array} buffer — source audio samples
 * @param {number} fromRate — source sample rate (e.g. 48000)
 * @param {number} toRate — target sample rate (e.g. 16000)
 * @returns {Float32Array} downsampled audio
 */
export function downsample(buffer, fromRate, toRate) {
    if (fromRate === toRate) return buffer;
    const ratio = fromRate / toRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
        result[i] = buffer[Math.round(i * ratio)];
    }
    return result;
}
