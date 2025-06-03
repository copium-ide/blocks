let modulePaths = [
    "./spriting.js",
    "./math.js",
    "./files.js",
    "./os.js"
];
let modules = {};

export function updateImports(path) {
    if (!modulePaths.includes(path)) {
        modulePaths.push(path);
    }
    importModules();
}

export async function importModules() {
    for (let i = 0; i < modulePaths.length; i++) {
        try {
            const mod = await import(modulePaths[i]);
            const author = mod.main.info.author;
            const namespace = mod.main.info.namespace;
            if (!modules.hasOwnProperty(author)) {
                modules[author] = {}; 
            }
            modules[author][namespace] = mod.main;
        } catch (error) {
            console.error(`Error importing module ${modulePaths[i]}:`, error);
        }
    }
}
