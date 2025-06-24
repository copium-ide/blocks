import * as main from "./main.js";

// Helper function to get a block and all its descendants.
function getDragGroup(blockId, allBlocks) {
    let group = [blockId];
    const block = allBlocks[blockId];
    // **UPDATED**: Iterate over the values of the children object.
    if (block && block.children) {
        for (const childId of Object.values(block.children)) {
            group = group.concat(getDragGroup(childId, allBlocks));
        }
    }
    return group;
}

export function makeDraggable(svgContainer, allBlocks, onDragEnd) {
  const SNAP_RADIUS = 100; // In screen pixels

  let isDragging = false;
  let selectedElement = null; 
  let dragGroup = []; 
  let offset = { x: 0, y: 0 }; 

  let snapPointVisualizerGroup = null;

  function getSVGCoordinates(event) {
    const pt = svgContainer.createSVGPoint();
    if (event.touches && event.touches.length > 0) {
      pt.x = event.touches[0].clientX; pt.y = event.touches[0].clientY;
    } else if (event.changedTouches && event.changedTouches.length > 0) {
      pt.x = event.changedTouches[0].clientX; pt.y = event.changedTouches[0].clientY;
    } else {
      pt.x = event.clientX; pt.y = event.clientY;
    }
    const ctm = svgContainer.getScreenCTM();
    return ctm ? pt.matrixTransform(ctm.inverse()) : { x: 0, y: 0 };
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

      blockData.snapPoints.forEach((point, index) => {
        // **UPDATED**: Only show male points that are NOT already occupied.
        if (point.role === 'male' && (!blockData.children || !blockData.children[point.name])) {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            
            const cx = blockData.transform.x + (point.x * main.APP_SCALE);
            const cy = blockData.transform.y + (point.y * main.APP_SCALE);
            
            circle.setAttribute('cx', cx);
            circle.setAttribute('cy', cy);
            circle.setAttribute('r', circleRadius);
            circle.setAttribute('stroke', 'rgba(0,0,0,0.5)');
            circle.setAttribute('stroke-width', 1 / main.APP_SCALE);
            
            circle.dataset.blockId = blockId;
            circle.dataset.pointIndex = index;
            
            circle.setAttribute('fill', 'rgba(255, 255, 0, 0.8)'); // Available target socket
            snapPointVisualizerGroup.appendChild(circle);
        }
      });
    }
    // Also visualize the active "female" points on the block being dragged
    const draggedBlockData = allBlocks[selectedElement.id];
    if (draggedBlockData && draggedBlockData.snapPoints && !draggedBlockData.parent) {
        draggedBlockData.snapPoints.forEach(point => {
            if (point.role === 'female') {
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('r', circleRadius);
                circle.setAttribute('stroke', 'rgba(0,0,0,0.5)');
                circle.setAttribute('stroke-width', 1 / main.APP_SCALE);
                circle.setAttribute('fill', 'rgba(255, 100, 100, 0.8)');
                circle.dataset.blockId = selectedElement.id; // Mark as part of the active group
                snapPointVisualizerGroup.appendChild(circle);
            }
        });
    }
  }

  function updateActiveVisualizers(newBlockPos) {
    if (!snapPointVisualizerGroup || !selectedElement) return;

    const activeCircles = snapPointVisualizerGroup.querySelectorAll(`[data-block-id="${selectedElement.id}"]`);
    const blockData = allBlocks[selectedElement.id];
    if (!blockData.snapPoints) return;

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

  function checkForSnap(draggedBlockId, currentPos, dragGroupIds) {
    const effectiveSnapRadius = SNAP_RADIUS / main.APP_SCALE;
    const draggedBlockData = allBlocks[draggedBlockId];
    
    // **UPDATED**: Don't allow snapping if the dragged block already has a parent.
    // The user must first detach it by dragging it away.
    if (!draggedBlockData || !draggedBlockData.snapPoints || draggedBlockData.parent) return null;

    const femaleSnapPoints = draggedBlockData.snapPoints.filter(p => p.role === 'female');
    if (femaleSnapPoints.length === 0) return null;

    let closestSnap = { distance: Infinity, position: null, targetId: null, malePoint: null, femalePoint: null };

    for (const blockId in allBlocks) {
      if (dragGroupIds.includes(blockId)) continue;
      const staticBlockData = allBlocks[blockId];
      if (!staticBlockData.snapPoints || !staticBlockData.transform) continue;

      const maleSnapPoints = staticBlockData.snapPoints.filter(p => p.role === 'male');

      for (const femalePoint of femaleSnapPoints) {
        for (const malePoint of maleSnapPoints) {
            // **UPDATED**: Add a check to see if the target male point is already occupied.
            if (staticBlockData.children && staticBlockData.children[malePoint.name]) {
                continue; // This snap point is taken, skip it.
            }

          if (femalePoint.type === malePoint.type) {
            const targetX = staticBlockData.transform.x + (malePoint.x * main.APP_SCALE) - (femalePoint.x * main.APP_SCALE);
            const targetY = staticBlockData.transform.y + (malePoint.y * main.APP_SCALE) - (femalePoint.y * main.APP_SCALE);
            
            const distance = Math.sqrt(Math.pow(currentPos.x - targetX, 2) + Math.pow(currentPos.y - targetY, 2));

            if (distance < effectiveSnapRadius && distance < closestSnap.distance) {
              closestSnap = { 
                distance, 
                position: { x: targetX, y: targetY },
                targetId: blockId,
                malePoint: malePoint,   // **NEW**: Store the specific points
                femalePoint: femalePoint
              };
            }
          }
        }
      }
    }
    return closestSnap.targetId ? closestSnap : null;
  }

  function startDrag(event) {
    if (event.type === 'mousedown' && event.button !== 0) return;

    const target = event.target.closest('svg[blocktype]');
    if (target && svgContainer.contains(target)) {
      isDragging = true;
      selectedElement = target;
      
      const mainBlockStartPos = allBlocks[selectedElement.id]?.transform || { x: 0, y: 0 };
      const dragGroupIds = getDragGroup(selectedElement.id, allBlocks);
      dragGroup = [];
      dragGroupIds.forEach(id => {
          const el = document.getElementById(id);
          const blockData = allBlocks[id];
          if (el && blockData?.transform) {
              svgContainer.appendChild(el);
              dragGroup.push({
                  id: id,
                  el: el,
                  relativeOffset: {
                      x: blockData.transform.x - mainBlockStartPos.x,
                      y: blockData.transform.y - mainBlockStartPos.y
                  }
              });
          }
      });
      
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
  }

  function drag(event) {
    if (!isDragging || !selectedElement) return;
    if (event.cancelable) event.preventDefault();
    
    const coord = getSVGCoordinates(event);
    const mouseDrivenPos = { x: coord.x - offset.x, y: coord.y - offset.y };
    
    const dragGroupIds = dragGroup.map(item => item.id);
    const snapInfo = checkForSnap(selectedElement.id, mouseDrivenPos, dragGroupIds);
    const finalPos = snapInfo ? snapInfo.position : mouseDrivenPos;
    
    dragGroup.forEach(item => {
        const newPos = {
            x: finalPos.x + item.relativeOffset.x,
            y: finalPos.y + item.relativeOffset.y
        };
        item.el.setAttribute('x', newPos.x);
        item.el.setAttribute('y', newPos.y);
    });

    updateActiveVisualizers(finalPos);
  }

  function endDrag() {
    if (!isDragging) return;

    removeSnapVisualizers();

    window.removeEventListener('mousemove', drag);
    window.removeEventListener('mouseup', endDrag);
    window.removeEventListener('touchmove', drag);
    window.removeEventListener('touchend', endDrag);
    window.removeEventListener('blur', endDrag);
    
    if (selectedElement) {
      if (onDragEnd) {
        const finalTransform = {
            x: selectedElement.x.baseVal.value,
            y: selectedElement.y.baseVal.value
        };
        
        const dragGroupIds = dragGroup.map(item => item.id);
        const snapInfo = checkForSnap(selectedElement.id, finalTransform, dragGroupIds);

        // **UPDATED**: Pass the entire snapInfo object back to main.js
        onDragEnd(selectedElement.id, finalTransform, snapInfo);
      }
      selectedElement.classList.remove('active');
    }

    isDragging = false;
    selectedElement = null;
    dragGroup = [];
  }

  svgContainer.addEventListener('mousedown', startDrag);
  svgContainer.addEventListener('touchstart', startDrag, { passive: false });

  return function cleanup() {
    svgContainer.removeEventListener('mousedown', startDrag);
    svgContainer.removeEventListener('touchstart', startDrag);
    removeSnapVisualizers();
  };
}