export const data = {
  meta: {
    copium: `Copium-Lite`,
    author: `copium-ide`,
    name: `Infinite Bouncing Ball Test`,
    namespace: `mattertest`
  },
  modules: [
    // Assuming the self-contained matter extension is at this standard location.
    `https://raw.githubusercontent.com/copium-ide/blocks/main/generators/code/default/matter.js`, 
    
    // Standard console module for logging.
    `https://raw.githubusercontent.com/copium-ide/blocks/main/generators/code/default/console.js`
  ],
  project: {
    assets: {},
    code: [
      {
        name: `BouncingBallScene`,
        code: [
          // A log message to confirm the script is running.
          {
            block: `copium-ide.console.push`,
            inputs: {
              type: {value: `log`},
              // THIS IS THE FIX: The string value is now properly quoted
              // so it will be treated as a string literal in the final code.
              input: {value: `"Starting the infinite bouncing ball simulation..."`}
            }
          },
          // Create the walls for the 800x600 canvas.
          {
            block: `copium-ide.matter.createWalls`,
            inputs: {
              w: {value: 800},
              h: {value: 600}
            }
          },
          // Create the infinitely bouncing ball.
          {
            block: `copium-ide.matter.createCircle`,
            inputs: {
              name: {value: `bouncyBall`},
              x: {value: 400},
              y: {value: 100},
              r: {value: 30},
              // The options are key: restitution of 1 means perfect bounce.
              // We also remove all friction for a truly "infinite" effect.
              options: {
                value: `{ 
                  restitution: 1, 
                  friction: 0, 
                  frictionAir: 0, 
                  render: { 
                    sprite: { 
                      texture: 'https://place-hold.it/60/e74c3c' 
                    } 
                  } 
                }`
              }
            }
          }
        ]
      }
    ]
  }
};
