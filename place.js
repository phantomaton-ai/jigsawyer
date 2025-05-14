// place.js - Custom event for the final placement of a puzzle piece after a drag.

export function createPlaceEvent(pieceId) {
    return new CustomEvent('place', {
        bubbles: true, composed: true,
        detail: { pieceId }
    });
}