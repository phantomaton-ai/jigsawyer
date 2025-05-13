// rotate.js - Custom event for rotating a puzzle piece.

/**
 * Creates a custom 'rotate' event.
 * This event should be dispatched when the user requests a piece rotation.
 * @param {number} pieceId - The ID of the piece to rotate.
 * @param {number} turns - The number of 90-degree clockwise turns to apply (e.g., 1 for +90, 2 for 180, -1 for -90).
 * @returns {CustomEvent} A new CustomEvent with type 'rotate'.
 */
export function createRotateEvent(pieceId, turns) {
    return new CustomEvent('rotate', {
        bubbles: true, // Allow the event to bubble up the DOM tree
        composed: true, // Allow the event to cross the Shadow DOM boundary
        detail: {
            pieceId: pieceId, // ID of the piece to rotate
            turns: turns      // Number of quarter turns
        }
    });
}