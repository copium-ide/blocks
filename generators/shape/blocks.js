import * as blocks from './blockComponents.js';
import * as inputs from './inputComponents.js';

export function Block(type, colors, sizes) {
    if (type != 'block' && type != 'hat' && type != 'end') {
        return inputs.input(colors, sizes, type);
    } else if (type === 'block' || type === 'hat' || type === 'end') {
        switch (type) {
            case 'block':
                return blocks.branch(colors, sizes, 'notch', 'notch');
            case 'hat':
                return blocks.branch(colors, sizes, 'hat', 'notch');
            case 'end':
                return blocks.branch(colors, sizes, 'notch', 'flat');
        }
    } else if (typeof type === 'function') {
        return type(colors, sizes);
    } else {
        console.error("Unknown block type:", type);}
}