export function Block(colors, height, width) {
    const dHeight = height * 6;
    const dWidth = width * 10;
    return {
        points: [
        {x: 0, y: 0, cornerRadius: 0.5},
        ...notch(0, 0, true),
        {x: dWidth, y: 0, cornerRadius: 2},
        {x: dWidth, y: dHeight, cornerRadius: 2},
        ...notch(0, dHeight, false),
        {x: 0, y: dHeight, cornerRadius: 0.5}
        ],
        fill: colors.inner,
        stroke: colors.outer,
        strokeWidth: 0.5,
        strokeLinejoin: "round",
        closePath: true
        };
}
export function Hat(colors, height, width) {
    const dHeight = height * 6;
    const dWidth = width * 10;
    return {
        points: [
        {x: 0, y: 0, cornerRadius: 0.5},
        ...hat(0, 0, true),
        {x: dWidth, y: 0, cornerRadius: 2},
        {x: dWidth, y: dHeight, cornerRadius: 2},
        ...notch(0, dHeight, false),
        {x: 0, y: dHeight, cornerRadius: 0.5}
        ],
        fill: colors.inner,
        stroke: colors.outer,
        strokeWidth: 0.5,
        strokeLinejoin: "round",
        closePath: true
        };
}
export function End(colors, height, width) {
    const dHeight = height * 6;
    const dWidth = width * 10;
    return {
        points: [
        {x: 0, y: 0, cornerRadius: 0.5},
        ...notch(0, 0, true),
        {x: dWidth, y: 0, cornerRadius: 2},
        {x: dWidth, y: dHeight, cornerRadius: 2},
        {x: 0, y: dHeight, cornerRadius: 0.5}
        ],
        fill: colors.inner,
        stroke: colors.outer,
        strokeWidth: 0.5,
        strokeLinejoin: "round",
        closePath: true
        };
}

// block components                 ----------------------BLOCK COMPONENTS----------------------

// constants, for all blocks
const BLOCK_HEIGHT = 6;
const BLOCK_WIDTH = 10;
const CORNER_RADIUS = 0.25;
const LOOP_OFFSET = 2;

function notch(x = 0, y = 0, inverted = false) {
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

function hat(x = 0, y = 0) {
    return [
        {x: 2+x, y: 0+y, cornerRadius: CORNER_RADIUS},
        {x: 3+x, y: -1-y, cornerRadius: 5},
        {x: 7+x, y: -1-y, cornerRadius: 5},
        {x: 8+x, y: 0+y, cornerRadius: CORNER_RADIUS}
    ];
}