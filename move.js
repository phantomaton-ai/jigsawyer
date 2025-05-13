// move.js - Custom event for moving/dragging a puzzle piece.

/**
 * Creates a custom 'move' event.
 * This event should be dispatched while a piece is being dragged.
 * The coordinates are provided in screen/pixel coordinates relative to the component's viewport.
 * @param {number} pieceId - The ID of the piece being moved.
 * @param {number} clientX - The current X coordinate of the pointer (e.g., mouse or touch) in viewport pixels, relative to the top-left of the jigsaw-puzzle component host element.
 * @param {number} clientY - The current Y coordinate of the pointer (e.g., mouse or touch) in viewport pixels, relative to the top-left of the jigsaw-puzzle component host element.
 * @returns {CustomEvent} A new CustomEvent with type 'move'.
 */
export function createMoveEvent(pieceId, clientX, clientY) {
    return new CustomEvent('move', {
        bubbles: true, // Allow the event to bubble up the DOM tree
        composed: true, // Allow the event to cross the Shadow DOM boundary
        detail: {
            pieceId: pieceId,   // ID of the piece being moved
            clientX: clientX,   // X position (relative to host element)
            clientY: clientY    // Y position (relative to host element)
        }
    });
}