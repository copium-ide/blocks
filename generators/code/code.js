let modulePaths = [
    "./spriting.js",
    "./math.js",
    "./files.js",
    "./os.js"
];

// USAGE: updateImports("path");
export function updateImports(path) {
    if (!modulePaths.includes(path)) {
        modulePaths.push(path);
    }
    console.log("Updated imports:", modulePaths);
}

export async function importModules() {
    for (let i = 0; i < modulePaths.length; i++) {
        try {
            const mod = await import(modulePaths[i]);
            console.log(`Imported ${modulePaths[i]}`, mod);
        } catch (error) {
            console.error(`Error importing module ${modulePaths[i]}:`, error);
        }
    }
}

// Example usage
importModules();



let context = {
    paths: {},
    elements: {},
};

export function getContext() {
    return context;
}
