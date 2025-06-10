// code.js

// --- Shared State ---
// These are exported so other modules (like assembler.js) can read them.
// They are `const` so they cannot be reassigned, but their contents can be modified.
export const modulePaths = [];
export const modules = {};
export const project = {}; // This will be populated with a 'project' property, e.g., { project: { ... } }

/**
 * The main orchestration function.
 * It takes a project URL, fetches it, processes all its module dependencies,
 * and then uses a provided callback function to generate the final output.
 * @param {string} url - The URL to the project's main JS module file.
 * @param {function} exportCodeFunction - The function to call to generate the final code (e.g., assembler.exportCode).
 * @returns {Promise<string>} - A promise that resolves with the final generated code.
 */
export async function processProject(url, exportCodeFunction) {
    // 1. Reset state from any previous run.
    clearState();

    // 2. Fetch the project module from the provided URL.
    const projModule = await import(url);
    if (!projModule.data || !projModule.data.project) {
        throw new Error("Project file is invalid. It must be an ES module with a named export 'data' containing a 'project' object.");
    }

    // 3. Populate the shared state.
    // We modify the 'project' object's properties, not reassign the const itself.
    project.project = projModule.data.project;

    // 4. Collect all module dependencies from the project data.
    const projectModules = project.project.modules || [];
    for (const modulePath of projectModules) {
        updateImports(modulePath);
    }

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
    // Using Promise.all to fetch modules in parallel for better performance.
    const importPromises = modulePaths.map(async (path) => {
        try {
            const mod = await import(path);
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
        } catch (error) {
            // Throw a more specific error to be caught by the top-level handler
            throw new Error(`Failed to import or process module at ${path}: ${error.message}`);
        }
    });

    await Promise.all(importPromises);
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
