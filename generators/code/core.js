// --- STATE MANAGEMENT (Unchanged) ---
export const modulePaths = [];
export const modules = {};
export let project = {};

/**
 * A reusable helper to import from raw GitHub URLs.
 */
async function importFromRawUrl(url) {
  // ... (The helper function from above) ...
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status} for URL ${url}`);
    }
    const codeAsText = await response.text();
    const blob = new Blob([codeAsText], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);
    const module = await import(blobUrl);
    URL.revokeObjectURL(blobUrl);
    return module;
  } catch (error) {
    console.error(`Failed to import module from ${url}:`, error);
    throw error;
  }
}

// --- CORE LOGIC (Updated) ---

export async function processProject(url) {
    clearState();

    // MODIFICATION: Use the helper for the main project file.
    const projModule = await importFromRawUrl(url); 

    if (!projModule.data || !projModule.data.project) {
        throw new Error("Project file is invalid. It must be an ES module with a named export 'data' containing a 'project' object.");
    }

    project = projModule.data; // Note: Corrected to access project object

    // Collect all module dependencies from the project data.
    const projectModules = project.modules || [];
    for (const modulePath of projectModules) {
        updateImports(modulePath);
    }
    console.log("Found project modules to load:", projectModules);
    
    // Import all collected modules at once.
    await importModules();
}

/**
 * Resets the shared state. (Unchanged)
 */
function clearState() {
    modulePaths.length = 0;
    for (const key in modules) { delete modules[key]; }
    delete project.project;
}

/**
 * Adds a module path to the list. (Unchanged)
 */
function updateImports(path) {
    if (!modulePaths.includes(path)) {
        modulePaths.push(path);
    }
}

/**
 * Imports all modules listed in the modulePaths array. (Updated)
 */
async function importModules() {
    // MODIFICATION: Use the helper for each dependency.
    const importPromises = modulePaths.map(path => importFromRawUrl(path));

    const results = await Promise.allSettled(importPromises);

    results.forEach((result, index) => {
        const path = modulePaths[index];

        if (result.status === 'fulfilled') {
            const mod = result.value;
            if (mod && mod.main && mod.main.info) {
                const { author, namespace } = mod.main.info;

                if (!author || !namespace) {
                    console.warn(`Module at ${path} is missing author or namespace in its info.`);
                    return;
                }

                if (!modules.hasOwnProperty(author)) {
                    modules[author] = {};
                }
                modules[author][namespace] = mod.main;
            } else {
                 console.warn(`Module at ${path} has an invalid structure and will be skipped.`);
            }
        } 
        else {
            // The error is already logged in importFromRawUrl, but we can add context.
            console.error(`The import process for module at ${path} failed.`);
        }
    });
}

/**
 * A utility function to retrieve and execute a block function. (Unchanged)
 */
export function Generate(author, namespace, func, args) {
    if (!modules[author] || !modules[author][namespace] || !modules[author][namespace].blocks[func]) {
        throw new Error(`Generate failed: Block '${func}' not found in module '${author}/${namespace}'.`);
    }
    return modules[author][namespace].blocks[func](args);
}
