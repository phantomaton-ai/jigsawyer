// rotate.js - Custom event for rotating a puzzle piece.

/**
 * Creates a custom 'rotate' event.
 * @param {number} pieceId - The ID of the piece to rotate.
 * @param {number} turns - The number of 90-degree counter-clockwise turns.
 * @returns {CustomEvent}
 */
export function createRotateEvent(pieceId, turns) {
    return new CustomEvent('rotate', {
        bubbles: true, composed: true,
        detail: { pieceId, turns }
    });
}