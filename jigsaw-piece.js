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
                }
                svg { width: 100%; height: 100%; overflow: visible; }
                #img-pattern { patternUnits: userSpaceOnUse; }
                .piece-shape { stroke: black; stroke-width: 1; vector-effect: non-scaling-stroke; }
            </style>
            <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                <defs>
                    <pattern id="img-pattern"><image id="img-in-pattern"></image></pattern>
                    <clipPath id="piece-clip"><path id="piece-clip-path"></path></clipPath>
                </defs>
                <path class="piece-shape" fill="url(#img-pattern)" clip-path="url(#piece-clip)"></path>
            </svg>
        `;
        this._updateRendering();
    }

    _updateRendering() {
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

        this.style.left = `${x}px`;
        this.style.top = `${y}px`;
        this.style.width = `${width}px`;
        this.style.height = `${height}px`;
        this.style.transformOrigin = 'center center';
        this.style.transform = `rotate(${rotation}deg)`;

        const svg = this.shadowRoot.querySelector('svg');
        const image = this.shadowRoot.querySelector('#img-in-pattern');
        const pieceClipPath = this.shadowRoot.querySelector('#piece-clip-path');
        const pieceShape = this.shadowRoot.querySelector('.piece-shape');
        const pattern = this.shadowRoot.querySelector('#img-pattern');

        if (!svg || !image || !pieceClipPath || !pieceShape || !pattern) return;

        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

        // Configure image pattern
        if (imageUrl && imageWidth > 0 && imageHeight > 0) {
            image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', imageUrl);
            image.setAttribute('width', imageWidth);
            image.setAttribute('height', imageHeight);
            image.setAttribute('x', -correctX);
            image.setAttribute('y', -correctY);

            pattern.setAttribute('width', imageWidth); // Pattern dimensions match image dimensions
            pattern.setAttribute('height', imageHeight);
        }

        // Update path data (default to rectangle if missing)
        if (!pathData) pathData = `M 0 0 L ${width} 0 L ${width} ${height} L 0 ${height} Z`;
        pieceClipPath.setAttribute('d', pathData);
        pieceShape.setAttribute('d', pathData);
    }
}

customElements.define('jigsaw-piece', JigsawPiece);