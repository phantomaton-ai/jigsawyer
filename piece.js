// piece.js - Domain model for a single puzzle piece.

import { Position } from './position.js';
import { PieceJoints } from './joints.js';
// Import the path generation utility
import { generatePiecePath } from './path.js';

/**
 * Represents a single puzzle piece's data model.
 * Holds intrinsic properties (origination, size, shape) and current state (placement, rotation, snapped).
 */
export class Piece {
    /**
     * @param {number} id - Unique identifier for the piece (e.g., its index in the puzzle grid).
     * @param {Position} origination - The top-left position of the piece in the fully assembled puzzle grid (board coordinates).
     * @param {number} width - The width of the piece (board units).
     * @param {number} height - The height of the piece (board units).
     * @param {Position} initialPlacement - The initial top-left position of the piece on the board (board coordinates).
     * @param {number} [initialRotation=0] - Initial rotation in quarter turns (0, 1, 2, or 3).
     * @param {PieceJoints} [joints=new PieceJoints()] - The joints connected to this piece's edges.
     */
    constructor(id, origination, width, height, initialPlacement, initialRotation = 0, joints = new PieceJoints()) {
        if (!(origination instanceof Position)) {
            console.error("Piece origination must be a Position.");
            origination = new Position(0, 0); // Provide a default to avoid errors
        }
        if (!(initialPlacement instanceof Position)) {
            console.error("Piece initialPlacement must be a Position.");
            initialPlacement = new Position(0, 0); // Provide a default
        }
        if (!(joints instanceof PieceJoints)) {
            console.warn("Piece joints must be a PieceJoints instance. Using default.");
            joints = new PieceJoints(); // Provide a default
        }

        this.id = id;
        this.origination = origination; // Correct top-left position in the assembled puzzle (board units)
        this.width = width;           // Width of the piece (board units)
        this.height = height;         // Height of the piece (board units)
        this.joints = joints;         // Reference to the PieceJoints instance for this piece

        this._placement = initialPlacement; // Current top-left position on the board (board units)
        this._rotation = initialRotation % 4; // Current rotation in quarter turns (0, 1, 2, or 3)

        this.isSnapped = false;       // Is the piece currently snapped to its correct location?
        // Note: isSelected and element reference are handled by the view component (jigsaw-piece)

        // Generate the SVG path data for this piece's shape based on its dimensions and joints
        // This path is defined in the piece's local coordinate system (0,0 at top-left)
        this.svgPathData = generatePiecePath(this.width, this.height, this);
    }

    /**
     * Gets the current placement position of the piece.
     * @returns {Position}
     */
    get placement() {
        return this._placement;
    }

    /**
     * Updates the current placement position of the piece.
     * Implements `place(position)` from DESIGN.md.
     * @param {Position} position - The new top-left position (board coordinates).
     */
    place(position) {
        if (!(position instanceof Position)) {
            console.warn("Invalid position provided to Piece.place");
            return;
        }
        this._placement = position;
        // Snapped status is typically checked externally after placement update (e.g., in controller's moveend handler)
    }

    /**
     * Gets the current rotation in quarter turns (0-3).
     * @returns {number}
     */
    get rotation() {
        return this._rotation;
    }

    /**
     * Rotates the piece by a number of quarter turns.
     * Implements `rotate(turns)` from DESIGN.md.
     * @param {number} turns - The number of 90-degree clockwise turns to apply.
     */
    rotate(turns) {
        const newRotation = this._rotation + turns;
        this._rotation = (newRotation % 4 + 4) % 4; // Normalize to 0, 1, 2, or 3
        // Snapped status is typically checked externally after rotation update
    }

    /**
     * Checks if the piece is in its correct position and orientation.
     * Implements `test()` from DESIGN.md.
     * @returns {boolean} True if origination matches placement and rotation is 0.
     */
    test() {
        // We assume exact position match for the 'test' function here.
        return this.origination.equals(this._placement) && this._rotation === 0;
    }

    /**
     * Calculates the center position of the piece in board coordinates.
     * @returns {Position}
     */
    get center() {
        return this.placement.add(new Position(this.width / 2, this.height / 2));
    }

    /**
     * Calculates the distance from the current center to the correct center position.
     * @returns {number}
     */
    distanceToCorrectPosition() {
         const correctCenter = this.origination.add(new Position(this.width / 2, this.height / 2));
         return this.center.distanceTo(correctCenter);
    }

    /**
     * Checks if the piece is close enough to its correct position and has 0 rotation to snap.
     * @param {number} snapThresholdWorldUnits - The maximum distance allowed for snapping.
     * @returns {boolean} True if the piece can be snapped, false otherwise.
     */
    canSnap(snapThresholdWorldUnits) {
        // Only snap if correctly oriented (0 rotation)
        if (this._rotation !== 0) {
            return false;
        }
        // Check if center is within the threshold distance
        return this.distanceToCorrectPosition() <= snapThresholdWorldUnits;
    }

    /**
     * Attempts to snap the piece to its correct location if it's within the threshold and rotation is 0.
     * If snapped, updates placement and rotation and sets isSnapped to true.
     * @param {number} snapThresholdWorldUnits - The maximum distance allowed for snapping.
     * @returns {boolean} True if the piece was snapped, false otherwise.
     */
    snap(snapThresholdWorldUnits) {
        if (this.canSnap(snapThresholdWorldUnits)) {
            this.place(this.origination); // Move to correct position
            this._rotation = 0; // Ensure rotation is correct (should be checked by canSnap anyway)
            this.isSnapped = true;
            console.log(`Piece ${this.id} snapped! ✅`);
            return true; // Indicate snap occurred
        }
        this.isSnapped = false; // Ensure state is correct if snap didn't happen
        return false; // Indicate snap did not occur
    }

    /**
     * Gets the SVG transform attribute value for placing and rotating the piece element.
     * This transform is applied to the <jigsaw-piece> host element via CSS.
     * @returns {{x: number, y: number, rotation: number}} Position (top-left) and rotation (quarter turns).
     */
    getVisualState() {
         return {
             x: this.placement.x,
             y: this.placement.y,
             rotation: this.rotation, // Quarter turns
             isSelected: this.isSelected, // Assuming this is updated externally on the data model
             isSnapped: this.isSnapped // Assuming this is updated externally on the data model
         };
    }

    // toString method removed as per Dr. Woe's request for simplicity.

}