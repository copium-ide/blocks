/**
 * Makes SVG elements draggable with snapping functionality.
 * This should be initialized on a single parent SVG that contains all draggable blocks.
 *
 * @param {SVGElement} svgContainer The main SVG container element where blocks are rendered.
 * @param {object} allBlocks A reference to the object containing all block data, including their snap points and current transforms.
 * @param {function} onPositionUpdate A callback function `(uuid, newTransform)` to be called when a block is moved.
 * @returns {function} A cleanup function to remove all event listeners.
 */
export function makeDraggable(svgContainer, allBlocks, onPositionUpdate) {
  const SNAP_RADIUS = 20; // The distance in SVG units to trigger a snap.

  let isDragging = false;
  let selectedElement = null; // The <svg> element of the block being dragged
  let offset = { x: 0, y: 0 }; // Offset between click and element's transform origin
  let lastSnap = null; // Store information about the last successful snap

  /**
   * Converts mouse or touch event coordinates to the container SVG's coordinate system.
   */
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
    if (!ctm) {
      console.error("SVG getScreenCTM is not available.");
      return { x: 0, y: 0 };
    }

    return pt.matrixTransform(ctm.inverse());
  }
  
  /**
   * Gets the current X and Y translation from an element's CSS transform style.
   */
  function getCurrentTranslation(element) {
    const style = window.getComputedStyle(element);
    const matrix = style.transform || style.webkitTransform || style.mozTransform;

    if (matrix === 'none' || !matrix) {
      return { x: 0, y: 0 };
    }

    const matrixValues = matrix.match(/matrix.*\((.+)\)/);
    if (matrixValues && matrixValues[1]) {
      const parts = matrixValues[1].split(',').map(s => parseFloat(s.trim()));
      if (parts.length === 6) {
        return { x: parts[4], y: parts[5] };
      }
    }
    
    return { x: 0, y: 0 };
  }

  /**
   * Checks for proximity to any valid snap points on other blocks.
   * @param {string} draggedBlockId - The UUID of the block being dragged.
   * @param {{x: number, y: number}} currentPos - The current mouse-driven position of the dragged block.
   * @returns {{x: number, y: number}|null} - The new snapped position, or null if no snap occurred.
   */
  function checkForSnap(draggedBlockId, currentPos) {
    const draggedBlockData = allBlocks[draggedBlockId];
    if (!draggedBlockData || !draggedBlockData.snapPoints) return null;

    // We only check the dragged block's male points against other blocks' female points.
    const maleSnapPoints = draggedBlockData.snapPoints.filter(p => p.role === 'male');
    if (maleSnapPoints.length === 0) return null;

    let closestSnap = { distance: Infinity, position: null };

    // Iterate through all other blocks to find a potential snap target.
    for (const blockId in allBlocks) {
      if (blockId === draggedBlockId) continue; // Don't snap to self

      const staticBlockData = allBlocks[blockId];
      const staticBlockTransform = staticBlockData.transform;
      if (!staticBlockData.snapPoints || !staticBlockTransform) continue;
      
      const femaleSnapPoints = staticBlockData.snapPoints.filter(p => p.role === 'female');

      for (const malePoint of maleSnapPoints) {
        for (const femalePoint of femaleSnapPoints) {
          // Check for compatible types (e.g., 'block' to 'block', 'string' to 'string')
          if (malePoint.type === femalePoint.type) {
            // Calculate the ideal position for the dragged block's origin (0,0)
            // to make the male and female points align perfectly.
            const targetX = staticBlockTransform.x + femalePoint.x - malePoint.x;
            const targetY = staticBlockTransform.y + femalePoint.y - malePoint.y;

            // Calculate distance from the current mouse-driven position to the ideal snap position.
            const distance = Math.sqrt(Math.pow(currentPos.x - targetX, 2) + Math.pow(currentPos.y - targetY, 2));

            if (distance < SNAP_RADIUS && distance < closestSnap.distance) {
              closestSnap = {
                distance,
                position: { x: targetX, y: targetY }
              };
            }
          }
        }
      }
    }
    
    // Return the position of the closest valid snap point, or null if none are in range.
    return closestSnap.position;
  }

  function startDrag(event) {
    if (event.type === 'mousedown' && event.button !== 0) return;

    // Use event delegation: find the draggable block SVG from the click target.
    const target = event.target;
    const potentialElement = target.closest('svg[blocktype]');

    if (potentialElement && svgContainer.contains(potentialElement)) {
      isDragging = true;
      selectedElement = potentialElement;
      selectedElement.classList.add('active');

      const startPoint = getSVGCoordinates(event);
      // Use the centrally-stored transform from `allBlocks` as the source of truth.
      const currentTranslation = allBlocks[selectedElement.id]?.transform || { x: 0, y: 0 };
      
      // Calculate offset so the block doesn't jump to the cursor.
      offset.x = startPoint.x - currentTranslation.x;
      offset.y = startPoint.y - currentTranslation.y;
      
      lastSnap = null; // Clear previous snap on new drag.

      // Global listeners ensure smooth dragging even if the cursor leaves the element.
      window.addEventListener('mousemove', drag);
      window.addEventListener('mouseup', endDrag);
      window.addEventListener('touchmove', drag, { passive: false });
      window.addEventListener('touchend', endDrag);
      window.addEventListener('blur', endDrag); // Stop drag if window loses focus.
      
      if (event.cancelable) event.preventDefault();
    }
  }

  function drag(event) {
    if (!isDragging || !selectedElement) return;
    if (event.cancelable) event.preventDefault();
    
    const coord = getSVGCoordinates(event);
    const mouseDrivenPos = {
      x: coord.x - offset.x,
      y: coord.y - offset.y
    };

    // Check if we should snap, and get the snapped position if so.
    const snappedPos = checkForSnap(selectedElement.id, mouseDrivenPos);
    lastSnap = snappedPos; // Keep track of the snap state for endDrag.

    // Use the snapped position if available, otherwise use the mouse position.
    const finalPos = snappedPos || mouseDrivenPos;
    
    selectedElement.style.transform = `translate(${finalPos.x}px, ${finalPos.y}px)`;
  }

  function endDrag() {
    if (!isDragging) return;

    window.removeEventListener('mousemove', drag);
    window.removeEventListener('mouseup', endDrag);
    window.removeEventListener('touchmove', drag);
    window.removeEventListener('touchend', endDrag);
    window.removeEventListener('blur', endDrag);
    
    if (selectedElement) {
      // If we ended on a snap, update the block's permanent position in the central state.
      if (lastSnap && onPositionUpdate) {
        onPositionUpdate(selectedElement.id, lastSnap);
      } else if (onPositionUpdate) {
        // Even if not snapped, update to its new free-floating position.
        const finalTransform = getCurrentTranslation(selectedElement);
        onPositionUpdate(selectedElement.id, finalTransform);
      }
      selectedElement.classList.remove('active');
    }

    // Reset state for the next drag operation.
    isDragging = false;
    selectedElement = null;
    lastSnap = null;
  }

  // Attach starting listeners to the main SVG container.
  svgContainer.addEventListener('mousedown', startDrag);
  svgContainer.addEventListener('touchstart', startDrag, { passive: false });

  // Return a cleanup function to allow the user to disable dragging later.
  return function cleanup() {
    svgContainer.removeEventListener('mousedown', startDrag);
    svgContainer.removeEventListener('touchstart', startDrag);
    // In case dragging is active when cleanup is called, remove window listeners too.
    window.removeEventListener('mousemove', drag);
    window.removeEventListener('mouseup', endDrag);
    window.removeEventListener('touchmove', drag);
    window.removeEventListener('touchend', endDrag);
    window.removeEventListener('blur', endDrag);
  };
}