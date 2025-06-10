// Import your logic files using the specified namespace import syntax.
// These files must be in the same directory as this HTML file.
import * as core from './code.js';
import * as assembler from './assembler.js';

// --- DOM Elements ---
const projectUrlInput = document.getElementById('projectUrl');
const assembleBtn = document.getElementById('assembleBtn');
const outputEl = document.getElementById('output');
const logsEl = document.getElementById('logs');

// --- Logging Helpers ---
function log(message) {
    console.log(message);
    logsEl.textContent += `[LOG] ${message}\n`;
    logsEl.scrollTop = logsEl.scrollHeight;
}

function error(message) {
    console.error(message);
    logsEl.textContent += `[ERROR] ${message}\n`;
    logsEl.scrollTop = logsEl.scrollHeight;
}

function clearLogs() {
    logsEl.textContent = '';
}

// --- Main Application Logic ---
async function handleAssembly() {
    const url = projectUrlInput.value.trim();
    if (!url) {
        alert("Please enter a project URL.");
        return;
    }

    // Reset UI for a new run
    outputEl.textContent = 'Assembling...';
    clearLogs();
    assembleBtn.disabled = true;

    try {
        // The `importProject` function in your `code.js` has a flawed execution flow.
        // Instead of calling it, we will perform the correct sequence of operations here,
        // using the exported functions and state objects from `core`.

        // 1. Fetch the project module from the provided URL.
        log(`Importing project from: ${url}`);
        const projModule = await import(url);
        if (!projModule.data || !projModule.data.project) {
            throw new Error("Project file is invalid. It must be an ES module with a named export 'data' containing a 'project' object.");
        }

        // 2. Populate the shared state in `code.js`.
        // We assign to a property of the exported `project` object, we don't reassign the object itself.
        core.project.project = projModule.data.project;
        log("Project data loaded successfully into shared state.");

        // 3. Collect all module dependencies from the project data.
        core.modulePaths.length = 0; // Clear any previous paths
        const projectModules = core.project.project.modules || [];
        for (const modulePath of projectModules) {
            core.updateImports(modulePath); // This function is from your `code.js`
        }

        // 4. Import all collected modules.
        await core.importModules(); // This function is from your `code.js`

        // 5. Generate the final code using the assembler.
        // We call the function from the imported `assembler` namespace.
        const finalCode = assembler.exportCode();

        // 6. Display the result.
        outputEl.textContent = finalCode;

    } catch (e) {
        outputEl.textContent = 'An error occurred during assembly. See logs for details.';
        error(`Assembly process failed: ${e.message}`);
        console.error(e); // Also log the full error object for more details.
    } finally {
        assembleBtn.disabled = false;
    }
}

assembleBtn.addEventListener('click', handleAssembly);
