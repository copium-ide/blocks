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

// --- DOM ELEMENT REFERENCES ---
const hinput = document.getElementById("h");
const winput = document.getElementById("w");
const typeinput = document.getElementById("type");
const uuidinput = document.getElementById("blockType");
const color1input = document.getElementById("color1");
const color2input = document.getElementById("color2");
const slidersContainer = document.getElementById("sliders");


// ================================================================================= //
// SECTION: UTILITY & HELPER FUNCTIONS
// ================================================================================= //

/**
 * Sets the workspace viewBox to create a 1-to-1 pixel coordinate system.
 */
function setupWorkspaceViewBox() {
    if (!workSpace) return;
    const box = workSpace.getBoundingClientRect();
    workSpace.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
}

/**
 * Recursively gets an array of IDs for a block and all its descendants.
 * @param {string} blockId The ID of the starting block.
 * @param {object} allBlocks The complete collection of all blocks.
 * @returns {string[]} An array of block IDs.
 */
function getDragGroup(blockId, allBlocks) {
    let group = [blockId];
    const block = allBlocks[blockId];
    if (block && block.children) {
        for (const childId of Object.values(block.children)) {
            group = group.concat(getDragGroup(childId, allBlocks));
        }
    }
    return group;
}

/**
 * Renders the visual shape of a block.
 * @param {string} uuid The ID of the block to render.
 * @param {string} type The block's type (e.g., 'hat', 'block').
 * @param {object} colors The inner and outer colors.
 * @param {object[]} sizes The size data for the block's branches.
 */
function generateShape(uuid, type, colors, sizes) {
    const shapeData = blocks.Block(type, colors, sizes);
    const blockElm = document.getElementById(uuid);
    if (blockElm) {
        svg.generate(blockElm, shapeData, APP_SCALE);
    }
}

/**
 * Calculates the total height of a connected chain of blocks in block units.
 * @param {string} startBlockId The ID of the first block in the chain.
 * @returns {number} The total height of the chain.
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
        currentBlock.sizes.forEach(size => {
            totalHeight += size.height;
            if (size.loop && size.loop.height > 0) {
                totalHeight += size.loop.height;
            }
        });
        currentBlockId = currentBlock.children['bottom'];
    }
    return totalHeight;
}


// ================================================================================= //
// SECTION: CORE STATE, LAYOUT, AND PARENTING LOGIC
// ================================================================================= //

/**
 * Travels up the hierarchy from a starting block, telling each parent
 * to re-evaluate its loop sizes. This is the key to fixing nested resizing.
 * @param {string} startBlockId The ID of the block that changed.
 */
function notifyAncestorsOfChange(startBlockId) {
    let currentBlock = blockSpace[startBlockId];
    while (currentBlock && currentBlock.parent) {
        const parentId = currentBlock.parent;
        updateLoopSize(parentId);
        currentBlock = blockSpace[parentId];
    }
}

/**
 * Recursively updates the screen position of all of a block's children.
 * This is called after a parent block moves or changes size.
 * @param {string} parentId The ID of the parent block.
 */
function updateLayout(parentId) {
    const parentBlock = blockSpace[parentId];
    if (!parentBlock || !parentBlock.children) return;

    for (const snapPointName in parentBlock.children) {
        const childId = parentBlock.children[snapPointName];
        const childBlock = blockSpace[childId];
        if (!childBlock) continue;

        const parentMalePoint = parentBlock.snapPoints.find(p => p.name === snapPointName);
        const childFemalePoint = childBlock.snapPoints.find(p => p.role === 'female');
        if (!parentMalePoint || !childFemalePoint) continue;

        // Calculate the child's new correct position relative to the parent.
        const newX = parentBlock.transform.x + (parentMalePoint.x * APP_SCALE) - (childFemalePoint.x * APP_SCALE);
        const newY = parentBlock.transform.y + (parentMalePoint.y * APP_SCALE) - (childFemalePoint.y * APP_SCALE);
        const deltaX = newX - childBlock.transform.x;
        const deltaY = newY - childBlock.transform.y;

        // Move the child and its entire chain of descendants by the calculated delta.
        const groupToMove = getDragGroup(childId, blockSpace);
        groupToMove.forEach(id => {
            const blockToMove = blockSpace[id];
            const blockElm = document.getElementById(id);
            if (blockToMove && blockElm) {
                blockToMove.transform.x += deltaX;
                blockToMove.transform.y += deltaY;
                blockElm.setAttribute('x', blockToMove.transform.x);
                blockElm.setAttribute('y', blockToMove.transform.y);
            }
        });
    }
}

/**
 * Checks if a block has loops and resizes them to fit the content inside.
 * @param {string} loopBlockId The ID of the block that may have loops.
 */
function updateLoopSize(loopBlockId) {
    if (!loopBlockId) return;
    const loopBlock = blockSpace[loopBlockId];
    if (!loopBlock || !loopBlock.sizes) return;

    let needsRedraw = false;
    for (let i = 0; i < loopBlock.sizes.length; i++) {
        const branch = loopBlock.sizes[i];
        if (branch.loop) {
            const innerChainStartId = loopBlock.children['topInner' + i];
            const chainHeight = calculateChainHeight(innerChainStartId);
            const newLoopHeight = chainHeight > 0 ? chainHeight : MIN_LOOP_HEIGHT;
            if (branch.loop.height !== newLoopHeight) {
                branch.loop.height = newLoopHeight;
                needsRedraw = true;
            }
        }
    }

    if (needsRedraw) {
        editBlock(loopBlockId, loopBlock.type, loopBlock.colors, loopBlock.sizes);
    }
}

/**
 * Manages the parent-child data relationship between two blocks.
 * @param {string | null} childId The block becoming the child.
 * @param {string | null} newParentId The block becoming the parent.
 * @param {string | null} parentSnapPointName The name of the parent's snap point to connect to.
 */
function setParent(childId, newParentId, parentSnapPointName) {
    const childBlock = blockSpace[childId];
    if (!childBlock) return;

    // 1. Detach from the old parent.
    const oldParentId = childBlock.parent;
    if (oldParentId && blockSpace[oldParentId]) {
        const oldParent = blockSpace[oldParentId];
        for (const pointName in oldParent.children) {
            if (oldParent.children[pointName] === childId) {
                delete oldParent.children[pointName];
                break;
            }
        }
    }

    // 2. Set the new parent on the child's data model.
    childBlock.parent = newParentId;

    // 3. Attach to the new parent's specific snap point.
    if (newParentId && parentSnapPointName && blockSpace[newParentId]) {
        const newParent = blockSpace[newParentId];
        newParent.children[parentSnapPointName] = childId;
    }
}


// ================================================================================= //
// SECTION: DRAG & DROP EVENT HANDLERS
// ================================================================================= //

/**
 * Callback for when a drag starts on a child block, detaching it from its parent.
 * @param {string} childId The ID of the block being detached.
 */
function handleDetach(childId) {
    const childBlock = blockSpace[childId];
    if (!childBlock) return;
    const oldParentId = childBlock.parent;
    setParent(childId, null, null);
    // After detaching, notify ancestors of the old parent to resize.
    if (oldParentId) {
        notifyAncestorsOfChange(oldParentId);
    }
}

/**
 * Main callback for when a drag operation ends. Routes logic based on snap type.
 * @param {string} draggedBlockId The ID of the block that was dropped.
 * @param {{x: number, y: number}} finalTransform The final X/Y position of the dropped block.
 * @param {object | null} snapInfo Detailed information about the snap, if one occurred.
 */
function onDragEnd(draggedBlockId, finalTransform, snapInfo) {
    // First, update the data model positions of the dragged group.
    // The layout will be corrected by `updateLayout` if a successful snap happened.
    const mainDraggedBlock = blockSpace[draggedBlockId];
    const startPos = mainDraggedBlock.transform;
    const delta = { x: finalTransform.x - startPos.x, y: finalTransform.y - startPos.y };
    getDragGroup(draggedBlockId, blockSpace).forEach(id => {
        if (blockSpace[id]) blockSpace[id].transform = { x: blockSpace[id].transform.x + delta.x, y: blockSpace[id].transform.y + delta.y };
    });

    if (!snapInfo) return; // No snap occurred, block is left floating.

    if (snapInfo.snapType === 'insertion') {
        const { parentId, originalChildId, parentSnapPoint } = snapInfo;
        const draggedBlockBottomPoint = mainDraggedBlock.snapPoints.find(p => p.role === 'male' && p.name === 'bottom');

        if (draggedBlockBottomPoint) {
            setParent(originalChildId, null, null);
            setParent(draggedBlockId, parentId, parentSnapPoint.name);
            setParent(originalChildId, draggedBlockId, draggedBlockBottomPoint.name);
        }
    } else if (snapInfo.snapType === 'append') {
        setParent(draggedBlockId, snapInfo.parentId, snapInfo.parentSnapPoint.name);
    }
    
    // After any successful snap, trigger a full layout/size update from the parent.
    if (snapInfo.parentId) {
        notifyAncestorsOfChange(snapInfo.parentId);
        updateLayout(snapInfo.parentId);
    }
}


// ================================================================================= //
// SECTION: BLOCK CRUD AND UI MANAGEMENT
// ================================================================================= //

/**
 * Updates an existing block's data and triggers all necessary visual refreshes.
 * @param {string} uuid The ID of the block to edit.
 * @param {string} type The new type for the block.
 * @param {object} colors The new colors.
 * @param {object[]} sizes The new size data.
 */
function editBlock(uuid, type, colors, sizes) {
    if (!blockSpace[uuid]) return;
    const block = blockSpace[uuid];
    block.type = type;
    block.colors = colors;
    block.sizes = sizes;
    const shapeData = blocks.Block(type, colors, sizes);
    block.snapPoints = shapeData.snapPoints;

    // Regenerate the block's own shape.
    generateShape(uuid, type, colors, sizes);
    // Reposition all of its children.
    updateLayout(uuid);
    // Notify all of its parents to check if they need to resize.
    notifyAncestorsOfChange(uuid);
}

/**
 * Creates a new block and adds it to the workspace.
 * @param {string} type The type of block to create.
 * @param {object} [colors] Optional color object.
 * @returns The newly created block object.
 */
function createBlock(type, colors = { inner: "#4A90E2", outer: "#196ECF" }) {
    const uuid = crypto.randomUUID();
    if (blockSpace.hasOwnProperty(uuid)) { return createBlock(type, colors); }

    const sizes = [{ height: 1, width: 1, loop: { height: 1 } }];
    const block = {
        type: type, uuid: uuid, colors: colors, sizes: sizes,
        transform: { x: 420, y: 50 }, parent: null, children: {}
    };
    block.snapPoints = blocks.Block(type, colors, sizes).snapPoints;
    blockSpace[uuid] = block;

    const blockELM = document.createElementNS("http://www.w3.org/2000/svg", 'svg');
    blockELM.id = uuid;
    blockELM.setAttribute("blocktype", type);
    blockELM.setAttribute('x', block.transform.x);
    blockELM.setAttribute('y', block.transform.y);
    workSpace.appendChild(blockELM);
    generateShape(uuid, type, colors, sizes);

    populateSelector(blockSpace);
    uuidinput.value = uuid;
    targetID = uuid;
    updateDimensionSliders();
    return block;
}

/**
 * Removes a block and all of its children from the workspace.
 * @param {string} uuid The ID of the block to remove.
 */
function removeBlock(uuid) {
    if (!blockSpace[uuid]) return;
    const groupToRemove = getDragGroup(uuid, blockSpace);
    handleDetach(uuid);
    groupToRemove.forEach(idToRemove => {
        if (blockSpace[idToRemove]) {
            delete blockSpace[idToRemove];
            const blockELM = document.getElementById(idToRemove);
            if (blockELM) blockELM.remove();
        }
    });
    if (groupToRemove.includes(targetID)) {
        const remainingKeys = Object.keys(blockSpace);
        targetID = remainingKeys.length > 0 ? remainingKeys[0] : null;
        uuidinput.value = targetID;
        updateDimensionSliders();
    }
    populateSelector(blockSpace);
}

/**
 * Populates the block selection dropdown menu from the current `blockSpace`.
 * @param {object} obj The `blockSpace` object.
 */
function populateSelector(obj) {
    const currentVal = uuidinput.value;
    uuidinput.innerHTML = '';
    for (const key in obj) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = `${obj[key].type} (${key.substring(0, 8)})`;
        uuidinput.appendChild(option);
    }
    uuidinput.value = obj[currentVal] ? currentVal : (Object.keys(obj)[0] || '');
}

/**
 * Updates the UI sliders in the control panel based on the currently selected block.
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
        let headerHTML = `<h4>${isBranchBlock ? `Branch ${index + 1}` : 'Dimensions'}</h4>`;
        if (isBranchBlock && currentBlock.sizes.length > 1) {
            headerHTML += `<button class="remove-branch" data-index="${index}">X</button>`;
        }
        branchDiv.innerHTML = headerHTML + `
            <label>Height: <input type="range" min="0.5" max="10" step="0.1" value="${branch.height}" data-index="${index}" data-prop="height" class="branch-input"></label>
            <label>Width: <input type="range" min="0.5" max="10" step="0.1" value="${branch.width}" data-index="${index}" data-prop="width" class="branch-input"></label>`;
        
        if (isBranchBlock && currentBlock.sizes.length > 1 && index < currentBlock.sizes.length - 1) {
            branchDiv.innerHTML += `<label>Loop Height: ${branch.loop.height.toFixed(1)} (auto)</label>`;
        }
        slidersContainer.appendChild(branchDiv);
    });

    document.querySelectorAll(".branch-input").forEach(input => {
        input.addEventListener("input", () => editBlockFromSlider(input));
    });

    document.querySelectorAll(".remove-branch").forEach(button => {
        button.addEventListener("click", () => {
            const idx = parseInt(button.getAttribute("data-index"));
            const sizes = blockSpace[targetID].sizes;
            if (sizes.length > 1) {
                sizes.splice(idx, 1);
                updateDimensionSliders();
                editBlock(targetID, blockSpace[targetID].type, blockSpace[targetID].colors, sizes);
            }
        });
    });
}

/**
 * Helper function to handle slider input events.
 * @param {HTMLInputElement} slider The slider that triggered the event.
 */
function editBlockFromSlider(slider) {
    if (!targetID || !blockSpace[targetID]) return;
    const idx = parseInt(slider.getAttribute("data-index"));
    const prop = slider.getAttribute("data-prop");
    const value = parseFloat(slider.value);
    const block = blockSpace[targetID];
    block.sizes[idx][prop] = value;
    if (idx === 0) { // Sync top-level sliders
        if (prop === "height") hinput.value = value;
        else if (prop === "width") winput.value = value;
    }
    editBlock(targetID, block.type, block.colors, block.sizes);
}


// ================================================================================= //
// SECTION: INITIALIZATION AND GLOBAL EVENT LISTENERS
// ================================================================================= //

if (workSpace) {
    setupWorkspaceViewBox();
    window.addEventListener('resize', setupWorkspaceViewBox);

    drag.makeDraggable(workSpace, blockSpace, onDragEnd, handleDetach);
    createBlock("hat");

    // --- Control Panel Event Listeners ---
    color1input.addEventListener("input", () => editBlockFromSlider(color1input));
    color2input.addEventListener("input", () => editBlockFromSlider(color2input));
    
    typeinput.addEventListener("change", () => {
        if (targetID) editBlock(targetID, typeinput.value, blockSpace[targetID].colors, blockSpace[targetID].sizes);
        updateDimensionSliders();
    });

    uuidinput.addEventListener("change", () => {
        targetID = uuidinput.value;
        if(targetID) typeinput.value = blockSpace[targetID].type;
        updateDimensionSliders();
    });

    hinput.addEventListener("input", () => editBlockFromSlider(hinput));
    winput.addEventListener("input", () => editBlockFromSlider(winput));

    document.getElementById('addBranch').addEventListener('click', () => {
        if (targetID) {
            blockSpace[targetID].sizes.push({ height: 1, width: 1, loop: { height: 1 } });
            editBlock(targetID, blockSpace[targetID].type, blockSpace[targetID].colors, blockSpace[targetID].sizes);
            updateDimensionSliders();
        }
    });

    document.getElementById('create').addEventListener('click', () => createBlock(typeinput.value));
    document.getElementById('remove').addEventListener('click', () => { if (targetID) removeBlock(targetID); });

} else {
    console.error("The <svg id='workspace'> element was not found.");
}