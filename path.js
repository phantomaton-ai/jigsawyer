// path.js - Utility for generating SVG paths for puzzle pieces

/**
 * Generates an SVG path string for a puzzle piece edge
 * @param {number} length - The length of the edge
 * @param {boolean} hasNib - Whether this edge has a tab/nib
 * @param {boolean} isOutward - Whether the nib protrudes outward (true) or inward (false)
 * @param {number} nibSize - Size of the nib as a ratio of edge length (typically 0.15-0.33)
 * @param {Object} cut - The Cut object defining the edge's waviness
 * @param {function} sampleFn - Optional function to sample the cut at position t
 * @returns {string} SVG path string for this edge
 */
export function generateEdgePath(length, hasNib, isOutward, nibSize, cut, sampleFn) {
    // Default sample function if none provided
    const sample = sampleFn || (cut && ((t) => cut.sample(t))) || ((t) => 0);
    
    // Number of points to generate for the path
    const numPoints = 20;
    
    // Points array starts empty - we'll build it as we go
    const points = [];
    
    // Calculate center point of the edge where the nib will be
    const midPoint = length / 2;
    
    // Nib height - positive value means outward, negative means inward
    const nibHeight = length * (nibSize || 0.25) * (isOutward ? 1 : -1);
    
    // Generate points along the edge
    for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints; // Position along edge (0 to 1)
        const x = t * length; // X position along edge
        
        // Base Y position is 0, modified by:
        // 1. The sample function from the Cut (if provided)
        // 2. The nib shape (a semi-circle around the midpoint)
        let y = 0;
        
        // Add sample function displacement
        if (sample) {
            y += sample(t) || 0; // In case sample returns undefined
        }
        
        // Add nib shape if this edge has one
        if (hasNib) {
            // Distance from the midpoint (0 to 0.5, as proportion of length)
            const distFromMid = Math.abs(x - midPoint) / length;
            
            // Nib function: semi-circular shape centered at midpoint
            // Only apply within the center 40% of the edge
            if (distFromMid < 0.2) {
                // Semi-circle: sqrt(r² - (x-midPoint)²)
                // Where r = 0.2 * length (radius of semi-circle)
                const nibRadius = 0.2 * length;
                const nibEffect = Math.sqrt(Math.max(0, nibRadius*nibRadius - Math.pow(x - midPoint, 2)));
                
                // Apply the nib displacement - direction based on isOutward
                y += nibHeight * (nibEffect / nibRadius);
            }
        }
        
        points.push([x, y]);
    }
    
    // Convert points to SVG path string
    // Using relative commands for better compressibility
    let path = `M ${points[0][0]},${points[0][1]}`;
    
    // Add cubic spline segments
    for (let i = 1; i < points.length; i += 3) {
        // For each group of 3 points, create a smooth curve
        // If we don't have enough points left, just use line segments
        if (i + 2 < points.length) {
            const p0 = points[i - 1];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[i + 2];
            
            // Calculate control points for smooth curve
            // Simple method: use points directly as control points
            path += ` C ${p1[0]},${p1[1]} ${p2[0]},${p2[1]} ${p3[0]},${p3[1]}`;
        } else {
            // Not enough points for cubic, use line
            path += ` L ${points[i][0]},${points[i][1]}`;
        }
    }
    
    return path;
}

/**
 * Generates a complete SVG path for a puzzle piece with the given properties
 * @param {number} width - Piece width
 * @param {number} height - Piece height
 * @param {Object} joints - Object with top, right, bottom, left joints
 * @returns {string} SVG path string for the complete piece
 */
export function generatePiecePath(width, height, joints) {
    if (!width || !height) {
        return `M 0 0 H ${width || 100} V ${height || 100} H 0 Z`;
    }
    
    // Start path at top-left corner
    let path = 'M 0 0 ';
    
    // Add top edge (left to right)
    if (joints && joints.top) {
        const isOutward = joints.top.outward;
        const nibSize = joints.top.size || 0.25;
        path += generateEdgePath(width, true, isOutward, nibSize, joints.top.cut, 
            t => joints.top.cut ? joints.top.cut.sample(t) : 0);
    } else {
        path += `H ${width}`;
    }
    
    // Add right edge (top to bottom)
    if (joints && joints.right) {
        // For vertical edges we need to rotate our coordinate system
        // We're moving from (width,0) to (width,height)
        const pathSegment = generateEdgePath(height, true, joints.right.outward, 
            joints.right.size || 0.25, joints.right.cut,
            t => joints.right.cut ? joints.right.cut.sample(t) : 0);
            
        // Transform the path segment to go downward
        path += ` ${transformPath(pathSegment, { rotate: 90, translateX: width, translateY: 0 })}`;
    } else {
        path += ` V ${height}`;
    }
    
    // Add bottom edge (right to left)
    if (joints && joints.bottom) {
        // Bottom edge goes from right to left, so we need to flip direction
        const pathSegment = generateEdgePath(width, true, joints.bottom.outward, 
            joints.bottom.size || 0.25, joints.bottom.cut,
            t => joints.bottom.cut ? joints.bottom.cut.sample(t) : 0);
            
        // Transform the path segment to go left from bottom-right
        path += ` ${transformPath(pathSegment, { rotate: 180, translateX: width, translateY: height })}`;
    } else {
        path += ` H 0`;
    }
    
    // Add left edge (bottom to top)
    if (joints && joints.left) {
        // Left edge goes from bottom to top
        const pathSegment = generateEdgePath(height, true, joints.left.outward, 
            joints.left.size || 0.25, joints.left.cut,
            t => joints.left.cut ? joints.left.cut.sample(t) : 0);
            
        // Transform the path segment to go upward from bottom-left
        path += ` ${transformPath(pathSegment, { rotate: 270, translateX: 0, translateY: height })}`;
    } else {
        path += ` V 0`;
    }
    
    // Close the path
    path += ' Z';
    
    return path;
}

/**
 * Transforms an SVG path by rotating and translating it
 * @param {string} pathStr - The original SVG path string
 * @param {Object} transform - Contains rotate (degrees), translateX, translateY
 * @returns {string} Transformed path string
 */
function transformPath(pathStr, transform) {
    // This is a simplistic implementation that assumes the path starts with "M x,y"
    // A more robust implementation would parse and transform each path command
    
    // For now, we'll return a simple placeholder
    // In a real implementation, we'd parse the path, apply the transformation
    // matrix to each point, and rebuild the path string
    
    const { rotate = 0, translateX = 0, translateY = 0 } = transform;
    
    // For our simple case, we can use SVG transforms directly
    // Just make sure the transformed path connects properly to the main path
    
    if (pathStr.startsWith('M 0,0')) {
        // If the path starts at the origin, we can just return the rest
        // after transforming based on the rotation direction
        
        const pathWithoutStart = pathStr.substring(5).trim();
        
        if (rotate === 90) {
            return `V ${translateY} ${pathWithoutStart}`;
        } else if (rotate === 180) {
            return `H ${translateX} ${pathWithoutStart}`;
        } else if (rotate === 270) {
            return `V ${translateY} ${pathWithoutStart}`;
        } else {
            return pathWithoutStart;
        }
    }
    
    // Fallback to a direct line if we can't transform properly
    if (rotate === 90) {
        return `V ${height}`;
    } else if (rotate === 180) {
        return `H 0`;
    } else if (rotate === 270) {
        return `V 0`;
    } else {
        return `H ${width}`;
    }
}