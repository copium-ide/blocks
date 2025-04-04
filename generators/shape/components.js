// constants, for all blocks
export const BLOCK_HEIGHT = 6;
export const BLOCK_WIDTH = 10;
export const CORNER_RADIUS = 0.75;
export const NOTCH_RADIUS = 0.25;
export const LOOP_OFFSET = 2;
export const STROKE_WIDTH = 0.25;

export function branch(colors, sizes, top, bottom) {
    const finalShape = { 
      points: [],
      ...footer(colors),
    };
    let finalOffset = 0;
  
    for (let i = 0; i < sizes.length-1; i++) {
      let shape;
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
        } else if (top === 'hat') {
            shape = [
                {x: 0, y: 0 + offset, cornerRadius: CORNER_RADIUS},
                ...hat(0, 0 + offset),
                ...loop(0 + offset+dHeight, bHeight),
                ...block(0, dWidth, dHeight),
                
              ];
        } else if (top === 'flat') {
            shape = [
                {x: 0, y: 0 + offset, cornerRadius: CORNER_RADIUS},
                ...loop(0 + offset+dHeight, bHeight),
                ...block(0, dWidth, dHeight),
                
              ];
        }
      } else {
        shape = [
          
          ...block(offset, dWidth, dHeight),
          ...loop(0 + offset+dHeight, bHeight),
        ];
      }
  
      finalShape.points.push(...shape);
      finalOffset = offset + dHeight + bHeight;
    }
    let lastShape = [];
    let dHeight = sizes[sizes.length-1].height * BLOCK_HEIGHT;
    let dWidth = sizes[sizes.length-1].width * BLOCK_WIDTH;
    if (bottom === 'notch') {
        lastShape = [
            ...block(finalOffset, dWidth, dHeight),
            ...notch(0, 0 + finalOffset+dHeight, false),
            {x: 0, y: 0 + finalOffset+dHeight, cornerRadius: CORNER_RADIUS},
        ];
    } else if (bottom === 'flat') {
        lastShape = [
            {x: 0, y: 0 + finalOffset, cornerRadius: CORNER_RADIUS},
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