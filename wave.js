// wave.js - Represents a sinusoidal component for defining puzzle piece cuts.

// Clamped values for amplitude and period as suggested by DESIGN.md
const MIN_AMPLITUDE = 0.01; // in board units
const MAX_AMPLITUDE = 0.05; // in board units
const MIN_PERIOD = 1.0;     // in board units (number of times the wave repeats over a unit length)
const MAX_PERIOD = 20.0;    // in board units

export class Wave {
    /**
     * Creates a new Wave component.
     * @param {number} period - The period of the wave (number of cycles over a length of 1 board unit).
     * @param {number} amplitude - The amplitude of the wave (max displacement from the center line in board units).
     */
    constructor(period, amplitude) {
        // Clamp values to suggested ranges
        this.amplitude = Math.max(MIN_AMPLITUDE, Math.min(amplitude, MAX_AMPLITUDE));
        this.period = Math.max(MIN_PERIOD, Math.min(period, MAX_PERIOD));

        // Pre-calculate constants for sampling
        this._angularFrequency = 2 * Math.PI * this.period;
    }

    /**
     * Samples the wave at a given position t (where t is a value typically between 0 and 1,
     * representing a point along the length of a cut edge).
     * @param {number} t - The position along the wave, usually normalized (0 to 1).
     * @returns {number} The displacement value at position t.
     */
    sample(t) {
        // Simple sine wave: Amplitude * sin(angularFrequency * t)
        return this.amplitude * Math.sin(this._angularFrequency * t);
    }

    /**
     * Returns a string representation.
     * @returns {string}
     */
    toString() {
        return `Wave(period: ${this.period.toFixed(2)}, amplitude: ${this.amplitude.toFixed(4)})`;
    }
}

// Helper function to generate a random wave within the clamped range
export function createRandomWave() {
    const randomPeriod = MIN_PERIOD + Math.random() * (MAX_PERIOD - MIN_PERIOD);
    const randomAmplitude = MIN_AMPLITUDE + Math.random() * (MAX_AMPLITUDE - MIN_AMPLITUDE);
    return new Wave(randomPeriod, randomAmplitude);
}