// piece.js - Domain model for a single puzzle piece.

import { Position } from './position.js';
import { PieceJoints } from './joints.js'; // Assuming PieceJoints is the name from joints.js

/**
 * Represents a single puzzle piece's data model.
 */
export class Piece {
    /**
     * @param {number} id - Unique identifier for the piece (e.g., its index in the puzzle grid).
     * @param {Position} origination - The top-left position of the piece in the fully assembled puzzle (board coordinates).
     * @param {number} width - The width of the piece (board units).
     * @param {number} height - The height of the piece (board units).
     * @param {Position} initialPlacement - The initial top-left position of the piece on the board (board coordinates).
     * @param {number} [initialRotation=0] - Initial rotation in quarter turns (0, 1, 2, or 3).
     * @param {PieceJoints} [joints=new PieceJoints()] - The joints connected to this piece's edges.
     */
    constructor(id, origination, width, height, initialPlacement, initialRotation = 0, joints = new PieceJoints()) {
        if (!(origination instanceof Position)) throw new Error("Piece origination must be a Position.");
        if (!(initialPlacement instanceof Position)) throw new Error("Piece initialPlacement must be a Position.");
        if (!(joints instanceof PieceJoints)) throw new Error("Piece joints must be a PieceJoints instance.");

        this.id = id;
        this.origination = origination; // Correct top-left position in the assembled puzzle (board units)
        this.width = width;           // Width of the piece (board units)
        this.height = height;         // Height of the piece (board units)
        this._placement = initialPlacement; // Current top-left position on the board (board units)
        this._rotation = initialRotation % 4; // Current rotation in quarter turns (0, 1, 2, or 3)
        this.joints = joints;         // Reference to the PieceJoints instance for this piece

        this.isSnapped = false;       // Is the piece currently snapped to its correct location?
        // Note: isSelected and element reference are handled by the view component (jigsaw-piece)
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
        // Snapped status should be checked externally after placement update
        // this.isSnapped = this.canSnap(); // Or handle in Puzzle/Board logic
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
        // Snapped status should be checked externally after rotation update
        // this.isSnapped = this.canSnap(); // Or handle in Puzzle/Board logic
    }

    /**
     * Checks if the piece is in its correct position and orientation.
     * Implements `test()` from DESIGN.md.
     * @returns {boolean} True if origination matches placement and rotation is 0.
     */
    test() {
        // We assume exact position match for the 'test' function here,
        // although snapping might use a threshold.
        return this.origination.equals(this._placement) && this._rotation === 0;
    }

    /**
     * Calculates the center position of the piece in board coordinates.
     * @returns {Position}
     */
    get center() {
        return this._placement.add(new Position(this.width / 2, this.height / 2));
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
     * The transform is applied relative to the piece's top-left corner (0,0 in its local system).
     * @returns {string} The SVG transform string.
     */
    getSvgTransform() {
         // SVG transform `translate(x,y)` moves the group's origin to the piece's top-left (placement).
         // SVG transform `rotate(angle center_x center_y)` rotates around `(center_x, center_y)`
         // relative to the group's current origin. To rotate around the piece's visual center,
         // center_x is width/2 and center_y is height/2.
         const rotationDegrees = this._rotation * 90; // Convert quarter turns to degrees

        return `translate(${this.placement.x}, ${this.placement.y}) rotate(${rotationDegrees} ${this.width / 2} ${this.height / 2})`;
    }

     /**
     * Returns a string representation.
     * @returns {string}
     */
    toString() {
        return `Piece(ID: ${this.id}, Orig: ${this.origination.toString()}, Place: ${this.placement.toString()}, Rot: ${this.rotation}q, Snapped: ${this.isSnapped})`;
    }

    // TODO: Method to generate the complex SVG path based on joints and cuts
    generateComplexSvgPath() {
        // This is where the magic happens using this.joints and the Cut objects.
        // It will iterate through the 4 edges (top, right, bottom, left),
        // retrieve the corresponding joint from this.joints,
        // and generate an SVG path segment for that edge.
        // The path is defined in the piece's local coordinate system (0,0 at top-left).

        // The path string starts with 'M 0 0' (Move to top-left).
        let path = 'M 0 0';

        // 1. Top Edge (from 0,0 to width,0)
        // Need to get the joint for the 'top' edge.
        // If joint exists, generate path from (0,0) to (width,0) with the joint shape.
        // If no joint (outer edge), draw a straight line L width 0.
        const topJoint = this.joints.top;
        if (topJoint) {
             // TODO: Generate path segment for complex top edge
             console.warn(`Generating complex path for Piece ${this.id}: Top edge is complex (Joint with piece ${topJoint.pieceIdB}). Not yet implemented.`);
             // For now, add a placeholder straight line + debug circle
             path += ` L ${this.width / 2} 0`; // Move to middle top edge
             path += ` c 0 -${this.height * topJoint.size * (topJoint.outward ? 1 : -1)} 0 -${this.height * topJoint.size * (topJoint.outward ? 1 : -1)} ${this.width / 2} 0`; // Simple bezier for visualization
             path += ` L ${this.width} 0`; // Move to top-right
        } else {
            path += ` L ${this.width} 0`; // Straight line for flat top edge
        }


        // 2. Right Edge (from width,0 to width,height)
        const rightJoint = this.joints.right;
         if (rightJoint) {
             // TODO: Generate path segment for complex right edge
             console.warn(`Generating complex path for Piece ${this.id}: Right edge is complex (Joint with piece ${rightJoint.pieceIdB}). Not yet implemented.`);
             // For now, add a placeholder straight line + debug circle
             path += ` L ${this.width} ${this.height / 2}`; // Move to middle right edge
             path += ` c ${this.width * rightJoint.size * (rightJoint.outward ? 1 : -1)} 0 ${this.width * rightJoint.size * (rightJoint.outward ? 1 : -1)} 0 0 ${this.height / 2}`; // Simple bezier
             path += ` L ${this.width} ${this.height}`; // Move to bottom-right
         } else {
            path += ` L ${this.width} ${this.height}`; // Straight line for flat right edge
         }

        // 3. Bottom Edge (from width,height to 0,height)
        const bottomJoint = this.joints.bottom;
         if (bottomJoint) {
             // TODO: Generate path segment for complex bottom edge
             console.warn(`Generating complex path for Piece ${this.id}: Bottom edge is complex (Joint with piece ${bottomJoint.pieceIdB}). Not yet implemented.`);
              // Note: Directions for bottom and left edges are reversed relative to standard path drawing.
              // If moving from right-to-left along the bottom edge, an 'outie' from piece A (this)
              // means the path dips *down*, not up.
              // For now, add a placeholder
              path += ` L ${this.width / 2} ${this.height}`; // Move to middle bottom edge
              path += ` c 0 ${this.height * bottomJoint.size * (bottomJoint.outward ? 1 : -1)} 0 ${this.height * bottomJoint.size * (bottomJoint.outward ? 1 : -1)} -${this.width / 2} 0`; // Simple bezier
              path += ` L 0 ${this.height}`; // Move to bottom-left

         } else {
            path += ` L 0 ${this.height}`; // Straight line for flat bottom edge
         }

        // 4. Left Edge (from 0,height to 0,0)
        const leftJoint = this.joints.left;
         if (leftJoint) {
             // TODO: Generate path segment for complex left edge
             console.warn(`Generating complex path for Piece ${this.id}: Left edge is complex (Joint with piece ${leftJoint.pieceIdB}). Not yet implemented.`);
              // Note: Directions for left edge are reversed relative to standard path drawing (bottom-to-top).
              // If moving from bottom-to-top along the left edge, an 'outie' from piece A (this)
              // means the path bulges *left*, not right.
              // For now, add a placeholder
              path += ` L 0 ${this.height / 2}`; // Move to middle left edge
              path += ` c -${this.width * leftJoint.size * (leftJoint.outward ? 1 : -1)} 0 -${this.width * leftJoint.size * (leftJoint.outward ? 1 : -1)} 0 0 -${this.height / 2}`; // Simple bezier
              // Ends implicitly at 0,0
         } else {
            // Ends implicitly at 0,0
         }

        path += ' Z'; // Close the path

        // This method will need the Joint and Cut classes to calculate intermediate points.
        // For now, it returns a simple rectangle path or a very crude placeholder.
        // Let's return the simple rect path until edge generation is properly implemented.
        // But leave the comments as the plan.

        // Returning a rectangle path for now.
        return `M 0 0 L ${this.width} 0 L ${this.width} ${this.height} L 0 ${this.height} Z`;
    }

    /**
     * Returns the SVG clipPath element content (without <clipPath> tag) for the piece's shape.
     * This is used to mask the image pattern.
     * @returns {string} The SVG path data string ('d' attribute value) for the piece's border.
     */
    getClipPathData() {
        // This will eventually call generateComplexSvgPath()
        return this.generateComplexSvgPath(); // Currently returns rectangle path
    }
}