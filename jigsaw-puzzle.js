// jigsaw-puzzle.js - The main custom element (<jigsaw-puzzle>).
// Acts as the Controller, orchestrating domain models and view components.

import { Viewport } from './viewport.js';
import { Puzzle } from './puzzle.js';
import { ImageInfo } from './image.js';
// Import JigsawPiece component (HTMLElement)
import { JigsawPiece, createMoveEndEvent } from './jigsaw-piece.js'; // Assumes jigsaw-piece.js defines and exports JigsawPiece HTMLElement and createMoveEndEvent
import { JigsawBoard } from './jigsaw-board.js'; // Assumes jigsaw-board.js defines and exports JigsawBoard HTMLElement
import { JigsawControls } from './jigsaw-controls.js'; // Assumes jigsaw-controls.js defines and exports JigsawControls HTMLElement
// Import custom event creators (used here for clarity, not strictly necessary if event objects are created directly)
import { createPanEvent } from './pan.js'; // Not dispatched here, but useful for types/detail structure
import { createZoomEvent } from './zoom.js';
import { createSelectEvent } from './select.js';
import { createRotateEvent } from './rotate.js';

import { Position } from './position.js'; // Needed for coordinate handling

// Default dimensions if not provided or image fails
const DEFAULT_IMAGE_WIDTH = 1344;
const DEFAULT_IMAGE_HEIGHT = 960;
const DEFAULT_PIECE_COUNT = 40; // As requested by Dr. Woe

export class JigsawPuzzle extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        // Domain Models
        this._imageInfo = null; // ImageInfo instance
        this._puzzle = null;    // Puzzle instance
        this._viewport = null;  // Viewport instance

        // View Components managed by the controller
        this._jigsawBoard = null; // JigsawBoard instance
        this._jigsawControls = null; // JigsawControls instance
        this._jigsawPieces = new Map(); // Map<pieceId, JigsawPiece HTMLElement>

        // Controller State
        this._selectedPieceId = null; // ID of the currently selected piece data model
        this._activeDrag = null; // { pieceId, offsetX, offsetY } in world coords during a drag

        // DOM References (basic structure within shadow DOM)
        this._pieceContainer = null; // Div to hold <jigsaw-piece> elements
        this._winMessageContainer = null;
    }

    static get observedAttributes() {
        return ['src', 'size'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (!this.isConnected) return; // Only act when connected

        if (name === 'src' && oldValue !== newValue) {
            this._loadImage(newValue);
        }
        if (name === 'size' && oldValue !== newValue) {
            const newSize = parseInt(newValue, 10) || DEFAULT_PIECE_COUNT;
            // Only re-initialize if size actually changes and is valid
            if (newSize > 0 && (!this._puzzle || this._puzzle.pieceCount !== newSize)) {
                 // If image is already loaded, re-initialize puzzle immediately
                if (this._imageInfo) {
                     this._initializePuzzle(this._imageInfo, newSize);
                 } else if (this.hasAttribute('src')) {
                      // Image is loading, initialization will happen after load
                     console.log(`Size changed to ${newSize}, waiting for image...`);
                 } else {
                      // No src, use default image dimensions for initialization
                     console.log(`Size changed to ${newSize}, initializing with default image dimensions.`);
                     const dummyImageInfo = new ImageInfo("placeholder", DEFAULT_IMAGE_WIDTH, DEFAULT_IMAGE_HEIGHT);
                     this._initializePuzzle(dummyImageInfo, newSize);
                 }
            }
        }
    }

    connectedCallback() {
        console.log('JigsawPuzzle element connected. Initializing controller...');

        // Set up the basic container structure in the Shadow DOM
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    position: relative;
                    width: 100%;
                    height: 100%;
                    overflow: hidden; /* Crucial for pan/zoom effect */
                    background-color: #1a1a1a; /* Default dark background */
                    font-family: sans-serif; /* Default font for text */
                    touch-action: none; /* Disable default touch gestures on the host */
                    user-select: none; /* Prevent text selection */
                }

                /* Styles for slotted pieces (managed by jigsaw-board's slot) */
                ::slotted(jigsaw-piece) {
                    position: absolute; /* Allows pieces to be positioned absolutely by their x/y attributes */
                     /* Transition, z-index, filter, cursor are managed by jigsaw-piece styles */
                }

                /* The container for the board and pieces */
                #board-and-pieces-container {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    transform-origin: 0 0; /* Important for viewport transform */
                }

                jigsaw-board {
                    /* jigsaw-board fills its container and handles grid rendering/input events */
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                }

                #win-message-container {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    display: none; /* Hidden by default */
                    justify-content: center;
                    align-items: center;
                    background-color: rgba(0,0,0,0.7);
                    z-index: 1000; /* Very high */
                }

                #win-message {
                    font-size: 2.5em;
                    color: #ffca28; /* Bright, celebratory orange/yellow */
                    text-align: center;
                    padding: 30px;
                    background-color: #333;
                    border: 3px solid #ffca28;
                    border-radius: 15px;
                    box-shadow: 0 0 30px rgba(255, 202, 40, 0.8);
                    text-shadow: 2px 2px #000;
                    font-family: 'Comic Sans MS', 'Chalkboard SE', 'Bradley Hand', cursive;
                }
            </style>

            <!-- This container gets the Viewport transform -->
            <div id="board-and-pieces-container">
                 <!-- jigsaw-board renders grid and slot for pieces -->
                <jigsaw-board id="jigsaw-board"></jigsaw-board>
                 <!-- Pieces (<jigsaw-piece>) will be slotted inside jigsaw-board -->
            </div>

            <!-- Controls component -->
            <jigsaw-controls id="jigsaw-controls"></jigsaw-controls>

            <!-- Win message -->
            <div id="win-message-container">
                <div id="win-message">🎉 YOU SOLVED IT, YOU MAGNIFICENT IDIOT! 🎉</div>
            </div>
        `;

        // Get DOM references for managed components and containers
        this._jigsawBoard = this.shadowRoot.getElementById('jigsaw-board');
        this._jigsawControls = this.shadowRoot.getElementById('jigsaw-controls');
        this._pieceContainer = this._jigsawBoard; // <jigsaw-piece> elements are slotted into jigsaw-board
        this._winMessageContainer = this.shadowRoot.getElementById('win-message-container');
        this._boardAndPiecesContainer = this.shadowRoot.getElementById('board-and-pieces-container');


        // Initialize Viewport domain model
        const hostRect = this.getBoundingClientRect();
        this._viewport = new Viewport(hostRect.width || DEFAULT_IMAGE_WIDTH, hostRect.height || DEFAULT_IMAGE_HEIGHT); // Use defaults if host not sized initially

        // Add event listeners for custom events from children components
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

        // Use ResizeObserver to update viewport dimensions if the host element is resized
        this._resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                console.log(`Host resized to ${width}x${height} 📏`);
                this._viewport.setHostDimensions(width, height);
                this._renderViewport(); // Re-apply the viewport transform
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
        // Global listeners added by JigsawPiece components should be cleaned up by them in their disconnectedCallback.
        // If JigsawPuzzle added any global listeners, remove them here. (It currently doesn't).
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
            // Display error message
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

        // Configure JigsawBoard attributes based on the Puzzle model
        if (this._jigsawBoard) {
             this._jigsawBoard.setAttribute('grid-width', this._puzzle.image.width); // Grid matches image size for now
             this._jigsawBoard.setAttribute('grid-height', this._puzzle.image.height);
             this._jigsawBoard.setAttribute('rows', this._puzzle.rows);
             this._jigsawBoard.setAttribute('cols', this._puzzle.cols);
             // Initial viewBox should cover the whole board area
             const boardWidth = this._puzzle.boardMaximum.x - this._puzzle.boardMinimum.x;
             const boardHeight = this._puzzle.boardMaximum.y - this._puzzle.boardMinimum.y;
             this._jigsawBoard.setAttribute('view-x', this._puzzle.boardMinimum.x);
             this._jigsawBoard.setAttribute('view-y', this._puzzle.boardMinimum.y);
             this._jigsawBoard.setAttribute('view-width', boardWidth);
             this._jigsawBoard.setAttribute('view-height', boardHeight);
        }


        // Generate and render the JigsawPiece web components
        this._generatePieceViews();

        // Center the viewport on the initial scatter area of the board
         const boardWidth = this._puzzle.boardMaximum.x - this._puzzle.boardMinimum.x;
         const boardHeight = this._puzzle.boardMaximum.y - this._puzzle.boardMinimum.y;
         const boardCenterX = this._puzzle.boardMinimum.x + boardWidth / 2;
         const boardCenterY = this._puzzle.boardMinimum.y + boardHeight / 2;
         const hostRect = this.getBoundingClientRect();
         const hostCenterX = hostRect.width / 2;
         const hostCenterY = hostRect.height / 2;
         // Calculate viewBox position needed to show world (boardCenterX, boardCenterY) at screen (hostCenterX, hostCenterY)
         this._viewport.viewBoxX = boardCenterX - hostCenterX / this._viewport.zoomLevel;
         this._viewport.viewBoxY = boardCenterY - hostCenterY / this._viewport.zoomLevel;
         this._renderViewport(); // Apply the initial viewport transform

        // Check win condition immediately (e.g., for a 1-piece puzzle)
        this._checkWinCondition();
    }

    /**
     * Creates <jigsaw-piece> elements and adds them to the board's slot.
     */
    _generatePieceViews() {
        if (!this._puzzle || !this._pieceContainer || !this._imageInfo) {
             console.warn("Cannot generate piece views: missing puzzle, pieceContainer, or imageInfo.");
             return;
        }
        // Clear any existing piece components
        this._jigsawPieces.forEach(pieceEl => pieceEl.remove());
        this._jigsawPieces = new Map(); // Reset the map

        this._puzzle.getAllPieces().forEach(pieceData => {
            // Create a <jigsaw-piece> custom element for each piece data model
            const pieceElement = document.createElement('jigsaw-piece');

            // Set attributes on the custom element based on the piece data model
            // The jigsaw-piece component will read these attributes and render itself.
            pieceElement.setAttribute('piece-id', pieceData.id);
            pieceElement.setAttribute('width', pieceData.width);
            pieceElement.setAttribute('height', pieceData.height);
            pieceElement.setAttribute('x', pieceData.placement.x); // Current placement
            pieceElement.setAttribute('y', pieceData.placement.y);
            pieceElement.setAttribute('rotation', pieceData.rotation); // Quarter turns

            // Image and correct position for pattern offset
            pieceElement.setAttribute('image-url', this._imageInfo.url);
            pieceElement.setAttribute('image-width', this._imageInfo.width);
            pieceElement.setAttribute('image-height', this._imageInfo.height);
            pieceElement.setAttribute('correct-x', pieceData.origination.x);
            pieceElement.setAttribute('correct-y', pieceData.origination.y);

            // Pass the generated SVG path data
            pieceElement.setAttribute('path-data', pieceData.svgPathData);

            // Set initial selected/snapped states if applicable (should be false initially)
            if (pieceData.isSelected) pieceElement.setAttribute('selected', '');
            if (pieceData.isSnapped) pieceElement.setAttribute('snapped', '');

            // Append the piece element to the container (jigsaw-board's slot)
            this._pieceContainer.appendChild(pieceElement);

            // Store the component instance by piece ID
            this._jigsawPieces.set(pieceData.id, pieceElement);

            // Optionally, pass the domain model reference to the component (useful if complex data isn't reflected in attributes)
            // pieceElement.setPieceData(pieceData); // Requires setPieceData method on JigsawPiece
        });
        console.log(`Generated ${this._jigsawPieces.size} JigsawPiece web components.`);
    }


    // --- Viewport Management (Applies transforms based on Viewport model) ---

    _renderViewport() {
        if (!this._viewport || !this._boardAndPiecesContainer) {
            console.warn("Cannot render viewport: missing viewport or boardAndPiecesContainer.");
            return;
        }
        // Apply the viewport transformation (pan and zoom) to the container holding the board and pieces
        // The Viewport class calculates the necessary CSS transform string.
        this._boardAndPiecesContainer.style.transform = this._viewport.getPuzzleAreaTransform();

         console.log(`Viewport Rendered: Zoom ${this._viewport.zoomLevel.toFixed(2)}, Pan (${this._viewport.viewBoxX.toFixed(0)}, ${this._viewport.viewBoxY.toFixed(0)})`);

         // Although jigsaw-board sets its own viewBox, this CSS transform on the container
         // is what makes the pan and zoom visually apply to both the board and the slotted pieces.

         // Optional: Update piece stroke width based on zoom level if needed
         // this._jigsawPieces.forEach(pieceEl => {
         //     // pieceEl.updateStrokeWidth(1 / this._viewport.zoomLevel); // Requires method on JigsawPiece
         // });
    }

    // --- Event Listeners Setup ---

    _addEventListeners() {
        console.log("Adding event listeners...");
        // Listen for custom events bubbling up from child components (jigsaw-board, jigsaw-piece, jigsaw-controls)
        this.addEventListener('select', this._handleSelectEvent.bind(this));
        this.addEventListener('move', this._handleMoveEvent.bind(this));
        this.addEventListener('moveend', this._handleMoveEndEvent.bind(this));
        this.addEventListener('rotate', this._handleRotateEvent.bind(this));
        this.addEventListener('pan', this._handlePanEvent.bind(this));
        this.addEventListener('zoom', this._handleZoomEvent.bind(this));

        // Listen for clicks directly on the host element (might be needed for deselect if clicking outside board/controls)
        // Less critical now that jigsaw-board handles background clicks.
    }

    // --- Custom Event Handlers (Controller Logic) ---
    // These methods update the domain models and subsequently the view components (via attributes).

    _handleSelectEvent(event) {
        event.stopPropagation(); // Stop the select event from bubbling further
        const { pieceId: pieceIdToSelect, clientX: pointerClientX, clientY: pointerClientY } = event.detail;
        console.log(`Controller handling select event for piece ID: ${pieceIdToSelect}`);

        // --- Deselection Logic ---
        // If a piece is currently selected and the event is for a DIFFERENT piece or null (deselect request)...
        if (this._selectedPieceId !== null && this._selectedPieceId !== pieceIdToSelect) {
            const previouslySelectedPieceData = this._puzzle?.getPieceById(this._selectedPieceId);
            const previouslySelectedPieceView = this._jigsawPieces.get(this._selectedPieceId);

            if (previouslySelectedPieceData) previouslySelectedPieceData.isSelected = false; // Update model
            if (previouslySelectedPieceView) previouslySelectedPieceView.removeAttribute('selected'); // Update view

             // Update controls component
             if (this._jigsawControls) this._jigsawControls.removeAttribute('selected-piece-id');

             this._selectedPieceId = null; // Update controller state
             this._activeDrag = null; // Clear any active drag state
            console.log(`Piece ${previouslySelectedPieceData?.id} deselected.`);
        }

        // --- Selection Logic ---
        // If the event requests selecting a piece (pieceIdToSelect is not null) AND it wasn't already selected...
        if (pieceIdToSelect !== null && this._selectedPieceId !== pieceIdToSelect) {
            const pieceData = this._puzzle?.getPieceById(pieceIdToSelect);
            const pieceView = this._jigsawPieces.get(pieceIdToSelect);

            if (pieceData && pieceView) {
                pieceData.isSelected = true; // Update model
                pieceView.setAttribute('selected', ''); // Update view (adds attribute, triggers component's updateSelectedState)

                this._selectedPieceId = pieceIdToSelect; // Update controller state

                // Update controls component to show piece actions
                if (this._jigsawControls) this._jigsawControls.setAttribute('selected-piece-id', pieceIdToSelect);

                // --- Prepare for Drag ---
                // Calculate and store the drag offset in world coordinates.
                // This offset is the difference between the world position of the pointer
                // at the start of the drag and the world position of the piece's top-left corner.
                if (pointerClientX !== undefined && pointerClientY !== undefined) {
                     const hostRect = this.getBoundingClientRect();
                     const screenX = pointerClientX - hostRect.left; // Pointer pos relative to host
                     const screenY = pointerClientY - hostRect.top;
                     const worldDownCoords = this._viewport.toWorldCoordinates(screenX, screenY); // Pointer pos in world coords

                     const offsetX = worldDownCoords.x - pieceData.placement.x;
                     const offsetY = worldDownCoords.y - pieceData.placement.y;

                     this._activeDrag = { pieceId: pieceIdToSelect, offsetX, offsetY };
                     console.log(`Piece ${pieceIdToSelect} selected. ✨ Drag tracking started with offset (${offsetX.toFixed(2)}, ${offsetY.toFixed(2)}).`);
                } else {
                     console.warn("Select event missing clientX/Y. Cannot calculate drag offset for drag start.");
                     this._activeDrag = null; // Cannot start drag
                }

            } else {
                console.error(`Select event for invalid piece ID: ${pieceIdToSelect}. Data or view not found.`);
                // Ensure controller state is clean if something went wrong
                this._selectedPieceId = null;
                if (this._jigsawControls) this._jigsawControls.removeAttribute('selected-piece-id');
                 this._activeDrag = null;
            }
        }
        // If pieceIdToSelect was null but no piece was selected, or clicked already selected piece - do nothing, state is already correct.
    }

    _handleMoveEvent(event) {
        event.stopPropagation(); // Stop the move event from bubbling further
        const { pieceId, clientX, clientY } = event.detail;
        // console.log(`Controller handling move event for piece ID: ${pieceId} to screen (${clientX}, ${clientY})`); // Too verbose during drag

        // Only process move if there's an active drag for the same piece that's also selected
        if (!this._activeDrag || this._activeDrag.pieceId !== pieceId || this._selectedPieceId !== pieceId) {
            // console.warn(`Move event for piece ${pieceId} ignored (no active drag or not selected).`);
            return; // Ignore move events if not actively dragging/selected
        }

        const pieceData = this._puzzle?.getPieceById(pieceId);
        const pieceView = this._jigsawPieces.get(pieceId);

        if (!pieceData || !pieceView) {
            console.error(`Move event for valid piece ID ${pieceId} but no data/view found.`);
            this._activeDrag = null; // Clean up drag state
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

        // Update the piece's position in the domain model
        pieceData.place(newPiecePlacement); // This updates pieceData.placement

        // Update the piece's view element by setting its attributes
        pieceView.setAttribute('x', pieceData.placement.x);
        pieceView.setAttribute('y', pieceData.placement.y);

        // The piece view component's attributeChangedCallback will handle updating its visual transform.
    }

    _handleMoveEndEvent(event) {
        event.stopPropagation(); // Stop the moveend event from bubbling further
        const { pieceId } = event.detail;
        console.log(`Controller handling moveend event for piece ID: ${pieceId}`);

         // Ensure the moveend event is for the piece that was actively being dragged and is selected
        if (!this._activeDrag || this._activeDrag.pieceId !== pieceId || this._selectedPieceId !== pieceId) {
             console.warn(`MoveEnd event for piece ${pieceId} received, but no active drag or not selected. Ignoring.`);
             return; // Ignore if not the actively dragged/selected piece
        }

        const pieceData = this._puzzle?.getPieceById(pieceId);
        const pieceView = this._jigsawPieces.get(pieceId);

        if (!pieceData || !pieceView) {
             console.error(`MoveEnd event for valid piece ID ${pieceId} but no data/view found.`);
             // No piece data/view, but active drag was set - something went wrong. Clean up drag state.
             this._activeDrag = null;
             return;
        }

        // Attempt to snap the piece to the grid
        const snapThreshold = pieceData.width / 3; // Dynamic threshold in world units
        const snapped = pieceData.snap(snapThreshold); // Updates pieceData.isSnapped and pieceData.placement/rotation if snapped

        // Update the piece's view attributes based on its final state after potential snap
        pieceView.setAttribute('x', pieceData.placement.x);
        pieceView.setAttribute('y', pieceData.placement.y);
        pieceView.setAttribute('rotation', pieceData.rotation);
        if (pieceData.isSnapped) {
             pieceView.setAttribute('snapped', ''); // Add boolean attribute
        } else {
             pieceView.removeAttribute('snapped'); // Remove boolean attribute
        }

        // Clear active drag state
        this._activeDrag = null;
        console.log(`Drag ended for piece ${pieceId}. Snapped: ${snapped}`);

        // If the piece was snapped, and it was selected, deselect it in the controller state.
        // The pieceData.snap() method does *not* set isSelected = false on the data model.
        // The controller is responsible for selected state.
        if (snapped && this._selectedPieceId === pieceId) {
             console.log(`Piece ${pieceId} snapped and was selected, deselecting.`);
             // Dispatch a deselect event to trigger the deselect logic in _handleSelectEvent
             this.dispatchEvent(createSelectEvent(null));
        }


        // Check overall win condition after snap attempt
        if (snapped && this._puzzle?.isSolved()) {
            this._showWinMessage();
        }
    }

    _handleRotateEvent(event) {
        event.stopPropagation(); // Stop the rotate event from bubbling further
        const { pieceId, turns } = event.detail;
        console.log(`Controller handling rotate event for piece ID: ${pieceId} by ${turns} turns.`);

        // Ensure the rotate event is for the currently selected piece
        if (this._selectedPieceId !== pieceId || this._selectedPieceId === null) {
             console.warn(`Rotate event for non-selected or invalid piece ID: ${pieceId}. Ignoring.`);
             return;
        }

        const pieceData = this._puzzle?.getPieceById(pieceId);
        const pieceView = this._jigsawPieces.get(pieceId);

        if (!pieceData || !pieceView) {
             console.error(`Rotate event for valid piece ID ${pieceId} but no data/view found.`);
             return;
        }

        // Update the piece's rotation in the domain model
        pieceData.rotate(turns); // This updates pieceData.rotation

        // Update the piece's view attribute for rotation
        pieceView.setAttribute('rotation', pieceData.rotation);

        // Check for snap after rotation (only snaps if rotation becomes 0 and position is close)
        const snapThreshold = pieceData.width / 3; // Use dynamic threshold
        const snapped = pieceData.snap(snapThreshold); // Updates pieceData.isSnapped and pieceData.placement/rotation if snapped

        // Update the piece's view based on new snapped state and potential position/rotation change from snap
        pieceView.setAttribute('x', pieceData.placement.x); // Apply final position from snap
        pieceView.setAttribute('y', pieceData.placement.y);
        pieceView.setAttribute('rotation', pieceData.rotation); // Apply final rotation from snap
        if (pieceData.isSnapped) {
             pieceView.setAttribute('snapped', '');
        } else {
             pieceView.removeAttribute('snapped');
        }

        // If snapped by rotation+position, deselect it in controller state
        if (snapped && this._selectedPieceId === pieceId) {
             console.log(`Piece ${pieceId} snapped after rotation, deselecting.`);
             // Dispatch a deselect event
             this.dispatchEvent(createSelectEvent(null));
        }

        // Check win condition if snapped
         if (snapped && this._puzzle?.isSolved()) {
            this._showWinMessage();
        }
    }

    _handlePanEvent(event) {
        event.stopPropagation(); // Stop the pan event from bubbling further
        const { dx, dy } = event.detail;
        // console.log(`Controller handling pan event: dx=${dx}, dy=${dy}`); // Too verbose

        if (!this._viewport) return;

        // Update the Viewport domain model
        this._viewport.pan(dx, dy);

        // Re-render the viewport transform on the container holding board and pieces
        this._renderViewport();
        // No need to update jigsaw-board attributes for pan, its viewBox is fixed.
    }

    _handleZoomEvent(event) {
        event.stopPropagation(); // Stop the zoom event from bubbling further
        const { factor, clientX, clientY } = event.detail; // clientX/Y are screen coords relative to viewport/document

        // console.log(`Controller handling zoom event: factor=${factor}, clientX=${clientX}, clientY=${clientY}`);
        if (!this._viewport) return;

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
            // The jigsaw-board component's grid dots might need updating if their size scales with zoom.
            // JigsawBoard currently draws fixed size dots based on its viewBox.
            // If dynamic dot size is needed, update a jigsaw-board attribute here or call a method.
            // For now, viewBox and CSS transform are enough for basic zoom.
        }
    }

    // --- Win Condition ---
    _checkWinCondition() {
        if (this._puzzle?.isSolved()) {
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
        if (this._boardAndPiecesContainer) this._boardAndPiecesContainer.style.pointerEvents = 'none'; // Prevent pointer events on the container
        // Hide controls
        if (this._jigsawControls) this._jigsawControls.style.display = 'none';
        // Deselect any selected piece visually
        if (this._selectedPieceId !== null) {
             const pieceView = this._jigsawPieces.get(this._selectedPieceId);
             if(pieceView) pieceView.removeAttribute('selected');
             this._selectedPieceId = null;
        }
         // Ensure controls component updates visibility
        if (this._jigsawControls) this._jigsawControls.removeAttribute('selected-piece-id');
    }

    // Unused/extraneous methods like toString removed.
}

// Custom element definition will be in the main entry file (jigsawyer.js)
// customElements.define('jigsaw-puzzle', JigsawPuzzle);
// console.log('🧩 JigsawPuzzle custom element definition ready.');