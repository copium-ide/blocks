import * as blocks from './blocks.js';
import * as svg from './svg.js';
import * as drag from './drag.js';

// --- CONFIGURATION ---
export const APP_SCALE = 8; 
const MIN_LOOP_HEIGHT = 1; // The default height of an empty loop.

// --- APPLICATION STATE ---
const workSpace = document.getElementById('workspace'); 
const blockSpace = {};
let targetID = null;

// UI elements
const hinput = document.getElementById("h");
const winput = document.getElementById("w");
const typeinput = document.getElementById("type");
const uuidinput = document.getElementById("blockType");
const color1input = document.getElementById("color1");
const color2input = document.getElementById("color2");
const slidersContainer = document.getElementById("sliders");


// --- UTILITY & HELPER FUNCTIONS ---

function setupWorkspaceViewBox() { /* ... unchanged ... */ }
function getDragGroup(blockId, allBlocks) { /* ... unchanged ... */ }
function generateShape(uuid, type, colors, sizes) { /* ... unchanged ... */ }
function clearSliders() { /* ... unchanged ... */ }

/**
 * **NEW**: Calculates the total height of a connected chain of blocks.
 * The height is in block units (the same units as the sliders).
 */
function calculateChainHeight(startBlockId) {
    if (!startBlockId || !blockSpace[startBlockId]) {
        return 0;
    }

    let totalHeight = 0;
    let currentBlockId = startBlockId;

    while (currentBlockId) {
        const currentBlock = blockSpace[currentBlockId];
        if (!currentBlock) break;

        // Sum the height of all branches in the current block
        currentBlock.sizes.forEach(size => {
            totalHeight += size.height;
            // Also add the height of any loops this block itself contains
            if (size.loop && size.loop.height > 0) {
                totalHeight += size.loop.height;
            }
        });

        // Move to the next block in the chain (connected to the 'bottom' snap point)
        currentBlockId = currentBlock.children['bottom'];
    }

    return totalHeight;
}


// --- CORE LOGIC & STATE MANAGEMENT ---

/**
 * **NEW**: Checks a block for inner chains and resizes its loops to fit.
 */
function updateLoopSize(loopBlockId) {
    if (!loopBlockId) return;

    const loopBlock = blockSpace[loopBlockId];
    if (!loopBlock || !loopBlock.sizes) return;

    let needsRedraw = false;
    // Iterate through the branches of the block to find its loops
    for (let i = 0; i < loopBlock.sizes.length; i++) {
        const branch = loopBlock.sizes[i];
        // The snap point name for the inner chain start
        const innerChainSnapName = 'topInner' + i; 

        if (branch.loop) { // This branch has a loop property
            const innerChainStartId = loopBlock.children[innerChainSnapName];
            let chainHeight = calculateChainHeight(innerChainStartId);

            // Ensure the loop has a minimum height, even when empty
            const newLoopHeight = chainHeight > 0 ? chainHeight : MIN_LOOP_HEIGHT;
            
            if (branch.loop.height !== newLoopHeight) {
                branch.loop.height = newLoopHeight;
                needsRedraw = true;
            }
        }
    }

    if (needsRedraw) {
        // Redraw the block with its new loop size, which will also trigger
        // updateLayout for anything attached below it.
        editBlock(loopBlockId, loopBlock.type, loopBlock.colors, loopBlock.sizes);
    }
}


function updateLayout(parentId) { /* ... unchanged ... */ }
function setParent(childId, newParentId, parentSnapPointName) { /* ... unchanged ... */ }

/**
 * **UPDATED**: Now tracks the old parent to trigger a resize on detach.
 */
function handleDetach(childId) {
    const childBlock = blockSpace[childId];
    if (!childBlock) return;
    
    const oldParentId = childBlock.parent;
    
    setParent(childId, null, null);
    
    // After detaching, tell the old parent to resize its loop.
    updateLoopSize(oldParentId);
}

/**
 * **UPDATED**: Triggers a loop resize on the new parent after a successful snap.
 */
function onDragEnd(draggedBlockId, finalTransform, snapInfo) {
    const mainDraggedBlock = blockSpace[draggedBlockId];
    if (!mainDraggedBlock) return;
    
    const newParentId = snapInfo ? snapInfo.targetId : null;
    const parentSnapPointName = snapInfo ? snapInfo.malePoint.name : null;
    
    setParent(draggedBlockId, newParentId, parentSnapPointName);
    
    // Update block positions
    const startPos = mainDraggedBlock.transform;
    const delta = { x: finalTransform.x - startPos.x, y: finalTransform.y - startPos.y, };
    const groupIds = getDragGroup(draggedBlockId, blockSpace);
    groupIds.forEach(id => {
        const block = blockSpace[id];
        if (block) {
            block.transform.x += delta.x;
            block.transform.y += delta.y;
        }
    });

    // After connecting, tell the new parent to resize its loop to fit.
    updateLoopSize(newParentId);
}

/**
 * **UPDATED**: Now triggers a resize on its parent if its own size changes.
 */
function editBlock(uuid, type, colors, sizes) {
    if (!blockSpace[uuid]) return;
    
    const block = blockSpace[uuid];
    block.type = type;
    block.colors = colors;
    block.sizes = sizes;
    
    const shapeData = blocks.Block(type, colors, sizes);
    block.snapPoints = shapeData.snapPoints;

    generateShape(uuid, type, colors, sizes);

    // After changing this block, update the layout of its direct children.
    updateLayout(uuid);

    // **NEW**: If this block is inside a loop, tell its parent to check for resizing.
    if (block.parent) {
        updateLoopSize(block.parent);
    }
}


function populateSelector(obj) { /* ... unchanged ... */ }

/**
 * **UPDATED**: Removed the slider for loop height and replaced it with a static label.
 */
function updateDimensionSliders() {
    clearSliders();
    if (!targetID || !blockSpace[targetID]) return;
    const currentBlock = blockSpace[targetID];
    const type = currentBlock.type;

    const mainSliders = document.getElementById('main-sliders');
    const addBranchBtn = document.getElementById('addBranch');
    const isBranchBlock = ['block', 'hat', 'end'].includes(type);
    
    if (mainSliders) mainSliders.style.display = isBranchBlock ? 'block' : 'none';
    if (addBranchBtn) addBranchBtn.style.display = isBranchBlock ? 'block' : 'none';

    if (isBranchBlock && currentBlock.sizes[0]) {
        hinput.value = currentBlock.sizes[0].height;
        winput.value = currentBlock.sizes[0].width;
    }

    currentBlock.sizes.forEach((branch, index) => {
        const branchDiv = document.createElement("div");
        branchDiv.className = "branch-slider";
        branchDiv.setAttribute("data-index", index);
      
        let headerHTML = `<h4>${isBranchBlock ? `Branch ${index + 1}` : 'Dimensions'}</h4>`;
        if (isBranchBlock && currentBlock.sizes.length > 1) {
            headerHTML += `<button class="remove-branch" data-index="${index}">Remove Branch</button>`;
        }
        branchDiv.innerHTML = headerHTML;
      
        branchDiv.innerHTML += `
            <label>Height: 
              <input type="range" min="0.5" max="10" step="0.1" value="${branch.height}" data-index="${index}" data-prop="height" class="branch-input">
            </label>
            <label>Width: 
              <input type="range" min="0.5" max="10" step="0.1" value="${branch.width}" data-index="${index}" data-prop="width" class="branch-input">
            </label>`;
        
        if (isBranchBlock) {
            // A branch is a loop if it's not the last one in a multi-branch block.
            const isLoopBranch = currentBlock.sizes.length > 1 && index < currentBlock.sizes.length - 1;
            
            if (isLoopBranch) {
                // **UPDATED**: Show a static label instead of a slider for loop height.
                branchDiv.innerHTML += `<label>Loop Height: ${branch.loop.height.toFixed(1)} (auto)</label>`;
            } else if (index === currentBlock.sizes.length - 1) {
                // This is the end piece, it has no loop. Ensure its loop height is 0.
                if (!branch.loop) branch.loop = {}; // Ensure loop object exists
                branch.loop.height = 0;
            }
        }
      
        slidersContainer.appendChild(branchDiv);
    });
    
    // **UPDATED**: Event listener no longer needs to handle "loop" property.
    document.querySelectorAll(".branch-input").forEach(input => {
      input.addEventListener("input", function() {
        if (!targetID || !blockSpace[targetID]) return;
        const idx = parseInt(this.getAttribute("data-index"));
        const prop = this.getAttribute("data-prop");
        const value = parseFloat(this.value);

        const currentBlock = blockSpace[targetID];
        // The "loop" property is no longer set by a slider.
        currentBlock.sizes[idx][prop] = value;
        if (idx === 0) {
            if (prop === "height") hinput.value = value;
            else if (prop === "width") winput.value = value;
        }
        editBlock(targetID, currentBlock.type, currentBlock.colors, currentBlock.sizes);
      });
    });
    
    document.querySelectorAll(".remove-branch").forEach(button => { /* ... unchanged ... */ });
}


function updateBlockColor() { /* ... unchanged ... */ }
function createBlock(type, colors) { /* ... unchanged ... */ }
function removeBlock(uuid) { /* ... unchanged ... */ }

// --- INITIALIZATION & EVENT LISTENERS ---
if (workSpace) {
    setupWorkspaceViewBox();
    window.addEventListener('resize', setupWorkspaceViewBox);

    drag.makeDraggable(workSpace, blockSpace, onDragEnd, handleDetach);
    
    createBlock("hat");

    // All other event listeners are unchanged.
    color1input.addEventListener("input", updateBlockColor);
    // ... etc. ...
} else {
    console.error("The <svg id='workspace'> element was not found.");
}