import * as blocks from './generators/shape/blocks.js';
import * as loops from './generators/shape/loops.js';
import * as inputs from './generators/shape/inputs.js';
import * as svg from './generators/shape/svg.js';



const testELM = document.createElementNS("http://www.w3.org/2000/svg", 'svg');
testELM.id = 'testELM';
document.body.appendChild(testELM);

var draggable = new PlainDraggable(document.getElementById('testELM'), {leftTop: true});

function generateShape(type, h, w) {
    var innerC, outerC;
    if (type === 'block') {
        innerC = "#FF0000";
        outerC = "#000000";
        svg.generate(blocks.Block({ inner: innerC, outer: outerC }, h, w), document.getElementById('testELM'));
    } else if (type === 'hat') {
        innerC = "#00FF00";
        outerC = "#000000";
        svg.generate(blocks.Hat({ inner: innerC, outer: outerC }, h, w), document.getElementById('testELM'));
    } else if (type === 'end') {
        innerC = "#0000FF";
        outerC = "#000000";
        svg.generate(blocks.End({ inner: innerC, outer: outerC }, h, w), document.getElementById('testELM'));
    } else {
        innerC = "#FFFFFF";
        outerC = "#000000";
    }
    
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