// select.js - Custom event for selecting a puzzle piece.

/**
 * Creates a custom 'select' event.
 * This event should be dispatched when the user selects or deselects a piece.
 * @param {number | null} pieceId - The ID of the piece being selected, or null if deselecting.
 * @returns {CustomEvent} A new CustomEvent with type 'select'.
 */
export function createSelectEvent(pieceId) {
    return new CustomEvent('select', {
        bubbles: true, // Allow the event to bubble up the DOM tree
        composed: true, // Allow the event to cross the Shadow DOM boundary
        detail: {
            pieceId: pieceId // The ID of the selected piece (or null)
        }
    });
}