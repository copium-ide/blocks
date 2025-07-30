import * as constants from './constants.js';

export function input(colors, size, type) {
    const sizes = size[0];
    const dheight = sizes.height * constants.BLOCK_HEIGHT;
    const dwidth = sizes.width * constants.BLOCK_WIDTH;

    const shape = {
        points: [],
        snapPoints: [{ x: 0, y: dheight / 2, type: type, role: 'female', name: 'output' }],
        ...footer(colors, type)
    };

    if (sizes.customSnapPoints && Array.isArray(sizes.customSnapPoints)) {
        sizes.customSnapPoints.forEach(customPoint => {
            let xPos = customPoint.x;
            if (xPos === 'center') {
                xPos = dwidth / 2;
            }

            let yPos = dheight / 2;
            if (customPoint.y !== undefined) {
                if (customPoint.y === 'center') {
                    yPos = dheight / 2;
                } else {
                    yPos = customPoint.y;
                }
            }

            shape.snapPoints.push({
                x: xPos,
                y: yPos,
                type: customPoint.type,
                // FIX: Use the role provided in the custom point's data.
                role: customPoint.role,
                name: customPoint.name
            });
        });
    }
 
    switch (type) {
        case 'label':
            shape.points.push(
                ...label(0, 0, dheight, true),
                ...label(dwidth, 0, dheight, false),
            )
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
            return { points: [], snapPoints: [] };
    }
    return shape;
}

function label(x = 0, y = 0, h = 1, inverted = false) {
    const dh = h / constants.BLOCK_HEIGHT;
    if (inverted == true) {
        return [
            {x: -1+x, y: 0, cornerRadius: 0},
            {x: -1+x, y: h, cornerRadius: 0},
        ];
    } else {
        return [
            {x: 1+x, y: h, cornerRadius: 0},
            {x: 1+x, y: 0, cornerRadius: 0},
        ];
    }
}

function str(x = 0, y = 0, h = 1, inverted = false) {
    const dh = h / constants.BLOCK_HEIGHT;
    if (inverted == true) {
        return [
            {x: -0.5+x, y: 0, cornerRadius: constants.CORNER_RADIUS},
            {x: -1+x, y: h*.25, cornerRadius: 8*dh},
            {x: -1+x, y: h*.75, cornerRadius: 8*dh},
            {x: -0.5+x, y: h, cornerRadius: constants.CORNER_RADIUS},
        ];
    } else {
        return [
            {x: 0.5+x, y: h, cornerRadius: constants.CORNER_RADIUS},
            {x: 1+x, y: h*.75, cornerRadius: 8*dh},
            {x: 1+x, y: h*.25, cornerRadius: 8*dh},
            {x: 0.5+x, y: 0, cornerRadius: constants.CORNER_RADIUS},
        ];
    }
}

function num(x = 0, y = 0, h = 1, inverted = false) {
    const dh = h / constants.BLOCK_HEIGHT;
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
            {x: 0+x, y: 0, cornerRadius: constants.CORNER_RADIUS},
            {x: -1+x, y: h*.5, cornerRadius: constants.CORNER_RADIUS},
            {x: 0+x, y: h, cornerRadius: constants.CORNER_RADIUS},
        ];
    } else {
        return [
            {x: 0+x, y: h, cornerRadius: constants.CORNER_RADIUS},
            {x: 1+x, y: h*.5, cornerRadius: constants.CORNER_RADIUS},
            {x: 0+x, y: 0, cornerRadius: constants.CORNER_RADIUS},
        ];
    }
}

function arr(x = 0, y = 0, h = 1, inverted = false) {
    if (inverted == true) {
        return [
            {x: -1+x, y: 0, cornerRadius: constants.CORNER_RADIUS},
            {x: -1+x, y: h, cornerRadius: constants.CORNER_RADIUS},
        ];
    } else {
        return [
            {x: 1+x, y: h, cornerRadius: constants.CORNER_RADIUS},
            {x: 1+x, y: 0, cornerRadius: constants.CORNER_RADIUS},
        ];
    }
}

function obj(x = 0, y = 0, h = 1, inverted = false) {
    if (inverted == true) {
        return [
            {x: 0+x, y: 0, cornerRadius: constants.CORNER_RADIUS},
            {x: -0.5+x, y: h*.5-0.5, cornerRadius: 0},
            {x: -1+x, y: h*.5, cornerRadius: 8},
            {x: -0.5+x, y: h*.5+0.5, cornerRadius: 0},
            {x: 0+x, y: h, cornerRadius: constants.CORNER_RADIUS},
        ];
    } else {
        return [
            {x: 0+x, y: h, cornerRadius: constants.CORNER_RADIUS},
            {x: 0.5+x, y: h*.5+0.5, cornerRadius: 0},
            {x: 1+x, y: h*.5, cornerRadius: 8},
            {x: 0.5+x, y: h*.5-0.5, cornerRadius: 0},
            {x: 0+x, y: 0, cornerRadius: constants.CORNER_RADIUS},
        ];
    }
}

function footer(colors, type) {
    if (type === 'label') {
        return {
            fill: '#00000000',
            stroke: '#00000000',
            strokeWidth: constants.STROKE_WIDTH,
            strokeLinejoin: "round",
            closePath: true
        };
    }
    return {
        fill: colors.inner,
        stroke: colors.outer,
        strokeWidth: constants.STROKE_WIDTH,
        strokeLinejoin: "round",
        closePath: true
    };
}