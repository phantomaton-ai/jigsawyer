// html.js - Generates the Shadow DOM HTML structure for the jigsaw-puzzle component

export function getShadowInnerHTML(config = {}) {
    const {
        puzzleWidth = 1344, // Default initial width of the puzzle area itself
        puzzleHeight = 960,  // Default initial height
        panLeftLabel = '⬅️ Pan',
        panRightLabel = '➡️ Pan',
        panUpLabel = '⬆️ Pan',
        panDownLabel = '⬇️ Pan',
        zoomInLabel = '➕ Zoom',
        zoomOutLabel = '➖ Zoom',
        rotateNeg90Label = '↪️ -90°',
        rotate180Label = '🔄 180°',
        rotatePos90Label = '↩️ +90°',
    } = config;

    // Note: The host width/height styles will be set by the component based on its own size or image size.
    // The #puzzle-container's transform will handle pan/zoom.
    // The #svg-board's viewBox will define the "world" space.

    return `
        <style>
            :host {
                display: block; /* Or inline-block, or flex, as needed */
                width: 100%; /* Default to taking full width of its container */
                height: 600px; /* Default height, can be overridden by user CSS or attributes */
                position: relative;
                background-color: #1a1a1a; /* Even spookier dark! 🦇 */
                overflow: hidden; /* Crucial for pan/zoom effect */
                border: 1px solid #555; /* Subtle ghostly border */
                user-select: none; /* Prevent text selection during interactions */
                touch-action: none; /* Prevents default touch actions like scrolling on the element */
            }

            #puzzle-container {
                /* This container will be transformed for pan & zoom. */
                /* Its children (pieces, grid) are positioned in 'world' coordinates. */
                width: 100%; /* Matches host */
                height: 100%; /* Matches host */
                position: absolute;
                top: 0;
                left: 0;
                transform-origin: 0 0; /* Essential for correct zoom/pan calculations */
                /* background-color: #222; /* Background for the 'world' - for testing */
            }

            #svg-board {
                /* The SVG element acts as the main drawing surface for pieces and the grid. */
                /* Its viewBox will define the 'world' coordinate system. */
                /* Pieces will be <g> or <svg> elements inside this. */
                width: 100%;
                height: 100%;
                position: absolute; /* Will be contained within #puzzle-container */
                top: 0;
                left: 0;
                /* pointer-events: none; /* Let events pass through to #puzzle-container for panning unless over a piece */
            }
            
            /* Individual puzzle pieces will be SVG groups or nested SVGs */
            .puzzle-piece-group {
                cursor: grab;
                /* transition: filter 0.1s ease-out; /* For selection highlight */
            }

            .puzzle-piece-group.selected .piece-shape {
                /* Example selection: using a filter for glow effect */
                filter: drop-shadow(0 0 3px #ffdf00) drop-shadow(0 0 8px #ffdf00); /* Golden spooky highlight! ✨👻 */
            }
            
            .puzzle-piece-group.selected {
                /* Higher z-index could be simulated by re-appending in SVG, or filters might be enough */
                cursor: grabbing;
            }
            
            .grid-dot {
                fill: rgba(255, 255, 255, 0.2); /* Ghostly white dots */
                pointer-events: none; /* Dots should not interfere with interactions */
            }

            #controls-toolbar {
                position: absolute;
                bottom: 15px;
                left: 50%;
                transform: translateX(-50%);
                background-color: rgba(40, 40, 40, 0.85); /* Darker, classier control bar */
                padding: 10px;
                border-radius: 8px;
                border: 1px solid #666;
                display: flex;
                gap: 10px;
                z-index: 100; /* Above SVG board */
                box-shadow: 0 2px 10px rgba(0,0,0,0.5); /* Spooky shadow for controls! 🕶️ */
            }

            #piece-action-toolbar {
                position: absolute;
                top: 15px;
                left: 50%;
                transform: translateX(-50%);
                background-color: rgba(40, 40, 40, 0.85);
                padding: 10px;
                border-radius: 8px;
                border: 1px solid #666;
                display: none; /* Hidden by default, shown when a piece is selected */
                gap: 10px;
                z-index: 100;
                box-shadow: 0 2px 10px rgba(0,0,0,0.5);
            }

            #controls-toolbar button, #piece-action-toolbar button {
                background-color: #ff9800; /* Jack-o-lantern orange! 🎃 */
                color: #000;
                border: 1px solid #000;
                padding: 6px 12px;
                font-family: 'Comic Sans MS', 'Chalkboard SE', 'Bradley Hand', cursive; /* Because why not? 🤪 */
                font-weight: bold;
                cursor: pointer;
                border-radius: 5px;
                transition: background-color 0.2s, transform 0.1s;
            }

            #controls-toolbar button:hover, #piece-action-toolbar button:hover {
                background-color: #e68900; /* Darker orange */
            }
            #controls-toolbar button:active, #piece-action-toolbar button:active {
                transform: scale(0.95);
            }
            
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
                z-index: 1000; /* Very high */
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
            }

        </style>

        <div id="puzzle-container">
            <svg id="svg-board" 
                 xmlns="http://www.w3.org/2000/svg" 
                 xmlns:xlink="http://www.w3.org/1999/xlink">
                <defs>
                    <!-- For image patterns for pieces -->
                </defs>
                <g id="grid-layer">
                    <!-- Grid dots will be drawn here if using SVG for grid -->
                </g>
                <g id="pieces-layer">
                    <!-- Puzzle piece SVG groups will be appended here -->
                </g>
            </svg>
        </div>

        <div id="controls-toolbar">
            <button id="pan-left" title="Pan Left">${panLeftLabel}</button>
            <button id="pan-right" title="Pan Right">${panRightLabel}</button>
            <button id="pan-up" title="Pan Up">${panUpLabel}</button>
            <button id="pan-down" title="Pan Down">${panDownLabel}</button>
            <button id="zoom-in" title="Zoom In">${zoomInLabel}</button>
            <button id="zoom-out" title="Zoom Out">${zoomOutLabel}</button>
        </div>

        <div id="piece-action-toolbar">
            <button id="rotate-neg-90" title="Rotate Left">${rotateNeg90Label}</button>
            <button id="rotate-180" title="Rotate 180">${rotate180Label}</button>
            <button id="rotate-pos-90" title="Rotate Right">${rotatePos90Label}</button>
        </div>
        
        <div id="win-message-container">
            <div id="win-message">🎉 YOU SOLVED IT, YOU MAGNIFICENT IDIOT! 🎉</div>
        </div>
    `;
}