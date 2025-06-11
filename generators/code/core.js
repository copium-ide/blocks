
export const modulePaths = [];
export const modules = {};
export const project = {};
export async function processProject(url, exportCodeFunction) {
    clearState();

    const projModule = await import(url);
    if (!projModule.data || !projModule.data.project) {
        throw new Error("Project file is invalid. It must be an ES module with a named export 'data' containing a 'project' object.");
    }

    project.project = projModule.data;

    // 4. Collect all module dependencies from the project data.
    const projectModules = project.project.modules || [];
    for (const modulePath of projectModules) {
        updateImports(modulePath);
    }
    console.log("Found project modules to load:", projectModules);
    // 5. Import all collected modules at once.
    await importModules();

    // 6. Generate the final code using the provided assembler function and return it.
    return exportCodeFunction();
}

/**
 * Resets the shared state, clearing all data from previous runs.
 */
function clearState() {
    modulePaths.length = 0; // The correct way to clear a const array.
    // The correct way to clear a const object.
    for (const key in modules) {
        delete modules[key];
    }
    // Clear the project data.
    delete project.project;
}

/**
 * Adds a module path to the list if it's not already there.
 * @param {string} path - The URL path to the module.
 */
function updateImports(path) {
    if (!modulePaths.includes(path)) {
        modulePaths.push(path);
    }
}

/**
 * Imports all modules listed in the modulePaths array and populates the `modules` object.
 */
async function importModules() {
    const importPromises = modulePaths.map(path => import(path));

    // Use Promise.allSettled to wait for all imports to finish, regardless of success or failure.
    const results = await Promise.allSettled(importPromises);

    results.forEach((result, index) => {
        const path = modulePaths[index]; // Get the original path for error logging

        // Check if the promise was fulfilled (successful)
        if (result.status === 'fulfilled') {
            const mod = result.value;
            // Add defensive checks for the module's structure
            if (mod && mod.main && mod.main.info) {
                const { author, namespace } = mod.main.info;

                if (!author || !namespace) {
                    console.warn(`Module at ${path} is missing author or namespace in its info.`);
                    return; // Skip this module
                }

                // Create author namespace if it doesn't exist
                if (!modules.hasOwnProperty(author)) {
                    modules[author] = {};
                }
                modules[author][namespace] = mod.main;
            } else {
                 console.warn(`Module at ${path} has an invalid structure and will be skipped.`);
            }
        } 
        // The promise was rejected (failed)
        else {
            console.error(`Failed to import module at ${path}: ${result.reason}`);
        }
    });
}
/**
 * A utility function to retrieve a specific block function from a loaded module.
 * @param {string} author
 * @param {string} namespace
 * @param {string} func - The name of the block function.
 * @param {object} args - The arguments for the block function.
 * @returns The result of the block function call.
 */
export function Generate(author, namespace, func, args) {
    if (!modules[author] || !modules[author][namespace] || !modules[author][namespace].blocks[func]) {
        throw new Error(`Generate failed: Block '${func}' not found in module '${author}/${namespace}'.`);
    }
    return modules[author][namespace].blocks[func](args);
}
