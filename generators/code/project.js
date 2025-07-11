export const data = {
  meta: {
    copium: `Copium-Lite`,
    author: `copium-ide`,
    name: `Test Project`,
    namespace: `testproj`
  },
  modules: [
    `https://raw.githubusercontent.com/copium-ide/blocks/refs/heads/main/generators/code/default/math.js`,
    `https://raw.githubusercontent.com/copium-ide/blocks/refs/heads/main/generators/code/default/variables.js`,
    `https://raw.githubusercontent.com/copium-ide/blocks/refs/heads/main/generators/code/default/console.js`
  ],
  project: {
    assets: {},
    code: [
      {
        name: `Script1`,
        code: [
          {
            block: `copium-ide.vars.make`,
            inputs: {
            type: {value: `Number`},
            name: {value: `Bingus`},
            value: {value: 1}
            }
          },
          {
            block: `copium-ide.vars.make`,
            inputs: {
              type: {value: `Number`},
              name: {value: `Boingus`},
              value: {
                block: `copium-ide.vars.get`,
                inputs: {
                  name: {value: `Bingus`}
                }
              }
            }
          },
          {
            block: `copium-ide.console.push`,
            inputs: {
              type: {value: `log`},
              input: {
                block: `copium-ide.math.operator`,
                inputs: {
                  input1: {
                    block: `copium-ide.vars.get`,
                    inputs: {
                      name: {value: `Bingus`}
                    }
                  },
                  operator: {value: `+`},
                  input2: {
                    block: `copium-ide.vars.get`,
                    inputs: {
                      name: {value: `Boingus`}
                    }
                  },
                }
              }
            }
          },
        ]
      }
    ]
  }
};
