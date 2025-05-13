// jigsaw-puzzle.js - The main custom element (<jigsaw-puzzle>).
// This acts primarily as the Controller and the main View container.

import { Viewport } from './viewport.js';
import { Puzzle } from './puzzle.js';
import { ImageInfo } from './image.js';
// NOTE: The file jigsaw-piece.js on disk currently defines JigsawPieceComponent as a Custom Element.
// This controller is written EXPECTING jigsaw-piece.js to define a PURE JS class named JigsawPiece
// that manages an SVG <g> element and dispatches events (select, move, moveend).
// jigsaw-piece.js MUST BE UPDATED to match this controller's expectations for this to work fully.
import { JigsawPiece, createMoveEndEvent } from './jigsaw-piece.js'; // Import JigsawPiece view class and its moveend event
import { getShadowInnerHTML } from './html.js';

// Import custom event creators (these are used for dispatching from buttons, we listen for others)
import { createPanEvent } from './pan.js';
import { createZoomEvent } from './zoom.js';
import { createSelectEvent } from './select.js'; // Used to dispatch deselect
import { createRotateEvent } from './rotate.js'; // Used to dispatch rotate

import { Position } from './position.js'; // Needed for creating Position objects

const DEFAULT_IMAGE_WIDTH = 1344; // Assumed image width if not loaded
const DEFAULT_IMAGE_HEIGHT = 960; // Assumed image height if not loaded
const DEFAULT_PIECE_COUNT = 40; // Per DESIGN.md request

export class JigsawPuzzle extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        this._imageInfo = null; // Instance of ImageInfo domain model
        this._puzzle = null;    // Instance of Puzzle domain model
        this._viewport = null;  // Instance of Viewport domain model

        this._jigsawPieces = new Map(); // Map<pieceId, JigsawPiece> - Holds the view objects (PURE JS class instances)

        this._selectedPieceId = null; // ID of the currently selected piece data model

        // State for active drag (needed by controller to process move events)
        this._activeDrag = null; // { pieceId, offsetX, offsetY } in world coords

        // State for manual pan
        this._isPanning = false;
        this._panStartX = 0;
        this._panStartY = 0;
        this._touchCache = []; // For pinch-zoom gestures

        // DOM references
        this._puzzleContainer = null;
        this._svgBoard = null;
        this._svgDefs = null; // Reference to the global defs within _svgBoard
        this._gridLayer = null;
        this._piecesLayer = null;
        this._controlsToolbar = null;
        this._pieceActionToolbar = null;
        this._winMessageContainer = null;
    }

    static get observedAttributes() {
        return ['src', 'size'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (!this.isConnected) return; // Only act when connected to DOM

        if (name === 'src' && oldValue !== newValue) {
            this._loadImage(newValue);
        }
        if (name === 'size' && oldValue !== newValue) {
            const newSize = parseInt(newValue, 10) || DEFAULT_PIECE_COUNT;
            if (this._puzzle && this._puzzle.pieceCount === newSize) return; // No change

            // Re-initialize puzzle if image is loaded or will be loaded
            if (this._imageInfo) {
                 this._initializePuzzle(this._imageInfo, newSize);
            } else if (this.hasAttribute('src')) {
                 // Image is loading, _initializePuzzle will be called by _loadImage once loaded
                 console.log(`Size attribute changed to ${newSize}, waiting for image to load to re-initialize puzzle.`);
            } else {
                 // No src yet, use default image dimensions for initialization
                 console.log(`Size attribute changed to ${newSize}, initializing puzzle with default image dimensions.`);
                 const dummyImageInfo = new ImageInfo("placeholder", DEFAULT_IMAGE_WIDTH, DEFAULT_IMAGE_HEIGHT);
                 this._initializePuzzle(dummyImageInfo, newSize);
            }
        }
    }

    connectedCallback() {
        console.log('JigsawPuzzle element connected. Initializing...');
        // Initial setup of Shadow DOM structure
        this.shadowRoot.innerHTML = getShadowInnerHTML();

        // Get DOM references
        this._puzzleContainer = this.shadowRoot.getElementById('puzzle-container');
        this._svgBoard = this.shadowRoot.getElementById('svg-board');
        this._svgDefs = this.shadowRoot.querySelector('#svg-board defs'); // Get the defs element within the main SVG
        this._gridLayer = this.shadowRoot.getElementById('grid-layer');
        this._piecesLayer = this.shadowRoot.getElementById('pieces-layer');
        this._controlsToolbar = this.shadowRoot.getElementById('controls-toolbar');
        this._pieceActionToolbar = this.shadowRoot.getElementById('piece-action-toolbar');
        this._winMessageContainer = this.shadowRoot.getElementById('win-message-container');

        // Initialize Viewport domain model
        const hostRect = this.getBoundingClientRect();
        this._viewport = new Viewport(hostRect.width || DEFAULT_IMAGE_WIDTH, hostRect.height || DEFAULT_IMAGE_HEIGHT); // Use defaults if host not sized yet initially

        // Add event listeners for user interactions and custom events
        this._addEventListeners();

        // Load image and initialize puzzle based on attributes
        const initialSize = parseInt(this.getAttribute('size'), 10) || DEFAULT_PIECE_COUNT;
        const initialSrc = this.getAttribute('src');

        if (initialSrc) {
            this._loadImage(initialSrc);
        } else {
            // Initialize with default image dimensions if no src attribute provided
            console.log("No src attribute, initializing puzzle with default image dimensions.");
            const dummyImageInfo = new ImageInfo("placeholder", DEFAULT_IMAGE_WIDTH, DEFAULT_IMAGE_HEIGHT);
            this._initializePuzzle(dummyImageInfo, initialSize);
        }

        // Use ResizeObserver to update viewport dimensions if the host element is resized by CSS/layout
        this._resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                console.log(`Host resized to ${width}x${height} 📏`);
                this._viewport.setHostDimensions(width, height);
                this._renderViewport(); // Re-render viewport transformation on resize
                this._drawGrid(); // Redraw grid dots (size might be zoom-dependent)
            }
        });
        this._resizeObserver.observe(this);

        // Initial viewport render to apply transforms
        this._renderViewport();
    }

    disconnectedCallback() {
        console.log('JigsawPuzzle element removed from DOM. 👻 Goodbye!');
        // Clean up ResizeObserver
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
        }
        // Clean up global window event listeners if JigsawPiece doesn't do it fully (it should)
        // If we added any global listeners here in JigsawPuzzle, remove them.
    }

    // --- Initialization Steps ---

    _loadImage(src) {
        console.log(`Loading image: ${src}...`);
        const img = new Image(); // Use a temporary Image element to load and get dimensions
        img.onload = () => {
            this._imageInfo = new ImageInfo(src, img.width, img.height);
            console.log(`Image ${src} loaded successfully! 🖼️ Dimensions: ${this._imageInfo.width}x${this._imageInfo.height}`);
            const pieceCount = parseInt(this.getAttribute('size'), 10) || DEFAULT_PIECE_COUNT;
            this._initializePuzzle(this._imageInfo, pieceCount);
        };
        img.onerror = () => {
            console.error(`😱 Failed to load image: ${src}. Is it hiding like a mischievous sprite?`);
            // Display error message in the component's Shadow DOM
            const errorDiv = document.createElement('div');
             errorDiv.style.cssText = 'color:red; position:absolute; top:10px; left:10px; z-index: 9999; background: rgba(0,0,0,0.7); padding: 5px; border-radius: 5px;';
             errorDiv.textContent = `Error loading image: ${src}`;
            this.shadowRoot.appendChild(errorDiv);
             // Initialize puzzle anyway with default size and dimensions, pieces will just be shapes.
            this._imageInfo = new ImageInfo("error", DEFAULT_IMAGE_WIDTH, DEFAULT_IMAGE_HEIGHT); // Use placeholder ImageInfo
            const pieceCount = parseInt(this.getAttribute('size'), 10) || DEFAULT_PIECE_COUNT;
            this._initializePuzzle(this._imageInfo, pieceCount);
        };
        img.src = src;
    }

    _initializePuzzle(imageInfo, pieceCount) {
        if (!imageInfo || !pieceCount) {
            console.warn("👻 Waiting for image info or piece count before initializing puzzle.");
            return;
        }
        console.log(`Initializing puzzle domain model: ${pieceCount} pieces, image ${imageInfo.width}x${imageInfo.height}`);

        // Create the Puzzle domain model instance
        this._puzzle = new Puzzle(imageInfo, pieceCount);

        // Set the SVG board's viewBox attribute to define the "world" coordinate space
        // The viewBox should encompass the entire board area (puzzle grid + scatter space)
        const boardWidth = this._puzzle.boardMaximum.x - this._puzzle.boardMinimum.x;
        const boardHeight = this._puzzle.boardMaximum.y - this._puzzle.boardMinimum.y;
        this._svgBoard.setAttribute('viewBox', `${this._puzzle.boardMinimum.x} ${this._puzzle.boardMinimum.y} ${boardWidth} ${boardHeight}`);
        console.log(`SVG Board viewBox set to: ${this._puzzle.boardMinimum.x} ${this._puzzle.boardMinimum.y} ${boardWidth} ${boardHeight}`);

        // Create the global image pattern in the SVG <defs> section
        this._createImagePattern();

        // Generate and render the JigsawPiece view objects
        this._generatePieceViews();
        this._drawGrid(); // Draw the grid dots within the SVG

        // Center the viewport on the initial scatter area of the board
         const boardCenterX = this._puzzle.boardMinimum.x + boardWidth / 2;
         const boardCenterY = this._puzzle.boardMinimum.y + boardHeight / 2;
         const hostRect = this.getBoundingClientRect();
         const hostCenterX = hostRect.width / 2;
         const hostCenterY = hostRect.height / 2;
         // Calculate viewBox position needed to show world (boardCenterX, boardCenterY) at screen (hostCenterX, hostCenterY)
         // screen = (world - viewBox) * zoom
         // screen/zoom = world - viewBox
         // viewBox = world - screen/zoom
         this._viewport.viewBoxX = boardCenterX - hostCenterX / this._viewport.zoomLevel;
         this._viewport.viewBoxY = boardCenterY - hostCenterY / this._viewport.zoomLevel;
         this._renderViewport(); // Apply the initial viewport transform

        // Check win condition immediately (e.g., for a 1-piece puzzle)
        this._checkWinCondition();
    }

    _createImagePattern() {
        // Ensure we have the <defs> element and valid image info
        if (!this._svgDefs || !this._imageInfo || this._imageInfo.url === "placeholder" || this._imageInfo.url === "error") {
            console.log("Skipping image pattern creation (no valid image info or defs).");
            return;
        }

        const patternId = `image-pattern-${this._imageInfo.url.replace(/[^a-zA-Z0-9]/g, '')}`;
        // Check if pattern already exists to avoid duplicates on re-initialization
        if (this._svgDefs.querySelector(`#${patternId}`)) {
             console.log(`Image pattern "${patternId}" already exists.`);
             return;
        }

        console.log(`Creating global SVG image pattern: "${patternId}"`);
        const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
        pattern.setAttribute('id', patternId);
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');
        // The pattern should cover the entire dimension of the *original image*
        // so that pieces can use it and shift the pattern's view to show their part.
        pattern.setAttribute('width', this._imageInfo.width);
        pattern.setAttribute('height', this._imageInfo.height);

        const imageEl = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        imageEl.setAttributeNS('http://www.w3.org/1999/xlink', 'href', this._imageInfo.url);
        imageEl.setAttribute('x', 0); // Image is positioned at (0,0) within the pattern's coordinate space
        imageEl.setAttribute('y', 0);
        imageEl.setAttribute('width', this._imageInfo.width);
        imageEl.setAttribute('height', this._imageInfo.height);

        pattern.appendChild(imageEl);
        this._svgDefs.appendChild(pattern);
    }


    _generatePieceViews() {
        if (!this._puzzle || !this._piecesLayer || !this._svgDefs || !this._imageInfo) {
            console.warn("Cannot generate piece views: missing puzzle, piecesLayer, defs, or imageInfo.");
            return;
        }
        this._piecesLayer.innerHTML = ''; // Clear any existing piece elements
        this._jigsawPieces = new Map(); // Reset the map of piece views

        this._puzzle.getAllPieces().forEach(pieceData => {
            // Create a JigsawPiece view instance for each piece data model
            // This class is expected to manage the SVG <g> element for the piece.
            // NOTE: jigsaw-piece.js NEEDS TO BE UPDATED.
            const pieceView = new JigsawPiece(pieceData, this._svgDefs, this._imageInfo.url);
            
            // Append the piece's root SVG element (<g>) to the pieces layer in the main SVG
            this._piecesLayer.appendChild(pieceView.element);
            
            // Store the view object by piece ID
            this._jigsawPieces.set(pieceData.id, pieceView);
            
            // Tell the view to update itself based on the initial state of the data model
            pieceView.updateFromPiece(); // Apply initial position, rotation, selected state etc.
            // Call updatePath to ensure correct clipPath is generated and referenced (even if it's just a rectangle initially)
             pieceView.updatePath(); // Ensure path/clipPath is set up
        });
        console.log(`Generated ${this._jigsawPieces.size} JigsawPiece view objects and their SVG elements.`);
    }

    _drawGrid() {
        if (!this._puzzle || !this._gridLayer) {
             console.warn("Cannot draw grid: missing puzzle or gridLayer.");
             return;
        }
        this._gridLayer.innerHTML = ''; // Clear existing grid dots

        const { rows, cols, pieceWidth, pieceHeight } = this._puzzle;
        const gridColor = 'rgba(255, 255, 255, 0.2)'; // Ghostly white dots
        const dotRadius = 3; // Fixed radius in SVG world units (relative to the SVG viewBox)

        // Use SVG circles for grid dots, positioned in world coordinates within the grid layer group
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                dot.classList.add('grid-dot');
                dot.setAttribute('cx', c * pieceWidth + pieceWidth / 2);
                dot.setAttribute('cy', r * pieceHeight + pieceHeight / 2);
                dot.setAttribute('r', dotRadius); // Radius in world units
                dot.setAttribute('fill', gridColor);
                // CSS can be used to adjust stroke/fill/size based on zoom level if needed
                this._gridLayer.appendChild(dot);
            }
        }
         console.log("Grid dots drawn (or re-drawn).");
    }

    // --- Viewport Management (Applies transforms based on Viewport model) ---

    _renderViewport() {
        if (!this._viewport || !this._puzzleContainer) {
            console.warn("Cannot render viewport: missing viewport or puzzleContainer.");
            return;
        }
        // Apply the viewport transformation (pan and zoom) to the puzzle container element
        // This element contains the SVG board with all pieces and the grid.
        // The Viewport class calculates the necessary CSS transform string.
        this._puzzleContainer.style.transform = this._viewport.getPuzzleAreaTransform();
        // The SVG viewBox defines the world space, this CSS transform acts like the camera.

        // Update grid dot size if necessary based on zoom level via CSS classes or direct manipulation
        // If using CSS, the .grid-dot rule should use the `transform` property or other scaling methods.
        // If direct manipulation is needed, iterate through grid dots and adjust 'r' or 'stroke-width'.
        // Let's assume CSS handles the radius scaling based on zoom.

         console.log(`Viewport Rendered: Zoom ${this._viewport.zoomLevel.toFixed(2)}, Pan (${this._viewport.viewBoxX.toFixed(0)}, ${this._viewport.viewBoxY.toFixed(0)})`);
    }

    // --- Event Listeners Setup ---

    _addEventListeners() {
        console.log("Adding event listeners...");
        // --- Listen for Custom Events bubbling up from pieces or controls ---
        // Events like 'select', 'move', 'moveend', 'rotate' are dispatched by JigsawPiece view objects.
        // Events like 'pan', 'zoom' are dispatched by control buttons or direct input handlers below.
        // We listen for all of them on the main host element as they bubble and compose.
        this.addEventListener('select', this._handleSelectEvent.bind(this));
        this.addEventListener('move', this._handleMoveEvent.bind(this));
        this.addEventListener('moveend', this._handleMoveEndEvent.bind(this));
        this.addEventListener('rotate', this._handleRotateEvent.bind(this));
        this.addEventListener('pan', this._handlePanEvent.bind(this));
        this.addEventListener('zoom', this._handleZoomEvent.bind(this));

        // --- Listen for direct user input on the container or host element ---
        // These handlers will determine the intent (pan, zoom, deselect) and dispatch the relevant custom events.
        // Piece pointerdown/touchstart events are handled by the JigsawPiece view itself and stop propagation.

        // Pointer down/start on the puzzle container background (when a piece was NOT hit)
        this._puzzleContainer.addEventListener('mousedown', this._onPanStart.bind(this));
        this._puzzleContainer.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: false }); // Use passive: false for preventDefault

        // Global mouse/touch move and up/end listeners. These are needed for panning that starts
        // on the container but moves outside it. JigsawPiece handles its own global drag listeners.
        this.addEventListener('mousemove', this._onHostMouseMove.bind(this));
        this.addEventListener('mouseup', this._onHostMouseUp.bind(this));
        this.addEventListener('mouseleave', this._onHostMouseLeave.bind(this)); // If mouse leaves component entirely

        this.addEventListener('touchmove', this._onHostTouchMove.bind(this), { passive: false });
        this.addEventListener('touchend', this._onHostTouchEnd.bind(this), { passive: false });
        this.addEventListener('touchcancel', this._onHostTouchEnd.bind(this), { passive: false }); // Important for touch reliability

        // Wheel event for zooming (listened on the host element)
        this.addEventListener('wheel', this._onWheelZoom.bind(this), { passive: false });

        // --- Button Clicks (Dispatching Custom Events) ---
        // These buttons dispatch events that are then handled by the event listeners above.

        // Pan/Zoom controls toolbar buttons
        this.shadowRoot.getElementById('pan-left').addEventListener('click', () => { console.log("Pan left clicked"); this.dispatchEvent(createPanEvent(-50, 0)); });
        this.shadowRoot.getElementById('pan-right').addEventListener('click', () => { console.log("Pan right clicked"); this.dispatchEvent(createPanEvent(50, 0)); });
        this.shadowRoot.getElementById('pan-up').addEventListener('click', () => { console.log("Pan up clicked"); this.dispatchEvent(createPanEvent(0, -50)); });
        this.shadowRoot.getElementById('pan-down').addEventListener('click', () => { console.log("Pan down clicked"); this.dispatchEvent(createPanEvent(0, 50)); });

        // Zoom buttons need the center of the component viewport in screen coordinates
        this.shadowRoot.getElementById('zoom-in').addEventListener('click', () => {
             console.log("Zoom in clicked");
             const rect = this.getBoundingClientRect();
             // Dispatch zoom event with component center as the zoom point
             this.dispatchEvent(createZoomEvent(1.25, rect.width / 2, rect.height / 2));
        });
        this.shadowRoot.getElementById('zoom-out').addEventListener('click', () => {
             console.log("Zoom out clicked");
             const rect = this.getBoundingClientRect();
             // Dispatch zoom event with component center as the zoom point
             this.dispatchEvent(createZoomEvent(0.8, rect.width / 2, rect.height / 2));
        });

        // Piece action toolbar (Rotation) buttons
        this.shadowRoot.getElementById('rotate-neg-90').addEventListener('click', () => {
            if (this._selectedPieceId !== null) { // Only rotate if a piece is selected
                 console.log(`Rotate -90 clicked for piece ${this._selectedPieceId}`);
                 this.dispatchEvent(createRotateEvent(this._selectedPieceId, -1)); // -1 quarter turn
            }
        });
         this.shadowRoot.getElementById('rotate-180').addEventListener('click', () => {
             if (this._selectedPieceId !== null) { // Only rotate if a piece is selected
                 console.log(`Rotate 180 clicked for piece ${this._selectedPieceId}`);
                 this.dispatchEvent(createRotateEvent(this._selectedPieceId, 2)); // 2 quarter turns
             }
        });
         this.shadowRoot.getElementById('rotate-pos-90').addEventListener('click', () => {
             if (this._selectedPieceId !== null) { // Only rotate if a piece is selected
                 console.log(`Rotate +90 clicked for piece ${this._selectedPieceId}`);
                 this.dispatchEvent(createRotateEvent(this._selectedPieceId, 1)); // 1 quarter turn
             }
        });

        // Listen for clicks directly on the background area to deselect
        // This handles cases where the user clicks empty space after interacting with a piece.
        this._puzzleContainer.addEventListener('click', this._onBackgroundClick.bind(this));
         // Note: Clicking background on pointerdown already handled in _onPanStart/_onTouchStart.
         // This click handler might be slightly redundant but acts as a reliable fallback.
    }

    // --- Custom Event Handlers (Controller Logic) ---
    // These methods update the domain models and subsequently the views.

    _handleSelectEvent(event) {
        event.stopPropagation(); // Stop the select event from bubbling past the component

        const pieceIdToSelect = event.detail.pieceId;
        const { clientX: downClientX, clientY: downClientY } = event.detail; // Get pointer location from event detail

        console.log(`Handling select event for piece ID: ${pieceIdToSelect} at screen (${downClientX}, ${downClientY})`);

        // --- Deselection Logic ---
        // If a piece is currently selected and it's NOT the piece being selected now...
        if (this._selectedPieceId !== null && this._selectedPieceId !== pieceIdToSelect) {
            const currentSelectedPieceData = this._puzzle.getPieceById(this._selectedPieceId);
            const currentSelectedPieceView = this._jigsawPieces.get(this._selectedPieceId);
            if (currentSelectedPieceData) currentSelectedPieceData.isSelected = false; // Update data model
            if (currentSelectedPieceView) currentSelectedPieceView.setSelected(false); // Update view (removes highlight)
            console.log(`Piece ${this._selectedPieceId} deselected.`);
        }

        // --- Selection Logic ---
        // If pieceIdToSelect is not null (meaning a piece was clicked/touched) AND it's not already selected...
        if (pieceIdToSelect !== null && this._selectedPieceId !== pieceIdToSelect) {
            const pieceData = this._puzzle.getPieceById(pieceIdToSelect);
            const pieceView = this._jigsawPieces.get(pieceIdToSelect);

            if (pieceData && pieceView) {
                pieceData.isSelected = true; // Update data model
                pieceView.setSelected(true); // Update view (applies highlight, z-index)
                this._selectedPieceId = pieceIdToSelect; // Update controller state
                this._pieceActionToolbar.style.display = 'flex'; // Show rotation controls

                // --- Start Drag Tracking ---
                // Calculate and store the drag offset in world coordinates.
                // This offset is the difference between the world position of the pointer
                // at the start of the drag and the world position of the piece's top-left corner.
                if (downClientX !== undefined && downClientY !== undefined) {
                     const hostRect = this.getBoundingClientRect();
                     const screenX = downClientX - hostRect.left; // Pointer pos relative to host
                     const screenY = downClientY - hostRect.top;
                     const worldDownCoords = this._viewport.toWorldCoordinates(screenX, screenY); // Pointer pos in world coords

                     const offsetX = worldDownCoords.x - pieceData.placement.x;
                     const offsetY = worldDownCoords.y - pieceData.placement.y;

                     this._activeDrag = { pieceId: pieceIdToSelect, offsetX, offsetY };
                     console.log(`Piece ${pieceIdToSelect} selected. ✨ Drag tracking started with offset (${offsetX.toFixed(2)}, ${offsetY.toFixed(2)})`);
                } else {
                     console.warn("Select event missing clientX/Y. Cannot calculate drag offset.");
                     this._activeDrag = null; // Cannot start drag without pointer position
                }

            } else {
                // This case should ideally not happen if event comes from a valid piece view.
                console.error(`Select event for invalid piece ID: ${pieceIdToSelect}. Data or view not found.`);
                this._selectedPieceId = null; // Ensure nothing is selected
                this._pieceActionToolbar.style.display = 'none'; // Hide controls
                 this._activeDrag = null; // No active drag
            }
        } else if (pieceIdToSelect === null && this._selectedPieceId !== null) {
            // Explicit deselect request (e.g., clicking background)
            // Deselection handled at the start of this method.
             this._selectedPieceId = null;
             this._pieceActionToolbar.style.display = 'none'; // Hide controls
             this._activeDrag = null; // Ensure drag state is cleared on deselect
            console.log("Piece deselected via event. 👻");
        }
         // else: pieceIdToSelect was null and no piece was selected, or clicked already selected piece - do nothing.
    }

    _handleMoveEvent(event) {
        event.stopPropagation(); // Stop the move event from bubbling past the component

        const { pieceId, clientX, clientY } = event.detail;
        // console.log(`Handling move event for piece ID: ${pieceId} to screen (${clientX}, ${clientY})`); // Too verbose

        // Only process move if there's an active drag for the same piece
        if (!this._activeDrag || this._activeDrag.pieceId !== pieceId) {
            // console.warn(`Move event for piece ${pieceId} received, but no matching active drag found.`);
            return; // Ignore move events if not actively dragging this piece
        }

        const pieceData = this._puzzle.getPieceById(pieceId);
        const pieceView = this._jigsawPieces.get(pieceId);

        if (!pieceData || !pieceView) {
            console.error(`Move event for valid piece ID ${pieceId} but no data/view found.`);
            this._activeDrag = null; // Clear drag state for this invalid piece
            return;
        }

        // Convert current pointer screen coordinates (relative to viewport) to world coordinates
        const hostRect = this.getBoundingClientRect();
        const currentScreenX = clientX - hostRect.left; // Pointer pos relative to host
        const currentScreenY = clientY - hostRect.top;
        const worldCoords = this._viewport.toWorldCoordinates(currentScreenX, currentScreenY); // Pointer pos in world coords

        // Calculate the new piece placement (top-left world coords) using the stored offset
        const newPieceWorldX = worldCoords.x - this._activeDrag.offsetX;
        const newPieceWorldY = worldCoords.y - this._activeDrag.offsetY;
        const newPiecePlacement = new Position(newPieceWorldX, newPieceWorldY);

        // Update the piece's position in the domain model IF it has changed significantly
        // (Avoids unnecessary updates if pointer is jittering but piece is effectively static)
        if (!pieceData.placement.equals(newPiecePlacement)) {
             pieceData.place(newPiecePlacement);
             // Update the piece's view element transform (handled by the view based on its data model)
             pieceView.updatePositionAndRotation(); // Tell view to render the new position
        }
    }

    _handleMoveEndEvent(event) {
        event.stopPropagation(); // Stop the moveend event from bubbling past the component

        const { pieceId } = event.detail;
        console.log(`Handling moveend event for piece ID: ${pieceId}`);

         // Ensure the moveend event is for the piece that was actively being dragged
        if (!this._activeDrag || this._activeDrag.pieceId !== pieceId) {
             console.warn(`MoveEnd event for piece ${pieceId} received, but no active drag found.`);
             return; // Ignore if not the actively dragged piece
        }

        const pieceData = this._puzzle.getPieceById(pieceId);
        const pieceView = this._jigsawPieces.get(pieceId);

        if (!pieceData || !pieceView) {
             console.error(`MoveEnd event for valid piece ID ${pieceId} but no data/view found.`);
             // No piece data/view, but active drag was set - something went wrong. Clean up drag state.
             this._activeDrag = null;
             return;
        }

        // Attempt to snap the piece to the grid
        const snapThreshold = pieceData.width / 3; // Use dynamic threshold in world units
        const snapped = pieceData.snap(snapThreshold); // Updates pieceData.isSnapped and pieceData.placement/rotation if snapped

        // Update the piece's view based on its final state (position, rotation, snapped, selected)
        pieceView.updateFromPiece(); // This applies the final position/rotation from pieceData, and updates selected/snapped classes

        // Clear active drag state regardless of snap outcome
        this._activeDrag = null;
        console.log(`Drag ended for piece ${pieceId}. Snapped: ${snapped}`);

        // If the piece was snapped, and it was selected, deselect it in the controller state.
        // The pieceData.snap() method already sets isSelected = false on the data model.
        // We need to ensure the controller's `_selectedPieceId` state is also updated
        // and the rotation controls are hidden.
        if (snapped && this._selectedPieceId === pieceId) {
             console.log(`Piece ${pieceId} snapped and was selected, deselecting.`);
             this._selectedPieceId = null;
             this._pieceActionToolbar.style.display = 'none'; // Hide rotation controls
        }


        // Check overall win condition after snap attempt
        if (snapped && this._puzzle.isSolved()) {
            this._showWinMessage();
        }
    }

    _handleRotateEvent(event) {
        event.stopPropagation(); // Stop the rotate event from bubbling past the component

        const { pieceId, turns } = event.detail;
        console.log(`Handling rotate event for piece ID: ${pieceId} by ${turns} turns.`);

        // Ensure the rotate event is for the currently selected piece
        if (this._selectedPieceId !== pieceId || this._selectedPieceId === null) {
             console.warn(`Rotate event for non-selected or invalid piece ID: ${pieceId}. Ignoring.`);
             return;
        }

        const pieceData = this._puzzle.getPieceById(pieceId);
        const pieceView = this._jigsawPieces.get(pieceId);

        if (!pieceData || !pieceView) {
             console.error(`Rotate event for valid piece ID ${pieceId} but no data/view found.`);
             return;
        }

        // Update the piece's rotation in the domain model
        pieceData.rotate(turns);

        // Update the piece's view element transform
        pieceView.updatePositionAndRotation(); // Tell view to render the new rotation

        // Check for snap after rotation (only snaps if rotation becomes 0 and position is close)
        const snapThreshold = pieceData.width / 3; // Use dynamic threshold
        const snapped = pieceData.snap(snapThreshold); // Updates pieceData.isSnapped and pieceData.placement/rotation if snapped

        // Update the piece's view based on new snapped state (will update transform if snapped, remove selected class if snapped)
        pieceView.updateFromPiece(); // Applies final state from pieceData

        // If snapped by rotation+position, deselect it in controller state
        if (snapped && this._selectedPieceId === pieceId) {
             console.log(`Piece ${pieceId} snapped after rotation, deselecting.`);
             this._selectedPieceId = null;
             this._pieceActionToolbar.style.display = 'none'; // Hide rotation controls
        }

        // Check win condition if snapped
         if (snapped && this._puzzle.isSolved()) {
            this._showWinMessage();
        }
    }

    _handlePanEvent(event) {
        event.stopPropagation(); // Stop the pan event from bubbling past the component
        const { dx, dy } = event.detail;
        // console.log(`Handling pan event: dx=${dx}, dy=${dy}`); // Too verbose

        // Update the Viewport domain model
        this._viewport.pan(dx, dy);

        // Re-render the viewport transform on the container
        this._renderViewport();
        // Panning doesn't change piece positions or zoom, so no need to update pieces or redraw grid (unless grid dot size scales with pan, which it doesn't here).
    }

    _handleZoomEvent(event) {
        event.stopPropagation(); // Stop the zoom event from bubbling past the component
        const { factor, clientX, clientY } = event.detail; // clientX/Y are screen coords relative to viewport/document

        // console.log(`Handling zoom event: factor=${factor}, clientX=${clientX}, clientY=${clientY}`);

        // Zoom function needs pointer coordinates relative to the host element's top-left corner
        let pointerX_host, pointerY_host;
        if (clientX !== undefined && clientY !== undefined) {
            const hostRect = this.getBoundingClientRect();
            pointerX_host = clientX - hostRect.left;
            pointerY_host = clientY - hostRect.top;
        } // If clientX/Y are undefined (e.g., from button click), Viewport zooms to host center

        // Update the Viewport domain model. Viewport zoom method returns true if zoom level changed.
        if (this._viewport.zoom(factor, pointerX_host, pointerY_host)) {
            // If zoom changed, re-render the viewport transform
            this._renderViewport();
            // Redraw grid dots, as their size might be zoom-dependent (CSS should handle radius scale)
             this._drawGrid(); // Redrawing ensures correct radius if CSS isn't dynamic enough
             // TODO: Update piece stroke width/other zoom-dependent styles on JigsawPiece views
             // Iterate through this._jigsawPieces.values() and call an update method like updateStyle()
        }
    }

    // --- Direct Input Handlers (Used to dispatch custom events or manage pan state) ---

     _onPanStart(event) {
        // This handler is on _puzzleContainer. If pointerdown was on a piece, its handler stops propagation.
        // So, if we get here, the pointerdown was on the background area.

        // Only initiate pan if target is the background SVG board or its direct container/layers, and it's left click/single touch.
        if (event.target !== this._svgBoard && event.target !== this._puzzleContainer && event.target !== this._gridLayer) {
             // console.log("Pan start ignored, target was:", event.target); // Likely a piece that didn't stop prop? Or a button? Buttons shouldn't be in _puzzleContainer.
             // Let's rely on piece handler stopping propagation and only proceed here if target is background.
        } else {
             if (event.type === 'mousedown' && event.button !== 0) return; // Only left click for mouse pan
             if (event.type === 'touchstart' && event.touches.length > 1) return; // Only single touch for pan

            event.preventDefault(); // Prevent default drag/scroll behavior

            this._isPanning = true;
            const pointer = event.touches ? event.touches[0] : event;
            this._panStartX = pointer.clientX;
            this._panStartY = pointer.clientY;
            this.style.cursor = 'grabbing'; // Visual feedback on the component host

             // If a piece was selected, clicking background should deselect it.
             // Dispatch a deselect event. The handler _handleSelectEvent will process it.
             if (this._selectedPieceId !== null) {
                 console.log("Pointer down on background -> Deselect");
                 this.dispatchEvent(createSelectEvent(null)); // Dispatch deselect event
             }

             // For touch, cache the starting point for pinch-zoom detection later in touchmove
             if (event.touches) {
                 this._touchCache = Array.from(event.touches).map(t => ({ id: t.identifier, clientX: t.clientX, clientY: t.clientY }));
             }
        }

        // If it's a multi-touch start on the container, handle pinch-zoom initiation
        if (event.type === 'touchstart' && event.touches.length >= 2) {
            event.preventDefault(); // Prevent default zoom/scroll
            this._isPanning = false; // Stop single-touch pan if active
            this.style.cursor = 'default'; // Reset cursor
            this._touchCache = Array.from(event.touches).map(t => ({ id: t.identifier, clientX: t.clientX, clientY: t.clientY }));
            console.log("Pinch-zoom start detected (multi-touch on container).");
            // JigsawPiece's touchstart should handle stopping prop if touch is on a piece.
            // If touch is on background with 2+ fingers, we are here, starting pinch-zoom.
        }
    }

    // _onHostMouseMove, _onHostMouseUp, _onHostTouchMove, _onHostTouchEnd
    // These catch events on the component host. They are used for panning that starts
    // on the container background but moves outside the container bounds, and for pinch-zoom.
    // Piece drag events are handled by JigsawPiece's *window* listeners.

    _onHostMouseMove(event) {
        if (this._isPanning) {
            event.preventDefault(); // Prevent selection/etc. while panning
            const dx = event.clientX - this._panStartX;
            const dy = event.clientY - this._panStartY;

            // Dispatch pan event based on mouse delta
            this.dispatchEvent(createPanEvent(dx, dy));

            // Update pan start for the next move event
            this._panStartX = event.clientX;
            this._panStartY = event.clientY;
        }
        // JigsawPiece pure JS class handles its own window mousemove listener for dragging and dispatches 'move'.
    }

    _onHostMouseUp(event) {
        if (this._isPanning) {
            this._isPanning = false;
            this.style.cursor = 'default'; // Reset component host cursor
        }
        // JigsawPiece pure JS class handles its own window mouseup listener for drag end and dispatches 'moveend'.
    }

    _onHostMouseLeave(event) {
        // If panning and mouse leaves the component boundary, end the pan operation.
        if (this._isPanning) {
            this._isPanning = false;
            this.style.cursor = 'default';
        }
        // JigsawPiece's global listeners handle drag ending if mouse leaves the window,
        // but it's good practice for the component to handle leaving its own bounds too.
    }

    _onTouchStart(event) { // This handler is on _puzzleContainer
        // It supplements the global host touch listeners and handles pan/zoom *start* on the container.
        // Piece touchstart should stop propagation and handle drag start there.
        // So if we get here, it's likely a background touch for pan/zoom/deselect.

        // Deselect happens on pointerdown (_onPanStart handles it now for both mouse/touch)
        this._onPanStart(event); // Reuse pan start logic

        // If multi-touch, stop pan state started by single touch logic in _onPanStart
        if (event.touches.length >= 2) {
            event.preventDefault(); // Prevent default zoom/scroll
            this._isPanning = false; // Stop single-touch pan if active
            this.style.cursor = 'default'; // Reset cursor if it was set to grabbing by _onPanStart
            this._touchCache = Array.from(event.touches).map(t => ({ id: t.identifier, clientX: t.clientX, clientY: t.clientY }));
            console.log("Pinch-zoom start detected (multi-touch on container).");
            // JigsawPiece's touchstart should handle stopping prop if touch is on a piece.
            // If touch is on background with 2+ fingers, we are here, starting pinch-zoom.
        }
    }

     // _onHostTouchMove and _onHostTouchEnd handle the move/end phases for panning and pinch-zoom.
     // They listen on the host element to catch events outside the container/pieces.
     // Piece drag moves/ends are handled by JigsawPiece's global listeners.

    _onHostTouchMove(event) {
        event.preventDefault(); // Prevent default touch scrolling/zoom
        const touches = event.touches;

        if (this._isPanning && touches.length === 1) { // Continue single-touch pan
            const touch = touches[0];
            const dx = touch.clientX - this._panStartX;
            const dy = touch.clientY - this._panStartY;
            this.dispatchEvent(createPanEvent(dx, dy)); // Dispatch pan event
            this._panStartX = touch.clientX;
            this._panStartY = touch.clientY;
        } else if (touches.length >= 2 && this._touchCache.length >= 2) { // Continue pinch-zoom
            // Pinch-zoom logic using the touch cache
            const t1_new = touches[0];
            const t2_new = touches[1];
            const t1_old_candidate = this._touchCache.find(t => t.id === t1_new.identifier);
            const t2_old_candidate = this._touchCache.find(t => t.id === t2_new.identifier);

            // Ensure we found both original touches in our cache to calculate scale factor
            if (t1_old_candidate && t2_old_candidate) {
                const t1_old = t1_old_candidate;
                const t2_old = t2_old_candidate;

                const distOld = Math.hypot(t1_old.clientX - t2_old.clientX, t1_old.clientY - t2_old.clientY);
                const distNew = Math.hypot(t1_new.clientX - t2_new.clientX, t1_new.clientY - t2_new.clientY);

                if (distOld > 0) { // Avoid division by zero
                    const scaleFactor = distNew / distOld;
                    
                    // Calculate the center of the new touches relative to the host element for the zoom point
                    const hostRect = this.getBoundingClientRect();
                    const midXNew_screen = (t1_new.clientX + t2_new.clientX) / 2 - hostRect.left;
                    const midYNew_screen = (t1_new.clientY + t2_new.clientY) / 2 - hostRect.top;
                    
                    this.dispatchEvent(createZoomEvent(scaleFactor, midXNew_screen, midYNew_screen)); // Dispatch zoom event
                }
            }
            // Update cache for the next move event with current touch positions
            this._touchCache = Array.from(touches).map(t => ({ id: t.identifier, clientX: t.clientX, clientY: t.clientY }));
        }
         // Piece move events are dispatched by JigsawPiece's window touchmove handler.
    }

    _onHostTouchEnd(event) {
        event.preventDefault(); // Prevent default behavior
        const touches = event.touches; // Touches still active

        // Check if a piece drag ended - this is handled by JigsawPiece dispatching 'moveend'.

        // Check if panning ended (all touches lifted)
        if (this._isPanning && touches.length < 1) {
            this._isPanning = false;
            this.style.cursor = 'default';
        } else if (this._isPanning && touches.length === 1) {
            // If panning and one touch remains, update pan start for that remaining touch
            this._panStartX = touches[0].clientX;
            this._panStartY = touches[0].clientY;
        }

        // Update touch cache: remove ended touches
        const currentTouchIds = Array.from(touches).map(t => t.identifier);
        this._touchCache = this._touchCache.filter(tc => currentTouchIds.includes(tc.id));

        if (touches.length < 2) { // If less than 2 touches remain, stop pinch-zoom mode (by clearing cache)
            // No explicit state, but cache size indicates pinch-zoom mode.
        }
    }

    _onWheelZoom(event) {
        event.preventDefault(); // Prevent page scroll
        const scaleFactor = event.deltaY < 0 ? 1.15 : 1 / 1.15; // Zoom in for scroll up, out for down
        const hostRect = this.getBoundingClientRect();
        const mouseX_host = event.clientX - hostRect.left; // Mouse position relative to component's top-left
        const mouseY_host = event.clientY - hostRect.top;
        // Dispatch zoom event with mouse position as the zoom point
        this.dispatchEvent(createZoomEvent(scaleFactor, mouseX_host, mouseY_host));
    }
    
    _onBackgroundClick(event) {
        // This handler is on _puzzleContainer. It fires if pointerdown and pointerup are on the container (not a piece)
        // and no significant drag occurred.
        // We also handle deselect on pointerdown on background in _onPanStart/_onTouchStart.
        // This click handler acts as a secondary trigger or fallback for deselect.
        // Check if the click target is one of the main background SVG elements
        if (event.target === this._puzzleContainer || event.target === this._svgBoard || event.target === this._gridLayer) {
             // If a piece is currently selected, clicking the background deselects it.
            if (this._selectedPieceId !== null) {
                 console.log("Background click detected -> Deselect");
                 // Dispatch deselect event. The handler _handleSelectEvent will process it.
                 this.dispatchEvent(createSelectEvent(null));
            }
        }
    }


    // --- Win Condition ---
    _checkWinCondition() {
        if (this._puzzle && this._puzzle.isSolved()) {
            this._showWinMessage();
            return true;
        }
        return false;
    }

    _showWinMessage() {
        console.log("🎉 YOU WON! 🎉 All pieces snapped correctly, you magnificent idiot!");
        if (this._winMessageContainer) {
            this._winMessageContainer.style.display = 'flex';
        }
        // Disable further interaction on the board area
        this._puzzleContainer.style.pointerEvents = 'none'; // Prevent pointer events on the container
        // Hide controls
        if (this._controlsToolbar) this._controlsToolbar.style.display = 'none';
        if (this._pieceActionToolbar) this._pieceActionToolbar.style.display = 'none';
    }
}

// The custom element definition is typically done in the main entry file (jigsawyer.js).
// customElements.define('jigsaw-puzzle', JigsawPuzzle);
// console.log('🧩 JigsawPuzzle custom element definition ready.');