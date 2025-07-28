import * as main from "./main.js";

function getDragGroup(blockId, allBlocks) {
    let group = [blockId];
    const block = allBlocks[blockId];
    if (block && block.children) {
        for (const connection of Object.values(block.children)) {
            group = group.concat(getDragGroup(connection.id, allBlocks));
        }
    }
    return group;
}

function findDragRoot(blockId, allBlocks) {
    const block = allBlocks[blockId];
    if (!block || !block.parent) {
        return blockId;
    }

    const parentBlock = allBlocks[block.parent];
    if (!parentBlock || !parentBlock.children) {
        return blockId;
    }

    let isLocked = false;
    for (const connection of Object.values(parentBlock.children)) {
        if (connection.id === blockId) {
            isLocked = connection.locked;
            break;
        }
    }

    if (isLocked) {
        return findDragRoot(parentBlock.uuid, allBlocks);
    } else {
        return blockId;
    }
}
function getSnapRadius() {
    return 3 * main.getAppScale();
}


export function makeDraggable(svgContainer, allBlocks, onSnap, onDetach, onSelect) {
    // --- Drag State ---
    let isDragging = false;
    let selectedElement = null;
    let dragGroup = [];
    let offset = { x: 0, y: 0 };

    // --- Snap State ---
    let currentSnapTarget = null;
    let snapPointVisualizerGroup = null;
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

        const clickedElement = event.target.closest('svg[blocktype]');
        if (!clickedElement || !svgContainer.contains(clickedElement)) return;

        if (onSelect) {
            onSelect(clickedElement.id);
        }

        const dragRootId = findDragRoot(clickedElement.id, allBlocks);
        const dragRootElement = document.getElementById(dragRootId);
        if (!dragRootElement) return;

        isDragging = true;
        selectedElement = dragRootElement; 
        
        restorableConnection = null;
        currentSnapTarget = null;

        const blockData = allBlocks[selectedElement.id];
        if (blockData && blockData.parent) {
            onDetach(selectedElement.id, null, true);
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
                if (newSnapInfo.snapType === 'insertion') {
                    const parentBlock = allBlocks[newSnapInfo.parentId];
                    const originalConnection = parentBlock.children[newSnapInfo.parentSnapPoint.name];
                    restorableConnection = {
                        childId: originalConnection.id,
                        parentId: newSnapInfo.parentId,
                        snapPointName: newSnapInfo.parentSnapPoint.name,
                        locked: originalConnection.locked
                    };
                }
                onSnap(selectedElement.id, newSnapInfo.position, newSnapInfo);
                currentSnapTarget = newSnapInfo;
            }
        } else {
            if (currentSnapTarget) {
                onDetach(selectedElement.id, restorableConnection, true);
                currentSnapTarget = null;
                restorableConnection = null;
            }
            
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
        const effectiveSnapRadius = getSnapRadius();
        const draggedBlockData = allBlocks[draggedBlockId];
        
        // Directly use the block's snapPoints, which are now guaranteed to be resolved.
        const draggedSnapPoints = draggedBlockData.snapPoints || [];
        if (!draggedSnapPoints.length) return null;

        const draggedFemalePoint = draggedSnapPoints.find(p => p.role === 'female');
        if (!draggedFemalePoint) return null;

        let closestSnap = { distance: Infinity };

        for (const staticBlockId in allBlocks) {
            if (dragGroupIds.includes(staticBlockId)) continue;

            const staticBlockData = allBlocks[staticBlockId];
            if (!staticBlockData.transform) continue;

            const staticSnapPoints = staticBlockData.snapPoints || [];
            
            for (const staticMalePoint of staticSnapPoints.filter(p => p.role === 'male')) {
                if (draggedFemalePoint.type !== staticMalePoint.type) continue;

                const targetX = staticBlockData.transform.x + (staticMalePoint.x * main.getAppScale()) - (draggedFemalePoint.x * main.getAppScale());
                const targetY = staticBlockData.transform.y + (staticMalePoint.y * main.getAppScale()) - (draggedFemalePoint.y * main.getAppScale());
                const distance = Math.sqrt(Math.pow(currentPos.x - targetX, 2) + Math.pow(currentPos.y - targetY, 2));

                if (distance < effectiveSnapRadius && distance < closestSnap.distance) {
                    const isOccupied = staticBlockData.children && staticBlockData.children[staticMalePoint.name];
                    closestSnap = {
                        distance,
                        position: { x: targetX, y: targetY },
                        snapType: isOccupied ? 'insertion' : 'append',
                        parentId: staticBlockId,
                        parentSnapPoint: staticMalePoint,
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
        
        const circleRadius = 0.2 * main.getAppScale();
        const dragGroupIds = dragGroup.map(item => item.id);

        for (const blockId in allBlocks) {
            if (dragGroupIds.includes(blockId)) continue;
            const blockData = allBlocks[blockId];
            if (!blockData.transform) continue;
            
            const resolvedPoints = blockData.snapPoints || [];
            resolvedPoints.forEach((point) => {
                if (point.role === 'male') {
                    const cx = blockData.transform.x + (point.x * main.getAppScale());
                    const cy = blockData.transform.y + (point.y * main.getAppScale());
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
        const resolvedDraggedPoints = draggedBlockData.snapPoints || [];
        resolvedDraggedPoints.forEach(point => {
            if (point.role === 'female') {
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('r', circleRadius);
                circle.setAttribute('fill', 'rgba(255, 100, 100, 0.8)');
                circle.dataset.blockId = selectedElement.id;
                snapPointVisualizerGroup.appendChild(circle);
            }
        });
    }

    function updateActiveVisualizers(newBlockPos) {
        if (!snapPointVisualizerGroup || !selectedElement) return;

        const activeCircles = snapPointVisualizerGroup.querySelectorAll(`[data-block-id="${selectedElement.id}"]`);
        const blockData = allBlocks[selectedElement.id];
        
        const femalePoints = (blockData.snapPoints || []).filter(p => p.role === 'female');
        
        femalePoints.forEach((point, index) => {
            const circle = activeCircles[index];
            if (circle) {
                circle.setAttribute('cx', newBlockPos.x + (point.x * main.getAppScale()));
                circle.setAttribute('cy', newBlockPos.y + (point.y * main.getAppScale()));
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