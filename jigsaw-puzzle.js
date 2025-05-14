// jigsaw-puzzle.js - Main custom element (<jigsaw-puzzle>) to display and drag square pieces.
// Acts as the Controller, orchestrating piece data and view updates based on events.

import { ImageInfo } from './image-info.js';
import { Piece } from './piece.js';
import { JigsawPiece } from './jigsaw-piece.js'; // Assume JigsawPiece is the Custom Element
// Import event creators - needed to listen for these event types
import { createSelectEvent } from './select.js';
import { createMoveEvent } from './move.js';
import { createPlaceEvent } from './place.js';

const DEFAULT_IMAGE_WIDTH = 1344;
const DEFAULT_IMAGE_HEIGHT = 960;
const DEFAULT_PIECE_COUNT = 40; // As requested

export class JigsawPuzzle extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._imageInfo = null;
        this._pieces = []; // Array of Piece domain models (for data reference)
        this._scaledContainer = null; // Container for piece elements, scaled by CSS
        this._jigsawPieces = new Map(); // Map<pieceId, JigsawPiece HTMLElement>

        // Interaction State
        this._selectedPieceId = null; // ID of the currently selected piece
        this._dragOffsetX = 0; // Mouse/touch X offset within the piece (world coords)
        this._dragOffsetY = 0; // Mouse/touch Y offset within the piece (world coords)
    }

    static get observedAttributes() { return ['src', 'size']; }
    attributeChangedCallback(n, o, v) {
        if (!this.isConnected || o === v) return;
        if (n === 'src') this._loadImage(v);
        if (n === 'size' && this._imageInfo) this._initializePuzzle(this._imageInfo, parseInt(v, 10) || DEFAULT_PIECE_COUNT);
    }
    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <style>
                :host { display: block; position: relative; width: 100%; height: 100%; overflow: hidden; background-color: #1a1a1a; }
                #scaled-container { position: absolute; transform-origin: 0 0; }
                /* jigsaw-piece position handled by its own x/y attributes */
            </style>
            <div id="scaled-container"></div>
        `;
        this._scaledContainer = this.shadowRoot.getElementById('scaled-container');

        // Observe host size for scaling the container
        this._resizeObserver = new ResizeObserver(() => this._updateScale());
        this._resizeObserver.observe(this);

        // Add event listeners for interaction events from piece components
        this._addEventListeners();

        const src = this.getAttribute('src');
        if (src) this._loadImage(src);
        else this._initializePuzzle(new ImageInfo("placeholder", DEFAULT_IMAGE_WIDTH, DEFAULT_IMAGE_HEIGHT), parseInt(this.getAttribute('size'), 10) || DEFAULT_PIECE_COUNT);
    }

    disconnectedCallback() {
        if (this._resizeObserver) this._resizeObserver.disconnect();
        // Remove window listeners added by pieces (should be handled by piece component itself)
    }

    _loadImage(src) {
        const img = new Image();
        img.onload = () => {
            this._imageInfo = new ImageInfo(src, img.width, img.height);
            this._initializePuzzle(this._imageInfo, parseInt(this.getAttribute('size'), 10) || DEFAULT_PIECE_COUNT);
            this._updateScale(); // Set initial scale after puzzle is initialized
        };
        img.onerror = () => {
            console.error(`Failed to load image: ${src}`);
            this._imageInfo = new ImageInfo("error", DEFAULT_IMAGE_WIDTH, DEFAULT_IMAGE_HEIGHT);
            this._initializePuzzle(this._imageInfo, parseInt(this.getAttribute('size'), 10) || DEFAULT_PIECE_COUNT);
            this._updateScale(); // Set initial scale even if image failed
        };
        img.src = src;
    }

    _initializePuzzle(imageInfo, pieceCount) {
        if (!imageInfo || pieceCount <= 0 || !this._scaledContainer) return;

        const pieceSize = Math.min(imageInfo.width, imageInfo.height) / Math.sqrt(pieceCount);
        const cols = Math.round(imageInfo.width / pieceSize);
        const rows = Math.round(imageInfo.height / pieceSize);
        const pW = imageInfo.width / cols; // Actual piece width in image pixels (world units)
        const pH = imageInfo.height / rows; // Actual piece height in image pixels (world units)

        const sF = 2; // Scatter factor for board area (world units)
        const sW = imageInfo.width * sF;
        const sH = imageInfo.height * sF;
        const sOX = -imageInfo.width * (sF - 1) / 2; // Scatter area origin X (world units)
        const sOY = -imageInfo.height * (sF - 1) / 2; // Scatter area origin Y (world units)

        // Set the size of the scaled container to match the full board/scatter area in world units
        this._scaledContainer.style.width = `${sW}px`;
        this._scaledContainer.style.height = `${sH}px`;
        // Position the container at the scatter area origin relative to its default position (0,0)
        // This needs careful thought relative to the scale transform.
        // Let's just set its size and let the transform handle positioning/scaling.
        // The transform will map the container's 0,0 (which is the start of the scatter area)
        // to the correct screen position after scaling.

        this._pieces = []; // Clear previous data models
        this._jigsawPieces.forEach(pieceEl => pieceEl.remove()); // Remove old piece elements
        this._jigsawPieces = new Map(); // Clear map

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const id = r * cols + c;
                const oX = c * pW; const oY = r * pH; // Origin in image pixels (world units)
                const pieceData = new Piece(id, oX, oY, pW, pH);
                // Randomize placement within the scatter area (using image pixel coordinates)
                pieceData.randomizePlacement(sW, sH, sOX, sOY);
                this._pieces.push(pieceData); // Store data model

                // Create the jigsaw-piece custom element
                const pieceEl = document.createElement('jigsaw-piece');
                // Pass piece data as attributes (in image pixel coordinates - world units)
                pieceEl.setAttribute('piece-id', id); // Add piece-id for event handling
                pieceEl.setAttribute('width', pieceData.width);
                pieceEl.setAttribute('height', pieceData.height);
                pieceEl.setAttribute('x', pieceData.currentX); // Current position (world units)
                pieceEl.setAttribute('y', pieceData.currentY); // Current position (world units)
                pieceEl.setAttribute('rotation', pieceData.rotation); // Degrees
                pieceEl.setAttribute('image-url', imageInfo.url);
                pieceEl.setAttribute('image-width', imageInfo.width);
                pieceEl.setAttribute('image-height', imageInfo.height);
                pieceEl.setAttribute('correct-x', pieceData.originX);
                pieceEl.setAttribute('correct-y', pieceData.originY);
                // Simple square path data (local to the piece's SVG 0,0)
                pieceEl.setAttribute('path-data', `M 0 0 L ${pW} 0 L ${pW} ${pH} L 0 ${pH} Z`);

                this._scaledContainer.appendChild(pieceEl); // Append to the scaled container
                this._jigsawPieces.set(id, pieceEl); // Store the element
            }
        }
        this._updateScale(); // Apply scaling and centering after pieces are added
    }

    _updateScale() {
        if (!this._scaledContainer || !this._imageInfo) return;

        const hostRect = this.getBoundingClientRect();
        const hostWidth = hostRect.width;
        const hostHeight = hostRect.height;

        // Dimensions of the scaled container (scatter area in image pixels - world units)
        const boardWidth = parseFloat(this._scaledContainer.style.width);
        const boardHeight = parseFloat(this._scaledContainer.style.height);

        if (hostWidth <= 0 || hostHeight <= 0 || boardWidth <= 0 || boardHeight <= 0) return;

        // Calculate scale factor to fit the board area within the host element ('contain')
        const scaleX = hostWidth / boardWidth;
        const scaleY = hostHeight / boardHeight;
        const scale = Math.min(scaleX, scaleY);

        // Calculate translation needed to center the scaled board area within the host.
        // The scaled board area has size (boardWidth * scale, boardHeight * scale).
        // It starts at (0,0) relative to the host if its own left/top are 0.
        // We need to translate its top-left (which is the scatter area origin)
        // to be centered within the host's available space.
        // The scatter area origin is (sOX, sOY) in world units.
        // After scaling by 'scale', this point is at (sOX * scale, sOY * scale) relative to the scaled container's top-left (0,0).
        // We want the center of the *original image area* (imageInfo.width/2, imageInfo.height/2 in world units)
        // to be at the center of the host (hostWidth/2, hostHeight/2 in screen pixels).

        // Let's simplify the scaling and centering logic:
        // Scale the container to fit the host based on the original image dimensions (or board dimensions if pieces are scattered)
        // The container's size is set to the full scatter area size (sW, sH).
        // The CSS transform `scale(s)` shrinks/enlarges the content.
        // The CSS transform `translate(tx, ty)` moves the element *after* scaling.
        // To center the *scatter area*, we need to translate its top-left (sOX, sOY) in world coords
        // so that the center of the scatter area ((sOX + sW/2), (sOY + sH/2)) is at the host center.

        // Center of the scatter area in world coords
        const scatterCenterX_world = sOX + sW / 2;
        const scatterCenterY_world = sOY + sH / 2;

        // Center of the host element in screen coords
        const hostCenterX_screen = hostWidth / 2;
        const hostCenterY_screen = hostHeight / 2;

        // The point (scatterCenterX_world, scatterCenterY_world) should end up at (hostCenterX_screen, hostCenterY_screen)
        // Let (X_w, Y_w) be a point in world coords.
        // Its position on screen (X_s, Y_s) relative to the host's top-left is:
        // X_s = (X_w + Container_Translate_X) * scale
        // Y_s = (Y_w + Container_Translate_Y) * scale
        // We want (hostCenterX_screen, hostCenterY_screen) = (scatterCenterX_world + Container_Translate_X) * scale
        // (hostCenterX_screen / scale) = scatterCenterX_world + Container_Translate_X
        // Container_Translate_X = (hostCenterX_screen / scale) - scatterCenterX_world

        const containerTranslateX_world = (hostCenterX_screen / scale) - scatterCenterX_world;
        const containerTranslateY_world = (hostCenterY_screen / scale) - scatterCenterY_world;

        // Apply the transform. The translate is in the scaled container's coordinate space.
        // So, translate by (containerTranslateX_world, containerTranslateY_world) * scale.
        // Or, use the origin parameter of translate. translate(tx ty) moves the element *after* scaling.
        // We need the top-left of the container (which is world (sOX, sOY)) to be translated such that
        // world (scatterCenterX_world, scatterCenterY_world) is at screen (hostCenterX_screen, hostCenterY_screen).
        // The total translation needed from world origin (0,0) to screen origin (0,0) is complex.

        // Let's rethink simply: Scale the container. Then position its top-left (which is the scatter area origin)
        // such that the center of the scatter area aligns with the center of the host.
        // The center of the scaled scatter area relative to its top-left is (sW/2 * scale, sH/2 * scale).
        // We want this to be at (hostWidth/2, hostHeight/2).
        // So, the top-left of the scaled scatter area should be at (hostWidth/2 - sW/2*scale, hostHeight/2 - sH/2*scale).
        // These are the screen coordinates for the top-left of the scaled container.
        // This requires the scaled-container to be positioned absolutely relative to the host.
        // Its `left` and `top` CSS properties should be set to these screen coordinates.

        const scaledContainerLeft_screen = (hostWidth - boardWidth * scale) / 2; // This centers the *total board* horizontally
        const scaledContainerTop_screen = (hostHeight - boardHeight * scale) / 2; // This centers the *total board* vertically

        this._scaledContainer.style.left = `${scaledContainerLeft_screen}px`;
        this._scaledContainer.style.top = `${scaledContainerTop_screen}px`;
        this._scaledContainer.style.transform = `scale(${scale})`; // Only apply scale transform

        // This correctly positions the scaled container. Pieces inside are positioned
        // using their own `left`/`top` attributes in world coordinates, relative to the container's top-left.
        // Example: A piece at world (sOX, sOY) will have left=sOX, top=sOY.
        // Relative to the scaled container's top-left, this is (sOX, sOY).
        // On screen, this point is at (scaledContainerLeft_screen + sOX * scale, scaledContainerTop_screen + sOY * scale).
        // We want a piece at world (X_w, Y_w) to appear at screen (X_s, Y_s) where
        // X_s = scaledContainerLeft_screen + (X_w - sOX) * scale
        // Y_s = scaledContainerTop_screen + (Y_w - sOY) * scale
        // This means the `x` and `y` attributes on jigsaw-piece should be relative to the scatter area origin (sOX, sOY), not world origin (0,0).
        // Let's change Piece.currentX/Y to be relative to scatter area origin.
        // No, let's keep Piece.currentX/Y as world coords (image pixels) and adjust the piecesContainer left/top.

        // Correct Approach:
        // 1. Set #scaled-container size to imageInfo.width x imageInfo.height (the puzzle grid size)
        // 2. Use viewBox to show the scatter area within this container.
        // 3. Scale this container to fit the host.

        // Let's revert the #scaled-container size/position logic.
        // The scaled container should represent the VIEWPORT into the world.
        // The pieces are positioned in WORLD coords.

        // New approach:
        // Host element is the display area.
        // Create a div `#pieces-container` that is HUGE, sized to the full scatter area (sW, sH).
        // Pieces are positioned absolutely within this huge div using their world coords (currentX, currentY).
        // Apply the scale and translate transform to this huge `#pieces-container` div to fit it into the host.

        // Revert HTML structure in Shadow DOM:
        this.shadowRoot.innerHTML = `
            <style>
                :host { display: block; position: relative; width: 100%; height: 100%; overflow: hidden; background-color: #1a1a1a; }
                #pieces-container { position: absolute; transform-origin: 0 0; } /* Transform applied here */
                jigsaw-piece { position: absolute; } /* Positioned within #pieces-container */
            </style>
            <div id="pieces-container"></div>
        `;
        this._piecesContainer = this.shadowRoot.getElementById('pieces-container'); // Corrected reference


        // Initialize puzzle now refers to _piecesContainer
        this._initializePuzzle(this._imageInfo, parseInt(this.getAttribute('size'), 10) || DEFAULT_PIECE_COUNT);
        // _updateScale logic needs to apply transform to _piecesContainer
    }

    _updateScale() {
        if (!this._piecesContainer || !this._imageInfo || this._pieces.length === 0) return;

        const hostRect = this.getBoundingClientRect();
        const hostWidth = hostRect.width;
        const hostHeight = hostRect.height;

         // Need the *actual* bounding box of all pieces, including scattered positions.
         // For simplicity with square pieces and a fixed scatter area, the container size
         // is the dimensions of the scatter area (sW, sH).
         const piece0 = this._pieces[0]; // Use a piece to get calculated scatter area size
         const sF = 2; // Scatter factor
         const sW = this._imageInfo.width * sF;
         const sH = this._imageInfo.height * sF;
         const sOX = -this._imageInfo.width * (sF - 1) / 2; // Scatter area origin X
         const sOY = -this._imageInfo.height * (sF - 1) / 2; // Scatter area origin Y


        // Set the size of the pieces container to match the full scatter area in world units
        this._piecesContainer.style.width = `${sW}px`;
        this._piecesContainer.style.height = `${sH}px`;

        // Calculate scale factor to fit the scatter area within the host element ('contain')
        const scaleX = hostWidth / sW;
        const scaleY = hostHeight / sH;
        const scale = Math.min(scaleX, scaleY);

        // Calculate translation needed to center the scaled scatter area within the host.
        // The top-left corner of the scatter area is at world (sOX, sOY).
        // We want the center of the scatter area (world (sOX + sW/2, sOY + sH/2))
        // to align with the center of the host (hostWidth/2, hostHeight/2) *in screen pixels*.
        // A point (X_w, Y_w) in world coords is mapped to a screen point (X_s, Y_s) relative to host top-left by:
        // X_s = (X_w * scale) + Translation_X_screen
        // Y_s = (Y_w * scale) + Translation_Y_screen
        // We want (hostWidth/2) = ((sOX + sW/2) * scale) + Translation_X_screen
        // Translation_X_screen = hostWidth/2 - (sOX + sW/2) * scale
        // Translation_Y_screen = hostHeight/2 - (sOY + sH/2) * scale

         const screenTranslateX = hostWidth / 2 - (sOX + sW / 2) * scale;
         const screenTranslateY = hostHeight / 2 - (sOY + sH / 2) * scale;


        // Apply combined transform to the pieces container: scale then translate.
        // The translate is in screen pixels after scaling has occurred.
        this._piecesContainer.style.transform = `translate(${screenTranslateX}px, ${screenTranslateY}px) scale(${scale})`;

        // piece elements inside are positioned using their x/y attributes in world units
        // relative to the container's origin (0,0).
        // This should correctly place them within the scaled and translated container.
    }


    // --- Event Listeners Setup ---
    // Listen for custom events bubbling up from jigsaw-piece components.

    _addEventListeners() {
        // Listen on the host element for 'select', 'move', 'place'
        this.addEventListener('select', this._handleSelectEvent.bind(this));
        this.addEventListener('move', this._handleMoveEvent.bind(this));
        this.addEventListener('place', this._handlePlaceEvent.bind(this));
    }

    // --- Event Handlers (Controller Logic) ---

    _handleSelectEvent(event) {
        event.stopPropagation(); // Stop event from bubbling further up the DOM

        const { pieceId, clientX, clientY } = event.detail; // clientX/Y are screen coords relative to viewport
        const pieceEl = this._jigsawPieces.get(pieceId);
        if (!pieceEl) return;

        // Deselect currently selected piece if different
        if (this._selectedPieceId !== null && this._selectedPieceId !== pieceId) {
            const prevSelectedEl = this._jigsawPieces.get(this._selectedPieceId);
            if (prevSelectedEl) prevSelectedEl.removeAttribute('selected');
        }

        // Select the new piece
        this._selectedPieceId = pieceId;
        pieceEl.setAttribute('selected', ''); // Triggers jigsaw-piece._updateSelectedState

        // Calculate drag offset in world coordinates
        const hostRect = this.getBoundingClientRect(); // Rect of the jigsaw-puzzle component
        const containerRect = this._piecesContainer.getBoundingClientRect(); // Rect of the scaled container
        const scale = containerRect.width / parseFloat(this._piecesContainer.style.width); // Get current applied scale

        // Convert pointer screen coords (relative to host) to world coords
        const pointerScreenX = clientX - hostRect.left;
        const pointerScreenY = clientY - hostRect.top;

        // World X = (Pointer_Screen_X - Container_Screen_Left) / Scale + Container_World_Origin_X
        // World Y = (Pointer_Screen_Y - Container_Screen_Top) / Scale + Container_World_Origin_Y
        // Container_World_Origin_X/Y = sOX/sOY (scatter area origin) if the container's *conceptual* world origin is 0,0.
        // Let's adjust: Piece x/y attributes are world coords relative to world origin (0,0).
        // Container's top/left are screen coords. Its transform maps world coords to screen.
        // Point (X_w, Y_w) maps to (left + X_w*scale + Tx, top + Y_w*scale + Ty) if translate is applied first.
        // If scale then translate: (left + (X_w*scale + Tx), top + (Y_w*scale + Ty))
        // With `transform: translate(...) scale(...)` on the container, the order is translate THEN scale.
        // Let (X_w, Y_w) be world coords. Point on screen is (Container_left + (X_w + Tx)*scale, Container_top + (Y_w + Ty)*scale)
        // No, `transform: translate(Tx, Ty) scale(s)` applies translate then scale.
        // A point (x, y) in the element's local coords becomes ( (x+Tx)*s, (y+Ty)*s ) in the parent's coord space relative to element's origin.
        // Container origin is 0,0. Pieces are at (x,y) world coords.
        // Let the CSS transform be M = Translate(screenTx, screenTy) * Scale(scale).
        // A world point (X_w, Y_w) (piece attribute x,y) is a point in the container's coordinate space.
        // The point on screen relative to host top-left is M * (X_w, Y_w, 1)^T.
        // screenX = (X_w * scale) + screenTx
        // screenY = (Y_w * scale) + screenTy
        // We know screenX, screenY (pointer pos relative to host). We need X_w, Y_w of the piece's top-left.
        // The pointer is at (pointerScreenX, pointerScreenY).
        // The piece's top-left is at (pieceEl.offsetLeft, pieceEl.offsetTop) relative to the container's origin (0,0).
        // In container's coordinate space, the pointer is at ((pointerScreenX - containerRect.left)/scale, (pointerScreenY - containerRect.top)/scale).
        // This is the pointer's world coordinate.
        const pointerWorldX = (pointerScreenX - containerRect.left) / scale;
        const pointerWorldY = (pointerScreenY - containerRect.top) / scale;

        // The offset is the difference between the pointer's world coordinate and the piece's top-left world coordinate
        this._dragOffsetX = pointerWorldX - parseFloat(pieceEl.getAttribute('x') || 0);
        this._dragOffsetY = pointerWorldY - parseFloat(pieceEl.getAttribute('y') || 0);

        // console.log(`Selected piece ${pieceId}. Pointer World: (${pointerWorldX.toFixed(2)}, ${pointerWorldY.toFixed(2)}), Piece World: (${parseFloat(pieceEl.getAttribute('x') || 0).toFixed(2)}, ${parseFloat(pieceEl.getAttribute('y') || 0).toFixed(2)}), Offset: (${this._dragOffsetX.toFixed(2)}, ${this._dragOffsetY.toFixed(2)})`);
    }

    _handleMoveEvent(event) {
        event.stopPropagation();
        const { pieceId, clientX, clientY } = event.detail;

        // Only move the currently selected piece that initiated the drag
        if (this._selectedPieceId === null || this._selectedPieceId !== pieceId) return;

        const pieceEl = this._jigsawPieces.get(pieceId);
        if (!pieceEl) return;

        const hostRect = this.getBoundingClientRect();
        const containerRect = this._piecesContainer.getBoundingClientRect();
        const scale = containerRect.width / parseFloat(this._piecesContainer.style.width);

        // Convert current pointer screen coords (relative to host) to world coords
        const pointerScreenX = clientX - hostRect.left;
        const pointerScreenY = clientY - hostRect.top;

        const pointerWorldX = (pointerScreenX - containerRect.left) / scale;
        const pointerWorldY = (pointerScreenY - containerRect.top) / scale;

        // Calculate new piece world position (top-left) using the stored offset
        const newPieceWorldX = pointerWorldX - this._dragOffsetX;
        const newPieceWorldY = pointerWorldY - this._dragOffsetY;

        // Update the piece element's attributes - this triggers its rendering update
        pieceEl.setAttribute('x', newPieceWorldX);
        pieceEl.setAttribute('y', newPieceWorldY);
        // The piece element's attributeChangedCallback handles updating its CSS left/top/transform.

        // console.log(`Moving piece ${pieceId} to World (${newPieceWorldX.toFixed(2)}, ${newPieceWorldY.toFixed(2)})`);
    }

    _handlePlaceEvent(event) {
        event.stopPropagation();
        const { pieceId } = event.detail;

        // Only process place for the currently selected piece
        if (this._selectedPieceId === null || this._selectedPieceId !== pieceId) return;

        // Drag ends. Snapping logic would go here.
        // For now, just clear selected state and drag info.
        const pieceEl = this._jigsawPieces.get(pieceId);
        if (pieceEl) pieceEl.removeAttribute('selected');

        this._selectedPieceId = null;
        this._dragOffsetX = 0;
        this._dragOffsetY = 0;

        // console.log(`Placed piece ${pieceId}. Selected state cleared.`);
    }
}

customElements.define('jigsaw-puzzle', JigsawPuzzle);