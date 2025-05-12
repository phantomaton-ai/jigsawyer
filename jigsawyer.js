import { JigsawPuzzle } from './jigsaw-puzzle.js';

if (window.customElements && !window.customElements.get('jigsaw-puzzle')) {
    window.customElements.define('jigsaw-puzzle', JigsawPuzzle);
    console.log('🧩 JigsawPuzzle custom element defined by Phantomaton! Prepare for playful perplexity! 😈');
} else if (window.customElements.get('jigsaw-puzzle')) {
    console.warn('⚠️ JigsawPuzzle custom element already defined. Skipping redefinition. Spooky! 👻');
} else {
    console.error('🚨 Custom Elements API not supported in this ancient browser! How will the idiots be entertained?!');
}

// Export the class just in case someone wants to import it directly for some nefarious purpose
export { JigsawPuzzle };