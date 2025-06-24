import APP_SCALE from "./main";
export function makeDraggable(svgContainer, allBlocks, onPositionUpdate) {
  const SNAP_RADIUS = 20;

  let isDragging = false;
  let selectedElement = null;
  let offset = { x: 0, y: 0 };

  // getSVGCoordinates is now perfect because the container has a 1:1 unit:pixel mapping.
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
  
  // This function is no longer needed, as we'll use x/y attributes.
  // function getCurrentTranslation(element) { ... }

  function checkForSnap(draggedBlockId, currentPos) {
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

            if (distance < SNAP_RADIUS && distance < closestSnap.distance) {
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

    // Use event delegation to find the draggable block SVG.
    const target = event.target.closest('svg[blocktype]');

    if (target && svgContainer.contains(target)) {
      isDragging = true;
      selectedElement = target;
      selectedElement.classList.add('active');
      
      // Bring element to the "top" of the SVG stack so it renders above others
      svgContainer.appendChild(selectedElement);

      const startPoint = getSVGCoordinates(event);
      // Use the stored transform from `allBlocks` as the source of truth.
      const currentPos = allBlocks[selectedElement.id]?.transform || { x: 0, y: 0 };
      
      offset.x = startPoint.x - currentPos.x;
      offset.y = startPoint.y - currentPos.y;

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
    const mouseDrivenPos = { x: coord.x - offset.x*APP_SCALE, y: coord.y - offset.y*APP_SCALE };

    const snappedPos = checkForSnap(selectedElement.id, mouseDrivenPos);
    const finalPos = snappedPos || mouseDrivenPos;
    
    // Update position using SVG attributes for better performance.
    selectedElement.setAttribute('x', finalPos.x);
    selectedElement.setAttribute('y', finalPos.y);
  }

  function endDrag() {
    if (!isDragging) return;

    window.removeEventListener('mousemove', drag);
    window.removeEventListener('mouseup', endDrag);
    window.removeEventListener('touchmove', drag);
    window.removeEventListener('touchend', endDrag);
    window.removeEventListener('blur', endDrag);
    
    if (selectedElement) {
      if (onPositionUpdate) {
        // Get the final position from the element's attributes.
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

  return function cleanup() { /* ... */ };
}