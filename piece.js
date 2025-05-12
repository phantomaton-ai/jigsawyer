export class Piece {
    constructor(id, correctX, correctY, width, height, initialX, initialY, initialRotation = 0) {
        this.id = id; // Unique identifier for the piece

        // Intrinsic properties (where it belongs, its size)
        this.correctX = correctX; // Correct X position in the assembled puzzle (world units)
        this.correctY = correctY; // Correct Y position in the assembled puzzle (world units)
        this.width = width;       // Width of the piece (world units)
        this.height = height;     // Height of the piece (world units)

        // Current state properties
        this.x = initialX;        // Current X position on the board (world units)
        this.y = initialY;        // Current Y position on the board (world units)
        this.rotation = initialRotation; // Current rotation in degrees (0, 90, 180, 270)
        
        this.isSnapped = false;   // Is the piece currently snapped to its correct location?
        this.isSelected = false;  // Is the piece currently selected by the user?
        this.element = null;      // Reference to the DOM element (will be set by the component)

        // For SVG edges - these will be more complex later
        this.edgeShapes = {
            top: null,    // 'flat', 'outie', 'innie' or an Edge object
            right: null,
            bottom: null,
            left: null
        };
    }

    // Update current position
    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }

    // Update rotation, normalizing to 0-359
    setRotation(angle) {
        this.rotation = (angle % 360 + 360) % 360;
    }

    // Check if the piece is close enough to its correct position and rotation to snap
    canSnap(snapThreshold = 20) {
        if (this.rotation !== 0) { // For now, only snap if rotation is correct
            return false;
        }
        // Using center points for distance calculation
        const currentCenterX = this.x + this.width / 2;
        const currentCenterY = this.y + this.height / 2;
        const correctCenterX = this.correctX + this.width / 2;
        const correctCenterY = this.correctY + this.height / 2;

        const distance = Math.hypot(currentCenterX - correctCenterX, currentCenterY - correctCenterY);
        return distance < snapThreshold;
    }

    // Snap the piece to its correct location
    snap() {
        this.x = this.correctX;
        this.y = this.correctY;
        this.rotation = 0; // Ensure rotation is correct on snap
        this.isSnapped = true;
        this.isSelected = false; // Usually deselect on snap
        console.log(`Piece ${this.id} snapped into place! ✅`);
    }

    get transform() {
        // CSS transform string for the piece element based on its current state
        return `translate(${this.x}px, ${this.y}px) rotate(${this.rotation}deg)`;
    }
}