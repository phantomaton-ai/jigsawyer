// jigsaw-piece.js - View class for a single puzzle piece's SVG representation.
// This is a pure JS class, not an HTMLElement.

import { Piece } from './piece.js'; // Domain model dependency

/**
 * Manages the SVG elements for a single puzzle piece.
 * Renders a square piece with the correct image segment and position/rotation.
 * Positions and sizes are in the original image's pixel coordinates (world units).
 */
export class JigsawPiece {
    /**
     * @param {Piece} pieceData - The domain model data for this piece.
     * @param {SVGDefsElement} svgDefs - The <defs> element from the main SVG root.
     * @param {import('./image-info.js').ImageInfo} imageInfo - The image information.
     */
    constructor(pieceData, svgDefs, imageInfo) {
        this._pieceData = pieceData;
        this._svgDefs = svgDefs;
        this._imageInfo = imageInfo;

        // Create the SVG elements: <g> transform wrapper, <rect> shape, <clipPath>
        this.element = this._createSvgElement();
        this._createClipPath();
        this._applyFill();

        // Set initial visual state
        this.updatePositionAndRotation();
    }

    /**
     * Creates the main SVG <g> element for the piece.
     * @returns {SVGGElement}
     */
    _createSvgElement() {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', 0); // Position relative to the group's origin (top-left of piece)
        rect.setAttribute('y', 0);
        rect.setAttribute('width', this._pieceData.width);
        rect.setAttribute('height', this._pieceData.height);

        // We will apply fill and clip-path later

        g.appendChild(rect);
        return g;
    }

    /**
     * Creates or updates the clipPath definition for the piece.
     * The clip path uses image pixel coordinates.
     */
    _createClipPath() {
        const clipPathId = `clip-${this._pieceData.id}`;
        let clipPath = this._svgDefs.querySelector(`#${clipPathId}`);

        if (!clipPath) {
            clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
            clipPath.setAttribute('id', clipPathId);
            const clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            clipPath.appendChild(clipRect);
            this._svgDefs.appendChild(clipPath);
        }

        // Update the rectangle within the clip path.
        // It defines the piece's area in the ORIGINAL image coordinates.
        const clipRect = clipPath.querySelector('rect');
        clipRect.setAttribute('x', this._pieceData.originX);
        clipRect.setAttribute('y', this._pieceData.originY);
        clipRect.setAttribute('width', this._pieceData.width);
        clipRect.setAttribute('height', this._pieceData.height);

        // Apply the clip path to the piece's rect element
        this.element.querySelector('rect').setAttribute('clip-path', `url(#${clipPathId})`);
    }

    /**
     * Applies the image pattern fill to the piece's rect element.
     * Assumes a single pattern for the full image exists in SVG defs with ID 'img-pattern'.
     */
    _applyFill() {
        this.element.querySelector('rect').setAttribute('fill', 'url(#img-pattern)');
        // The pattern itself needs to be defined ONCE in the main SVG's defs, covering the full image.
        // The clip path then acts as the window onto this patterned background.
        // The patternTransform could also be used, but clip-path is cleaner for simple squares.
    }


    /**
     * Updates the SVG transform attribute based on the piece data's current position and rotation.
     * Positions and rotations are applied to the <g> element.
     * Positions and sizes are in image pixel coordinates (world units).
     */
    updatePositionAndRotation() {
        const { currentX, currentY, width, height, rotation } = this._pieceData;

        // SVG transform origin is relative to the element's coordinate system.
        // To rotate around the piece's center, the origin is (width/2, height/2).
        const rotateTransform = `rotate(${rotation} ${width / 2} ${height / 2})`;

        // Translate the group to the piece's top-left corner (currentX, currentY)
        const translateTransform = `translate(${currentX}, ${currentY})`;

        // Apply both transforms to the <g> element. Order matters: translate then rotate
        // means rotate around the piece's center after it's been moved.
        // Applying rotate then translate means rotate around (0,0), then move.
        // We want to move first, then rotate around the piece's local center.
        // Let's re-verify SVG transform order... translate() then rotate() applies rotate *after* translation.
        // This results in rotation around the document origin, not the element's new position.
        // Correct order is typically rotate(angle, center_x, center_y) then translate(x,y).
        // But SVG rotate has optional center coords! Let's use that.
        // transform="translate(x,y) rotate(angle center_x, center_y)"
        // No, transform="translate(x,y) rotate(angle)" rotates around the new origin (x,y).
        // The center_x/center_y in rotate() are relative to the element's OWN coordinate system *before* translation.
        // So, rotate(angle width/2 height/2) then translate(currentX, currentY) applies rotation around local center, then moves the result.
        // Correct: transform="translate(currentX, currentY) rotate(rotation width/2 height/2)" - center is relative to G origin (currentX, currentY)

        // Let's stick to the simple way: translate the group to the piece's top-left,
        // then apply rotation *to the rect inside* around its center (0,0) relative to group origin.
        // OR apply both to the group, but rotate(angle center_x center_y) syntax is confusing.
        // Easiest for now: transform the group to the top-left, apply rotation around center of rect (which is at 0,0 in group).
         this.element.setAttribute('transform', `translate(${currentX}, ${currentY})`);
         this.element.querySelector('rect').setAttribute('transform', rotateTransform);

         // Ensure stroke is visible and fill is set
         this.element.querySelector('rect').setAttribute('stroke', 'black');
         this.element.querySelector('rect').setAttribute('stroke-width', 1); // 1 pixel stroke in image coords
         this.element.querySelector('rect').setAttribute('vector-effect', 'non-scaling-stroke'); // Keep stroke constant size on screen zoom
    }
}