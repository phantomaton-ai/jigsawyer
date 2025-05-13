// piece-data.js - Domain model for a single puzzle piece's data.

/**
 * Represents a single puzzle piece's data model.
 * All positions and sizes are in the original image's pixel coordinates (world units).
 */
export class PieceData {
    /**
     * @param {number} id - Unique identifier for the piece (e.g., its grid index).
     * @param {number} originX - The X coordinate of the piece's top-left corner in the original image.
     * @param {number} originY - The Y coordinate of the piece's top-left corner in the original image.
     * @param {number} width - The width of the piece in image pixels.
     * @param {number} height - The height of the piece in image pixels.
     */
    constructor(id, originX, originY, width, height) {
        this.id = id;
        this.originX = originX; // X in assembled image (image pixels)
        this.originY = originY; // Y in assembled image (image pixels)
        this.width = width;     // Width in image pixels
        this.height = height;   // Height in image pixels

        // Current state on the board (initially same as origin, or randomized)
        this.currentX = originX; // Current X position (top-left) in image pixels
        this.currentY = originY; // Current Y position (top-left) in image pixels
        this.rotation = 0;      // Current rotation in degrees (0-360)

        // Minimal state for display purposes only (interactions/snapping omitted for now)
        // this.isSelected = false; // Omitted
        // this.isSnapped = false;  // Omitted
    }

    /**
     * Sets the current position of the piece on the board.
     * @param {number} x - New X coordinate (top-left) in image pixels.
     * @param {number} y - New Y coordinate (top-left) in image pixels.
     */
    setPlacement(x, y) {
        this.currentX = x;
        this.currentY = y;
    }

    /**
     * Sets the current rotation of the piece on the board.
     * @param {number} angle - New rotation angle in degrees.
     */
    setRotation(angle) {
        this.rotation = angle; // Store as degrees for SVG transform
    }

    /**
     * Randomizes the piece's current position within a given board area.
     * @param {number} boardWidth - The width of the scatter area in image pixels.
     * @param {number} boardHeight - The height of the scatter area in image pixels.
     * @param {number} boardOffsetX - The X offset of the scatter area's top-left from the origin.
     * @param {number} boardOffsetY - The Y offset of the scatter area's top-left from the origin.
     */
    randomizePosition(boardWidth, boardHeight, boardOffsetX, boardOffsetY) {
         const randomX = boardOffsetX + Math.random() * (boardWidth - this.width);
         const randomY = boardOffsetY + Math.random() * (boardHeight - this.height);
         this.setPlacement(randomX, randomY);

         const randomAngle = Math.floor(Math.random() * 4) * 90; // 0, 90, 180, 270
         this.setRotation(randomAngle);
    }
}