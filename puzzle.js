// puzzle.js - Domain model for the entire puzzle.

import { Piece } from './piece.js';
import { ImageInfo } from './image.js';
import { Position } from './position.js';
import { PieceJoints } from './joints.js';
import { Cut, createRandomCut } from './cut.js';
import { Joint, createRandomJoint } from './joint.js'; // Will use createRandomJoint helper if needed, or construct manually

// Default piece count as requested
const DEFAULT_PIECE_COUNT = 40;

/**
 * Represents the overall puzzle structure, piece data, and joint information.
 */
export class Puzzle {
    /**
     * @param {ImageInfo} image - Information about the source image.
     * @param {number} pieceCount - The desired number of pieces.
     */
    constructor(image, pieceCount = DEFAULT_PIECE_COUNT) {
        if (!(image instanceof ImageInfo)) throw new Error("Puzzle constructor requires an ImageInfo instance.");
        if (typeof pieceCount !== 'number' || pieceCount <= 0) {
             console.warn(`Invalid pieceCount: ${pieceCount}. Using default: ${DEFAULT_PIECE_COUNT}`);
             pieceCount = DEFAULT_PIECE_COUNT;
        }

        this.image = image;
        this.pieceCount = pieceCount;

        this.pieces = []; // Array of Piece objects
        this.rows = 0;    // Number of rows in the grid
        this.cols = 0;    // Number of columns in the grid
        this.pieceWidth = 0; // World units width per piece
        this.pieceHeight = 0; // World units height per piece

        // Board coordinates for the assembled puzzle grid
        this.puzzleGridMinimum = new Position(0, 0);
        this.puzzleGridMaximum = new Position(0, 0); // Will be image.width, image.height

        // Board coordinates for the larger scatter/play area (world units)
        // Let's make the board 2x the size of the puzzle grid, centered.
        this.boardMinimum = new Position(0, 0);
        this.boardMaximum = new Position(0, 0);

        this._jointsMap = new Map(); // Map<pieceId, PieceJoints>
        this._horizontalCuts = []; // 2D array [row][col_index]
        this._verticalCuts = [];   // 2D array [col][row_index]

        this._initializeParameters();
        this._generateCutsAndJoints();
        this._generatePieces();
    }

    _initializeParameters() {
        const { width: imageWidth, height: imageHeight, aspectRatio } = this.image;

        // Determine grid dimensions aiming for aspect ratio match
        this.rows = Math.max(1, Math.round(Math.sqrt(this.pieceCount / aspectRatio)));
        this.cols = Math.max(1, Math.round(this.pieceCount / this.rows));

        // Re-calculate piece count based on grid dimensions if needed
        const actualPieceCount = this.rows * this.cols;
        if (actualPieceCount !== this.pieceCount) {
            console.warn(`⚠️ Requested ${this.pieceCount} pieces, but using ${actualPieceCount} (${this.rows}x${this.cols}) for a regular grid.`);
            this.pieceCount = actualPieceCount; // Update pieceCount to the actual number
        }

        this.pieceWidth = imageWidth / this.cols;
        this.pieceHeight = imageHeight / this.rows;

        // Assembled puzzle grid boundaries
        this.puzzleGridMinimum = new Position(0, 0);
        this.puzzleGridMaximum = new Position(imageWidth, imageHeight);

        // Board boundaries (scatter area)
        const boardWidth = imageWidth * 2;
        const boardHeight = imageHeight * 2;
        this.boardMinimum = new Position(-imageWidth / 2, -imageHeight / 2);
        this.boardMaximum = new Position(imageWidth / 2 + imageWidth, imageHeight / 2 + imageHeight); // = imageWidth*1.5, imageHeight*1.5

        console.log(`🧩 Puzzle Grid: ${this.rows}x${this.cols}. Piece WxH: ${this.pieceWidth.toFixed(2)}x${this.pieceHeight.toFixed(2)}. Board Area: ${this.boardMinimum.toString()} to ${this.boardMaximum.toString()}`);
    }

    _generateCutsAndJoints() {
        const { rows, cols } = this;

        // 1. Generate random Cut instances for all internal grid lines
        this._horizontalCuts = Array.from({ length: rows - 1 }, () =>
            Array.from({ length: cols }, () => createRandomCut(3)) // rows-1 horizontal lines, each spanning cols pieces
        );
        this._verticalCuts = Array.from({ length: cols - 1 }, () =>
            Array.from({ length: rows }, () => createRandomCut(3)) // cols-1 vertical lines, each spanning rows pieces
        );

        // 2. Initialize PieceJoints for all pieces
        this._jointsMap = new Map();
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const pieceId = r * cols + c;
                this._jointsMap.set(pieceId, new PieceJoints());
            }
        }

        // 3. Create and assign Joint objects between adjacent pieces
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const currentPieceId = r * cols + c;
                const currentPieceJoints = this._jointsMap.get(currentPieceId);

                // Add Joint to piece above (connecting current piece's top to neighbor's bottom)
                if (r > 0) {
                    const neighborId = (r - 1) * cols + c;
                    const neighborJoints = this._jointsMap.get(neighborId);
                    const cut = this._horizontalCuts[r - 1][c]; // Cut is on the line BETWEEN rows r-1 and r

                    const { sideA: jointA, sideB: jointB } = createRandomJoint(
                        currentPieceId, neighborId, 'top', 'bottom', cut
                    );
                    currentPieceJoints.top = jointA;
                    neighborJoints.bottom = jointB;
                }

                // Add Joint to piece left (connecting current piece's left to neighbor's right)
                if (c > 0) {
                    const neighborId = r * cols + (c - 1);
                    const neighborJoints = this._jointsMap.get(neighborId);
                    const cut = this._verticalCuts[c - 1][r]; // Cut is on the line BETWEEN cols c-1 and c

                     const { sideA: jointA, sideB: jointB } = createRandomJoint(
                        currentPieceId, neighborId, 'left', 'right', cut
                    );
                    currentPieceJoints.left = jointA;
                    neighborJoints.right = jointB;
                }
            }
        }
         console.log(`Generated joints for ${this.pieceCount} pieces.🔗✂️`);
    }


    _generatePieces() {
        this.pieces = [];
        const { rows, cols, pieceWidth, pieceHeight, boardMinimum, boardMaximum } = this;

        // Define the scatter area boundaries
        const scatterXMin = boardMinimum.x;
        const scatterYMin = boardMinimum.y;
        const scatterWidth = boardMaximum.x - boardMinimum.x;
        const scatterHeight = boardMaximum.y - boardMinimum.y;


        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const pieceId = r * cols + c;
                const origination = new Position(c * pieceWidth, r * pieceHeight);

                // Random initial placement within the scatter area
                const initialX = scatterXMin + Math.random() * (scatterWidth - pieceWidth);
                const initialY = scatterYMin + Math.random() * (scatterHeight - pieceHeight);
                const initialPlacement = new Position(initialX, initialY);

                // Random initial rotation (0, 1, 2, or 3 quarter turns)
                const initialRotation = Math.floor(Math.random() * 4);

                // Get the pre-generated joints for this piece
                const joints = this._jointsMap.get(pieceId);
                if (!joints) {
                    console.error(`🚨 Could not find joints for piece ID ${pieceId}! This is a bug!`);
                    continue; // Skip creating this piece if joints are missing
                }

                const piece = new Piece(
                    pieceId,
                    origination,
                    pieceWidth,
                    pieceHeight,
                    initialPlacement,
                    initialRotation,
                    joints // Assign the piece joints
                );

                this.pieces.push(piece);
            }
        }
        console.log(`Generated ${this.pieces.length} Piece domain models with joints. ✨`);
    }

    getPieceById(id) {
        return this.pieces.find(p => p.id === id);
    }

    getAllPieces() {
        return this.pieces;
    }

    /**
     * Checks if the puzzle is solved (all pieces are in their correct position and rotation).
     * Uses the Piece's test() method.
     * @returns {boolean} True if solved, false otherwise.
     */
    isSolved() {
        if (this.pieces.length === 0) return false; // No pieces, no solution!
        return this.pieces.every(p => p.isSnapped && p.rotation === 0); // Assuming snap implies correct pos/rot for now
        // Alternative using Piece.test(): return this.pieces.every(p => p.test());
    }

     /**
     * Returns a string representation.
     * @returns {string}
     */
    toString() {
        return `Puzzle(Pieces: ${this.pieceCount}, Grid: ${this.rows}x${this.cols}, Image: ${this.image.toString()}, Board: ${this.boardMinimum.toString()} to ${this.boardMaximum.toString()})`;
    }
}