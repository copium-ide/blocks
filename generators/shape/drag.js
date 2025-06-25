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

export function makeDraggable(svgContainer, allBlocks, onDragEnd, onDetach) {
    const SNAP_RADIUS = 100;
    // A larger radius to "break" a snap, preventing flickering.
    const UNSNAP_RADIUS = 120; 

    // --- Drag State ---
    let isDragging = false;
    let selectedElement = null;
    let dragGroup = [];
    let offset = { x: 0, y: 0 };

    // --- Snap State ---
    let currentSnapTarget = null;
    let snapPointVisualizerGroup = null;


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

        const blockData = allBlocks[selectedElement.id];
        if (blockData && blockData.parent && onDetach) {
            onDetach(selectedElement.id);
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

        // --- REFACTORED SNAP/UNSNAP LOGIC ---

        // STATE 1: We are currently snapped. Check if we should unsnap.
        if (currentSnapTarget) {
            // Calculate the distance from the mouse to the block's *actual snapped position*.
            const snappedPosition = currentSnapTarget.position;
            const distance = Math.sqrt(Math.pow(mouseDrivenPos.x - snappedPosition.x, 2) + Math.pow(mouseDrivenPos.y - snappedPosition.y, 2));

            // If the mouse has been dragged far enough away, break the snap.
            if (distance > UNSNAP_RADIUS) {
                onDetach(selectedElement.id);
                currentSnapTarget = null; 
                // By setting currentSnapTarget to null, the logic will fall through
                // to the "free-floating" state below in the same frame.
            }
        }

        // STATE 2: We are free-floating. Check if we should snap to something.
        if (!currentSnapTarget) {
            const newSnapInfo = checkForSnap(selectedElement.id, mouseDrivenPos, dragGroupIds);

            if (newSnapInfo) {
                // A new snap has been found. Commit it.
                currentSnapTarget = newSnapInfo;
                // onDragEnd will handle parenting and trigger a full re-render,
                // which correctly places the block and its children.
                onDragEnd(selectedElement.id, newSnapInfo.position, currentSnapTarget);
            } else {
                // No snap found, so just move the block with the mouse.
                // This updates the model's transform directly and moves the SVG element
                // for performance, avoiding a full re-render on every mouse movement.
                const mainBlock = allBlocks[selectedElement.id];
                if (mainBlock) {
                    mainBlock.transform.x = mouseDrivenPos.x;
                    mainBlock.transform.y = mouseDrivenPos.y;
                    
                    dragGroup.forEach(item => {
                        const blockData = allBlocks[item.id];
                        const newX = mainBlock.transform.x + item.relativeOffset.x;
                        const newY = mainBlock.transform.y + item.relativeOffset.y;
                        if (blockData) {
                            blockData.transform.x = newX;
                            blockData.transform.y = newY;
                        }
                        item.el.setAttribute('x', newX);
                        item.el.setAttribute('y', newY);
                    });
                }
            }
        }
        
        // The visualizers should always follow the mouse, not the snapped position.
        updateActiveVisualizers(mouseDrivenPos);
    }

    function endDrag() {
        if (!isDragging) return;

        // The final state (snapped or not) is already set by the `drag` function.
        // We just need to clean up the drag-specific visuals and listeners.
        removeSnapVisualizers();

        if (selectedElement) {
            selectedElement.classList.remove('active');
        }

        isDragging = false;
        selectedElement = null;
        dragGroup = [];
        currentSnapTarget = null;

        window.removeEventListener('mousemove', drag);
        window.removeEventListener('mouseup', endDrag);
        window.removeEventListener('touchmove', drag);
        window.removeEventListener('touchend', endDrag);
        window.removeEventListener('blur', endDrag);
    }

    // --- Utility and Visualizer Functions (Unchanged) ---

    function checkForSnap(draggedBlockId, currentPos, dragGroupIds) {
        // Use the smaller SNAP_RADIUS for initiating a snap
        const effectiveSnapRadius = SNAP_RADIUS / main.APP_SCALE;
        const draggedBlockData = allBlocks[draggedBlockId];
        // This check is now correct: we only check for snaps on un-parented blocks.
        if (!draggedBlockData || !draggedBlockData.snapPoints || draggedBlockData.parent) return null;

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
        if (draggedBlockData && draggedBlockData.snapPoints && !draggedBlockData.parent) {
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
                circle.setAttribute('cy', newBlockPos.y + (point.y * main.APP_SCALE));
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