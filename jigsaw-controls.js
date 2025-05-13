// jigsaw-controls.js - Web component for puzzle control buttons.
// Renders pan, zoom, and rotation buttons and dispatches custom events when clicked.

import { createPanEvent } from './pan.js';
import { createZoomEvent } from './zoom.js';
import { createRotateEvent } from './rotate.js';
import { createSelectEvent } from './select.js'; // For potential deselect button later

/**
 * JigsawControls web component - provides buttons for controlling the puzzle viewport and selected piece.
 */
export class JigsawControls extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        // State derived from attributes
        this._selectedPieceId = null; // ID of the currently selected piece

        // DOM element references
        this._controlsToolbar = null;
        this._pieceActionToolbar = null;
        this._deselectButton = null; // Added a potential deselect button
    }

    static get observedAttributes() {
        // 'selected-piece-id' will control visibility of rotation controls
        return ['selected-piece-id'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;

        if (name === 'selected-piece-id') {
            this._selectedPieceId = newValue === null ? null : parseInt(newValue, 10); // Null or parsed ID
            this._updateButtonVisibility(); // Show/hide rotation controls
        }
    }

    connectedCallback() {
        // Set up the Shadow DOM structure
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: flex; /* Or block, depending on desired layout */
                    flex-direction: column;
                    align-items: center;
                    gap: 10px; /* Space between toolbars */
                    position: absolute; /* Positioned by the parent jigsaw-puzzle */
                    bottom: 10px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 100; /* Above the puzzle board and pieces */
                }

                .toolbar {
                    background-color: rgba(40, 40, 40, 0.85); /* Dark, semi-transparent background */
                    padding: 8px;
                    border-radius: 8px;
                    border: 1px solid #666;
                    display: flex; /* Arrange buttons in a row */
                    gap: 8px; /* Space between buttons */
                    box-shadow: 0 2px 10px rgba(0,0,0,0.5);
                }

                .toolbar.hidden {
                     display: none; /* Hide the piece action toolbar initially */
                }

                button {
                    background-color: #ff9800; /* Jack-o-lantern orange! 🎃 */
                    color: #000;
                    border: 1px solid #000;
                    padding: 6px 12px;
                    font-family: 'Comic Sans MS', 'Chalkboard SE', 'Bradley Hand', cursive;
                    font-weight: bold;
                    cursor: pointer;
                    border-radius: 5px;
                    transition: background-color 0.2s, transform 0.1s;
                }

                button:hover {
                    background-color: #e68900;
                }
                button:active {
                    transform: scale(0.95);
                }
            </style>

            <!-- Main Controls Toolbar (Pan/Zoom/Deselect) -->
            <div id="controls-toolbar" class="toolbar">
                 <button id="deselect-piece" title="Deselect Piece">🚫 Deselect</button> <!-- Added deselect -->
                <button id="pan-left" title="Pan Left">⬅️ Pan</button>
                <button id="pan-right" title="Pan Right">➡️ Pan</button>
                <button id="pan-up" title="Pan Up">⬆️ Pan</button>
                <button id="pan-down" title="Pan Down">⬇️ Pan</button>
                <button id="zoom-in" title="Zoom In">➕ Zoom</button>
                <button id="zoom-out" title="Zoom Out">➖ Zoom</button>
            </div>

            <!-- Piece Action Toolbar (Rotation) - Initially Hidden -->
            <div id="piece-action-toolbar" class="toolbar hidden">
                <button id="rotate-neg-90" title="Rotate Left">↪️ -90°</button>
                <button id="rotate-180" title="Rotate 180">🔄 180°</button>
                <button id="rotate-pos-90" title="Rotate Right">↩️ +90°</button>
            </div>
        `;

        // Get DOM references *after* innerHTML is set
        this._controlsToolbar = this.shadowRoot.getElementById('controls-toolbar');
        this._pieceActionToolbar = this.shadowRoot.getElementById('piece-action-toolbar');
        this._deselectButton = this.shadowRoot.getElementById('deselect-piece');


        // Add event listeners to buttons
        this._addEventListeners();

        // Set initial visibility based on selected-piece-id attribute
        this._selectedPieceId = this.hasAttribute('selected-piece-id') ? parseInt(this.getAttribute('selected-piece-id'), 10) : null;
        this._updateButtonVisibility();

        console.log('JigsawControls element connected.');
    }

    disconnectedCallback() {
        console.log('JigsawControls element disconnected.');
        // No global listeners to clean up here.
    }

    /**
     * Adds event listeners to the buttons to dispatch custom events.
     */
    _addEventListeners() {
        // Pan/Zoom/Deselect buttons dispatch events from this component
        this._deselectButton.addEventListener('click', () => {
             console.log("Deselect button clicked");
             // Dispatch a select event with null pieceId to indicate deselect
             this.dispatchEvent(createSelectEvent(null));
        });
        this.shadowRoot.getElementById('pan-left').addEventListener('click', () => { console.log("Pan left clicked"); this.dispatchEvent(createPanEvent(-50, 0)); });
        this.shadowRoot.getElementById('pan-right').addEventListener('click', () => { console.log("Pan right clicked"); this.dispatchEvent(createPanEvent(50, 0)); });
        this.shadowRoot.getElementById('pan-up').addEventListener('click', () => { console.log("Pan up clicked"); this.dispatchEvent(createPanEvent(0, -50)); });
        this.shadowRoot.getElementById('pan-down').addEventListener('click', () => { console.log("Pan down clicked"); this.dispatchEvent(createPanEvent(0, 50)); });

        // Zoom buttons need the center of the *puzzle-puzzle* component (the viewport host)
        // Since this component doesn't know that, we dispatch the zoom event
        // and the jigsaw-puzzle controller will add the screen coordinates before handling.
        this.shadowRoot.getElementById('zoom-in').addEventListener('click', () => { console.log("Zoom in clicked"); this.dispatchEvent(createZoomEvent(1.25)); });
        this.shadowRoot.getElementById('zoom-out').addEventListener('click', () => { console.log("Zoom out clicked"); this.dispatchEvent(createZoomEvent(0.8)); });

        // Piece action buttons dispatch events for the selected piece
        this.shadowRoot.getElementById('rotate-neg-90').addEventListener('click', () => {
             if (this._selectedPieceId !== null) {
                 console.log(`Rotate -90 clicked for piece ${this._selectedPieceId}`);
                 this.dispatchEvent(createRotateEvent(this._selectedPieceId, -1)); // -1 quarter turn
             }
        });
         this.shadowRoot.getElementById('rotate-180').addEventListener('click', () => {
             if (this._selectedPieceId !== null) {
                 console.log(`Rotate 180 clicked for piece ${this._selectedPieceId}`);
                 this.dispatchEvent(createRotateEvent(this._selectedPieceId, 2)); // 2 quarter turns
             }
        });
         this.shadowRoot.getElementById('rotate-pos-90').addEventListener('click', () => {
             if (this._selectedPieceId !== null) {
                 console.log(`Rotate +90 clicked for piece ${this._selectedPieceId}`);
                 this.dispatchEvent(createRotateEvent(this._selectedPieceId, 1)); // 1 quarter turn
             }
        });
    }

    /**
     * Shows/hides the piece action toolbar based on whether a piece is selected.
     */
    _updateButtonVisibility() {
        if (this._pieceActionToolbar) {
            if (this._selectedPieceId !== null) {
                this._pieceActionToolbar.classList.remove('hidden');
                console.log(`Showing piece action toolbar for piece ${this._selectedPieceId}.`);
            } else {
                this._pieceActionToolbar.classList.add('hidden');
                 console.log("Hiding piece action toolbar.");
            }
        }
         // The deselect button should probably always be visible? Or only when something is selected?
         // Let's keep it always visible in the main toolbar for now.
    }
}

// Register the custom element
customElements.define('jigsaw-controls', JigsawControls);
console.log('🕹️ JigsawControls custom element defined!');