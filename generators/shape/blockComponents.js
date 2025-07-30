import * as constants from './constants.js';

export function branch(colors, sizes, top, bottom) {
    const finalShape = {points: [], snapPoints: [], ...footer(colors)};
    let finalOffset = 0;

    // 1. Custom Snap Points: Helper function to add custom points for a given branch.
    const addCustomSnaps = (branchIndex, yOffset) => {
        const size = sizes[branchIndex];
        if (size.customSnapPoints && Array.isArray(size.customSnapPoints)) {
            const branchWidth = size.width * constants.BLOCK_WIDTH;
            const branchHeight = size.height * constants.BLOCK_HEIGHT;

            size.customSnapPoints.forEach(customPoint => {
                let xPos = customPoint.x;
                if (xPos === 'center') {
                    xPos = branchWidth / 2;
                }

                // Default to vertical center of the branch's main part.
                // Allow override via customPoint.y
                let yPos = yOffset + (branchHeight / 2);
                if (customPoint.y !== undefined) {
                     if (customPoint.y === 'center') {
                         yPos = yOffset + (branchHeight / 2);
                     } else {
                         // Assume number is an offset from the branch's top
                         yPos = yOffset + customPoint.y;
                     }
                }

                finalShape.snapPoints.push({
                    x: xPos,
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
                {x: 0, y: 0, cornerRadius: constants.CORNER_RADIUS},
                ...notch(0, 0, true),
            );
            finalShape.snapPoints.push({ x: constants.NOTCH_CONNECT_X, y: 0, type: 'block', role: 'female', name: 'top'});
        } else if (top === 'hat') {
            finalShape.points.push(
                {x: 0, y: 0, cornerRadius: constants.CORNER_RADIUS*4}
            );
        } else if (top === 'flat') {
            finalShape.points.push(
                {x: 0, y: 0, cornerRadius: constants.CORNER_RADIUS},
            );
        }
        addCustomSnaps(0, 0); // Add custom snaps for the only branch
    }
  
    // This is the loop for multi-branch blocks.
    for (let i = 0; i < sizes.length-1; i++) {
      let shape = [];
      const size = sizes[i];
      const dHeight = size.height * constants.BLOCK_HEIGHT;
      const dWidth = size.width * constants.BLOCK_WIDTH;
      const bHeight = size.loop.height * constants.BLOCK_HEIGHT;
  
      let offset = 0;
      for (let j = 0; j < i; j++) {
        offset += (sizes[j].height + sizes[j].loop.height) * constants.BLOCK_HEIGHT;
      }
  
      if (i === 0) {
        if (top === 'notch') {
            shape = [
                {x: 0, y: 0 + offset, cornerRadius: constants.CORNER_RADIUS},
                ...notch(0, 0 + offset, true),
                ...block(0, dWidth, dHeight),
                ...loop(0 + offset+dHeight, bHeight),
            ];
            finalShape.snapPoints.push({ x: constants.NOTCH_CONNECT_X, y: 0, type: 'block', role: 'female', name: 'top'});
        } else if (top === 'hat') {
            shape = [
                {x: 0, y: 0 + offset, cornerRadius: constants.CORNER_RADIUS*4},
                ...block(0, dWidth, dHeight),
                ...loop(0 + offset+dHeight, bHeight),
            ];
        } else if (top === 'flat') {
            shape = [
                {x: 0, y: 0 + offset, cornerRadius: constants.CORNER_RADIUS},
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
      finalShape.snapPoints.push({ x: constants.LOOP_OFFSET + constants.NOTCH_CONNECT_X, y: offset + dHeight, type: 'block', role: 'male', name: 'topInner'+i});
  
      finalShape.points.push(...shape);
      finalOffset = offset + dHeight + bHeight;
    }

    // This is the logic for the last branch in the stack.
    let lastShape = [];
    let dHeight = sizes[sizes.length-1].height * constants.BLOCK_HEIGHT;
    let dWidth = sizes[sizes.length-1].width * constants.BLOCK_WIDTH;
    
    addCustomSnaps(sizes.length - 1, finalOffset); // Add custom snaps for the last branch

    if (bottom === 'notch') {
        lastShape = [
            ...block(finalOffset, dWidth, dHeight),
            ...notch(0, 0 + finalOffset+dHeight, false),
            {x: 0, y: 0 + finalOffset+dHeight, cornerRadius: constants.CORNER_RADIUS},
        ];
        finalShape.snapPoints.push({ x: constants.NOTCH_CONNECT_X, y: finalOffset + dHeight, type: 'block', role: 'male', name: 'bottom'});
    } else if (bottom === 'flat') {
        lastShape = [
            ...block(finalOffset, dWidth, dHeight),
            {x: 0, y: 0 + finalOffset+dHeight, cornerRadius: constants.CORNER_RADIUS},
        ];
    }
    finalShape.points.push(...lastShape);
  
    return finalShape;
}
function loop(offset = 0, h = 0) {
    return [
        ...notch(constants.LOOP_OFFSET, offset, false),
        {x: constants.LOOP_OFFSET, y: offset, cornerRadius: constants.CORNER_RADIUS},
        {x: constants.LOOP_OFFSET, y: h+offset, cornerRadius: constants.CORNER_RADIUS},
        ...notch(constants.LOOP_OFFSET, h+offset, true),
    ];
}
function notch(x = 0, y = 0, inverted = false) {
    const flatWidth = constants.NOTCH_WIDTH * constants.NOTCH_RATIO;

    const slopedWidth = (constants.NOTCH_WIDTH - flatWidth) / 2;

    const p1 = {
        x: constants.NOTCH_START_X + x,
        y: y,
        cornerRadius: constants.NOTCH_RADIUS
    };
    const p2 = {
        x: constants.NOTCH_START_X + slopedWidth + x,
        y: constants.NOTCH_DEPTH + y,
        cornerRadius: constants.NOTCH_RADIUS
    };
    const p3 = {
        x: constants.NOTCH_START_X + slopedWidth + flatWidth + x,
        y: constants.NOTCH_DEPTH + y,
        cornerRadius: constants.NOTCH_RADIUS
    };
    const p4 = {
        x: constants.NOTCH_START_X + constants.NOTCH_WIDTH + x,
        y: y,
        cornerRadius: constants.NOTCH_RADIUS
    };
    if (inverted) {
        return [p1, p2, p3, p4];
    } else {
        return [p4, p3, p2, p1];
    }
}

function hat(x = 0, y = 0) {
    return [
        {x: 2+x, y: 0+y, cornerRadius: constants.CORNER_RADIUS},
        {x: 3+x, y: -1-y, cornerRadius: 5},
        {x: 7+x, y: -1-y, cornerRadius: 5},
        {x: 8+x, y: 0+y, cornerRadius: constants.CORNER_RADIUS}
    ];
}

function block(offset = 0, w = BLOCK_WIDTH, h = BLOCK_HEIGHT) {
    return [
        {x: w, y: offset, cornerRadius: constants.CORNER_RADIUS},
        {x: w, y: h+offset, cornerRadius: constants.CORNER_RADIUS},
    ]
}

function footer(colors) {
    return {
        fill: colors.inner,
        stroke: colors.outer,
        strokeWidth: constants.STROKE_WIDTH,
        strokeLinejoin: "round",
        closePath: true
    };
}