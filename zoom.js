// zoom.js - Custom event for zooming the viewport.

/**
 * Creates a custom 'zoom' event.
 * This event should be dispatched when the user intends to zoom the viewport.
 * @param {number} factor - The zoom factor (e.g., 1.1 for 10% zoom in, 0.9 for 10% zoom out).
 * @param {number} [clientX] - Optional X coordinate (viewport pixels) for the zoom center.
 * @param {number} [clientY] - Optional Y coordinate (viewport pixels) for the zoom center.
 * @returns {CustomEvent} A new CustomEvent with type 'zoom'.
 */
export function createZoomEvent(factor, clientX, clientY) {
    return new CustomEvent('zoom', {
        bubbles: true, // Allow the event to bubble up the DOM tree
        composed: true, // Allow the event to cross the Shadow DOM boundary
        detail: {
            factor: factor, // Zoom multiplier
            clientX: clientX, // Optional center X (relative to viewport)
            clientY: clientY  // Optional center Y (relative to viewport)
        }
    });
}