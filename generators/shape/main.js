import * as blocks from './blocks.js';
import * as svg from './svg.js';
import * as drag from './drag.js';
import * as constants from './constants.js';

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
        snapPointsPanel: document.getElementById('snap-points-panel'),
        creationPanel: document.getElementById('creation-panel'),
        // Controls
        slidersContainer: document.getElementById("sliders"),
        connectionsList: document.getElementById('connections-list'),
        snapPointsList: document.getElementById('snap-points-list'),
        addSnapPointBtn: document.getElementById('add-snap-point-btn'),
        addBranchBtn: document.getElementById('addBranch'),
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

// --- Layout Calculation Logic (Reads from state) ---

function getBlockVisualDimensions(blockId) {
    const block = appState.blockSpace[blockId];
    if (!block || !block.sizes.length) return { width: 0, height: 0 };
    
    if (block.type !== 'block' && block.type !== 'hat' && block.type !== 'end') {
         return {
            width: block.sizes[0].width * constants.BLOCK_WIDTH / getAppScale(),
            height: block.sizes[0].height * constants.BLOCK_HEIGHT / getAppScale()
        };
    }

    let totalHeight = 0;
    let maxWidth = 0;
    block.sizes.forEach(branch => {
        totalHeight += branch.height * constants.BLOCK_HEIGHT;
        if(branch.loop) {
            totalHeight += branch.loop.height * constants.BLOCK_HEIGHT;
        }
        maxWidth = Math.max(maxWidth, branch.width * constants.BLOCK_WIDTH);
    });
    
    return {
        width: maxWidth / getAppScale(),
        height: totalHeight / getAppScale()
    };
}

function recalculateAllLayouts() {
    const PADDING = 0.4;

    function getChainExtents(startBlockId) {
        if (!startBlockId) return { width: 0, height: 0 };
        
        let totalHeight = 0;
        let maxWidth = 0;
        let currentBlockId = startBlockId;

        while (currentBlockId) {
            const currentBlock = appState.blockSpace[currentBlockId];
            if (!currentBlock) break;

            const dims = getBlockVisualDimensions(currentBlockId);
            totalHeight += (dims.height * getAppScale());
            maxWidth = Math.max(maxWidth, dims.width * getAppScale());
            
            currentBlockId = currentBlock.children['bottom']?.id;
        }
        return { width: maxWidth, height: totalHeight };
    }

    // --- Pass 1: Update sizes (Bottom-up using post-order traversal) ---
    const sized = new Set();
    function processBlockSize(blockId) {
        if (!blockId || sized.has(blockId)) return;
        const block = appState.blockSpace[blockId];
        if (!block) return;

        for (const childConnection of Object.values(block.children)) {
            processBlockSize(childConnection.id);
        }

        if (block.sizes?.some(s => s.loop)) {
            const newSizes = JSON.parse(JSON.stringify(block.sizes));
            let loopHeightChanged = false;
            for (let i = 0; i < newSizes.length; i++) {
                const branch = newSizes[i];
                if (branch.loop) {
                    const innerChainStartId = block.children['topInner' + i]?.id;
                    const chainHeight = getChainExtents(innerChainStartId).height;
                    const newLoopHeight = (chainHeight / constants.BLOCK_HEIGHT) || MIN_LOOP_HEIGHT;
                    if (branch.loop.height !== newLoopHeight) {
                        branch.loop.height = newLoopHeight;
                        loopHeightChanged = true;
                    }
                }
            }
            if (loopHeightChanged) {
                editBlock(blockId, { sizes: newSizes });
            }
        }
        
        const mainBranch = block.sizes[0];
        if (mainBranch && (mainBranch.auto.width || mainBranch.auto.height)) {
            let maxChildChainWidth = 0;
            let maxChildChainHeight = 0;
            let hasWrappableChildren = false;

            for (const childConnection of Object.values(block.children)) {
                const childBlock = appState.blockSpace[childConnection.id];
                // Check for "wrappable" children, ignoring standard block types.
                if (childBlock && childBlock.type !== 'block' && childBlock.type !== 'hat' && childBlock.type !== 'end') {
                    hasWrappableChildren = true;
                    const { width, height } = getChainExtents(childConnection.id);
                    maxChildChainWidth = Math.max(maxChildChainWidth, width);
                    maxChildChainHeight = Math.max(maxChildChainHeight, height);
                }
            }

            const newSizes = JSON.parse(JSON.stringify(block.sizes));
            let sizeChanged = false;
            const DEFAULT_AUTO_SIZE = 1;

            if (hasWrappableChildren) {
                // Expand to fit children
                if (mainBranch.auto.width) {
                    const newWidth = (maxChildChainWidth / constants.BLOCK_WIDTH) + PADDING;
                    if (newSizes[0].width !== newWidth) {
                        newSizes[0].width = newWidth;
                        sizeChanged = true;
                    }
                }
                if (mainBranch.auto.height) {
                    const newHeight = (maxChildChainHeight / constants.BLOCK_HEIGHT) + PADDING;
                    if (newSizes[0].height !== newHeight) {
                        newSizes[0].height = newHeight;
                        sizeChanged = true;
                    }
                }
            } else {
                // No wrappable children, reset to default size if auto is on
                if (mainBranch.auto.width && newSizes[0].width !== DEFAULT_AUTO_SIZE) {
                    newSizes[0].width = DEFAULT_AUTO_SIZE;
                    sizeChanged = true;
                }
                if (mainBranch.auto.height && newSizes[0].height !== DEFAULT_AUTO_SIZE) {
                    newSizes[0].height = DEFAULT_AUTO_SIZE;
                    sizeChanged = true;
                }
            }

            if (sizeChanged) {
                editBlock(blockId, { sizes: newSizes });
            }
        }

        sized.add(blockId);
    }

    // --- Pass 2: Update positions (Top-down using pre-order traversal) ---
    const positioned = new Set();
    function processBlockPosition(blockId) {
        if (!blockId || positioned.has(blockId)) return;
        const block = appState.blockSpace[blockId];
        if (!block) return;

        const parentId = block.parent;
        if (parentId) {
            const parentBlock = appState.blockSpace[parentId];
            const parentSnapPointName = Object.keys(parentBlock.children).find(
                key => parentBlock.children[key].id === blockId
            );

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

        for (const childConnection of Object.values(block.children)) {
            processBlockPosition(childConnection.id);
        }
    }

    // --- Execution ---
    const topLevelBlocks = Object.values(appState.blockSpace).filter(b => !b.parent);
    topLevelBlocks.forEach(block => processBlockSize(block.uuid));
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
    const shapeData = blocks.Block(type, colors, sizes);
    // Use the newly generated snap points as the source of truth for rendering
    const blockElm = document.getElementById(uuid);
    if (blockElm) {
        svg.generate(blockElm, shapeData, text, getAppScale());
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

    if (currentTargetId) {
        dom.uuidinput.value = currentTargetId;
    }
}

function renderSelectedBlockControls() {
    clearNode(dom.slidersContainer);
    clearNode(dom.connectionsList);
    clearNode(dom.snapPointsList);

    const currentBlock = appState.blockSpace[appState.targetID];

    if (!currentBlock) {
        dom.blockPropertiesPanel.style.display = 'none';
        dom.connectionPropertiesPanel.style.display = 'none';
        dom.snapPointsPanel.style.display = 'none';
        return;
    }

    dom.blockPropertiesPanel.style.display = 'block';
    dom.typeinput.value = currentBlock.type;
    dom.color1input.value = currentBlock.colors.inner;
    dom.color2input.value = currentBlock.colors.outer;
    dom.textInput.value = currentBlock.text;

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
            removeBtn.textContent = 'X';
            removeBtn.dataset.index = index;
            header.appendChild(removeBtn);
        }

        const createAutoSlider = (labelText, prop, min, max, step, value, autoState) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'auto-slider-wrapper';

            const label = document.createElement('label');
            label.textContent = `${labelText}: `;
            const input = document.createElement('input');
            input.type = 'range';
            input.min = min; input.max = max; input.step = step; input.value = value;
            input.dataset.index = index; input.dataset.prop = prop;
            input.className = 'branch-input';
            input.disabled = autoState;
            label.appendChild(input);

            const autoLabel = document.createElement('label');
            const autoCheckbox = document.createElement('input');
            autoCheckbox.type = 'checkbox';
            autoCheckbox.checked = autoState;
            autoCheckbox.className = 'auto-size-checkbox';
            autoCheckbox.dataset.index = index;
            autoCheckbox.dataset.prop = prop;
            autoLabel.appendChild(autoCheckbox);
            autoLabel.appendChild(document.createTextNode(' Auto'));
            
            wrapper.appendChild(label);
            wrapper.appendChild(autoLabel);
            return wrapper;
        };

        branchDiv.appendChild(createAutoSlider('Height', 'height', 0.5, 10, 0.1, branch.height, branch.auto.height));
        branchDiv.appendChild(createAutoSlider('Width', 'width', 0.5, 10, 0.1, branch.width, branch.auto.width));


        if (branch.loop) {
            const loopLabel = document.createElement('label');
            loopLabel.textContent = `Loop Height: ${branch.loop.height.toFixed(1)} (auto)`;
            branchDiv.appendChild(loopLabel);
        }
        dom.slidersContainer.appendChild(branchDiv);
    });

    const allMaleSnapPoints = currentBlock.snapPoints.filter(p => p.role === 'male');
    const maleSnapPoints = [...new Map(allMaleSnapPoints.map(p => [p.name, p])).values()];

    let connectionCount = 0;
    maleSnapPoints.forEach(point => {
        const connection = currentBlock.children[point.name];
        if (connection) {
            connectionCount++;
            const childBlock = appState.blockSpace[connection.id];
            const childName = childBlock ? `${childBlock.type} (${childBlock.uuid.substring(0, 4)})` : '...';
            const div = document.createElement('div');
            div.className = 'connection-item';
            const textSpan = document.createElement('span');
            textSpan.innerHTML = `<b>${point.name}</b> → ${childName}`;
            const lockLabel = document.createElement('label');
            lockLabel.style.cursor = 'pointer';
            const lockCheckbox = document.createElement('input');
            lockCheckbox.type = 'checkbox';
            lockCheckbox.checked = connection.locked;
            lockCheckbox.dataset.pointName = point.name;
            lockLabel.appendChild(lockCheckbox);
            lockLabel.appendChild(document.createTextNode(' Locked'));
            div.appendChild(textSpan);
            div.appendChild(document.createElement('br'));
            div.appendChild(lockLabel);
            dom.connectionsList.appendChild(div);
        }
    });
    dom.connectionPropertiesPanel.style.display = connectionCount > 0 ? 'block' : 'none';

    dom.snapPointsPanel.style.display = 'block';
    
    currentBlock.snapPoints.forEach(point => {
        // We only want to list default points that are not custom
        const isCustom = currentBlock.sizes.some(s => s.customSnapPoints?.some(cp => cp.name === point.name));
        if (isCustom) return;

        const isConnected = !!currentBlock.children[point.name];
        const div = document.createElement('div');
        div.className = 'snap-point-item default-point';
        let connectionInfo = isConnected ? `<span class="connected"> (Connected)</span>` : '';
        const infoSpan = document.createElement('span');
        infoSpan.innerHTML = `<b>${point.name}</b> (${point.role}, ${point.type})${connectionInfo}`;
        div.appendChild(infoSpan);
        dom.snapPointsList.appendChild(div);
    });

    currentBlock.sizes.forEach((branch, branchIndex) => {
        if (!branch.customSnapPoints) return;

        branch.customSnapPoints.forEach((point, customPointIndex) => {
            const div = document.createElement('div');
            div.className = 'snap-point-item';
            const editorDiv = document.createElement('div');
            editorDiv.className = 'snap-point-editor';

            const createTextInput = (label, prop, value) => {
                const wrapper = document.createElement('div');
                const id = `snap-editor-${currentBlock.uuid}-${customPointIndex}-${prop}`;
                const labelEl = document.createElement('label');
                labelEl.textContent = `${label}: `;
                labelEl.htmlFor = id;
                const inputEl = document.createElement('input');
                inputEl.id = id;
                inputEl.type = 'text';
                inputEl.value = value;
                inputEl.className = 'snap-point-input';
                inputEl.dataset.branchIndex = branchIndex;
                inputEl.dataset.pointIndex = customPointIndex;
                inputEl.dataset.prop = prop;
                wrapper.appendChild(labelEl);
                wrapper.appendChild(inputEl);
                return wrapper;
            };

            const createSelect = (label, prop, options, value) => {
                const wrapper = document.createElement('div');
                const id = `snap-editor-${currentBlock.uuid}-${customPointIndex}-${prop}`;
                const labelEl = document.createElement('label');
                labelEl.textContent = `${label}: `;
                labelEl.htmlFor = id;
                const selectEl = document.createElement('select');
                selectEl.id = id;
                selectEl.className = 'snap-point-input';
                selectEl.dataset.branchIndex = branchIndex;
                selectEl.dataset.pointIndex = customPointIndex;
                selectEl.dataset.prop = prop;
                options.forEach(opt => {
                    const optionEl = document.createElement('option');
                    optionEl.value = opt;
                    optionEl.textContent = opt;
                    if (opt === value) optionEl.selected = true;
                    selectEl.appendChild(optionEl);
                });
                wrapper.appendChild(labelEl);
                wrapper.appendChild(selectEl);
                return wrapper;
            };

            editorDiv.appendChild(createTextInput('X', 'x', point.x));
            editorDiv.appendChild(createTextInput('Y', 'y', point.y));
            editorDiv.appendChild(createSelect('Role', 'role', ['male', 'female'], point.role));
            editorDiv.appendChild(createTextInput('Name', 'name', point.name));
            editorDiv.appendChild(createTextInput('Type', 'type', point.type));
            
            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'Remove';
            removeBtn.className = 'remove-snap-point';
            removeBtn.dataset.branchIndex = branchIndex;
            removeBtn.dataset.pointIndex = customPointIndex;
            editorDiv.appendChild(removeBtn);

            div.appendChild(editorDiv);
            dom.snapPointsList.appendChild(div);
        });
    });
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

    let needsRegeneration = false;

    if (updates.colors) {
        block.colors = updates.colors;
    }
    if (updates.text !== undefined) {
        block.text = updates.text;
    }
    if (updates.sizes) {
        block.sizes = updates.sizes;
        needsRegeneration = true;
    }
    if (updates.type && updates.type !== block.type) {
        block.type = updates.type;
        needsRegeneration = true;

        const newTypeIsBranch = ['block', 'hat', 'end'].includes(updates.type);
        block.sizes = block.sizes.map(s => {
            const newSize = { ...s };
            if (newTypeIsBranch) {
                if (!newSize.loop) newSize.loop = { height: MIN_LOOP_HEIGHT };
            } else {
                delete newSize.loop;
            }
            return newSize;
        });
    }

    if (needsRegeneration) {
        // CRITICAL FIX: The block component generators are the single source of truth.
        // By passing the full `sizes` object (with custom points), the generator returns a
        // complete `snapPoints` array with all coordinates resolved to numbers.
        const shapeData = blocks.Block(block.type, block.colors, block.sizes);
        block.snapPoints = shapeData.snapPoints;
    }
}

function createBlock(type, colors = { inner: "#4A90E2", outer: "#196ECF" }) {
    let uuid;
    do { uuid = crypto.randomUUID(); } while (appState.blockSpace.hasOwnProperty(uuid));

    const isBranch = ['block', 'hat', 'end'].includes(type);
    const sizes = [{ 
        height: 1, 
        width: 1,
        auto: { width: true, height: true },
        loop: isBranch ? { height: MIN_LOOP_HEIGHT } : undefined,
        customSnapPoints: []
    }];

    const blockData = blocks.Block(type, colors, sizes);

    appState.blockSpace[uuid] = {
        type, uuid, colors, sizes,
        text: '',
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
            restorableConnection.locked
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
                setParent(originalConnection.id, draggedBlockId, draggedBlockBottomPoint.name, originalConnection.locked);
                setParent(draggedBlockId, parentId, parentSnapPoint.name, false);
            }
        } else if (snapInfo.snapType === 'append') {
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
            render();
        });

        dom.slidersContainer.addEventListener('click', (event) => {
            if (event.target.matches('.auto-size-checkbox')) {
                const block = appState.blockSpace[appState.targetID];
                const idx = parseInt(event.target.dataset.index);
                const prop = event.target.dataset.prop;
                const newSizes = JSON.parse(JSON.stringify(block.sizes));
                newSizes[idx].auto[prop] = event.target.checked;
                editBlock(appState.targetID, { sizes: newSizes });
                render();
            } else if (event.target.matches('.remove-branch')) {
                 const idx = parseInt(event.target.dataset.index);
                const block = appState.blockSpace[appState.targetID];
                if (block.sizes.length > 1) {
                    const newSizes = block.sizes.filter((_, index) => index !== idx);
                    editBlock(appState.targetID, { sizes: newSizes });
                    render(); 
                }
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
    
    const controls = [dom.color1input, dom.color2input, dom.typeinput, dom.textInput];
    controls.forEach(input => {
        if (!input) return;
        input.addEventListener('change', () => {
            if (!appState.targetID) return;
            const updates = {};
            if (input === dom.typeinput) {
                updates.type = dom.typeinput.value;
            } else if (input === dom.textInput) {
                updates.text = dom.textInput.value;
            } else if (input === dom.color1input || input === dom.color2input) {
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

    if (dom.addBranchBtn) {
        dom.addBranchBtn.addEventListener('click', () => {
            if (!appState.targetID) return;
            const block = appState.blockSpace[appState.targetID];
            const newSizes = [...block.sizes, { height: 1, width: 1, auto: { width: false, height: false }, loop: { height: MIN_LOOP_HEIGHT } }];
            editBlock(appState.targetID, { sizes: newSizes });
            render();
        });
    }

    if (dom.addSnapPointBtn) {
        dom.addSnapPointBtn.addEventListener('click', () => {
            if (!appState.targetID) return;
            const block = appState.blockSpace[appState.targetID];
            const newSizes = JSON.parse(JSON.stringify(block.sizes));
            if (!newSizes[0].customSnapPoints) newSizes[0].customSnapPoints = [];
            let i = 0, newName;
            do { i++; newName = `custom_${i}`; } while (block.snapPoints.some(p => p.name === newName));
            newSizes[0].customSnapPoints.push({ name: newName, role: 'male', type: 'any', x: 0, y: 0 });
            editBlock(appState.targetID, { sizes: newSizes });
            render();
        });
    }

    if (dom.snapPointsList) {
        dom.snapPointsList.addEventListener('change', (event) => {
            const target = event.target;
            if (!target.matches('.snap-point-input') || !appState.targetID) return;

            const block = appState.blockSpace[appState.targetID];
            const branchIndex = parseInt(target.dataset.branchIndex, 10);
            const pointIndex = parseInt(target.dataset.pointIndex, 10);
            const prop = target.dataset.prop;
            let value = target.value.trim();

            if (prop === 'x' || prop === 'y') {
                if (value.toLowerCase() !== 'center') {
                    const numValue = parseFloat(value);
                    value = isNaN(numValue) ? 0 : numValue;
                } else {
                    value = 'center';
                }
            }
            
            const newSizes = JSON.parse(JSON.stringify(block.sizes));
            const pointToEdit = newSizes[branchIndex]?.customSnapPoints[pointIndex];
            
            if (pointToEdit) {
                pointToEdit[prop] = value;
                editBlock(appState.targetID, { sizes: newSizes });
                render();
            }
        });

        dom.snapPointsList.addEventListener('click', (event) => {
            const target = event.target;
            if (!appState.targetID) return;
            
            if (target.matches('.remove-snap-point')) {
                const block = appState.blockSpace[appState.targetID];
                const branchIndex = parseInt(target.dataset.branchIndex, 10);
                const pointIndex = parseInt(target.dataset.pointIndex, 10);
                const newSizes = JSON.parse(JSON.stringify(block.sizes));
                newSizes[branchIndex].customSnapPoints.splice(pointIndex, 1);
                editBlock(appState.targetID, { sizes: newSizes });
                render();
            }
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