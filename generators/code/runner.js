// runner.js

// Import your logic files using the specified namespace import syntax.
import * as core from './core.js';
import * as assembler from './assembler.js';

// --- DOM Elements ---
const projectUrlInput = document.getElementById('projectUrl');
const assembleBtn = document.getElementById('assembleBtn');
const outputEl = document.getElementById('output');
const logsEl = document.getElementById('logs');
const debugButton = document.getElementById('debug-modules-button');

// 2. Add a click event listener
debugButton.addEventListener('click', () => {
    console.log("--- Debugging 'modules' State ---");

    // 3. Log the current content of the imported 'modules' object
    // The browser console will provide an interactive, expandable view.
    console.log(core.modules); 
    
    // For a more detailed, non-collapsible view in some consoles:
    // console.dir(modules, { depth: null });

    console.log("---------------------------------");
});

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
    // Note: You must convert raw GitHub URLs to a CDN URL like jsDelivr
    // Example: https://raw.githubusercontent.com/... -> https://cdn.jsdelivr.net/gh/...
    let url = projectUrlInput.value.trim();
    if (!url) {
        alert("Please enter a project URL.");
        return;
    }

    // Automatically convert raw GitHub URLs
    if (url.startsWith('https://raw.githubusercontent.com/')) {
        const newUrl = 'https://cdn.jsdelivr.net/gh/' + url.substring('https://raw.githubusercontent.com/'.length).replace('/main/', '@main/');
        log(`Converting GitHub URL to jsDelivr: ${newUrl}`);
        url = newUrl;
    }


    // Reset UI for a new run
    outputEl.textContent = 'Assembling...';
    clearLogs();
    assembleBtn.disabled = true;

    try {
        log(`Starting assembly for project: ${url}`);
        await core.processProject(url);
        const finalCode = await assembler.exportCode();

        // Display the result.
        outputEl.textContent = finalCode;
        log("Assembly completed successfully.");

    } catch (e) {
        outputEl.textContent = 'An error occurred during assembly. See logs for details.';
        error(`Assembly process failed: ${e.message}`);
        console.error(e); // Also log the full error object for more details.
    } finally {
        assembleBtn.disabled = false;
    }
}

assembleBtn.addEventListener('click', handleAssembly);
