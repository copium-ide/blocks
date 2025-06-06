// updateImports() is used to add to this list. It then imports said modules and creates objects for them
export const modulePaths = [];
export const modules = {};
export const project = {};

export function importProject(path) {
    const proj = await import(path);
    project = proj.data;
    modulePaths = [];
    for (let i = 0; i < project.modules.length; i++) {
        updateImports(project.modules[i]);
        importModules();
    }

export function updateImports(path) {
    if (!modulePaths.includes(path)) {
        modulePaths.push(path);
    }
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

export function Generate(author, namespace, func, args) {
    return modules[author][namespace].blocks[func](args);
}
