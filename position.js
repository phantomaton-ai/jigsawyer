// position.js - Represents a position in board coordinates

export class Position {
    /**
     * @param {number} x - The X coordinate.
     * @param {number} y - The Y coordinate.
     */
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    /**
     * Calculates the distance to another position.
     * @param {Position} other - The other position.
     * @returns {number} The distance.
     */
    distanceTo(other) {
        return Math.hypot(this.x - other.x, this.y - other.y);
    }

    /**
     * Creates a new Position instance by adding another position's coordinates.
     * @param {Position} other - The position to add.
     * @returns {Position} A new Position instance.
     */
    add(other) {
        return new Position(this.x + other.x, this.y + other.y);
    }

    /**
     * Creates a new Position instance by subtracting another position's coordinates.
     * @param {Position} other - The position to subtract.
     * @returns {Position} A new Position instance.
     */
    subtract(other) {
        return new Position(this.x - other.x, this.y - other.y);
    }

    /**
     * Creates a new Position instance by scaling its coordinates.
     * @param {number} scalar - The scalar value.
     * @returns {Position} A new Position instance.
     */
    scale(scalar) {
        return new Position(this.x * scalar, this.y * scalar);
    }

    /**
     * Checks if this position is equal to another.
     * @param {Position} other - The other position.
     * @returns {boolean} True if equal, false otherwise.
     */
    equals(other) {
        if (!(other instanceof Position)) return false;
        return this.x === other.x && this.y === other.y;
    }

    /**
     * Returns a string representation.
     * @returns {string}
     */
    toString() {
        return `(${this.x.toFixed(2)}, ${this.y.toFixed(2)})`;
    }
}