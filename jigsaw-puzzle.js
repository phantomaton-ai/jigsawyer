// jigsaw-puzzle.js - Main custom element (<jigsaw-puzzle>).
// Orchestrates piece data, scaling, and handles drag/rotate events.

import { ImageInfo } from './image-info.js';
import { Piece } from './piece.js'; // Need Piece data model to store rotation
import { JigsawPiece } from './jigsaw-piece.js';
import { createSelectEvent } from './select.js';
import { createMoveEvent } from './move.js';
import { createPlaceEvent } from './place.js';
import { createRotateEvent } from './rotate.js';

const DEFAULT_IMAGE_WIDTH = 1344;
const DEFAULT_IMAGE_HEIGHT = 960;
const DEFAULT_PIECE_COUNT = 40;

export class JigsawPuzzle extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._imageInfo = null;
        this._pieces = []; // Array of Piece domain models
        this._container = null;
        this._jigsawPieces = new Map(); // Map<pieceId, JigsawPiece HTMLElement>
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
        this._addEventListeners();

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

        this._pieces = []; // Clear previous data models
        Array.from(this._container.children).forEach(c => c.remove()); // Clear old pieces
        this._jigsawPieces = new Map(); // Clear map

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const id = r * cols + c;
                const oX = c * pW; const oY = r * pH; // Origin in image pixels (world units)
                const pieceData = new Piece(id, oX, oY, pW, pH);
                pieceData.randomizePlacement(sW, sH, sOX, sOY);
                this._pieces.push(pieceData); // Store data model

                const pieceEl = document.createElement('jigsaw-piece');
                pieceEl.setAttribute('piece-id', id);
                pieceEl.setAttribute('width', pieceData.width);
                pieceEl.setAttribute('height', pieceData.height);
                pieceEl.setAttribute('x', pieceData.currentX);
                pieceEl.setAttribute('y', pieceData.currentY);
                pieceEl.setAttribute('rotation', pieceData.rotation); // Store initial rotation
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
        this._updateScale();
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
        this.addEventListener('rotate', this._handleRotate.bind(this)); // Listen for rotate event
        this._container.addEventListener('click', this._handleBackgroundClick.bind(this));
    }

    // --- Event Handlers ---
    _handleSelect(event) {
        event.stopPropagation();
        const { pieceId, clientX, clientY } = event.detail;
        const pieceEl = this._jigsawPieces.get(pieceId);
        if (!pieceEl) return;

        if (this._selectedPieceId !== null && this._selectedPieceId !== pieceId) {
            const prevEl = this._jigsawPieces.get(this._selectedPieceId);
            if (prevEl) prevEl.removeAttribute('selected');
        }

        this._selectedPieceId = pieceId;
        pieceEl.setAttribute('selected', '');

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
        if (!pieceEl || !this._container) return;

        const hostRect = this.getBoundingClientRect();
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

        const pieceEl = this._jigsawPieces.get(pieceId);
        if (pieceEl) pieceEl.removeAttribute('selected');

        this._selectedPieceId = null;
        this._dragOffsetX = 0;
        this._dragOffsetY = 0;
    }

    _handleRotate(event) {
        event.stopPropagation();
        const { pieceId, turns } = event.detail;
        const pieceEl = this._jigsawPieces.get(pieceId);
        if (!pieceEl) return;

        // Get current rotation, add turns, normalize
        let currentRotation = parseFloat(pieceEl.getAttribute('rotation') || 0);
        let newRotation = currentRotation + (turns * -90); // Counter-clockwise

        // Keep rotation within 0-360 range
        newRotation = (newRotation % 360 + 360) % 360;

        // Update the rotation attribute on the piece element
        pieceEl.setAttribute('rotation', newRotation);

        // Note: Snapping on rotation is not implemented yet.
    }

    _handleBackgroundClick(event) {
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
