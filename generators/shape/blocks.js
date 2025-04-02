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
        {x: 1.25, y: 0, cornerRadius: 0.25},
        {x: 2, y: 0.75, cornerRadius: 0.25},
        {x: 4, y: 0.75, cornerRadius: 0.25},
        {x: 4.75, y: 0, cornerRadius: 0.25},
        {x: dWidth, y: 0, cornerRadius: 2},
        {x: dWidth, y: dHeight, cornerRadius: 2},
        {x: 4.75, y: dHeight, cornerRadius: 0.25},
        {x: 4, y: dHeight+.75, cornerRadius: 0.25},
        {x: 2, y: dHeight+.75, cornerRadius: 0.25},
        {x: 1.25, y: dHeight, cornerRadius: 0.25},
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
    const dHeight = height * 8;
    const dWidth = width * 15;
    return {
        points: [
        {x: 0, y: 0, cornerRadius: 2},
        {x: dWidth, y: 0, cornerRadius: 2},
        {x: dWidth, y: dHeight, cornerRadius: 2},
        {x: 4.75, y: dHeight, cornerRadius: 0.25},
        {x: 4, y: dHeight+.75, cornerRadius: 0.25},
        {x: 2, y: dHeight+.75, cornerRadius: 0.25},
        {x: 1.25, y: dHeight, cornerRadius: 0.25},
        {x: 0, y: dHeight, cornerRadius: 0.5}
        ],
        fill: colors.inner,
        stroke: colors.outer,
        strokeWidth: 0.5,
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
        {x: 1.25, y: 0, cornerRadius: 0.25},
        {x: 2, y: 0.75, cornerRadius: 0.25},
        {x: 4, y: 0.75, cornerRadius: 0.25},
        {x: 4.75, y: 0, cornerRadius: 0.25},
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