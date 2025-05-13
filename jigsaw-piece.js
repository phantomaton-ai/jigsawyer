// jigsaw-piece.js - View class for a puzzle piece SVG element.

import { Piece } from './piece.js';
import { ImageInfo } from './image-info.js';

export class JigsawPiece {
    constructor(pieceData, svgDefs, imageInfo) {
        this._pieceData = pieceData;
        this._svgDefs = svgDefs;
        this._imageInfo = imageInfo;

        this.element = this._createSvgElement();
        this._createClipPath();
        this._applyFill();
        this.updatePositionAndRotation();
    }

    _createSvgElement() {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('data-id', this._pieceData.id);

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', 0);
        rect.setAttribute('y', 0);
        rect.setAttribute('width', this._pieceData.width);
        rect.setAttribute('height', this._pieceData.height);
        rect.setAttribute('stroke', 'black');
        rect.setAttribute('stroke-width', 1);
        rect.setAttribute('vector-effect', 'non-scaling-stroke');

        g.appendChild(rect);
        return g;
    }

    _createClipPath() {
        const clipId = `clip-${this._pieceData.id}`;
        const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
        clipPath.setAttribute('id', clipId);

        const clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        clipRect.setAttribute('x', this._pieceData.originX);
        clipRect.setAttribute('y', this._pieceData.originY);
        clipRect.setAttribute('width', this._pieceData.width);
        clipRect.setAttribute('height', this._pieceData.height);

        clipPath.appendChild(clipRect);
        this._svgDefs.appendChild(clipPath);

        this.element.querySelector('rect').setAttribute('clip-path', `url(#${clipId})`);
    }

    _applyFill() {
        this.element.querySelector('rect').setAttribute('fill', 'url(#img-pattern)');
    }

    updatePositionAndRotation() {
        const { currentX, currentY, width, height, rotation } = this._pieceData;
        // Apply translate and rotate around piece center to the group
        this.element.setAttribute(
            'transform',
            `translate(${currentX}, ${currentY}) rotate(${rotation} ${width / 2} ${height / 2})`
        );
    }
}