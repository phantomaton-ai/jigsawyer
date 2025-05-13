// piece.js - Domain model for a single puzzle piece.

/**
 * Represents a single puzzle piece's data model.
 * Positions and sizes are in the original image's pixel coordinates (world units).
 */
export class Piece {
    /**
     * @param {number} id - Unique identifier for the piece (grid index).
     * @param {number} originX - X coordinate of piece's top-left in image.
     * @param {number} originY - Y coordinate of piece's top-left in image.
     * @param {number} width - Width in image pixels.
     * @param {number} height - Height in image pixels.
     */
    constructor(id, originX, originY, width, height) {
        this.id = id;
        this.originX = originX; // X in assembled image (image pixels)
        this.originY = originY; // Y in assembled image (image pixels)
        this.width = width;     // Width in image pixels
        this.height = height;   // Height in image pixels

        // Current state on the board
        this.currentX = originX; // Current X position (top-left) in image pixels
        this.currentY = originY; // Current Y position (top-left) in image pixels
        this.rotation = 0;      // Current rotation in degrees (0, 90, 180, 270)
    }

    /**
     * Sets the current position and rotation randomly within a board area.
     * @param {number} boardWidth - Width of the scatter area.
     * @param {number} boardHeight - Height of the scatter area.
     * @param {number} boardOffsetX - X offset of scatter area's top-left.
     * @param {number} boardOffsetY - Y offset of scatter area's top-left.
     */
    randomizePlacement(boardWidth, boardHeight, boardOffsetX, boardOffsetY) {
         const randomX = boardOffsetX + Math.random() * (boardWidth - this.width);
         const randomY = boardOffsetY + Math.random() * (boardHeight - this.height);
         this.currentX = randomX;
         this.currentY = randomY;

         const randomAngle = Math.floor(Math.random() * 4) * 90; // 0, 90, 180, 270
         this.rotation = randomAngle;
    }
}