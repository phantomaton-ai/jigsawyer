// jigsaw-puzzle.html.js - HTML structure for the jigsaw-puzzle component Shadow DOM.

/**
 * Returns the HTML string for the jigsaw-puzzle component's Shadow DOM.
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

            /* Style for the board component slotted into the viewport */
            jigsaw-board {
                /* jigsaw-board fills the viewport and handles its own internal SVG/grid/slot */
                 position: absolute;
                 top: 0;
                 left: 0;
                 width: 100%; /* Fills the viewport */
                 height: 100%; /* Fills the viewport */
            }

            /* Styles for jigsaw-piece components slotted *inside* jigsaw-board */
            /* These need to be relative to the board's coordinate system (defined by board's viewBox) */
             /* jigsaw-piece components handle their own positioning (top/left/transform) */
             /* based on their x, y, rotation attributes */
            ::slotted(jigsaw-piece) {
                position: absolute; /* Positioned within the viewport/board container */
                 /* Visual styles (size, transform, selected, snapped, etc.) managed by jigsaw-piece component itself */
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
            <!-- The board component, renders grid and slots pieces -->
            <jigsaw-board id="jigsaw-board"></jigsaw-board>
            <!-- JigsawPiece elements will be appended directly to jigsaw-board,
                 which will slot them. -->
        </jigsaw-viewport>

        <!-- The controls component -->
        <jigsaw-controls id="jigsaw-controls"></jigsaw-controls>

        <!-- Win message container -->
        <div id="win-message-container">
            <div id="win-message">🎉 YOU SOLVED IT, YOU MAGNIFICENT IDIOT! 🎉</div>
        </div>
    `;
}