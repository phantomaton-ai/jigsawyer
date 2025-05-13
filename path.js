// path.js - Utility for generating SVG paths for puzzle pieces with curved edges.

/**
 * Generates an SVG path segment for a single puzzle piece edge using a Cut.
 * The path is generated in the edge's local coordinate system (0,0 at the start of the edge).
 *
 * @param {number} length - The length of the edge (width or height of the piece).
 * @param {import('./cut.js').Cut} cut - The Cut object defining the edge's waviness.
 * @param {boolean} isOutward - Whether the displacement defined by the cut goes 'outward' from the straight edge line.
 * @returns {string} SVG path string segment (starts implicitly from the current point, ends at (length, 0) or (0, length) depending on orientation).
 */
function generateCurvedEdgeSegment(length, cut, isOutward) {
    const numPoints = 15; // Number of points to sample along the edge
    const points = [];
    const direction = isOutward ? 1 : -1; // Direction multiplier for displacement

    for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints; // Position along edge (0 to 1)
        
        // The position along the edge (x for horizontal, y for vertical in the edge's local space)
        const position = t * length;
        
        // Sample the cut. The sample is a displacement *perpendicular* to the straight edge line.
        // For a Cut defined over the length of one edge, the sample(t) gives displacement at t.
        const displacement = (cut ? cut.sample(t) : 0) * direction;
        
        // The path segment is generated as if it's a horizontal edge (x, y)
        // where x is the position along the edge, and y is the displacement.
        // We'll transform/orient these points later when assembling the full piece path.
        points.push({ x: position, y: displacement });
    }

    // Convert points to SVG path commands using LineTo for simplicity
    if (points.length === 0) return '';

    let pathSegment = `L ${points[0].x},${points[0].y}`; // Start at the first point
    for (let i = 1; i < points.length; i++) {
        pathSegment += ` L ${points[i].x},${points[i].y}`;
    }

    return pathSegment;
}


/**
 * Generates a complete SVG path 'd' string for a single puzzle piece, including curved edges.
 * The path is generated in the piece's local coordinate system (0,0 at the top-left corner).
 *
 * @param {import('./piece.js').Piece} piece - The Piece data model instance.
 * @returns {string} The SVG path data string for the piece's outline.
 */
export function generatePiecePath(piece) {
    if (!piece) {
        console.error("Cannot generate piece path, piece data is null.");
        return ""; // Return empty path
    }

    const width = piece.width;
    const height = piece.height;
    const joints = piece.joints;

    // Start path at the top-left corner of the piece's local coordinate system
    let path = 'M 0,0 ';

    // 1. Top Edge (from 0,0 to width,0)
    // This is a horizontal edge. The displacement from the cut is along the Y axis.
    // The path goes from (0,0) to (width,0) in the base rectangle.
    // If there's a top joint with a cut:
    const topJoint = joints?.top;
    if (topJoint?.cut) {
        // Generate segment in its local coord (0,0 to width, displacement along y)
        const segment = generateCurvedEdgeSegment(width, topJoint.cut, topJoint.outward);
        // The segment starts implicitly at (0,0) relative to the M 0,0
        path += segment + ' ';
    } else {
        // Straight line if no joint or no cut
        path += `L ${width},0 `;
    }

    // 2. Right Edge (from width,0 to width,height)
    // This is a vertical edge. The displacement from the cut is along the X axis.
    // The base rectangle path goes from (width,0) to (width,height).
    const rightJoint = joints?.right;
    if (rightJoint?.cut) {
        // Generate segment in its local coord (0,0 to height, displacement along x)
        const segment = generateCurvedEdgeSegment(height, rightJoint.cut, rightJoint.outward);
        // This segment needs to be translated and rotated to align with the right edge.
        // It should start at (width, 0) and end at (width, height).
        // A point (x_local, y_local) in the segment (where x_local is displacement, y_local is position along edge)
        // corresponds to a point (width + x_local, y_local) in the piece's coordinate system.
         const transformedSegment = segment.replace(/L (\d+\.?\d*),(\d+\.?\d*)/g,
             (match, x_local_str, y_local_str) => {
                 const x_local = parseFloat(x_local_str); // Displacement along X (local to segment)
                 const y_local = parseFloat(y_local_str); // Position along Y (local to segment)
                 // For a vertical edge (originally generated as horizontal (pos, disp)):
                 // x_world = width + displacement * direction (displacement is x_local here)
                 // y_world = position along edge (y_local here)
                 return `L ${width + x_local},${y_local}`;
             }
         );
        path += transformedSegment + ' ';
    } else {
        // Straight line
        path += `L ${width},${height} `;
    }

    // 3. Bottom Edge (from width,height to 0,height)
    // This is a horizontal edge, traversed from right to left. Displacement is along Y.
    // The base rectangle path goes from (width,height) to (0,height).
    const bottomJoint = joints?.bottom;
    if (bottomJoint?.cut) {
        // Generate segment in its local coord (0,0 to width, displacement along y)
        const segment = generateCurvedEdgeSegment(width, bottomJoint.cut, bottomJoint.outward);
        // This segment needs to be translated and flipped horizontally to align.
        // It starts implicitly at (width, height) and ends at (0, height).
        // A point (x_local, y_local) in the segment (where x_local is position, y_local is displacement)
        // corresponds to a point (width - x_local, height + y_local) in the piece's coordinate system.
        const transformedSegment = segment.replace(/L (\d+\.?\d*),(\d+\.?\d*)/g,
             (match, x_local_str, y_local_str) => {
                 const x_local = parseFloat(x_local_str); // Position along X (local to segment)
                 const y_local = parseFloat(y_local_str); // Displacement along Y (local to segment)
                 // For a horizontal edge traversed reverse (originally generated as (pos, disp)):
                 // x_world = width - position (x_local here)
                 // y_world = height + displacement * direction (y_local here)
                 return `L ${width - x_local},${height + y_local}`;
             }
        );
        path += transformedSegment + ' ';
    } else {
        // Straight line
        path += `L 0,${height} `;
    }

    // 4. Left Edge (from 0,height to 0,0)
    // This is a vertical edge, traversed from bottom to top. Displacement is along X.
    // The base rectangle path goes from (0,height) to (0,0).
    const leftJoint = joints?.left;
    if (leftJoint?.cut) {
        // Generate segment in its local coord (0,0 to height, displacement along x)
        const segment = generateCurvedEdgeSegment(height, leftJoint.cut, leftJoint.outward);
        // This segment needs to be translated and flipped vertically to align.
        // It starts implicitly at (0, height) and ends at (0, 0).
        // A point (x_local, y_local) in the segment (where x_local is displacement, y_local is position)
        // corresponds to a point (x_local, height - y_local) in the piece's coordinate system.
         const transformedSegment = segment.replace(/L (\d+\.?\d*),(\d+\.?\d*)/g,
             (match, x_local_str, y_local_str) => {
                 const x_local = parseFloat(x_local_str); // Displacement along X (local to segment)
                 const y_local = parseFloat(y_local_str); // Position along Y (local to segment)
                 // For a vertical edge traversed reverse (originally generated as horizontal (disp, pos)):
                 // x_world = displacement * direction (x_local here)
                 // y_world = height - position (y_local here)
                 return `L ${x_local},${height - y_local}`;
             }
         );
        path += transformedSegment + ' ';
    } else {
        // Straight line
        path += `L 0,0 `; // Ends at 0,0
    }

    // Close the path (redundant if last segment ends at 0,0, but good practice)
    path += 'Z';

    return path;
}