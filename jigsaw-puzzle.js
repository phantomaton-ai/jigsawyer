// jigsaw-puzzle.js - The main custom element (<jigsaw-puzzle>).
// Acts as the Controller, orchestrating domain models and view components.

import { Viewport } from './viewport.js';
import { Puzzle } from './puzzle.js';
import { ImageInfo } from './image.js';
// Import view components (should be defined and exported in their respective files)
import { JigsawViewport } from './jigsaw-viewport.js';
import { JigsawBoard } from './jigsaw-board.js';
import { JigsawControls } from './jigsaw-controls.js';
import { JigsawPiece, createMoveEndEvent } from './jigsaw-piece.js'; // Used to create piece elements and listen for its events
// Import the piece view factory function
import { createJigsawPieceElement } from './piece-view-factory.js';

// Import custom event creators (used here for clarity, not strictly necessary if event objects are created directly)
import { createSelectEvent } from './select.js'; // Used to dispatch deselect

import { Position } from './position.js'; // Needed for coordinate handling

// Import the HTML structure function
import { getJigsawPuzzleHTML } from './jigsaw-puzzle.html.js';


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

        // View Components managed by the controller
        this._jigsawViewport = null; // JigsawViewport instance (manages Viewport domain model internally)
        this._jigsawBoard = null; // JigsawBoard instance (renders grid, sets viewBox)
        this._jigsawControls = null; // JigsawControls instance (renders buttons)
        this._jigsawPieces = new Map(); // Map<pieceId, JigsawPiece HTMLElement>

        // Controller State
        this._selectedPieceId = null; // ID of the currently selected piece data model
        this._activeDrag = null; // { pieceId, offsetX, offsetY } in world coords during a drag

        // DOM References (basic structure within shadow DOM)
        this._viewportContentContainer = null; // Contains board and pieces-container
        this._piecesContainer = null; // Container specifically for <jigsaw-piece> elements
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

        // Set up the Shadow DOM structure using the HTML helper
        this.shadowRoot.innerHTML = getJigsawPuzzleHTML();

        // Get DOM references for managed components and containers
        this._jigsawViewport = this.shadowRoot.getElementById('jigsaw-viewport');
        this._viewportContentContainer = this.shadowRoot.getElementById('viewport-content');
        this._jigsawBoard = this.shadowRoot.getElementById('jigsaw-board');
        this._piecesContainer = this.shadowRoot.getElementById('pieces-container');
        this._jigsawControls = this.shadowRoot.getElementById('jigsaw-controls');
        this._winMessageContainer = this.shadowRoot.getElementById('win-message-container');


        // Add event listeners for custom events bubbling up from child components
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

        // JigsawViewport component handles its own ResizeObserver and initial rendering based on its size.
        // We don't need a separate ResizeObserver or initial _renderViewport call here anymore.
    }

    disconnectedCallback() {
        console.log('JigsawPuzzle element removed from DOM. 👻 Goodbye!');
        // Child components (JigsawViewport, JigsawPiece) should clean up their own observers/global listeners.
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
        if (!imageInfo || !pieceCount || pieceCount <= 0) {
            console.warn("👻 Cannot initialize puzzle domain model: missing image info or invalid piece count.");
            return;
        }
         if (!this._jigsawBoard || !this._jigsawViewport || !this._piecesContainer) {
             console.warn("👻 Cannot initialize puzzle views: missing board, viewport, or pieces containers.");
             // This shouldn't happen if connectedCallback ran correctly, but defensive check.
             return;
         }

        console.log(`Initializing puzzle domain model: ${pieceCount} pieces, image ${imageInfo.width}x${imageInfo.height}`);

        // Create the Puzzle domain model instance
        this._puzzle = new Puzzle(imageInfo, pieceCount);

        // Configure JigsawBoard attributes based on the Puzzle model's grid and total board size
        const boardWidth = this._puzzle.boardMaximum.x - this._puzzle.boardMinimum.x;
        const boardHeight = this._puzzle.boardMaximum.y - this._puzzle.boardMinimum.y;
        this._jigsawBoard.setAttribute('grid-width', this._puzzle.image.width); // Grid dots area width
        this._jigsawBoard.setAttribute('grid-height', this._puzzle.image.height); // Grid dots area height
        this._jigsawBoard.setAttribute('rows', this._puzzle.rows);
        this._jigsawBoard.setAttribute('cols', this._puzzle.cols);
        // jigsaw-board also needs the full board viewBox for its internal SVG
        this._jigsawBoard.setAttribute('view-x', this._puzzle.boardMinimum.x);
        this._jigsawBoard.setAttribute('view-y', this._puzzle.boardMinimum.y);
        this._jigsawBoard.setAttribute('view-width', boardWidth);
        this._jigsawBoard.setAttribute('view-height', boardHeight);

         // Set the size of the pieces container to match the board's dimensions defined by its viewBox
         // This container uses absolute positioning from 0,0 within the viewport content.
         this._piecesContainer.style.width = `${boardWidth}px`;
         this._piecesContainer.style.height = `${boardHeight}px`;
         // The top/left of the pieces container needs to align with the board's viewBox origin
         this._piecesContainer.style.left = `${this._puzzle.boardMinimum.x}px`;
         this._piecesContainer.style.top = `${this._puzzle.boardMinimum.y}px`;
         console.log(`Pieces container size set to ${boardWidth}x${boardHeight} at (${this._puzzle.boardMinimum.x}, ${this._puzzle.boardMinimum.y}).`);


        // Generate and render the JigsawPiece web components using the factory
        this._generatePieceViews();

        // Set the initial viewport position and zoom level via the JigsawViewport component.
        // Center the viewport on the initial scatter area of the board.
        const boardCenterX = this._puzzle.boardMinimum.x + boardWidth / 2;
        const boardCenterY = this._puzzle.boardMinimum.y + boardHeight / 2;
        const initialZoom = 1; // Start at 1x zoom

        // Calculate the required viewBox position to center the board area
        const hostRect = this.getBoundingClientRect(); // Bounding rect of the *main* jigsaw-puzzle component
        const hostCenterX = hostRect.width / 2;
        const hostCenterY = hostRect.height / 2;
        const initialViewBoxX = boardCenterX - hostCenterX / initialZoom;
        const initialViewBoxY = boardCenterY - hostCenterY / initialZoom;

        // Set the initial view on the viewport component
        this._jigsawViewport.setView(initialViewBoxX, initialViewBoxY, initialZoom);

        // Check win condition immediately (e.g., for a 1-piece puzzle)
        this._checkWinCondition();
    }

    /**
     * Creates <jigsaw-piece> elements using the factory and adds them to the pieces container.
     * Clears existing pieces first.
     */
    _generatePieceViews() {
        if (!this._puzzle || !this._piecesContainer || !this._imageInfo) {
             console.warn("Cannot generate piece views: missing puzzle, piecesContainer, or imageInfo.");
             return;
        }
        // Clear any existing piece components
        this._jigsawPieces.forEach(pieceEl => pieceEl.remove()); // Remove from DOM
        this._jigsawPieces = new Map(); // Reset the map

        this._puzzle.getAllPieces().forEach(pieceData => {
            // Use the factory function to create a configured <jigsaw-piece> element
            const pieceElement = createJigsawPieceElement(pieceData, this._imageInfo);

             if (!pieceElement) {
                 console.error(`Failed to create JigsawPiece element for piece ${pieceData.id}.`);
                 return; // Skip this piece if element creation failed
             }

            // Append the piece element to the dedicated pieces container
            this._piecesContainer.appendChild(pieceElement);

            // Store the component instance by piece ID
            this._jigsawPieces.set(pieceData.id, pieceElement);

            // Initial visual state (position, rotation, selected, snapped) is set by the factory
            // via attributes, which triggers the component's attributeChangedCallback and rendering.
        });
        console.log(`Generated ${this._jigsawPieces.size} JigsawPiece web components.`);
    }


    // --- Event Listeners Setup ---
    // Listen for custom events bubbling up from child components:
    // 'select', 'move', 'moveend' from JigsawPiece components (via propagation up to jigsaw-board/viewport/this)
    // 'pan', 'zoom' from JigsawBoard component (via propagation up to viewport/this)
    // Events from JigsawControls are listened to directly below.

    _addEventListeners() {
        console.log("Controller adding event listeners...");
        // Listen on the host element for events that bubble up from *any* child component
        this.addEventListener('select', this._handleSelectEvent.bind(this));
        this.addEventListener('move', this._handleMoveEvent.bind(this));
        this.addEventListener('moveend', this._handleMoveEndEvent.bind(this));
        this.addEventListener('rotate', this._handleRotateEvent.bind(this));
        this.addEventListener('pan', this._handlePanEvent.bind(this)); // Listens for pan from jigsaw-board/controls
        this.addEventListener('zoom', this._handleZoomEvent.bind(this)); // Listens for zoom from jigsaw-board/controls

        // Listen for a deselect event specifically from the controls (if added there)
        // Note: Selection/deselection can also be initiated by clicking on a piece or background.
        // The _handleSelectEvent is the primary handler for state change.
        // The controls component dispatches 'select' with null for deselect.
    }

    // --- Custom Event Handlers (Controller Logic) ---
    // These methods update the domain models and subsequently the view components (by setting attributes).

    _handleSelectEvent(event) {
        event.stopPropagation(); // Stop the select event from bubbling further
        // The event detail contains the pieceId and clientX/clientY from the original pointerdown/click.
        const { pieceId: pieceIdToSelect, clientX: pointerClientX, clientY: pointerClientY } = event.detail;
        console.log(`Controller handling select event for piece ID: ${pieceIdToSelect}`);

        // --- Deselection Logic ---
        // If a piece is currently selected and the event is for a DIFFERENT piece or null (deselect request)...
        if (this._selectedPieceId !== null && this._selectedPieceId !== pieceIdToSelect) {
            const previouslySelectedPieceData = this._puzzle?.getPieceById(this._selectedPieceId);
            const previouslySelectedPieceView = this._jigsawPieces.get(this._selectedPieceId);

            if (previouslySelectedPieceData) previouslySelectedPieceData.isSelected = false; // Update model state (optional)
            if (previouslySelectedPieceView) previouslySelectedPieceView.removeAttribute('selected'); // Update view (removes attribute)

             // Update controls component to hide piece actions for the old piece
             if (this._jigsawControls) this._jigsawControls.removeAttribute('selected-piece-id');

             this._selectedPieceId = null; // Update controller state
             // Clear any active drag state *if* it was for the piece being deselected
             if(this._activeDrag?.pieceId === this._selectedPieceId) {
                 this._activeDrag = null;
             }
            console.log(`Piece ${previouslySelectedPieceData?.id} deselected.`);
        }

        // --- Selection Logic ---
        // If the event requests selecting a piece (pieceIdToSelect is not null) AND it wasn't already selected...
        if (pieceIdToSelect !== null && this._selectedPieceId !== pieceIdToSelect) {
            const pieceData = this._puzzle?.getPieceById(pieceIdToSelect);
            const pieceView = this._jigsawPieces.get(pieceIdToSelect);

            if (pieceData && pieceView) {
                pieceData.isSelected = true; // Update model state (optional)
                pieceView.setAttribute('selected', ''); // Update view (adds attribute, triggers component's updateSelectedState)

                this._selectedPieceId = pieceIdToSelect; // Update controller state

                // Update controls component to show piece actions for this piece
                if (this._jigsawControls) this._jigsawControls.setAttribute('selected-piece-id', pieceIdToSelect);

                // --- Prepare for Drag (if pointer coords are available) ---
                // The 'select' event from jigsaw-piece *should* include clientX/Y from pointerdown.
                if (pointerClientX !== undefined && pointerClientY !== undefined) {
                     // Calculate the drag offset in world coordinates.
                     // Need the viewport's current state to convert screen to world.
                     // Get the Viewport *domain model* managed by JigsawViewport.
                     const viewportModel = this._jigsawViewport?.getViewportModel(); // Assuming JigsawViewport has this getter
                     if (viewportModel) {
                         const hostRect = this.getBoundingClientRect(); // Bounding rect of the *main* jigsaw-puzzle component

                         // Convert pointer screen position (relative to viewport) to world coordinates
                         const worldDownCoords = viewportModel.toWorldCoordinates(
                             pointerClientX - hostRect.left, // Pointer X relative to viewport host
                             pointerClientY - hostRect.top  // Pointer Y relative to viewport host
                         );

                         const offsetX = worldDownCoords.x - pieceData.placement.x;
                         const offsetY = worldDownCoords.y - pieceData.placement.y;

                         this._activeDrag = { pieceId: pieceIdToSelect, offsetX, offsetY };
                         console.log(`Piece ${pieceIdToSelect} selected. ✨ Drag tracking started with offset (${offsetX.toFixed(2)}, ${offsetY.toFixed(2)}).`);
                     } else {
                         console.warn("JigsawViewport or its internal model not available. Cannot calculate drag offset.");
                         this._activeDrag = null; // Cannot start drag
                     }
                } else {
                     console.warn("Select event missing clientX/Y. Cannot calculate initial drag offset. Drag may not work correctly.");
                     this._activeDrag = null; // Cannot start drag without initial pointer position
                }

            } else {
                console.error(`Select event for invalid piece ID: ${pieceIdToSelect}. Data or view not found.`);
                // Clean up controller state if something went wrong
                this._selectedPieceId = null;
                if (this._jigsawControls) this._jigsawControls.removeAttribute('selected-piece-id');
                 this._activeDrag = null;
            }
        }
        // If pieceIdToSelect was null but no piece was selected, or clicked already selected piece - do nothing.
    }

    _handleMoveEvent(event) {
        event.stopPropagation(); // Stop the move event from bubbling further
        const { pieceId, clientX, clientY } = event.detail;
        // console.log(`Controller handling move event for piece ID: ${pieceId} to screen (${clientX}, ${clientY})`); // Too verbose during drag

        // Only process move if there's an active drag for the same piece that's also the selected piece
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
        // Use the Viewport component's internal method for this conversion
        const viewportModel = this._jigsawViewport?.getViewportModel(); // Assuming JigsawViewport has this getter
         if (!viewportModel) {
             console.warn("Viewport model not available during move.");
             return;
         }

        const hostRect = this.getBoundingClientRect(); // Bounding rect of the *main* jigsaw-puzzle component
        const worldCoords = viewportModel.toWorldCoordinates(
             clientX - hostRect.left, // Pointer X relative to viewport host
             clientY - hostRect.top  // Pointer Y relative to viewport host
        );

        // Calculate the new piece placement (top-left world coords) using the stored offset
        const newPieceWorldX = worldCoords.x - this._activeDrag.offsetX;
        const newPieceWorldY = worldCoords.y - this._activeDrag.offsetY;
        const newPiecePlacement = new Position(newPieceWorldX, newPieceWorldY);

        // Update the piece's position in the domain model
        // Only update if the position has actually changed significantly to avoid unnecessary DOM updates
        if (!pieceData.placement.equals(newPiecePlacement)) {
             pieceData.place(newPiecePlacement); // This updates pieceData.placement

             // Update the piece's view element by setting its attributes
             pieceView.setAttribute('x', pieceData.placement.x);
             pieceView.setAttribute('y', pieceData.placement.y);
             // The piece view component's attributeChangedCallback will handle updating its visual transform.
        }
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
        const snapThreshold = pieceData.width / 3; // Use dynamic threshold in world units
        const snapped = pieceData.snap(snapThreshold); // Updates pieceData.isSnapped and pieceData.placement/rotation if snapped

        // Update the piece's view attributes based on its final state after potential snap
        // Use pieceData properties as they reflect the snapped state's changes (if any)
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
         if (this._puzzle?.isSolved()) { // Check puzzle state after potential snap
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
        // The piece view's attributeChangedCallback will handle the visual update.

        // Check for snap after rotation (only snaps if rotation becomes 0 and position is close)
        const snapThreshold = pieceData.width / 3; // Use dynamic threshold
        const snapped = pieceData.snap(snapThreshold); // Updates pieceData.isSnapped and pieceData.placement/rotation if snapped

        // Update the piece's view based on new snapped state and potential position/rotation change from snap
        // Use pieceData properties as they reflect the snapped state's changes (if any)
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
         if (this._puzzle?.isSolved()) { // Check puzzle state after potential snap
            this._showWinMessage();
        }
    }

    _handlePanEvent(event) {
        event.stopPropagation(); // Stop the pan event from bubbling further
        const { dx, dy } = event.detail;
        // console.log(`Controller handling pan event: dx=${dx}, dy=${dy}`); // Too verbose

        if (!this._jigsawViewport) return;

        // Delegate pan update to the JigsawViewport component
        // The viewport component will update its internal Viewport model and apply the transform.
        this._jigsawViewport.pan(dx, dy);
    }

    _handleZoomEvent(event) {
        event.stopPropagation(); // Stop the zoom event from bubbling further
        const { factor, clientX, clientY } = event.detail; // clientX/Y are screen coords relative to original event target

        // console.log(`Controller handling zoom event: factor=${factor}, clientX=${clientX}, ${clientY !== undefined ? clientY : 'undefined'})`); // Too verbose
        if (!this._jigsawViewport) return;

        // Delegate zoom update to the JigsawViewport component.
        // JigsawViewport's zoom method needs pointer coords relative to its own host element.
        // If clientX/Y came from a button (detail only has factor), JigsawViewport handles centering.
        // If clientX/Y came from a pointer/wheel (detail has clientX/Y), we need to pass them relative to JigsawViewport.
        // Since JigsawViewport fills the JigsawPuzzle host, clientX/Y relative to JigsawPuzzle host are the same.
        const hostRect = this.getBoundingClientRect(); // Bounding rect of the *main* jigsaw-puzzle component
        const pointerX_viewport = clientX !== undefined ? clientX - hostRect.left : undefined;
        const pointerY_viewport = clientY !== undefined ? clientY - hostRect.top : undefined;

        this._jigsawViewport.zoom(factor, pointerX_viewport, pointerY_viewport);

        // The JigsawViewport component will handle applying the transform and potentially
        // triggering updates in its slotted content (like jigsaw-board redrawing dots).
        // If piece styles (like stroke width) need to scale with zoom, we could iterate pieces here
        // after the zoom, or let pieces listen for a 'viewport-changed' event from JigsawViewport.
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
        // Disable further interaction on the board area (delegated to viewport)
        if (this._jigsawViewport) {
            // A dedicated method on jigsaw-viewport to disable interaction would be cleaner
            // For now, directly disable pointer events on the viewport component
             this._jigsawViewport.style.pointerEvents = 'none';
             // Need to also disable pointer events on the jigsaw-controls? No, controls disappear.
        }


        // Hide controls
        if (this._jigsawControls) this._jigsawControls.style.display = 'none';

        // Deselect any selected piece visually and in state
        if (this._selectedPieceId !== null) {
             const pieceView = this._jigsawPieces.get(this._selectedPieceId);
             if(pieceView) pieceView.removeAttribute('selected'); // Update view
             // No need to update model if it's already considered solved/finished.
             this._selectedPieceId = null; // Update controller state
        }
         // Ensure controls component updates visibility
        if (this._jigsawControls) this._jigsawControls.removeAttribute('selected-piece-id');

        // Clear active drag state just in case
        this._activeDrag = null;
    }
}

// Custom element definition will be in the main entry file (jigsawyer.js)
// customElements.define('jigsaw-puzzle', JigsawPuzzle);
// console.log('🧩 JigsawPuzzle custom element definition ready.');