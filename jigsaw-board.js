// jigsaw-board.js - Simple component that renders a grid of dots and dispatches interaction events

import { createPanEvent } from './pan.js';
import { createZoomEvent } from './zoom.js';

/**
 * JigsawBoard - Renders a grid of dots and dispatches pan/zoom events
 */
export class JigsawBoard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        
        // Interaction tracking
        this._isPanning = false;
        this._panStartX = 0;
        this._panStartY = 0;
    }
    
    static get observedAttributes() {
        return ['rows', 'cols', 'grid-width', 'grid-height'];
    }
    
    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;
        
        // Only redraw the grid if one of its defining properties changes
        if (['rows', 'cols', 'grid-width', 'grid-height'].includes(name)) {
            this._drawGrid();
        }
    }
    
    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    position: relative;
                    width: 100%;
                    height: 100%;
                    background-color: #1a1a1a;
                    overflow: hidden;
                    user-select: none;
                    touch-action: none;
                }
                svg {
                    width: 100%;
                    height: 100%;
                }
                .grid-dot {
                    fill: rgba(255, 255, 255, 0.2);
                }
                ::slotted(*) {
                    position: absolute;
                }
            </style>
            <svg>
                <g class="grid-group"></g>
            </svg>
            <slot></slot>
        `;
        
        // Add basic event listeners
        this.addEventListener('mousedown', this._onMouseDown.bind(this));
        this.addEventListener('mousemove', this._onMouseMove.bind(this));
        this.addEventListener('mouseup', this._onMouseUp.bind(this));
        this.addEventListener('mouseleave', this._onMouseUp.bind(this));
        this.addEventListener('wheel', this._onWheel.bind(this), { passive: false });
        
        // Simple touch handling
        this.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: false });
        this.addEventListener('touchmove', this._onTouchMove.bind(this), { passive: false });
        this.addEventListener('touchend', this._onTouchEnd.bind(this));
        
        // Draw initial grid
        this._drawGrid();
    }
    
    /**
     * Draws the grid of dots based on attributes
     */
    _drawGrid() {
        const gridGroup = this.shadowRoot.querySelector('.grid-group');
        if (!gridGroup) return;
        
        // Clear existing grid
        gridGroup.innerHTML = '';
        
        // Get grid parameters from attributes
        const rows = parseInt(this.getAttribute('rows'), 10) || 0;
        const cols = parseInt(this.getAttribute('cols'), 10) || 0;
        const gridWidth = parseFloat(this.getAttribute('grid-width')) || 0;
        const gridHeight = parseFloat(this.getAttribute('grid-height')) || 0;
        
        // Skip if we don't have valid parameters
        if (rows <= 0 || cols <= 0 || gridWidth <= 0 || gridHeight <= 0) return;
        
        // Set viewBox to match grid dimensions
        const svg = this.shadowRoot.querySelector('svg');
        svg.setAttribute('viewBox', `0 0 ${gridWidth} ${gridHeight}`);
        
        // Calculate piece dimensions
        const pieceWidth = gridWidth / cols;
        const pieceHeight = gridHeight / rows;
        
        // Draw dots at piece centers
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                dot.classList.add('grid-dot');
                dot.setAttribute('cx', c * pieceWidth + pieceWidth / 2);
                dot.setAttribute('cy', r * pieceHeight + pieceHeight / 2);
                dot.setAttribute('r', 2); // Small dot size
                gridGroup.appendChild(dot);
            }
        }
    }
    
    /**
     * Check if the event target is the background (not a piece)
     */
    _isBackground(target) {
        return target === this || this.shadowRoot.contains(target);
    }
    
    /**
     * Mouse down handler - start panning if clicking background
     */
    _onMouseDown(event) {
        if (event.button !== 0 || !this._isBackground(event.target)) return;
        
        event.preventDefault();
        this._isPanning = true;
        this._panStartX = event.clientX;
        this._panStartY = event.clientY;
        this.style.cursor = 'grabbing';
    }
    
    /**
     * Mouse move handler - dispatch pan events if panning
     */
    _onMouseMove(event) {
        if (!this._isPanning) return;
        
        event.preventDefault();
        const dx = event.clientX - this._panStartX;
        const dy = event.clientY - this._panStartY;
        
        this.dispatchEvent(createPanEvent(dx, dy));
        
        this._panStartX = event.clientX;
        this._panStartY = event.clientY;
    }
    
    /**
     * Mouse up/leave handler - end panning
     */
    _onMouseUp(event) {
        if (this._isPanning) {
            this._isPanning = false;
            this.style.cursor = '';
        }
    }
    
    /**
     * Wheel handler - dispatch zoom events
     */
    _onWheel(event) {
        if (!this._isBackground(event.target)) return;
        
        event.preventDefault();
        const factor = event.deltaY < 0 ? 1.1 : 0.9;
        
        const rect = this.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        this.dispatchEvent(createZoomEvent(factor, x, y));
    }
    
    /**
     * Touch start handler - start panning with touch
     */
    _onTouchStart(event) {
        if (!this._isBackground(event.target)) return;
        
        event.preventDefault();
        
        if (event.touches.length === 1) {
            this._isPanning = true;
            this._panStartX = event.touches[0].clientX;
            this._panStartY = event.touches[0].clientY;
        }
    }
    
    /**
     * Touch move handler - handle pan and pinch zoom
     */
    _onTouchMove(event) {
        if (!this._isPanning || !this._isBackground(event.target)) return;
        
        event.preventDefault();
        
        if (event.touches.length === 1) {
            const dx = event.touches[0].clientX - this._panStartX;
            const dy = event.touches[0].clientY - this._panStartY;
            
            this.dispatchEvent(createPanEvent(dx, dy));
            
            this._panStartX = event.touches[0].clientX;
            this._panStartY = event.touches[0].clientY;
        }
    }
    
    /**
     * Touch end handler - end panning
     */
    _onTouchEnd(event) {
        this._isPanning = false;
    }
}

customElements.define('jigsaw-board', JigsawBoard);