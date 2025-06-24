import * as blocks from './blocks.js';
import * as svg from './svg.js';
import * as drag from './drag.js';

// --- CONFIGURATION ---
export const APP_SCALE = 8; 

// --- APPLICATION STATE ---
const workSpace = document.getElementById('workspace'); 
const blockSpace = {};
let targetID = null;

// MOVED: All UI element variables are now declared at the top of the script.
const hinput = document.getElementById("h");
const winput = document.getElementById("w");
const typeinput = document.getElementById("type");
const uuidinput = document.getElementById("blockType");
const color1input = document.getElementById("color1");
const color2input = document.getElementById("color2");
const slidersContainer = document.getElementById("sliders");

/**
 * Sets the workspace viewBox to match its pixel dimensions.
 * This creates a 1 unit = 1 pixel coordinate system.
 */
function setupWorkspaceViewBox() {
    if (!workSpace) return;
    const box = workSpace.getBoundingClientRect();
    workSpace.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
}

// **NEW**: Helper function to recursively get all children and their children.
function getDragGroup(blockId, allBlocks) {
    let group = [blockId];
    const block = allBlocks[blockId];
    if (block && block.children.length > 0) {
        for (const childId of block.children) {
            group = group.concat(getDragGroup(childId, allBlocks));
        }
    }
    return group;
}


// **NEW**: Manages the parent-child relationships in the data model.
function setParent(childId, newParentId) {
    const childBlock = blockSpace[childId];
    if (!childBlock) return;

    // 1. Detach from old parent (if any)
    const oldParentId = childBlock.parent;
    if (oldParentId && blockSpace[oldParentId]) {
        const oldParent = blockSpace[oldParentId];
        const childIndex = oldParent.children.indexOf(childId);
        if (childIndex > -1) {
            oldParent.children.splice(childIndex, 1);
        }
    }

    // 2. Set new parent on child
    childBlock.parent = newParentId;

    // 3. Attach to new parent (if any)
    if (newParentId && blockSpace[newParentId]) {
        const newParent = blockSpace[newParentId];
        if (!newParent.children.includes(childId)) {
            newParent.children.push(childId);
        }
    }
}


// **UPDATED**: This function now handles parenting and group position updates.
function onDragEnd(draggedBlockId, finalTransform, snapTargetId) {
    const mainDraggedBlock = blockSpace[draggedBlockId];
    if (!mainDraggedBlock) return;

    // 1. Update parent-child relationship in the data model.
    // If snapTargetId is null, this effectively makes the block an orphan.
    setParent(draggedBlockId, snapTargetId);

    // 2. Calculate how much the main block moved.
    const startPos = mainDraggedBlock.transform;
    const delta = {
        x: finalTransform.x - startPos.x,
        y: finalTransform.y - startPos.y,
    };

    // 3. Apply that same movement to the entire drag group in our data model.
    const groupIds = getDragGroup(draggedBlockId, blockSpace);
    groupIds.forEach(id => {
        const block = blockSpace[id];
        if (block) {
            block.transform.x += delta.x;
            block.transform.y += delta.y;
        }
    });
}


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
      parent: null,    // **NEW**
      children: []     // **NEW**
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

// ... the rest of your main.js file is unchanged ...
// removeBlock, editBlock, generateShape, populateSelector, etc.
// The only other change is the call to makeDraggable.

// --- INITIALIZATION & EVENT LISTENERS ---
if (workSpace) {
    setupWorkspaceViewBox();
    window.addEventListener('resize', setupWorkspaceViewBox);

    // **UPDATED**: Pass the new onDragEnd callback.
    drag.makeDraggable(workSpace, blockSpace, onDragEnd);
    createBlock("hat");

    // ... The rest of your event listeners are unchanged ...
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