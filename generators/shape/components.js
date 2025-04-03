// constants, for all blocks
export const BLOCK_HEIGHT = 6;
export const BLOCK_WIDTH = 10;
export const CORNER_RADIUS = 0.25;
export const LOOP_OFFSET = 2;

export function notch(x = 0, y = 0, inverted = false) {
    if (inverted == true) {
        return [
            {x: 2+x, y: 0+y, cornerRadius: CORNER_RADIUS},
            {x: 3+x, y: 1+y, cornerRadius: CORNER_RADIUS},
            {x: 5+x, y: 1+y, cornerRadius: CORNER_RADIUS},
            {x: 6+x, y: 0+y, cornerRadius: CORNER_RADIUS}
        ];
    } else {
        return [
            {x: 6+x, y: 0+y, cornerRadius: CORNER_RADIUS},
            {x: 5+x, y: 1+y, cornerRadius: CORNER_RADIUS},
            {x: 3+x, y: 1+y, cornerRadius: CORNER_RADIUS},
            {x: 2+x, y: 0+y, cornerRadius: CORNER_RADIUS}
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