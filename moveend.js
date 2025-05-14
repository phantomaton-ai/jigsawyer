// moveend.js - Custom event for the end of a puzzle piece drag.

export function createMoveEndEvent(pieceId) {
    return new CustomEvent('moveend', {
        bubbles: true, composed: true,
        detail: { pieceId }
    });
}