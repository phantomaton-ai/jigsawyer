// image-info.js - Domain model for the source image.

/**
 * Represents the source image for the puzzle.
 */
export class ImageInfo {
    /**
     * @param {string} url - The URL of the image.
     * @param {number} width - The pixel width of the image.
     * @param {number} height - The pixel height of the image.
     */
    constructor(url, width, height) {
        this.url = url;       // URL to the image file
        this.width = width;   // Pixel width
        this.height = height; // Pixel height
    }
}