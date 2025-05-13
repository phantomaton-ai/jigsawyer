// jigsaw-puzzle.js - Main custom element (<jigsaw-puzzle>) to display square pieces.
// Orchestrates piece data generation and adds jigsaw-piece web components to the DOM.

import { ImageInfo } from './image-info.js';
import { Piece } from './piece.js';
import { JigsawPiece } from './jigsaw-piece.js'; // Assume JigsawPiece is the Custom Element

const DEFAULT_IMAGE_WIDTH = 1344;
const DEFAULT_IMAGE_HEIGHT = 960;
const DEFAULT_PIECE_COUNT = 40;

export class JigsawPuzzle extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._imageInfo = null;
        this._pieces = []; // Array of Piece domain models
        this._piecesContainer = null; // Container for piece elements
    }

    static get observedAttributes() { return ['src', 'size']; }
    attributeChangedCallback(n, o, v) {
        if (!this.isConnected || o === v) return;
        if (n === 'src') this._loadImage(v);
        if (n === 'size' && this._imageInfo) this._initializePuzzle(this._imageInfo, parseInt(v, 10) || DEFAULT_PIECE_COUNT);
    }
    connectedCallback() {
        // Create a container for the pieces
        this.shadowRoot.innerHTML = '<div id="pieces-container" style="position: relative; width: 100%; height: 100%;"></div>';
        this._piecesContainer = this.shadowRoot.getElementById('pieces-container');

        // Basic styling to make the host element fill its container
        const style = document.createElement('style');
        style.textContent = `:host { display: block; width: 100%; height: 100%; overflow: hidden; }`;
        this.shadowRoot.insertBefore(style, this.shadowRoot.firstChild);


        const src = this.getAttribute('src');
        if (src) this._loadImage(src);
        else this._initializePuzzle(new ImageInfo("placeholder", DEFAULT_IMAGE_WIDTH, DEFAULT_IMAGE_HEIGHT), parseInt(this.getAttribute('size'), 10) || DEFAULT_PIECE_COUNT);
    }

    _loadImage(src) {
        const img = new Image();
        img.onload = () => this._initializePuzzle(new ImageInfo(src, img.width, img.height), parseInt(this.getAttribute('size'), 10) || DEFAULT_PIECE_COUNT);
        img.onerror = () => {
            console.error(`Failed to load image: ${src}`);
            this._initializePuzzle(new ImageInfo("error", DEFAULT_IMAGE_WIDTH, DEFAULT_IMAGE_HEIGHT), parseInt(this.getAttribute('size'), 10) || DEFAULT_PIECE_COUNT);
        };
        img.src = src;
    }

    _initializePuzzle(imageInfo, pieceCount) {
        if (!imageInfo || pieceCount <= 0 || !this._piecesContainer) return;

        // Determine grid size aiming for square pieces relative to image aspect ratio
        const pieceAspectRatio = imageInfo.width / imageInfo.height;
        const cols = Math.round(Math.sqrt(pieceCount * pieceAspectRatio));
        const rows = Math.round(pieceCount / cols);
        const pW = imageInfo.width / cols; // Actual piece width in image pixels
        const pH = imageInfo.height / rows; // Actual piece height in image pixels

        // Define a scatter area larger than the puzzle itself in image pixels
        const sF = 2; // Scatter factor
        const sW = imageInfo.width * sF;
        const sH = imageInfo.height * sF;
        const sOX = -imageInfo.width * (sF - 1) / 2; // Offset to center the original image area
        const sOY = -imageInfo.height * (sF - 1) / 2;

        this._pieces = [];
        this._piecesContainer.innerHTML = ''; // Clear existing piece elements

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const id = r * cols + c;
                const oX = c * pW; const oY = r * pH;
                const pieceData = new Piece(id, oX, oY, pW, pH);
                // Randomize placement within the scatter area (using image pixel coordinates)
                pieceData.randomizePlacement(sW, sH, sOX, sOY);
                this._pieces.push(pieceData);

                // Create the jigsaw-piece custom element
                const pieceEl = document.createElement('jigsaw-piece');
                // Pass piece data as attributes (in image pixel coordinates)
                pieceEl.setAttribute('width', pieceData.width);
                pieceEl.setAttribute('height', pieceData.height);
                pieceEl.setAttribute('x', pieceData.currentX);
                pieceEl.setAttribute('y', pieceData.currentY);
                pieceEl.setAttribute('rotation', pieceData.rotation); // Degrees
                pieceEl.setAttribute('image-url', imageInfo.url);
                pieceEl.setAttribute('image-width', imageInfo.width);
                pieceEl.setAttribute('image-height', imageInfo.height);
                pieceEl.setAttribute('correct-x', pieceData.originX);
                pieceEl.setAttribute('correct-y', pieceData.originY);
                // Simple square path data (local to the piece's SVG 0,0)
                pieceEl.setAttribute('path-data', `M 0 0 L ${pW} 0 L ${pW} ${pH} L 0 ${pH} Z`);


                // Append the custom element to the pieces container div
                this._piecesContainer.appendChild(pieceEl);
            }
        }
        // Note: Viewport/Pan/Zoom/Controls/Grid are omitted for simplicity as requested.
        // The pieces-container div represents the "world" space, and its contents are in image pixels.
        // The jigsaw-puzzle component's size (set by parent CSS) acts as the initial viewport size.
        // The piece elements' CSS `left`/`top` will position them within this div.
    }
}

customElements.define('jigsaw-puzzle', JigsawPuzzle);