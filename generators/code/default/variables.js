export const main = {
    info: {
        author: "copium-ide",
        namespace: "vars",
        name: "Variables",
        version: "1.0.0",
        email: "",
        website: "https://github.com/copium-ide",
        description: "Make, get, and modify variables."
    },
    init: `
        Copium.env.vars = {};
        const Vars = Copium.env.vars;
        `
    blocks: {
        make: {
            text: "%definition %type %value"
            generate: function(args) {
                return `Vars.${args.name} = {type: ${args.type}, value: ${args.value};`
            },
            inputs: {
                type: ["String","Number","Boolean","Array","Object"],
                name: "String",
                value: "Number"
            }
        },

        get: {
            text: "%variables",
            generate: function(args) {
                return `(${args.input1} ${args.comparator} ${args.input2})`;
            },
            inputs: {
                variables: /* find some way to define a type as a dynamic list. */,
                comparator: "Drop.complist",
                input2: "Number"
            }
        },
    }
};
