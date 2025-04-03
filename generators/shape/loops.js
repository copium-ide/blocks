import * as components from './components.js';

export function Branch(colors, height, width) {
    const dHeight = height * components.BLOCK_HEIGHT;
    const dWidth = width * components.BLOCK_WIDTH;
    return {
        points: [
        {x: 0, y: 0, cornerRadius: 0.5},
        ...components.notch(0, 0, true),
        {x: dWidth, y: 0, cornerRadius: 2},
        {x: dWidth, y: dHeight, cornerRadius: 2},
        ...components.notch(0, dHeight, false),
        {x: 0, y: dHeight, cornerRadius: 0.5}
        ],
        fill: colors.inner,
        stroke: colors.outer,
        strokeWidth: 0.5,
        strokeLinejoin: "round",
        closePath: true
        };
}
export function Wrap(colors, height, width) {
    const dHeight = height * components.BLOCK_HEIGHT;
    const dWidth = width * components.BLOCK_WIDTH;
    return {
        points: [
        {x: 0, y: 0, cornerRadius: 0.5},
        ...components.hat(0, 0, true),
        {x: dWidth, y: 0, cornerRadius: 2},
        {x: dWidth, y: dHeight, cornerRadius: 2},
        ...components.notch(0, dHeight, false),
        {x: 0, y: dHeight, cornerRadius: 0.5}
        ],
        fill: colors.inner,
        stroke: colors.outer,
        strokeWidth: 0.5,
        strokeLinejoin: "round",
        closePath: true
        };
}
export function Loop(colors, height, width) {
    const dHeight = height * components.BLOCK_HEIGHT;
    const dWidth = width * components.BLOCK_WIDTH;
    return {
        points: [
        {x: 0, y: 0, cornerRadius: 0.5},
        ...components.notch(0, 0, true),
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