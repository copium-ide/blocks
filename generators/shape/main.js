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

// --- Application State (Single Source of Truth) ---
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

function findAncestorLoop(startBlockId, allBlocks) {
    let childId = null;
    let currentId = startBlockId;

    while (currentId) {
        const currentBlock = allBlocks[currentId];
        if (!currentBlock) return null;

        if (currentBlock.sizes?.some(s => s.loop)) {
            for (const snapName in currentBlock.children) {
                if (snapName.startsWith('topInner') && currentBlock.children[snapName] === childId) {
                    return { loopBlock: currentBlock, innerSnapName: snapName };
                }
            }
        }
        childId = currentId;
        currentId = currentBlock.parent;
    }
    return null;
}


// --- Layout Calculation Logic (Reads from state) ---

function getBlockVisualHeight(blockId) {
    const block = appState.blockSpace[blockId];
    if (!block) return 0;
    return block.sizes.reduce((sum, branch) => sum + branch.height, 0);
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

function recalculateAllLayouts() {
    const topLevelBlocks = Object.values(appState.blockSpace).filter(b => !b.parent);

    function updateChain(blockId) {
        const block = appState.blockSpace[blockId];
        if (!block) return;

        if (block.sizes?.some(s => s.loop)) {
            const newSizes = block.sizes.map(s => ({ ...s }));
            let needsSnapPointUpdate = false;
            for (let i = 0; i < newSizes.length; i++) {
                const branch = newSizes[i];
                if (branch.loop) {
                    const innerChainStartId = block.children['topInner' + i];
                    const newLoopHeight = calculateChainHeight(innerChainStartId) || MIN_LOOP_HEIGHT;
                    if (branch.loop.height !== newLoopHeight) {
                        branch.loop.height = newLoopHeight;
                        needsSnapPointUpdate = true;
                    }
                }
            }
            if (needsSnapPointUpdate) {
                block.sizes = newSizes;
                block.snapPoints = blocks.Block(block.type, block.colors, block.sizes).snapPoints;
            }
        }

        for (const snapPointName in block.children) {
            const childId = block.children[snapPointName];
            const childBlock = appState.blockSpace[childId];
            if (!childBlock) continue;

            const parentMalePoint = block.snapPoints.find(p => p.name === snapPointName);
            const childFemalePoint = childBlock.snapPoints.find(p => p.role === 'female');
            if (!parentMalePoint || !childFemalePoint) continue;

            childBlock.transform.x = block.transform.x + (parentMalePoint.x * APP_SCALE) - (childFemalePoint.x * APP_SCALE);
            childBlock.transform.y = block.transform.y + (parentMalePoint.y * APP_SCALE) - (childFemalePoint.y * APP_SCALE);

            updateChain(childId);
        }
    }

    topLevelBlocks.forEach(block => updateChain(block.uuid));
}


// --- Rendering Logic (Reads from state, writes to DOM) ---

function render() {
    recalculateAllLayouts();
    renderBlocks();
    renderDimensionSliders();
    populateSelector();
}

function generateShape(uuid, type, colors, sizes) {
    const shapeData = blocks.Block(type, colors, sizes);
    const blockElm = document.getElementById(uuid);
    if (blockElm) {
        svg.generate(blockElm, shapeData, APP_SCALE);
    }
}

function renderBlocks() {
    const existingBlockIds = new Set(Array.from(dom.workSpace.querySelectorAll('svg[blocktype]')).map(el => el.id));
    const stateBlockIds = new Set(Object.keys(appState.blockSpace));

    for (const id of existingBlockIds) {
        if (!stateBlockIds.has(id)) {
            document.getElementById(id)?.remove();
        }
    }

    for (const id of stateBlockIds) {
        const blockData = appState.blockSpace[id];
        let blockElm = document.getElementById(id);

        if (!blockElm) {
            blockElm = document.createElementNS("http://www.w3.org/2000/svg", 'svg');
            blockElm.id = id;
            blockElm.setAttribute("blocktype", blockData.type);
            dom.workSpace.appendChild(blockElm);
        }

        blockElm.setAttribute('x', blockData.transform.x);
        blockElm.setAttribute('y', blockData.transform.y);
        generateShape(id, blockData.type, blockData.colors, blockData.sizes);
    }
}

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
    dom.uuidinput.value = appState.blockSpace[currentVal] ? currentVal : (appState.targetID || '');
}

function renderDimensionSliders() {
    if (!dom.slidersContainer) return;
    clearNode(dom.slidersContainer);
    const currentBlock = appState.blockSpace[appState.targetID];
    if (!currentBlock) {
        if (dom.mainSliders) dom.mainSliders.style.display = 'none';
        if (dom.addBranchBtn) dom.addBranchBtn.style.display = 'none';
        return;
    }

    const { type, sizes } = currentBlock;
    const isBranchBlock = ['block', 'hat', 'end'].includes(type);

    if (dom.mainSliders) dom.mainSliders.style.display = isBranchBlock ? 'block' : 'none';
    if (dom.addBranchBtn) dom.addBranchBtn.style.display = isBranchBlock ? 'block' : 'none';

    sizes.forEach((branch, index) => {
        const branchDiv = document.createElement("div");
        branchDiv.className = "branch-slider";

        const header = document.createElement('h4');
        header.textContent = isBranchBlock ? `Branch ${index + 1}` : 'Dimensions';
        branchDiv.appendChild(header);

        if (isBranchBlock && sizes.length > 1) {
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-branch';
            removeBtn.title = 'Remove Branch';
            removeBtn.textContent = 'X';
            removeBtn.dataset.index = index;
            header.appendChild(removeBtn);
        }

        const createSlider = (labelText, prop, min, max, step, value) => {
            const label = document.createElement('label');
            label.textContent = `${labelText}: `;
            const input = document.createElement('input');
            input.type = 'range';
            input.min = min; input.max = max; input.step = step; input.value = value;
            input.dataset.index = index; input.dataset.prop = prop;
            input.className = 'branch-input';
            label.appendChild(input);
            return label;
        };

        branchDiv.appendChild(createSlider('Height', 'height', 0.5, 10, 0.1, branch.height));
        branchDiv.appendChild(createSlider('Width', 'width', 0.5, 10, 0.1, branch.width));

        if (branch.loop) {
            const loopLabel = document.createElement('label');
            loopLabel.textContent = `Loop Height: ${branch.loop.height.toFixed(1)} (auto)`;
            branchDiv.appendChild(loopLabel);
        }
        dom.slidersContainer.appendChild(branchDiv);
    });
}


// --- Core Application Logic / "Actions" ---

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

function editBlock(uuid, updates) {
    const block = appState.blockSpace[uuid];
    if (!block) return;

    Object.assign(block, updates);
    if (updates.sizes || updates.type) {
        block.snapPoints = blocks.Block(block.type, block.colors, block.sizes).snapPoints;
    }
    render();
}

function createBlock(type, colors = { inner: "#4A90E2", outer: "#196ECF" }) {
    let uuid;
    do { uuid = crypto.randomUUID(); } while (appState.blockSpace.hasOwnProperty(uuid));

    const sizes = [{ height: 1, width: 1, loop: { height: MIN_LOOP_HEIGHT } }];
    const blockData = blocks.Block(type, colors, sizes);

    appState.blockSpace[uuid] = {
        type, uuid, colors, sizes,
        snapPoints: blockData.snapPoints,
        transform: { x: 420, y: 50 },
        parent: null,
        children: {}
    };
    appState.targetID = uuid;
    render();
}

function removeBlock(uuid) {
    if (!appState.blockSpace[uuid]) return;
    handleDetach(uuid, false);
    const groupToRemove = getDragGroup(uuid, appState.blockSpace, []);

    groupToRemove.forEach(id => delete appState.blockSpace[id]);

    if (groupToRemove.includes(appState.targetID)) {
        const remainingKeys = Object.keys(appState.blockSpace);
        appState.targetID = remainingKeys.length > 0 ? remainingKeys[0] : null;
    }
    render();
}

// --- Drag and Drop Handlers ---

function onSnapPreview(snapInfo, draggedBlockId) {
    if (!snapInfo.parentId) return null;

    const displacements = {};
    const addDisplacement = (blockId, deltaY) => {
        if (!blockId) return;
        displacements[blockId] = (displacements[blockId] || 0) + deltaY;
    };

    const draggedChainHeight = calculateChainHeight(draggedBlockId);

    // 1. Handle displacement from insertion.
    if (snapInfo.snapType === 'insertion' && snapInfo.originalChildId) {
        // *** THIS IS THE FIX ***
        // The height must be scaled by APP_SCALE to convert it to SVG units.
        const insertionDeltaY = draggedChainHeight * APP_SCALE;
        addDisplacement(snapInfo.originalChildId, insertionDeltaY);
    }

    // 2. Handle displacement from loop expansion.
    let loopBlock = null;
    let innerSnapName = null;

    const directParentBlock = appState.blockSpace[snapInfo.parentId];
    if (directParentBlock?.sizes?.some(s => s.loop) && snapInfo.parentSnapPoint.name.startsWith('topInner')) {
        loopBlock = directParentBlock;
        innerSnapName = snapInfo.parentSnapPoint.name;
    } else {
        const ancestorInfo = findAncestorLoop(snapInfo.parentId, appState.blockSpace);
        if (ancestorInfo) {
            loopBlock = ancestorInfo.loopBlock;
            innerSnapName = ancestorInfo.innerSnapName;
        }
    }

    if (loopBlock) {
        const previewSizes = JSON.parse(JSON.stringify(loopBlock.sizes));
        const branchIndex = parseInt(innerSnapName.replace('topInner', ''));
        const loopBranch = previewSizes[branchIndex];

        if (loopBranch) {
            const oldLoopHeight = loopBlock.sizes[branchIndex].loop.height;
            const existingChainHeight = calculateChainHeight(loopBlock.children[innerSnapName]);
            const newLoopHeight = Math.max(existingChainHeight + draggedChainHeight, MIN_LOOP_HEIGHT);

            if (newLoopHeight !== oldLoopHeight) {
                loopBranch.loop.height = newLoopHeight;
                generateShape(loopBlock.uuid, loopBlock.type, loopBlock.colors, previewSizes);

                const loopExpansionDeltaY = (newLoopHeight - oldLoopHeight) * APP_SCALE;

                addDisplacement(loopBlock.children.bottom, loopExpansionDeltaY);

                loopBlock.sizes.forEach((_, i) => {
                    if (i === branchIndex) return;
                    const otherBranchSnapName = 'topInner' + i;
                    addDisplacement(loopBlock.children[otherBranchSnapName], loopExpansionDeltaY);
                });
            }
        }
    }

    // 3. Convert the displacement map to the array format expected by draggable.js
    const finalDisplacements = Object.entries(displacements).map(([id, deltaY]) => ({ id, deltaY }));

    return finalDisplacements.length > 0 ? { displacedBlocks: finalDisplacements } : null;
}

function onSnapPreviewEnd(snapInfo) {
    if (snapInfo.parentId) {
        const directParent = appState.blockSpace[snapInfo.parentId];
        if (directParent) {
             generateShape(directParent.uuid, directParent.type, directParent.colors, directParent.sizes);
        }
        const ancestorInfo = findAncestorLoop(snapInfo.parentId, appState.blockSpace);
        if (ancestorInfo?.loopBlock) {
            const loopBlock = ancestorInfo.loopBlock;
            generateShape(loopBlock.uuid, loopBlock.type, loopBlock.colors, loopBlock.sizes);
        }
    }
}

function handleDetach(childId, shouldRender = true) {
    const childBlock = appState.blockSpace[childId];
    if (!childBlock || !childBlock.parent) return;
    setParent(childId, null, null);
    if (shouldRender) {
        render();
    }
}

function onDragEnd(draggedBlockId, finalTransform, snapInfo) {
    const mainDraggedBlock = appState.blockSpace[draggedBlockId];
    if (!mainDraggedBlock) return;

    mainDraggedBlock.transform.x = finalTransform.x;
    mainDraggedBlock.transform.y = finalTransform.y;

    if (snapInfo) {
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
    }
    render();
}

// --- Event Listener Setup ---

function setupEventListeners() {
    window.addEventListener('resize', setupWorkspaceViewBox);

    if (dom.slidersContainer) {
        dom.slidersContainer.addEventListener('input', (event) => {
            if (!event.target.matches('.branch-input') || !appState.targetID) return;
            const block = appState.blockSpace[appState.targetID];
            const idx = parseInt(event.target.dataset.index);
            const prop = event.target.dataset.prop;
            const value = parseFloat(event.target.value);
            const newSizes = JSON.parse(JSON.stringify(block.sizes));
            newSizes[idx][prop] = value;
            editBlock(appState.targetID, { sizes: newSizes });
        });

        dom.slidersContainer.addEventListener('click', (event) => {
            if (!event.target.matches('.remove-branch') || !appState.targetID) return;
            const idx = parseInt(event.target.dataset.index);
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
            render();
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