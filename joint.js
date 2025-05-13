import { Cut, createRandomCut } from './cut.js';

// Clamped values for nib size as suggested by DESIGN.md
const MIN_NIB_SIZE = 0.15; // Ratio of piece dimension (e.g., 0.2 means nib is 20% of piece width/height)
const MAX_NIB_SIZE = 0.33; // Ratio

/**
 * Represents a connection (an edge/joint) between two puzzle pieces.
 */
export class Joint {
    /**
     * Creates a new Joint instance.
     * @param {number} pieceIdA - The ID of the first piece.
     * @param {number} pieceIdB - The ID of the second piece (or null if it's an edge piece).
     * @param {'top'|'right'|'bottom'|'left'} edgeA - The edge of piece A that this joint is on.
     * @param {'top'|'right'|'bottom'|'left'} edgeB - The edge of piece B that this joint is on (corresponding edge).
     * @param {boolean} outward - True if the 'nib' shape for piece A is an 'outie', false if it's an 'innie'.
     * @param {number} size - The size of the nib, as a ratio of the piece dimension (0.15-0.33).
     * @param {Cut} cut - The Cut instance defining the shape of the edge line.
     */
    constructor(pieceIdA, pieceIdB, edgeA, edgeB, outward, size, cut) {
        this.pieceIdA = pieceIdA; // ID of the first piece
        this.pieceIdB = pieceIdB; // ID of the second piece (null for boundary edges)
        this.edgeA = edgeA;       // Edge of piece A ('top', 'right', 'bottom', 'left')
        this.edgeB = edgeB;       // Corresponding edge of piece B (e.g., 'bottom' for piece A's 'top')
        this.outward = outward;   // Is the nib an 'outie' for piece A? (Means piece B's nib here is 'innie')

        // Clamp nib size
        this.size = Math.max(MIN_NIB_SIZE, Math.min(size, MAX_NIB_SIZE));

        if (!(cut instanceof Cut)) {
            console.warn("Joint constructor received invalid Cut. Creating a default one.");
            this.cut = createRandomCut(); // Default cut if none provided or invalid
        } else {
            this.cut = cut;
        }

        // Store a unique ID for the joint itself (useful for matching edges)
        // Sort piece IDs and edges alphabetically for consistent joint ID regardless of A/B order
        const ids = [pieceIdA, pieceIdB].sort().join('-');
        const edges = [edgeA, edgeB].sort().join('-'); // Sorting edges might be tricky for matching, maybe store the pair normalized?
        // Let's just use the pieces and one edge from A for ID for now.
        this.id = `${pieceIdA}-${edgeA}`; // Simple ID based on piece A and its edge
    }

     /**
     * Returns a string representation.
     * @returns {string}
     */
    toString() {
        return `Joint(PieceA: ${this.pieceIdA}, EdgeA: ${this.edgeA}, Outward: ${this.outward.toString().substring(0,1)}, Size: ${this.size.toFixed(2)}, Cut: ${this.cut.toString()})`;
    }
}

/**
 * Helper function to create a random Joint between two pieces.
 * @param {number} pieceIdA - The ID of the first piece.
 * @param {number} pieceIdB - The ID of the second piece.
 * @param {'top'|'right'|'bottom'|'left'} edgeA - The edge of piece A connecting to piece B.
 * @param {'top'|'right'|'bottom'|'left'} edgeB - The edge of piece B connecting to piece A.
 * @param {Cut} [cut] - Optional Cut instance to use. If not provided, a random one is created.
 * @returns {Joint} A new Joint instance.
 */
export function createRandomJoint(pieceIdA, pieceIdB, edgeA, edgeB, cut = createRandomCut()) {
    // Determine if piece A's nib is outward or inward randomly
    const outward = Math.random() < 0.5;
    const randomSize = MIN_NIB_SIZE + Math.random() * (MAX_NIB_SIZE - MIN_NIB_SIZE);

    // Create the joint from A's perspective
    const jointA = new Joint(pieceIdA, pieceIdB, edgeA, edgeB, outward, randomSize, cut);

    // Create the corresponding joint from B's perspective (opposite outwardness)
    const jointB = new Joint(pieceIdB, pieceIdA, edgeB, edgeA, !outward, randomSize, cut);

    // We need a way to link these two sides. For now, return both or just one?
    // The Puzzle or Piece class should probably manage which piece has which side of the joint.
    // Let's return an object containing both sides.
    return { sideA: jointA, sideB: jointB };
}