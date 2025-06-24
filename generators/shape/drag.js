import * as main from "./main.js";

export function makeDraggable(svgContainer, allBlocks, onPositionUpdate) {
  const SNAP_RADIUS = 20; // In screen pixels

  let isDragging = false;
  let selectedElement = null;
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

    for (const blockId in allBlocks) {
      const blockData = allBlocks[blockId];
      if (!blockData.snapPoints || !blockData.transform) continue;

      blockData.snapPoints.forEach((point, index) => {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        
        // **UPDATED**: Multiply the local snap point offset by APP_SCALE to get its true world offset.
        const cx = blockData.transform.x + (point.x * main.APP_SCALE);
        const cy = blockData.transform.y + (point.y * main.APP_SCALE);
        
        circle.setAttribute('cx', cx);
        circle.setAttribute('cy', cy);
        circle.setAttribute('r', circleRadius);
        circle.setAttribute('stroke', 'rgba(0,0,0,0.5)');
        circle.setAttribute('stroke-width', 1 / main.APP_SCALE);
        
        circle.dataset.blockId = blockId;
        circle.dataset.pointIndex = index;

        const isSelectedBlock = blockId === selectedElement.id;
        if (point.role === 'male' && isSelectedBlock) {
          circle.setAttribute('fill', 'rgba(255, 100, 100, 0.7)');
        } else if (point.role === 'female') {
          circle.setAttribute('fill', 'rgba(255, 255, 0, 0.7)');
        } else {
          circle.setAttribute('fill', 'rgba(100, 100, 255, 0.5)');
        }

        snapPointVisualizerGroup.appendChild(circle);
      });
    }
  }

  function updateActiveVisualizers(newBlockPos) {
    if (!snapPointVisualizerGroup || !selectedElement) return;

    const activeCircles = snapPointVisualizerGroup.querySelectorAll(`[data-block-id="${selectedElement.id}"]`);
    const blockData = allBlocks[selectedElement.id];

    activeCircles.forEach(circle => {
      const pointIndex = parseInt(circle.dataset.pointIndex, 10);
      const point = blockData.snapPoints[pointIndex];
      if (point) {
        // **UPDATED**: Also multiply here when updating the dragged block's visualizers.
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

  function checkForSnap(draggedBlockId, currentPos) {
    // This calculation remains the same: we convert a screen-space radius to a world-space radius.
    const effectiveSnapRadius = SNAP_RADIUS / main.APP_SCALE;

    const draggedBlockData = allBlocks[draggedBlockId];
    if (!draggedBlockData || !draggedBlockData.snapPoints) return null;

    const maleSnapPoints = draggedBlockData.snapPoints.filter(p => p.role === 'male');
    if (maleSnapPoints.length === 0) return null;

    let closestSnap = { distance: Infinity, position: null };

    for (const blockId in allBlocks) {
      if (blockId === draggedBlockId) continue;
      const staticBlockData = allBlocks[blockId];
      if (!staticBlockData.snapPoints || !staticBlockData.transform) continue;

      const femaleSnapPoints = staticBlockData.snapPoints.filter(p => p.role === 'female');
      for (const malePoint of maleSnapPoints) {
        for (const femalePoint of femaleSnapPoints) {
          if (malePoint.type === femalePoint.type) {
            // **UPDATED**: Calculate the target position by scaling the local snap point offsets.
            const targetX = staticBlockData.transform.x + (femalePoint.x * main.APP_SCALE) - (malePoint.x * main.APP_SCALE);
            const targetY = staticBlockData.transform.y + (femalePoint.y * main.APP_SCALE) - (malePoint.y * main.APP_SCALE);
            
            const distance = Math.sqrt(Math.pow(currentPos.x - targetX, 2) + Math.pow(currentPos.y - targetY, 2));

            if (distance < effectiveSnapRadius && distance < closestSnap.distance) {
              closestSnap = { distance, position: { x: targetX, y: targetY } };
            }
          }
        }
      }
    }
    return closestSnap.position;
  }

  function startDrag(event) {
    if (event.type === 'mousedown' && event.button !== 0) return;

    const target = event.target.closest('svg[blocktype]');
    if (target && svgContainer.contains(target)) {
      isDragging = true;
      selectedElement = target;
      selectedElement.classList.add('active');
      
      svgContainer.appendChild(selectedElement);

      const startPoint = getSVGCoordinates(event);
      const currentPos = allBlocks[selectedElement.id]?.transform || { x: 0, y: 0 };
      
      offset.x = startPoint.x - currentPos.x;
      offset.y = startPoint.y - currentPos.y;

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
    const snappedPos = checkForSnap(selectedElement.id, mouseDrivenPos);
    const finalPos = snappedPos || mouseDrivenPos;
    
    selectedElement.setAttribute('x', finalPos.x);
    selectedElement.setAttribute('y', finalPos.y);

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
      if (onPositionUpdate) {
        const finalTransform = {
            x: selectedElement.x.baseVal.value,
            y: selectedElement.y.baseVal.value
        };
        onPositionUpdate(selectedElement.id, finalTransform);
      }
      selectedElement.classList.remove('active');
    }

    isDragging = false;
    selectedElement = null;
  }

  svgContainer.addEventListener('mousedown', startDrag);
  svgContainer.addEventListener('touchstart', startDrag, { passive: false });

  return function cleanup() {
    svgContainer.removeEventListener('mousedown', startDrag);
    svgContainer.removeEventListener('touchstart', startDrag);
    removeSnapVisualizers();
  };
}