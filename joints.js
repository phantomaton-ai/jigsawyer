import { Joint } from './joint.js';

/**
 * Represents the set of four joints (edges) belonging to a single puzzle piece.
 * A joint might be null if it's an external edge of the puzzle.
 */
export class PieceJoints {
    /**
     * @param {Joint | null} top - The joint on the top edge of the piece.
     * @param {Joint | null} right - The joint on the right edge of the piece.
     * @param {Joint | null} bottom - The joint on the bottom edge of the piece.
     * @param {Joint | null} left - The joint on the left edge of the piece.
     */
    constructor(top = null, right = null, bottom = null, left = null) {
        // Validate that provided joints are actually Joint instances or null
        if (top !== null && !(top instanceof Joint)) { console.warn("Invalid 'top' joint provided."); top = null; }
        if (right !== null && !(right instanceof Joint)) { console.warn("Invalid 'right' joint provided."); right = null; }
        if (bottom !== null && !(bottom instanceof Joint)) { console.warn("Invalid 'bottom' joint provided."); bottom = null; }
        if (left !== null && !(left instanceof Joint)) { console.warn("Invalid 'left' joint provided."); left = null; }

        this.top = top;
        this.right = right;
        this.bottom = bottom;
        this.left = left;
    }

    /**
     * Gets a joint by its edge name.
     * @param {'top'|'right'|'bottom'|'left'} edge - The name of the edge.
     * @returns {Joint | null} The joint on that edge, or null if it's an external edge.
     */
    getJoint(edge) {
        switch (edge) {
            case 'top': return this.top;
            case 'right': return this.right;
            case 'bottom': return this.bottom;
            case 'left': return this.left;
            default:
                console.warn(`Attempted to get joint for unknown edge: ${edge}`);
                return null;
        }
    }

     /**
     * Returns a string representation.
     * @returns {string}
     */
    toString() {
        return `PieceJoints(T: ${this.top ? this.top.pieceIdB : 'null'}, R: ${this.right ? this.right.pieceIdB : 'null'}, B: ${this.bottom ? this.bottom.pieceIdB : 'null'}, L: ${this.left ? this.left.pieceIdB : 'null'})`;
    }
}