export const main = {
    info: {
        author: "copium-ide",
        namespace: "math",
        name: "Math Utilities",
        version: "1.0.0",
        email: "",
        website: "https://github.com/copium-ide",
        description: "Various math utilities."
    },
    init: function() {return "";},

    blocks: {
        operator: {
            text: "%input1 %operator %input2",
            generate: function(args) {
                if (args.operator === "^") {
                    return `Math.pow(${args.input1}, ${args.input2})`;
                } else if (args.operator === "^/") {
                    return `Math.pow(${args.input1}, 1 / ${args.input2})`;
                } else {
                    return `(${args.input1} ${args.operator} ${args.input2})`;
                }
            },
        },

        comparator: {
            text: "%input1 %comparator %input2",
            generate: function(args) {
                return `(${args.input1} ${args.comparator} ${args.input2})`;
            },
            inputs: {
                input1: "Number",
                comparator: ["==", ">", "<", "<=", ">="],
                input2: "Number"
            }
        },

        special: {
            text: "%operator(%input1)",
            generate: function(args) {
                return `Math.${args.operator}(${args.input1})`;
            },
            inputs: {
                operator: ["log", "sin", "cos", "tan", "abs", "floor", "ceil", "round"],
                input1: "Number"
            }
        }
    }
};
