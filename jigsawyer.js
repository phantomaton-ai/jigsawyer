class JigsawPuzzle extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._img = null;
        this._pieces = [];
        this._grid = null;
        this._canvas = null; // Or maybe we use divs for pieces? 🤔 Let's start with a canvas idea.
        this.puzzleWidth = 1344; // As per SKETCH.md assumption
        this.puzzleHeight = 960;  // As per SKETCH.md assumption
        this._selectedPiece = null;
        this._offsetX = 0; // For dragging
        this._offsetY = 0; // For dragging
        this._isDraggingPiece = false;
        this._isPannning = false;
        this._panStartX = 0;
        this._panStartY = 0;
        this._viewBoxX = 0;
        this._viewBoxY = 0;
        this._zoomLevel = 1;
    }

    static get observedAttributes() {
        return ['src', 'size'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'src' && oldValue !== newValue) {
            this._loadImage(newValue);
        }
        if (name === 'size' && oldValue !== newValue) {
            this.pieceCount = parseInt(newValue, 10) || 1000; // Default to 1000
            if (this._img && this._img.complete) {
                this._initializePuzzle();
            }
        }
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    width: ${this.puzzleWidth}px; /* Initial container size, can be adjusted */
                    height: ${this.puzzleHeight}px; /* Initial container size */
                    position: relative; /* For positioning pieces and controls */
                    background-color: #222; /* Darker background for the puzzle area */
                    overflow: hidden; /* Important for panning/zooming! */
                    border: 2px solid #444;
                    user-select: none; /* Prevent text selection during drags */
                }
                #puzzle-canvas {
                    /* We might draw pieces here or use individual SVGs/divs */
                    /* For now, let's assume this is where the "grid" dots might appear */
                    width: 100%;
                    height: 100%;
                    position: absolute;
                    top: 0;
                    left: 0;
                }
                .puzzle-piece {
                    /* Style for individual pieces if we go the div route */
                    position: absolute; /* Pieces will be absolutely positioned */
                    background-size: cover;
                    border: 1px solid #000; /* Little border for pieces */
                    cursor: grab;
                    transition: transform 0.1s ease-out, box-shadow 0.1s ease-out;
                }
                .puzzle-piece.selected {
                    box-shadow: 0 0 10px 3px #ffdf00; /* Golden spooky highlight! ✨👻 */
                    z-index: 1000; /* Bring to front */
                    cursor: grabbing;
                }
                #controls-container {
                    position: absolute;
                    bottom: 10px;
                    left: 50%;
                    transform: translateX(-50%);
                    background-color: rgba(50, 50, 50, 0.8);
                    padding: 8px;
                    border-radius: 5px;
                    display: flex;
                    gap: 8px;
                    z-index: 2000; /* Above pieces */
                }
                #controls-container button {
                    background-color: #ff9800; /* Jack-o-lantern orange! 🎃 */
                    color: #000;
                    border: 1px solid #000;
                    padding: 5px 10px;
                    font-family: 'Comic Sans MS', 'Chalkboard SE', 'Bradley Hand', cursive;
                    font-weight: bold;
                    cursor: pointer;
                    border-radius: 3px;
                }
                #controls-container button:hover {
                    background-color: #e68900;
                }
                #piece-rotation-controls {
                    position: absolute;
                    top: 10px;
                    left: 50%;
                    transform: translateX(-50%);
                    background-color: rgba(50, 50, 50, 0.8);
                    padding: 8px;
                    border-radius: 5px;
                    display: none; /* Hidden by default */
                    gap: 8px;
                    z-index: 2000;
                }
            </style>
            <div id="puzzle-area">
                <!-- Pieces will be appended here if using div strategy -->
            </div>
            <canvas id="puzzle-canvas"></canvas> <!-- For grid dots and maybe pieces later -->
            <div id="controls-container">
                <button id="pan-left">⬅️ Pan</button>
                <button id="pan-right">➡️ Pan</button>
                <button id="pan-up">⬆️ Pan</button>
                <button id="pan-down">⬇️ Pan</button>
                <button id="zoom-in">➕ Zoom</button>
                <button id="zoom-out">➖ Zoom</button>
            </div>
            <div id="piece-rotation-controls">
                <button id="rotate-neg-90">↪️ -90°</button>
                <button id="rotate-180">🔄 180°</button>
                <button id="rotate-pos-90">↩️ +90°</button>
            </div>
        `;

        this._canvas = this.shadowRoot.getElementById('puzzle-canvas');
        this._puzzleArea = this.shadowRoot.getElementById('puzzle-area');
        this._controlsContainer = this.shadowRoot.getElementById('controls-container');
        this._rotationControls = this.shadowRoot.getElementById('piece-rotation-controls');

        this._canvas.width = this.puzzleWidth; // Use assumed full puzzle dimension for canvas drawing space
        this._canvas.height = this.puzzleHeight;

        this.pieceCount = parseInt(this.getAttribute('size'), 10) || 1000;
        if (this.hasAttribute('src')) {
            this._loadImage(this.getAttribute('src'));
        }

        this._addEventListeners();
    }

    _loadImage(src) {
        this._img = new Image();
        this._img.onload = () => {
            console.log(`Image ${src} loaded successfully! 🖼️ Dimensions: ${this._img.width}x${this._img.height}`);
            // Forcing dimensions as per spec, though we could use actual image dimensions
            if (this._img.width !== this.puzzleWidth || this._img.height !== this.puzzleHeight) {
                console.warn(`⚠️ Image dimensions (${this._img.width}x${this._img.height}) do not match assumed dimensions (${this.puzzleWidth}x${this.puzzleHeight}). Proceeding with assumed dimensions.`);
            }
            this._initializePuzzle();
        };
        this._img.onerror = () => {
            console.error(`😱 Failed to load image: ${src}. Is it in the right place, like a mischievous gremlin?`);
            this.shadowRoot.innerHTML += `<p style="color:red;">Error loading image: ${src}</p>`;
        };
        this._img.src = src;
    }

    _initializePuzzle() {
        if (!this._img || !this._img.complete || this.pieceCount <= 0) {
            console.log("👻 Waiting for image or piece count to be ready...");
            return;
        }
        console.log(`Initializing puzzle with ${this.pieceCount} pieces. Image size: ${this.puzzleWidth}x${this.puzzleHeight}`);
        this._generatePieces();
        this._render();
    }

    _generatePieces() {
        this._pieces = [];
        this._puzzleArea.innerHTML = ''; // Clear previous pieces

        // Determine grid (e.g., 40x25 for 1000 pieces)
        // This is a common way to approximate a square-ish layout for N pieces
        const cols = Math.ceil(Math.sqrt(this.pieceCount * (this.puzzleWidth / this.puzzleHeight)));
        const rows = Math.ceil(this.pieceCount / cols);

        const pieceWidth = this.puzzleWidth / cols;
        const pieceHeight = this.puzzleHeight / rows;

        console.log(`🧩 Generating ${rows}x${cols} grid. Piece size: ${pieceWidth.toFixed(2)}x${pieceHeight.toFixed(2)}`);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (this._pieces.length >= this.pieceCount) break;

                const piece = document.createElement('div');
                piece.classList.add('puzzle-piece');
                piece.style.width = `${pieceWidth}px`;
                piece.style.height = `${pieceHeight}px`;
                piece.style.backgroundImage = `url(${this._img.src})`;
                // Background position needs to be scaled by zoom level of image itself if any, but for now direct mapping
                piece.style.backgroundPosition = `-${c * pieceWidth}px -${r * pieceHeight}px`;
                piece.style.backgroundSize = `${this.puzzleWidth}px ${this.puzzleHeight}px`; // Show the whole image, clipped by div

                // Random initial position and rotation
                const randomX = Math.random() * (this.puzzleWidth - pieceWidth);
                const randomY = Math.random() * (this.puzzleHeight - pieceHeight);
                const randomAngle = Math.floor(Math.random() * 4) * 90; // 0, 90, 180, 270

                piece.style.transform = `translate(${randomX}px, ${randomY}px) rotate(${randomAngle}deg)`;
                piece.dataset.id = this._pieces.length;
                piece.dataset.correctX = c * pieceWidth; // Store correct position for snapping later
                piece.dataset.correctY = r * pieceHeight;
                piece.dataset.currentRotation = randomAngle; // Store current rotation

                // Store piece data
                this._pieces.push({
                    element: piece,
                    id: this._pieces.length,
                    x: randomX,
                    y: randomY,
                    width: pieceWidth,
                    height: pieceHeight,
                    rotation: randomAngle,
                    isSnapped: false, // Will be used later
                    correctX: c * pieceWidth,
                    correctY: r * pieceHeight,
                });

                this._puzzleArea.appendChild(piece);
                this._addPieceEventListeners(piece);
            }
            if (this._pieces.length >= this.pieceCount) break;
        }
        console.log(`Generated ${this._pieces.length} piece elements.`);
    }

    _drawGrid() {
        const ctx = this._canvas.getContext('2d');
        ctx.clearRect(0, 0, this._canvas.width, this._canvas.height); // Clear canvas

        // Apply pan and zoom to the grid rendering
        ctx.save();
        ctx.translate(-this._viewBoxX, -this._viewBoxY);
        ctx.scale(this._zoomLevel, this._zoomLevel);

        const cols = Math.ceil(Math.sqrt(this.pieceCount * (this.puzzleWidth / this.puzzleHeight)));
        const rows = Math.ceil(this.pieceCount / cols);
        const pieceWidth = this.puzzleWidth / cols;
        const pieceHeight = this.puzzleHeight / rows;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'; // Semi-transparent white dots 👻
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const dotX = c * pieceWidth + pieceWidth / 2;
                const dotY = r * pieceHeight + pieceHeight / 2;
                ctx.beginPath();
                ctx.arc(dotX, dotY, 2, 0, Math.PI * 2); // Small dots
                ctx.fill();
            }
        }
        ctx.restore();
        console.log("Grid dots drawn (or re-drawn).");
    }

    _addEventListeners() {
        // Pan/Zoom controls
        this.shadowRoot.getElementById('pan-left').addEventListener('click', () => this._pan(-50, 0));
        this.shadowRoot.getElementById('pan-right').addEventListener('click', () => this._pan(50, 0));
        this.shadowRoot.getElementById('pan-up').addEventListener('click', () => this._pan(0, -50));
        this.shadowRoot.getElementById('pan-down').addEventListener('click', () => this._pan(0, 50));
        this.shadowRoot.getElementById('zoom-in').addEventListener('click', () => this._zoom(1.2));
        this.shadowRoot.getElementById('zoom-out').addEventListener('click', () => this._zoom(1 / 1.2));

        // Piece rotation controls
        this.shadowRoot.getElementById('rotate-neg-90').addEventListener('click', () => this._rotateSelectedPiece(-90));
        this.shadowRoot.getElementById('rotate-180').addEventListener('click', () => this._rotateSelectedPiece(180));
        this.shadowRoot.getElementById('rotate-pos-90').addEventListener('click', () => this._rotateSelectedPiece(90));

        // Mouse panning on puzzle area background
        this._puzzleArea.addEventListener('mousedown', this._onPanStart.bind(this));
        this.addEventListener('mousemove', this._onPanMove.bind(this)); // Listen on component for moves outside puzzleArea
        this.addEventListener('mouseup', this._onPanEnd.bind(this));
        this.addEventListener('mouseleave', this._onPanEnd.bind(this)); // If mouse leaves component

        // Touch events for panning & pinch-zoom
        this._puzzleArea.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: false });
        this.addEventListener('touchmove', this._onTouchMove.bind(this), { passive: false });
        this.addEventListener('touchend', this._onTouchEnd.bind(this));

        // Wheel zoom
        this._puzzleArea.addEventListener('wheel', this._onWheelZoom.bind(this), { passive: false });
    }

    _addPieceEventListeners(pieceElement) {
        pieceElement.addEventListener('mousedown', (e) => this._onPieceMouseDown(e, pieceElement));
        // Touch events for pieces will be handled in _onTouchStart to differentiate from panning
    }

    _onPieceMouseDown(event, pieceElement) {
        event.stopPropagation(); // Prevent panning when clicking a piece
        if (event.button !== 0) return; // Only left click

        this._isDraggingPiece = true;
        this._selectPiece(pieceElement);

        const pieceData = this._pieces.find(p => p.element === pieceElement);
        if (!pieceData) return;

        // Calculate offset from mouse to piece's top-left corner, considering current zoom and pan
        // The piece's transform translate is in unzoomed, unpanned coordinates.
        // Mouse event coordinates are relative to the viewport.
        // We need to transform mouse coordinates into the "puzzle world" space.

        const hostRect = this.getBoundingClientRect();
        const mouseXInHost = event.clientX - hostRect.left;
        const mouseYInHost = event.clientY - hostRect.top;

        // Convert mouse position to "world" coordinates (inverse of pan/zoom)
        const worldMouseX = (mouseXInHost + this._viewBoxX) / this._zoomLevel;
        const worldMouseY = (mouseYInHost + this._viewBoxY) / this._zoomLevel;

        this._offsetX = worldMouseX - pieceData.x;
        this._offsetY = worldMouseY - pieceData.y;

        pieceElement.style.cursor = 'grabbing';
    }

    _onMouseMove(event) { // This will be bound and called by a global listener if dragging
        if (!this._isDraggingPiece || !this._selectedPiece) return;
        event.preventDefault();

        const pieceData = this._pieces.find(p => p.element === this._selectedPiece);
        if (!pieceData) return;

        const hostRect = this.getBoundingClientRect();
        const mouseXInHost = event.clientX - hostRect.left;
        const mouseYInHost = event.clientY - hostRect.top;

        const worldMouseX = (mouseXInHost + this._viewBoxX) / this._zoomLevel;
        const worldMouseY = (mouseYInHost + this._viewBoxY) / this._zoomLevel;

        pieceData.x = worldMouseX - this._offsetX;
        pieceData.y = worldMouseY - this._offsetY;

        this._updatePieceTransform(pieceData);
    }

    _onMouseUp(event) {
        if (this._isDraggingPiece && this._selectedPiece) {
            const pieceElement = this._selectedPiece;
            pieceElement.style.cursor = 'grab';
            const pieceData = this._pieces.find(p => p.element === pieceElement);
            if (pieceData) {
                this._snapPieceToGrid(pieceData);
            }
        }
        this._isDraggingPiece = false;
    }


    _onPanStart(event) {
        // Only pan if not clicking on a piece (event propagation should be stopped by piece mousedown)
        // Or if the target is the puzzle-area itself
        if (event.target !== this._puzzleArea && event.target !== this._canvas) return;
        if (event.button !== 0) return; // Only left click

        this._isPannning = true;
        // event.clientX/Y are viewport coordinates
        this._panStartX = event.clientX;
        this._panStartY = event.clientY;
        this.style.cursor = 'grabbing'; // Show grabbing cursor on host
    }

    _onPanMove(event) {
        if (this._isDraggingPiece) { // Prioritize piece dragging
            this._onMouseMove(event); // Delegate to piece dragging logic
            return;
        }
        if (!this._isPannning) return;
        event.preventDefault();

        const dx = event.clientX - this._panStartX;
        const dy = event.clientY - this._panStartY;

        // Panning is inverse: if mouse moves right, content moves left
        this._viewBoxX -= dx / this._zoomLevel; // Adjust pan by zoom level
        this._viewBoxY -= dy / this._zoomLevel;

        this._panStartX = event.clientX;
        this._panStartY = event.clientY;

        this._render();
    }

    _onPanEnd(event) {
        if (this._isPannning) {
            this._isPannning = false;
            this.style.cursor = 'default';
        }
        if (this._isDraggingPiece) { // This also handles mouseup for pieces
            this._onMouseUp(event);
        }
    }

    // Touch event handlers (simplified for now)
    _touchCache = []; // For pinch-zoom

    _onTouchStart(event) {
        event.preventDefault(); // Crucial to prevent scrolling, etc.
        const touches = event.touches;

        if (touches.length === 1) {
            const touch = touches[0];
            const targetElement = this.shadowRoot.elementFromPoint(touch.clientX, touch.clientY);

            if (targetElement && targetElement.classList && targetElement.classList.contains('puzzle-piece')) {
                this._onPieceMouseDown({ // Simulate mousedown for piece
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    button: 0,
                    stopPropagation: () => {}, // no-op
                    preventDefault: () => {} // no-op
                }, targetElement);
            } else {
                // Start panning
                this._isPannning = true;
                this._panStartX = touch.clientX;
                this._panStartY = touch.clientY;
            }
        } else if (touches.length >= 2) {
            this._isPannning = false; // Stop panning if it was active
            this._isDraggingPiece = false; // Stop dragging piece if it was active
            for (let i = 0; i < touches.length; i++) {
                this._touchCache.push(touches[i]);
            }
        }
    }

    _onTouchMove(event) {
        event.preventDefault();
        const touches = event.touches;

        if (this._isDraggingPiece && touches.length === 1) {
             this._onMouseMove({ // Simulate mousemove for piece
                clientX: touches[0].clientX,
                clientY: touches[0].clientY,
                preventDefault: () => {} // no-op
            });
        } else if (this._isPannning && touches.length === 1) {
            const touch = touches[0];
            const dx = touch.clientX - this._panStartX;
            const dy = touch.clientY - this._panStartY;
            this._viewBoxX -= dx / this._zoomLevel;
            this._viewBoxY -= dy / this._zoomLevel;
            this._panStartX = touch.clientX;
            this._panStartY = touch.clientY;
            this._render();
        } else if (touches.length >= 2 && this._touchCache.length >= 2) {
            // Pinch-zoom logic
            const t1_new = touches[0];
            const t2_new = touches[1];
            const t1_old = this._touchCache.find(t => t.identifier === t1_new.identifier);
            const t2_old = this._touchCache.find(t => t.identifier === t2_new.identifier);

            if (t1_old && t2_old) {
                const distOld = Math.hypot(t1_old.clientX - t2_old.clientX, t1_old.clientY - t2_old.clientY);
                const distNew = Math.hypot(t1_new.clientX - t2_new.clientX, t1_new.clientY - t2_new.clientY);

                if (distOld > 0) { // Avoid division by zero
                    const scaleFactor = distNew / distOld;
                    
                    // Get midpoint for zooming center
                    const midXNew = (t1_new.clientX + t2_new.clientX) / 2;
                    const midYNew = (t1_new.clientY + t2_new.clientY) / 2;
                    this._zoom(scaleFactor, midXNew, midYNew);
                }
            }
            // Update cache
            this._touchCache = [];
            for (let i = 0; i < touches.length; i++) {
                this._touchCache.push(touches[i]);
            }
        }
    }

    _onTouchEnd(event) {
        if (this._isDraggingPiece) {
            this._onMouseUp({}); // Simulate mouseup
        }
        this._isPannning = false;

        // Remove ended touches from cache
        const endedTouches = event.changedTouches;
        for (let i = 0; i < endedTouches.length; i++) {
            const idx = this._touchCache.findIndex(t => t.identifier === endedTouches[i].identifier);
            if (idx > -1) {
                this._touchCache.splice(idx, 1);
            }
        }
        if (event.touches.length < 2) { // If less than 2 touches, clear cache to prevent stale data
            this._touchCache = [];
        }
    }

    _onWheelZoom(event) {
        event.preventDefault();
        const scaleFactor = event.deltaY < 0 ? 1.1 : 1 / 1.1; // Zoom in for scroll up, out for scroll down
        const hostRect = this.getBoundingClientRect();
        const mouseX = event.clientX - hostRect.left; // Mouse position relative to component
        const mouseY = event.clientY - hostRect.top;
        this._zoom(scaleFactor, mouseX, mouseY);
    }

    _pan(dx, dy) {
        this._viewBoxX += dx / this._zoomLevel; // Panning speed should feel consistent regardless of zoom
        this._viewBoxY += dy / this._zoomLevel;
        this._render();
    }

    _zoom(factor, clientX, clientY) { // clientX, clientY are mouse coords relative to component
        const prevZoom = this._zoomLevel;
        const newZoom = Math.max(0.1, Math.min(this._zoomLevel * factor, 10)); // Clamp zoom

        if (newZoom === prevZoom) return;

        // If clientX/Y are provided, zoom towards that point. Otherwise, zoom towards center.
        const hostRect = this.getBoundingClientRect();
        const pointerX = (clientX === undefined) ? hostRect.width / 2 : clientX;
        const pointerY = (clientY === undefined) ? hostRect.height / 2 : clientY;

        // Convert pointer coords to world coords before zoom
        const worldX = (pointerX + this._viewBoxX * prevZoom) / prevZoom;
        const worldY = (pointerY + this._viewBoxY * prevZoom) / prevZoom;
        
        this._zoomLevel = newZoom;

        // Adjust viewBox so the world point under the pointer remains the same
        this._viewBoxX = (worldX * this._zoomLevel - pointerX) / this._zoomLevel;
        this._viewBoxY = (worldY * this._zoomLevel - pointerY) / this._zoomLevel;

        this._render();
    }

    _selectPiece(pieceElement) {
        if (this._selectedPiece) {
            this._selectedPiece.classList.remove('selected');
        }
        this._selectedPiece = pieceElement;
        if (this._selectedPiece) {
            this._selectedPiece.classList.add('selected');
            this._rotationControls.style.display = 'flex';
            // Bring piece to front
            const pieceData = this._pieces.find(p => p.element === pieceElement);
            if (pieceData) this._puzzleArea.appendChild(pieceData.element); // Re-append to bring to top
        } else {
            this._rotationControls.style.display = 'none';
        }
    }

    _rotateSelectedPiece(angleDelta) {
        if (!this._selectedPiece) return;
        const pieceData = this._pieces.find(p => p.element === this._selectedPiece);
        if (!pieceData) return;

        pieceData.rotation = (pieceData.rotation + angleDelta + 360) % 360; // Normalize to 0-359
        this._updatePieceTransform(pieceData);
        this._snapPieceToGrid(pieceData); // Check snap after rotation
    }

    _updatePieceTransform(pieceData) {
        // Transform is applied relative to the puzzle area, which is panned/zoomed
        // So piece x,y are in "world" coordinates.
        // The CSS transform should be set directly.
        pieceData.element.style.transform = `translate(${pieceData.x}px, ${pieceData.y}px) rotate(${pieceData.rotation}deg)`;
    }

    _snapPieceToGrid(pieceData) {
        if (pieceData.rotation !== 0) { // Only snap if correctly oriented (simplification for now)
            pieceData.isSnapped = false;
            // console.log("Piece not snapped due to rotation: ", pieceData.rotation);
            return;
        }

        const snapThreshold = 20; // Pixels - in world coordinates
        const pieceCenterX = pieceData.x + pieceData.width / 2;
        const pieceCenterY = pieceData.y + pieceData.height / 2;

        const correctCenterX = pieceData.correctX + pieceData.width / 2;
        const correctCenterY = pieceData.correctY + pieceData.height / 2;

        const dist = Math.hypot(pieceCenterX - correctCenterX, pieceCenterY - correctCenterY);

        if (dist < snapThreshold) {
            console.log(`Piece ${pieceData.id} snapped! ✅ Distance\${dist.toFixed(2)`);
            pieceData.x = pieceData.correctX;
            pieceData.y = pieceData.correctY;
            pieceData.isSnapped = true;
            this._updatePieceTransform(pieceData);
            // Potentially disable further dragging for this piece or make it part of a "solved" group
            // For now, just visually snaps.
            this._selectedPiece.classList.remove('selected'); // Deselect after snap
            this._selectedPiece.style.cursor = 'default';
            this._selectPiece(null); // No piece selected
            // Check if all pieces are snapped
            if (this._checkWinCondition()) {
                this._showWinMessage();
            }
        } else {
            pieceData.isSnapped = false;
            // console.log(`Piece ${pieceData.id} not snapped. Dist: ${dist.toFixed(2)}, Threshold: ${snapThreshold}`);
        }
    }
    
    _checkWinCondition() {
        return this._pieces.every(p => p.isSnapped && p.rotation === 0);
    }

    _showWinMessage() {
        console.log("🎉 YOU WON! 🎉 All pieces snapped correctly!");
        const winMessage = document.createElement('div');
        winMessage.textContent = "🎉 YOU SOLVED THE PUZZLE! 🎉 Aren't you a clever idiot! 🤪";
        winMessage.style.position = 'absolute';
        winMessage.style.top = '50%';
        winMessage.style.left = '50%';
        winMessage.style.transform = 'translate(-50%, -50%)';
        winMessage.style.fontSize = '2em';
        winMessage.style.color = '#ff9800';
        winMessage.style.backgroundColor = 'rgba(0,0,0,0.8)';
        winMessage.style.padding = '20px';
        winMessage.style.borderRadius = '10px';
        winMessage.style.textAlign = 'center';
        winMessage.style.zIndex = '3000'; // Above everything
        this.shadowRoot.appendChild(winMessage);

        // Optionally, disable further interaction
        this._pieces.forEach(p => {
            p.element.style.pointerEvents = 'none';
        });
        this._controlsContainer.style.display = 'none';
        this._rotationControls.style.display = 'none';
    }


    _render() {
        // Apply pan and zoom to the puzzle area container (which holds the pieces)
        // Pieces themselves have x,y in world coordinates, and their transforms place them there.
        // The puzzleArea's transform pans/zooms the "camera" over this world.
        this._puzzleArea.style.transform = `scale(${this._zoomLevel}) translate(-${this._viewBoxX}px, -${this._viewBoxY}px)`;
        // The transform-origin should be top-left (0,0) for this to work as expected with viewBox
        this._puzzleArea.style.transformOrigin = '0 0';

        this._drawGrid(); // Redraw grid dots which are on a separate canvas and need to respect pan/zoom
        console.log(`Rendered with zoom: ${this._zoomLevel.toFixed(2)}, pan: (${this._viewBoxX.toFixed(0)}, ${this._viewBoxY.toFixed(0)})`);
    }

    disconnectedCallback() {
        // TODO: Clean up event listeners if any were added to document/window
        console.log('JigsawPuzzle element removed from DOM. 👻 Goodbye!');
    }
}

window.customElements.define('jigsaw-puzzle', JigsawPuzzle);
console.log('🧙‍♂️ Custom element "jigsaw-puzzle" defined! Ready for some puzzling chaos! 💥');
