// pan.js - Custom event for panning the viewport.

/**
 * Creates a custom 'pan' event.
 * This event should be dispatched when the user intends to pan the viewport.
 * @param {number} dx - The horizontal pan delta in screen/pixel coordinates.
 * @param {number} dy - The vertical pan delta in screen/pixel coordinates.
 * @returns {CustomEvent} A new CustomEvent with type 'pan'.
 */
export function createPanEvent(dx, dy) {
    return new CustomEvent('pan', {
        bubbles: true, // Allow the event to bubble up the DOM tree
        composed: true, // Allow the event to cross the Shadow DOM boundary
        detail: {
            dx: dx, // Horizontal delta
            dy: dy  // Vertical delta
        }
    });
}