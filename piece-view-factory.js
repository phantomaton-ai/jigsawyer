// piece-view-factory.js - Factory function to create and configure <jigsaw-piece> elements.

import { JigsawPiece } from './jigsaw-piece.js'; // Import the piece web component
import { Piece } from './piece.js'; // Import Piece domain model (for type hinting/checking)
import { ImageInfo } from './image.js'; // Import ImageInfo (for type hinting/checking)

/**
 * Creates and configures a <jigsaw-piece> web component element from a Piece domain model.
 * @param {Piece} pieceData - The data model for the piece.
 * @param {ImageInfo} imageInfo - The image information for the puzzle.
 * @returns {JigsawPiece} The configured <jigsaw-piece> element.
 */
export function createJigsawPieceElement(pieceData, imageInfo) {
    if (!(pieceData instanceof Piece)) {
        console.error("piece-view-factory: Invalid pieceData provided.");
        // Return a minimal placeholder element or null? Let's return null for now.
        return null;
    }
     if (!(imageInfo instanceof ImageInfo)) {
        console.error("piece-view-factory: Invalid imageInfo provided.");
         // Can potentially proceed without imageInfo if attributes are optional,
         // but for now image is essential.
        return null;
    }


    const pieceElement = document.createElement('jigsaw-piece');

    // Set attributes on the custom element based on the piece data model
    // The jigsaw-piece component will read these attributes and render itself.
    pieceElement.setAttribute('piece-id', pieceData.id);
    pieceElement.setAttribute('width', pieceData.width);
    pieceElement.setAttribute('height', pieceData.height);
    pieceElement.setAttribute('x', pieceData.placement.x); // Current placement
    pieceElement.setAttribute('y', pieceData.placement.y);
    pieceElement.setAttribute('rotation', pieceData.rotation); // Quarter turns

    // Image and correct position for pattern offset
    pieceElement.setAttribute('image-url', imageInfo.url);
    pieceElement.setAttribute('image-width', imageInfo.width);
    pieceElement.setAttribute('image-height', imageInfo.height);
    pieceElement.setAttribute('correct-x', pieceData.origination.x);
    pieceElement.setAttribute('correct-y', pieceData.origination.y);

    // Pass the generated SVG path data from the Piece model
    // The Piece constructor should have already generated pieceData.svgPathData
    if (pieceData.svgPathData) {
        pieceElement.setAttribute('path-data', pieceData.svgPathData);
    } else {
        // Fallback to a default rectangle path if path data is missing
         const defaultPath = `M 0 0 L ${pieceData.width} 0 L ${pieceData.width} ${pieceData.height} L 0 ${pieceData.height} Z`;
        pieceElement.setAttribute('path-data', defaultPath);
         console.warn(`Piece ${pieceData.id} missing svgPathData. Using default rectangle path.`);
    }


    // Set initial selected/snapped states (should typically be false initially)
    if (pieceData.isSelected) pieceElement.setAttribute('selected', '');
    if (pieceData.isSnapped) pieceElement.setAttribute('snapped', '');

    // Optional: Link the Piece data model reference to the component if needed internally
    // pieceElement.pieceData = pieceData; // Direct property access

    return pieceElement;
}