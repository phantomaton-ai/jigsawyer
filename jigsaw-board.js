// jigsaw-board.js - Component for the puzzle board, grid, and panning/zooming functionality

import { createPanEvent } from './pan.js';
import { createZoomEvent } from './zoom.js';
import { Viewport } from './viewport.js';

/**
 * JigsawBoard web component - handles the background grid, viewport panning and zooming
 */
export class JigsawBoard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        
        this._viewport = null;
        this._puzzleWidth = 0;
        this._puzzleHeight = 0;
        this._rows = 0;
        this._cols = 0;
        this._pieceWidth = 0;
        this._pieceHeight = 0;
        
        // State for panning
        this._isPanning = false;
        this._panStartX = 0;
        this._panStartY = 0;
        
        // State for pinch-zoom
        this._touchCache = [];

        // DOM elements
        this._container = null;
        this._svgGrid = null;
        this._gridGroup = null;
    }
    
    static get observedAttributes() {
        return [
            'width',
            'height',
            'rows',
            'cols'
        ];
    }
    
    attributeChangedCallback(name, oldValue, newValue) {
        switch (name) {
            case 'width':
                this._puzzleWidth = parseFloat(newValue);
                break;
            case 'height':
                this._puzzleHeight = parseFloat(newValue);
                break;
            case 'rows':
                this._rows = parseInt(newValue, 10);
                break;
            case 'cols':
                this._cols = parseInt(newValue, 10);
                break;
        }
        
        if (this.isConnected) {
            this._calculatePieceDimensions();
            this._drawGrid();
        }
    }
    
    connectedCallback() {
        // Set up shadow DOM
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
                
                #container {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    transform-origin: 0 0;
                }
                
                #svg-grid {
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
            
            <div id="container">
                <svg id="svg-grid">
                    <g id="grid-group"></g>
                </svg>
                <slot></slot>
            </div>
        `;
        
        // Get DOM references
        this._container = this.shadowRoot.getElementById('container');
        this._svgGrid = this.shadowRoot.getElementById('svg-grid');
        this._gridGroup = this.shadowRoot.getElementById('grid-group');
        
        // Initialize viewport
        const width = this.getBoundingClientRect().width;
        const height = this.getBoundingClientRect().height;
        this._viewport = new Viewport(width, height);
        
        // Calculate piece dimensions
        this._calculatePieceDimensions();
        
        // Draw initial grid
        this._drawGrid();
        
        // Add event listeners
        this._addEventListeners();
    }
    
    _calculatePieceDimensions() {
        if (this._rows > 0 && this._cols > 0) {
            this._pieceWidth = this._puzzleWidth / this._cols;
            this._pieceHeight = this._puzzleHeight / this._rows;
        }
    }
    
    _drawGrid() {
        // Clear existing grid
        this._gridGroup.innerHTML = '';
        
        if (this._rows <= 0 || this._cols <= 0 || 
            this._pieceWidth <= 0 || this._pieceHeight <= 0) {
            return; // Not enough information to draw grid
        }
        
        // Set SVG viewBox to puzzle dimensions
        this._svgGrid.setAttribute('viewBox', `0 0 ${this._puzzleWidth} ${this._puzzleHeight}`);
        
        // Draw grid dots
        for (let r = 0; r < this._rows; r++) {
            for (let c = 0; c < this._cols; c++) {
                const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                dot.classList.add('grid-dot');
                dot.setAttribute('cx', c * this._pieceWidth + this._pieceWidth / 2);
                dot.setAttribute('cy', r * this._pieceHeight + this._pieceHeight / 2);
                dot.setAttribute('r', 3);
                this._gridGroup.appendChild(dot);
            }
        }
    }
    
    _addEventListeners() {
        // Pan/zoom event listeners
        this.addEventListener('mousedown', this._onMouseDown.bind(this));
        this.addEventListener('mousemove', this._onMouseMove.bind(this));
        this.addEventListener('mouseup', this._onMouseUp.bind(this));
        this.addEventListener('mouseleave', this._onMouseLeave.bind(this));
        
        this.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: false });
        this.addEventListener('touchmove', this._onTouchMove.bind(this), { passive: false });
        this.addEventListener('touchend', this._onTouchEnd.bind(this), { passive: false });
        
        this.addEventListener('wheel', this._onWheel.bind(this), { passive: false });
        
        // Set up a ResizeObserver to handle container resizing
        this._resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                this._viewport.setHostDimensions(width, height);
                this._updateTransform();
            }
        });
        this._resizeObserver.observe(this);
    }
    
    _onMouseDown(event) {
        // Only handle primary button and ignore events originating from pieces
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
        
        // Dispatch pan event (will be handled by parent component)
        this.dispatchEvent(createPanEvent(dx, dy));
        
        // Update pan start positions
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
        // Ignore touches on pieces
        if (!this._isBackgroundTarget(event.target)) return;
        
        event.preventDefault();
        
        if (event.touches.length === 1) {
            // Single touch - start panning
            this._isPanning = true;
            this._panStartX = event.touches[0].clientX;
            this._panStartY = event.touches[0].clientY;
        } else if (event.touches.length >= 2) {
            // Multi-touch - prepare for pinch-zoom
            this._isPanning = false;
            this._touchCache = Array.from(event.touches).map(t => ({ 
                id: t.identifier, 
                x: t.clientX, 
                y: t.clientY 
            }));
        }
    }
    
    _onTouchMove(event) {
        event.preventDefault();
        
        if (this._isPanning && event.touches.length === 1) {
            // Single touch panning
            const dx = event.touches[0].clientX - this._panStartX;
            const dy = event.touches[0].clientY - this._panStartY;
            
            this.dispatchEvent(createPanEvent(dx, dy));
            
            this._panStartX = event.touches[0].clientX;
            this._panStartY = event.touches[0].clientY;
        } else if (event.touches.length >= 2 && this._touchCache.length >= 2) {
            // Multi-touch pinch zoom
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            
            const oldTouch1 = this._touchCache.find(t => t.id === touch1.identifier);
            const oldTouch2 = this._touchCache.find(t => t.id === touch2.identifier);
            
            if (oldTouch1 && oldTouch2) {
                // Calculate old and new distances
                const oldDist = Math.hypot(oldTouch1.x - oldTouch2.x, oldTouch1.y - oldTouch2.y);
                const newDist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
                
                if (oldDist > 0) {
                    const factor = newDist / oldDist;
                    
                    // Calculate zoom center
                    const rect = this.getBoundingClientRect();
                    const centerX = (touch1.clientX + touch2.clientX) / 2 - rect.left;
                    const centerY = (touch1.clientY + touch2.clientY) / 2 - rect.top;
                    
                    this.dispatchEvent(createZoomEvent(factor, centerX, centerY));
                }
            }
            
            // Update touch cache
            this._touchCache = Array.from(event.touches).map(t => ({ 
                id: t.identifier, 
                x: t.clientX, 
                y: t.clientY 
            }));
        }
    }
    
    _onTouchEnd(event) {
        if (event.touches.length === 0) {
            // All touches ended
            this._isPanning = false;
            this._touchCache = [];
        } else if (event.touches.length === 1 && this._touchCache.length >= 2) {
            // Transition from pinch-zoom to pan
            this._isPanning = true;
            this._panStartX = event.touches[0].clientX;
            this._panStartY = event.touches[0].clientY;
            this._touchCache = Array.from(event.touches).map(t => ({ 
                id: t.identifier, 
                x: t.clientX, 
                y: t.clientY 
            }));
        }
    }
    
    _onWheel(event) {
        event.preventDefault();
        
        const scaleFactor = event.deltaY < 0 ? 1.1 : 0.9;
        const rect = this.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        this.dispatchEvent(createZoomEvent(scaleFactor, x, y));
    }
    
    _isBackgroundTarget(target) {
        // Check if the event target is part of this component's background (not a slotted piece)
        return target === this || 
               target === this._container || 
               target === this._svgGrid || 
               target === this._gridGroup ||
               target.closest('#grid-group') === this._gridGroup;
    }
    
    /**
     * Updates the transformation of the container based on viewport state
     */
    _updateTransform() {
        if (!this._container || !this._viewport) return;
        
        this._container.style.transform = this._viewport.getPuzzleAreaTransform();
    }
    
    /**
     * Apply pan transformation
     * @param {number} dx - X distance to pan
     * @param {number} dy - Y distance to pan
     */
    pan(dx, dy) {
        if (!this._viewport) return;
        
        this._viewport.pan(dx, dy);
        this._updateTransform();
    }
    
    /**
     * Apply zoom transformation
     * @param {number} factor - Zoom factor
     * @param {number} x - Center X coordinate
     * @param {number} y - Center Y coordinate
     */
    zoom(factor, x, y) {
        if (!this._viewport) return;
        
        this._viewport.zoom(factor, x, y);
        this._updateTransform();
    }
    
    /**
     * Sets the viewBox of the SVG to fit the puzzle board
     * @param {number} minX - Minimum X coordinate
     * @param {number} minY - Minimum Y coordinate 
     * @param {number} width - Width of the board
     * @param {number} height - Height of the board
     */
    setViewBox(minX, minY, width, height) {
        if (!this._svgGrid) return;
        
        this._svgGrid.setAttribute('viewBox', `${minX} ${minY} ${width} ${height}`);
    }
}

customElements.define('jigsaw-board', JigsawBoard);