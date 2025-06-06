import * as blockConstants from './blockComponents.js';
// constants, for all inputs
export const INPUT_HEIGHT = 4;
export const INPUT_WIDTH = 10;
export const STROKE_WIDTH = 0.25;

export function input(colors, size, type) {
    const sizes = size[0];
    const shape = {points: [], ...footer(colors)};
    const dheight = sizes.height * INPUT_HEIGHT;
    const dwidth = sizes.width * INPUT_WIDTH;

    switch (type) {
        case 'number':
            shape.points.push(
                ...num(0, 0, dheight, true),
                ...num(dwidth, 0, dheight, false),
            );
            break;
        case 'string':
            shape.points.push(
                ...str(0, 0, dheight, true),
                ...str(dwidth, 0, dheight, false),
            );
            break;
        case 'boolean':
            shape.points.push(
                ...bool(0, 0, dheight, true),
                ...bool(dwidth, 0, dheight, false),
            );
            break;
        case 'array':
            shape.points.push(
                ...arr(0, 0, dheight, true),
                ...arr(dwidth, 0, dheight, false),
            );
            break;
        case 'object':
            shape.points.push(
                ...obj(0, 0, dheight, true),
                ...obj(dwidth, 0, dheight, false),
            );
            break;
        default:
            console.warn("Input type not recognized:", type);
            return {};
    }
    return shape;
}

function str(x = 0, y = 0, h = 1, inverted = false) {
    const dh = h / INPUT_HEIGHT;
    if (inverted == true) {
        return [
            {x: -0.5+x, y: 0, cornerRadius: blockConstants.CORNER_RADIUS},
            {x: -1+x, y: h*.25, cornerRadius: 8*dh},
            {x: -1+x, y: h*.75, cornerRadius: 8*dh},
            {x: -0.5+x, y: h, cornerRadius: blockConstants.CORNER_RADIUS},
        ];
    } else {
        return [
            {x: 0.5+x, y: h, cornerRadius: blockConstants.CORNER_RADIUS},
            {x: 1+x, y: h*.75, cornerRadius: 8*dh},
            {x: 1+x, y: h*.25, cornerRadius: 8*dh},
            {x: 0.5+x, y: 0, cornerRadius: blockConstants.CORNER_RADIUS},
        ];
    }
}

function num(x = 0, y = 0, h = 1, inverted = false) {
    const dh = h / INPUT_HEIGHT;
    if (inverted == true) {
        return [
            {x: -1+x, y: 0, cornerRadius: 2},
            {x: -1+x, y: h, cornerRadius: 2},
        ];
    } else {
        return [
            {x: 1+x, y: h, cornerRadius: 2},
            {x: 1+x, y: 0, cornerRadius: 2},
        ];
    }
}

function bool(x = 0, y = 0, h = 1, inverted = false) {
    if (inverted == true) {
        return [
            {x: 0+x, y: 0, cornerRadius: blockConstants.CORNER_RADIUS},
            {x: -1+x, y: h*.5, cornerRadius: blockConstants.CORNER_RADIUS},
            {x: 0+x, y: h, cornerRadius: blockConstants.CORNER_RADIUS},
        ];
    } else {
        return [
            {x: 0+x, y: h, cornerRadius: blockConstants.CORNER_RADIUS},
            {x: 1+x, y: h*.5, cornerRadius: blockConstants.CORNER_RADIUS},
            {x: 0+x, y: 0, cornerRadius: blockConstants.CORNER_RADIUS},
        ];
    }
}

function arr(x = 0, y = 0, h = 1, inverted = false) {
    if (inverted == true) {
        return [
            {x: -1+x, y: 0, cornerRadius: blockConstants.CORNER_RADIUS},
            {x: -1+x, y: h, cornerRadius: blockConstants.CORNER_RADIUS},
        ];
    } else {
        return [
            {x: 1+x, y: h, cornerRadius: blockConstants.CORNER_RADIUS},
            {x: 1+x, y: 0, cornerRadius: blockConstants.CORNER_RADIUS},
        ];
    }
}

function obj(x = 0, y = 0, h = 1, inverted = false) {
    if (inverted == true) {
        return [
            {x: 0+x, y: 0, cornerRadius: blockConstants.CORNER_RADIUS},
            {x: -0.5+x, y: h*.5-0.5, cornerRadius: 0},
            {x: -1+x, y: h*.5, cornerRadius: 8},
            {x: -0.5+x, y: h*.5+0.5, cornerRadius: 0},
            {x: 0+x, y: h, cornerRadius: blockConstants.CORNER_RADIUS},
        ];
    } else {
        return [
            {x: 0+x, y: h, cornerRadius: blockConstants.CORNER_RADIUS},
            {x: 0.5+x, y: h*.5+0.5, cornerRadius: 0},
            {x: 1+x, y: h*.5, cornerRadius: 8},
            {x: 0.5+x, y: h*.5-0.5, cornerRadius: 0},
            {x: 0+x, y: 0, cornerRadius: blockConstants.CORNER_RADIUS},
        ];
    }
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