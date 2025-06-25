import * as main from "./main.js";

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

export function makeDraggable(svgContainer, allBlocks, onSnap, onDetach) {
    const SNAP_RADIUS = 100;

    // --- Drag State ---
    let isDragging = false;
    let selectedElement = null;
    let dragGroup = [];
    let offset = { x: 0, y: 0 };

    // --- Snap State ---
    let currentSnapTarget = null;
    let snapPointVisualizerGroup = null;
    // This tracks the connection broken by an insertion, so it can be restored.
    let restorableConnection = null;


    function getSVGCoordinates(event) {
        const pt = svgContainer.createSVGPoint();
        if (event.touches && event.touches.length > 0) {
            pt.x = event.touches[0].clientX;
            pt.y = event.touches[0].clientY;
        } else if (event.changedTouches && event.changedTouches.length > 0) {
            pt.x = event.changedTouches[0].clientX;
            pt.y = event.changedTouches[0].clientY;
        } else {
            pt.x = event.clientX;
            pt.y = event.clientY;
        }
        const ctm = svgContainer.getScreenCTM();
        return ctm ? pt.matrixTransform(ctm.inverse()) : { x: 0, y: 0 };
    }

    // --- Drag Event Handlers ---

    function startDrag(event) {
        if (event.type === 'mousedown' && event.button !== 0) return;

        const target = event.target.closest('svg[blocktype]');
        if (!target || !svgContainer.contains(target)) return;

        isDragging = true;
        selectedElement = target;
        
        // Clear any leftover state from a previous drag.
        restorableConnection = null;
        currentSnapTarget = null;

        const blockData = allBlocks[selectedElement.id];
        if (blockData && blockData.parent) {
            onDetach(selectedElement.id, null, true); // Detach without restoring anything
        }

        const mainBlockStartPos = blockData.transform || { x: 0, y: 0 };
        const dragGroupIds = getDragGroup(selectedElement.id, allBlocks);
        dragGroup = dragGroupIds.map(id => {
            const el = document.getElementById(id);
            const currentBlockData = allBlocks[id];
            if (el && currentBlockData?.transform) {
                svgContainer.appendChild(el);
                return {
                    id: id,
                    el: el,
                    relativeOffset: {
                        x: currentBlockData.transform.x - mainBlockStartPos.x,
                        y: currentBlockData.transform.y - mainBlockStartPos.y
                    }
                };
            }
            return null;
        }).filter(Boolean);

        selectedElement.classList.add('active');

        const startPoint = getSVGCoordinates(event);
        offset.x = startPoint.x - mainBlockStartPos.x;
        offset.y = startPoint.y - mainBlockStartPos.y;

        createSnapVisualizers();
        
        window.addEventListener('mousemove', drag);
        window.addEventListener('mouseup', endDrag);
        window.addEventListener('touchmove', drag, { passive: false });
        window.addEventListener('touchend', endDrag);
        window.addEventListener('blur', endDrag);

        if (event.cancelable) event.preventDefault();
    }

    function drag(event) {
        if (!isDragging || !selectedElement) return;
        if (event.cancelable) event.preventDefault();

        const coord = getSVGCoordinates(event);
        const mouseDrivenPos = { x: coord.x - offset.x, y: coord.y - offset.y };
        const dragGroupIds = dragGroup.map(item => item.id);

        const newSnapInfo = checkForSnap(selectedElement.id, mouseDrivenPos, dragGroupIds);

        if (newSnapInfo) {
            const isSameTarget = currentSnapTarget &&
                                 currentSnapTarget.parentId === newSnapInfo.parentId &&
                                 currentSnapTarget.parentSnapPoint.name === newSnapInfo.parentSnapPoint.name;

            if (!isSameTarget) {
                // If we are about to make an insertion, save the connection we're breaking.
                if (newSnapInfo.snapType === 'insertion') {
                    restorableConnection = {
                        childId: newSnapInfo.originalChildId,
                        parentId: newSnapInfo.parentId,
                        snapPointName: newSnapInfo.parentSnapPoint.name
                    };
                }
                onSnap(selectedElement.id, newSnapInfo.position, newSnapInfo);
                currentSnapTarget = newSnapInfo;
            }
        } else {
            if (currentSnapTarget) {
                // We were snapped, but now we're not. Detach and restore the old connection if one exists.
                onDetach(selectedElement.id, restorableConnection, true);
                currentSnapTarget = null;
                restorableConnection = null; // The connection has been restored, so clear it.
            }
            
            // Make the block follow the mouse.
            dragGroup.forEach(item => {
                const newPos = { x: mouseDrivenPos.x + item.relativeOffset.x, y: mouseDrivenPos.y + item.relativeOffset.y };
                item.el.setAttribute('x', newPos.x);
                item.el.setAttribute('y', newPos.y);
            });
        }
        
        updateActiveVisualizers(mouseDrivenPos);
    }

    function endDrag() {
        if (!isDragging) return;

        if (!currentSnapTarget && selectedElement) {
            const finalTransform = { x: selectedElement.x.baseVal.value, y: selectedElement.y.baseVal.value };
            onSnap(selectedElement.id, finalTransform, null);
        }

        removeSnapVisualizers();

        if (selectedElement) {
            selectedElement.classList.remove('active');
        }

        isDragging = false;
        selectedElement = null;
        dragGroup = [];
        currentSnapTarget = null;
        restorableConnection = null;

        window.removeEventListener('mousemove', drag);
        window.removeEventListener('mouseup', endDrag);
        window.removeEventListener('touchmove', drag);
        window.removeEventListener('touchend', endDrag);
        window.removeEventListener('blur', endDrag);
    }

    // --- Utility and Visualizer Functions ---

    function checkForSnap(draggedBlockId, currentPos, dragGroupIds) {
        const effectiveSnapRadius = SNAP_RADIUS / main.APP_SCALE;
        const draggedBlockData = allBlocks[draggedBlockId];
        
        if (!draggedBlockData || !draggedBlockData.snapPoints) return null;

        const draggedFemalePoint = draggedBlockData.snapPoints.find(p => p.role === 'female');
        if (!draggedFemalePoint) return null;

        let closestSnap = { distance: Infinity };

        for (const staticBlockId in allBlocks) {
            if (dragGroupIds.includes(staticBlockId)) continue;

            const staticBlockData = allBlocks[staticBlockId];
            if (!staticBlockData.snapPoints || !staticBlockData.transform) continue;

            for (const staticMalePoint of staticBlockData.snapPoints.filter(p => p.role === 'male')) {
                if (draggedFemalePoint.type !== staticMalePoint.type) continue;

                const targetX = staticBlockData.transform.x + (staticMalePoint.x * main.APP_SCALE) - (draggedFemalePoint.x * main.APP_SCALE);
                const targetY = staticBlockData.transform.y + (staticMalePoint.y * main.APP_SCALE) - (draggedFemalePoint.y * main.APP_SCALE);
                const distance = Math.sqrt(Math.pow(currentPos.x - targetX, 2) + Math.pow(currentPos.y - targetY, 2));

                if (distance < effectiveSnapRadius && distance < closestSnap.distance) {
                    const isOccupied = staticBlockData.children && staticBlockData.children[staticMalePoint.name];
                    closestSnap = {
                        distance,
                        position: { x: targetX, y: targetY },
                        snapType: isOccupied ? 'insertion' : 'append',
                        parentId: staticBlockId,
                        parentSnapPoint: staticMalePoint,
                        ...(isOccupied && { originalChildId: staticBlockData.children[staticMalePoint.name] })
                    };
                }
            }
        }
        return closestSnap.distance === Infinity ? null : closestSnap;
    }

    function createSnapVisualizers() {
        if (snapPointVisualizerGroup) removeSnapVisualizers();
        snapPointVisualizerGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        snapPointVisualizerGroup.setAttribute('id', 'snap-visualizers');
        snapPointVisualizerGroup.style.pointerEvents = 'none';
        svgContainer.appendChild(snapPointVisualizerGroup);
        const circleRadius = 5 / main.APP_SCALE;
        const dragGroupIds = dragGroup.map(item => item.id);

        for (const blockId in allBlocks) {
            if (dragGroupIds.includes(blockId)) continue;
            const blockData = allBlocks[blockId];
            if (!blockData.snapPoints || !blockData.transform) continue;
            blockData.snapPoints.forEach((point) => {
                const cx = blockData.transform.x + (point.x * main.APP_SCALE);
                const cy = blockData.transform.y + (point.y * main.APP_SCALE);
                if (point.role === 'male') {
                    const isOccupied = blockData.children && blockData.children[point.name];
                    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    circle.setAttribute('cx', cx);
                    circle.setAttribute('cy', cy);
                    circle.setAttribute('r', isOccupied ? circleRadius * 1.2 : circleRadius);
                    circle.setAttribute('fill', isOccupied ? 'rgba(0, 255, 0, 0.6)' : 'rgba(255, 255, 0, 0.8)');
                    snapPointVisualizerGroup.appendChild(circle);
                }
            });
        }
        const draggedBlockData = allBlocks[selectedElement.id];
        if (draggedBlockData && draggedBlockData.snapPoints) {
            draggedBlockData.snapPoints.forEach(point => {
                if (point.role === 'female') {
                    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    circle.setAttribute('r', circleRadius);
                    circle.setAttribute('fill', 'rgba(255, 100, 100, 0.8)');
                    circle.dataset.blockId = selectedElement.id;
                    snapPointVisualizerGroup.appendChild(circle);
                }
            });
        }
    }

    function updateActiveVisualizers(newBlockPos) {
        if (!snapPointVisualizerGroup || !selectedElement) return;
        const activeCircles = snapPointVisualizerGroup.querySelectorAll(`[data-block-id="${selectedElement.id}"]`);
        const blockData = allBlocks[selectedElement.id];
        if (!blockData || !blockData.snapPoints) return;
        const femalePoints = blockData.snapPoints.filter(p => p.role === 'female');
        activeCircles.forEach((circle, index) => {
            const point = femalePoints[index];
            if (point) {
                circle.setAttribute('cx', newBlockPos.x + (point.x * main.APP_SCALE));
                circle.setAttribute('cy', newBlock_pos.y + (point.y * main.APP_SCALE));
            }
        });
    }

    function removeSnapVisualizers() {
        if (snapPointVisualizerGroup) {
            snapPointVisualizerGroup.remove();
            snapPointVisualizerGroup = null;
        }
    }

    // --- Attach Initial Listeners ---
    svgContainer.addEventListener('mousedown', startDrag);
    svgContainer.addEventListener('touchstart', startDrag, { passive: false });
}