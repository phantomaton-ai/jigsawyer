# Classes

## Domain model

* `Position` (`position.js`)
  * `x: number`: Board X
  * `y: number`: Board Y

* `Piece(origination, placement, rotation)` (`piece.js`)
  * `origination: Position`: Original placement in the image.
  * `placement: Position`: Placement on the board
  * `rotation: number`: 0-3 (representing rotation)
  * `test(): boolean`: True if origination matches placement, and piece is unrotated.
  * `rotate(turns: number)`: Rotates the piece.
  * `place(position: Posiion)`: Updates the placement of the piece

* `Wave(period, amplitude)` (`wave.js`)
  * `amplitude`: Amplitude of the waveform, in board coordinates (clamped to 0.01-0.05)
  * `period`: Period of the waveform, in board coordinates (clamped to 1.0-20.0)
  * `sample(t)`: Sample the waveform at position t

* `Cut(components)` (`cut.js`)
  * `components: Wave[]`: Components which vary the position (these will be summed when we sample)
  * `sample(t: number): number`: Sample the cut at board position t; returns board-space distannce from a straight cut

* `Joint(pieces, outward, size, cut)` (`joint.js`)
  * `pieces: Piece[]`: The two pieces connected by this edge.
  * `outward: boolean`: True if the nib goes out of piece 0 into piece 1 (false for reverse)
  * `size: number`: The size of the nib, in board coordinates (clamped to 0.15-0.33)
  * `cut: Cut`: The "cut" used to separate the two pieces.

* `Joints(left, right, top, bottom)` (`joints.js`)
  * `left?: Joint`: Left joint of this piece (if it connects to another piece)
  * `right?: Joint`: Right joint of this piece (if it connects to another piece)
  * `top?: Joint`: Top joint of this piece (if it connects to another piece)
  * `bottom?: Joint`: Bottom joint of this piece (if it connects to another piece)

* `Puzzle(pieces: int)` (`puzzle.js`)
  * `minimum: Position`: Top-left puzzle position, in board coordinates
  * `maximum: Position`: Bottom-right puzzle position, in board coordinates
  * `pieces: Piece[]`: The puzzle pieces
  * `image: Image`: The original image

* `Image(width, height)` (`image.js`)
  * `width: number`: Width of the image, in pixels
  * `height: number`: Height of the image, in pixels
  * `url: string`: The URL of the image.

* `Viewport` (`viewport.js`)
  * `height: number`: Height of viewable area, in pixels
  * `width: number`: Width of viewable area, in pixels
  * `minimum: Position`: Top-left position, in board coordinates
  * `maximum: Position`: Bottom-right position, in board coordinates
  * `origin: Position`: Center of the viewport (controlled by panning)
  * `scale: number`: Number of pixels per board unit (clamped to 1.0-100.0)
  * `pan(dx: number, dy: number)`: Update origin
  * `zoom(dz: number)`: Update scale
  * `transform(px: number, py: number): Position`: Translate from pixel space to board space.
  * `resize(width, height)`: Update viewable area

## Custom elements

* `jigsaw-puzzle` (`jigsaw-puzzle.js`): The full puzzle (main entry point)
  * `src`: Image file to display as a puzzle
  * `size`: Number of pieces in the puzzle
* `jigsaw-controls` (`jigsaw-controls.js`): Various buttons
  * `selected: number`: index of the selected piece
* `jigsaw-board` (`jigsaw-board.js`): The background grid
  * `width: number`: Size of board space, horizontally
  * `height: number`: Size of board space, vertically
* `jigsaw-piece` (`jigsaw-piece.js`): Individual pieces
  * `index: number`; index in `Puzzle.pieces`
  * `src: string`: URL of the image
  * `x`: X position of the center of the piece, in board space
  * `y`: Y position of the center of the piece, in board space
  * `path`: SVG path along the border of the piece
  * `rotation`: Number of quarter-turns to rotate clockwise (0-3)
  * `selected: boolean`: Present when this piece is selected

## Custom events

* `pan` (`pan.js`): Pan events which would change the viewport
  * `dx`: Number of pixels panned horizontally
  * `dy`: Number of pixels panned vertically
* `zoom` (`zoom.js`): Zoom events which impact the viewport
  * `dz`: Change in scale
* `select` (`select.js`): Select a piece
  * `index: number`: Index of the piece to select
* `move` (`move.js`): Update the placement of a piece, while dragging
  * `index: number`: Index of the piece to move
  * `x: number`: X position, in viewport pixel coordinates
  * `y: number`:
* `rotate` (`rotate.js`): Rotate a piece
  * `index: number`: Index of the piece to rotate
  * `turns: number`: Number of 90-degree right turns to apply

## Relationships

* `jigsaw-puzzle` listens for:
  * `pan` and `zoom`, delegating to the `viewport`
  * `select` and updates `jigsaw-controls` and relevant `jigsaw-piece`
  * `move` and updates `Piece` domain model and relevant `jigsaw-piece`
  * `rotate` and updates `Piece` domain model and relevant `jigsaw-piece`