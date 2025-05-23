import * as env from "./code";
const self = import.meta.url.split('/').pop();
console.log(`Extension loaded as ${self}`);
export function init() {
    return {
        info: {
            name: "author", /*required*/
            email: "author@example.com",
            website: "https://example.com",
            description: "This is a test extension",
        },
        blocks: {
            text: "text %input1 can go anywhere",
            function: "testFunction",
            inputs: [
                {type: "string", name: "input1"},
                {type: "number", name: "input2"},
                {type: "boolean", name: "input3"},
                {type: "array", name: "input4"},
                {type: "object", name: "input5"}
            ]
        },
    }
}
export function testFunction(args) {
    return `
    console.log(${args.input1}, ${args.input2}, ${args.input3}, ${args.input4}, ${args.input5});
    env.add(${self},)
    `;
}