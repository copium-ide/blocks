export function init() {
    return {
        info: {
            name: "halufun", /*required*/
            email: "",
            website: "https://github.com/copium-ide",
            description: "Various math utilities.",
        },
        oplist: ["*","+","/","-","^","^/","%"],
        complist: ["==",">","<","<=",">="],
        speclist: ["log","-log","sin","cos","tan","cot","sec","csc","abs","floor","ceiling","round"]
        blocks: {
            text: "%input1 %input2 %input3",
            function: "factor",
            inputs: {
              input1: "Number",
              operator: "inlist",
              input2: "Number"
            }
        },
    }
}
export function factor(args) {
    if (args.operator != ^/) {
        return `(
    } else {
        
    }
}
