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
        this._pieces = [];
        this._piecesContainer = null;
    }

    static get observedAttributes() { return ['src', 'size']; }
    attributeChangedCallback(n, o, v) {
        if (!this.isConnected || o === v) return;
        if (n === 'src') this._loadImage(v);
        if (n === 'size' && this._imageInfo) this._init(this._imageInfo, parseInt(v, 10) || DEFAULT_PIECE_COUNT);
    }
    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <style>
                :host { display: block; position: relative; width: 100%; height: 100%; overflow: hidden; background-color: #1a1a1a; }
                #container { position: absolute; transform-origin: 0 0; }
                jigsaw-piece { position: absolute; }
            </style>
            <div id="container"></div>
        `;
        this._piecesContainer = this.shadowRoot.getElementById('container');
        this._resizeObserver = new ResizeObserver(() => this._updateScale());
        this._resizeObserver.observe(this);

        const src = this.getAttribute('src');
        if (src) this._loadImage(src);
        else this._init(new ImageInfo("placeholder", DEFAULT_IMAGE_WIDTH, DEFAULT_IMAGE_HEIGHT), parseInt(this.getAttribute('size'), 10) || DEFAULT_PIECE_COUNT);
    }

    disconnectedCallback() {
        if (this._resizeObserver) this._resizeObserver.disconnect();
    }

    _loadImage(src) {
        const img = new Image();
        img.onload = () => this._init(new ImageInfo(src, img.width, img.height), parseInt(this.getAttribute('size'), 10) || DEFAULT_PIECE_COUNT);
        img.onerror = () => {
            console.error(`Failed to load image: ${src}`);
            this._init(new ImageInfo("error", DEFAULT_IMAGE_WIDTH, DEFAULT_IMAGE_HEIGHT), parseInt(this.getAttribute('size'), 10) || DEFAULT_PIECE_COUNT);
        };
        img.src = src;
    }

    _init(imageInfo, pieceCount) {
        if (!imageInfo || pieceCount <= 0 || !this._piecesContainer) return;
        this._imageInfo = imageInfo;

        const pSize = Math.min(imageInfo.width, imageInfo.height) / Math.sqrt(pieceCount);
        const cols = Math.round(imageInfo.width / pSize);
        const rows = Math.round(imageInfo.height / pSize);
        const pW = imageInfo.width / cols; // Piece width (world units)
        const pH = imageInfo.height / rows; // Piece height (world units)

        const sF = 2; // Scatter factor
        const sW = imageInfo.width * sF; // Scatter width (world units)
        const sH = imageInfo.height * sF; // Scatter height (world units)
        const sOX = -imageInfo.width * (sF - 1) / 2; // Scatter origin X (world units)
        const sOY = -imageInfo.height * (sF - 1) / 2; // Scatter origin Y (world units)

        this._piecesContainer.style.width = `${sW}px`;
        this._piecesContainer.style.height = `${sH}px`;

        this._pieces = [];
        this._piecesContainer.innerHTML = '';

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const id = r * cols + c;
                const oX = c * pW; const oY = r * pH; // Piece origin (world units)
                const pieceData = new Piece(id, oX, oY, pW, pH);
                pieceData.randomizePlacement(sW, sH, sOX, sOY); // Randomize within scatter area

                const pieceEl = document.createElement('jigsaw-piece');
                pieceEl.setAttribute('piece-id', id);
                pieceEl.setAttribute('width', pieceData.width);
                pieceEl.setAttribute('height', pieceData.height);
                pieceEl.setAttribute('x', pieceData.currentX); // Current X (world units)
                pieceEl.setAttribute('y', pieceData.currentY); // Current Y (world units)
                pieceEl.setAttribute('rotation', pieceData.rotation);
                pieceEl.setAttribute('image-url', imageInfo.url);
                pieceEl.setAttribute('image-width', imageInfo.width);
                pieceEl.setAttribute('image-height', imageInfo.height);
                pieceEl.setAttribute('correct-x', pieceData.originX);
                pieceEl.setAttribute('correct-y', pieceData.originY);
                pieceEl.setAttribute('path-data', `M 0 0 L ${pW} 0 L ${pW} ${pH} L 0 ${pH} Z`);

                this._piecesContainer.appendChild(pieceEl);
                this._pieces.push(pieceData);
            }
        }
        this._updateScale();
    }

    _updateScale() {
        if (!this._piecesContainer || !this._imageInfo) return;

        const hostRect = this.getBoundingClientRect();
        const hostW = hostRect.width;
        const hostH = hostRect.height;
        const containerW = parseFloat(this._piecesContainer.style.width);
        const containerH = parseFloat(this._piecesContainer.style.height);

        if (hostW <= 0 || hostH <= 0 || containerW <= 0 || containerH <= 0) return;

        const scale = Math.min(hostW / containerW, hostH / containerH);
        const translateX = (hostW - containerW * scale) / 2;
        const translateY = (hostH - containerH * scale) / 2;

        this._piecesContainer.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    }
}

customElements.define('jigsaw-puzzle', JigsawPuzzle);