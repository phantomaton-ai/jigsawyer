// jigsaw-board.js - Component for the puzzle background grid and user interaction events

import { createPanEvent } from './pan.js';
import { createZoomEvent } from './zoom.js';

/**
 * JigsawBoard web component - renders the background grid and dispatches pan/zoom events
 * This is a "controlled component" that receives its configuration via attributes
 * and notifies its parent of user interactions through custom events.
 */
export class JigsawBoard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        
        // Grid configuration
        this._gridWidth = 0;
        this._gridHeight = 0;
        this._rows = 0;
        this._cols = 0;
        
        // Tracking for interaction events
        this._isPanning = false;
        this._panStartX = 0;
        this._panStartY = 0;
        this._touchCache = [];
    }
    
    static get observedAttributes() {
        return [
            'grid-width',   // Width of the grid in world units
            'grid-height',  // Height of the grid in world units
            'rows',         // Number of rows in the grid
            'cols',         // Number of columns in the grid
            'view-x',       // Current viewBox X origin
            'view-y',       // Current viewBox Y origin
            'view-width',   // Current viewBox width
            'view-height',  // Current viewBox height
            'transform'     // CSS transform string for pan/zoom
        ];
    }
    
    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;
        
        switch (name) {
            case 'grid-width':
                this._gridWidth = parseFloat(newValue) || 0;
                this._updateGrid();
                break;
            case 'grid-height':
                this._gridHeight = parseFloat(newValue) || 0;
                this._updateGrid();
                break;
            case 'rows':
                this._rows = parseInt(newValue, 10) || 0;
                this._updateGrid();
                break;
            case 'cols':
                this._cols = parseInt(newValue, 10) || 0;
                this._updateGrid();
                break;
            case 'view-x':
            case 'view-y':
            case 'view-width':
            case 'view-height':
                this._updateViewBox();
                break;
            case 'transform':
                this._updateTransform();
                break;
        }
    }
    
    connectedCallback() {
        // Create shadow DOM structure
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    width: 100%;
                    height: 100%;
                    overflow: hidden;
                    position: relative;
                    background-color: #1a1a1a;
                    user-select: none;
                    touch-action: none;
                }
                
                .container {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    transform-origin: 0 0;
                }
                
                svg {
                    position: absolute;
                    top: 0;
                    left: 0;
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
            
            <div class="container">
                <svg>
                    <g class="grid-group"></g>
                </svg>
                <slot></slot>
            </div>
        `;
        
        // Add event listeners for user interaction
        this._addEventListeners();
        
        // Initialize grid if attributes are already set
        this._updateGrid();
        this._updateViewBox();
        this._updateTransform();
    }
    
    disconnectedCallback() {
        // Clean up any resources
    }
    
    /**
     * Updates the grid dots based on rows, cols, and grid dimensions
     */
    _updateGrid() {
        const gridGroup = this.shadowRoot.querySelector('.grid-group');
        if (!gridGroup) return;
        
        // Clear existing grid
        gridGroup.innerHTML = '';
        
        // Check if we have enough information to draw the grid
        if (this._rows <= 0 || this._cols <= 0 || 
            this._gridWidth <= 0 || this._gridHeight <= 0) {
            return;
        }
        
        const pieceWidth = this._gridWidth / this._cols;
        const pieceHeight = this._gridHeight / this._rows;
        
        // Draw grid dots
        for (let r = 0; r < this._rows; r++) {
            for (let c = 0; c < this._cols; c++) {
                const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                dot.classList.add('grid-dot');
                dot.setAttribute('cx', c * pieceWidth + pieceWidth / 2);
                dot.setAttribute('cy', r * pieceHeight + pieceHeight / 2);
                dot.setAttribute('r', 3);
                gridGroup.appendChild(dot);
            }
        }
    }
    
    /**
     * Updates the SVG viewBox based on attributes
     */
    _updateViewBox() {
        const svg = this.shadowRoot.querySelector('svg');
        if (!svg) return;
        
        const viewX = parseFloat(this.getAttribute('view-x') || 0);
        const viewY = parseFloat(this.getAttribute('view-y') || 0);
        const viewWidth = parseFloat(this.getAttribute('view-width') || this._gridWidth || 100);
        const viewHeight = parseFloat(this.getAttribute('view-height') || this._gridHeight || 100);
        
        svg.setAttribute('viewBox', `${viewX} ${viewY} ${viewWidth} ${viewHeight}`);
    }
    
    /**
     * Updates the container transform based on the transform attribute
     */
    _updateTransform() {
        const container = this.shadowRoot.querySelector('.container');
        if (!container) return;
        
        const transform = this.getAttribute('transform');
        if (transform) {
            container.style.transform = transform;
        }
    }
    
    /**
     * Adds event listeners for user interaction
     */
    _addEventListeners() {
        // Mouse events
        this.addEventListener('mousedown', this._onMouseDown.bind(this));
        this.addEventListener('mousemove', this._onMouseMove.bind(this));
        this.addEventListener('mouseup', this._onMouseUp.bind(this));
        this.addEventListener('mouseleave', this._onMouseLeave.bind(this));
        
        // Touch events
        this.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: false });
        this.addEventListener('touchmove', this._onTouchMove.bind(this), { passive: false });
        this.addEventListener('touchend', this._onTouchEnd.bind(this), { passive: false });
        
        // Wheel event for zooming
        this.addEventListener('wheel', this._onWheel.bind(this), { passive: false });
    }
    
    /**
     * Checks if the event target is part of the board background
     * (not a slotted piece or other element)
     */
    _isBackgroundTarget(target) {
        // Check if the target is part of the board's shadow DOM or the host itself
        return target === this || 
               this.shadowRoot.contains(target);
    }
    
    _onMouseDown(event) {
        // Only handle primary button clicks on the background
        if (event.button !== 0 || !this._isBackgroundTarget(event.target)) return;
        
        event.preventDefault();
        this._isPanning = true;
        this._panStartX = event.clientX;
        this._panStartY = event.clientY;
        this.style.cursor = 'grabbing';
    }
    
    _onMouseMove(event) {
        if (!this._isPanning) return;
        
        event.preventDefault();
        const dx = event.clientX - this._panStartX;
        const dy = event.clientY - this._panStartY;
        
        // Dispatch pan event for parent to handle
        this.dispatchEvent(createPanEvent(dx, dy));
        
        // Update starting position for next move
        this._panStartX = event.clientX;
        this._panStartY = event.clientY;
    }
    
    _onMouseUp(event) {
        if (!this._isPanning) return;
        
        this._isPanning = false;
        this.style.cursor = '';
    }
    
    _onMouseLeave(event) {
        if (this._isPanning) {
            this._isPanning = false;
            this.style.cursor = '';
        }
    }
    
    _onTouchStart(event) {
        // Ignore if touching a piece
        if (!this._isBackgroundTarget(event.target)) return;
        
        event.preventDefault();
        
        if (event.touches.length === 1) {
            // Single touch - start panning
            this._isPanning = true;
            this._panStartX = event.touches[0].clientX;
            this._panStartY = event.touches[0].clientY;
        } else if (event.touches.length >= 2) {
            // Multi-touch - prepare for pinch zoom
            this._isPanning = false;
            this._touchCache = Array.from(event.touches).map(t => ({
                id: t.identifier,
                x: t.clientX,
                y: t.clientY
            }));
        }
    }
    
    _onTouchMove(event) {
        if (!this._isBackgroundTarget(event.target) && !this._isPanning) return;
        
        event.preventDefault();
        
        if (this._isPanning && event.touches.length === 1) {
            // Handle panning
            const dx = event.touches[0].clientX - this._panStartX;
            const dy = event.touches[0].clientY - this._panStartY;
            
            this.dispatchEvent(createPanEvent(dx, dy));
            
            this._panStartX = event.touches[0].clientX;
            this._panStartY = event.touches[0].clientY;
        } else if (event.touches.length >= 2 && this._touchCache.length >= 2) {
            // Handle pinch zoom
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            
            const oldTouch1 = this._touchCache.find(t => t.id === touch1.identifier);
            const oldTouch2 = this._touchCache.find(t => t.id === touch2.identifier);
            
            if (oldTouch1 && oldTouch2) {
                const oldDist = Math.hypot(oldTouch1.x - oldTouch2.x, oldTouch1.y - oldTouch2.y);
                const newDist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
                
                if (oldDist > 0) {
                    const scaleFactor = newDist / oldDist;
                    
                    // Calculate center point for zoom
                    const rect = this.getBoundingClientRect();
                    const centerX = (touch1.clientX + touch2.clientX) / 2 - rect.left;
                    const centerY = (touch1.clientY + touch2.clientY) / 2 - rect.top;
                    
                    this.dispatchEvent(createZoomEvent(scaleFactor, centerX, centerY));
                }
            }
            
            // Update touch cache for next move
            this._touchCache = Array.from(event.touches).map(t => ({
                id: t.identifier,
                x: t.clientX,
                y: t.clientY
            }));
        }
    }
    
    _onTouchEnd(event) {
        event.preventDefault();
        
        if (event.touches.length === 0) {
            // All touches ended
            this._isPanning = false;
            this._touchCache = [];
        } else if (event.touches.length === 1 && this._touchCache.length >= 2) {
            // Transition from pinch zoom to pan
            this._isPanning = true;
            this._panStartX = event.touches[0].clientX;
            this._panStartY = event.touches[0].clientY;
            this._touchCache = [{
                id: event.touches[0].identifier,
                x: event.touches[0].clientX,
                y: event.touches[0].clientY
            }];
        }
    }
    
    _onWheel(event) {
        if (!this._isBackgroundTarget(event.target)) return;
        
        event.preventDefault();
        
        const scaleFactor = event.deltaY < 0 ? 1.1 : 0.9;
        const rect = this.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        this.dispatchEvent(createZoomEvent(scaleFactor, x, y));
    }
}

customElements.define('jigsaw-board', JigsawBoard);