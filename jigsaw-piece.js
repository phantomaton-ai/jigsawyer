// jigsaw-piece.js - Web component for a single puzzle piece visualization.

import { createSelectEvent } from './select.js';
import { createMoveEvent } from './move.js';
import { createPlaceEvent } from './place.js';
import { createRotateEvent } from './rotate.js';

export class JigsawPiece extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._isDragging = false;
        this._pointerDownTimer = null; // For tap/double-tap detection
        this._lastPointerDownTime = 0;
    }

    static get observedAttributes() {
        return [
            'width', 'height', 'x', 'y', 'rotation',
            'image-url', 'image-width', 'image-height',
            'correct-x', 'correct-y', 'path-data',
            'selected'
        ];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue && name !== 'selected') return;
        this._updateRendering();
        if (name === 'selected') this._updateSelectedState();
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block; position: absolute; touch-action: none; user-select: none;
                    transition: transform 0.1s ease-out, left 0.1s ease-out, top 0.1s ease-out;
                }
                svg { width: 100%; height: 100%; overflow: visible; }
                #img-pattern { patternUnits: userSpaceOnUse; }
                .piece-shape { stroke: black; stroke-width: 1; vector-effect: non-scaling-stroke; cursor: grab; }
                :host([selected]) .piece-shape { stroke: gold; stroke-width: 2; cursor: grabbing; }
            </style>
            <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                <defs>
                    <pattern id="img-pattern" patternUnits="userSpaceOnUse"><image id="img-in-pattern"></image></pattern>
                    <clipPath id="piece-clip"><path id="piece-clip-path"></path></clipPath>
                </defs>
                <path class="piece-shape" fill="url(#img-pattern)" clip-path="url(#piece-clip)"></path>
            </svg>
        `;
        this._updateRendering();
        this._addEventListeners();
        this._updateSelectedState();
    }

    _updateRendering() {
        const w = parseFloat(this.getAttribute('width') || 0);
        const h = parseFloat(this.getAttribute('height') || 0);
        const x = parseFloat(this.getAttribute('x') || 0);
        const y = parseFloat(this.getAttribute('y') || 0);
        const rot = parseFloat(this.getAttribute('rotation') || 0);
        const url = this.getAttribute('image-url') || '';
        const imgW = parseFloat(this.getAttribute('image-width') || 0);
        const imgH = parseFloat(this.getAttribute('image-height') || 0);
        const corrX = parseFloat(this.getAttribute('correct-x') || 0);
        const corrY = parseFloat(this.getAttribute('correct-y') || 0);
        let path = this.getAttribute('path-data');

        this.style.left = `${x}px`;
        this.style.top = `${y}px`;
        this.style.width = `${w}px`;
        this.style.height = `${h}px`;
        this.style.transformOrigin = 'center center';
        this.style.transform = `rotate(${rot}deg)`;

        const svg = this.shadowRoot.querySelector('svg');
        const img = this.shadowRoot.querySelector('#img-in-pattern');
        const clipPath = this.shadowRoot.querySelector('#piece-clip-path');
        const shape = this.shadowRoot.querySelector('.piece-shape');
        const pattern = this.shadowRoot.querySelector('#img-pattern');

        if (!svg || !img || !clipPath || !shape || !pattern) return;

        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

        if (url && imgW > 0 && imgH > 0) {
            img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', url);
            img.setAttribute('width', imgW); img.setAttribute('height', imgH);
            img.setAttribute('x', -corrX); img.setAttribute('y', -corrY);
            pattern.setAttribute('width', imgW); pattern.setAttribute('height', imgH);
        } else { img.removeAttributeNS('http://www.w3.org/1999/xlink', 'href'); }

        if (!path || w <= 0 || h <= 0) path = `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
        clipPath.setAttribute('d', path);
        shape.setAttribute('d', path);
    }

    _updateSelectedState() {
         const shape = this.shadowRoot.querySelector('.piece-shape');
         if (shape) {
             shape.classList.toggle('selected', this.hasAttribute('selected'));
         }
         if (this.hasAttribute('selected')) this.style.zIndex = '1'; else this.style.zIndex = '';
    }

    _addEventListeners() {
        this.addEventListener('mousedown', this._onPointerDown.bind(this));
        this.addEventListener('touchstart', this._onPointerDown.bind(this), { passive: false });
         // Add double-click listener
        this.addEventListener('dblclick', this._onDoubleClick.bind(this));
         // Handle double-tap on touch devices (dblclick often doesn't fire reliably)
         // Single touchstart/touchend pairs will be used to detect double-tap manually
    }

    _onPointerDown(event) {
        if ((event.type === 'mousedown' && event.button !== 0) || (event.type === 'touchstart' && event.touches.length > 1)) return;
        event.preventDefault(); event.stopPropagation();

        const clientX = event.clientX || event.touches[0].clientX;
        const clientY = event.clientY || event.touches[0].clientY;
        const pieceId = parseInt(this.getAttribute('piece-id'), 10);

        // --- Double-tap detection for touch devices ---
        if (event.type === 'touchstart') {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - this._lastPointerDownTime;
            const DOUBLE_TAP_THRESHOLD = 300; // ms

            if (tapLength < DOUBLE_TAP_THRESHOLD && tapLength > 0) {
                // This looks like the second tap of a double-tap
                console.log(`Piece ${pieceId}: Double-tap detected.`);
                // Dispatch rotate event
                this.dispatchEvent(createRotateEvent(pieceId, 1)); // 1 counter-clockwise turn
                this._lastPointerDownTime = 0; // Reset timer
                // Prevent drag from starting after double-tap
                return;
            } else {
                // First tap, start timer
                this._lastPointerDownTime = currentTime;
                 // Clear any previous pending timer
                 if (this._pointerDownTimer) clearTimeout(this._pointerDownTimer);
                 // Set a timer to clear _lastPointerDownTime if no second tap comes soon
                 this._pointerDownTimer = setTimeout(() => {
                     this._lastPointerDownTime = 0;
                     this._pointerDownTimer = null;
                 }, DOUBLE_TAP_THRESHOLD);
            }
        }
        // --- End Double-tap detection ---


        // If not handling as double-tap, dispatch select event and start drag
        this.dispatchEvent(createSelectEvent(pieceId, clientX, clientY));

        this._isDragging = true;
        this._onPointerMoveBound = this._onPointerMove.bind(this);
        this._onPointerUpBound = this._onPointerUp.bind(this);
        window.addEventListener('mousemove', this._onPointerMoveBound);
        window.addEventListener('mouseup', this._onPointerUpBound);
        window.addEventListener('touchmove', this._onPointerMoveBound, { passive: false });
        window.addEventListener('touchend', this._onPointerUpBound, { passive: false });
        window.addEventListener('touchcancel', this._onPointerUpBound, { passive: false });
    }

     // Handle standard dblclick event for mouse
    _onDoubleClick(event) {
        event.preventDefault(); event.stopPropagation();
        const pieceId = parseInt(this.getAttribute('piece-id'), 10);
        console.log(`Piece ${pieceId}: Double-click detected.`);
        // Dispatch rotate event
        this.dispatchEvent(createRotateEvent(pieceId, 1)); // 1 counter-clockwise turn
    }


    _onPointerMove(event) {
        if (!this._isDragging) return;
        event.preventDefault();

        const pointer = event.touches ? event.touches[0] : event;
        const clientX = pointer.clientX;
        const clientY = pointer.clientY;
        const pieceId = parseInt(this.getAttribute('piece-id'), 10);

        this.dispatchEvent(createMoveEvent(pieceId, clientX, clientY));
    }

    _onPointerUp(event) {
        if (!this._isDragging) return;
        event.preventDefault();

        this._isDragging = false;
        window.removeEventListener('mousemove', this._onPointerMoveBound);
        window.removeEventListener('mouseup', this._onPointerUpBound);
        window.removeEventListener('touchmove', this._onPointerMoveBound);
        window.removeEventListener('touchend', this._onPointerUpBound);
        window.removeEventListener('touchcancel', this._onPointerUpBound);

        const pieceId = parseInt(this.getAttribute('piece-id'), 10);
        this.dispatchEvent(createPlaceEvent(pieceId));

         // If a timer was started for double-tap, clear it as the drag/up sequence cancelled the tap
         if (this._pointerDownTimer) {
            clearTimeout(this._pointerDownTimer);
            this._pointerDownTimer = null;
            this._lastPointerDownTime = 0; // Reset tap state
         }
    }
}

customElements.define('jigsaw-piece', JigsawPiece);