import * as blocks from './blocks.js';
import * as svg from './svg.js';
import * as drag from './drag.js';

const APP_SCALE = 5; 

const workSpace = document.getElementById('workspace'); 
const blockSpace = {};
let targetID = null;

/**
 * Sets the workspace viewBox to match its pixel dimensions.
 * This creates a 1 unit = 1 pixel coordinate system.
 * It should be called on load and on window resize.
 */
function setupWorkspaceViewBox() {
    const box = workSpace.getBoundingClientRect();
    workSpace.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
}

function onBlockPositionUpdate(uuid, newTransform) {
  if (blockSpace[uuid]) {
    blockSpace[uuid].transform = newTransform;
  }
}

function createBlock(type, colors = { inner: "#FFFFFF", outer: "#000000" }) {
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
      transform: { x: 420, y: 50 } // Represents the (x, y) attributes now
  };
  
  const shapeData = blocks.Block(type, colors, sizes);
  block.snapPoints = shapeData.snapPoints;
  blockSpace[uuid] = block;

  const blockELM = document.createElementNS("http://www.w3.org/2000/svg", 'svg');
  blockELM.id = uuid;
  blockELM.setAttribute("blocktype", type);
  // Set position using SVG attributes, not CSS transform
  blockELM.setAttribute('x', block.transform.x);
  blockELM.setAttribute('y', block.transform.y);
  
  // Append the new block SVG *inside* the main workspace SVG
  workSpace.appendChild(blockELM);
  
  generateShape(uuid, type, colors, sizes);

  populateSelector(blockSpace);
  document.getElementById('blockType').value = uuid;
  targetID = uuid;
  updateDimensionSliders();
  return block;
}

function removeBlock(uuid) {
    if (blockSpace.hasOwnProperty(uuid)) {
        delete blockSpace[uuid];
        const blockELM = document.getElementById(uuid);
        if (blockELM) blockELM.remove();
        
        if (targetID === uuid) {
            const remainingKeys = Object.keys(blockSpace);
            targetID = remainingKeys.length > 0 ? remainingKeys[0] : null;
            if(targetID) {
                document.getElementById('blockType').value = targetID;
                updateDimensionSliders();
            } else {
                clearSliders();
            }
        }
        populateSelector(blockSpace);
    }
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
}

function generateShape(uuid, type, colors, sizes) {
    const shapeData = blocks.Block(type, colors, sizes);
    const blockElm = document.getElementById(uuid);
    if (blockElm) {
        svg.generate(shapeData, blockElm, APP_SCALE);
    }
}

function populateSelector(obj) {
  const selectElement = document.getElementById('blockType');
  const currentVal = selectElement.value;
  selectElement.innerHTML = '';
  for (const key in obj) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = `${obj[key].type} (${key.substring(0, 8)})`;
    selectElement.appendChild(option);
  }
  // Try to restore the previously selected value
  if (obj[currentVal]) {
      selectElement.value = currentVal;
  }
}

// --- All UI and event listener functions remain the same ---
// (No changes needed for updateDimensionSliders, clearSliders, updateBlockColor, etc.)
// ... (Your existing UI functions) ...

// --- INITIALIZATION ---
if (workSpace) {
    setupWorkspaceViewBox();
    window.addEventListener('resize', setupWorkspaceViewBox);

    drag.makeDraggable(workSpace, blockSpace, onBlockPositionUpdate);
    createBlock("hat");
} else {
    console.error("The <svg id='workspace'> element was not found.");
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

    const mainSliders = document.getElementById('main-sliders');
    const isBranchBlock = ['block', 'hat', 'end'].includes(type);
    if(mainSliders) mainSliders.style.display = isBranchBlock ? 'block' : 'none';

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
    updateDimensionSliders();
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