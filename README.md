# Jigsawyer 🧩🤖⚙️

**Phantomaton's Fantastically Fiddly Jigsaw Puzzle Component!**

`jigsawyer` is a spooky-fun web component that allows you to embed jigsaw puzzles directly into your web pages. It's designed to be easy to use, moderately infuriating for the easily distracted, and a delight for those who enjoy a bit of digital disarray! 🤪

## 🌟 Features

*   **Web Component Based**: Simply drop `<jigsaw-puzzle src="your-image.png" size="1000"></jigsaw-puzzle>` into your HTML!
*   **Customizable Piece Count**: Specify the number of pieces for varying levels of delightful difficulty! 💯➡️🤯
*   **Randomized Pieces**: Each puzzle starts with pieces scattered and rotated randomly – a fresh challenge every time! 🎲🔄
*   **Interactive Drag & Drop**: Click and drag pieces around the canvas.
*   **Selection Highlight**: Selected pieces glow with a spooky aura! ✨👻
*   **Piece Rotation**: Rotate selected pieces by -90°, 180°, or +90° with handy on-screen buttons! ↩️↪️🔄
*   **Snap-to-Grid**: Pieces snap into their correct final positions when placed accurately (and correctly rotated!). 🧲✅
*   **Panning**: Click and drag an empty area to pan the puzzle view. 🖐️↔️↕️
*   **Zooming**: Zoom in and out using buttons, mouse wheel, or pinch gestures on touch devices! ➕➖🔍🤏
*   **Touch Friendly**: Basic touch gestures for dragging, panning, and pinch-zooming. 📱👆
*   **Win Condition**: Get a celebratory message when all pieces are correctly placed! 🎉🏆🥳
*   **Public Domain Friendly**: We love not paying for things! (Though you provide the image! 😉)

## 🛠️ Usage

1.  **Include the Script**:
    Add the `jigsawyer.js` script to your HTML file. Make sure it's loaded as a module.
    ```html
    <script type="module" src="jigsawyer.js"></script>
    ```

2.  **Add the Component**:
    Place the `jigsaw-puzzle` element in your HTML, providing the `src` for the puzzle image and an optional `size` for the number of pieces (defaults to 1000).
    ```html
    <jigsaw-puzzle src="example.png" size="500"></jigsaw-puzzle>
    ```

    ⚠️ **Important**: You need to provide an image file (e.g., `example.png`) at the specified `src` path. The component currently assumes an image size of **1344x960 pixels** for piece calculation.

3.  **Style (Optional)**:
    The component comes with some default styling, but you can style the `<jigsaw-puzzle>` element itself (e.g., border, size of the container if you wish to constrain it differently than the image).

    ```html
    <style>
        jigsaw-puzzle {
            border: 5px solid gold;
            width: 80vw; /* Example: make it responsive */
            height: 60vw; /* Maintain aspect ratio */
            max-width: 1344px; /* Don't exceed original image width */
            max-height: 960px; /* Don't exceed original image height */
        }
    </style>
    ```

## ⚙️ Attributes

*   `src` (required): Path to the image file for the puzzle.
*   `size` (optional): The total number of pieces for the puzzle. Defaults to `1000`.

## 🧑‍💻 Development

To work on `jigsawyer`:

1.  Clone this haunted repository.
2.  Ensure you have a test image (e.g., `example.png` with dimensions 1344x960) in the root directory.
3.  Open `index.html` in your browser to see the component in action.
4.  Tests are written using `lovecraft` (or a compatible Mocha/Chai setup). You'll need to have `lovecraft` or equivalent testing tools installed. See `jigsawyer.test.js`.

    ```bash
    # Example of how tests might be run (you'll need a test runner)
    # npm install --save-dev lovecraft (or mocha, chai, sinon)
    # npm test 
    ```
    (A `package.json` would define this more formally.)

## 👻 Known Quirks & Future Phantoms 🔮

*   Currently assumes a fixed image input size (1344x960). Future versions might auto-detect this!
*   Piece shapes are simple rectangles. True interlocking jigsaw piece shapes would be a delightfully complex upgrade! 🧩
*   Performance for *very* large numbers of pieces (e.g., >2000) might get spooky. 🐢
*   Accessibility (ARIA attributes, keyboard navigation) could be improved for our less able-bodied idiots. ❤️

Let the puzzling commence! May your imagination come into being... one piece at a time! 🧠➡️🧩

---
*Phantomaton Studios - We Make Fun Until You're Dumb!™* 🤪