// runner.js

// Import your logic files using the specified namespace import syntax.
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
        
        // Delegate all the complex logic to the processProject function in code.js.
        // We pass the assembler's export function as a callback.
        const finalCode = await core.processProject(url, assembler.exportCode);

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
