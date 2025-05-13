// jigsaw-puzzle.html.js - HTML structure for the jigsaw-puzzle component Shadow DOM.

/**
 * Returns the HTML string for the jigsaw-puzzle component's Shadow DOM.
 * This structure includes a viewport, a board for the grid, and a separate container for the pieces.
 * @returns {string} HTML string.
 */
export function getJigsawPuzzleHTML() {
    return `
        <style>
            :host {
                display: block; /* Necessary for sizing and layout */
                position: relative; /* For absolute positioning of children */
                width: 100%; /* Default to fill container width */
                height: 100%; /* Default to fill container height */
                overflow: hidden; /* Hide content outside the host bounds */
                background-color: #1a1a1a; /* Default dark background */
                font-family: sans-serif; /* Default font for text */
                touch-action: none; /* Disable default touch gestures on the host */
                user-select: none; /* Prevent text selection */
            }

            /* Style for the viewport component */
            jigsaw-viewport {
                 position: absolute; /* Fill the host */
                 top: 0;
                 left: 0;
                 width: 100%;
                 height: 100%;
                 /* jigsaw-viewport handles its own transform */
            }

            /* Container inside viewport holding board and pieces */
            #viewport-content {
                 position: absolute;
                 top: 0;
                 left: 0;
                 width: 100%; /* Fills the viewport */
                 height: 100%; /* Fills the viewport */
                 /* Note: This container does NOT get the viewport transform.
                    The transform is applied by jigsaw-viewport's internal container. */
            }

            /* Style for the board component within the viewport content */
            jigsaw-board {
                /* jigsaw-board renders grid and sets the SVG viewBox. */
                /* It should be positioned relative to the viewport content's 0,0 */
                position: absolute;
                top: 0;
                left: 0;
                width: 100%; /* Fills the viewport content */
                height: 100%; /* Fills the viewport content */
                 /* Background color handled by jigsaw-board */
            }

            /* Container for the jigsaw-piece components */
            #pieces-container {
                position: absolute;
                top: 0; /* Align with the start of the board's coordinate space */
                left: 0; /* Align with the start of the board's coordinate space */
                 /* This container needs to be sized to encompass the whole board/scatter area */
                 /* Its size should match the dimensions defined by the jigsaw-board's viewBox */
                 /* The size will be set programmatically by jigsaw-puzzle */
                width: 1000px; /* Placeholder, will be set by JS */
                height: 1000px; /* Placeholder, will be set by JS */
                pointer-events: none; /* Allow events to pass through to jigsaw-board for panning */
                z-index: 1; /* Ensure pieces are above the grid */
            }

             /* Style for jigsaw-piece components inside the pieces-container */
            jigsaw-piece {
                position: absolute; /* Positioned within #pieces-container */
                 /* Their top/left/transform are set by the component based on x/y/rotation attributes */
                 pointer-events: all; /* Pieces should capture pointer events */
            }

            /* Controls component */
            jigsaw-controls {
                 /* Positioned by its own styles or could be positioned by the parent here */
            }

            /* Win message container */
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
                z-index: 1000; /* Very high, above everything */
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
                font-family: 'Comic Sans MS', 'Chalkboard SE', 'Bradley Hand', cursive; /* Consistent idiotic font */
            }
        </style>

        <!-- The viewport component, manages pan/zoom transform -->
        <jigsaw-viewport id="jigsaw-viewport">
             <!-- Container for content that should be panned/zoomed -->
            <div id="viewport-content">
                <!-- The board component, renders grid and sets SVG viewBox -->
                <jigsaw-board id="jigsaw-board"></jigsaw-board>
                <!-- Container for jigsaw-piece elements -->
                <div id="pieces-container">
                    <!-- JigsawPiece elements will be appended here -->
                </div>
            </div>
        </jigsaw-viewport>

        <!-- The controls component -->
        <jigsaw-controls id="jigsaw-controls"></jigsaw-controls>

        <!-- Win message container -->
        <div id="win-message-container">
            <div id="win-message">🎉 YOU SOLVED IT, YOU MAGNIFICENT IDIOT! 🎉</div>
        </div>
    `;
}