import * as components from './components.js';

export function Block(colors, height, width) {
    const dHeight = height * components.BLOCK_HEIGHT;
    const dWidth = width * components.BLOCK_WIDTH;
    return {
        points: [
        {x: 0, y: 0, cornerRadius: components.CORNER_RADIUS},
        ...components.notch(0, 0, true),
        ...components.block(dWidth, dHeight),
        ...components.notch(0, dHeight, false),
        {x: 0, y: dHeight, cornerRadius: components.CORNER_RADIUS}
        ],
        ...components.footer(colors),
        };
}
export function Hat(colors, height, width) {
    const dHeight = height * components.BLOCK_HEIGHT;
    const dWidth = width * components.BLOCK_WIDTH;
    return {
        points: [
        {x: 0, y: 0, cornerRadius: components.CORNER_RADIUS},
        ...components.hat(0, 0, true),
        ...components.block(dWidth, dHeight),
        ...components.notch(0, dHeight, false),
        {x: 0, y: dHeight, cornerRadius: components.CORNER_RADIUS}
        ],
        ...components.footer(colors),
        };
}
export function End(colors, height, width) {
    const dHeight = height * components.BLOCK_HEIGHT;
    const dWidth = width * components.BLOCK_WIDTH;
    return {
        points: [
        {x: 0, y: 0, cornerRadius: components.CORNER_RADIUS},
        ...components.notch(0, 0, true),
        ...components.block(dWidth, dHeight),
        {x: 0, y: dHeight, cornerRadius: components.CORNER_RADIUS}
        ],
        ...components.footer(colors),
        };
}
export function Loop(colors, sizes) {
    const finalShape = { 
      points: [],
      ...components.footer(colors),
    };
  
    for (let i = 0; i < sizes.length; i++) {
      let shape;
      const size = sizes[i];
      const dHeight = size.height * components.BLOCK_HEIGHT;
      const dWidth = size.width * components.BLOCK_WIDTH;
      const bHeight = size.loop.height * components.BLOCK_HEIGHT;
  
      let offset = 0;
      for (let j = 0; j < i; j++) {
        offset += (sizes[j].height + sizes[j].loop.height) * components.BLOCK_HEIGHT;
      }
  
      if (i === 0) {
        shape = [
          {x: 0, y: 0 + offset, cornerRadius: components.CORNER_RADIUS},
          ...components.notch(0, 0 + offset, true),
          ...components.block(dWidth, dHeight),
        ];
      } else {
        shape = [
          ...components.loop(components.LOOP_OFFSET, 0 + offset-bHeight, dWidth, dHeight),
          { x: components.LOOP_OFFSET, y: bHeight + offset, cornerRadius: components.CORNER_RADIUS },
        ];
      }
  
      finalShape.points.push(...shape);
    }
  
    return finalShape;
  }
  
  