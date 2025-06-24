import * as blocks from './blocks.js';
import * as svg from './svg.js';
import * as drag from './drag.js';

export const APP_SCALE = 8;
const MIN_LOOP_HEIGHT = 0.5;
const workSpace = document.getElementById('workspace');
const blockSpace = {};
let targetID = null;
const hinput = document.getElementById("h");
const winput = document.getElementById("w");
const typeinput = document.getElementById("type");
const uuidinput = document.getElementById("blockType");
const color1input = document.getElementById("color1");
const color2input = document.getElementById("color2");
const slidersContainer = document.getElementById("sliders");

function setupWorkspaceViewBox() {
    if (!workSpace) return;
    const box = workSpace.getBoundingClientRect();
    workSpace.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
}

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

function generateShape(uuid, type, colors, sizes) {
    const shapeData = blocks.Block(type, colors, sizes);
    const blockElm = document.getElementById(uuid);
    if (blockElm) {
        svg.generate(blockElm, shapeData, APP_SCALE);
    }
}

function clearSliders() {
    if (slidersContainer) slidersContainer.innerHTML = '';
}

function getBlockFootprint(blockId) {
    const block = blockSpace[blockId];
    if (!block) return 0;
    let footprint = 0;
    block.sizes.forEach(branch => {
        footprint += branch.height;
        if (branch.loop && branch.loop.height > 0) {
            footprint += branch.loop.height;
        }
    });
    return footprint;
}

function calculateChainHeight(startBlockId) {
    if (!startBlockId) return 0;
    let totalHeight = 0;
    let currentBlockId = startBlockId;
    while (currentBlockId) {
        totalHeight += getBlockFootprint(currentBlockId);
        const currentBlock = blockSpace[currentBlockId];
        currentBlockId = currentBlock ? currentBlock.children['bottom'] : null;
    }
    return totalHeight;
}

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

function updateLoopSize(loopBlockId, previewData = null) {
    if (!loopBlockId) return;
    const loopBlock = blockSpace[loopBlockId];
    if (!loopBlock || !loopBlock.sizes) return;
    let needsRedraw = false;
    const tempSizes = JSON.parse(JSON.stringify(loopBlock.sizes));
    for (let i = 0; i < tempSizes.length; i++) {
        const branch = tempSizes[i];
        if (branch.loop) {
            const innerChainStartId = loopBlock.children['topInner' + i];
            let chainHeight = calculateChainHeight(innerChainStartId);
            if (previewData && previewData.snapPointName === 'topInner' + i) {
                chainHeight += calculateChainHeight(previewData.draggedBlockId);
            }
            const newLoopHeight = chainHeight > 0 ? chainHeight : MIN_LOOP_HEIGHT;
            if (branch.loop.height !== newLoopHeight) {
                branch.loop.height = newLoopHeight;
                needsRedraw = true;
            }
        }
    }
    if (needsRedraw) {
        if (previewData) {
            generateShape(loopBlockId, loopBlock.type, loopBlock.colors, tempSizes);
        } else {
            editBlock(loopBlockId, loopBlock.type, loopBlock.colors, loopBlock.sizes);
        }
    }
}

function notifyAncestorsOfChange(startBlockId) {
    let currentBlockId = startBlockId;
    while (currentBlockId) {
        updateLoopSize(currentBlockId);
        const currentBlock = blockSpace[currentBlockId];
        currentBlockId = currentBlock ? currentBlock.parent : null;
    }
}

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
    notifyAncestorsOfChange(uuid);
}

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
        input.addEventListener("input", () => {
            if (!targetID || !blockSpace[targetID]) return;
            const idx = parseInt(input.getAttribute("data-index"));
            const prop = input.getAttribute("data-prop");
            const value = parseFloat(input.value);
            const block = blockSpace[targetID];
            block.sizes[idx][prop] = value;
            if (idx === 0) {
                if (prop === "height") hinput.value = value;
                else if (prop === "width") winput.value = value;
            }
            editBlock(targetID, block.type, block.colors, block.sizes);
        });
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

function onSnapPreview(snapInfo, draggedBlockId) {
    if (snapInfo.parentId) {
        const previewData = { draggedBlockId, snapPointName: snapInfo.parentSnapPoint.name };
        updateLoopSize(snapInfo.parentId, previewData);
    }
}

function onSnapPreviewEnd(snapInfo) {
    if (snapInfo.parentId) {
        updateLoopSize(snapInfo.parentId, null);
    }
}

function handleDetach(childId) {
    const childBlock = blockSpace[childId];
    if (!childBlock) return;
    const oldParentId = childBlock.parent;
    setParent(childId, null, null);
    if (oldParentId) {
        notifyAncestorsOfChange(oldParentId);
    }
}

function onDragEnd(draggedBlockId, finalTransform, snapInfo) {
    const mainDraggedBlock = blockSpace[draggedBlockId];
    if (!mainDraggedBlock) return;
    const startPos = mainDraggedBlock.transform;
    const delta = { x: finalTransform.x - startPos.x, y: finalTransform.y - startPos.y };
    getDragGroup(draggedBlockId, blockSpace).forEach(id => {
        if (blockSpace[id]) blockSpace[id].transform = { x: blockSpace[id].transform.x + delta.x, y: blockSpace[id].transform.y + delta.y };
    });
    if (!snapInfo) return;
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
    if (snapInfo.parentId) {
        notifyAncestorsOfChange(snapInfo.parentId);
        updateLayout(snapInfo.parentId);
    }
    if (snapInfo.snapType === 'insertion') {
        updateLayout(draggedBlockId);
    }
}

if (workSpace) {
    setupWorkspaceViewBox();
    window.addEventListener('resize', setupWorkspaceViewBox);
    drag.makeDraggable(workSpace, blockSpace, onDragEnd, handleDetach, onSnapPreview, onSnapPreviewEnd);
    createBlock("hat");
    color1input.addEventListener("input", () => {
        if (targetID) editBlock(targetID, blockSpace[targetID].type, { inner: color1input.value, outer: color2input.value }, blockSpace[targetID].sizes);
    });
    color2input.addEventListener("input", () => {
        if (targetID) editBlock(targetID, blockSpace[targetID].type, { inner: color1input.value, outer: color2input.value }, blockSpace[targetID].sizes);
    });
    typeinput.addEventListener("change", () => {
        if (targetID) editBlock(targetID, typeinput.value, blockSpace[targetID].colors, blockSpace[targetID].sizes);
        updateDimensionSliders();
    });
    uuidinput.addEventListener("change", () => {
        targetID = uuidinput.value;
        if (targetID) typeinput.value = blockSpace[targetID].type;
        updateDimensionSliders();
    });
    hinput.addEventListener("input", () => {
        if (targetID) {
            const block = blockSpace[targetID];
            block.sizes[0].height = parseFloat(hinput.value);
            editBlock(targetID, block.type, block.colors, block.sizes);
        }
    });
    winput.addEventListener("input", () => {
        if (targetID) {
            const block = blockSpace[targetID];
            block.sizes[0].width = parseFloat(winput.value);
            editBlock(targetID, block.type, block.colors, block.sizes);
        }
    });
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