export function generate(type, colors, height, width) {
    if (type === 'block') {
        return block(height, width, colors);
    } else if (type === 'hat') {
        return hat(height, width, colors);
    } else if (type === 'end') {
        return end(height, width, colors);
    } else if (type === 'loop') {
        
    } else {
        console.error(`Unknown type: ${type}`);
        return {};
    }
}





function block(height, width, colors) {
    const dHeight = height * 8;
    const dWidth = width * 15;
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
function hat(height, width, colors) {
    const dHeight = height * BLOCK_HEIGHT;
    const dWidth = width * BLOCK_WIDTH;
    return {
        points: [
        {x: 0, y: 0, cornerRadius: 0.25},
        {x: 3, y: -2, cornerRadius: 2},
        {x: 7, y: -2, cornerRadius: 2},
        {x: 10, y: 0, cornerRadius: 0.25},
        {x: dWidth, y: 0, cornerRadius: 2},
        {x: dWidth, y: dHeight, cornerRadius: 2},
        ...notch(0, dHeight, false),
        {x: 0, y: dHeight, cornerRadius: 0.5}
        ],
        fill: colors.inner,
        stroke: colors.outer,
        strokeWidth: 0.1,
        strokeLinejoin: "round",
        closePath: true
        };
}
function end(height, width, colors) {
    const dHeight = height * 8;
    const dWidth = width * 15;
    return {
        points: [
        {x: 0, y: 0, cornerRadius: 0.5},
        ...notch(0, 0, true),
        {x: dWidth, y: 0, cornerRadius: 2},
        {x: dWidth, y: dHeight, cornerRadius: 2},
        {x: 0, y: dHeight, cornerRadius: 2}
        ],
        fill: colors.inner,
        stroke: colors.outer,
        strokeWidth: 0.5,
        strokeLinejoin: "round",
        closePath: true
        };
}
function loop(upperHeight, upperWidth, lowerHeight, lowerWidth, innerHeight) {
    return {
        type: 'loop',
        points: [
            { x: 0, y: 0, cornerRadius: 0 },
            { x: 100, y: 0, cornerRadius: 0 },
            { x: 100, y: -50, cornerRadius: 0 },
            { x: 0, y: -50, cornerRadius: 0 }
        ]
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