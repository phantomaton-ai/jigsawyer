// move.js - Custom event for moving/dragging a puzzle piece.

export function createMoveEvent(pieceId, clientX, clientY) {
    return new CustomEvent('move', {
        bubbles: true, composed: true,
        detail: { pieceId, clientX, clientY }
    });
}