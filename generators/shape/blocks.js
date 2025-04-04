import * as components from './components.js';

export function Block(type, colors, sizes) {
    switch (type) {
        case 'block':
            return components.branch(colors, sizes, 'notch', 'notch');
        case 'hat':
            return components.branch(colors, sizes, 'hat', 'notch');
        case 'end':
            return components.branch(colors, sizes, 'notch', 'flat');
        default:
            console.warn("Block type not recognized:", type);
            return {};
    }
}

  
  
  