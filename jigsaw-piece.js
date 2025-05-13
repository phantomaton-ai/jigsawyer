// jigsaw-piece.js - Web component for a single puzzle piece visualization.
// Renders its own SVG with clipping and dispatches interaction events.

import { createSelectEvent } from './select.js';
import { createMoveEvent } from './move.js';

/**
 * Creates a custom 'moveend' event.
 * @param {number} pieceId - The ID of the piece that finished moving.
 * @returns {CustomEvent}
 */
export function createMoveEndEvent(pieceId) {
    return new CustomEvent('moveend', {
        bubbles: true, // Allow the event to bubble up to the controller
        composed: true, // Allow crossing Shadow DOM boundary
        detail: { pieceId }
    });
}


export class JigsawPiece extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        // Internal state derived from attributes
        this._pieceId = null;
        this._width = 0;
        this._height = 0;
        this._x = 0; // Current X position in board/world coordinates
        this._y = 0; // Current Y position in board/world coordinates
        this._rotation = 0; // Quarter turns (0, 1, 2, 3)
        this._imageUrl = '';
        this._imageWidth = 0;
        this._imageHeight = 0;
        this._correctX = 0; // Correct X position in the original image (for pattern offset)
        this._correctY = 0; // Correct Y position in the original image
        this._pathData = ''; // SVG path 'd' string in local coords (0,0)
        this._selected = false;
        this._snapped = false;

        // State for dragging (managed locally by the component for interaction)
        this._isDragging = false;
        this._dragStartX = 0; // Mouse/touch clientX at start of drag (screen coords)
        this._dragStartY = 0; // Mouse/touch clientY at start of drag (screen coords)
        // Drag offset calculation and applying world position is handled by the controller

        // DOM references within Shadow DOM
        this._svg = null;
        this._pieceShapePath = null; // The <path> element for the shape outline
        this._imagePattern = null;
        this._imageElementInPattern = null;
        this._clipPathElement = null; // The <clipPath> element
        this._clipPathShapePath = null; // The <path> element inside the clipPath
    }

    static get observedAttributes() {
        // Attributes reflecting the Piece domain model state and rendering data
        return [
            'piece-id',
            'width',        // Piece width in board/world units
            'height',       // Piece height in board/world units
            'x',            // Current X position (top-left) in board/world units
            'y',            // Current Y position (top-left) in board/world units
            'rotation',     // Current rotation in quarter turns (0-3)
            'image-url',    // URL of the source image
            'image-width',  // Width of the source image in pixels
            'image-height', // Height of the source image in pixels
            'correct-x',    // Piece's original X position in image (for pattern offset)
            'correct-y',    // Piece's original Y position in image
            'path-data',    // SVG path 'd' string for the piece shape (in local 0,0 coords)
            'selected',     // Attribute present when selected
            'snapped'       // Attribute present when snapped
        ];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue && name !== 'selected' && name !== 'snapped') return; // selected/snapped presence matters

        switch (name) {
            case 'piece-id':
                this._pieceId = parseInt(newValue, 10);
                // Update element data attribute if needed, or just rely on attribute
                // this.element.setAttribute('data-piece-id', this._pieceId);
                break;
            case 'width':
            case 'height':
                this._width = parseFloat(this.getAttribute('width') || '0');
                this._height = parseFloat(this.getAttribute('height') || '0');
                this._updateSize();
                 // Size changes might affect path if not dynamically generated based on attributes,
                 // but path-data attribute should provide the final 'd' string.
                 // Re-apply path data to ensure shape matches new size?
                 // this._updatePath();
                break;
            case 'x':
            case 'y':
            case 'rotation':
                 this._x = parseFloat(this.getAttribute('x') || '0');
                 this._y = parseFloat(this.getAttribute('y') || '0');
                 this._rotation = parseInt(this.getAttribute('rotation') || '0', 10);
                 this._updatePositionAndRotation();
                break;
            case 'image-url':
                 this._imageUrl = newValue;
                 this._updateImagePattern();
                break;
            case 'image-width':
            case 'image-height':
                 this._imageWidth = parseFloat(this.getAttribute('image-width') || '0');
                 this._imageHeight = parseFloat(this.getAttribute('image-height') || '0');
                 this._updateImagePattern(); // Size of pattern/image within pattern might change
                break;
            case 'correct-x':
            case 'correct-y':
                 this._correctX = parseFloat(this.getAttribute('correct-x') || '0');
                 this._correctY = parseFloat(this.getAttribute('correct-y') || '0');
                 this._updateImagePattern(); // Position of image within pattern changes
                break;
            case 'path-data':
                this._pathData = newValue || ''; // Empty string if attribute removed/empty
                this._updatePath(); // Update the path element's 'd' attribute
                break;
            case 'selected':
                this._selected = this.hasAttribute('selected');
                this._updateSelectedState();
                break;
            case 'snapped':
                this._snapped = this.hasAttribute('snapped');
                this._updateSnappedState();
                break;
        }
    }

    connectedCallback() {
        // Read initial attributes
        this._pieceId = parseInt(this.getAttribute('piece-id'), 10);
        this._width = parseFloat(this.getAttribute('width') || '0');
        this._height = parseFloat(this.getAttribute('height') || '0');
        this._x = parseFloat(this.getAttribute('x') || '0');
        this._y = parseFloat(this.getAttribute('y') || '0');
        this._rotation = parseInt(this.getAttribute('rotation') || '0', 10);
        this._imageUrl = this.getAttribute('image-url') || '';
        this._imageWidth = parseFloat(this.getAttribute('image-width') || '0');
        this._imageHeight = parseFloat(this.getAttribute('image-height') || '0');
        this._correctX = parseFloat(this.getAttribute('correct-x') || '0');
        this._correctY = parseFloat(this.getAttribute('correct-y') || '0');
        this._pathData = this.getAttribute('path-data') || `M 0 0 L ${this._width} 0 L ${this._width} ${this._height} L 0 ${this._height} Z`; // Default to rect if no path
        this._selected = this.hasAttribute('selected');
        this._snapped = this.hasAttribute('snapped');


        // Set up the Shadow DOM structure
        // It contains a minimal SVG with a pattern (for the image) and a path element (for the shape)
        // The path element is used as a clipPath to show the correct image section.
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block; /* Allows positioning and transforms */
                    position: absolute; /* Positions relative to the parent container (jigsaw-board) */
                    touch-action: none; /* Disable default touch gestures on the element */
                    user-select: none; /* Prevent text selection */
                    /* width, height, top, left, transform set by _updateSize and _updatePositionAndRotation */
                    transition: transform 0.1s ease-out, filter 0.1s ease-out; /* Smooth transitions for drag/snap */
                    filter: drop-shadow(0 0 2px rgba(0,0,0,0.5)); /* Subtle shadow */
                    z-index: 1; /* Default z-index */
                }

                :host([selected]) {
                    z-index: 10; /* Bring selected piece to front */
                     /* Filter handled on the internal .piece-shape element */
                }
                 :host([selected]) .piece-shape {
                    filter: drop-shadow(0 0 3px #ffdf00) drop-shadow(0 0 8px #ffdf00); /* Golden spooky highlight! ✨👻 */
                 }

                :host([snapped]) {
                     /* Maybe a slightly different background or border? */
                     filter: drop-shadow(0 0 2px rgba(0,255,0,0.5)); /* Subtle green glow */
                     /* And the default shadow */
                     filter: drop-shadow(0 0 2px rgba(0,0,0,0.5)) drop-shadow(0 0 2px rgba(0,255,0,0.5));
                }
                 :host([selected][snapped]) .piece-shape {
                     /* Combine selected and snapped styles if needed */
                     filter: drop-shadow(0 0 3px #ffdf00) drop-shadow(0 0 8px #ffdf00) drop-shadow(0 0 2px rgba(0,255,0,0.5));
                 }


                svg {
                    width: 100%; /* SVG fills the host element */
                    height: 100%;
                    overflow: visible; /* Allows SVG elements/filters to extend beyond bounds */
                }

                #image-pattern {
                    /* Pattern attributes set programmatically */
                }
                #image-in-pattern {
                    /* Image attributes set programmatically */
                }

                #piece-clip-path path {
                     /* Path data set programmatically */
                }

                .piece-shape {
                    /* This path is the actual visible shape, clipped by clip-path */
                    fill: url(#image-pattern); /* Reference the pattern in defs */
                    stroke: rgba(0,0,0,0.3); /* Little border */
                    stroke-width: 1; /* Stroke width */
                    cursor: grab; /* Default cursor */
                    /* Filter for selection/snapped states */
                    filter: inherit; /* Inherit filter from host for combined effects */
                }

                 :host([selected]) .piece-shape {
                     cursor: grabbing;
                 }

            </style>

            <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                <defs>
                    <!-- Image pattern: covers the original image -->
                    <pattern id="image-pattern" patternUnits="userSpaceOnUse">
                        <!-- The image element goes here -->
                        <image id="image-in-pattern" x="0" y="0"></image>
                    </pattern>

                    <!-- Clip path: defines the piece's outline -->
                    <clipPath id="piece-clip-path">
                        <path></path> <!-- Path data set programmatically -->
                    </clipPath>
                </defs>

                <!-- The visible piece shape (a path element using the image pattern and clip path) -->
                <path class="piece-shape" clip-path="url(#piece-clip-path)"></path>
            </svg>
        `;

        // Get DOM references
        this._svg = this.shadowRoot.querySelector('svg');
        this._imagePattern = this.shadowRoot.querySelector('#image-pattern');
        this._imageElementInPattern = this.shadowRoot.querySelector('#image-in-pattern');
        this._clipPathElement = this.shadowRoot.querySelector('#piece-clip-path');
        this._clipPathShapePath = this.shadowRoot.querySelector('#piece-clip-path path');
        this._pieceShapePath = this.shadowRoot.querySelector('.piece-shape'); // The visible path element

        // Add event listeners for interaction
        this._addEventListeners();

        // Apply initial state based on attributes
        this._updateSize();
        this._updatePositionAndRotation();
        this._updateImagePattern();
        this._updatePath(); // Needs pathData attribute set
        this._updateSelectedState();
        this._updateSnappedState();

        console.log(`JigsawPiece ${this._pieceId} connected.`);
    }

    disconnectedCallback() {
        // Clean up global event listeners if component is removed while dragging
         if (this._isDragging) {
            window.removeEventListener('mousemove', this._onPointerMoveBound);
            window.removeEventListener('mouseup', this._onPointerUpBound);
            window.removeEventListener('touchmove', this._onPointerMoveBound, { passive: false });
            window.removeEventListener('touchend', this._onPointerUpBound, { passive: false });
            window.removeEventListener('touchcancel', this._onPointerUpBound, { passive: false });
        }
        console.log(`JigsawPiece ${this._pieceId} disconnected.`);
    }

    /**
     * Sets the piece data model reference (optional, can rely on attributes)
     * Kept for now if needed for passing complex objects like Joints
     * @param {import('./piece.js').Piece} pieceData - The piece domain model
     */
    setPieceData(pieceData) {
        // Store the data model reference if needed, but rendering should primarily use attributes
        this._pieceData = pieceData;
         // If path data is generated here based on data, call updatePath().
         // If path data comes from attribute, attributeChangedCallback calls updatePath().
         // Let's rely on attributes for rendering data.
        // console.log(`Piece ${this._pieceId} received pieceData reference.`);
    }


    // --- Rendering Updates ---

    /**
     * Updates the size of the host element and the SVG viewport based on width/height attributes.
     */
    _updateSize() {
        // Set the host element size to match piece dimensions
        this.style.width = `${this._width}px`;
        this.style.height = `${this._height}px`;

        // Set the SVG viewBox to match piece dimensions (local coordinate system)
        if (this._svg) {
             this._svg.setAttribute('viewBox', `0 0 ${this._width} ${this._height}`);
        }
         // Update the path element size too if it's a simple rect
         if (this._pieceShapePath && this._pathData === `M 0 0 L ${this._width} 0 L ${this._width} ${this._height} L 0 ${this._height} Z`) {
              // If it's the default rect path, ensure it matches the size
              this._pieceShapePath.setAttribute('d', this._pathData);
              if(this._clipPathShapePath) this._clipPathShapePath.setAttribute('d', this._pathData);
         }
    }

    /**
     * Updates the position and rotation of the host element via CSS transform.
     */
    _updatePositionAndRotation() {
        // Position the top-left of the host element using x and y attributes (board coords)
        this.style.left = `${this._x}px`;
        this.style.top = `${this._y}px`;

        // Apply rotation transform around the center of the piece
        const rotationDegrees = this._rotation * 90; // Convert quarter turns to degrees
        this.style.transformOrigin = 'center center'; // Rotate around the piece's visual center
        this.style.transform = `rotate(${rotationDegrees}deg)`;
    }

    /**
     * Updates the SVG image pattern used for the piece's fill.
     * This includes the image source, size, and position within the pattern.
     */
    _updateImagePattern() {
        if (!this._imageElementInPattern || !this._imagePattern || !this._imageUrl) {
             // console.warn(`Piece ${this._pieceId}: Skipping image pattern update (missing elements or URL).`);
            return;
        }

        // Set the source image URL
        this._imageElementInPattern.setAttributeNS('http://www.w3.org/1999/xlink', 'href', this._imageUrl);

        // Set the size of the image within the pattern to match the original image dimensions
        this._imageElementInPattern.setAttribute('width', this._imageWidth || this._width * (this._pieceData?.cols || 1)); // Use image size or guess from piece size/cols
        this._imageElementInPattern.setAttribute('height', this._imageHeight || this._height * (this._pieceData?.rows || 1)); // Use image size or guess

        // Set the size of the pattern itself to match the original image dimensions.
        // This is crucial so that patternUnits="userSpaceOnUse" works correctly:
        // The pattern defines a canvas the size of the original image in the same coordinate system as the SVG.
        // The image element within the pattern covers this canvas.
        // The piece's path then acts as a window onto this pattern.
        this._imagePattern.setAttribute('width', this._imageWidth || this._width * (this._pieceData?.cols || 1));
        this._imagePattern.setAttribute('height', this._imageHeight || this._height * (this._pieceData?.rows || 1));

        // Position the image element *within the pattern*
        // The image's (0,0) should align with the piece's correct position (correct-x, correct-y)
        // in the original image. So, the image element needs to be shifted by -correctX, -correctY.
        this._imageElementInPattern.setAttribute('x', -this._correctX);
        this._imageElementInPattern.setAttribute('y', -this._correctY);
        // This ensures that when the piece's path (defined in local 0,0) uses this pattern,
        // the part of the image starting at (correctX, correctY) is shown at the piece's (0,0).
    }

    /**
     * Updates the SVG path data for the piece's shape using the path-data attribute.
     */
    _updatePath() {
        if (this._clipPathShapePath && this._pieceShapePath) {
            // Apply path data to both the clipPath and the visible shape path
            // (The visible shape path needs the path data too for stroke and hit detection)
            this._clipPathShapePath.setAttribute('d', this._pathData);
            this._pieceShapePath.setAttribute('d', this._pathData);

            // Update the 'd' attribute for the shape path to match the clip path
             // This is important so the stroke outline matches the clipped image area
            this._pieceShapePath.setAttribute('d', this._pathData);
        } else {
             console.warn(`Piece ${this._pieceId}: Cannot update path, missing clipPath or pieceShapePath elements.`);
        }
    }

    /**
     * Updates the visual state based on the 'selected' attribute.
     */
    _updateSelectedState() {
        // CSS handles the visual 'selected' state via the [selected] attribute selector.
        // We just ensure the attribute is present or absent correctly.
        if (this.hasAttribute('selected')) {
            // Ensure internal state is true
            this._selected = true;
            // Z-index and cursor are handled by CSS :host([selected]) rules.
        } else {
            // Ensure internal state is false
            this._selected = false;
            // Z-index and cursor revert via CSS.
        }
    }

    /**
     * Updates the visual state based on the 'snapped' attribute.
     */
    _updateSnappedState() {
         // CSS handles the visual 'snapped' state via the [snapped] attribute selector.
        if (this.hasAttribute('snapped')) {
            this._snapped = true;
        } else {
            this._snapped = false;
        }
    }


    // --- Pointer Event Handlers (Dispatching Custom Events) ---
    // These handlers are attached to the host element and capture pointer events
    // on the piece's visual representation. They dispatch events for the controller
    // to consume.

    _onPointerDown(event) {
        // Only handle primary button for mouse, or the first touch
        if (event.type === 'mousedown' && event.button !== 0) return;
        if (event.type === 'touchstart' && event.touches.length > 1) return; // Only single touch starts drag/select

        event.preventDefault(); // Prevent default browser drag/selection/scrolling
        event.stopPropagation(); // Stop event from bubbling up to parent for panning

        // Get pointer coordinates relative to the viewport
        const clientX = event.clientX || event.touches[0].clientX;
        const clientY = event.clientY || event.touches[0].clientY;

        // Dispatch 'select' event, including the pointer position for the controller
        // to calculate the drag offset.
        this.dispatchEvent(createSelectEvent(this._pieceId));
        // console.log(`Piece ${this._pieceId} pointer down. Dispatching 'select' from (${clientX}, ${clientY}).`);

        // Start internal drag tracking
        this._isDragging = true;
        this._dragStartX = clientX; // Store starting screen coordinates
        this._dragStartY = clientY;

        // Add global listeners to track movement and end outside the piece element
        window.addEventListener('mousemove', this._onPointerMoveBound = this._onPointerMove.bind(this));
        window.addEventListener('mouseup', this._onPointerUpBound = this._onPointerUp.bind(this));
        window.addEventListener('touchmove', this._onPointerMoveBound, { passive: false }); // Needs bound method
        window.addEventListener('touchend', this._onPointerUpBound, { passive: false }); // Needs bound method
        window.addEventListener('touchcancel', this._onPointerUpBound, { passive: false }); // Needs bound method

        // Add a class for visual feedback during drag (optional, but good practice)
        this.classList.add('is-dragging');
        // Cursor style is handled by CSS based on :host([selected]) and .piece-shape rules.
    }

    _onPointerMove(event) {
        if (!this._isDragging) return; // Only track move if dragging started on a piece

        event.preventDefault(); // Prevent scrolling etc.

        // Get current pointer coordinates relative to the viewport
        const pointer = event.touches ? event.touches[0] : event;
        const clientX = pointer.clientX;
        const clientY = pointer.clientY;

        // Dispatch 'move' event with the piece ID and current screen coordinates
        // The controller will convert these screen coords to world coords and update the piece's position attribute.
        this.dispatchEvent(createMoveEvent(this._pieceId, clientX, clientY));
        // console.log(`Piece ${this._pieceId} pointer move. Dispatching 'move' to screen (${clientX.toFixed(0)}, ${clientY.toFixed(0)}).`);
    }

    _onPointerUp(event) {
        if (!this._isDragging) return; // Only end drag if dragging was active

        event.preventDefault(); // Prevent default behavior

        // Stop internal drag tracking
        this._isDragging = false;

        // Remove the global listeners
        window.removeEventListener('mousemove', this._onPointerMoveBound);
        window.removeEventListener('mouseup', this._onPointerUpBound);
        window.removeEventListener('touchmove', this._onPointerMoveBound, { passive: false });
        window.removeEventListener('touchend', this._onPointerUpBound, { passive: false });
        window.removeEventListener('touchcancel', this._onPointerUpBound, { passive: false });

        // Remove dragging class
        this.classList.remove('is-dragging');
        // Cursor will revert via CSS.

        // Dispatch 'moveend' event
        this.dispatchEvent(createMoveEndEvent(this._pieceId));
        console.log(`Piece ${this._pieceId} pointer up. Dispatching 'moveend'.`);

        // The controller will handle snapping and final state updates based on the moveend event.
    }
}

// Register the custom element
customElements.define('jigsaw-piece', JigsawPiece);
console.log('🧩 JigsawPiece custom element defined!');