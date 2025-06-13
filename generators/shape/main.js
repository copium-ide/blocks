import * as blocks from './blocks.js';
import * as svg from './svg.js';
import * as drag from '../../snapping/drag.js'

var workSpace = {};
var blockSpace = {};

// createBlock now stores branch dimensions as an array "sizes"
// Each branch has: height, width, and a nested loop property (with height).
// Default values are all 1.
function createBlock(type, colors = { inner: "#FFFFFF", outer: "#000000" }) {
  const uuid = crypto.randomUUID();
  if (blockSpace.hasOwnProperty(uuid)) {
    console.warn("Duplicate UUID found:", uuid);
    return createBlock(type, colors);
  } else {
    // Create one branch by default. Even though the last branch doesn’t need a loop,
    // we store it here for consistency; the UI will simply hide it.
    const sizes = [{ height: 1, width: 1, loop: { height: 1 } }];
    const block = { type: type, uuid: uuid, colors: colors, sizes: sizes };
    blockSpace[uuid] = block;

    const blockELM = document.createElementNS("http://www.w3.org/2000/svg", 'svg');
    blockELM.id = uuid;
    blockELM.setAttribute("blocktype", type);
    document.body.appendChild(blockELM);
    generateShape(uuid, type, colors, sizes);
    drag.makeDraggable(document.getElementById(uuid));
    // new drag.PlainDraggable(document.getElementById(uuid), { leftTop: true });

    populateSelector(blockSpace);
    // Automatically switch the selector to the new block
    document.getElementById('blockType').value = uuid;
    targetID = uuid;
    // Update the dimension sliders for the new block
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
    if (targetID === uuid) {
      clearSliders();
    }
  } else {
    console.warn("Block with UUID", uuid, "not found.");
    return;
  }
}

function editBlock(uuid, type, colors, sizes) {
  if (blockSpace.hasOwnProperty(uuid)) { 
    const block = blockSpace[uuid];
    block.type = type;
    block.colors = colors;
    // Update branch dimensions in the block info
    block.sizes = sizes;
    const blockELM = document.getElementById(uuid);
    if (blockELM) {
      blockELM.setAttribute("blocktype", type);
      generateShape(uuid, type, colors, sizes);
    }
  } else {
    console.warn("Block with UUID", uuid, "not found.");
    return;
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

// Update generateShape to pass branch dimensions (sizes)
function generateShape(uuid, type, colors, sizes) {
  svg.generate(blocks.Block(type, colors, sizes), document.getElementById(uuid));
}

function populateSelector(obj) {
  const selectElement = document.getElementById('blockType');
  selectElement.innerHTML = ''; // Clear existing options
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = key;
      selectElement.appendChild(option);
      targetID = key; // Set the targetID to the last block created
    }
  }
  updateDimensionSliders();
}

var hinput = document.getElementById("h");
var winput = document.getElementById("w");
var typeinput = document.getElementById("type");
var uuidinput = document.getElementById("blockType");
var color1input = document.getElementById("color1");
var color2input = document.getElementById("color2");
var slidersContainer = document.getElementById("sliders");

// Create initial block
createBlock("block");

var targetID = uuidinput.options[uuidinput.selectedIndex].value;
var type = typeinput.options[typeinput.selectedIndex].text;

// --- Dynamic Slider Setup for Branch Dimensions ---

// Update or create slider controls for each branch in the current block.
// Update or create slider controls for each branch in the current block.
function updateDimensionSliders() {
    clearSliders();
    if (!blockSpace[targetID]) return;
    const currentBlock = blockSpace[targetID];
    // Update the global h and w sliders for branch 1.
    hinput.value = currentBlock.sizes[0].height;
    winput.value = currentBlock.sizes[0].width;
    // Create a slider group for each branch
    currentBlock.sizes.forEach((branch, index) => {
      const branchDiv = document.createElement("div");
      branchDiv.className = "branch-slider";
      branchDiv.setAttribute("data-index", index);
      
      // Header with branch number and remove button
      let headerHTML = `<h4>Branch ${index + 1}</h4>`;
      // Only allow removal if more than one branch exists
      if (currentBlock.sizes.length > 1) {
        headerHTML += `<button class="remove-branch" data-index="${index}">Remove Branch</button>`;
      }
      branchDiv.innerHTML = headerHTML;
      
      // Height slider (default value = 1)
      branchDiv.innerHTML += `
        <label>Height: 
          <input type="range" min="0.5" max="10" step="0.1" value="${branch.height}" data-index="${index}" data-prop="height" class="branch-input">
        </label>
        <label>Width: 
          <input type="range" min="0.5" max="10" step="0.1" value="${branch.width}" data-index="${index}" data-prop="width" class="branch-input">
        </label>`;
        
      // For the first branch, show the loop height as fixed value 1 (no slider)
      if (index === currentBlock.sizes.length - 1) {
        branchDiv.innerHTML += `<label>Loop Height: 0</label>`;
        // Ensure the value is set to 1 in the block's data (if it isn't already)
        branch.loop.height = 0;
      } else {
        // For all other branches, add the editable Loop Height slider.
        branchDiv.innerHTML += `
          <label>Loop Height: 
            <input type="range" min="0" max="10" step="0.1" value="${branch.loop.height}" data-index="${index}" data-prop="loop" class="branch-input">
          </label>`;
      }
      
      slidersContainer.appendChild(branchDiv);
    });
    
    // Attach event listeners for branch inputs
    const branchInputs = document.querySelectorAll(".branch-input");
    branchInputs.forEach(input => {
      input.addEventListener("input", function(event) {
        const idx = parseInt(this.getAttribute("data-index"));
        const prop = this.getAttribute("data-prop");
        const value = parseFloat(this.value);
        if (!blockSpace[targetID]) return;
        if (prop === "loop") {
          blockSpace[targetID].sizes[idx].loop.height = value;
        } else {
          blockSpace[targetID].sizes[idx][prop] = value;
          // If this is the first branch, update the global h/w inputs as well.
          if (idx === 0) {
            if (prop === "height") {
              hinput.value = value;
            } else if (prop === "width") {
              winput.value = value;
            }

          }
        }
        editBlock(targetID, blockSpace[targetID].type, blockSpace[targetID].colors, blockSpace[targetID].sizes);
      });
    });
    
    // Attach event listeners for remove branch buttons
    const removeButtons = document.querySelectorAll(".remove-branch");
    removeButtons.forEach(button => {
      button.addEventListener("click", function(event) {
        const idx = parseInt(this.getAttribute("data-index"));
        if (!blockSpace[targetID]) return;
        const sizes = blockSpace[targetID].sizes;
        // Only remove if more than one branch remains.
        if (sizes.length > 1) {
          sizes.splice(idx, 1);
          updateDimensionSliders();
          editBlock(targetID, blockSpace[targetID].type, blockSpace[targetID].colors, sizes);
        }
      });
    });
}
  

function clearSliders() {
  while (slidersContainer.firstChild) {
    slidersContainer.removeChild(slidersContainer.firstChild);
  }
}

// --- End Dynamic Slider Setup ---

// Function to update the block color
function updateBlockColor() {
  if (blockSpace[targetID]) {
    blockSpace[targetID].colors = { inner: color1input.value, outer: color2input.value };
    editBlock(targetID, type, blockSpace[targetID].colors, blockSpace[targetID].sizes);
  }
}

// Listen for color changes
color1input.addEventListener("input", updateBlockColor);
color2input.addEventListener("input", updateBlockColor);

typeinput.onchange = function(event) {
  type = typeinput.options[typeinput.selectedIndex].text;
  editBlock(targetID, type, blockSpace[targetID].colors, blockSpace[targetID].sizes);
};

uuidinput.onchange = function(event) {
  targetID = uuidinput.options[uuidinput.selectedIndex].value;
  updateDimensionSliders();
  editBlock(targetID, type, blockSpace[targetID].colors, blockSpace[targetID].sizes);
};

// Global h and w input listeners for branch 1 (the main branch)
hinput.oninput = function(event) {
  if (blockSpace[targetID]) {
    blockSpace[targetID].sizes[0].height = parseFloat(hinput.value);
    updateDimensionSliders();
    editBlock(targetID, type, blockSpace[targetID].colors, blockSpace[targetID].sizes);
  }
};

winput.oninput = function(event) {
  if (blockSpace[targetID]) {
    blockSpace[targetID].sizes[0].width = parseFloat(winput.value);
    updateDimensionSliders();
    editBlock(targetID, type, blockSpace[targetID].colors, blockSpace[targetID].sizes);
  }
};

// Initial edit to set up the block based on current values
editBlock(targetID, type, blockSpace[targetID].colors, blockSpace[targetID].sizes);

// Add Branch Button – adds a new branch with default dimensions (all default to 1)
const addBranchBtn = document.getElementById('addBranch');
if (addBranchBtn) {
  addBranchBtn.addEventListener('click', function(event) {
    if (blockSpace[targetID]) {
      // New branch default: height = 1, width = 1, loop height = 1.
      blockSpace[targetID].sizes.push({ height: 1, width: 1, loop: { height: 1 } });
      updateDimensionSliders();
      editBlock(targetID, type, blockSpace[targetID].colors, blockSpace[targetID].sizes);
    }
  });
}

const create = document.getElementById('create');
create.addEventListener('click', function(event) {
  createBlock(type);
});

const remove = document.getElementById('remove');
remove.addEventListener('click', function(event) {
  removeBlock(targetID);
});
