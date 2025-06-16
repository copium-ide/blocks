// constants, for all blocks
export const BLOCK_HEIGHT = 6;
export const BLOCK_WIDTH = 10;
export const CORNER_RADIUS = 0.5;
export const NOTCH_RADIUS = 0.25;
export const LOOP_OFFSET = 2;
export const STROKE_WIDTH = 0.25;
const NOTCH_CONNECT_X = 4; // The center X-coordinate for notch connections

export function branch(colors, sizes, top, bottom) {
    // The final object includes points for the path and snapPoints for logic.
    const finalShape = {points: [], snapPoints: [], ...footer(colors)};
    
    let currentY = 0;
    let pathPoints = [];

    // --- TOP OF THE BLOCK ---
    if (top === 'notch') {
        // A female snap point at the top of the block.
        finalShape.snapPoints.push({ x: NOTCH_CONNECT_X, y: 0, type: 'block', role: 'female' });
        pathPoints.push({x: 0, y: 0, cornerRadius: CORNER_RADIUS}, ...notch(0, 0, true));
    } else if (top === 'hat') {
        pathPoints.push({x: 0, y: 0, cornerRadius: CORNER_RADIUS}, ...hat(0, 0));
    } else { // 'flat'
        pathPoints.push({x: 0, y: 0, cornerRadius: CORNER_RADIUS});
    }

    // --- MIDDLE BRANCHES AND LOOPS ---
    for (let i = 0; i < sizes.length; i++) {
        const isLastBranch = (i === sizes.length - 1);
        const size = sizes[i];
        const dHeight = size.height * BLOCK_HEIGHT;
        const dWidth = size.width * BLOCK_WIDTH;

        // Main body of the branch.
        pathPoints.push(...block(currentY, dWidth, dHeight));
        currentY += dHeight;

        // Add a loop or the final bottom piece.
        if (isLastBranch) {
            // --- BOTTOM OF THE BLOCK ---
            if (bottom === 'notch') {
                pathPoints.push(...notch(0, currentY, false));
                // A male snap point at the very bottom.
                finalShape.snapPoints.push({ x: NOTCH_CONNECT_X, y: currentY, type: 'block', role: 'male' });
            }
            // Final corner of the entire shape.
            pathPoints.push({x: 0, y: currentY, cornerRadius: CORNER_RADIUS});
        } else { // It's a C-shaped loop for nesting other blocks.
            const bHeight = size.loop.height * BLOCK_HEIGHT;
            pathPoints.push(...loop(currentY, bHeight));

            // A male snap point inside the C-loop.
            finalShape.snapPoints.push({ x: LOOP_OFFSET + NOTCH_CONNECT_X, y: currentY, type: 'block', role: 'male' });
            // A female snap point for the next branch in this stack.
            finalShape.snapPoints.push({ x: NOTCH_CONNECT_X, y: currentY + bHeight, type: 'block', role: 'female' });

            currentY += bHeight;
        }
    }
    
    finalShape.points = pathPoints;
    return finalShape;
}

function loop(offset = 0, h = 0) {
    return [
        ...notch(LOOP_OFFSET, offset, false),
        {x: LOOP_OFFSET, y: offset, cornerRadius: CORNER_RADIUS},
        {x: LOOP_OFFSET, y: h+offset, cornerRadius: CORNER_RADIUS},
        ...notch(LOOP_OFFSET, h+offset, true),
    ];
}

function notch(x = 0, y = 0, inverted = false) {
    if (inverted) { // Top notch (concave)
        return [
            {x: 2+x, y: 0+y, cornerRadius: NOTCH_RADIUS},
            {x: 3+x, y: 1+y, cornerRadius: NOTCH_RADIUS},
            {x: 5+x, y: 1+y, cornerRadius: NOTCH_RADIUS},
            {x: 6+x, y: 0+y, cornerRadius: NOTCH_RADIUS}
        ];
    } else { // Bottom notch (convex)
        return [
            {x: 6+x, y: 0+y, cornerRadius: NOTCH_RADIUS},
            {x: 5+x, y: -1+y, cornerRadius: NOTCH_RADIUS},
            {x: 3+x, y: -1+y, cornerRadius: NOTCH_RADIUS},
            {x: 2+x, y: 0+y, cornerRadius: NOTCH_RADIUS}
        ];
    }
}

function hat(x = 0, y = 0) {
    return [
        {x: 2+x, y: 0+y, cornerRadius: CORNER_RADIUS},
        {x: 3+x, y: -1+y, cornerRadius: 5},
        {x: 7+x, y: -1+y, cornerRadius: 5},
        {x: 8+x, y: 0+y, cornerRadius: CORNER_RADIUS}
    ];
}

function block(offset = 0, w = BLOCK_WIDTH, h = BLOCK_HEIGHT) {
    return [
        {x: w, y: offset, cornerRadius: CORNER_RADIUS},
        {x: w, y: h+offset, cornerRadius: CORNER_RADIUS},
    ]
}

function footer(colors) {
    return {
        fill: colors.inner,
        stroke: colors.outer,
        strokeWidth: STROKE_WIDTH,
        strokeLinejoin: "round",
        closePath: true
    };
}