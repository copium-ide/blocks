export const data = {
  meta: {
    copium: "Copium-Lite",
    author: "copium-ide",
    name: "Test Project",
    namespace: "testproj"
  },
  modules: [
    "./default/math.js",
    "./default/variables.js"
  ],
  project: {
    assets: {},
    code: [
      {
        name: "Script1",
        code: {
          block1: {
            block: "copium-ide.vars.make",
            inputs: {
            type: {value: "String"},
            name: {value: "Bingus"},
            value: {value: " says hello"}
            }
          },
          block2: {
            block: "copium-ide.vars.make",
            inputs: {
              type: {value: "String"},
              name: {value: "Boingus"},
              value: {
                block: "copium-ide.vars.get",
                inputs: {
                  name: {value: "Bingus"}
                }
              }
            }
          },
        }
      }, // second script here {}
    ]
  }
}
