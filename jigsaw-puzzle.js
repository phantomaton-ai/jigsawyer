// jigsaw-puzzle.js - Main custom element (<jigsaw-puzzle>) to display square pieces.

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
    }

    static get observedAttributes() { return ['src', 'size']; }
    attributeChangedCallback(n, o, v) {
        if (o === v) return;
        if (n === 'src') this._loadImage(v);
        if (n === 'size' && this._imageInfo) this._initializePuzzle(this._imageInfo, parseInt(v, 10) || DEFAULT_PIECE_COUNT);
    }
    connectedCallback() {
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
        if (!imageInfo || pieceCount <= 0) return;

        const pieceSize = Math.min(imageInfo.width, imageInfo.height) / Math.sqrt(pieceCount);
        const cols = Math.round(imageInfo.width / pieceSize);
        const rows = Math.round(imageInfo.height / pieceSize);
        const pW = imageInfo.width / cols; // Actual piece width
        const pH = imageInfo.height / rows; // Actual piece height

        const sF = 2; // Scatter factor
        const sW = imageInfo.width * sF;
        const sH = imageInfo.height * sF;
        const sOX = -imageInfo.width * (sF - 1) / 2;
        const sOY = -imageInfo.height * (sF - 1) / 2;

        this._pieces = [];
        this.shadowRoot.innerHTML = ''; // Clear existing

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('viewBox', `${sOX} ${sOY} ${sW} ${sH}`); // ViewBox covers scatter area

        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
        pattern.setAttribute('id', 'img-pattern');
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');
        pattern.setAttribute('width', imageInfo.width);
        pattern.setAttribute('height', imageInfo.height);
        const imgEl = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        imgEl.setAttributeNS('http://www.w3.org/1999/xlink', 'href', imageInfo.url);
        imgEl.setAttribute('width', imageInfo.width);
        imgEl.setAttribute('height', imageInfo.height);
        pattern.appendChild(imgEl); defs.appendChild(pattern); svg.appendChild(defs);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const id = r * cols + c;
                const oX = c * pW; const oY = r * pH;
                const pieceData = new Piece(id, oX, oY, pW, pH);
                pieceData.randomizePlacement(sW, sH, sOX, sOY);
                this._pieces.push(pieceData);

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
                // Simple square path data
                pieceEl.setAttribute('path-data', `M 0 0 L ${pW} 0 L ${pW} ${pH} L 0 ${pH} Z`);

                svg.appendChild(pieceEl); // Append the custom element to the SVG
            }
        }
        this.shadowRoot.appendChild(svg);
    }
}

customElements.define('jigsaw-puzzle', JigsawPuzzle);