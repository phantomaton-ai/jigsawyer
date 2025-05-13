// jigsaw-viewport.js - Web component that applies pan/zoom transform and manages Viewport state.

import { Viewport } from './viewport.js';
import { createPanEvent } from './pan.js'; // Used for event detail type
import { createZoomEvent } from './zoom.js'; // Used for event detail type

/**
 * JigsawViewport web component - manages pan/zoom state and applies transform to slotted content.
 * It wraps the visual area of the puzzle (board + pieces).
 */
export class JigsawViewport extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        // Domain Model
        this._viewport = null; // Instance of the Viewport domain model

        // DOM References
        this._container = null; // The element that gets the CSS transform

        // Initial viewport state (can be set via attributes later if needed)
        // For now, it will be initialized in connectedCallback based on host size.
    }

    // No observed attributes for state *inside* the viewport,
    // but could add attributes for initial viewBox or constraints later.
    // For now, it reacts to pan/zoom events.

    connectedCallback() {
        // Set up Shadow DOM structure: a container to apply transform, and a slot for content
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block; /* Essential for sizing */
                    width: 100%;
                    height: 100%;
                    overflow: hidden; /* Hide content outside the viewport */
                    position: relative; /* Allows absolute positioning of its container */
                }

                #viewport-container {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%; /* Fills the host */
                    height: 100%; /* Fills the host */
                    transform-origin: 0 0; /* Important for pan/zoom calculations */
                     /* Background color handled by jigsaw-board */
                }

                /* Styles for slotted content - crucial for pieces positioned in world coordinates */
                ::slotted(*) {
                     /* Slotted content is placed inside #viewport-container */
                     /* Positioning (top/left) and transforms on individual pieces/board
                        should be relative to the world coordinates defined by the SVG viewBox
                        within the slotted jigsaw-board. */
                    /* The CSS transform on #viewport-container acts like a camera
                       moving over this world. */
                }
            </style>

            <div id="viewport-container">
                <slot></slot> <!-- Content (jigsaw-board with slotted pieces) goes here -->
            </div>
        `;

        // Get DOM reference
        this._container = this.shadowRoot.getElementById('viewport-container');

        // Initialize Viewport domain model
        const hostRect = this.getBoundingClientRect();
        // Use current size for initialization. ResizeObserver will handle updates.
        this._viewport = new Viewport(hostRect.width, hostRect.height);

        // Add event listeners for pan/zoom events bubbling up from children
        this._addEventListeners();

        // Use ResizeObserver to update viewport dimensions if the host element is resized
        this._resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                console.log(`Viewport host resized to ${width}x${height} 📏`);
                this._viewport.setHostDimensions(width, height);
                this._renderViewport(); // Re-apply transform based on new size
            }
        });
        this._resizeObserver.observe(this);

        // Apply initial viewport transform
        this._renderViewport();

        console.log('JigsawViewport element connected.');
    }

    disconnectedCallback() {
        console.log('JigsawViewport element disconnected. 👻 Goodbye!');
        // Clean up ResizeObserver
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
        }
        // No global listeners added here.
    }

    /**
     * Adds event listeners for custom pan/zoom events bubbling up.
     */
    _addEventListeners() {
        console.log("Viewport adding event listeners...");
        // Listen for 'pan' and 'zoom' events bubbling up from children (e.g., jigsaw-board)
        this.addEventListener('pan', this._handlePanEvent.bind(this));
        // Listen for 'zoom' events and pass pointer coordinates relative to this component
        this.addEventListener('zoom', this._handleZoomEvent.bind(this));
    }


    /**
     * Handles incoming 'pan' events.
     * @param {CustomEvent} event
     */
    _handlePanEvent(event) {
        event.stopPropagation(); // Stop the pan event from bubbling further up
        const { dx, dy } = event.detail;
        // console.log(`Viewport handling pan: dx=${dx}, dy=${dy}`); // Too verbose

        if (!this._viewport) return;

        // Update the Viewport domain model
        this._viewport.pan(dx, dy);

        // Apply the new transform to the container
        this._renderViewport();
    }

    /**
     * Handles incoming 'zoom' events.
     * @param {CustomEvent} event
     */
    _handleZoomEvent(event) {
        event.stopPropagation(); // Stop the zoom event from bubbling further up
        const { factor, clientX, clientY } = event.detail; // clientX/Y are screen coords relative to original event target

        // console.log(`Viewport handling zoom: factor=${factor}, clientX=${clientX}, clientY=${clientY}`);
        if (!this._viewport) return;

        // Need pointer coordinates relative to the viewport component's top-left corner
        let pointerX_host, pointerY_host;
        if (clientX !== undefined && clientY !== undefined) {
            const hostRect = this.getBoundingClientRect();
            pointerX_host = clientX - hostRect.left;
            pointerY_host = clientY - hostRect.top;
        } // If clientX/Y are undefined (e.g., from button click), Viewport zooms to host center by default

        // Update the Viewport domain model. It returns true if zoom level changed.
        if (this._viewport.zoom(factor, pointerX_host, pointerY_host)) {
            // If zoom changed, apply the new transform to the container
            this._renderViewport();
             // Optionally, dispatch a 'viewport-changed' event if parents need to know zoom/pan changed
             // this.dispatchEvent(new CustomEvent('viewport-changed', { detail: { zoom: this._viewport.zoomLevel, panX: this._viewport.viewBoxX, panY: this._viewport.viewBoxY }}));
        }
    }

    /**
     * Applies the current pan and zoom transformation from the Viewport model to the container element.
     */
    _renderViewport() {
        if (!this._viewport || !this._container) {
            console.warn("Cannot render viewport transform: missing viewport or container.");
            return;
        }
        // Apply the transformation calculated by the Viewport domain model
        this._container.style.transform = this._viewport.getPuzzleAreaTransform();
        // console.log(`Viewport transform applied: ${this._container.style.transform}`);
    }

    /**
     * Allows parent to set the initial viewpoint position and zoom level programmatically.
     * This bypasses event handling and directly updates the Viewport model and renders.
     * @param {number} viewX - Target viewBox X origin.
     * @param {number} viewY - Target viewBox Y origin.
     * @param {number} zoomLevel - Target zoom level.
     */
    setView(viewX, viewY, zoomLevel) {
         if (!this._viewport) return;
         this._viewport.viewBoxX = viewX;
         this._viewport.viewBoxY = viewY;
         this._viewport.zoomLevel = Math.max(0.1, Math.min(zoomLevel, 10)); // Re-apply clamp
         this._renderViewport();
    }

    /**
     * Allows parent to get current viewport state.
     * @returns {{viewBoxX: number, viewBoxY: number, zoomLevel: number}}
     */
    getViewState() {
         if (!this._viewport) return { viewBoxX: 0, viewBoxY: 0, zoomLevel: 1 };
         return {
             viewBoxX: this._viewport.viewBoxX,
             viewBoxY: this._viewport.viewBoxY,
             zoomLevel: this._viewport.zoomLevel
         };
    }
}

// Register the custom element
customElements.define('jigsaw-viewport', JigsawViewport);
console.log('🏞️ JigsawViewport custom element defined!');