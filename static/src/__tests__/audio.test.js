import { describe, it, expect } from "vitest";
import { floatTo16BitPCM, downsample } from "../audio.js";

describe("floatTo16BitPCM", () => {
    it("converts silence (zeros) to zero bytes", () => {
        const input = new Float32Array([0, 0, 0]);
        const result = floatTo16BitPCM(input);
        expect(result.length).toBe(6); // 3 samples × 2 bytes
        expect(result.every(b => b === 0)).toBe(true);
    });

    it("converts max positive sample to 0x7FFF", () => {
        const input = new Float32Array([1.0]);
        const result = floatTo16BitPCM(input);
        const view = new DataView(result.buffer);
        expect(view.getInt16(0, true)).toBe(0x7FFF);
    });

    it("converts max negative sample to -0x8000", () => {
        const input = new Float32Array([-1.0]);
        const result = floatTo16BitPCM(input);
        const view = new DataView(result.buffer);
        expect(view.getInt16(0, true)).toBe(-0x8000);
    });

    it("clamps values beyond -1..1 range", () => {
        const input = new Float32Array([2.0, -2.0]);
        const result = floatTo16BitPCM(input);
        const view = new DataView(result.buffer);
        expect(view.getInt16(0, true)).toBe(0x7FFF);
        expect(view.getInt16(2, true)).toBe(-0x8000);
    });

    it("returns correct byte length", () => {
        const input = new Float32Array(100);
        expect(floatTo16BitPCM(input).length).toBe(200);
    });
});

describe("downsample", () => {
    it("returns same buffer when rates are equal", () => {
        const input = new Float32Array([1, 2, 3]);
        const result = downsample(input, 16000, 16000);
        expect(result).toBe(input); // same reference
    });

    it("reduces sample count when downsampling", () => {
        // 48000 → 16000 = 3:1 ratio
        const input = new Float32Array(48000);
        const result = downsample(input, 48000, 16000);
        expect(result.length).toBe(16000);
    });

    it("preserves approximate values", () => {
        // Simple 6-sample signal downsampled 3:1
        const input = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
        const result = downsample(input, 6, 2);
        expect(result.length).toBe(2);
        // Point sampling picks samples at positions 0 and 3
        expect(result[0]).toBeCloseTo(0.1, 5);
        expect(result[1]).toBeCloseTo(0.4, 5);
    });

    it("returns Float32Array", () => {
        const input = new Float32Array(100);
        const result = downsample(input, 48000, 16000);
        expect(result).toBeInstanceOf(Float32Array);
    });
});
