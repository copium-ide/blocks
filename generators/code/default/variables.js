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
    init: function() {
        return `
Copium.env.vars = {};`.;
    }, // Return code to be added at the beginning of the script.
    
    blocks: {
        make: {
            text: "%type variable %name = %value",
            generate: function(args) {
                return `Copium.env.vars.${args.name} = {type: ${args.type}, value: ${args.value};`
            },
            inputs: {
                type: ["String","Number","Boolean","Array","Object"],
                name: "String",
                value: "Number"
            }
        },

        get: {
            text: "variable %name",
            generate: function(args) {
                return `(Copium.env.vars.${args.name}.value)`;
            },
            inputs: {
                name: "String"
            }
        },
    }
};
