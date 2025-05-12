import { expect } from 'lovecraft'; // Assuming lovecraft is set up
import 'jsdom-global/register.js';
import './jigsawyer.js'; // Import the component to register it

describe('JigsawPuzzle Component 🧩👻', () => {
    let element;
    let container;

    beforeEach(async () => {
        container = document.createElement('div');
        document.body.appendChild(container);

        element = document.createElement('jigsaw-puzzle');
        // Ensure connectedCallback fires and component initializes by appending.
        // We might need to wait for async operations like image loading in more complex tests.
    });

    afterEach(() => {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        element = null;
        container = null;
    });

    it('should register the custom element "jigsaw-puzzle" 🏷️', () => {
        container.appendChild(element); // Append to trigger connectedCallback
        expect(customElements.get('jigsaw-puzzle')).to.not.be.undefined;
        const instance = document.createElement('jigsaw-puzzle');
        expect(instance).to.be.instanceOf(HTMLElement); // More specifically, should be JigsawPuzzle class
        expect(instance.constructor.name).to.equal('JigsawPuzzle');
    });

    it('should have a shadowRoot 🌳', () => {
        container.appendChild(element);
        expect(element.shadowRoot).to.exist;
    });

    it('should initialize with default pieceCount if "size" attribute is not provided or invalid 🤔', (done) => {
        container.appendChild(element);
        // Need to wait for potential async attributeChangedCallback or connectedCallback logic
        setTimeout(() => {
            expect(element.pieceCount).to.equal(1000); // Default size from constructor/connectedCallback
            done();
        }, 0); // Allow microtask queue to clear
    });

    it('should set pieceCount based on "size" attribute 🔢', (done) => {
        element.setAttribute('size', '200');
        container.appendChild(element);
        setTimeout(() => {
            expect(element.pieceCount).to.equal(200);
            done();
        }, 0);
    });

    it('should attempt to load image when "src" attribute is set 🖼️', (done) => {
        // Mock Image.prototype.onload or check console for messages (harder to test reliably without true mocks)
        // For now, let's check if _loadImage is called or if _img src is set
        const consoleSpy = sinon.spy(console, 'log'); // Assuming Sinon.JS is available via lovecraft/test setup
        
        element.setAttribute('src', 'test-image.png'); // Use a dummy path
        container.appendChild(element);

        setTimeout(() => {
            expect(element._img).to.exist;
            expect(element._img.src).to.include('test-image.png');
            // Check if _loadImage was called (indirectly by checking _img.src)
            // A more robust test would spy on _loadImage method itself or check for specific console logs.
            expect(consoleSpy.calledWith(sinon.match(/Image test-image.png loaded successfully!/))).to.be.false; // It will likely fail to load, but attempt should be made.
            expect(consoleSpy.calledWith(sinon.match(/Failed to load image: test-image.png/))).to.be.true; // More likely outcome
            
            consoleSpy.restore();
            done();
        }, 50); // Allow image load attempt (it will fail, quickly)
    });

    it('should create basic shadow DOM structure upon connection 🏗️', (done) => {
        container.appendChild(element);
        setTimeout(() => {
            const shadow = element.shadowRoot;
            expect(shadow.getElementById('puzzle-area')).to.exist;
            expect(shadow.getElementById('puzzle-canvas')).to.exist;
            expect(shadow.getElementById('controls-container')).to.exist;
            expect(shadow.getElementById('piece-rotation-controls')).to.exist;
            done();
        }, 0);
    });

    it('should have pan and zoom buttons in the controls container 🕹️', (done) => {
        container.appendChild(element);
        setTimeout(() => {
            const controls = element.shadowRoot.getElementById('controls-container');
            expect(controls.querySelector('#pan-left')).to.exist;
            expect(controls.querySelector('#pan-right')).to.exist;
            expect(controls.querySelector('#pan-up')).to.exist;
            expect(controls.querySelector('#pan-down')).to.exist;
            expect(controls.querySelector('#zoom-in')).to.exist;
            expect(controls.querySelector('#zoom-out')).to.exist;
            done();
        }, 0);
    });

    it('should have rotation buttons (initially hidden) 🔄', (done) => {
        container.appendChild(element);
        setTimeout(() => {
            const rotationControls = element.shadowRoot.getElementById('piece-rotation-controls');
            expect(rotationControls).to.exist;
            expect(rotationControls.style.display).to.equal('none'); // Initially hidden
            expect(rotationControls.querySelector('#rotate-neg-90')).to.exist;
            expect(rotationControls.querySelector('#rotate-180')).to.exist;
            expect(rotationControls.querySelector('#rotate-pos-90')).to.exist;
            done();
        }, 0);
    });

    describe('Piece Generation (requires image load)', () => {
        let realImageOnload;
        let realImageOnerror;
        let imageLoadSuccess = true;

        before(() => {
            // Crude mock for Image loading, assuming tests run in an env where Image exists
            realImageOnload = Object.getOwnPropertyDescriptor(Image.prototype, 'onload');
            realImageOnerror = Object.getOwnPropertyDescriptor(Image.prototype, 'onerror');

            Object.defineProperty(Image.prototype, 'onload', {
                configurable: true,
                set: function(fn) {
                    this._onloadfn = fn;
                    if (imageLoadSuccess && this.src) { // Trigger onload almost immediately if src is set
                        setTimeout(() => {
                            // Simulate minimal image properties
                            Object.defineProperty(this, 'complete', { value: true, configurable: true });
                            Object.defineProperty(this, 'width', { value: 1344, configurable: true }); // Use assumed dimensions
                            Object.defineProperty(this, 'height', { value: 960, configurable: true });
                            if (this._onloadfn) this._onloadfn();
                        }, 0);
                    }
                },
                get: function() { return this._onloadfn; }
            });
            Object.defineProperty(Image.prototype, 'onerror', {
                configurable: true,
                set: function(fn) {
                    this._onerrorfn = fn;
                     if (!imageLoadSuccess && this.src) {
                        setTimeout(() => {
                            if (this._onerrorfn) this._onerrorfn();
                        }, 0);
                    }
                },
                get: function() { return this._onerrorfn; }
            });
        });

        after(() => {
            // Restore original Image properties
            if (realImageOnload) Object.defineProperty(Image.prototype, 'onload', realImageOnload);
            if (realImageOnerror) Object.defineProperty(Image.prototype, 'onerror', realImageOnerror);
        });
        
        beforeEach(() => {
            imageLoadSuccess = true; // Default to successful load for these tests
        });

        it('should generate pieces after image loads successfully 🧩✨', (done) => {
            element.setAttribute('src', 'mock-image.png');
            element.setAttribute('size', '10'); // Small number for easier testing
            container.appendChild(element);

            // Wait for image mock onload and subsequent piece generation
            setTimeout(() => {
                expect(element._pieces.length).to.equal(10);
                const puzzleArea = element.shadowRoot.getElementById('puzzle-area');
                expect(puzzleArea.children.length).to.equal(10);
                expect(puzzleArea.children[0].classList.contains('puzzle-piece')).to.be.true;
                done();
            }, 50); // Give a bit more time for async operations
        });

        it('should assign random positions and rotations to pieces initially 🎲', (done) => {
            element.setAttribute('src', 'mock-image.png');
            element.setAttribute('size', '5');
            container.appendChild(element);

            setTimeout(() => {
                expect(element._pieces.length).to.equal(5);
                let differentPositions = false;
                let differentRotations = false;
                const firstX = element._pieces[0].x;
                const firstRotation = element._pieces[0].rotation;

                for (let i = 1; i < element._pieces.length; i++) {
                    if (element._pieces[i].x !== firstX) differentPositions = true;
                    if (element._pieces[i].rotation !== firstRotation) differentRotations = true;
                    expect(element._pieces[i].rotation % 90).to.equal(0); // Rotations are multiples of 90
                }
                // It's statistically very likely they are different, but not guaranteed for small N
                // A better check would be that positions are within bounds.
                expect(differentPositions || element._pieces.length <= 1).to.be.true; // Or all ended up same (unlikely)
                // For rotations, it's also possible they all end up the same.
                // This test is more of a sanity check.
                done();
            }, 50);
        });
    });

    // TODO: Add tests for:
    // - Panning (buttons and mouse/touch)
    // - Zooming (buttons, wheel, pinch)
    // - Piece selection and deselection
    // - Piece dragging and dropping
    // - Piece rotation controls visibility and functionality
    // - Snapping logic
    // - Win condition
    // - Edge cases for attribute values
});

// If lovecraft needs an explicit boot and test runner isn't handling it:
// boot(); 
// Or usually, the test runner (e.g., via package.json script) handles this.
