// jigsaw-puzzle.js - Main custom element (<jigsaw-puzzle>) to display square pieces.
// Manages scaling and positions pieces within a scaled container.

import { ImageInfo } from './image-info.js';
import { Piece } from './piece.js';
import { JigsawPiece } from './jigsaw-piece.js'; // Assume JigsawPiece is the Custom Element

const DEFAULT_IMAGE_WIDTH = 1344;
const DEFAULT_IMAGE_HEIGHT = 960;
const DEFAULT_PIECE_COUNT = 40; // As requested

export class JigsawPuzzle extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._imageInfo = null;
        this._pieces = [];
        this._scaledContainer = null;
    }

    static get observedAttributes() { return ['src', 'size']; }
    attributeChangedCallback(n, o, v) {
        if (!this.isConnected || o === v) return;
        if (n === 'src') this._loadImage(v);
        if (n === 'size' && this._imageInfo) this._initializePuzzle(this._imageInfo, parseInt(v, 10) || DEFAULT_PIECE_COUNT);
    }
    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <style>
                :host { display: block; position: relative; width: 100%; height: 100%; overflow: hidden; background-color: #1a1a1a; }
                #scaled-container { position: absolute; transform-origin: 0 0; }
                jigsaw-piece { position: absolute; }
            </style>
            <div id="scaled-container"></div>
        `;
        this._scaledContainer = this.shadowRoot.getElementById('scaled-container');
        this._resizeObserver = new ResizeObserver(() => this._updateScale());
        this._resizeObserver.observe(this);

        const src = this.getAttribute('src');
        if (src) this._loadImage(src);
        else this._initializePuzzle(new ImageInfo("placeholder", DEFAULT_IMAGE_WIDTH, DEFAULT_IMAGE_HEIGHT), parseInt(this.getAttribute('size'), 10) || DEFAULT_PIECE_COUNT);
    }

    disconnectedCallback() {
        if (this._resizeObserver) this._resizeObserver.disconnect();
    }

    _loadImage(src) {
        const img = new Image();
        img.onload = () => {
            this._imageInfo = new ImageInfo(src, img.width, img.height);
            this._initializePuzzle(this._imageInfo, parseInt(this.getAttribute('size'), 10) || DEFAULT_PIECE_COUNT);
            this._updateScale();
        };
        img.onerror = () => {
            console.error(`Failed to load image: ${src}`);
            this._imageInfo = new ImageInfo("error", DEFAULT_IMAGE_WIDTH, DEFAULT_IMAGE_HEIGHT);
            this._initializePuzzle(this._imageInfo, parseInt(this.getAttribute('size'), 10) || DEFAULT_PIECE_COUNT);
            this._updateScale();
        };
        img.src = src;
    }

    _initializePuzzle(imageInfo, pieceCount) {
        if (!imageInfo || pieceCount <= 0 || !this._scaledContainer) return;

        const pA = (imageInfo.width * imageInfo.height) / pieceCount;
        const pDim = Math.sqrt(pA); // Ideal square piece size
        const pSize = Math.min(imageInfo.width, imageInfo.height) / Math.sqrt(pieceCount);
        const cols = Math.round(imageInfo.width / pSize);
        const rows = Math.round(imageInfo.height / pSize);
        const pW = imageInfo.width / cols; // Actual piece width in image pixels
        const pH = imageInfo.height / rows; // Actual piece height in image pixels

        const sF = 2; // Scatter factor for board area
        const sW = imageInfo.width * sF;
        const sH = imageInfo.height * sF;
        const sOX = -imageInfo.width * (sF - 1) / 2; // Scatter area origin X
        const sOY = -imageInfo.height * (sF - 1) / 2; // Scatter area origin Y

        // Set the size of the scaled container to match the full board/scatter area
        this._scaledContainer.style.width = `${sW}px`;
        this._scaledContainer.style.height = `${sH}px`;
        // Position the container at (0,0) relative to the host initially
        this._scaledContainer.style.left = '0';
        this._scaledContainer.style.top = '0';

        this._pieces = [];
        this._scaledContainer.innerHTML = ''; // Clear existing pieces

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const id = r * cols + c;
                const oX = c * pW; const oY = r * pH;
                const pieceData = new Piece(id, oX, oY, pW, pH);
                pieceData.randomizePlacement(sW, sH, sOX, sOY); // Randomize within scatter area

                const pieceEl = document.createElement('jigsaw-piece');
                pieceEl.setAttribute('width', pieceData.width);
                pieceEl.setAttribute('height', pieceData.height);
                pieceEl.setAttribute('x', pieceData.currentX);
                pieceEl.setAttribute('y', pieceData.currentY);
                pieceEl.setAttribute('rotation', pieceData.rotation);
                pieceEl.setAttribute('image-url', imageInfo.url);
                pieceEl.setAttribute('image-width', imageInfo.width);
                pieceEl.setAttribute('image-height', imageInfo.height);
                pieceEl.setAttribute('correct-x', pieceData.originX);
                pieceEl.setAttribute('correct-y', pieceData.originY);
                pieceEl.setAttribute('path-data', `M 0 0 L ${pW} 0 L ${pW} ${pH} L 0 ${pH} Z`); // Square path

                this._scaledContainer.appendChild(pieceEl);
                this._pieces.push(pieceData); // Store data model
            }
        }
        this._updateScale(); // Apply initial scale and centering
    }

    _updateScale() {
        if (!this._scaledContainer || !this._imageInfo) return;

        const hostRect = this.getBoundingClientRect();
        const hostWidth = hostRect.width;
        const hostHeight = hostRect.height;

        // Dimensions of the scaled container (scatter area in image pixels)
        const boardWidth = parseFloat(this._scaledContainer.style.width);
        const boardHeight = parseFloat(this._scaledContainer.style.height);

        if (hostWidth <= 0 || hostHeight <= 0 || boardWidth <= 0 || boardHeight <= 0) return;

        // Calculate scale factor to fit the board area within the host element ('contain')
        const scaleX = hostWidth / boardWidth;
        const scaleY = hostHeight / boardHeight;
        const scale = Math.min(scaleX, scaleY);

        // Calculate translation needed to center the scaled board area within the host.
        // The scaled board area has size (boardWidth * scale, boardHeight * scale).
        // It starts at (0,0) relative to the host if left/top are 0.
        // The translation needed is half the remaining space.
        const translateX = (hostWidth - boardWidth * scale) / 2;
        const translateY = (hostHeight - boardHeight * scale) / 2;

        // Apply combined transform: scale then translate.
        // `translate(tx, ty)` in scaled coordinates is `translate(tx/scale, ty/scale)` in unscaled coordinates.
        this._scaledContainer.style.transform = `scale(${scale}) translate(${translateX / scale}px, ${translateY / scale}px)`;
    }
}

customElements.define('jigsaw-puzzle', JigsawPuzzle);