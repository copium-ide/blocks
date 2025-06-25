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

export function makeDraggable(svgContainer, allBlocks, onDragEnd, onDetach, onSnapPreview, onSnapPreviewEnd) {
    const SNAP_RADIUS = 100;

    // --- Drag State ---
    let isDragging = false;
    let selectedElement = null; // The main SVG element being dragged
    let dragGroup = []; // Array of {id, el, relativeOffset} for the whole group
    let offset = { x: 0, y: 0 }; // Mouse offset from the top-left of the main dragged element

    // --- Snap State ---
    let currentSnapTarget = null; // The active snap info object
    let displacedChainInfo = null; // Info about a chain displaced by an 'insertion' preview
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

    // --- Snap Preview Logic ---

    // Called when a block is no longer snapped to a point.
    function handleSnapLeave() {
        if (!currentSnapTarget) return;

        // Notify main app to end the preview (e.g., shrink a loop)
        if (onSnapPreviewEnd) {
            onSnapPreviewEnd(currentSnapTarget);
        }

        // If a chain was visually displaced, revert it to its original position.
        if (displacedChainInfo) {
            const groupToRevert = getDragGroup(displacedChainInfo.id, allBlocks);
            groupToRevert.forEach(blockId => {
                const blockEl = document.getElementById(blockId);
                const originalTransform = allBlocks[blockId].transform;
                if (blockEl) {
                    blockEl.setAttribute('x', originalTransform.x);
                    blockEl.setAttribute('y', originalTransform.y);
                }
            });
        }

        // Clear the state
        currentSnapTarget = null;
        displacedChainInfo = null;
    }

    // MODIFIED: Called when a block enters a new snap radius.
    // This function now assumes it's being called on a clean slate.
    // The responsibility of clearing the previous state is now handled by the `drag` function.
    function handleSnapEnter(newSnapInfo) {
        currentSnapTarget = newSnapInfo;

        // Notify main app to start a preview (e.g., expand a loop).
        // This is called for ALL snap types ('append' and 'insertion').
        if (onSnapPreview) {
            onSnapPreview(newSnapInfo, selectedElement.id);
        }

        // For 'insertion' snaps, also visually displace the existing chain.
        if (newSnapInfo.snapType === 'insertion' && newSnapInfo.originalChildId) {
            const displacedBlock = allBlocks[newSnapInfo.originalChildId];
            const draggedBlock = allBlocks[selectedElement.id];

            if (displacedBlock && draggedBlock) {
                displacedChainInfo = { id: newSnapInfo.originalChildId };
                const draggedBottomPoint = draggedBlock.snapPoints.find(p => p.role === 'male' && p.name === 'bottom');
                const displacedTopPoint = displacedBlock.snapPoints.find(p => p.role === 'female');

                if (draggedBottomPoint && displacedTopPoint) {
                    const snappedDraggedPos = newSnapInfo.position;
                    // Calculate where the displaced block *should* be
                    const newX = snappedDraggedPos.x + (draggedBottomPoint.x * main.APP_SCALE) - (displacedTopPoint.x * main.APP_SCALE);
                    const newY = snappedDraggedPos.y + (draggedBottomPoint.y * main.APP_SCALE) - (displacedTopPoint.y * main.APP_SCALE);
                    
                    const deltaX = newX - displacedBlock.transform.x;
                    const deltaY = newY - displacedBlock.transform.y;

                    // Move the entire displaced chain visually
                    const groupToMove = getDragGroup(newSnapInfo.originalChildId, allBlocks);
                    groupToMove.forEach(blockId => {
                        const blockEl = document.getElementById(blockId);
                        const originalTransform = allBlocks[blockId].transform;
                        if (blockEl) {
                            blockEl.setAttribute('x', originalTransform.x + deltaX);
                            blockEl.setAttribute('y', originalTransform.y + deltaY);
                        }
                    });
                }
            }
        }
    }


    // --- Drag Event Handlers ---

    function startDrag(event) {
        if (event.type === 'mousedown' && event.button !== 0) return;

        const target = event.target.closest('svg[blocktype]');
        if (!target || !svgContainer.contains(target)) return;

        isDragging = true;
        selectedElement = target;

        // Detach from parent in the data model
        const blockData = allBlocks[selectedElement.id];
        if (blockData && blockData.parent && onDetach) {
            onDetach(selectedElement.id);
        }

        // Assemble the group of elements to be dragged
        const mainBlockStartPos = blockData.transform || { x: 0, y: 0 };
        const dragGroupIds = getDragGroup(selectedElement.id, allBlocks);
        dragGroup = dragGroupIds.map(id => {
            const el = document.getElementById(id);
            const currentBlockData = allBlocks[id];
            if (el && currentBlockData?.transform) {
                svgContainer.appendChild(el); // Bring to front
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

        // Calculate initial mouse offset
        const startPoint = getSVGCoordinates(event);
        offset.x = startPoint.x - mainBlockStartPos.x;
        offset.y = startPoint.y - mainBlockStartPos.y;

        createSnapVisualizers();
        
        // Add listeners
        window.addEventListener('mousemove', drag);
        window.addEventListener('mouseup', endDrag);
        window.addEventListener('touchmove', drag, { passive: false });
        window.addEventListener('touchend', endDrag);
        window.addEventListener('blur', endDrag);

        if (event.cancelable) event.preventDefault();
    }

    // MODIFIED: This function's logic is now clearer and more robust.
    // It ensures that snap previews are updated instantly on every relevant mouse move.
    function drag(event) {
        if (!isDragging || !selectedElement) return;
        if (event.cancelable) event.preventDefault();

        const coord = getSVGCoordinates(event);
        const mouseDrivenPos = { x: coord.x - offset.x, y: coord.y - offset.y };
        const dragGroupIds = dragGroup.map(item => item.id);

        // Find the best potential snap for the current position.
        const newSnapInfo = checkForSnap(selectedElement.id, mouseDrivenPos, dragGroupIds);

        // Determine if the snap state is the same as the last frame.
        const isSameSnapTarget = newSnapInfo && currentSnapTarget &&
            newSnapInfo.parentId === currentSnapTarget.parentId &&
            newSnapInfo.parentSnapPoint.name === currentSnapTarget.parentSnapPoint.name;

        // If the snap state has changed, update the visual preview. This robustly
        // handles all transitions: null -> snap, snap -> null, and snapA -> snapB.
        if (!isSameSnapTarget) {
            // First, always clean up any existing preview state.
            handleSnapLeave();
            
            // Then, if there's a new snap point, create the new preview state.
            if (newSnapInfo) {
                handleSnapEnter(newSnapInfo);
            }
        }

        // Position the dragged group based on the up-to-date snap state.
        // `currentSnapTarget` is either null or the new snap info from the logic above.
        const finalPos = currentSnapTarget ? currentSnapTarget.position : mouseDrivenPos;
        dragGroup.forEach(item => {
            const newPos = { x: finalPos.x + item.relativeOffset.x, y: finalPos.y + item.relativeOffset.y };
            item.el.setAttribute('x', newPos.x);
            item.el.setAttribute('y', newPos.y);
        });
        updateActiveVisualizers(finalPos);
    }

    function endDrag() {
        if (!isDragging) return;

        // Finalize the drag in the main application logic using the last known snap state
        if (onDragEnd && selectedElement) {
            const finalTransform = { x: selectedElement.x.baseVal.value, y: selectedElement.y.baseVal.value };
            // Use the state `currentSnapTarget`, don't recalculate.
            onDragEnd(selectedElement.id, finalTransform, currentSnapTarget);
        }

        // Clean up all visual artifacts and state
        handleSnapLeave();
        removeSnapVisualizers();

        if (selectedElement) {
            selectedElement.classList.remove('active');
        }

        // Reset state for the next drag
        isDragging = false;
        selectedElement = null;
        dragGroup = [];

        // Remove listeners
        window.removeEventListener('mousemove', drag);
        window.removeEventListener('mouseup', endDrag);
        window.removeEventListener('touchmove', drag);
        window.removeEventListener('touchend', endDrag);
        window.removeEventListener('blur', endDrag);
    }

    // --- Utility and Visualizer Functions (Unchanged) ---

    function checkForSnap(draggedBlockId, currentPos, dragGroupIds) {
        const effectiveSnapRadius = SNAP_RADIUS / main.APP_SCALE;
        const draggedBlockData = allBlocks[draggedBlockId];
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