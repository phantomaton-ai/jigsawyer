import { Viewport } from './viewport.js';
import { Puzzle } from './puzzle.js';
// import { JigsawPieceComponent } from './jigsaw-piece.js'; // Will be used when JigsawPieceComponent is defined
import { getShadowInnerHTML } from './html.js';
// import { Edge } from './edge.js'; // For later when we have SVG edges

const DEFAULT_PUZZLE_WIDTH = 1344;
const DEFAULT_PUZZLE_HEIGHT = 960;

export class JigsawPuzzle extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        this._img = null;
        this._puzzle = null; // Instance of the Puzzle class
        // Viewport needs initial dimensions of the host element, which we don't know yet.
        // We'll create it in connectedCallback or when dimensions are known.
        this._viewport = null;

        this._selectedPieceData = null; // Data model of the selected piece
        this._selectedPieceElement = null; // SVG element of the selected piece

        this._dragOffsetX = 0;
        this._dragOffsetY = 0;
        this._isDraggingPiece = false;

        this._isPanning = false;
        this._panStartX = 0;
        this._panStartY = 0;
        
        this._touchCache = []; // For pinch-zoom gestures

        // DOM element references
        this._puzzleContainer = null;
        this._svgBoard = null;
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
        if (!this.isConnected) return; // Don't do anything if not in DOM yet

        if (name === 'src' && oldValue !== newValue) {
            this._loadImage(newValue);
        }
        if (name === 'size' && oldValue !== newValue) {
            const newSize = parseInt(newValue, 10);
            if (this._puzzle && this._puzzle.pieceCount === newSize) return; // No change
            // Re-initialize if image is already loaded
            if (this._img && this._img.complete) {
                this._initializePuzzle(this._img.width, this._img.height, newSize);
            } else if (this.hasAttribute('src')) {
                // Image might still be loading, _initializePuzzle will be called by _loadImage
            } else {
                // No src yet, but size changed. Initialize with default image dimensions for now.
                this._initializePuzzle(DEFAULT_PUZZLE_WIDTH, DEFAULT_PUZZLE_HEIGHT, newSize);
            }
        }
    }

    connectedCallback() {
        const hostRect = this.getBoundingClientRect();
        this._viewport = new Viewport(hostRect.width || DEFAULT_PUZZLE_WIDTH, hostRect.height || DEFAULT_PUZZLE_HEIGHT);
        
        this.shadowRoot.innerHTML = getShadowInnerHTML({
            puzzleWidth: this._img ? this._img.width : DEFAULT_PUZZLE_WIDTH,
            puzzleHeight: this._img ? this._img.height : DEFAULT_PUZZLE_HEIGHT,
        });

        this._puzzleContainer = this.shadowRoot.getElementById('puzzle-container');
        this._svgBoard = this.shadowRoot.getElementById('svg-board');
        this._gridLayer = this.shadowRoot.getElementById('grid-layer');
        this._piecesLayer = this.shadowRoot.getElementById('pieces-layer');
        this._controlsToolbar = this.shadowRoot.getElementById('controls-toolbar');
        this._pieceActionToolbar = this.shadowRoot.getElementById('piece-action-toolbar');
        this._winMessageContainer = this.shadowRoot.getElementById('win-message-container');

        this._addEventListeners();
        
        // Initial render of the puzzle area transform
        this._renderViewport(); 

        const initialSize = parseInt(this.getAttribute('size'), 10) || 1000;
        if (this.hasAttribute('src')) {
            this._loadImage(this.getAttribute('src'));
        } else {
            // If no src, initialize with default image dimensions and given size
            this._initializePuzzle(DEFAULT_PUZZLE_WIDTH, DEFAULT_PUZZLE_HEIGHT, initialSize);
        }
        
        // Use ResizeObserver to update viewport on host element resize
        this._resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                this._viewport.setHostDimensions(width, height);
                // Potentially re-render or adjust view if needed after resize.
                // For now, just updating viewport's knowledge of host size.
                console.log(`Host resized to ${width}x${height} 📏`);
            }
        });
        this._resizeObserver.observe(this);
    }

    disconnectedCallback() {
        // Clean up event listeners, observers, etc.
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
        }
        // (Other listeners on document/window should be removed if any)
        console.log('JigsawPuzzle component removed from DOM. 👻 Goodbye!');
    }

    _loadImage(src) {
        this._img = new Image();
        this._img.onload = () => {
            console.log(`Image ${src} loaded! 🖼️ Dimensions: ${this._img.width}x${this._img.height}`);
            const pieceCount = parseInt(this.getAttribute('size'), 10) || 1000;
            this._initializePuzzle(this._img.width, this._img.height, pieceCount);
        };
        this._img.onerror = () => {
            console.error(`😱 Failed to load image: ${src}. Is it hiding like a mischievous sprite?`);
            this.shadowRoot.innerHTML += `<p style="color:red; position:absolute; top:10px; left:10px; z-index: 9999;">Error loading image: ${src}</p>`;
        };
        this._img.src = src;
    }

    _initializePuzzle(imageWidth, imageHeight, pieceCount) {
        if (!imageWidth || !imageHeight || !pieceCount) {
            console.warn("👻 Waiting for image dimensions or piece count to be fully ready...");
            return;
        }
        console.log(`Initializing puzzle: ${pieceCount} pieces, image ${imageWidth}x${imageHeight}`);
        this._puzzle = new Puzzle(imageWidth, imageHeight, pieceCount);
        
        // Set the SVG board's viewBox to match the puzzle's "world" size initially
        // The scatter area might be larger, so we might need a larger viewBox
        // For now, let's make it encompass the scatter area from puzzle.js
        const scatterWidth = imageWidth * 2;
        const scatterHeight = imageHeight * 2;
        const scatterOffsetX = (imageWidth - scatterWidth) / 2;
        const scatterOffsetY = (imageHeight - scatterHeight) / 2;

        this._svgBoard.setAttribute('viewBox', `${scatterOffsetX} ${scatterOffsetY} ${scatterWidth} ${scatterHeight}`);

        this._generatePieceElements();
        this._drawGrid();
        this._renderViewport(); // Update transforms based on viewport
        this._checkWinCondition(); // In case of a 1-piece puzzle that's auto-solved
    }

    _generatePieceElements() {
        if (!this._puzzle || !this._svgBoard) return;
        this._piecesLayer.innerHTML = ''; // Clear existing pieces

        this._puzzle.getAllPieces().forEach(pieceData => {
            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.classList.add('puzzle-piece-group');
            group.setAttribute('data-piece-id', pieceData.id);
            group.setAttribute('transform', pieceData.transform); // Initial position and rotation

            // Define a unique pattern for this piece using the image
            const patternId = `pattern-piece-${pieceData.id}`;
            const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
            pattern.setAttribute('id', patternId);
            pattern.setAttribute('patternUnits', 'userSpaceOnUse'); // Critical for correct mapping
            pattern.setAttribute('width', this._puzzle.imageWidth); // Full image width
            pattern.setAttribute('height', this._puzzle.imageHeight); // Full image height
            
            const imageEl = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            imageEl.setAttributeNS('http://www.w3.org/1999/xlink', 'href', this._img.src);
            imageEl.setAttribute('x', 0); // Image is at 0,0 within pattern
            imageEl.setAttribute('y', 0);
            imageEl.setAttribute('width', this._puzzle.imageWidth);
            imageEl.setAttribute('height', this._puzzle.imageHeight);
            pattern.appendChild(imageEl);

            // Add pattern to defs - ensure defs exist
            let defs = this._svgBoard.querySelector('defs');
            if (!defs) {
                defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                this._svgBoard.insertBefore(defs, this._svgBoard.firstChild);
            }
            defs.appendChild(pattern);
            
            // Create the piece shape (rectangle for now)
            // The fill will be offset to show the correct part of the image
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.classList.add('piece-shape'); // For styling selected state
            rect.setAttribute('x', 0); // Origin for the piece's own drawing
            rect.setAttribute('y', 0);
            rect.setAttribute('width', pieceData.width);
            rect.setAttribute('height', pieceData.height);
            // The fill needs to be offset by the NEGATIVE of the piece's correctX/Y
            // because the pattern starts at (0,0) of the full image.
            rect.setAttribute('fill', `url(#${patternId}) translate(${-pieceData.correctX}, ${-pieceData.correctY})`);
            // We need to apply a transform to the fill pattern itself, not the rect.
            // The `patternTransform` or transforming the <image> inside the pattern is better.
            // Let's adjust the image element inside the pattern for simplicity for now.
            // No, the pattern's x,y,width,height and the image's x,y are enough.
            // The userSpaceOnUse means the pattern content is in the same coord system.
            // So if rect is at (0,0), fill should look at (correctX, correctY) in the pattern.
            // The `fill` attribute doesn't take `translate()`.
            // The pattern content needs to be shifted.
            // We can set x and y on the <image> within the pattern to achieve this.
            // The pattern itself refers to a region of the source image.
            // The rect is drawn from 0,0 to pieceWidth,pieceHeight in its own group.
            // The pattern's content needs to be positioned so that pieceData.correctX, pieceData.correctY
            // of the image aligns with 0,0 of the rect.
            // So, image x = -pieceData.correctX, y = -pieceData.correctY.
            imageEl.setAttribute('x', -pieceData.correctX);
            imageEl.setAttribute('y', -pieceData.correctY);


            // TODO: Replace rect with complex SVG <path> for actual jigsaw shapes using pieceData.edgeShapes
            
            group.appendChild(rect);
            this._piecesLayer.appendChild(group);
            pieceData.element = group; // Link data model to SVG element

            // Add event listeners directly to the piece group
            group.addEventListener('mousedown', (e) => this._onPieceMouseDown(e, pieceData));
            group.addEventListener('touchstart', (e) => this._onPieceTouchStart(e, pieceData), { passive: false });
        });
    }

    _drawGrid() {
        if (!this._puzzle || !this._gridLayer) return;
        this._gridLayer.innerHTML = ''; // Clear existing grid

        const { rows, cols, pieceWidth, pieceHeight } = this._puzzle;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                dot.classList.add('grid-dot');
                dot.setAttribute('cx', c * pieceWidth + pieceWidth / 2);
                dot.setAttribute('cy', r * pieceHeight + pieceHeight / 2);
                dot.setAttribute('r', 3 / this._viewport.zoomLevel); // Make dots smaller at higher zoom, or fixed small size
                this._gridLayer.appendChild(dot);
            }
        }
    }
    
    _renderViewport() {
        if (!this._viewport || !this._puzzleContainer) return;
        this._puzzleContainer.style.transform = this._viewport.getPuzzleAreaTransform();
        // Grid dots might need radii adjusted if they are to appear constant screen size
        // For now, they scale with zoom. If we used SVG for grid, this is natural.
        // If we redraw grid, ensure dot sizes are re-evaluated.
        // this._drawGrid(); // Could redraw grid if dots need to be screen-size constant
        console.log(`Viewport Rendered: Zoom ${this._viewport.zoomLevel.toFixed(2)}, Pan (${this._viewport.viewBoxX.toFixed(0)}, ${this._viewport.viewBoxY.toFixed(0)})`);
    }

    // --- Event Handlers ---
    _addEventListeners() {
        // Pan/Zoom buttons
        this.shadowRoot.getElementById('pan-left').addEventListener('click', () => this._panViewport(-50, 0));
        this.shadowRoot.getElementById('pan-right').addEventListener('click', () => this._panViewport(50, 0));
        this.shadowRoot.getElementById('pan-up').addEventListener('click', () => this._panViewport(0, -50));
        this.shadowRoot.getElementById('pan-down').addEventListener('click', () => this._panViewport(0, 50));
        this.shadowRoot.getElementById('zoom-in').addEventListener('click', () => this._zoomViewport(1.25));
        this.shadowRoot.getElementById('zoom-out').addEventListener('click', () => this._zoomViewport(0.8));

        // Piece rotation buttons
        this.shadowRoot.getElementById('rotate-neg-90').addEventListener('click', () => this._rotateSelectedPiece(-90));
        this.shadowRoot.getElementById('rotate-180').addEventListener('click', () => this._rotateSelectedPiece(180));
        this.shadowRoot.getElementById('rotate-pos-90').addEventListener('click', () => this._rotateSelectedPiece(90));

        // Mouse panning on SVG board (listening on #puzzle-container which covers the SVG)
        this._puzzleContainer.addEventListener('mousedown', this._onPanStart.bind(this));
        // Mouse move and up listeners on the host or window to capture events outside puzzle-container
        this.addEventListener('mousemove', this._onHostMouseMove.bind(this));
        this.addEventListener('mouseup', this._onHostMouseUp.bind(this));
        this.addEventListener('mouseleave', this._onHostMouseLeave.bind(this)); // If mouse leaves component entirely

        // Touch events on SVG board for panning & pinch-zoom
        this._puzzleContainer.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: false });
        this.addEventListener('touchmove', this._onHostTouchMove.bind(this), { passive: false });
        this.addEventListener('touchend', this._onHostTouchEnd.bind(this), { passive: false });
        this.addEventListener('touchcancel', this._onHostTouchEnd.bind(this), { passive: false });


        // Wheel zoom on the component
        this.addEventListener('wheel', this._onWheelZoom.bind(this), { passive: false });
    }

    // --- Piece Interaction ---
    _onPieceMouseDown(event, pieceData) {
        event.stopPropagation(); // Prevent panning when clicking a piece
        if (event.button !== 0) return; // Only left click

        this._isDraggingPiece = true;
        this._selectPiece(pieceData);

        const hostRect = this.getBoundingClientRect();
        const screenX = event.clientX - hostRect.left;
        const screenY = event.clientY - hostRect.top;
        const worldMouse = this._viewport.toWorldCoordinates(screenX, screenY);

        this._dragOffsetX = worldMouse.x - pieceData.x;
        this._dragOffsetY = worldMouse.y - pieceData.y;

        if (pieceData.element) pieceData.element.style.cursor = 'grabbing';
    }
    
    _onPieceTouchStart(event, pieceData) {
        event.stopPropagation();
        if (event.touches.length === 1) {
            this._isDraggingPiece = true;
            this._selectPiece(pieceData);
            
            const touch = event.touches[0];
            const hostRect = this.getBoundingClientRect();
            const screenX = touch.clientX - hostRect.left;
            const screenY = touch.clientY - hostRect.top;
            const worldMouse = this._viewport.toWorldCoordinates(screenX, screenY);

            this._dragOffsetX = worldMouse.x - pieceData.x;
            this._dragOffsetY = worldMouse.y - pieceData.y;
            if (pieceData.element) pieceData.element.style.cursor = 'grabbing'; // Should be .puzzle-piece-group
        }
    }

    _handlePieceMove(screenX, screenY) {
        if (!this._isDraggingPiece || !this._selectedPieceData) return;

        const hostRect = this.getBoundingClientRect();
        const currentScreenX = screenX - hostRect.left;
        const currentScreenY = screenY - hostRect.top;
        const worldMouse = this._viewport.toWorldCoordinates(currentScreenX, currentScreenY);

        this._selectedPieceData.setPosition(
            worldMouse.x - this._dragOffsetX,
            worldMouse.y - this._dragOffsetY
        );
        this._updatePieceElementTransform(this._selectedPieceData);
    }

    _handlePieceDragEnd() {
        if (this._isDraggingPiece && this._selectedPieceData) {
            if (this._selectedPieceData.element) {
                this._selectedPieceData.element.style.cursor = 'grab';
            }
            this._snapPieceToGrid(this._selectedPieceData);
        }
        this._isDraggingPiece = false;
        // Do not deselect here, allow snapping to deselect or another click
    }

    _selectPiece(pieceData) {
        if (this._selectedPieceData === pieceData && pieceData !== null) return; // Already selected

        if (this._selectedPieceData && this._selectedPieceData.element) {
            this._selectedPieceData.element.classList.remove('selected');
            this._selectedPieceData.isSelected = false;
        }

        this._selectedPieceData = pieceData;

        if (this._selectedPieceData) {
            this._selectedPieceElement = this._selectedPieceData.element; // Update reference
            this._selectedPieceElement.classList.add('selected');
            this._selectedPieceData.isSelected = true;
            this._pieceActionToolbar.style.display = 'flex';
            // Bring piece to front (SVG re-append)
            this._piecesLayer.appendChild(this._selectedPieceElement);
        } else {
            this._selectedPieceElement = null;
            this._pieceActionToolbar.style.display = 'none';
        }
    }

    _rotateSelectedPiece(angleDelta) {
        if (!this._selectedPieceData) return;
        const currentRotation = this._selectedPieceData.rotation;
        this._selectedPieceData.setRotation(currentRotation + angleDelta);
        this._updatePieceElementTransform(this._selectedPieceData);
        this._snapPieceToGrid(this._selectedPieceData); // Check snap after rotation
    }
    
    _updatePieceElementTransform(pieceData) {
        if (pieceData && pieceData.element) {
            pieceData.element.setAttribute('transform', pieceData.transform);
        }
    }

    _snapPieceToGrid(pieceData) {
        if (!pieceData) return;
        const snapThreshold = pieceData.width / 3; // Dynamic threshold based on piece size

        if (pieceData.canSnap(snapThreshold)) {
            pieceData.snap();
            this._updatePieceElementTransform(pieceData);
            if (pieceData.element) pieceData.element.classList.remove('selected'); // Deselect on snap
            if (this._selectedPieceData === pieceData) { // If the snapped piece was selected
                 this._selectPiece(null); // Deselect it
            }
            if (this._puzzle.isSolved()) {
                this._showWinMessage();
            }
        } else {
            pieceData.isSnapped = false; // Ensure it's marked as not snapped if it moved away
        }
    }

    // --- Panning and Zooming ---
    _panViewport(dxScreen, dyScreen) {
        this._viewport.pan(dxScreen, dyScreen);
        this._renderViewport();
    }

    _zoomViewport(factor, screenPointerX, screenPointerY) {
        // If screenPointerX/Y are from a mouse/touch event, they are relative to viewport.
        // Here, we need them relative to the host element for Viewport class.
        if (this._viewport.zoom(factor, screenPointerX, screenPointerY)) {
            this._renderViewport();
            this._drawGrid(); // Redraw grid as dot sizes might change relative to new zoom
        }
    }
    
    _onPanStart(event) {
        // This event is on puzzleContainer. If target is a piece, piece handler already stopped propagation.
        if (event.target !== this._svgBoard && event.target !== this._puzzleContainer && event.target !== this._gridLayer) {
             // console.log("Pan start ignored, target was:", event.target);
            return;
        }
        if (event.button !== 0) return; // Only left click for panning

        this._isPanning = true;
        this._panStartX = event.clientX;
        this._panStartY = event.clientY;
        this.style.cursor = 'grabbing';
    }

    // Generic host move/end listeners that decide if it's piece drag or pan
    _onHostMouseMove(event) {
        if (this._isDraggingPiece) {
            this._handlePieceMove(event.clientX, event.clientY);
        } else if (this._isPanning) {
            event.preventDefault();
            const dx = event.clientX - this._panStartX;
            const dy = event.clientY - this._panStartY;
            this._panViewport(dx, dy); // Viewport expects screen deltas
            this._panStartX = event.clientX;
            this._panStartY = event.clientY;
        }
    }

    _onHostMouseUp(event) {
        if (this._isDraggingPiece) {
            this._handlePieceDragEnd();
            // Don't reset _isDraggingPiece here, _handlePieceDragEnd does it
        }
        if (this._isPanning) {
            this._isPanning = false;
            this.style.cursor = 'default';
        }
    }
    
    _onHostMouseLeave(event) {
        // If dragging or panning, and mouse leaves component, treat as end of interaction
        if (this._isDraggingPiece) {
            this._handlePieceDragEnd();
        }
        if (this._isPanning) {
            this._isPanning = false;
            this.style.cursor = 'default';
        }
    }

    _onTouchStart(event) { // On puzzleContainer
        // If target is a piece, its specific touchstart will handle it and stop propagation.
        // This means if we reach here, it's a pan/zoom start.
        event.preventDefault();
        const touches = event.touches;

        if (touches.length === 1) { // Pan start
            // Check if we're somehow starting pan over a piece that didn't catch its own touchstart
            // This shouldn't happen if piece touch listeners are working correctly.
            const targetElement = this.shadowRoot.elementFromPoint(touches[0].clientX, touches[0].clientY);
            if (targetElement && targetElement.closest('.puzzle-piece-group')) {
                // This case means the touch started on a piece, but its listener didn't fire or allow bubbling.
                // This might happen if the piece listener is on the <rect> but touch is on <g>.
                // For now, assume piece touchstart handles itself.
                // console.log("Touch start on puzzle container, but over a piece element. Piece should handle.");
                return; 
            }
            
            this._isPanning = true;
            this._panStartX = touches[0].clientX;
            this._panStartY = touches[0].clientY;
            this._touchCache = Array.from(touches).map(t => ({ id: t.identifier, clientX: t.clientX, clientY: t.clientY }));

        } else if (touches.length >= 2) { // Zoom start
            this._isPanning = false; // Stop panning if it was active
            this._isDraggingPiece = false; // Stop dragging piece
            this._touchCache = Array.from(touches).map(t => ({ id: t.identifier, clientX: t.clientX, clientY: t.clientY }));
        }
    }

    _onHostTouchMove(event) {
        event.preventDefault();
        const touches = event.touches;

        if (this._isDraggingPiece && touches.length === 1) {
            this._handlePieceMove(touches[0].clientX, touches[0].clientY);
        } else if (this._isPanning && touches.length === 1) {
            const touch = touches[0];
            const dx = touch.clientX - this._panStartX;
            const dy = touch.clientY - this._panStartY;
            this._panViewport(dx, dy);
            this._panStartX = touch.clientX;
            this._panStartY = touch.clientY;
        } else if (touches.length >= 2 && this._touchCache.length >= 2) {
            // Pinch-zoom logic
            const t1_new = touches[0];
            const t2_new = touches[1];
            const t1_old_candidate = this._touchCache.find(t => t.id === t1_new.identifier);
            const t2_old_candidate = this._touchCache.find(t => t.id === t2_new.identifier);

            // Ensure we found both original touches in our cache
            if (t1_old_candidate && t2_old_candidate) {
                const t1_old = t1_old_candidate;
                const t2_old = t2_old_candidate;

                const distOld = Math.hypot(t1_old.clientX - t2_old.clientX, t1_old.clientY - t2_old.clientY);
                const distNew = Math.hypot(t1_new.clientX - t2_new.clientX, t1_new.clientY - t2_new.clientY);

                if (distOld > 0) { // Avoid division by zero
                    const scaleFactor = distNew / distOld;
                    
                    const hostRect = this.getBoundingClientRect();
                    const midXNew_screen = (t1_new.clientX + t2_new.clientX) / 2 - hostRect.left;
                    const midYNew_screen = (t1_new.clientY + t2_new.clientY) / 2 - hostRect.top;
                    
                    this._zoomViewport(scaleFactor, midXNew_screen, midYNew_screen);
                }
            }
            // Update cache for next move event
            this._touchCache = Array.from(touches).map(t => ({ id: t.identifier, clientX: t.clientX, clientY: t.clientY }));
        }
    }

    _onHostTouchEnd(event) {
        event.preventDefault();
        if (this._isDraggingPiece) {
             // Find if the touch that ended was the one dragging
            const endedDraggingTouch = Array.from(event.changedTouches).some(ct => {
                // This logic is tricky; for simplicity, any touch end stops dragging if it was one touch
                return this._touchCache.some(tc => tc.id === ct.identifier);
            });
            if (event.touches.length < 1 && endedDraggingTouch) { // Or if the specific dragging touch ended
                 this._handlePieceDragEnd();
            }
        }
        
        // Update cache: remove ended touches
        const currentTouchIds = Array.from(event.touches).map(t => t.identifier);
        this._touchCache = this._touchCache.filter(tc => currentTouchIds.includes(tc.id));

        if (event.touches.length < 2) { // If less than 2 touches, stop pinch-zoom mode
            // No explicit state for pinch-zoom mode, but cache will be small.
        }
        if (event.touches.length < 1) { // If no touches left, stop panning mode
            this._isPanning = false;
            this.style.cursor = 'default';
        } else if (event.touches.length === 1 && this._isPanning) {
            // If panning and one touch remains, update pan start for that remaining touch
            this._panStartX = event.touches[0].clientX;
            this._panStartY = event.touches[0].clientY;
        }
    }
    
    _onWheelZoom(event) {
        event.preventDefault();
        const scaleFactor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
        const hostRect = this.getBoundingClientRect();
        const mouseX_host = event.clientX - hostRect.left;
        const mouseY_host = event.clientY - hostRect.top;
        this._zoomViewport(scaleFactor, mouseX_host, mouseY_host);
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
        // Optionally disable further interaction
        if (this._puzzle) {
            this._puzzle.getAllPieces().forEach(p => {
                if (p.element) p.element.style.pointerEvents = 'none';
            });
        }
        if (this._controlsToolbar) this._controlsToolbar.style.display = 'none';
        if (this._pieceActionToolbar) this._pieceActionToolbar.style.display = 'none';
    }
}