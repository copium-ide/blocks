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

/**
 * Traverses up the hierarchy from a given block to find the highest-level
 * block that is part of a continuous chain of locked connections.
 * @param {string} blockId The ID of the block to start from.
 * @param {object} allBlocks The map of all blocks in the workspace.
 * @returns {string} The ID of the "root" block for the drag operation.
 */
function findDragRoot(blockId, allBlocks) {
    const block = allBlocks[blockId];
    // If there's no parent, this block is the root.
    if (!block || !block.parent) {
        return blockId;
    }

    const parentBlock = allBlocks[block.parent];
    if (!parentBlock || !parentBlock.children) {
        // Data inconsistency, treat this block as the root.
        return blockId;
    }

    // Find the connection object in the parent's children to check its locked status.
    let isLocked = false;
    for (const connection of Object.values(parentBlock.children)) {
        if (connection.id === blockId) {
            isLocked = connection.locked;
            break;
        }
    }

    // If the connection to the parent is locked, recurse up to find the parent's root.
    // Otherwise, this block is the root of the drag.
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

        // Always select the block that was actually clicked.
        if (onSelect) {
            onSelect(clickedElement.id);
        }

        // --- NEW LOGIC: Determine the true root of the drag ---
        // If a locked block is clicked, we drag its parent instead.
        const dragRootId = findDragRoot(clickedElement.id, allBlocks);
        const dragRootElement = document.getElementById(dragRootId);
        if (!dragRootElement) return;
        // --- END NEW LOGIC ---

        isDragging = true;
        // The `selectedElement` is the root of the drag operation.
        selectedElement = dragRootElement; 
        
        restorableConnection = null;
        currentSnapTarget = null;

        const blockData = allBlocks[selectedElement.id];
        // Detach the entire group (starting from the root) if it has a parent.
        if (blockData && blockData.parent) {
            onDetach(selectedElement.id, null, true);
        }

        const mainBlockStartPos = blockData.transform || { x: 0, y: 0 };
        // The drag group is calculated from the root.
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
                        locked: originalConnection.locked // Preserve locked state
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
            if (!blockData.snapPoints || !blockData.transform) continue;
            blockData.snapPoints.forEach((point) => {
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

    /**
     * This is the fixed function.
     * It updates the position of the red visualizers attached to the block being dragged.
     */
    function updateActiveVisualizers(newBlockPos) {
        if (!snapPointVisualizerGroup || !selectedElement) return;

        const activeCircles = snapPointVisualizerGroup.querySelectorAll(`[data-block-id="${selectedElement.id}"]`);
        const blockData = allBlocks[selectedElement.id];
        if (!blockData || !blockData.snapPoints) return;

        // Get the female points from the block's data. This is our source of truth.
        const femalePoints = blockData.snapPoints.filter(p => p.role === 'female');
        
        // FIX: Iterate over the data (femalePoints) instead of the DOM collection (activeCircles).
        // This ensures that we are mapping the correct data point to the correct visualizer circle,
        // assuming their creation order was consistent, which it is. This is more robust against
        // potential DOM/data mismatches.
        femalePoints.forEach((point, index) => {
            const circle = activeCircles[index];
            // Make sure a corresponding circle exists before trying to update it.
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