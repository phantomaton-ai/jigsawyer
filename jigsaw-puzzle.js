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
        this._viewportModel = null;  // Viewport instance (managed by JigsawViewport component)

        // View Components managed by the controller
        this._jigsawViewport = null; // JigsawViewport instance
        this._jigsawBoard = null; // JigsawBoard instance (slotted inside viewport)
        this._jigsawControls = null; // JigsawControls instance
        this._jigsawPieces = new Map(); // Map<pieceId, JigsawPiece HTMLElement>

        // Controller State
        this._selectedPieceId = null; // ID of the currently selected piece data model
        this._activeDrag = null; // { pieceId, offsetX, offsetY } in world coords during a drag

        // DOM References (basic structure within shadow DOM)
        this._pieceContainer = null; // <jigsaw-board> component acts as the container for pieces via slot
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
        this._jigsawBoard = this.shadowRoot.getElementById('jigsaw-board');
        this._jigsawControls = this.shadowRoot.getElementById('jigsaw-controls');
        this._winMessageContainer = this.shadowRoot.getElementById('win-message-container');
        // The piece container is the jigsaw-board itself, as it uses a slot
        this._pieceContainer = this._jigsawBoard;


        // The Viewport domain model is managed *internally* by the JigsawViewport component.
        // We will interact with it via the JigsawViewport component's methods/attributes.
        // We don't need a separate _viewportModel instance here in the controller.
        // Let's update the variable name for clarity to _viewportComponent.
        this._viewportComponent = this._jigsawViewport;


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

        // The JigsawViewport component uses a ResizeObserver to handle host resizing.
        // We just need to ensure its initial size is correct (handled by CSS) and it's connected.

        // Initial viewport state (centering on the board) will happen AFTER puzzle is initialized
        // in _initializePuzzle.
    }

    disconnectedCallback() {
        console.log('JigsawPuzzle element removed from DOM. 👻 Goodbye!');
        // Components like JigsawViewport and JigsawPiece should clean up their own observers/global listeners.
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
         if (!this._jigsawBoard || !this._viewportComponent) {
             console.warn("👻 Cannot initialize puzzle views: missing board or viewport components.");
             // This shouldn't happen if connectedCallback ran correctly, but defensive check.
             return;
         }

        console.log(`Initializing puzzle domain model: ${pieceCount} pieces, image ${imageInfo.width}x${imageInfo.height}`);

        // Create the Puzzle domain model instance
        this._puzzle = new Puzzle(imageInfo, pieceCount);

        // Configure JigsawBoard attributes based on the Puzzle model's grid
        // The board needs to know the dimensions of the assembled puzzle grid (world units)
        // and the number of rows/cols to draw its dots.
        this._jigsawBoard.setAttribute('grid-width', this._puzzle.image.width); // Grid matches image size for now
        this._jigsawBoard.setAttribute('grid-height', this._puzzle.image.height);
        this._jigsawBoard.setAttribute('rows', this._puzzle.rows);
        this._jigsawBoard.setAttribute('cols', this._puzzle.cols);

        // The board also needs to know the total board dimensions (including scatter area)
        // so it can set its internal SVG viewBox correctly.
        const boardWidth = this._puzzle.boardMaximum.x - this._puzzle.boardMinimum.x;
        const boardHeight = this._puzzle.boardMaximum.y - this._puzzle.boardMinimum.y;
        this._jigsawBoard.setAttribute('view-x', this._puzzle.boardMinimum.x);
        this._jigsawBoard.setAttribute('view-y', this._puzzle.boardMinimum.y);
        this._jigsawBoard.setAttribute('view-width', boardWidth);
        this._jigsawBoard.setAttribute('view-height', boardHeight);


        // Generate and render the JigsawPiece web components
        this._generatePieceViews();

        // Set the initial viewport position and zoom level via the JigsawViewport component.
        // Center the viewport on the initial scatter area of the board.
        const boardCenterX = this._puzzle.boardMinimum.x + boardWidth / 2;
        const boardCenterY = this._puzzle.boardMinimum.y + boardHeight / 2;
        const initialZoom = 1; // Start at 1x zoom

        // Calculate the required viewBox position to center the board area
        const hostRect = this.getBoundingClientRect();
        const hostCenterX = hostRect.width / 2;
        const hostCenterY = hostRect.height / 2;
        const initialViewBoxX = boardCenterX - hostCenterX / initialZoom;
        const initialViewBoxY = boardCenterY - hostCenterY / initialZoom;

        // Set the initial view on the viewport component
        this._viewportComponent.setView(initialViewBoxX, initialViewBoxY, initialZoom);

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

            // Pass the generated SVG path data from the Piece model
            pieceElement.setAttribute('path-data', pieceData.svgPathData);

            // Set initial selected/snapped states if applicable (should be false initially for new pieces)
            if (pieceData.isSelected) pieceElement.setAttribute('selected', '');
            if (pieceData.isSnapped) pieceElement.setAttribute('snapped', '');

            // Append the piece element to the container (jigsaw-board's slot)
            // The jigsaw-board uses a <slot> to render these children inside its SVG context.
            this._pieceContainer.appendChild(pieceElement);

            // Store the component instance by piece ID
            this._jigsawPieces.set(pieceData.id, pieceElement);

            // No longer need to pass the full pieceData object if attributes are sufficient.
            // pieceElement.setPieceData(pieceData); // Removed as per strategy.
        });
        console.log(`Generated ${this._jigsawPieces.size} JigsawPiece web components.`);
    }


    // --- Viewport Management (Delegated to JigsawViewport) ---
    // JigsawViewport component manages the Viewport model and applies the CSS transform.
    // This controller just needs to tell the viewport component when to update its view
    // (e.g., after a zoom/pan event).

    _renderViewport() {
         // This method is now redundant here. The JigsawViewport component
         // handles its own rendering when its internal Viewport model changes
         // via its pan/zoom methods or resize observer.
         // Keeping the call here for clarity that the viewport is conceptually 'rendered'.
         // The actual transform application happens inside JigsawViewport.
         console.log("Controller triggered viewport render (handled by JigsawViewport).");
    }

    // --- Event Listeners Setup ---

    _addEventListeners() {
        console.log("Controller adding event listeners...");
        // Listen for custom events bubbling up from child components:
        // 'select', 'move', 'moveend' from JigsawPiece components
        // 'pan', 'zoom' from JigsawBoard component
        // No events expected from JigsawControls, it dispatches events listened to here.

        this.addEventListener('select', this._handleSelectEvent.bind(this));
        this.addEventListener('move', this._handleMoveEvent.bind(this));
        this.addEventListener('moveend', this._handleMoveEndEvent.bind(this));
        this.addEventListener('rotate', this._handleRotateEvent.bind(this));
        this.addEventListener('pan', this._handlePanEvent.bind(this)); // Listen for pan from jigsaw-board/controls
        this.addEventListener('zoom', this._handleZoomEvent.bind(this)); // Listen for zoom from jigsaw-board/controls
    }

    // --- Custom Event Handlers (Controller Logic) ---
    // These methods update the domain models and subsequently the view components (by setting attributes).

    _handleSelectEvent(event) {
        event.stopPropagation(); // Stop the select event from bubbling further
        const { pieceId: pieceIdToSelect, clientX: pointerClientX, clientY: pointerClientY } = event.detail;
        console.log(`Controller handling select event for piece ID: ${pieceIdToSelect}`);

        // --- Deselection Logic ---
        // If a piece is currently selected and the event is for a DIFFERENT piece or null (deselect request)...
        if (this._selectedPieceId !== null && this._selectedPieceId !== pieceIdToSelect) {
            const previouslySelectedPieceData = this._puzzle?.getPieceById(this._selectedPieceId);
            const previouslySelectedPieceView = this._jigsawPieces.get(this._selectedPieceId);

            if (previouslySelectedPieceData) previouslySelectedPieceData.isSelected = false; // Update model (optional, controller state is primary)
            if (previouslySelectedPieceView) previouslySelectedPieceView.removeAttribute('selected'); // Update view

             // Update controls component to hide piece actions
             if (this._jigsawControls) this._jigsawControls.removeAttribute('selected-piece-id');

             this._selectedPieceId = null; // Update controller state
             this._activeDrag = null; // Clear any active drag state for the old piece
            console.log(`Piece ${previouslySelectedPieceData?.id} deselected.`);
        }

        // --- Selection Logic ---
        // If the event requests selecting a piece (pieceIdToSelect is not null) AND it wasn't already selected...
        if (pieceIdToSelect !== null && this._selectedPieceId !== pieceIdToSelect) {
            const pieceData = this._puzzle?.getPieceById(pieceIdToSelect);
            const pieceView = this._jigsawPieces.get(pieceIdToSelect);

            if (pieceData && pieceView) {
                pieceData.isSelected = true; // Update model (optional)
                pieceView.setAttribute('selected', ''); // Update view (adds attribute, triggers component's updateSelectedState)

                this._selectedPieceId = pieceIdToSelect; // Update controller state

                // Update controls component to show piece actions for this piece
                if (this._jigsawControls) this._jigsawControls.setAttribute('selected-piece-id', pieceIdToSelect);

                // --- Prepare for Drag (if pointer coords are available) ---
                // The 'select' event from jigsaw-piece *should* include clientX/Y from pointerdown.
                if (pointerClientX !== undefined && pointerClientY !== undefined) {
                     // Calculate and store the drag offset in world coordinates.
                     // Need the viewport's current state to convert screen to world.
                     const currentViewState = this._viewportComponent.getViewState();
                     const hostRect = this.getBoundingClientRect(); // Bounding rect of the *main* jigsaw-puzzle component

                     // Convert pointer screen position (relative to viewport) to world coordinates
                     // Use the Viewport component's internal method for this conversion
                     const worldDownCoords = this._viewportComponent._viewport.toWorldCoordinates(
                         pointerClientX - hostRect.left, // Pointer X relative to viewport host
                         pointerClientY - hostRect.top  // Pointer Y relative to viewport host
                     );

                     const offsetX = worldDownCoords.x - pieceData.placement.x;
                     const offsetY = worldDownCoords.y - pieceData.placement.y;

                     this._activeDrag = { pieceId: pieceIdToSelect, offsetX, offsetY };
                     console.log(`Piece ${pieceIdToSelect} selected. ✨ Drag tracking started with offset (${offsetX.toFixed(2)}, ${offsetY.toFixed(2)}).`);
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
        const hostRect = this.getBoundingClientRect(); // Bounding rect of the *main* jigsaw-puzzle component
        const worldCoords = this._viewportComponent._viewport.toWorldCoordinates(
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

        if (!this._viewportComponent) return;

        // Delegate pan update to the JigsawViewport component
        // The viewport component will update its internal model and apply the transform.
        this._viewportComponent.pan(dx, dy);
    }

    _handleZoomEvent(event) {
        event.stopPropagation(); // Stop the zoom event from bubbling further
        const { factor, clientX, clientY } = event.detail; // clientX/Y are screen coords relative to original event target

        // console.log(`Controller handling zoom event: factor=${factor}, clientX=${clientX}, clientY=${clientY}`);
        if (!this._viewportComponent) return;

        // Delegate zoom update to the JigsawViewport component.
        // JigsawViewport's zoom method needs pointer coords relative to its own host element.
        // If clientX/Y came from a button (detail only has factor), JigsawViewport handles centering.
        // If clientX/Y came from a pointer/wheel (detail has clientX/Y), we need to pass them.
        this._viewportComponent.zoom(factor, clientX, clientY);

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
        // Disable further interaction on the board area (delegated to viewport/board)
        // We can add a boolean attribute to jigsaw-board/jigsaw-viewport to disable interactions.
        // For now, directly disable pointer events on the viewport container.
        if (this._viewportComponent) this._viewportComponent.style.pointerEvents = 'none';

        // Hide controls
        if (this._jigsawControls) this._jigsawControls.style.display = 'none';

        // Deselect any selected piece visually and in state
        if (this._selectedPieceId !== null) {
             const pieceView = this._jigsawPieces.get(this._selectedPieceId);
             if(pieceView) pieceView.removeAttribute('selected'); // Update view
             this._selectedPieceId = null; // Update controller state
        }
         // Ensure controls component updates visibility
        if (this._jigsawControls) this._jigsawControls.removeAttribute('selected-piece-id');
    }

    // Extraneous methods like toString removed.
}

// Register the custom element in the main entry file (jigsawyer.js)
// customElements.define('jigsaw-puzzle', JigsawPuzzle);
// console.log('🧩 JigsawPuzzle custom element definition ready.');