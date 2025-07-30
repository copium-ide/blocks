import * as blocks from './blockComponents.js';
import * as inputs from './inputComponents.js';

export function Block(type, colors, sizes) {
    switch (type) {
        //---------------------------------------------------------BLOCKS
        case 'block':
            return blocks.branch(colors, sizes, 'notch', 'notch');
        case 'hat':
            return blocks.branch(colors, sizes, 'hat', 'notch');
        case 'end':
            return blocks.branch(colors, sizes, 'notch', 'flat');
        //---------------------------------------------------------INPUTS
        case 'label':
            return inputs.input(colors, sizes, 'label');
        case 'number':
            return inputs.input(colors, sizes, 'number');
        case 'string':
            return inputs.input(colors, sizes, 'string');
        case 'boolean':
            return inputs.input(colors, sizes, 'boolean');
        case 'array':
            return inputs.input(colors, sizes, 'array');
        case 'object':
            return inputs.input(colors, sizes, 'object');
        default:
            console.warn("Block type not recognized:", type);
            return { points: [], snapPoints: [] }; // Return a valid empty shape
    }
}