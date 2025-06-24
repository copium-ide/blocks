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

/**
 * Sets the workspace viewBox to match its pixel dimensions.
 */
function setupWorkspaceViewBox() {
    if (!workSpace) return;
    const box = workSpace.getBoundingClientRect();
    workSpace.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
}

/**
 * Recursively gets an array of IDs for a block and all its descendants.
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
 * Renders the shape of a block using the svg.js generator.
 */
function generateShape(uuid, type, colors, sizes) {
    const shapeData = blocks.Block(type, colors, sizes);
    const blockElm = document.getElementById(uuid);
    if (blockElm) {
        svg.generate(blockElm, shapeData, APP_SCALE);
    }
}

/**
 * Clears all dynamically generated dimension sliders.
 */
function clearSliders() {
    if (slidersContainer) slidersContainer.innerHTML = '';
}

/**
 * Calculates the total height of a connected chain of blocks.
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
 * Recursively updates the position of all children of a given block.
 * This is called after a block's size changes.
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

        const newX = parentBlock.transform.x + (parentMalePoint.x * APP_SCALE) - (childFemalePoint.x * APP_SCALE);
        const newY = parentBlock.transform.y + (parentMalePoint.y * APP_SCALE) - (childFemalePoint.y * APP_SCALE);

        const deltaX = newX - childBlock.transform.x;
        const deltaY = newY - childBlock.transform.y;

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
 * Checks a block for inner chains and resizes its loops to fit.
 */
function updateLoopSize(loopBlockId) {
    if (!loopBlockId) return;

    const loopBlock = blockSpace[loopBlockId];
    if (!loopBlock || !loopBlock.sizes) return;

    let needsRedraw = false;
    for (let i = 0; i < loopBlock.sizes.length; i++) {
        const branch = loopBlock.sizes[i];
        const innerChainSnapName = 'topInner' + i;

        if (branch.loop) {
            const innerChainStartId = loopBlock.children[innerChainSnapName];
            let chainHeight = calculateChainHeight(innerChainStartId);
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
 * Manages parent-child relationships using the new data model.
 */
function setParent(childId, newParentId, parentSnapPointName) {
    const childBlock = blockSpace[childId];
    if (!childBlock) return;

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

    childBlock.parent = newParentId;

    if (newParentId && parentSnapPointName && blockSpace[newParentId]) {
        const newParent = blockSpace[newParentId];
        newParent.children[parentSnapPointName] = childId;
    }
}

/**
 * Callback handler for when a drag starts on a child block.
 */
function handleDetach(childId) {
    const childBlock = blockSpace[childId];
    if (!childBlock) return;

    const oldParentId = childBlock.parent;
    setParent(childId, null, null);
    updateLoopSize(oldParentId);
}

/**
 * **UPDATED**: Callback for when a drag operation ends.
 */
function onDragEnd(draggedBlockId, finalTransform, snapInfo) {
    const mainDraggedBlock = blockSpace[draggedBlockId];
    if (!mainDraggedBlock) return;

    const newParentId = snapInfo ? snapInfo.targetId : null;
    const parentSnapPointName = snapInfo ? snapInfo.malePoint.name : null;
    setParent(draggedBlockId, newParentId, parentSnapPointName);

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

    if (newParentId) {
        updateLoopSize(newParentId);
        // **FIX**: After snapping and potentially resizing the parent, we must
        // explicitly recalculate the layout for all of the parent's children.
        // This ensures the new child snaps to the perfect final position.
        updateLayout(newParentId);
    }
}

/**
 * Updates an existing block's data and regenerates its shape and layout.
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

    updateLayout(uuid);

    if (block.parent) {
        updateLoopSize(block.parent);
    }
}

/**
 * Populates the block selection dropdown menu.
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
    if (obj[currentVal]) {
        uuidinput.value = currentVal;
    }
}

/**
 * Updates the UI sliders based on the currently selected block.
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
            const isLoopBranch = currentBlock.sizes.length > 1 && index < currentBlock.sizes.length - 1;

            if (isLoopBranch) {
                branchDiv.innerHTML += `<label>Loop Height: ${branch.loop.height.toFixed(1)} (auto)</label>`;
            } else if (index === currentBlock.sizes.length - 1) {
                if (!branch.loop) branch.loop = {};
                branch.loop.height = 0;
            }
        }

        slidersContainer.appendChild(branchDiv);
    });

    document.querySelectorAll(".branch-input").forEach(input => {
        input.addEventListener("input", function () {
            if (!targetID || !blockSpace[targetID]) return;
            const idx = parseInt(this.getAttribute("data-index"));
            const prop = this.getAttribute("data-prop");
            const value = parseFloat(this.value);

            const currentBlock = blockSpace[targetID];
            currentBlock.sizes[idx][prop] = value;
            if (idx === 0) {
                if (prop === "height") hinput.value = value;
                else if (prop === "width") winput.value = value;
            }
            editBlock(targetID, currentBlock.type, currentBlock.colors, currentBlock.sizes);
        });
    });

    document.querySelectorAll(".remove-branch").forEach(button => {
        button.addEventListener("click", function () {
            if (!targetID || !blockSpace[targetID]) return;
            const idx = parseInt(this.getAttribute("data-index"));
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
 * Updates the color of the currently selected block.
 */
function updateBlockColor() {
    if (targetID && blockSpace[targetID]) {
        const block = blockSpace[targetID];
        block.colors = { inner: color1input.value, outer: color2input.value };
        editBlock(targetID, block.type, block.colors, block.sizes);
    }
}

/**
 * Creates a new block and adds it to the workspace.
 */
function createBlock(type, colors = { inner: "#4A90E2", outer: "#196ECF" }) {
    const uuid = crypto.randomUUID();
    if (blockSpace.hasOwnProperty(uuid)) {
        return createBlock(type, colors);
    }

    const sizes = [{ height: 1, width: 1, loop: { height: 1 } }];
    const block = {
        type: type,
        uuid: uuid,
        colors: colors,
        sizes: sizes,
        transform: { x: 420, y: 50 },
        parent: null,
        children: {}
    };

    const shapeData = blocks.Block(type, colors, sizes);
    block.snapPoints = shapeData.snapPoints;
    blockSpace[uuid] = block;

    const blockELM = document.createElementNS("http://www.w3.org/2000/svg", 'svg');
    blockELM.id = uuid;
    blockELM.setAttribute("blocktype", type);
    blockELM.setAttribute('x', block.transform.x);
    blockELM.setAttribute('y', block.transform.y);

    workSpace.appendChild(blockELM);
    generateShape(uuid, type, colors, sizes);

    populateSelector(blockSpace);
    document.getElementById('blockType').value = uuid;
    targetID = uuid;
    updateDimensionSliders();
    return block;
}

/**
 * Removes a block and all of its children from the workspace.
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
        if (targetID) {
            document.getElementById('blockType').value = targetID;
        } else {
            uuidinput.innerHTML = '';
        }
        updateDimensionSliders();
    }
    populateSelector(blockSpace);
}


// --- INITIALIZATION & EVENT LISTENERS ---
if (workSpace) {
    setupWorkspaceViewBox();
    window.addEventListener('resize', setupWorkspaceViewBox);

    drag.makeDraggable(workSpace, blockSpace, onDragEnd, handleDetach);

    createBlock("hat");

    color1input.addEventListener("input", updateBlockColor);
    color2input.addEventListener("input", updateBlockColor);

    typeinput.addEventListener("change", () => {
        if (targetID && blockSpace[targetID]) {
            const block = blockSpace[targetID];
            editBlock(targetID, typeinput.value, block.colors, block.sizes);
            updateDimensionSliders();
        }
    });

    uuidinput.addEventListener("change", () => {
        targetID = uuidinput.value;
        updateDimensionSliders();
    });

    hinput.addEventListener("input", () => {
        if (targetID && blockSpace[targetID]) {
            const block = blockSpace[targetID];
            block.sizes[0].height = parseFloat(hinput.value);
            updateDimensionSliders();
            editBlock(targetID, block.type, block.colors, block.sizes);
        }
    });

    winput.addEventListener("input", () => {
        if (targetID && blockSpace[targetID]) {
            const block = blockSpace[targetID];
            block.sizes[0].width = parseFloat(winput.value);
            updateDimensionSliders();
            editBlock(targetID, block.type, block.colors, block.sizes);
        }
    });

    document.getElementById('addBranch').addEventListener('click', () => {
        if (targetID && blockSpace[targetID]) {
            blockSpace[targetID].sizes.push({ height: 1, width: 1, loop: { height: 1 } });
            updateDimensionSliders();
            editBlock(targetID, blockSpace[targetID].type, blockSpace[targetID].colors, blockSpace[targetID].sizes);
        }
    });

    document.getElementById('create').addEventListener('click', () => {
        createBlock(typeinput.value);
    });

    document.getElementById('remove').addEventListener('click', () => {
        if (targetID) {
            removeBlock(targetID);
        }
    });

} else {
    console.error("The <svg id='workspace'> element was not found.");
}