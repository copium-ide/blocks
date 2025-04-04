// constants, for all blocks
export const BLOCK_HEIGHT = 6;
export const BLOCK_WIDTH = 10;
export const CORNER_RADIUS = 0.75;
export const NOTCH_RADIUS = 0.25;
export const LOOP_OFFSET = 2;
export const STROKE_WIDTH = 0.1;

export function notch(x = 0, y = 0, inverted = false) {
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

export function hat(x = 0, y = 0) {
    return [
        {x: 2+x, y: 0+y, cornerRadius: CORNER_RADIUS},
        {x: 3+x, y: -1-y, cornerRadius: 5},
        {x: 7+x, y: -1-y, cornerRadius: 5},
        {x: 8+x, y: 0+y, cornerRadius: CORNER_RADIUS}
    ];
}

export function block(w = BLOCK_WIDTH, h = BLOCK_HEIGHT) {
    return [
        {x: w, y: 0, cornerRadius: CORNER_RADIUS},
        {x: w, y: h, cornerRadius: CORNER_RADIUS},
    ]
}

export function loop(x = 0, y = 0, w = BLOCK_WIDTH, h = BLOCK_HEIGHT) {
    return [
        ...notch(x, y, false),
        {x: 2+x, y: y, cornerRadius: CORNER_RADIUS},
        ...notch(x, BLOCK_HEIGHT+y, true),
        
        
        
    ];
}

export function footer(colors) {
    return {
        fill: colors.inner,
        stroke: colors.outer,
        strokeWidth: STROKE_WIDTH,
        strokeLinejoin: "round",
        closePath: true
    };
}