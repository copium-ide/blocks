// constants, for all blocks
export const BLOCK_HEIGHT = 6;
export const BLOCK_WIDTH = 10;
export const CORNER_RADIUS = 0.5;
export const NOTCH_RADIUS = 0.25;
export const LOOP_OFFSET = 2;
export const STROKE_WIDTH = 0.25;
const NOTCH_CONNECT_X = 4;

export function branch(colors, sizes, top, bottom) {
    const finalShape = {points: [], snapPoints: [], ...footer(colors)};
    let finalOffset = 0;

    // 1. Custom Snap Points: Helper function to add custom points for a given branch.
    const addCustomSnaps = (branchIndex, yOffset) => {
        const size = sizes[branchIndex];
        if (size.customSnapPoints && Array.isArray(size.customSnapPoints)) {
            // Y position is vertically centered on the main part of the branch.
            const yPos = yOffset + (size.height * BLOCK_HEIGHT / 2);
            size.customSnapPoints.forEach(customPoint => {
                finalShape.snapPoints.push({
                    x: customPoint.x,
                    y: yPos,
                    type: customPoint.type,
                    role: 'male',
                    name: customPoint.name
                });
            });
        }
    };

    // This block is for single-branch blocks.
    if (sizes.length === 1) {
        if (top === 'notch') {
            finalShape.points.push(
                {x: 0, y: 0, cornerRadius: CORNER_RADIUS},
                ...notch(0, 0, true),
            );
            finalShape.snapPoints.push({ x: NOTCH_CONNECT_X, y: 0, type: 'block', role: 'female', name: 'top'});
        } else if (top === 'hat') {
            finalShape.points.push(
                {x: 0, y: 0, cornerRadius: CORNER_RADIUS*4}
            );
        } else if (top === 'flat') {
            finalShape.points.push(
                {x: 0, y: 0, cornerRadius: CORNER_RADIUS},
            );
        }
        addCustomSnaps(0, 0); // Add custom snaps for the only branch
    }
  
    // This is the loop for multi-branch blocks.
    for (let i = 0; i < sizes.length-1; i++) {
      let shape = [];
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
            finalShape.snapPoints.push({ x: NOTCH_CONNECT_X, y: 0, type: 'block', role: 'female', name: 'top'});
        } else if (top === 'hat') {
            shape = [
                {x: 0, y: 0 + offset, cornerRadius: CORNER_RADIUS*4},
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
      
      addCustomSnaps(i, offset); // Add custom snaps for the current branch
      finalShape.snapPoints.push({ x: LOOP_OFFSET + NOTCH_CONNECT_X, y: offset + dHeight, type: 'block', role: 'male', name: 'topInner'+i});
  
      finalShape.points.push(...shape);
      finalOffset = offset + dHeight + bHeight;
    }

    // This is the logic for the last branch in the stack.
    let lastShape = [];
    let dHeight = sizes[sizes.length-1].height * BLOCK_HEIGHT;
    let dWidth = sizes[sizes.length-1].width * BLOCK_WIDTH;
    
    addCustomSnaps(sizes.length - 1, finalOffset); // Add custom snaps for the last branch

    if (bottom === 'notch') {
        lastShape = [
            ...block(finalOffset, dWidth, dHeight),
            ...notch(0, 0 + finalOffset+dHeight, false),
            {x: 0, y: 0 + finalOffset+dHeight, cornerRadius: CORNER_RADIUS},
        ];
        finalShape.snapPoints.push({ x: NOTCH_CONNECT_X, y: finalOffset + dHeight, type: 'block', role: 'male', name: 'bottom'});
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
            {x: 5+x, y: 1+y, cornerRadius: NOTCH_RADIUS},
            {x: 3+x, y: 1+y, cornerRadius: NOTCH_RADIUS},
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