import * as blocks from './blocks.js';
import * as inputs from './inputs.js';
import * as svg from './svg.js';

const testELM = document.createElementNS("http://www.w3.org/2000/svg", 'svg');
testELM.id = 'testELM';
document.body.appendChild(testELM);

function generateShape(type, h, w) {
    var innerC, outerC;
    if (type === 'block') {
        innerC = "#FF0000";
        outerC = "#000000";
    } else if (type === 'hat') {
        innerC = "#00FF00";
        outerC = "#000000";
    } else if (type === 'end') {
        innerC = "#0000FF";
        outerC = "#000000";
    } else {
        innerC = "#FFFFFF";
        outerC = "#000000";
    }
    svg.generate(blocks.generate(type, { inner: innerC, outer: outerC }, h, w), document.getElementById('testELM'));
}

var hinput = document.getElementById("h");
var winput = document.getElementById("w");
var typeinput = document.getElementById("type");

hinput.value = 1;
winput.value = 1;
typeinput.value = 'block';
var type = typeinput.options[typeinput.selectedIndex].text;

typeinput.onchange = function(event) {
    type = typeinput.options[typeinput.selectedIndex].text;
    generateShape(type, hinput.value, winput.value);
}
hinput.oninput = function(event) {
    generateShape(type, hinput.value, winput.value);
};
winput.oninput = function(event) {
    generateShape(type, hinput.value, winput.value);
};
generateShape(type, hinput.value, winput.value);



let isDragging = false;
let offset = { x: 0, y: 0 };

// When the user starts dragging the circle
testELM.addEventListener('mousedown', (e) => {
    isDragging = true;
    // Calculate the difference between mouse position and circle's center
    const cx = parseFloat(testELM.getAttribute('cx'));
    const cy = parseFloat(testELM.getAttribute('cy'));
    offset.x = e.clientX - cx;
    offset.y = e.clientY - cy;
});

// When the user moves the mouse, update the circle's position if dragging
document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    // New center position for the circle
    const newX = e.clientX - offset.x;
    const newY = e.clientY - offset.y;
    testELM.setAttribute('cx', newX);
    testELM.setAttribute('cy', newY);
});

// When the user releases the mouse button, stop dragging
document.addEventListener('mouseup', () => {
    isDragging = false;
});