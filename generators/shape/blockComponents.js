// constants, for all blocks
export const BLOCK_HEIGHT = 6;
export const BLOCK_WIDTH = 10;
export const CORNER_RADIUS = 0.5;
export const NOTCH_RADIUS = 0.25;
export const LOOP_OFFSET = 2;
export const STROKE_WIDTH = 0.25;
const NOTCH_CONNECT_X = 4;

export function branch(colors, sizes, top, bottom) {
    // Initialize with points and snapPoints arrays
    const finalShape = {points: [], snapPoints: [], ...footer(colors)};

    // This block is from your original code.
    if (sizes.length === 1) {
        if (top === 'notch') {
            finalShape.points.push(
                {x: 0, y: 0, cornerRadius: CORNER_RADIUS},
                ...notch(0, 0, true),
            );
            // Add the female snap point for the top notch
            finalShape.snapPoints.push({ x: NOTCH_CONNECT_X, y: 0, type: 'block', role: 'female' });
        } else if (top === 'hat') {
            finalShape.points.push(
                {x: 0, y: 0, cornerRadius: CORNER_RADIUS},
                ...hat(0, 0),
            );
        } else if (top === 'flat') {
            finalShape.points.push(
                {x: 0, y: 0, cornerRadius: CORNER_RADIUS},
            );
        }
    }
    let finalOffset = 0;
  
    // This is your original loop for multi-branch blocks.
    for (let i = 0; i < sizes.length-1; i++) {
      let shape = []; // Changed from `let shape;` to avoid potential errors
      const size = sizes[i];
      const dHeight = size.height * BLOCK_HEIGHT;
      const dWidth = size.width * BLOCK_WIDTH;
      const bHeight = size.loop.height * BLOCK_HEIGHT;
  
      let offset = 0;
      for (let j = 0; j < i; j++) {
        offset += (sizes[j].height + sizes[j].loop.height) * BLOCK_HEIGHT;
      }
  
      if (i === 0) {
        if (top === 'notch') {
            shape = [
                {x: 0, y: 0 + offset, cornerRadius: CORNER_RADIUS},
                ...notch(0, 0 + offset, true),
                ...block(0, dWidth, dHeight),
                ...loop(0 + offset+dHeight, bHeight),
            ];
            // Add the female snap point for the top notch (only on the first branch)
            finalShape.snapPoints.push({ x: NOTCH_CONNECT_X, y: 0, type: 'block', role: 'female' });
        } else if (top === 'hat') {
            shape = [
                {x: 0, y: 0 + offset, cornerRadius: CORNER_RADIUS},
                ...hat(0, 0 + offset, true),
                ...block(0, dWidth, dHeight),
                ...loop(0 + offset+dHeight, bHeight),
            ];
        } else if (top === 'flat') {
            shape = [
                {x: 0, y: 0 + offset, cornerRadius: CORNER_RADIUS},
                ...block(0, dWidth, dHeight),
                ...loop(0 + offset+dHeight, bHeight),
            ];
        }
      } else {
        shape = [
          ...block(offset, dWidth, dHeight),
          ...loop(0 + offset+dHeight, bHeight),
        ];
      }
      
      // Add snap points for the C-shaped loop
      // A male snap point inside the loop to connect a nested stack.
      finalShape.snapPoints.push({ x: LOOP_OFFSET + NOTCH_CONNECT_X, y: offset + dHeight, type: 'block', role: 'male' });
      // A female snap point below the loop for the next branch in this stack.
      finalShape.snapPoints.push({ x: NOTCH_CONNECT_X, y: offset + dHeight + bHeight, type: 'block', role: 'female' });
  
      finalShape.points.push(...shape);
      finalOffset = offset + dHeight + bHeight;
    }

    // This is your original logic for the last branch in the stack.
    let lastShape = [];
    let dHeight = sizes[sizes.length-1].height * BLOCK_HEIGHT;
    let dWidth = sizes[sizes.length-1].width * BLOCK_WIDTH;
    if (bottom === 'notch') {
        lastShape = [
            ...block(finalOffset, dWidth, dHeight),
            ...notch(0, 0 + finalOffset+dHeight, false),
            {x: 0, y: 0 + finalOffset+dHeight, cornerRadius: CORNER_RADIUS},
        ];
        // Add the male snap point for the bottom notch
        finalShape.snapPoints.push({ x: NOTCH_CONNECT_X, y: finalOffset + dHeight, type: 'block', role: 'male' });
    } else if (bottom === 'flat') {
        lastShape = [
            ...block(finalOffset, dWidth, dHeight),
            {x: 0, y: 0 + finalOffset+dHeight, cornerRadius: CORNER_RADIUS},
        ];
    }
    finalShape.points.push(...lastShape);
  
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
    if (inverted == true) {
        return [
            {x: 2+x, y: 0+y, cornerRadius: NOTCH_RADIUS},
            {x: 3+x, y: 1+y, cornerRadius: NOTCH_RADIUS},
            {x: 5+x, y: 1+y, cornerRadius: NOTCH_RADIUS},
            {x: 6+x, y: 0+y, cornerRadius: NOTCH_RADIUS}
        ];
    } else {
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
        {x: 3+x, y: -1-y, cornerRadius: 5},
        {x: 7+x, y: -1-y, cornerRadius: 5},
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