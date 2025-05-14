// select.js - Custom event for selecting a puzzle piece.

export function createSelectEvent(pieceId, clientX, clientY) {
    return new CustomEvent('select', {
        bubbles: true, composed: true,
        detail: { pieceId, clientX, clientY }
    });
}