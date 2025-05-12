import { Piece } from './piece.js';

export class Puzzle {
    constructor(imageWidth, imageHeight, pieceCount) {
        this.imageWidth = imageWidth;   // Pixel width of the source image
        this.imageHeight = imageHeight; // Pixel height of the source image
        this.pieceCount = pieceCount;   // Desired number of pieces

        this.pieces = [];               // Array to hold all Piece objects
        this.rows = 0;                  // Number of rows in the puzzle grid
        this.cols = 0;                  // Number of columns in the puzzle grid
        this.pieceWidth = 0;            // Calculated width of a single piece (in world units, same as image pixels for now)
        this.pieceHeight = 0;           // Calculated height of a single piece

        this._initializePuzzleParameters();
        this._generatePieces();
    }

    _initializePuzzleParameters() {
        // Determine grid dimensions (e.g., 40x25 for 1000 pieces on a 4:3 image)
        // This aims for piece aspect ratio similar to image aspect ratio.
        const imageAspectRatio = this.imageWidth / this.imageHeight;
        
        // Approximate cols and rows
        // N = cols * rows
        // cols / rows = imageAspectRatio  => cols = imageAspectRatio * rows
        // N = imageAspectRatio * rows^2 => rows = sqrt(N / imageAspectRatio)
        this.rows = Math.round(Math.sqrt(this.pieceCount / imageAspectRatio));
        this.cols = Math.round(this.pieceCount / this.rows);

        // Adjust if the multiplication doesn't quite yield pieceCount due to rounding
        // or if one dimension is too small.
        // This simple approach might not perfectly hit pieceCount if it's not a product of nice integers.
        // We prioritize getting close to pieceCount. The actual number of pieces generated will be rows * cols.
        
        // Ensure at least 1 row and 1 col
        this.rows = Math.max(1, this.rows);
        this.cols = Math.max(1, this.cols);
        
        // Recalculate actual piece count based on grid
        this.actualPieceCount = this.rows * this.cols;
        if (this.actualPieceCount !== this.pieceCount) {
            console.warn(`⚠️ Requested ${this.pieceCount} pieces, but using ${this.actualPieceCount} (${this.rows}x${this.cols}) for a regular grid.`);
        }

        this.pieceWidth = this.imageWidth / this.cols;
        this.pieceHeight = this.imageHeight / this.rows;

        console.log(`🧩 Puzzle Initialized: ${this.rows}x${this.cols} grid. Piece WxH: ${this.pieceWidth.toFixed(2)}x${this.pieceHeight.toFixed(2)}. Total pieces: ${this.actualPieceCount}`);
    }

    _generatePieces() {
        this.pieces = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const pieceId = r * this.cols + c;
                const correctX = c * this.pieceWidth;
                const correctY = r * this.pieceHeight;

                // For initial random placement:
                // Define a "scatter area" larger than the puzzle itself.
                // Let's say the board is 3x puzzle width and 3x puzzle height, centered.
                const scatterWidth = this.imageWidth * 2; // Area to scatter pieces
                const scatterHeight = this.imageHeight * 2;
                const scatterOffsetX = (this.imageWidth - scatterWidth) / 2; // Centering the puzzle in a larger board
                const scatterOffsetY = (this.imageHeight - scatterHeight) / 2;

                const initialX = scatterOffsetX + Math.random() * (scatterWidth - this.pieceWidth);
                const initialY = scatterOffsetY + Math.random() * (scatterHeight - this.pieceHeight);
                const initialRotation = Math.floor(Math.random() * 4) * 90; // 0, 90, 180, 270

                const piece = new Piece(
                    pieceId,
                    correctX,
                    correctY,
                    this.pieceWidth,
                    this.pieceHeight,
                    initialX,
                    initialY,
                    initialRotation
                );
                // TODO: Add edge shape generation logic here later (using `edge.js`)
                this.pieces.push(piece);
            }
        }
        console.log(`Generated ${this.pieces.length} piece data models. ✨`);
    }

    getPieceById(id) {
        return this.pieces.find(p => p.id === id);
    }

    getAllPieces() {
        return this.pieces;
    }

    // Check if all pieces are snapped correctly
    isSolved() {
        if (this.pieces.length === 0) return false; // No pieces, no solution!
        return this.pieces.every(p => p.isSnapped && p.rotation === 0);
    }
}