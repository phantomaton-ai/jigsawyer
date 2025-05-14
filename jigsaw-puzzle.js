// jigsaw-puzzle.js - Main custom element (<jigsaw-puzzle>).
// Orchestrates piece data, scaling, and handles drag events.

import { ImageInfo } from './image-info.js';
import { Piece } from './piece.js';
import { JigsawPiece } from './jigsaw-piece.js';
import { createSelectEvent } from './select.js';
import { createMoveEvent } from './move.js';
import { createPlaceEvent } from './place.js';

const DEFAULT_IMAGE_WIDTH = 1344;
const DEFAULT_IMAGE_HEIGHT = 960;
const DEFAULT_PIECE_COUNT = 40;

export class JigsawPuzzle extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._imageInfo = null;
        this._pieces = [];
        this._container = null; // Renamed from _piecesContainer for brevity
        this._jigsawPieces = new Map();
        this._selectedPieceId = null;
        this._dragOffsetX = 0;
        this._dragOffsetY = 0;
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
        this._container = this.shadowRoot.getElementById('container');
        this._resizeObserver = new ResizeObserver(() => this._updateScale());
        this._resizeObserver.observe(this);
        this._addEventListeners(); // Add event listeners

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
        if (!imageInfo || pieceCount <= 0 || !this._container) return;
        this._imageInfo = imageInfo;

        const pSize = Math.min(imageInfo.width, imageInfo.height) / Math.sqrt(pieceCount);
        const cols = Math.round(imageInfo.width / pSize);
        const rows = Math.round(imageInfo.height / pSize);
        const pW = imageInfo.width / cols;
        const pH = imageInfo.height / rows;

        const sF = 2;
        const sW = imageInfo.width * sF; // Scatter width (world units)
        const sH = imageInfo.height * sF; // Scatter height (world units)
        const sOX = -imageInfo.width * (sF - 1) / 2; // Scatter origin X (world units)
        const sOY = -imageInfo.height * (sF - 1) / 2; // Scatter origin Y (world units)

        this._container.style.width = `${sW}px`;
        this._container.style.height = `${sH}px`;

        this._pieces = [];
        Array.from(this._container.children).forEach(c => c.remove()); // Clear old pieces
        this._jigsawPieces = new Map();

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const id = r * cols + c;
                const oX = c * pW; const oY = r * pH;
                const pieceData = new Piece(id, oX, oY, pW, pH);
                pieceData.randomizePlacement(sW, sH, sOX, sOY);
                this._pieces.push(pieceData);

                const pieceEl = document.createElement('jigsaw-piece');
                pieceEl.setAttribute('piece-id', id);
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
                pieceEl.setAttribute('path-data', `M 0 0 L ${pW} 0 L ${pW} ${pH} L 0 ${pH} Z`);

                this._container.appendChild(pieceEl);
                this._jigsawPieces.set(id, pieceEl);
            }
        }
        this._updateScale(); // Apply initial scale and centering
    }

    _updateScale() {
        if (!this._container || !this._imageInfo) return;

        const hostRect = this.getBoundingClientRect();
        const hostW = hostRect.width;
        const hostH = hostRect.height;
        const containerW = parseFloat(this._container.style.width);
        const containerH = parseFloat(this._container.style.height);

        if (hostW <= 0 || hostH <= 0 || containerW <= 0 || containerH <= 0) return;

        const scale = Math.min(hostW / containerW, hostH / containerH);
        const translateX = (hostW - containerW * scale) / 2;
        const translateY = (hostH - containerH * scale) / 2;

        this._container.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    }

    // --- Event Listeners ---
    _addEventListeners() {
        this.addEventListener('select', this._handleSelect.bind(this));
        this.addEventListener('move', this._handleMove.bind(this));
        this.addEventListener('place', this._handlePlace.bind(this));
        // Listen for clicks on the container background to deselect
        this._container.addEventListener('click', this._handleBackgroundClick.bind(this));
    }

    // --- Event Handlers ---
    _handleSelect(event) {
        event.stopPropagation();
        const { pieceId, clientX, clientY } = event.detail;

        // Deselect previously selected piece
        if (this._selectedPieceId !== null && this._selectedPieceId !== pieceId) {
            const prevEl = this._jigsawPieces.get(this._selectedPieceId);
            if (prevEl) prevEl.removeAttribute('selected');
        }

        // Select the new piece
        this._selectedPieceId = pieceId;
        const pieceEl = this._jigsawPieces.get(pieceId);
        if (!pieceEl) return;
        pieceEl.setAttribute('selected', ''); // Triggers view update

        // Calculate drag offset in world coordinates
        const hostRect = this.getBoundingClientRect();
        const containerRect = this._container.getBoundingClientRect();
        const scale = containerRect.width / parseFloat(this._container.style.width);

        const pointerScreenX = clientX - hostRect.left;
        const pointerScreenY = clientY - hostRect.top;

        const pointerWorldX = (pointerScreenX - containerRect.left) / scale;
        const pointerWorldY = (pointerScreenY - containerRect.top) / scale;

        this._dragOffsetX = pointerWorldX - parseFloat(pieceEl.getAttribute('x') || 0);
        this._dragOffsetY = pointerWorldY - parseFloat(pieceEl.getAttribute('y') || 0);
    }

    _handleMove(event) {
        event.stopPropagation();
        const { pieceId, clientX, clientY } = event.detail;
        if (this._selectedPieceId !== pieceId) return;

        const pieceEl = this._jigsawPieces.get(pieceId);
        if (!pieceEl || !this._container) return; // Check if container is available

        const hostRect = this.getBoundingClientRect(); // Use hostRect to get position relative to viewport
        const containerRect = this._container.getBoundingClientRect();
        const scale = containerRect.width / parseFloat(this._container.style.width);

        const pointerScreenX = clientX - hostRect.left;
        const pointerScreenY = clientY - hostRect.top;

        const pointerWorldX = (pointerScreenX - containerRect.left) / scale;
        const pointerWorldY = (pointerScreenY - containerRect.top) / scale;

        const newPieceWorldX = pointerWorldX - this._dragOffsetX;
        const newPieceWorldY = pointerWorldY - this._dragOffsetY;

        pieceEl.setAttribute('x', newPieceWorldX);
        pieceEl.setAttribute('y', newPieceWorldY);
    }

    _handlePlace(event) {
        event.stopPropagation();
        const { pieceId } = event.detail;
        if (this._selectedPieceId !== pieceId) return;

        // Snapping logic would go here. Omitted for now.

        const pieceEl = this._jigsawPieces.get(pieceId);
        if (pieceEl) pieceEl.removeAttribute('selected');

        this._selectedPieceId = null;
        this._dragOffsetX = 0;
        this._dragOffsetY = 0;
    }
    
    _handleBackgroundClick(event) {
        // If click target is the container itself and a piece is selected, deselect.
        if (event.target === this._container && this._selectedPieceId !== null) {
             const pieceEl = this._jigsawPieces.get(this._selectedPieceId);
             if (pieceEl) pieceEl.removeAttribute('selected');
             this._selectedPieceId = null;
             this._dragOffsetX = 0;
             this._dragOffsetY = 0;
        }
    }
}

customElements.define('jigsaw-puzzle', JigsawPuzzle);