// jigsaw-piece.js - View class for a single puzzle piece, manages its SVG element.
// This is a pure JS class, NOT a Custom Element, managing an SVG <g> element.
// It acts as the 'View' for the Piece domain model.

import { createSelectEvent } from './select.js';
import { createMoveEvent } from './move.js';
// Define a moveend event
export function createMoveEndEvent(pieceId) {
    return new CustomEvent('moveend', {
        bubbles: true,
        composed: true,
        detail: { pieceId: pieceId }
    });
}


export class JigsawPiece {
    /**
     * @param {import('./piece.js').Piece} pieceData - The data model for this piece.
     * @param {SVGElement} svgRootDefs - The <defs> element from the main SVG root to reference patterns/clipPaths.
     * @param {string} imageUrl - The URL of the main puzzle image.
     */
    constructor(pieceData, svgRootDefs, imageUrl) {
        if (!pieceData) throw new Error("JigsawPiece requires pieceData.");
        if (!(svgRootDefs instanceof SVGElement) || svgRootDefs.tagName !== 'defs') throw new Error("JigsawPiece requires the SVG <defs> element.");
        if (typeof imageUrl !== 'string' || !imageUrl) throw new Error("JigsawPiece requires imageUrl.");

        this._pieceData = pieceData;
        this._svgRootDefs = svgRootDefs; // Reference to the main SVG defs
        this._imageUrl = imageUrl;

        // State for dragging
        this._isDragging = false;
        this._dragStartX = 0; // Mouse/touch clientX at start of drag (screen coords)
        this._dragStartY = 0; // Mouse/touch clientY at start of drag (screen coords)
        // No offsets stored here, handled by the controller (jigsaw-puzzle)

        // Create the SVG elements for this piece
        this.element = this._createSvgElement();

        // Add event listeners directly to the SVG <g> element
        this._addEventListeners();

        // Initial update to reflect the data model's state
        this.updateFromPiece();
    }

    /**
     * Creates the SVG <g> element representing the piece.
     * @returns {SVGElement} The root <g> element for the piece.
     */
    _createSvgElement() {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.classList.add('puzzle-piece-group');
        group.setAttribute('data-piece-id', this._pieceData.id);

        // Add a transparent rect or the actual shape path to capture events
        // Using a rect covering the piece bounds for simpler event capturing initially
        // The actual visual shape will be applied as a clip-path
        const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        hitArea.setAttribute('x', 0);
        hitArea.setAttribute('y', 0);
        hitArea.setAttribute('width', this._pieceData.width);
        hitArea.setAttribute('height', this._pieceData.height);
        hitArea.setAttribute('fill', 'rgba(0,0,0,0)'); // Transparent
        hitArea.setAttribute('stroke', 'none'); // No stroke
        hitArea.style.pointerEvents = 'all'; // Ensure it captures events

        // Create the visual element (a rect or path that will be clipped and filled with image)
        // Using a rect sized to the piece dimensions
        const visualShape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
         visualShape.classList.add('piece-shape');
         visualShape.setAttribute('x', 0);
         visualShape.setAttribute('y', 0);
         visualShape.setAttribute('width', this._pieceData.width);
         visualShape.setAttribute('height', this._pieceData.height);

         // Reference the global image pattern defined in the root SVG defs
         const patternId = `image-pattern-${this._imageUrl.replace(/[^a-zA-Z0-9]/g, '')}`;
         visualShape.setAttribute('fill', `url(#${patternId})`);

         // Create a clipPath definition in the main SVG defs if it doesn't exist
         // (This part should ideally be managed by jigsaw-puzzle or a dedicated SVG builder)
         // For now, assume we can add to the provided defs element.
         const clipPathId = `clip-piece-${this._pieceData.id}`;
         let clipPath = this._svgRootDefs.querySelector(`#${clipPathId}`);
         if (!clipPath) {
             clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
             clipPath.setAttribute('id', clipPathId);
             const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
             pathEl.setAttribute('d', this._pieceData.getClipPathData()); // Get path from data model
             clipPath.appendChild(pathEl);
             this._svgRootDefs.appendChild(clipPath);
         } else {
             // Update existing path data if clipPath already exists
             clipPath.querySelector('path').setAttribute('d', this._pieceData.getClipPathData());
         }
         // Apply the clip path to the visual shape
         visualShape.setAttribute('clip-path', `url(#${clipPathId})`);


        group.appendChild(visualShape);
        // Append the hit area *after* the visual shape so visual shape is visible
        // But pointer-events: all on hitArea will make it capture events over visualShape
        // Maybe the hit area should be the same shape as the clip path for accuracy?
        // Let's use the visual shape for events for simplicity now, relying on its fill/stroke catching.
        // group.appendChild(hitArea); // Omitting for now, rely on visualShape

        return group;
    }

    /**
     * Adds necessary event listeners to the piece's SVG element.
     */
    _addEventListeners() {
        this.element.addEventListener('mousedown', this._onPointerDown.bind(this));
        this.element.addEventListener('touchstart', this._onPointerDown.bind(this), { passive: false });

        // Need bound handlers for adding/removing from window
        this._onPointerMoveBound = this._onPointerMove.bind(this);
        this._onPointerUpBound = this._onPointerUp.bind(this);
    }

    /**
     * Updates the visual representation (transform, selected state) based on the data model.
     */
    updateFromPiece() {
        // Update the SVG transform attribute using the piece's data model
        this.element.setAttribute('transform', this._pieceData.getSvgTransform());

        // Update selected state class
        if (this._pieceData.isSelected) {
            this.element.classList.add('selected');
             // Bring to front by re-appending the SVG element in the parent's pieces layer
             if (this.element.parentNode) {
                 this.element.parentNode.appendChild(this.element);
             }
             this.element.style.cursor = 'grabbing'; // Update cursor
        } else {
            this.element.classList.remove('selected');
            this.element.style.cursor = 'grab'; // Update cursor
        }

        // Update snapped state visual if needed (e.g., lock icon, different border)
        if (this._pieceData.isSnapped) {
            this.element.classList.add('snapped');
            // Disable pointer events on snapped pieces? Or let them be dragged off?
            // Let's allow dragging them off for now.
        } else {
            this.element.classList.remove('snapped');
        }

        // If the path data needs to change (e.g., based on neighbor connections updating),
        // update the clipPath 'd' attribute here. For now, assume it's static after creation.
        // const pathEl = this.element.querySelector('clipPath path'); // Assuming clipPath is in shadow DOM, wait no, it's global defs.
        // const clipPath = this._svgRootDefs.querySelector(`#clip-piece-${this._pieceData.id}`);
        // if (clipPath) {
        //     clipPath.querySelector('path').setAttribute('d', this._pieceData.getClipPathData());
        // }
         // The clip path should be updated when PieceJoints are assigned/changed. Puzzle class does this.
         // Puzzle will call a method on JigsawPiece to tell it to update its path.
         // Let's add a method `updatePath()`
    }

     /**
      * Updates the SVG path data for the piece's shape.
      * Called by the parent component when the piece's shape definition changes.
      */
     updatePath() {
         const clipPath = this._svgRootDefs.querySelector(`#clip-piece-${this._pieceData.id}`);
         if (clipPath) {
             clipPath.querySelector('path').setAttribute('d', this._pieceData.getClipPathData());
         } else {
             console.warn(`Clip path for piece ${this._pieceData.id} not found in defs.`);
         }
     }


    // --- Pointer Event Handlers ---
    _onPointerDown(event) {
        // Only handle left click for mouse, or first touch
        if (event.type === 'mousedown' && event.button !== 0) return;
        if (event.type === 'touchstart' && event.touches.length > 1) return;

        event.preventDefault(); // Prevent default browser behavior (text selection, touch scrolling)
        event.stopPropagation(); // Stop event from bubbling up to the pan handler on the container

        this._isDragging = true;
        const pointer = event.touches ? event.touches[0] : event; // Get touch or mouse event
        this._dragStartX = pointer.clientX;
        this._dragStartY = pointer.clientY;

        // Dispatch 'select' event
        this.element.dispatchEvent(createSelectEvent(this._pieceData.id));
        // console.log(`Piece ${this._pieceData.id} pointer down. Dispatching 'select'.`);

        // Add global listeners for tracking movement and end
        window.addEventListener('mousemove', this._onPointerMoveBound);
        window.addEventListener('mouseup', this._onPointerUpBound);
        window.addEventListener('touchmove', this._onPointerMoveBound, { passive: false });
        window.addEventListener('touchend', this._onPointerUpBound, { passive: false });
        window.addEventListener('touchcancel', this._onPointerUpBound, { passive: false });

         // Add the 'dragging' class immediately for visual feedback if needed
         this.element.classList.add('is-dragging');
         this.element.style.cursor = 'grabbing'; // Ensure cursor updates
    }

    _onPointerMove(event) {
        if (!this._isDragging) return;
        event.preventDefault(); // Prevent scrolling etc.

        const pointer = event.touches ? event.touches[0] : event;
        const clientX = pointer.clientX;
        const clientY = pointer.clientY;

        // Dispatch 'move' event with current screen coordinates (relative to viewport)
        // The controller (jigsaw-puzzle) will listen for this.
        this.element.dispatchEvent(createMoveEvent(this._pieceData.id, clientX, clientY));
        // console.log(`Piece ${this._pieceData.id} pointer move. Dispatching 'move' to (${clientX}, ${clientY})`);
    }

    _onPointerUp(event) {
        if (!this._isDragging) return;
        event.preventDefault(); // Prevent default behavior

        this._isDragging = false;

        // Remove the global listeners
        window.removeEventListener('mousemove', this._onPointerMoveBound);
        window.removeEventListener('mouseup', this._onPointerUpBound);
        window.removeEventListener('touchmove', this._onPointerMoveBound);
        window.removeEventListener('touchend', this._onPointerUpBound);
        window.removeEventListener('touchcancel', this._onPointerUpBound);

        // Dispatch 'moveend' event
        this.element.dispatchEvent(createMoveEndEvent(this._pieceData.id));
        console.log(`Piece ${this._pieceData.id} pointer up. Dispatching 'moveend'.`);

        // Remove the 'dragging' class
        this.element.classList.remove('is-dragging');
        // Cursor will be reset by updateFromPiece based on isSelected state or default grab
        if (!this._pieceData.isSelected) this.element.style.cursor = 'grab';

        // Deselection on pointer up if it was just a click (no move) is handled by controller
        // The controller might dispatch select(null) or rely on clicking background.
    }

    // Public method to set selected state visually (called by controller)
    setSelected(isSelected) {
        this._pieceData.isSelected = isSelected; // Update data model state (optional, controller might do this)
        this.updateFromPiece(); // Update visual
    }

    // Public method to set snapped state visually (called by controller)
    setSnapped(isSnapped) {
         this._pieceData.isSnapped = isSnapped; // Update data model state
         this.updateFromPiece(); // Update visual
    }

    // Public method to update position and rotation from data model (called by controller)
    updatePositionAndRotation() {
        this.element.setAttribute('transform', this._pieceData.getSvgTransform());
    }
}

// Note: This class is NOT registered as a custom element.
// The <jigsaw-puzzle> component will instantiate and manage these.