import * as blocks from './blocks.js';
import * as svg from './svg.js';
import * as drag from './drag.js';

// The main SVG workspace where all blocks live.
// IMPORTANT: Create this in your HTML: <svg id="workspace"></svg>
var workSpace = document.getElementById('workspace'); 
var blockSpace = {};

var targetID = null; // The UUID of the currently selected block in the UI.

// Callback function for drag.js to update a block's position in our central state.
function onBlockPositionUpdate(uuid, newTransform) {
  if (blockSpace[uuid]) {
    blockSpace[uuid].transform = newTransform;
  }
}

// createBlock now stores transform and snap points, and appends to the workspace.
function createBlock(type, colors = { inner: "#FFFFFF", outer: "#000000" }) {
  const uuid = crypto.randomUUID();
  if (blockSpace.hasOwnProperty(uuid)) {
    console.warn("Duplicate UUID found:", uuid);
    return createBlock(type, colors);
  } else {
    const sizes = [{ height: 1, width: 1, loop: { height: 1 } }];
    // The block's data model, including its current position.
    const block = { 
        type: type, 
        uuid: uuid, 
        colors: colors, 
        sizes: sizes, 
        transform: { x: 20, y: 20 } // Initial position
    };
    
    const shapeData = blocks.Block(type, colors, sizes);
    block.snapPoints = shapeData.snapPoints; // Store snap points on the block object.
    
    blockSpace[uuid] = block;

    const blockELM = document.createElementNS("http://www.w3.org/2000/svg", 'svg');
    blockELM.id = uuid;
    blockELM.setAttribute("blocktype", type);
    blockELM.style.transform = `translate(${block.transform.x}px, ${block.transform.y}px)`;
    
    // Append to the main workspace, not the body.
    workSpace.appendChild(blockELM);
    
    generateShape(uuid, type, colors, sizes);

    populateSelector(blockSpace);
    document.getElementById('blockType').value = uuid;
    targetID = uuid;
    updateDimensionSliders();
    return block;
  }
}

function removeBlock(uuid) {
  if (blockSpace.hasOwnProperty(uuid)) {
    delete blockSpace[uuid];
    const blockELM = document.getElementById(uuid);
    if (blockELM) {
      blockELM.remove();
    }
    populateSelector(blockSpace);
    // If the removed block was selected, select another one or clear sliders.
    if (targetID === uuid) {
        const remainingKeys = Object.keys(blockSpace);
        if (remainingKeys.length > 0) {
            targetID = remainingKeys[0];
            document.getElementById('blockType').value = targetID;
            updateDimensionSliders();
        } else {
            targetID = null;
            clearSliders();
        }
    }
  } else {
    console.warn("Block with UUID", uuid, "not found.");
  }
}

function editBlock(uuid, type, colors, sizes) {
  if (blockSpace.hasOwnProperty(uuid)) { 
    const block = blockSpace[uuid];
    block.type = type;
    block.colors = colors;
    block.sizes = sizes;

    // Re-calculate snap points when the block's shape changes.
    const shapeData = blocks.Block(type, colors, sizes);
    block.snapPoints = shapeData.snapPoints;

    const blockELM = document.getElementById(uuid);
    if (blockELM) {
      blockELM.setAttribute("blocktype", type);
      generateShape(uuid, type, colors, sizes);
    }
  } else {
    console.warn("Block with UUID", uuid, "not found.");
  }
}

function getBlock(uuid, parameter) {
  if (blockSpace.hasOwnProperty(uuid)) { 
    const block = blockSpace[uuid];
    return block[parameter];
  } else {
    console.warn("Block with UUID", uuid, "not found.");
    return null;
  }
}

function generateShape(uuid, type, colors, sizes) {
  const shapeData = blocks.Block(type, colors, sizes);
  svg.generate(shapeData, document.getElementById(uuid));
}

function populateSelector(obj) {
  const selectElement = document.getElementById('blockType');
  selectElement.innerHTML = ''; // Clear existing options
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = `${obj[key].type} (${key.substring(0, 8)})`; // More descriptive
      selectElement.appendChild(option);
      targetID = key; // Set the targetID to the last block created
    }
  }
}

// --- UI Element References and Event Listeners ---

var hinput = document.getElementById("h");
var winput = document.getElementById("w");
var typeinput = document.getElementById("type");
var uuidinput = document.getElementById("blockType");
var color1input = document.getElementById("color1");
var color2input = document.getElementById("color2");
var slidersContainer = document.getElementById("sliders");

function updateDimensionSliders() {
    clearSliders();
    if (!targetID || !blockSpace[targetID]) return;
    const currentBlock = blockSpace[targetID];
    const type = currentBlock.type;

    // Show/hide main H/W sliders based on block type.
    const isBranchBlock = ['block', 'hat', 'end'].includes(type);
    document.getElementById('main-sliders').style.display = isBranchBlock ? 'block' : 'none';

    if (isBranchBlock) {
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
        if (index === currentBlock.sizes.length - 1) {
          branchDiv.innerHTML += `<label>Loop Height: 0 (End)</label>`;
          branch.loop.height = 0;
        } else {
          branchDiv.innerHTML += `
            <label>Loop Height: 
              <input type="range" min="0" max="10" step="0.1" value="${branch.loop.height}" data-index="${index}" data-prop="loop" class="branch-input">
            </label>`;
        }
      }
      
      slidersContainer.appendChild(branchDiv);
    });
    
    // Attach event listeners for all dimension inputs
    document.querySelectorAll(".branch-input").forEach(input => {
      input.addEventListener("input", function() {
        if (!targetID || !blockSpace[targetID]) return;
        const idx = parseInt(this.getAttribute("data-index"));
        const prop = this.getAttribute("data-prop");
        const value = parseFloat(this.value);

        const currentBlock = blockSpace[targetID];
        if (prop === "loop") {
          currentBlock.sizes[idx].loop.height = value;
        } else {
          currentBlock.sizes[idx][prop] = value;
          if (idx === 0) {
            if (prop === "height") hinput.value = value;
            else if (prop === "width") winput.value = value;
          }
        }
        editBlock(targetID, currentBlock.type, currentBlock.colors, currentBlock.sizes);
      });
    });
    
    // Attach event listeners for remove branch buttons
    document.querySelectorAll(".remove-branch").forEach(button => {
      button.addEventListener("click", function() {
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

function clearSliders() {
    slidersContainer.innerHTML = '';
}

function updateBlockColor() {
  if (targetID && blockSpace[targetID]) {
    const block = blockSpace[targetID];
    block.colors = { inner: color1input.value, outer: color2input.value };
    editBlock(targetID, block.type, block.colors, block.sizes);
  }
}

color1input.addEventListener("input", updateBlockColor);
color2input.addEventListener("input", updateBlockColor);

typeinput.onchange = function() {
  if (targetID && blockSpace[targetID]) {
    const type = typeinput.options[typeinput.selectedIndex].text;
    editBlock(targetID, type, blockSpace[targetID].colors, blockSpace[targetID].sizes);
    updateDimensionSliders(); // Sliders might need to change for new type
  }
};

uuidinput.onchange = function() {
  targetID = uuidinput.options[uuidinput.selectedIndex].value;
  updateDimensionSliders();
};

hinput.oninput = function() {
  if (targetID && blockSpace[targetID]) {
    blockSpace[targetID].sizes[0].height = parseFloat(hinput.value);
    updateDimensionSliders();
    editBlock(targetID, blockSpace[targetID].type, blockSpace[targetID].colors, blockSpace[targetID].sizes);
  }
};

winput.oninput = function() {
  if (targetID && blockSpace[targetID]) {
    blockSpace[targetID].sizes[0].width = parseFloat(winput.value);
    updateDimensionSliders();
    editBlock(targetID, blockSpace[targetID].type, blockSpace[targetID].colors, blockSpace[targetID].sizes);
  }
};

document.getElementById('addBranch').addEventListener('click', function() {
  if (targetID && blockSpace[targetID]) {
    blockSpace[targetID].sizes.push({ height: 1, width: 1, loop: { height: 1 } });
    updateDimensionSliders();
    editBlock(targetID, blockSpace[targetID].type, blockSpace[targetID].colors, blockSpace[targetID].sizes);
  }
});

document.getElementById('create').addEventListener('click', function() {
  createBlock(typeinput.options[typeinput.selectedIndex].text);
});

document.getElementById('remove').addEventListener('click', function() {
  if (targetID) {
    removeBlock(targetID);
  }
});

// --- INITIALIZATION ---
if (workSpace) {
    // Initialize the single draggable instance on the main workspace.
    drag.makeDraggable(workSpace, blockSpace, onBlockPositionUpdate);

    // Create the first block.
    createBlock("hat");
} else {
    console.error("The <svg id='workspace'> element was not found. Draggable functionality will not work.");
}