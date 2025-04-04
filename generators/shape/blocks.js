import * as components from './components.js';

export function Block(type, colors, sizes) {
    if (type = 'block') {
        return components.branch(colors, sizes, 'notch', 'notch');
    } else if (type = 'hat') {
        return components.branch(colors, sizes, 'hat', 'notch');
    } else if (type = 'end') {
        return components.branch(colors, sizes, 'notch', 'flat');
    } else {
        console.warn("Block type not recognized:", type);
        return {};
    }
}

  
  
  