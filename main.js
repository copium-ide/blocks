import * as blocks from './generators/shape/blocks.js';
import * as inputs from './generators/shape/inputs.js';
import * as svg from './generators/shape/svg.js';

var workSpace = {};
var blockSpace = {};

// Now createBlock also stores h and w in the block info
function createBlock(type, colors = { inner: "#FFFFFF", outer: "#000000" }) {
    const uuid = crypto.randomUUID();
    if (blockSpace.hasOwnProperty(uuid)) {
        console.warn("Duplicate UUID found:", uuid);
        return createBlock(type, colors);
    } else {
        // Default height and width are set to 1
        const block = { type: type, uuid: uuid, colors: colors, h: 1, w: 1 };
        blockSpace[uuid] = block;

        const blockELM = document.createElementNS("http://www.w3.org/2000/svg", 'svg');
        blockELM.id = uuid;
        blockELM.setAttribute("blocktype", type);
        document.body.appendChild(blockELM);
        generateShape(uuid, type, colors, block.h, block.w);
        new PlainDraggable(document.getElementById(uuid), { leftTop: true });

        populateSelector(blockSpace);
        // Automatically switch the selector to the new block
        document.getElementById('blockType').value = uuid;
        // Also update the global targetID to the new block's uuid
        targetID = uuid;
        // And update the slider values to the block's height and width
        hinput.value = block.h;
        winput.value = block.w;

        return block;
    }
}

function removeBlock(uuid) {
    if (blockSpace.hasOwnProperty(uuid)) {
        const block = blockSpace[uuid];
        delete blockSpace[uuid];
        const blockELM = document.getElementById(uuid);
        if (blockELM) {
            blockELM.remove();
        }
        populateSelector(blockSpace);
    } else {
        console.warn("Block with UUID", uuid, "not found.");
        return;
    }
}

function editBlock(uuid, type, colors, h, w) {
    if (blockSpace.hasOwnProperty(uuid)) { 
        const block = blockSpace[uuid];
        block.type = type;
        block.colors = colors;
        // Update height and width in the block info
        block.h = h;
        block.w = w;
        const blockELM = document.getElementById(uuid);
        if (blockELM) {
            blockELM.setAttribute("blocktype", type);
            generateShape(uuid, type, colors, h, w);
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

function generateShape(uuid, type, colors, h, w) {
    if (type === 'block') {
        svg.generate(blocks.Block(colors, h, w), document.getElementById(uuid));
    } else if (type === 'hat') {
        svg.generate(blocks.Hat(colors, h, w), document.getElementById(uuid));
    } else if (type === 'end') {
        svg.generate(blocks.End(colors, h, w), document.getElementById(uuid));
    } else if (type === 'loop') {
          
        const sizes = [
            {
                width: 4,
                height: 2,
                loop: { height: 1 }
            },
            {
                width: 4,
                height: 3,
                loop: { height: 1 }
            }
        ];
          
        svg.generate(blocks.Loop(colors, sizes), document.getElementById(uuid));
    }
}

function populateSelector(obj) {
    const selectElement = document.getElementById('blockType');
    selectElement.innerHTML = ''; // Clear existing options
    // Loop over the object's own properties
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            // Create a new option element
            const option = document.createElement('option');
            option.value = key;
            option.textContent = key;
            // Append the new option to the select element
            selectElement.appendChild(option);
            targetID = key; // Set the targetID to the last block created
        }
    }
}

var hinput = document.getElementById("h");
var winput = document.getElementById("w");
var typeinput = document.getElementById("type");
var uuidinput = document.getElementById("blockType");
var color1input = document.getElementById("color1");
var color2input = document.getElementById("color2");

createBlock("block");

// Initialize sliders based on the current (first) block's stored dimensions
hinput.value = blockSpace[uuidinput.options[uuidinput.selectedIndex].value].h;
winput.value = blockSpace[uuidinput.options[uuidinput.selectedIndex].value].w;
var targetID = uuidinput.options[uuidinput.selectedIndex].value;
var type = typeinput.options[typeinput.selectedIndex].text;

// Function to update the block color
function updateBlockColor() {
    if (blockSpace[targetID]) {
        blockSpace[targetID].colors = { inner: color1input.value, outer: color2input.value };
        editBlock(targetID, type, blockSpace[targetID].colors, hinput.value, winput.value);
    }
}

// Listen for color changes
color1input.addEventListener("input", updateBlockColor);
color2input.addEventListener("input", updateBlockColor);

typeinput.onchange = function(event) {
    type = typeinput.options[typeinput.selectedIndex].text;
    editBlock(targetID, type, blockSpace[targetID].colors, hinput.value, winput.value);
};

uuidinput.onchange = function(event) {
    targetID = uuidinput.options[uuidinput.selectedIndex].value;
    // Update the sliders with the stored height and width of the selected block
    hinput.value = blockSpace[targetID].h;
    winput.value = blockSpace[targetID].w;
    editBlock(targetID, type, blockSpace[targetID].colors, hinput.value, winput.value);
};

hinput.oninput = function(event) {
    editBlock(targetID, type, blockSpace[targetID].colors, hinput.value, winput.value);
};

winput.oninput = function(event) {
    editBlock(targetID, type, blockSpace[targetID].colors, hinput.value, winput.value);
};

// Initial edit to set up the block based on input values
editBlock(targetID, type, blockSpace[targetID].colors, hinput.value, winput.value);

const create = document.getElementById('create');

create.addEventListener('click', function(event) {
    createBlock(type);
});

const remove = document.getElementById('remove');

remove.addEventListener('click', function(event) {
    removeBlock(targetID);
});
