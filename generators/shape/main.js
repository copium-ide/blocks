import * as blocks from './blocks.js';
import * as svg from './svg.js';
import * as drag from './drag.js';
import * as constants from './blockComponents.js';

// --- Configuration ---
let appScale = 8;
export function getAppScale() { return appScale; }
const MIN_LOOP_HEIGHT = 0.5;

// --- DOM Element References ---
function getElements() {
    return {
        workSpace: document.getElementById('workspace'),
        // Control Panel Sections
        blockSelectorPanel: document.getElementById('block-selector-panel'),
        blockPropertiesPanel: document.getElementById('block-properties-panel'),
        connectionPropertiesPanel: document.getElementById('connection-properties-panel'),
        creationPanel: document.getElementById('creation-panel'),
        // Controls
        slidersContainer: document.getElementById("sliders"),
        connectionsList: document.getElementById('connections-list'),
        addBranchBtn: document.getElementById('addBranch'),
        createBtn: document.getElementById('create'),
        removeBtn: document.getElementById('remove'),
        typeinput: document.getElementById("type"),
        uuidinput: document.getElementById("blockType"),
        color1input: document.getElementById("color1"),
        color2input: document.getElementById("color2"),
        appScaleSlider: document.getElementById('appScaleSlider'),
        appScaleValue: document.getElementById('appScaleValue'),
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
        // Updated for new children structure
        for (const connection of Object.values(block.children)) {
            getDragGroup(connection.id, allBlocks, group);
        }
    }
    return group;
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
        // Updated for new children structure
        currentBlockId = currentBlock?.children['bottom']?.id;
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
                    // Updated for new children structure
                    const innerChainStartId = block.children['topInner' + i]?.id;
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
            // Updated for new children structure
            const childId = block.children[snapPointName].id;
            const childBlock = appState.blockSpace[childId];
            if (!childBlock) continue;

            const parentMalePoint = block.snapPoints.find(p => p.name === snapPointName);
            const childFemalePoint = childBlock.snapPoints.find(p => p.role === 'female');
            if (!parentMalePoint || !childFemalePoint) continue;

            const scale = getAppScale();
            childBlock.transform.x = block.transform.x + (parentMalePoint.x * scale) - (childFemalePoint.x * scale);
            childBlock.transform.y = block.transform.y + (parentMalePoint.y * scale) - (childFemalePoint.y * scale);

            updateChain(childId);
        }
    }

    topLevelBlocks.forEach(block => updateChain(block.uuid));
}


// --- Rendering Logic (Reads from state, writes to DOM) ---

function render() {
    recalculateAllLayouts();
    renderBlocks();
    populateSelector();
    renderSelectedBlockControls();
}

function generateShape(uuid, type, colors, sizes) {
    const shapeData = blocks.Block(type, colors, sizes);
    const blockElm = document.getElementById(uuid);
    if (blockElm) {
        svg.generate(blockElm, shapeData, getAppScale());
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
    
    const currentTargetId = appState.targetID;
    clearNode(dom.uuidinput);

    for (const key in appState.blockSpace) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = `${appState.blockSpace[key].type} (${key.substring(0, 8)})`;
        dom.uuidinput.appendChild(option);
    }

    if (currentTargetId) {
        dom.uuidinput.value = currentTargetId;
    }
}

function renderSelectedBlockControls() {
    clearNode(dom.slidersContainer);
    clearNode(dom.connectionsList);

    const currentBlock = appState.blockSpace[appState.targetID];

    if (!currentBlock) {
        dom.blockPropertiesPanel.style.display = 'none';
        dom.connectionPropertiesPanel.style.display = 'none';
        return;
    }

    // --- Populate Block Properties Panel ---
    dom.blockPropertiesPanel.style.display = 'block';
    dom.typeinput.value = currentBlock.type;
    dom.color1input.value = currentBlock.colors.inner;
    dom.color2input.value = currentBlock.colors.outer;

    const { type, sizes } = currentBlock;
    const isBranchBlock = ['block', 'hat', 'end'].includes(type);

    dom.addBranchBtn.style.display = isBranchBlock ? 'block' : 'none';

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

    // --- Populate Connection Properties Panel ---
    const maleSnapPoints = currentBlock.snapPoints.filter(p => p.role === 'male');
    let connectionCount = 0;

    maleSnapPoints.forEach(point => {
        const connection = currentBlock.children[point.name];
        if (connection) {
            connectionCount++;
            const childBlock = appState.blockSpace[connection.id];
            const childName = childBlock ? `${childBlock.type} (${childBlock.uuid.substring(0, 4)})` : '...';

            // =================================================================
            // --- BUG FIX STARTS HERE ---
            // This is the robust way to create the lock UI to prevent duplicates.
            
            const div = document.createElement('div');
            div.className = 'connection-item';

            // Part 1: The descriptive text
            const textSpan = document.createElement('span');
            textSpan.innerHTML = `<b>${point.name}</b> → ${childName}`;
            
            // Part 2: The interactive lock control, wrapped in a label
            const lockLabel = document.createElement('label');
            lockLabel.style.display = 'inline-block'; // Override global styles
            lockLabel.style.width = 'auto';
            lockLabel.style.cursor = 'pointer';

            const lockCheckbox = document.createElement('input');
            lockCheckbox.type = 'checkbox';
            lockCheckbox.checked = connection.locked;
            lockCheckbox.dataset.pointName = point.name;
            
            lockLabel.appendChild(lockCheckbox);
            lockLabel.appendChild(document.createTextNode(' Locked'));

            // Assemble the final element
            div.appendChild(textSpan);
            div.appendChild(document.createElement('br'));
            div.appendChild(lockLabel);

            dom.connectionsList.appendChild(div);
            // --- BUG FIX ENDS HERE ---
            // =================================================================
        }
    });

    if (connectionCount > 0) {
        dom.connectionPropertiesPanel.style.display = 'block';
    } else {
        dom.connectionPropertiesPanel.style.display = 'none';
    }
}


// --- Core Application Logic / "Actions" ---

function setParent(childId, newParentId, parentSnapPointName, isLocked = false) {
    const childBlock = appState.blockSpace[childId];
    if (!childBlock) return;

    const oldParentId = childBlock.parent;
    if (oldParentId && appState.blockSpace[oldParentId]) {
        const oldParent = appState.blockSpace[oldParentId];
        for (const pointName in oldParent.children) {
            if (oldParent.children[pointName].id === childId) {
                delete oldParent.children[pointName];
                break;
            }
        }
    }

    childBlock.parent = newParentId;
    if (newParentId && parentSnapPointName && appState.blockSpace[newParentId]) {
        appState.blockSpace[newParentId].children[parentSnapPointName] = {
            id: childId,
            locked: isLocked
        };
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

    const isBranch = ['block', 'hat', 'end'].includes(type);
    let customPoints = [];

    if (isBranch) {
        // Example for a 'block' type, will create a MALE snap point
        customPoints = [{ name: 'value_out', x: 12, type: 'number' }];
    } else if (type === 'string') {
        // Example for a 'string' type, will create a FEMALE snap point
        customPoints = [{ name: 'length_in', x: 5, type: 'number' }];
    }

    const sizes = [{ 
        height: 1, 
        width: 1, 
        // Only branch blocks have loops
        loop: isBranch ? { height: MIN_LOOP_HEIGHT } : undefined,
        customSnapPoints: customPoints
    }];

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
    handleDetach(uuid, null, false);
    const groupToRemove = getDragGroup(uuid, appState.blockSpace, []);

    groupToRemove.forEach(id => delete appState.blockSpace[id]);

    if (groupToRemove.includes(appState.targetID)) {
        const remainingKeys = Object.keys(appState.blockSpace);
        appState.targetID = remainingKeys.length > 0 ? remainingKeys[0] : null;
    }
    render();
}

// --- Drag and Drop Handlers ---

function handleSelect(blockId) {
    if (appState.targetID !== blockId) {
        appState.targetID = blockId;
        render();
    }
}

function handleDetach(childId, restorableConnection, shouldRender = true) {
    const childBlock = appState.blockSpace[childId];
    if (!childBlock || !childBlock.parent) return;

    setParent(childId, null, null);

    if (restorableConnection) {
        setParent(
            restorableConnection.childId, 
            restorableConnection.parentId, 
            restorableConnection.snapPointName,
            restorableConnection.locked // Restore with locked state
        );
    }

    if (shouldRender) {
        render();
    }
}

function handleSnap(draggedBlockId, finalTransform, snapInfo) {
    const mainDraggedBlock = appState.blockSpace[draggedBlockId];
    if (!mainDraggedBlock) return;

    mainDraggedBlock.transform.x = finalTransform.x;
    mainDraggedBlock.transform.y = finalTransform.y;

    if (snapInfo) {
        if (snapInfo.snapType === 'insertion') {
            const { parentId, parentSnapPoint } = snapInfo;
            const parentBlock = appState.blockSpace[parentId];
            const originalConnection = parentBlock.children[parentSnapPoint.name];

            const draggedBlockBottomPoint = mainDraggedBlock.snapPoints.find(p => p.role === 'male' && p.name === 'bottom');
            if (draggedBlockBottomPoint) {
                // Connect original child to bottom of dragged block, preserving its locked state
                setParent(originalConnection.id, draggedBlockId, draggedBlockBottomPoint.name, originalConnection.locked);
                // Connect dragged block to parent, unlocked by default
                setParent(draggedBlockId, parentId, parentSnapPoint.name, false);
            }
        } else if (snapInfo.snapType === 'append') {
            // Connect dragged block to parent, unlocked by default
            setParent(draggedBlockId, snapInfo.parentId, snapInfo.parentSnapPoint.name, false);
        }
    }
    render();
}

// --- Event Listener Setup ---

function setupEventListeners() {
    window.addEventListener('resize', setupWorkspaceViewBox);

    if (dom.appScaleSlider) {
        dom.appScaleSlider.addEventListener('input', () => {
            appScale = parseInt(dom.appScaleSlider.value, 10);
            if (dom.appScaleValue) dom.appScaleValue.textContent = appScale;
            render();
        });
    }

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

    if (dom.connectionsList) {
        dom.connectionsList.addEventListener('change', (event) => {
            if (event.target.type === 'checkbox' && appState.targetID) {
                const pointName = event.target.dataset.pointName;
                const block = appState.blockSpace[appState.targetID];
                if (block && block.children[pointName]) {
                    block.children[pointName].locked = event.target.checked;
                }
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
    drag.makeDraggable(dom.workSpace, appState.blockSpace, handleSnap, handleDetach, handleSelect);

    createBlock("hat");
}

main();