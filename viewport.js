export class Viewport {
    constructor(initialWidth, initialHeight) {
        this.viewBoxX = 0;
        this.viewBoxY = 0;
        this.zoomLevel = 1;
        this.hostWidth = initialWidth; // Width of the component, for center zoom if no pointer
        this.hostHeight = initialHeight; // Height of the component
    }

    pan(dx, dy) {
        // dx, dy are screen-space deltas for panning
        this.viewBoxX -= dx / this.zoomLevel; // Pan view opposite to mouse drag
        this.viewBoxY -= dy / this.zoomLevel;
    }

    zoom(factor, pointerScreenX, pointerScreenY) {
        const prevZoom = this.zoomLevel;
        const newZoom = Math.max(0.1, Math.min(this.zoomLevel * factor, 10)); // Clamp zoom

        if (newZoom === prevZoom) return false; // No change

        // If pointerScreenX/Y are not provided, zoom towards center of the host element
        const targetScreenX = (pointerScreenX === undefined) ? this.hostWidth / 2 : pointerScreenX;
        const targetScreenY = (pointerScreenY === undefined) ? this.hostHeight / 2 : pointerScreenY;

        // World coordinates under the pointer before zoom
        const worldX = (targetScreenX / prevZoom) + this.viewBoxX;
        const worldY = (targetScreenY / prevZoom) + this.viewBoxY;

        this.zoomLevel = newZoom;

        // Adjust viewBox so the world point under the pointer remains the same on screen
        this.viewBoxX = worldX - (targetScreenX / this.zoomLevel);
        this.viewBoxY = worldY - (targetScreenY / this.zoomLevel);
        
        return true; // Zoom changed
    }

    // Converts screen coordinates (relative to the component host) to world coordinates
    toWorldCoordinates(screenX, screenY) {
        const worldX = (screenX / this.zoomLevel) + this.viewBoxX;
        const worldY = (screenY / this.zoomLevel) + this.viewBoxY;
        return { x: worldX, y: worldY };
    }

    // Converts world coordinates to screen coordinates (relative to the component host)
    // Useful if you want to know where a world point appears on screen.
    toScreenCoordinates(worldX, worldY) {
        const screenX = (worldX - this.viewBoxX) * this.zoomLevel;
        const screenY = (worldY - this.viewBoxY) * this.zoomLevel;
        return { x: screenX, y: screenY };
    }

    // Gets the CSS transform string for the main puzzle area container
    getPuzzleAreaTransform() {
        // Puzzle area items are positioned with world coordinates.
        // This transform acts like a camera.
        return `scale(${this.zoomLevel}) translate(-${this.viewBoxX}px, -${this.viewBoxY}px)`;
    }

    // Applies the transform to a 2D canvas context (e.g., for drawing the grid)
    applyToCanvas(ctx) {
        // Grid items are drawn with world coordinates.
        // This transform sets up the canvas to draw them correctly.
        ctx.scale(this.zoomLevel, this.zoomLevel);
        ctx.translate(-this.viewBoxX, -this.viewBoxY);
    }

    // Inverse transform for canvas (if needed, e.g. for drawing UI elements that shouldn't pan/zoom)
    applyInverseToCanvas(ctx) {
        ctx.translate(this.viewBoxX, this.viewBoxY);
        ctx.scale(1 / this.zoomLevel, 1 / this.zoomLevel);
    }

    setHostDimensions(width, height) {
        this.hostWidth = width;
        this.hostHeight = height;
    }
}