// jigsaw-puzzle.js - Main custom element (<jigsaw-puzzle>) for displaying square pieces.
// Focuses on generating and rendering static square pieces from an image.

import { ImageInfo } from './image-info.js';
import { Piece } from './piece.js';

const DEFAULT_IMAGE_WIDTH = 1344;
const DEFAULT_IMAGE_HEIGHT = 960;
const DEFAULT_PIECE_COUNT = 40;

export class JigsawPuzzle extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._imageInfo = null;
    }

    static get observedAttributes() {
        return ['src', 'size'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (!this.isConnected || oldValue === newValue) return;
        if (name === 'src') this._loadImage(newValue);
        if (name === 'size' && this._imageInfo) this._initializePuzzle(this._imageInfo, parseInt(newValue, 10) || DEFAULT_PIECE_COUNT);
    }

    connectedCallback() {
        const initialSrc = this.getAttribute('src');
        if (initialSrc) this._loadImage(initialSrc);
        else {
            const dummyImageInfo = new ImageInfo("placeholder", DEFAULT_IMAGE_WIDTH, DEFAULT_IMAGE_HEIGHT);
            const initialSize = parseInt(this.getAttribute('size'), 10) || DEFAULT_PIECE_COUNT;
            this._initializePuzzle(dummyImageInfo, initialSize);
        }
    }

    _loadImage(src) {
        const img = new Image();
        img.onload = () => {
            this._imageInfo = new ImageInfo(src, img.width, img.height);
            const pieceCount = parseInt(this.getAttribute('size'), 10) || DEFAULT_PIECE_COUNT;
            this._initializePuzzle(this._imageInfo, pieceCount);
        };
        img.onerror = () => {
            console.error(`Failed to load image: ${src}`);
            const dummyImageInfo = new ImageInfo("error", DEFAULT_IMAGE_WIDTH, DEFAULT_IMAGE_HEIGHT);
            const pieceCount = parseInt(this.getAttribute('size'), 10) || DEFAULT_PIECE_COUNT;
            this._initializePuzzle(dummyImageInfo, pieceCount);
        };
        img.src = src;
    }

    _initializePuzzle(imageInfo, pieceCount) {
        if (!imageInfo || pieceCount <= 0) return;

        const targetPieceArea = (imageInfo.width * imageInfo.height) / pieceCount;
        const pieceDim = Math.sqrt(targetPieceArea); // Target square piece dimension
        const pieceSize = Math.min(imageInfo.width, imageInfo.height) / Math.sqrt(pieceCount);

        const cols = Math.round(imageInfo.width / pieceSize);
        const rows = Math.round(imageInfo.height / pieceSize);
        const actualPieceWidth = imageInfo.width / cols;
        const actualPieceHeight = imageInfo.height / rows;

        const scatterFactor = 2; // Scatter area is 2x image size
        const scatterWidth = imageInfo.width * scatterFactor;
        const scatterHeight = imageInfo.height * scatterFactor;
        const scatterOffsetX = -imageInfo.width * (scatterFactor - 1) / 2;
        const scatterOffsetY = -imageInfo.height * (scatterFactor - 1) / 2;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('viewBox', `${scatterOffsetX} ${scatterOffsetY} ${scatterWidth} ${scatterHeight}`);

        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
        pattern.setAttribute('id', 'img-pattern'); // Simple pattern ID
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');
        pattern.setAttribute('width', imageInfo.width);
        pattern.setAttribute('height', imageInfo.height);
        const imgEl = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        imgEl.setAttributeNS('http://www.w3.org/1999/xlink', 'href', imageInfo.url);
        imgEl.setAttribute('width', imageInfo.width);
        imgEl.setAttribute('height', imageInfo.height);
        imgEl.setAttribute('x', 0); // Image positioned at (0,0) in pattern space
        imgEl.setAttribute('y', 0);
        pattern.appendChild(imgEl);
        defs.appendChild(pattern);
        svg.appendChild(defs);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const pieceId = r * cols + c;
                const originX = c * actualPieceWidth;
                const originY = r * actualPieceHeight;

                const pieceData = new Piece(pieceId, originX, originY, actualPieceWidth, actualPieceHeight);
                pieceData.randomizePlacement(scatterWidth, scatterHeight, scatterOffsetX, scatterOffsetY);

                const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                g.setAttribute('transform', `translate(${pieceData.currentX}, ${pieceData.currentY})`);

                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x', 0); // Relative to group origin
                rect.setAttribute('y', 0); // Relative to group origin
                rect.setAttribute('width', pieceData.width);
                rect.setAttribute('height', pieceData.height);
                rect.setAttribute('fill', 'url(#img-pattern)');

                // Apply pattern transform to show correct image section
                // Shift the pattern so that piece's origin (originX, originY) aligns with rect's origin (0,0)
                 rect.setAttribute('style', `
                    fill: url(#img-pattern);
                    transform-origin: ${pieceData.width / 2}px ${pieceData.height / 2}px; /* Rotate around rect center */
                    transform: rotate(${pieceData.rotation}deg);
                 `);
                 rect.style.fill = `url(#img-pattern)`; // Apply fill via style might override patternTransform
                 // Let's put translate and rotate on the <g> element as planned.

                g.setAttribute('transform', `translate(${pieceData.currentX}, ${pieceData.currentY}) rotate(${pieceData.rotation} ${pieceData.width / 2} ${pieceData.height / 2})`);

                // Apply pattern transform to the rect fill itself or the pattern.
                // Applying to pattern is better if all pieces use the same pattern.
                // We need to shift the pattern's view relative to the rect.
                // patternTransform="translate(tx ty)"
                // The piece's origin (originX, originY) should map to the rect's (0,0).
                // So, pattern needs to shift by (-originX, -originY).
                pattern.setAttribute('patternTransform', `translate(${-pieceData.originX}, ${-pieceData.originY})`);
                // This will apply the SAME pattern transform to ALL pieces referencing this pattern.
                // We need a UNIQUE pattern transform per piece.
                // This means each piece needs its OWN pattern, or use <use> elements with transformations.

                // Simplest: A single pattern for the whole image, applied to each rect,
                // but the pattern transform is applied directly to the *fill* property on the rect style.
                // This is non-standard and doesn't work.
                // Standard SVG requires patternTransform on the pattern, or using <use> elements referencing piece shapes.
                // Or, define pattern per piece in defs.

                // Let's go back to a single pattern, but the pieces are `<use>` elements referencing a template rect/path.
                // Or simpler: each <rect> has a clip-path referencing a <path> for its shape (rectangle for now),
                // and the fill is the single pattern. The pattern needs to be positioned relative to the overall image.
                // The <image> inside the pattern should have x/y -piece.originX/-piece.originY.

                // Let's use the single pattern + rect + clip-path approach (rectangle clip path for now).
                // Piece rects are at (currentX, currentY), width/height.
                // Clip path defines the piece shape (rectangle) in *piece local* coords (0,0 to width,height).
                // Fill is the pattern. Pattern shows image relative to piece origin.

                // Remove the <g> and rotation transform from it.
                // Place rect directly at (currentX, currentY).
                // Apply rotation transform to the rect.

                rect.setAttribute('x', pieceData.currentX);
                rect.setAttribute('y', pieceData.currentY);
                rect.setAttribute('width', pieceData.width);
                rect.setAttribute('height', pieceData.height);
                rect.setAttribute('fill', 'url(#img-pattern)');

                 // Apply rotation transform to the rect around its center
                 const rotateTransform = `rotate(${pieceData.rotation} ${pieceData.currentX + pieceData.width / 2} ${pieceData.currentY + pieceData.height / 2})`;
                 rect.setAttribute('transform', rotateTransform);

                // Clip path for square shape
                const clipPathId = `clip-piece-${pieceId}`;
                const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
                clipPath.setAttribute('id', clipPathId);
                const clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                clipRect.setAttribute('x', pieceData.originX); // Clip path rectangle in image coords
                clipRect.setAttribute('y', pieceData.originY);
                clipRect.setAttribute('width', pieceData.width);
                clipRect.setAttribute('height', pieceData.height);
                clipPath.appendChild(clipRect);
                defs.appendChild(clipPath);

                rect.setAttribute('clip-path', `url(#${clipPathId})`);

                // With a single pattern defined over the image size, and rects at their world positions (currentX, currentY),
                // the image segment should appear correctly. The clip path is also in world coords (originX, originY).

                svg.appendChild(rect); // Append the rect
            }
        }

        this.shadowRoot.innerHTML = ''; // Clear existing content
        // Add basic styles
        const style = document.createElement('style');
        style.textContent = `
            :host { display: block; width: 100%; height: 100%; overflow: hidden; }
            svg { display: block; } /* Prevent extra space below SVG */
        `;
        this.shadowRoot.appendChild(style);
        this.shadowRoot.appendChild(svg);
    }
}

// Custom element definition will be in jigsawyer.js
// customElements.define('jigsaw-puzzle', JigsawPuzzle);