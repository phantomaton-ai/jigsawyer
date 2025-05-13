// path.js - Utility for generating SVG paths for puzzle pieces with curvy edges

/**
 * Generates a curved edge path for a puzzle piece
 * @param {number} length - Length of the edge (width or height)
 * @param {boolean} isVertical - Whether this is a vertical edge (true) or horizontal (false)
 * @param {boolean} isReversed - Whether to traverse the edge in reverse direction
 * @param {Object} cut - The Cut object with a sample() method
 * @param {number} pieceX - X position of the piece in the board
 * @param {number} pieceY - Y position of the piece in the board
 * @returns {string} SVG path segment (without the initial M command)
 */
export function generateEdgePath(length, isVertical, isReversed, cut, pieceX, pieceY) {
    // Default values
    length = length || 100;
    const numPoints = 10; // Number of points to sample along the edge
    
    // Function to sample the cut at position t (0 to 1 along the edge)
    // If no cut is provided, return a flat edge
    const sampleCut = (t) => {
        if (!cut) return 0;
        
        try {
            // Get displacement from the cut
            // Need to adjust t based on piece position for continuous cuts
            let adjustedT = t;
            if (isVertical) {
                // For vertical edges, t is relative to the piece's top-left
                // We need to adjust by the piece's Y position in the board
                adjustedT = (pieceY + t * length) / (pieceY + length);
            } else {
                // For horizontal edges, adjust by X position
                adjustedT = (pieceX + t * length) / (pieceX + length);
            }
            
            return cut.sample(adjustedT) || 0;
        } catch (e) {
            console.error("Error sampling cut:", e);
            return 0;
        }
    };
    
    // Points array - will hold [x, y] coordinates
    const points = [];
    
    // Generate points along the edge
    for (let i = 0; i <= numPoints; i++) {
        let t = i / numPoints; // Position along edge (0 to 1)
        
        // Reverse direction if needed
        if (isReversed) {
            t = 1 - t;
        }
        
        // Sample the cut to get displacement
        const displacement = sampleCut(t);
        
        // Calculate actual x,y coordinates based on edge orientation
        let x, y;
        if (isVertical) {
            // For vertical edges:
            // X is displacement, Y is position along edge
            x = displacement;
            y = t * length;
        } else {
            // For horizontal edges:
            // X is position along edge, Y is displacement
            x = t * length;
            y = displacement;
        }
        
        points.push([x, y]);
    }
    
    // Convert points to SVG path commands
    // (skip the initial M command - caller will provide it)
    if (points.length === 0) {
        return isVertical ? `V ${length}` : `H ${length}`;
    }
    
    // Use lineTo for first point (from the starting position)
    let path = `L ${points[0][0]},${points[0][1]}`;
    
    // Use quadratic curves for smoother transitions between points
    for (let i = 1; i < points.length; i++) {
        path += ` L ${points[i][0]},${points[i][1]}`;
    }
    
    return path;
}

/**
 * Generates a complete SVG path for a puzzle piece with curved edges
 * @param {number} width - Width of the piece
 * @param {number} height - Height of the piece
 * @param {Object} piece - Piece data with position and joints information
 * @returns {string} Complete SVG path string for the piece shape
 */
export function generatePiecePath(width, height, piece) {
    // Default dimensions
    width = width || 100;
    height = height || 100;
    
    // Extract piece position and joints
    const pieceX = piece?.origination?.x || 0;
    const pieceY = piece?.origination?.y || 0;
    const joints = piece?.joints;
    
    // Start path at top-left corner
    let path = `M 0,0`;
    
    // Top edge (left to right)
    if (joints?.top?.cut) {
        path += ' ' + generateEdgePath(
            width,               // length
            false,               // isVertical (horizontal)
            false,               // isReversed 
            joints.top.cut,      // cut object
            pieceX,              // piece X position
            pieceY               // piece Y position
        );
    } else {
        path += ` H ${width}`;   // Straight line if no cut
    }
    
    // Right edge (top to bottom)
    if (joints?.right?.cut) {
        // Need to convert the right edge path:
        // 1. Start point is now (width, 0)
        // 2. Horizontal displacements now go right from the edge
        const rightPath = generateEdgePath(
            height,               // length
            true,                 // isVertical
            false,                // isReversed
            joints.right.cut,     // cut object
            pieceX + width,       // right edge X position
            pieceY                // piece Y position
        );
        
        // The rightPath starts at current point (width, 0) already
        // We need to transform x coordinates: x -> width + x
        const transformedPath = rightPath.replace(/L (\d+\.?\d*),(\d+\.?\d*)/g, 
                               (match, x, y) => `L ${Number(width) + Number(x)},${y}`);
        
        path += ' ' + transformedPath;
    } else {
        path += ` V ${height}`;   // Straight line if no cut
    }
    
    // Bottom edge (right to left)
    if (joints?.bottom?.cut) {
        // Need to convert the bottom edge path:
        // 1. Start point is now (width, height)
        // 2. Move right to left (reverse)
        // 3. Y displacements go down from the bottom edge
        const bottomPath = generateEdgePath(
            width,                // length
            false,                // isVertical (horizontal)
            true,                 // isReversed (right to left)
            joints.bottom.cut,    // cut object
            pieceX,               // piece X position 
            pieceY + height       // bottom edge Y position
        );
        
        // Transform: 
        // 1. x -> width - x (for reverse direction)
        // 2. y -> height + y (for downward displacement)
        const transformedPath = bottomPath.replace(/L (\d+\.?\d*),(\d+\.?\d*)/g, 
                              (match, x, y) => `L ${width - Number(x)},${Number(height) + Number(y)}`);
        
        path += ' ' + transformedPath;
    } else {
        path += ` H 0`;           // Straight line if no cut
    }
    
    // Left edge (bottom to top)
    if (joints?.left?.cut) {
        // Need to convert the left edge path:
        // 1. Start point is now (0, height)
        // 2. Move bottom to top (reverse)
        // 3. X displacements go left from the edge
        const leftPath = generateEdgePath(
            height,               // length
            true,                 // isVertical
            true,                 // isReversed (bottom to top)
            joints.left.cut,      // cut object
            pieceX,               // left edge X position
            pieceY                // piece Y position
        );
        
        // Transform:
        // 1. y -> height - y (for reverse direction)
        // 2. x -> x (x is already negative displacement from left edge)
        const transformedPath = leftPath.replace(/L (\d+\.?\d*),(\d+\.?\d*)/g, 
                             (match, x, y) => `L ${Number(x)},${Number(height) - Number(y)}`);
        
        path += ' ' + transformedPath;
    } else {
        path += ` V 0`;           // Straight line if no cut
    }
    
    // Close the path
    path += ' Z';
    
    return path;
}