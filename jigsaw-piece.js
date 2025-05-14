// jigsaw-piece.js - Web component for a single puzzle piece visualization.

export class JigsawPiece extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    static get observedAttributes() {
        return [
            'width', 'height',
            'x', 'y',
            'rotation',
            'image-url',
            'image-width', 'image-height',
            'correct-x', 'correct-y',
            'path-data' // For square shape initially
        ];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue && name !== 'selected' && name !== 'snapped') return;
        // Only call _updateRendering if essential attributes change for display
        // Or just call it every time for simplicity at this stage.
        this._updateRendering();
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    position: absolute;
                    touch-action: none;
                    user-select: none;
                    /* size, position, and transform set by JS based on attributes */
                }
                svg {
                    width: 100%; height: 100%;
                    overflow: visible;
                }
                /* Pattern units should be userSpaceOnUse, set in attribute */
                .piece-shape { stroke: black; stroke-width: 1; vector-effect: non-scaling-stroke; }
            </style>
            <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                <defs>
                    <!-- Pattern for the entire source image -->
                    <pattern id="img-pattern" patternUnits="userSpaceOnUse">
                        <!-- Image element within the pattern -->
                        <image id="img-in-pattern"></image>
                    </pattern>
                    <!-- Clip path for the piece shape -->
                    <clipPath id="piece-clip"><path id="piece-clip-path"></path></clipPath>
                </defs>
                <!-- The shape element, filled with the pattern and clipped -->
                <path class="piece-shape" fill="url(#img-pattern)" clip-path="url(#piece-clip)"></path>
            </svg>
        `;
        // Call update rendering after shadow DOM is populated
        this._updateRendering();
    }

    _updateRendering() {
        // Read attributes
        const width = parseFloat(this.getAttribute('width') || 0);
        const height = parseFloat(this.getAttribute('height') || 0);
        const x = parseFloat(this.getAttribute('x') || 0);
        const y = parseFloat(this.getAttribute('y') || 0);
        const rotation = parseFloat(this.getAttribute('rotation') || 0);
        const imageUrl = this.getAttribute('image-url') || '';
        const imageWidth = parseFloat(this.getAttribute('image-width') || 0);
        const imageHeight = parseFloat(this.getAttribute('image-height') || 0);
        const correctX = parseFloat(this.getAttribute('correct-x') || 0);
        const correctY = parseFloat(this.getAttribute('correct-y') || 0);
        let pathData = this.getAttribute('path-data');

        // --- Debugging Logs ---
        // console.log(`Piece ${this.id || 'N/A'}: Updating rendering.`);
        // console.log(`  Size: ${width}x${height}, Pos: (${x}, ${y}), Rot: ${rotation}`);
        // console.log(`  Image: ${imageUrl} (${imageWidth}x${imageHeight}) @ (${correctX}, ${correctY})`);
        // console.log(`  Path Data Length: ${pathData ? pathData.length : 0}`);


        // Update host element position and size (CSS)
        this.style.left = `${x}px`;
        this.style.top = `${y}px`;
        this.style.width = `${width}px`;
        this.style.height = `${height}px`;
        this.style.transformOrigin = 'center center'; // Rotate around the element's visual center
        this.style.transform = `rotate(${rotation}deg)`;

        // Update internal SVG
        const svg = this.shadowRoot.querySelector('svg');
        const image = this.shadowRoot.querySelector('#img-in-pattern');
        const pieceClipPath = this.shadowRoot.querySelector('#piece-clip-path');
        const pieceShape = this.shadowRoot.querySelector('.piece-shape');
        const pattern = this.shadowRoot.querySelector('#img-pattern');

        if (!svg || !image || !pieceClipPath || !pieceShape || !pattern) {
            console.error("JigsawPiece internal SVG elements not found!");
            return;
        }

        // Set SVG viewBox to match piece dimensions (local coordinate system 0,0 to width,height)
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

        // Configure image pattern and the image element inside it
        if (imageUrl && imageWidth > 0 && imageHeight > 0) {
            image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', imageUrl);
            image.setAttribute('width', imageWidth);
            image.setAttribute('height', imageHeight);
            // Position the image *within the pattern*. The pattern uses userSpaceOnUse,
            // so its coordinate system is the same as the SVG viewport it's applied to.
            // The piece's local SVG viewport is 0,0 to width,height.
            // The piece's origin in the source image is (correctX, correctY).
            // To make the point (correctX, correctY) from the source image appear at the piece's local (0,0),
            // we must shift the image element within the pattern by (-correctX, -correctY).
            image.setAttribute('x', -correctX);
            image.setAttribute('y', -correctY);

            // The pattern's size defines the bounds of the pattern tile. When patternUnits="userSpaceOnUse",
            // the pattern tile stretches to match the image's defined width and height in the coordinate system
            // of the element it fills (the piece's local 0,0 to width,height).
            // Setting pattern width/height to imageWidth/imageHeight seems correct for showing the whole image,
            // then the piece's shape acts as the window.
            pattern.setAttribute('width', imageWidth);
            pattern.setAttribute('height', imageHeight);

             // console.log(`Piece ${this.id || 'N/A'}: Pattern configured. Image x: ${-correctX}, y: ${-correctY}, pattern size: ${imageWidth}x${imageHeight}`);

        } else {
            // Handle cases with missing image info (e.g., error loading)
            // Clear the image href to prevent broken image icon if desired.
            image.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
            console.warn(`Piece ${this.id || 'N/A'}: Missing or invalid image info. Cannot configure pattern.`);
        }


        // Update clip path data (default to rectangle if missing or size is zero)
        if (!pathData || width <= 0 || height <= 0) {
             pathData = `M 0 0 L ${width} 0 L ${width} ${height} L 0 ${height} Z`;
             // console.warn(`Piece ${this.id || 'N/A'}: path-data missing or size is zero. Using default rectangle path: ${pathData}`);
        }
        pieceClipPath.setAttribute('d', pathData);
        pieceShape.setAttribute('clip-path', 'url(#piece-clip)'); // Ensure clip path is applied


        // Update piece shape path data
        // For square pieces, the clip path IS the shape path, but we need the path data on the shape element too for stroke.
        pieceShape.setAttribute('d', pathData);

        // Set fill to reference the internal pattern
        pieceShape.setAttribute('fill', 'url(#img-pattern)');

         // console.log(`Piece ${this.id || 'N/A'}: Rendering updated.`);
    }
}

customElements.define('jigsaw-piece', JigsawPiece);