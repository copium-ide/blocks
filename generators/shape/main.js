import * as blocks from './blocks.js';
import * as inputs from './inputs.js';
import * as svg from './svg.js';

const testELM = document.createElementNS("http://www.w3.org/2000/svg", 'svg');
testELM.id = 'testELM';
document.body.appendChild(testELM);

function generateShape(type, h, w) {
    svg.generate(blocks.generate(type, { inner: '#ffffff', outer: '#000000' }, h, w), document.getElementById('testELM'));
}

var hinput = document.getElementById("h");
var winput = document.getElementById("w");
var typeinput = document.getElementById("type");

hinput.value = 1;
winput.value = 1;
typeinput.value = 'block';
type = typeinput.options[typeinput.selectedIndex].text;

typeinput.onchange = function(event) {
    type = typeinput.options[typeinput.selectedIndex].text;
    console.log(type);
}
hinput.oninput = function(event) {
    generateShape(type, hinput.value, winput.value);
};
winput.oninput = function(event) {
    generateShape(type, hinput.value, winput.value);
};
generateShape(type, hinput.value, winput.value);