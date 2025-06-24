import * as main from "./main.js";

export function makeDraggable(svgContainer, allBlocks, onPositionUpdate) {
  const SNAP_RADIUS = 20;

  let isDragging = false;
  let selectedElement = null;
  let offset = { x: 0, y: 0 };

  // A group to hold all the snap point visualization circles.
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

  /**
   * Creates and displays visualization circles for all available snap points.
   * This is called at the beginning of a drag.
   */
  function createSnapVisualizers() {
    if (snapPointVisualizerGroup) {
        removeSnapVisualizers();
    }
    
    // Create a group in the main SVG to hold all the circles
    snapPointVisualizerGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    snapPointVisualizerGroup.setAttribute('id', 'snap-visualizers');
    snapPointVisualizerGroup.style.pointerEvents = 'none'; // Make sure they don't interfere with mouse events
    svgContainer.appendChild(snapPointVisualizerGroup);

    const circleRadius = 5 / main.APP_SCALE; // Keep circle size consistent when zooming

    // Iterate over every block to draw its snap points
    for (const blockId in allBlocks) {
      const blockData = allBlocks[blockId];
      if (!blockData.snapPoints || !blockData.transform) continue;

      blockData.snapPoints.forEach((point, index) => {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        
        // Calculate the absolute position of the snap point
        const cx = blockData.transform.x + point.x;
        const cy = blockData.transform.y + point.y;
        
        circle.setAttribute('cx', cx);
        circle.setAttribute('cy', cy);
        circle.setAttribute('r', circleRadius);
        circle.setAttribute('stroke', 'rgba(0,0,0,0.5)');
        circle.setAttribute('stroke-width', 1 / main.APP_SCALE);
        
        // Store which block and point this circle corresponds to
        circle.dataset.blockId = blockId;
        circle.dataset.pointIndex = index;

        // Color depends on the role (and if it's on the active block)
        const isSelectedBlock = blockId === selectedElement.id;
        if (point.role === 'male' && isSelectedBlock) {
          circle.setAttribute('fill', 'rgba(255, 100, 100, 0.7)'); // Active male point (the "plug")
        } else if (point.role === 'female') {
          circle.setAttribute('fill', 'rgba(255, 255, 0, 0.7)'); // Yellow for female points (the "socket")
        } else {
          circle.setAttribute('fill', 'rgba(100, 100, 255, 0.5)'); // Inactive male point
        }

        snapPointVisualizerGroup.appendChild(circle);
      });
    }
  }

  /**
   * Updates the position of the visualizer circles for the block currently being dragged.
   * @param {{x: number, y: number}} newBlockPos The new top-left position of the dragged block.
   */
  function updateActiveVisualizers(newBlockPos) {
    if (!snapPointVisualizerGroup || !selectedElement) return;

    const activeCircles = snapPointVisualizerGroup.querySelectorAll(`[data-block-id="${selectedElement.id}"]`);
    const blockData = allBlocks[selectedElement.id];

    activeCircles.forEach(circle => {
      const pointIndex = parseInt(circle.dataset.pointIndex, 10);
      const point = blockData.snapPoints[pointIndex];
      if (point) {
        circle.setAttribute('cx', newBlockPos.x + point.x);
        circle.setAttribute('cy', newBlockPos.y + point.y);
      }
    });
  }

  /**
   * Removes all visualization circles from the SVG.
   * This is called at the end of a drag.
   */
  function removeSnapVisualizers() {
    if (snapPointVisualizerGroup) {
      snapPointVisualizerGroup.remove();
      snapPointVisualizerGroup = null;
    }
  }

  function checkForSnap(draggedBlockId, currentPos) {
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
            const targetX = staticBlockData.transform.x + femalePoint.x - malePoint.x;
            const targetY = staticBlockData.transform.y + femalePoint.y - malePoint.y;
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

      // --- VISUALIZATION START ---
      createSnapVisualizers();
      // --- VISUALIZATION END ---

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

    // --- VISUALIZATION START ---
    updateActiveVisualizers(finalPos);
    // --- VISUALIZATION END ---
  }

  function endDrag() {
    if (!isDragging) return;

    // --- VISUALIZATION START ---
    removeSnapVisualizers();
    // --- VISUALIZATION END ---

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

  // Add a cleanup function to remove visualizers if the component is ever destroyed
  return function cleanup() {
    svgContainer.removeEventListener('mousedown', startDrag);
    svgContainer.removeEventListener('touchstart', startDrag);
    removeSnapVisualizers(); // Ensure no artifacts are left
  };
}