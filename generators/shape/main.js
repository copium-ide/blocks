import * as blocks from './blocks.js';
import * as svg from './svg.js';
import * as drag from './drag.js';

// --- Configuration ---
export const APP_SCALE = 8;
const MIN_LOOP_HEIGHT = 0.5;

// --- DOM Element References ---
function getElements() {
    return {
        workSpace: document.getElementById('workspace'),
        slidersContainer: document.getElementById("sliders"),
        mainSliders: document.getElementById('main-sliders'),
        addBranchBtn: document.getElementById('addBranch'),
        createBtn: document.getElementById('create'),
        removeBtn: document.getElementById('remove'),
        hinput: document.getElementById("h"),
        winput: document.getElementById("w"),
        typeinput: document.getElementById("type"),
        uuidinput: document.getElementById("blockType"),
        color1input: document.getElementById("color1"),
        color2input: document.getElementById("color2"),
    };
}
const dom = getElements();

// --- Application State ---
const appState = {
    blockSpace: {},
    targetID: null,
};

// --- Utility Functions ---

function clearNode(node) {
    if (!node) return;
    while (node.firstChild) {
        node.removeChild(node.firstChild);
    }
}

function setupWorkspaceViewBox() {
    if (!dom.workSpace) return;
    const box = dom.workSpace.getBoundingClientRect();
    dom.workSpace.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
}

function getDragGroup(blockId, allBlocks, group = []) {
    group.push(blockId);
    const block = allBlocks[blockId];
    if (block && block.children) {
        for (const childId of Object.values(block.children)) {
            getDragGroup(childId, allBlocks, group);
        }
    }
    return group;
}

// --- Block Data & Rendering Logic ---

function generateShape(uuid, type, colors, sizes) {
    const shapeData = blocks.Block(type, colors, sizes);
    const blockElm = document.getElementById(uuid);
    if (blockElm) {
        svg.generate(blockElm, shapeData, APP_SCALE);
    }
}


// --- Core Sizing, Layout, and Refresh Logic ---

function getBlockVisualHeight(blockId) {
    const block = appState.blockSpace[blockId];
    if (!block) return 0;
    let height = 0;
    block.sizes.forEach(branch => {
        height += branch.height;
    });
    return height;
}

function calculateChainHeight(startBlockId) {
    if (!startBlockId) return 0;
    let totalHeight = 0;
    let currentBlockId = startBlockId;
    while (currentBlockId) {
        totalHeight += getBlockVisualHeight(currentBlockId);
        const currentBlock = appState.blockSpace[currentBlockId];
        currentBlockId = currentBlock?.children['bottom'];
    }
    return totalHeight;
}

/**
 * Updates the loop size data for a single block.
 * Does NOT trigger a render itself; it only mutates the data model.
 */
function updateLoopBranchHeight(loopBlockId) {
    const loopBlock = appState.blockSpace[loopBlockId];
    if (!loopBlock || !loopBlock.sizes?.some(s => s.loop)) {
        return;
    }

    let hasChanged = false;
    loopBlock.sizes.forEach((branch, i) => {
        if (branch.loop) {
            const innerChainStartId = loopBlock.children['topInner' + i];
            const chainHeight = calculateChainHeight(innerChainStartId);
            const newLoopHeight = chainHeight > 0 ? chainHeight : MIN_LOOP_HEIGHT;
            if (branch.loop.height !== newLoopHeight) {
                branch.loop.height = newLoopHeight;
                hasChanged = true;
            }
        }
    });

    if (hasChanged) {
        // If the size changed, the snap points need to be recalculated.
        loopBlock.snapPoints = blocks.Block(loopBlock.type, loopBlock.colors, loopBlock.sizes).snapPoints;
    }
}

function setParent(childId, newParentId, parentSnapPointName) {
    const childBlock = appState.blockSpace[childId];
    if (!childBlock) return;

    const oldParentId = childBlock.parent;
    if (oldParentId && appState.blockSpace[oldParentId]) {
        const oldParent = appState.blockSpace[oldParentId];
        for (const pointName in oldParent.children) {
            if (oldParent.children[pointName] === childId) {
                delete oldParent.children[pointName];
                break;
            }
        }
    }

    childBlock.parent = newParentId;
    if (newParentId && parentSnapPointName && appState.blockSpace[newParentId]) {
        appState.blockSpace[newParentId].children[parentSnapPointName] = childId;
    }
}

function updateLayout(startBlockId) {
    const parentBlock = appState.blockSpace[startBlockId];
    if (!parentBlock || !parentBlock.children) return;

    for (const snapPointName in parentBlock.children) {
        const childId = parentBlock.children[snapPointName];
        const childBlock = appState.blockSpace[childId];
        if (!childBlock) continue;

        const parentMalePoint = parentBlock.snapPoints.find(p => p.name === snapPointName);
        const childFemalePoint = childBlock.snapPoints.find(p => p.role === 'female');
        if (!parentMalePoint || !childFemalePoint) continue;

        const newX = parentBlock.transform.x + (parentMalePoint.x * APP_SCALE) - (childFemalePoint.x * APP_SCALE);
        const newY = parentBlock.transform.y + (parentMalePoint.y * APP_SCALE) - (childFemalePoint.y * APP_SCALE);
        
        const groupToMove = getDragGroup(childId, appState.blockSpace, []);
        const deltaX = newX - childBlock.transform.x;
        const deltaY = newY - childBlock.transform.y;
        
        groupToMove.forEach(id => {
            const blockToMove = appState.blockSpace[id];
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
 * The new single source of truth for refreshing the entire workspace.
 * This is called after any data model change.
 */
function refreshAll() {
    // 1. Update all data models first (loop sizes).
    for (const id in appState.blockSpace) {
        updateLoopBranchHeight(id);
    }

    // 2. Redraw all SVG shapes with their new, correct sizes.
    for (const id in appState.blockSpace) {
        const block = appState.blockSpace[id];
        generateShape(id, block.type, block.colors, block.sizes);
    }

    // 3. Update all layouts (positions).
    for (const id in appState.blockSpace) {
        updateLayout(id);
    }

    // 4. Refresh the UI controls for the selected block.
    renderDimensionSliders();
}

// --- UI Update Functions ---

function populateSelector() {
    if (!dom.uuidinput) return;
    const currentVal = dom.uuidinput.value;
    clearNode(dom.uuidinput);

    for (const key in appState.blockSpace) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = `${appState.blockSpace[key].type} (${key.substring(0, 8)})`;
        dom.uuidinput.appendChild(option);
    }
    dom.uuidinput.value = appState.blockSpace[currentVal] ? currentVal : (Object.keys(appState.blockSpace)[0] || '');
}

function renderDimensionSliders() {
    if (!dom.slidersContainer) return;
    clearNode(dom.slidersContainer);
    if (!appState.targetID || !appState.blockSpace[appState.targetID]) return;

    const currentBlock = appState.blockSpace[appState.targetID];
    const { type, sizes } = currentBlock;
    const isBranchBlock = ['block', 'hat', 'end'].includes(type);
    
    if (dom.mainSliders) dom.mainSliders.style.display = isBranchBlock ? 'block' : 'none';
    if (dom.addBranchBtn) dom.addBranchBtn.style.display = isBranchBlock ? 'block' : 'none';

    sizes.forEach((branch, index) => {
        const branchDiv = document.createElement("div");
        branchDiv.className = "branch-slider";
        
        let headerHTML = `<h4>${isBranchBlock ? `Branch ${index + 1}` : 'Dimensions'}</h4>`;
        if (isBranchBlock && sizes.length > 1) {
            headerHTML += `<button class="remove-branch" data-index="${index}" title="Remove Branch">X</button>`;
        }

        branchDiv.innerHTML = headerHTML + `
            <label>Height: <input type="range" min="0.5" max="10" step="0.1" value="${branch.height}" data-index="${index}" data-prop="height" class="branch-input"></label>
            <label>Width: <input type="range" min="0.5" max="10" step="0.1" value="${branch.width}" data-index="${index}" data-prop="width" class="branch-input"></label>`;
        
        if (branch.loop) {
            branchDiv.innerHTML += `<label>Loop Height: ${branch.loop.height.toFixed(1)} (auto)</label>`;
        }
        dom.slidersContainer.appendChild(branchDiv);
    });
}

// --- Core Application Logic / "Actions" ---

function editBlock(uuid, updates) {
    const block = appState.blockSpace[uuid];
    if (!block) return;
    Object.assign(block, updates);
    refreshAll();
}

function createBlock(type, colors = { inner: "#4A90E2", outer: "#196ECF" }) {
    let uuid;
    do { uuid = crypto.randomUUID(); } while (appState.blockSpace.hasOwnProperty(uuid));
    
    const sizes = [{ height: 1, width: 1, loop: { height: MIN_LOOP_HEIGHT } }];
    const block = {
        type: type, uuid: uuid, colors: colors, sizes: sizes, snapPoints: [],
        transform: { x: 420, y: 50 }, parent: null, children: {}
    };
    appState.blockSpace[uuid] = block;

    const blockELM = document.createElementNS("http://www.w3.org/2000/svg", 'svg');
    blockELM.id = uuid;
    blockELM.setAttribute("blocktype", type);
    blockELM.setAttribute('x', block.transform.x);
    blockELM.setAttribute('y', block.transform.y);
    dom.workSpace.appendChild(blockELM);
    
    appState.targetID = uuid;
    populateSelector();
    refreshAll();
    
    return block;
}

function removeBlock(uuid) {
    if (!appState.blockSpace[uuid]) return;
    handleDetach(uuid);
    const groupToRemove = getDragGroup(uuid, appState.blockSpace, []);

    groupToRemove.forEach(idToRemove => {
        if (appState.blockSpace[idToRemove]) {
            delete appState.blockSpace[idToRemove];
            document.getElementById(idToRemove)?.remove();
        }
    });

    if (groupToRemove.includes(appState.targetID)) {
        const remainingKeys = Object.keys(appState.blockSpace);
        appState.targetID = remainingKeys.length > 0 ? remainingKeys[0] : null;
    }
    
    populateSelector();
    refreshAll();
}

// --- Drag and Drop Handlers ---

function onSnapPreview(snapInfo, draggedBlockId) {
    // This can be simplified or removed with the global refresh model,
    // but a live preview is still a good user experience.
    // It's a temporary visual change that doesn't affect the core data model.
    const parentBlock = appState.blockSpace[snapInfo.parentId];
    if (!parentBlock) return;

    const tempSizes = JSON.parse(JSON.stringify(parentBlock.sizes));
    let hasChanged = false;
    tempSizes.forEach((branch, i) => {
        if(branch.loop && ('topInner' + i) === snapInfo.parentSnapPoint.name) {
            const currentChainHeight = calculateChainHeight(parentBlock.children['topInner' + i]);
            const newChainHeight = currentChainHeight + calculateChainHeight(draggedBlockId);
            const newLoopHeight = newChainHeight > 0 ? newChainHeight : MIN_LOOP_HEIGHT;
            if(branch.loop.height !== newLoopHeight) {
                branch.loop.height = newLoopHeight;
                hasChanged = true;
            }
        }
    });

    if(hasChanged) {
        generateShape(snapInfo.parentId, parentBlock.type, parentBlock.colors, tempSizes);
    }
}

function onSnapPreviewEnd(snapInfo) {
    // When the preview ends, just redraw the parent block with its original, correct data.
    const parentBlock = appState.blockSpace[snapInfo.parentId];
    if (parentBlock) {
        generateShape(snapInfo.parentId, parentBlock.type, parentBlock.colors, parentBlock.sizes);
    }
}

function handleDetach(childId) {
    const childBlock = appState.blockSpace[childId];
    if (!childBlock || !childBlock.parent) return;
    setParent(childId, null, null);
    refreshAll();
}

function onDragEnd(draggedBlockId, finalTransform, snapInfo) {
    const mainDraggedBlock = appState.blockSpace[draggedBlockId];
    if (!mainDraggedBlock) return;

    if (snapInfo) {
        // A snap occurred. Mutate the data model and do a global refresh.
        if (snapInfo.snapType === 'insertion') {
            const { parentId, originalChildId, parentSnapPoint } = snapInfo;
            const draggedBlockBottomPoint = mainDraggedBlock.snapPoints.find(p => p.role === 'male' && p.name === 'bottom');
            if (draggedBlockBottomPoint) {
                setParent(originalChildId, draggedBlockId, draggedBlockBottomPoint.name);
                setParent(draggedBlockId, parentId, parentSnapPoint.name);
            }
        } else if (snapInfo.snapType === 'append') {
            setParent(draggedBlockId, snapInfo.parentId, snapInfo.parentSnapPoint.name);
        }
        refreshAll();
    } else {
        // No snap, just a free drag. Update positions directly without a global refresh.
        const startPos = mainDraggedBlock.transform;
        const delta = { x: finalTransform.x - startPos.x, y: finalTransform.y - startPos.y };
        const groupToMove = getDragGroup(draggedBlockId, appState.blockSpace, []);

        groupToMove.forEach(id => {
            const blockToMove = appState.blockSpace[id];
            if (blockToMove) {
                blockToMove.transform.x += delta.x;
                blockToMove.transform.y += delta.y;
                document.getElementById(id)?.setAttribute('x', blockToMove.transform.x);
                document.getElementById(id)?.setAttribute('y', blockToMove.transform.y);
            }
        });
    }
}

// --- Event Listener Setup ---

function setupEventListeners() {
    window.addEventListener('resize', setupWorkspaceViewBox);

    if (dom.slidersContainer) {
        dom.slidersContainer.addEventListener('input', (event) => {
            if (!event.target.matches('.branch-input') || !appState.targetID) return;
            const block = appState.blockSpace[appState.targetID];
            const idx = parseInt(event.target.getAttribute("data-index"));
            const prop = event.target.getAttribute("data-prop");
            const value = parseFloat(event.target.value);
            const newSizes = JSON.parse(JSON.stringify(block.sizes)); // Deep copy
            newSizes[idx][prop] = value;
            editBlock(appState.targetID, { sizes: newSizes });
        });

        dom.slidersContainer.addEventListener('click', (event) => {
            if (!event.target.matches('.remove-branch') || !appState.targetID) return;
            const idx = parseInt(event.target.getAttribute("data-index"));
            const block = appState.blockSpace[appState.targetID];
            if (block.sizes.length > 1) {
                const newSizes = block.sizes.filter((_, index) => index !== idx);
                editBlock(appState.targetID, { sizes: newSizes });
            }
        });
    }
    
    const controls = [dom.color1input, dom.color2input, dom.typeinput];
    controls.forEach(input => {
        if (!input) return;
        const eventType = input.matches('select') ? 'change' : 'input';
        input.addEventListener(eventType, () => {
            if (!appState.targetID) return;
            const updates = {};
            if (input === dom.typeinput) updates.type = dom.typeinput.value;
            else if (input === dom.color1input || input === dom.color2input) updates.colors = { inner: dom.color1input.value, outer: dom.color2input.value };
            editBlock(appState.targetID, updates);
        });
    });

    if (dom.uuidinput) {
        dom.uuidinput.addEventListener("change", () => {
            appState.targetID = dom.uuidinput.value;
            const block = appState.blockSpace[appState.targetID];
            if (block) {
                dom.typeinput.value = block.type;
                dom.color1input.value = block.colors.inner;
                dom.color2input.value = block.colors.outer;
            }
            renderDimensionSliders();
        });
    }
    
    if (dom.addBranchBtn) {
        dom.addBranchBtn.addEventListener('click', () => {
            if (!appState.targetID) return;
            const block = appState.blockSpace[appState.targetID];
            const newSizes = [...block.sizes, { height: 1, width: 1, loop: { height: MIN_LOOP_HEIGHT } }];
            editBlock(appState.targetID, { sizes: newSizes });
        });
    }

    if (dom.createBtn) dom.createBtn.addEventListener('click', () => createBlock(dom.typeinput.value));
    if (dom.removeBtn) dom.removeBtn.addEventListener('click', () => { if (appState.targetID) removeBlock(appState.targetID); });
}

// --- Main Application Entry Point ---

function main() {
    if (!dom.workSpace) {
        console.error("The <svg id='workspace'> element was not found. Application cannot start.");
        return;
    }

    setupWorkspaceViewBox();
    setupEventListeners();
    
    drag.makeDraggable(dom.workSpace, appState.blockSpace, onDragEnd, handleDetach, onSnapPreview, onSnapPreviewEnd);

    createBlock("hat");
}

main();