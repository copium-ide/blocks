import * as blocks from './blocks.js';
import * as svg from './svg.js';
import * as drag from './drag.js';
import * as constants from './constants.js';
import * as project from '../code/core.js';

// --- Configuration ---
let appScale = 8;
export function getAppScale() { return appScale; }
const MIN_LOOP_HEIGHT = 0.5;
const BLOCK_TYPES = ['hat', 'block', 'end', 'label', 'number', 'string', 'boolean', 'array', 'object'];

// --- DOM Element References ---
function getElements() {
    return {
        workSpace: document.getElementById('workspace'),
        controlsContainer: document.getElementById('controls-container'),
        structureEditor: document.getElementById('structure-editor'),
        newBlockTypeSelect: document.getElementById('new-block-type-select'),
        createBtn: document.getElementById('create'),
        removeBtn: document.getElementById('remove'),
        typeinput: document.getElementById("type"),
        uuidinput: document.getElementById("blockType"),
        color1input: document.getElementById("color1"),
        color2input: document.getElementById("color2"),
        textInput: document.getElementById('text-input'),
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
function getTextWidth(text, fontSize, font = 'sans-serif') {
    const canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement("canvas"));
    const context = canvas.getContext("2d");
    context.font = `${fontSize}px ${font}`;
    const metrics = context.measureText(text);
    return metrics.width;
}

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
        for (const connection of Object.values(block.children)) {
            getDragGroup(connection.id, allBlocks, group);
        }
    }
    return group;
}

function populateCreateDropdown() {
    if (!dom.newBlockTypeSelect) return;
    BLOCK_TYPES.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type.charAt(0).toUpperCase() + type.slice(1);
        dom.newBlockTypeSelect.appendChild(option);
    });
}

// --- Layout Calculation Logic (Reads from state) ---

function getBlockVisualDimensions(blockId) {
    const block = appState.blockSpace[blockId];
    if (!block) return { width: 0, height: 0 };

    if (block.type === 'label') {
        const FONT_SIZE_FOR_CALC = constants.FONT_SIZE;
        const textWidthInPixels = getTextWidth(block.text || ' ', FONT_SIZE_FOR_CALC);
        const widthInBlockUnits = (textWidthInPixels / constants.BLOCK_WIDTH);
        return { width: widthInBlockUnits, height: 1 };
    }

    if (!block.sizes || !block.sizes.length) return { width: 0, height: 0 };

    if (block.type !== 'block' && block.type !== 'hat' && block.type !== 'end') {
         return { width: block.sizes[0].width, height: block.sizes[0].height };
    }

    let totalHeightUnits = 0;
    let maxWidthUnits = 0;
    block.sizes.forEach(branch => {
        totalHeightUnits += branch.height;
        if (branch.loop) totalHeightUnits += branch.loop.height;
        maxWidthUnits = Math.max(maxWidthUnits, branch.width);
    });

    return { width: maxWidthUnits, height: totalHeightUnits };
}

// --- CHANGED: This entire function has been replaced with the corrected version. ---
function recalculateAllLayouts() {
    const PADDING_AROUND_INPUTS = 0.2;
    const BASE_HORIZONTAL_PADDING = 0.2;
    const PADDING_ADJUSTMENT_FACTOR = 0.1;
    const PADDING_BETWEEN_INPUTS = 0.3;
    const DEFAULT_INPUT_WIDTH_UNITS = 1;
    const DEFAULT_INPUT_HEIGHT_UNITS = 1;

    function getChainExtents(startBlockId) {
        if (!startBlockId) return { width: 0, height: 0 };
        let totalHeightUnits = 0, maxWidthUnits = 0, currentBlockId = startBlockId;
        while (currentBlockId) {
            const currentBlock = appState.blockSpace[currentBlockId];
            if (!currentBlock) break;
            const dims = getBlockVisualDimensions(currentBlockId);
            totalHeightUnits += dims.height;
            maxWidthUnits = Math.max(maxWidthUnits, dims.width);
            currentBlockId = currentBlock.children['bottom']?.id;
        }
        return { width: maxWidthUnits, height: totalHeightUnits };
    }

    const sized = new Set();
    function processBlockSize(blockId) {
        if (!blockId || sized.has(blockId)) return;
        const block = appState.blockSpace[blockId];
        if (!block) return;

        Object.values(block.children).forEach(c => processBlockSize(c.id));

        // --- START OF FIX ---
        // This logic now applies padding in a visually consistent way.
        if (block.type === 'label') {
            if (block.sizes && block.sizes[0] && block.sizes[0].auto.width) {
                // A constant padding in pre-scaled pixels. This provides a consistent visual margin.
                const HORIZONTAL_PADDING_PIXELS = 12;

                // Step 1: Calculate the final on-screen pixel size for the font.
                const fontSizeForMeasurement = constants.FONT_SIZE * getAppScale();

                // Step 2: Measure the text width in final on-screen pixels.
                const textWidthInFinalPixels = getTextWidth(block.text || ' ', fontSizeForMeasurement);

                // Step 3: Convert the final pixel width back to pre-scaled pixels.
                const textWidthInPreScaledPixels = textWidthInFinalPixels / getAppScale();

                // Step 4: Add the fixed pixel padding to the pre-scaled text width.
                const paddedWidthInPreScaledPixels = textWidthInPreScaledPixels + HORIZONTAL_PADDING_PIXELS;

                // Step 5: Convert the total padded pre-scaled pixel width into abstract Block Units.
                block.sizes[0].width = paddedWidthInPreScaledPixels / constants.BLOCK_WIDTH;
            }
            sized.add(blockId);
            return;
        }
        // --- END OF FIX ---

        if (block.sizes?.some(s => s.loop)) {
            block.sizes.forEach((branch, i) => {
                if (branch.loop) {
                    const innerChainStartId = block.children['topInner' + i]?.id;
                    const chainHeightUnits = getChainExtents(innerChainStartId).height;
                    branch.loop.height = chainHeightUnits || MIN_LOOP_HEIGHT;
                }
            });
        }

        const isContainerBlock = ['block', 'hat', 'end'].includes(block.type);
        block.sizes.forEach(branch => {
            if (!branch.auto.width && !branch.auto.height) return;

            let cumulativeWidthUnits = 0;
            let maxChildHeightUnits = 0;
            const inputs = branch.customSnapPoints || [];
            
            inputs.forEach(point => {
                const childConnection = block.children[point.name];
                let childWidth = DEFAULT_INPUT_WIDTH_UNITS;
                let childHeight = DEFAULT_INPUT_HEIGHT_UNITS;

                if (childConnection) {
                    const childBlock = appState.blockSpace[childConnection.id];
                    const childDims = getBlockVisualDimensions(childConnection.id);
                    childWidth = childDims.width;
                    childHeight = childDims.height;
                    if (isContainerBlock || childBlock.type !== 'label') {
                        maxChildHeightUnits = Math.max(maxChildHeightUnits, childHeight);
                    }
                } else {
                    maxChildHeightUnits = Math.max(maxChildHeightUnits, childHeight);
                }
                cumulativeWidthUnits += childWidth;
            });
            
            if (inputs.length > 1) {
                cumulativeWidthUnits += ((inputs.length - 1) * PADDING_BETWEEN_INPUTS);
            }

            if (branch.auto.width) {
                const paddingSign = isContainerBlock ? 1 : -1;
                branch.width = (inputs.length > 0)
                    ? cumulativeWidthUnits + BASE_HORIZONTAL_PADDING + (PADDING_ADJUSTMENT_FACTOR * paddingSign) : 1;
            }
            if (branch.auto.height) {
                branch.height = (maxChildHeightUnits > 0) ? maxChildHeightUnits + PADDING_AROUND_INPUTS * 2 : 1;
            }
        });
        sized.add(blockId);
    }

    const positioned = new Set();
    function processBlockPosition(blockId) {
        if (!blockId || positioned.has(blockId)) return;
        const block = appState.blockSpace[blockId];
        if (!block) return;

        const parentId = block.parent;
        if (parentId) {
            const parentBlock = appState.blockSpace[parentId];
            const parentSnapPointName = Object.keys(parentBlock.children).find(key => parentBlock.children[key].id === blockId);
            if (parentSnapPointName) {
                const parentMalePoint = parentBlock.snapPoints.find(p => p.name === parentSnapPointName);
                const childFemalePoint = block.snapPoints.find(p => p.role === 'female');
                if (parentMalePoint && childFemalePoint) {
                    const scale = getAppScale();
                    block.transform.x = parentBlock.transform.x + (parentMalePoint.x * scale) - (childFemalePoint.x * scale);
                    block.transform.y = parentBlock.transform.y + (parentMalePoint.y * scale) - (childFemalePoint.y * scale);
                }
            }
        }
        positioned.add(blockId);
        Object.values(block.children).forEach(c => processBlockPosition(c.id));
    }

    const topLevelBlocks = Object.values(appState.blockSpace).filter(b => !b.parent);
    topLevelBlocks.forEach(block => processBlockSize(block.uuid));

    for (const block of Object.values(appState.blockSpace)) {
        const templateShape = blocks.Block(block.type, block.colors, block.sizes);
        let yOffset = 0;

        block.sizes.forEach((branch, branchIndex) => {
            const branchWidth = branch.width * constants.BLOCK_WIDTH;
            const inputs = branch.customSnapPoints || [];
            let totalInputWidth = 0;
            const inputWidths = [];

            inputs.forEach(point => {
                const childConnection = block.children[point.name];
                let childWidth = DEFAULT_INPUT_WIDTH_UNITS;
                if (childConnection) {
                    childWidth = getBlockVisualDimensions(childConnection.id).width;
                }
                inputWidths.push(childWidth * constants.BLOCK_WIDTH);
            });

            totalInputWidth = inputWidths.reduce((a, b) => a + b, 0);
            if (inputs.length > 1) {
                totalInputWidth += (inputs.length - 1) * (PADDING_BETWEEN_INPUTS * constants.BLOCK_WIDTH);
            }

            let currentX = 0;

            inputs.forEach((point, pointIndex) => {
                const snapPointInTemplate = templateShape.snapPoints.find(p => p.name === point.name);
                if (snapPointInTemplate) {
                    const inputWidth = inputWidths[pointIndex];
                    snapPointInTemplate.x = currentX;
                    currentX += inputWidth + (PADDING_BETWEEN_INPUTS * constants.BLOCK_WIDTH);
                }
            });

            yOffset += branch.height * constants.BLOCK_HEIGHT;
            if (branch.loop) {
                yOffset += branch.loop.height * constants.BLOCK_HEIGHT;
            }
        });
        block.snapPoints = templateShape.snapPoints;
    }

    topLevelBlocks.forEach(block => processBlockPosition(block.uuid));
}


// --- Rendering Logic (Reads from state, writes to DOM) ---

function render() {
    recalculateAllLayouts();
    renderBlocks();
    populateSelector();
    renderSelectedBlockControls();
}

function generateShape(uuid, type, colors, sizes, snapPoints, text) {
    const blockData = appState.blockSpace[uuid];
    const blockElm = document.getElementById(uuid);
    if (!blockElm || !blockData) return;

    const scale = getAppScale();
    
    // 1. Generate the main block's shape
    const mainShapeData = blocks.Block(type, colors, sizes);
    mainShapeData.snapPoints = snapPoints; // Use the calculated snap points from layout
    svg.generate(blockElm, mainShapeData, text, scale);

    // 2. Clear any old placeholder shapes
    blockElm.querySelectorAll('.unconnected-point-shape').forEach(el => el.remove());

    // 3. Find snap points that need a placeholder
    const unconnectedMalePoints = blockData.snapPoints.filter(point =>
        point.role === 'male' &&
        point.type !== 'block' && 
        !blockData.children[point.name]
    );

    // 4. Loop through them and generate a placeholder for each
    for (const point of unconnectedMalePoints) {
        // a. Define placeholder properties
        const defaultType = point.type;
        const defaultColors = { inner: blockData.colors.outer, outer: blockData.colors.outer };
        const defaultSizes = [{
            height: 1,
            width: 1,
            auto: { width: true, height: true },
            customSnapPoints: []
        }];

        // b. Create the template shape for the placeholder
        const defaultShapeData = blocks.Block(defaultType, defaultColors, defaultSizes);
        const femalePoint = defaultShapeData.snapPoints.find(p => p.role === 'female');

        if (!femalePoint) continue;

        // c. Calculate the translation needed. These coordinates are already scaled.
        const dx = (point.x - femalePoint.x)+1;
        const dy = (point.y - femalePoint.y);

        // d. Create the SVG group element for the placeholder
        const shapeGroup = document.createElementNS("http://www.w3.org/2000/svg", 'g');
        shapeGroup.classList.add('unconnected-point-shape');
        shapeGroup.style.pointerEvents = 'none';
        
        shapeGroup.setAttribute('transform', `translate(${dx}, ${dy})`);

        // e. Generate the placeholder's SVG path into a temporary element
        const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", 'svg');
        svg.generate(tempSvg, defaultShapeData, '', scale); // No text in placeholders

        // f. Move the generated paths from the temp container to our group
        while (tempSvg.firstChild) {
            shapeGroup.appendChild(tempSvg.firstChild);
        }

        // g. Append the finished placeholder to the main block's SVG
        blockElm.appendChild(shapeGroup);
    }
}

function renderBlocks() {
    const existingBlockIds = new Set(Array.from(dom.workSpace.querySelectorAll('svg[blocktype]')).map(el => el.id));
    const stateBlockIds = new Set(Object.keys(appState.blockSpace));

    for (const id of existingBlockIds) {
        if (!stateBlockIds.has(id)) document.getElementById(id)?.remove();
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
        
        generateShape(id, blockData.type, blockData.colors, blockData.sizes, blockData.snapPoints, blockData.text);
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
    if (currentTargetId) dom.uuidinput.value = currentTargetId;
}

function renderSelectedBlockControls() {
    const editor = dom.structureEditor;
    if (!editor) return;
    clearNode(editor);

    const currentBlock = appState.blockSpace[appState.targetID];
    if (!currentBlock) return;

    dom.typeinput.value = currentBlock.type;
    dom.textInput.value = currentBlock.text;
    dom.color1input.value = currentBlock.colors.inner;
    dom.color2input.value = currentBlock.colors.outer;

    const isContainer = ['block', 'hat', 'end'].includes(currentBlock.type);

    const branchStack = document.createElement('div');
    branchStack.className = 'branch-stack';
    currentBlock.sizes.forEach((branch, branchIndex) => {
        const branchItem = document.createElement('div');
        branchItem.className = 'branch-item';
        branchItem.dataset.branchIndex = branchIndex;
        if (isContainer) branchItem.setAttribute('draggable', 'true');

        const branchHeader = document.createElement('div');
        branchHeader.className = 'branch-header';
        if (isContainer) {
            branchHeader.innerHTML = `<span class="drag-handle branch-handle">::</span>`;
        }
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'branch-name-input';
        nameInput.value = branch.name || `Branch ${branchIndex + 1}`;
        nameInput.dataset.branchIndex = branchIndex;
        branchHeader.appendChild(nameInput);

        if (isContainer && currentBlock.sizes.length > 1) {
            const removeBranchBtn = document.createElement('button');
            removeBranchBtn.textContent = 'X';
            removeBranchBtn.className = 'remove-branch-btn';
            removeBranchBtn.dataset.branchIndex = branchIndex;
            branchHeader.appendChild(removeBranchBtn);
        }
        branchItem.appendChild(branchHeader);

        const inputZone = document.createElement('div');
        inputZone.className = 'input-zone';
        inputZone.dataset.branchIndex = branchIndex;

        const inputs = branch.customSnapPoints || [];
        inputs.forEach((point, pointIndex) => {
            const inputItem = document.createElement('div');
            inputItem.className = 'input-item';
            inputItem.dataset.branchIndex = branchIndex;
            inputItem.dataset.pointIndex = pointIndex;
            inputItem.setAttribute('draggable', 'true');

            const childConnection = currentBlock.children[point.name];
            const isConnected = !!childConnection;
            const isLocked = isConnected && childConnection.locked;

            inputItem.innerHTML = `
                <span class="drag-handle input-handle">::</span>
                <input type="text" class="input-prop" data-prop="name" value="${point.name}" placeholder="name">
                <input type="text" class="input-prop" data-prop="type" value="${point.type}" placeholder="type">
                <select class="input-prop" data-prop="role">
                    <option value="male" ${point.role === 'male' ? 'selected' : ''}>Male</option>
                    <option value="female" ${point.role === 'female' ? 'selected' : ''}>Female</option>
                </select>
                <label class="lock-label">
                    <input type="checkbox" class="lock-toggle" data-input-name="${point.name}" ${!isConnected ? 'disabled' : ''} ${isLocked ? 'checked' : ''}>
                    Lock
                </label>
                <button class="remove-input-btn">X</button>
            `;
            inputZone.appendChild(inputItem);
        });

        const addInputBtn = document.createElement('button');
        addInputBtn.textContent = '+';
        addInputBtn.className = 'add-input-btn';
        addInputBtn.dataset.branchIndex = branchIndex;
        inputZone.appendChild(addInputBtn);
        branchItem.appendChild(inputZone);

        branchStack.appendChild(branchItem);
    });
    editor.appendChild(branchStack);

    if (isContainer) {
        const addBranchBtn = document.createElement('button');
        addBranchBtn.textContent = 'Add Branch';
        addBranchBtn.className = 'add-branch-btn';
        editor.appendChild(addBranchBtn);
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
        appState.blockSpace[newParentId].children[parentSnapPointName] = { id: childId, locked: isLocked };
    }
}

function editBlock(uuid, updates) {
    const block = appState.blockSpace[uuid];
    if (!block) return;
    Object.assign(block, updates);
}

function createBlock(type, colors = { inner: "#4A90E2", outer: "#196ECF" }) {
    let uuid;
    do { uuid = crypto.randomUUID(); } while (appState.blockSpace.hasOwnProperty(uuid));

    const isBranch = ['block', 'hat', 'end'].includes(type);
    const sizes = [{
        name: "Branch 1",
        height: 1, width: 1,
        auto: { width: true, height: true },
        loop: isBranch ? { height: MIN_LOOP_HEIGHT } : undefined,
        customSnapPoints: []
    }];

    const workspaceRect = dom.workSpace.getBoundingClientRect();
    const spawnX = (workspaceRect.width / 2);
    const spawnY = (workspaceRect.height / 2);

    const blockData = blocks.Block(type, colors, sizes);
    appState.blockSpace[uuid] = {
        type, uuid, colors, sizes, text: '',
        snapPoints: blockData.snapPoints,
        transform: { x: spawnX, y: spawnY },
        parent: null, children: {}
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
    const block = appState.blockSpace[blockId];
    if (!block) return;
    let finalTargetId = blockId;
    const parentId = block.parent;
    if (parentId && appState.blockSpace[parentId]) {
        const parentBlock = appState.blockSpace[parentId];
        const connectionInfo = Object.values(parentBlock.children).find(child => child.id === blockId);
        if (connectionInfo && connectionInfo.locked) finalTargetId = parentId;
    }
    if (appState.targetID !== finalTargetId) {
        appState.targetID = finalTargetId;
        render();
    }
}

function handleDetach(childId, restorableConnection, shouldRender = true) {
    const childBlock = appState.blockSpace[childId];
    if (!childBlock || !childBlock.parent) return;
    setParent(childId, null, null);
    if (restorableConnection) {
        setParent(restorableConnection.childId, restorableConnection.parentId, restorableConnection.snapPointName, restorableConnection.locked);
    }
    if (shouldRender) render();
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
                setParent(originalConnection.id, draggedBlockId, draggedBlockBottomPoint.name, originalConnection.locked);
                setParent(draggedBlockId, parentId, parentSnapPoint.name, false);
            }
        } else if (snapInfo.snapType === 'append') {
            setParent(draggedBlockId, snapInfo.parentId, snapInfo.parentSnapPoint.name, false);
        }
    }
    render();
}

function makePanelDraggable(panel, handle) {
    let isDragging = false;
    let offsetX, offsetY;

    handle.addEventListener('mousedown', (e) => {
        isDragging = true;
        offsetX = e.clientX - panel.offsetLeft;
        offsetY = e.clientY - panel.offsetTop;
        panel.style.userSelect = 'none';
    });

    window.addEventListener('mousemove', (e) => {
        if (isDragging) {
            panel.style.left = `${e.clientX - offsetX}px`;
            panel.style.top = `${e.clientY - offsetY}px`;
        }
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        panel.style.userSelect = 'auto';
    });
}


// --- Event Listener Setup ---

function setupEventListeners() {
    window.addEventListener('resize', setupWorkspaceViewBox);
    if (dom.appScaleSlider) {
        dom.appScaleSlider.addEventListener('input', () => {
            appScale = parseInt(dom.appScaleSlider.value, 10);
            dom.appScaleValue.textContent = appScale;
            render();
        });
    }

    const generalControls = [dom.color1input, dom.color2input, dom.typeinput, dom.textInput];
    generalControls.forEach(input => {
        if (!input) return;
        input.addEventListener('change', () => {
            if (!appState.targetID) return;
            const block = appState.blockSpace[appState.targetID];
            const updates = {};
            if (input === dom.typeinput) {
                const newTypeIsBranch = ['block', 'hat', 'end'].includes(dom.typeinput.value);
                updates.type = dom.typeinput.value;
                updates.sizes = [{
                    name: "Branch 1", height: 1, width: 1,
                    auto: { width: true, height: true },
                    loop: newTypeIsBranch ? { height: MIN_LOOP_HEIGHT } : undefined,
                    customSnapPoints: []
                }];
            }
            else if (input === dom.textInput) updates.text = dom.textInput.value;
            else if (input === dom.color1input || input === dom.color2input) {
                updates.colors = { inner: dom.color1input.value, outer: dom.color2input.value };
            }
            editBlock(appState.targetID, updates);
            render();
        });
    });

    if (dom.uuidinput) {
        dom.uuidinput.addEventListener("change", () => {
            appState.targetID = dom.uuidinput.value;
            render();
        });
    }

    if (dom.createBtn) {
        dom.createBtn.addEventListener('click', () => {
            if (dom.newBlockTypeSelect) {
                createBlock(dom.newBlockTypeSelect.value);
            }
        });
    }
    if (dom.removeBtn) dom.removeBtn.addEventListener('click', () => { if (appState.targetID) removeBlock(appState.targetID); });

    const editor = dom.structureEditor;
    if (!editor) return;

    editor.addEventListener('click', (e) => {
        const block = appState.blockSpace[appState.targetID];
        if (!block) return;

        if (e.target.matches('.add-branch-btn')) {
            block.sizes.push({
                name: `Branch ${block.sizes.length + 1}`,
                height: 1, width: 1, auto: { width: true, height: true },
                loop: { height: MIN_LOOP_HEIGHT }, customSnapPoints: []
            });
            render();
        } else if (e.target.matches('.remove-branch-btn')) {
            const branchIndex = parseInt(e.target.closest('.branch-item').dataset.branchIndex, 10);
            if (block.sizes.length > 1) {
                block.sizes.splice(branchIndex, 1);
                render();
            }
        } else if (e.target.matches('.add-input-btn')) {
            const branchIndex = parseInt(e.target.closest('.branch-item').dataset.branchIndex, 10);
            const branch = block.sizes[branchIndex];
            if (!branch.customSnapPoints) branch.customSnapPoints = [];
            let i = 0, newName;
            const allPoints = block.snapPoints.map(p => p.name);
            do { i++; newName = `input_${i}`; } while (allPoints.includes(newName));
            branch.customSnapPoints.push({ name: newName, type: 'number', role: 'male' });
            render();
        } else if (e.target.matches('.remove-input-btn')) {
            const inputItem = e.target.closest('.input-item');
            const branchIndex = parseInt(inputItem.dataset.branchIndex, 10);
            const pointIndex = parseInt(inputItem.dataset.pointIndex, 10);
            block.sizes[branchIndex].customSnapPoints.splice(pointIndex, 1);
            render();
        }
    });

    editor.addEventListener('change', (e) => {
        const block = appState.blockSpace[appState.targetID];
        if (!block) return;

        if (e.target.matches('.branch-name-input')) {
            const branchIndex = parseInt(e.target.closest('.branch-item').dataset.branchIndex, 10);
            block.sizes[branchIndex].name = e.target.value;
            render();
        } else if (e.target.matches('.input-prop')) {
            const inputItem = e.target.closest('.input-item');
            const branchIndex = parseInt(inputItem.dataset.branchIndex, 10);
            const pointIndex = parseInt(inputItem.dataset.pointIndex, 10);
            const prop = e.target.dataset.prop;
            block.sizes[branchIndex].customSnapPoints[pointIndex][prop] = e.target.value;
            render();
        } else if (e.target.matches('.lock-toggle')) {
            const inputName = e.target.dataset.inputName;
            if (block.children[inputName]) {
                block.children[inputName].locked = e.target.checked;
                render();
            }
        }
    });

    let draggedElement = null;
    editor.addEventListener('dragstart', (e) => {
        if (e.target.matches('.branch-item, .input-item')) {
            draggedElement = e.target;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', e.target.className);
            setTimeout(() => e.target.classList.add('dragging'), 0);
        }
    });

    editor.addEventListener('dragend', (e) => {
        draggedElement?.classList.remove('dragging');
        draggedElement = null;
    });

    editor.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!draggedElement) return;
        const target = e.target.closest(`.${draggedElement.className.split(' ')[0]}`);
        if (target && target !== draggedElement) {
            const rect = target.getBoundingClientRect();
            if (draggedElement.matches('.branch-item')) {
                const midway = rect.top + rect.height / 2;
                if (e.clientY < midway) {
                    target.parentNode.insertBefore(draggedElement, target);
                } else {
                    target.parentNode.insertBefore(draggedElement, target.nextSibling);
                }
            } else if (draggedElement.matches('.input-item')) {
                const midway = rect.left + rect.width / 2;
                if (e.clientX < midway) {
                    target.parentNode.insertBefore(draggedElement, target);
                } else {
                    target.parentNode.insertBefore(draggedElement, target.nextSibling);
                }
            }
        }
    });

    editor.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!draggedElement) return;
        draggedElement.classList.remove('dragging');
        const block = appState.blockSpace[appState.targetID];
        if (!block) return;

        if (draggedElement.matches('.branch-item')) {
            const newOrder = Array.from(editor.querySelectorAll('.branch-item')).map(item => {
                return block.sizes[parseInt(item.dataset.branchIndex, 10)];
            });
            block.sizes = newOrder;
        } else if (draggedElement.matches('.input-item')) {
            const branchIndex = parseInt(draggedElement.closest('.branch-item').dataset.branchIndex, 10);
            const branch = block.sizes[branchIndex];
            const newOrder = Array.from(editor.querySelectorAll(`.input-item[data-branch-index="${branchIndex}"]`)).map(item => {
                return branch.customSnapPoints[parseInt(item.dataset.pointIndex, 10)];
            });
            branch.customSnapPoints = newOrder;
        }
        render();
    });
}

// --- Main Application Entry Point ---
function main() {
    if (!dom.workSpace) {
        console.error("The <svg id='workspace'> element was not found. Application cannot start.");
        return;
    }
    setupWorkspaceViewBox();
    populateCreateDropdown();
    setupEventListeners();
    
    const panelHandle = document.getElementById('panel-drag-handle');
    if (dom.controlsContainer && panelHandle) {
        makePanelDraggable(dom.controlsContainer, panelHandle);
    }

    drag.makeDraggable(dom.workSpace, appState.blockSpace, handleSnap, handleDetach, handleSelect, getAppScale);
    createBlock("hat");
}

main();