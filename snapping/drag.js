export function makeDraggable(svgElement) {
  let isDragging = false;
  let selectedElement = null;
  let offset = { x: 0, y: 0 }; // Store offset relative to SVG coords

  // Helper function to get mouse/touch coordinates in SVG space
  function getSVGCoordinates(event) {
    const pt = svgElement.createSVGPoint();
    // Handle touch events
    if (event.touches && event.touches.length > 0) {
      pt.x = event.touches[0].clientX;
      pt.y = event.touches[0].clientY;
    } else if (event.changedTouches && event.changedTouches.length > 0) { // For touchend
      pt.x = event.changedTouches[0].clientX;
      pt.y = event.changedTouches[0].clientY;
    } else { // Mouse events
      pt.x = event.clientX;
      pt.y = event.clientY;
    }

    // The cursor point, translated into svg coordinates
    const ctm = svgElement.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 }; // Should not happen in a normal flow
    const svgP = pt.matrixTransform(ctm.inverse());
    return { x: svgP.x, y: svgP.y };
  }

  // Helper function to get current translation from CSS transform style
  function getCurrentTranslation(element) {
    const style = window.getComputedStyle(element);
    const matrix = style.transform || style.webkitTransform || style.mozTransform;

    // No transform property defined or "none"
    if (!matrix || matrix === 'none') {
      return { x: 0, y: 0 };
    }

    // Assuming matrix is in the form "matrix(a, b, c, d, e, f)"
    // For a 2D translation, e is X and f is Y
    const matrixValues = matrix.match(/matrix.*\((.+)\)/);
    if (matrixValues && matrixValues[1]) {
      const parts = matrixValues[1].split(',').map(s => parseFloat(s.trim()));
      // For a 2D transform matrix(a, b, c, d, tx, ty)
      // tx is at index 4, ty is at index 5
      if (parts.length === 6) {
        return { x: parts[4], y: parts[5] };
      }
    }
    // Fallback or if transform is not a simple 2D matrix (e.g., 3D, or other functions)
    // This basic parser won't handle complex transform strings like "translateX(10px) rotate(30deg)"
    // getComputedStyle usually resolves this to a matrix, but good to have a fallback.
    return { x: 0, y: 0 };
  }


  function startDrag(event) {
    // Only react to left mouse button clicks or first touch
    if (event.type === 'mousedown' && event.button !== 0) return;

    const target = event.target;
    const potentialElement = target.closest('path, rect, circle, g'); // Make it more general

    if (potentialElement && svgElement.contains(potentialElement)) { // Ensure it's a child of our SVG
      selectedElement = potentialElement;
      isDragging = true;
      selectedElement.classList.add('active'); // For visual feedback

      const startPoint = getSVGCoordinates(event);
      const currentTranslation = getCurrentTranslation(selectedElement);

      offset.x = startPoint.x - currentTranslation.x;
      offset.y = startPoint.y - currentTranslation.y;

      // Attach move and up listeners to the WINDOW
      window.addEventListener('mousemove', drag);
      window.addEventListener('touchmove', drag, { passive: false }); // passive:false to allow preventDefault
      window.addEventListener('mouseup', endDrag);
      window.addEventListener('touchend', endDrag);
      window.addEventListener('blur', endDrag);

      // Prevent default browser drag behavior (e.g., text selection, image ghosting)
      // and for touch, prevent scrolling
      if (event.cancelable) {
        event.preventDefault();
      }

    } else {
      selectedElement = null;
      isDragging = false;
    }
  }

  function drag(event) {
    if (!isDragging || !selectedElement) {
      return;
    }

    // Prevent default actions during drag (like text selection or page scroll on touch)
    if (event.cancelable) {
        event.preventDefault();
    }

    const coord = getSVGCoordinates(event);
    const newX = coord.x - offset.x;
    const newY = coord.y - offset.y;

    // Apply the new translation using CSS transform
    // Using px units is good practice for CSS transforms, though browsers are often lenient for SVG.
    selectedElement.style.transform = `translate(${newX}px, ${newY}px)`;
  }

  function endDrag(event) {
    if (!isDragging) {
      return;
    }

    window.removeEventListener('mousemove', drag);
    window.removeEventListener('touchmove', drag);
    window.removeEventListener('mouseup', endDrag);
    window.removeEventListener('touchend', endDrag);
    window.removeEventListener('blur', endDrag);

    if (selectedElement) {
      selectedElement.classList.remove('active');
    }

    isDragging = false;
    selectedElement = null;
    offset = { x: 0, y: 0 };
  }

  // --- Initial Setup ---
  svgElement.addEventListener('mousedown', startDrag);
  svgElement.addEventListener('touchstart', startDrag, { passive: false }); // passive:false to allow preventDefault in startDrag

  // Return a cleanup function
  return function cleanup() {
    svgElement.removeEventListener('mousedown', startDrag);
    svgElement.removeEventListener('touchstart', startDrag);

    // Ensure any lingering window listeners are removed (though endDrag should handle this)
    window.removeEventListener('mousemove', drag);
    window.removeEventListener('touchmove', drag);
    window.removeEventListener('mouseup', endDrag);
    window.removeEventListener('touchend', endDrag);
    window.removeEventListener('blur', endDrag);
  };
}

// Example Usage:
// const mySVG = document.getElementById('my-svg-element');
// if (mySVG) {
//   const cleanupDraggable = makeDraggable(mySVG);
//   // To make specific elements draggable, you might need to adjust target.closest('...')
//   // For example, if you only want <g class="draggable"> elements to be draggable:
//   // const potentialElement = target.closest('g.draggable');
//
//   // Later, if you need to disable dragging:
//   // cleanupDraggable();
// }

// Add some basic CSS for the active state (optional)
/*
svg .active {
  cursor: grabbing;
  opacity: 0.8;
  outline: 1px dashed blue; // Example for visual feedback
}
svg path, svg rect, svg circle, svg g { // Apply grab cursor to potential draggable items
  cursor: grab;
}
*/
