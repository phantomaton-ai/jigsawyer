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
        this._x = 0; // Current X position in board/world coordinates (top-left)
        this._y = 0; // Current Y position in board/world coordinates (top-left)
        this._rotation = 0; // Quarter turns (0, 1, 2, 3)
        this._imageUrl = '';
        this._imageWidth = 0; // Source image pixel width
        this._imageHeight = 0; // Source image pixel height
        this._correctX = 0; // Piece's original X position in image (for pattern offset)
        this._correctY = 0; // Piece's original Y position in image
        this._pathData = ''; // SVG path 'd' string in local coords (0,0 at top-left)
        this._selected = false;
        this._snapped = false;

        // State for dragging (managed locally by the component for interaction)
        this._isDragging = false;
        // _dragStartX, _dragStartY are calculated on pointerdown but not stored long-term here
        // They are used by the controller via the 'move' event detail.

        // DOM references within Shadow DOM
        this._svg = null;
        this._pieceShapePath = null; // The <path> element for the shape outline AND fill
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
            'selected',     // Attribute present when selected (boolean attribute)
            'snapped'       // Attribute present when snapped (boolean attribute)
        ];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        // Only update if value changed, *unless* it's a boolean attribute (presence is the value)
        if (oldValue === newValue && name !== 'selected' && name !== 'snapped') return;

        switch (name) {
            case 'piece-id':
                this._pieceId = parseInt(newValue, 10);
                break;
            case 'width':
            case 'height':
                this._width = parseFloat(this.getAttribute('width') || '0');
                this._height = parseFloat(this.getAttribute('height') || '0');
                this._updateSize();
                 // The path data depends on width/height, but it comes from the path-data attribute.
                 // So no need to regenerate path here, just ensure size is applied.
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
                 // Update these, then update pattern as its dimensions might change
                 this._imageWidth = parseFloat(this.getAttribute('image-width') || '0');
                 this._imageHeight = parseFloat(this.getAttribute('image-height') || '0');
                 this._updateImagePattern();
                break;
            case 'correct-x':
            case 'correct-y':
                 // Update these, then update pattern as its offset might change
                 this._correctX = parseFloat(this.getAttribute('correct-x') || '0');
                 this._correctY = parseFloat(this.getAttribute('correct-y') || '0');
                 this._updateImagePattern();
                break;
            case 'path-data':
                this._pathData = newValue || ''; // Empty string if attribute removed/empty
                this._updatePath(); // Apply the new path data to SVG elements
                break;
            case 'selected':
                this._selected = this.hasAttribute('selected'); // Check attribute presence
                this._updateSelectedState(); // Apply visual styles
                break;
            case 'snapped':
                this._snapped = this.hasAttribute('snapped'); // Check attribute presence
                this._updateSnappedState(); // Apply visual styles
                break;
        }
    }

    connectedCallback() {
        // Read initial attributes to populate internal state
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
        // Generate a default rectangle path if path-data is missing initially
        this._pathData = this.getAttribute('path-data') || `M 0 0 L ${this._width} 0 L ${this._width} ${this._height} L 0 ${this._height} Z`;
        this._selected = this.hasAttribute('selected');
        this._snapped = this.hasAttribute('snapped');


        // Set up the Shadow DOM structure with SVG elements
        // This SVG will contain the image pattern, clip path, and the visible shape path.
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block; /* Necessary for positioning and transforms */
                    position: absolute; /* Positioned by parent via top/left styles */
                    touch-action: none; /* Prevent default touch gestures on piece */
                    user-select: none; /* Prevent text selection */
                    /* width, height, top, left, transform set by _updateSize and _updatePositionAndRotation */
                    transition: transform 0.1s ease-out, filter 0.1s ease-out; /* Smooth transitions */
                    filter: drop-shadow(0 0 2px rgba(0,0,0,0.5)); /* Subtle shadow */
                    z-index: 1; /* Default z-index */
                }

                :host([selected]) {
                    z-index: 10; /* Bring selected piece to front */
                }
                 /* Filter is applied to the internal .piece-shape path */
                 :host([selected]) .piece-shape {
                    filter: drop-shadow(0 0 3px #ffdf00) drop-shadow(0 0 8px #ffdf00); /* Golden spooky highlight! ✨👻 */
                 }

                :host([snapped]) {
                     /* Combine default shadow with a subtle snapped glow */
                     filter: drop-shadow(0 0 2px rgba(0,0,0,0.5)) drop-shadow(0 0 2px rgba(0,255,0,0.5));
                }
                 :host([selected][snapped]) .piece-shape {
                     /* Combine selected and snapped glows */
                     filter: drop-shadow(0 0 3px #ffdf00) drop-shadow(0 0 8px #ffdf00) drop-shadow(0 0 2px rgba(0,255,0,0.5));
                 }


                svg {
                    width: 100%; /* SVG fills the host element's computed size */
                    height: 100%;
                    overflow: visible; /* Allows parts of the shape (like nibs later) to render outside the base rect bounds */
                }

                /* Styles for SVG elements within the shadow DOM */
                #image-pattern {
                     /* patternUnits="userSpaceOnUse" is set on the element */
                }
                #image-in-pattern {
                     /* x, y, width, height, href set programmatically */
                }
                 #piece-clip-path path {
                     /* d attribute set programmatically */
                 }

                .piece-shape {
                    /* This path is the visible shape element */
                    fill: url(#image-pattern); /* Reference the pattern by ID within this shadow DOM */
                    stroke: rgba(0,0,0,0.3); /* Outline stroke */
                    stroke-width: 1; /* Stroke width */
                    cursor: grab; /* Default cursor */
                    /* clip-path is applied to this element, referencing the clipPath ID */
                    /* Filter is inherited from the host element */
                    filter: inherit;
                    /* Transition for grab/grabbing cursor is handled by CSS rule on :host([selected]) */
                 }

                 :host([selected]) .piece-shape {
                     cursor: grabbing;
                 }

            </style>

            <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                <defs>
                    <!-- Image pattern: defines how the image tiles within the piece -->
                    <pattern id="image-pattern" patternUnits="userSpaceOnUse">
                        <!-- The image element whose source and position is set programmatically -->
                        <image id="image-in-pattern"></image>
                    </pattern>

                    <!-- Clip path: defines the actual shape of the piece -->
                    <clipPath id="piece-clip-path">
                        <path></path> <!-- Path data set via attribute -->
                    </clipPath>
                </defs>

                <!-- The visible piece shape - uses the pattern for fill and clip-path for shape -->
                <path class="piece-shape" clip-path="url(#piece-clip-path)"></path>
            </svg>
        `;

        // Get DOM references *after* innerHTML is set
        this._svg = this.shadowRoot.querySelector('svg');
        this._imagePattern = this.shadowRoot.querySelector('#image-pattern');
        this._imageElementInPattern = this.shadowRoot.querySelector('#image-in-pattern');
        this._clipPathElement = this.shadowRoot.querySelector('#piece-clip-path');
        this._clipPathShapePath = this.shadowRoot.querySelector('#piece-clip-path path');
        this._pieceShapePath = this.shadowRoot.querySelector('.piece-shape'); // The visible path element

        // Add event listeners for interaction
        this._addEventListeners();

        // Apply initial state based on attributes read in constructor
        this._updateSize(); // Sets host width/height, SVG viewBox
        this._updatePositionAndRotation(); // Sets host top/left, transform
        this._updateImagePattern(); // Sets pattern attributes
        this._updatePath(); // Sets path 'd' attributes
        this._updateSelectedState(); // Sets 'selected' attribute, updates styles
        this._updateSnappedState(); // Sets 'snapped' attribute, updates styles

        console.log(`JigsawPiece ${this._pieceId} connected.`);
    }

    disconnectedCallback() {
        // Clean up global event listeners if component is removed while dragging
         if (this._isDragging) {
            window.removeEventListener('mousemove', this._onPointerMoveBound);
            window.removeEventListener('mouseup', this._onPointerUpBound);
            window.removeEventListener('touchmove', this._onPointerMoveBound);
            window.removeEventListener('touchend', this._onPointerUpBound);
            window.removeEventListener('touchcancel', this._onPointerUpBound);
        }
        console.log(`JigsawPiece ${this._pieceId} disconnected. 👻`);
    }

    /**
     * Updates the size of the host element and the SVG viewport based on width/height attributes.
     */
    _updateSize() {
        // Set the host element size to match piece dimensions (world units)
        this.style.width = `${this._width}px`;
        this.style.height = `${this._height}px`;

        // Set the SVG viewBox to match piece dimensions (local coordinate system 0,0)
        if (this._svg) {
             this._svg.setAttribute('viewBox', `0 0 ${this._width} ${this._height}`);
        }
        // The path data is expected to already be defined relative to this 0,0 viewBox.
    }

    /**
     * Updates the position (top/left) and rotation (transform) of the host element.
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
     * Updates the SVG image pattern definition.
     */
    _updateImagePattern() {
        if (!this._imageElementInPattern || !this._imagePattern || !this._imageUrl) {
             // console.warn(`Piece ${this._pieceId}: Skipping image pattern update (missing elements or URL).`);
            return;
        }
         if (this._imageWidth <= 0 || this._imageHeight <= 0) {
             console.warn(`Piece ${this._pieceId}: Skipping image pattern update (invalid image dimensions: ${this._imageWidth}x${this._imageHeight}).`);
             return;
         }

        // Set the source image URL
        this._imageElementInPattern.setAttributeNS('http://www.w3.org/1999/xlink', 'href', this._imageUrl);

        // The pattern should define a space the size of the *original image* in world units.
        this._imagePattern.setAttribute('width', this._imageWidth);
        this._imagePattern.setAttribute('height', this._imageHeight);

        // The image element within the pattern should also cover this space.
        this._imageElementInPattern.setAttribute('width', this._imageWidth);
        this._imageElementInPattern.setAttribute('height', this._imageHeight);

        // Position the image element *within the pattern*.
        // The image's (0,0) should align with the piece's correct position (correct-x, correct-y)
        // in the original image coordinate system.
        // So, the image element needs to be shifted by -correctX, -correctY within the pattern.
        this._imageElementInPattern.setAttribute('x', -this._correctX);
        this._imageElementInPattern.setAttribute('y', -this._correctY);

        // The visible piece shape path then uses fill="url(#image-pattern)" and its own d/clip-path
        // to act as a window onto this correctly positioned and scaled pattern.
        if (this._pieceShapePath) {
             this._pieceShapePath.setAttribute('fill', 'url(#image-pattern)');
        }
    }

    /**
     * Updates the SVG path data for the piece's shape using the path-data attribute.
     */
    _updatePath() {
        if (!this._clipPathShapePath || !this._pieceShapePath) {
             console.warn(`Piece ${this._pieceId}: Cannot update path, missing clipPath or pieceShapePath elements.`);
             return;
        }
         if (!this._pathData) {
             console.warn(`Piece ${this._pieceId}: path-data attribute is empty or null.`);
             // Optionally set a default rect path if pathData is missing
             this._pathData = `M 0 0 L ${this._width} 0 L ${this._width} ${this._height} L 0 ${this._height} Z`;
         }


        // Apply path data to both the clipPath path and the visible shape path
        this._clipPathShapePath.setAttribute('d', this._pathData);
        this._pieceShapePath.setAttribute('d', this._pathData);

        // Ensure the piece shape uses the clip path
        this._pieceShapePath.setAttribute('clip-path', 'url(#piece-clip-path)');
    }

    /**
     * Updates the visual state based on the 'selected' attribute.
     * Handled primarily by CSS attribute selectors.
     */
    _updateSelectedState() {
        // The logic for adding/removing the 'selected' attribute is done by the controller.
        // CSS takes care of applying styles (z-index, glow, cursor) based on the attribute's presence.
        // We just update our internal state flag.
        this._selected = this.hasAttribute('selected');
        // console.log(`Piece ${this._pieceId} selected state updated to: ${this._selected}`);
    }

    /**
     * Updates the visual state based on the 'snapped' attribute.
     * Handled primarily by CSS attribute selectors.
     */
    _updateSnappedState() {
        // The logic for adding/removing the 'snapped' attribute is done by the controller.
        // CSS takes care of applying styles (glow) based on the attribute's presence.
        // We just update our internal state flag.
         this._snapped = this.hasAttribute('snapped');
         // console.log(`Piece ${this._pieceId} snapped state updated to: ${this._snapped}`);
    }


    // --- Pointer Event Handlers (Dispatching Custom Events) ---
    // These handlers are attached to the host element and capture pointer events
    // on the piece. They dispatch events for the controller to consume.

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
        this.dispatchEvent(new CustomEvent('select', {
             bubbles: true, composed: true,
             detail: { pieceId: this._pieceId, clientX, clientY }
        }));
        // console.log(`Piece ${this._pieceId} pointer down. Dispatching 'select' from (${clientX}, ${clientY}).`);

        // Start internal drag tracking
        this._isDragging = true;
        // We don't store drag start coords or offset here, controller handles it.

        // Add global listeners to track movement and end outside the piece element
        window.addEventListener('mousemove', this._onPointerMoveBound = this._onPointerMove.bind(this));
        window.addEventListener('mouseup', this._onPointerUpBound = this._onPointerUp.bind(this));
        window.addEventListener('touchmove', this._onPointerMoveBound, { passive: false });
        window.addEventListener('touchend', this._onPointerUpBound, { passive: false });
        window.addEventListener('touchcancel', this._onPointerUpBound, { passive: false });

        // Add a class for visual feedback during drag (optional, handled by CSS now)
        // this.classList.add('is-dragging');
        // Cursor style is handled by CSS based on :host([selected]) and .piece-shape rules.
        console.log(`Piece ${this._pieceId} drag started.`);
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

        // Remove dragging class (optional, handled by CSS now)
        // this.classList.remove('is-dragging');
        // Cursor will revert via CSS.

        // Dispatch 'moveend' event
        this.dispatchEvent(createMoveEndEvent(this._pieceId));
        console.log(`Piece ${this._pieceId} drag ended. Dispatching 'moveend'.`);

        // The controller will handle snapping and final state updates based on the moveend event.
    }
}

// Register the custom element
// Registration moved to jigsawyer.js as the main entry point
// customElements.define('jigsaw-piece', JigsawPiece);
// console.log('🧩 JigsawPiece custom element defined!');