import { Wave, createRandomWave } from './wave.js';

/**
 * Represents the shape of a puzzle piece cut (the line between two pieces),
 * defined as a sum of multiple sine waves.
 */
export class Cut {
    /**
     * Creates a new Cut.
     * @param {Wave[]} components - An array of Wave instances whose samples will be summed.
     */
    constructor(components = []) {
        if (!Array.isArray(components) || components.some(c => !(c instanceof Wave))) {
             console.warn("Cut constructor received invalid components. Using empty array.");
            this.components = [];
        } else {
             this.components = components;
        }
    }

    /**
     * Samples the cut shape at a given position t (0 to 1).
     * Returns the total displacement from a straight line at that point.
     * @param {number} t - The position along the cut, normalized from 0 to 1.
     * @returns {number} The total displacement from the straight line at t.
     */
    sample(t) {
        let totalDisplacement = 0;
        for (const wave of this.components) {
            totalDisplacement += wave.sample(t);
        }
        return totalDisplacement;
    }

     /**
     * Returns a string representation.
     * @returns {string}
     */
    toString() {
        return `Cut(${this.components.length} components)`;
    }
}

/**
 * Helper function to create a random Cut with a specified number of waves.
 * @param {number} numWaves - The number of random waves to include in the cut.
 * @returns {Cut} A new Cut instance with random wave components.
 */
export function createRandomCut(numWaves = 3) {
    const components = [];
    for (let i = 0; i < numWaves; i++) {
        components.push(createRandomWave());
    }
    return new Cut(components);
}