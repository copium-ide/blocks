export const main = {
    info: {
        author: `copium-ide`,
        namespace: `console`,
        name: `Console`,
        version: `1.0.0`,
        email: ``,
        website: `https://github.com/copium-ide`,
        description: `Simple console logging.`
    },
    init: function() {
        return ``;
    },
    
    blocks: {
        push: {
            text: `%type to console %input`,
            generate: function(args) {
                return `console.${args.type}(${args.input})`
            },
            inputs: {
                type: [`log`,`warn`,`error`],
                input: `String`
            }
        },
    }
};
