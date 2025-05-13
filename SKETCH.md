`jigsawyer` is a small library used to provide jigsaw puzzle editing capabilities over the web.

We'd like the following files:

* `index.html`: Runs `jigsawyer` as a 1000-piece puzzle, using `example.png` as a source file.
* `jigsawyer.js`: Registers a `jigsaw-puzzle` web component.
* `jigsawyer.test.js`: Mocha/lovecraft test.
* Additional `.js` and `.test.js` files as-needed; we like to target ~100LOC per file:
  * `jigsaw-puzzle.js`: Defines (but does not register) the `jigsaw-puzzle` component
  * `jigsaw-piece.js`: Defines a web component for an individual puzzle piece
  * `jigsaw-board.js`: Defines the background grid
  * `puzzle.js`: Defines a `Puzzle` class; domain model for the puzzle, accepts number-of-pieces and image dimensions in constructor
  * `piece.js`: Domain model for an individual puzzle piece, as a `Piece` object
  * `edge.js`: Describes the shape of an edge between two puzzle pieces.
  * `board.js`: Locates all pieces of a `Puzzle` on a board
  * `html.js`: HTML template for `shadowRoot.innerHTML` (as a function accepting a `Puzzle`)
  * `viewport.js`: Manages pan/zoom state

We'd like to use Web Components, so that we can simply say:

```
<jigsaw-puzzle src="example.png" size=1000 />
```

This should create an embedded component containing various puzzle pieces.

Behavior:

* Puzzle pieces should be randomly distributed and oriented.
* It should be easy to click on a puzzle piece and drag it around
* There should be a special "grid" of points (represented by 1000 dots) representing where puzzle pieces may go.
* Within the grid, dropping a piece should cause it to self-align with the center.
* Outside of the grid, puzzle pieces should be droppable wherever.
* Panning the puzzlespace should be easy (e.g. click-drag an empty space)
* Also include some pan/zoom controls as buttons
* Mobile gestures should also be supported; pinch-zoom especially would be great
* When a piece is clicked/tapped/dragged/touched, it should get a selection highlight
* When a selection is active, buttons to rotate the piece -90, 180, and +90 degrees should appear too
* Assume all puzzle images are 1344x960 as a simplifying assumption. (Maybe we can auto-detect this later?)
* Ample space should be available outside of the grid to contain all puzzle pieces initially
* There are effectively three largely-independent sizes/scales:
  * Viewport; the physical pixel dimensions of the `jigsaw-puzzle` element
  * Board; the space containing both the grid and some space outside of it for "loose" pieces
  * Puzzle; the dimension of the puzzle, in pieces (e.g. 40x25 for a 1000 piece puzzle)
  * Image; the pixel dimensions of the image used in the puzzle
* Prefer SVG for rendering puzzle pieces and the grid
* Use shaped edges for every piece, and ensure these match each other.

