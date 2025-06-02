export function init() {
    return {
        info: {
            name: "halufun",
            email: "",
            website: "https://github.com/copium-ide",
            description: "Various math utilities.",
        },
        oplist: ["*","+","/","-","^","^/","%"],
        complist: ["==",">","<","<=",">="],
        speclist: ["log","-log","sin","cos","tan","cot","sec","csc","abs","floor","ceiling","round"],
        blocks: {
            operator: {
                text: "%input1 %operator %input2",
                generate: function(args) {
                    if (args.operator !== "^/" && args.operator !== "^") {
                        return `(${args.input1}${args.operator}${args.input2})`;
                    } else {
                        if (args.operator == "^") {
                            return `(Math.pow(${args.input1},${args.input2}))`;
                        } else {
                            return `(Math.pow(${args.input1}, 1/${args.input2}))`;
                        }
                    }
                },
                inputs: {
                    input1: "Number",
                    operator: "oplist",
                    input2: "Number"
                }
            },
            comparator: {
                text: "%input1 %comparator %input2",
                generate: function(args) {
                    return `(${args.input1}${args.comparator}${args.input2})`;
                },
                inputs: {
                    input1: "Number",
                    comparator: "complist",
                    input2: "Number"
                }
            },
        }
    };
}
