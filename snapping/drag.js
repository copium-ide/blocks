export function makeDraggable(svgElement) {
  let isDragging = false;
  let selectedElement = null;
  let offset = { x: 0, y: 0 }; // Store offset relative to SVG coords
  let initialTransform = null; // Store initial transform matrix components

  // Helper function to get mouse coordinates in SVG space
  function getSVGCoordinates(event) {
    const pt = svgElement.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    // The cursor point, translated into svg coordinates
    const svgP = pt.matrixTransform(svgElement.getScreenCTM().inverse());
    return { x: svgP.x, y: svgP.y };
  }

  // Helper function to get current translation from transform attribute
  function getCurrentTranslation(element) {
     // Ensure the element has a transform list to work with
     const transformList = element.transform.baseVal;

     // Initialize transform if it doesn't exist or is empty
     if (transformList.numberOfItems === 0) {
         const initialTranslate = svgElement.createSVGTransform();
         initialTranslate.setTranslate(0, 0);
         transformList.insertItemBefore(initialTranslate, 0);
     }

     // Consolidate transforms to get a single matrix
     const consolidatedTransform = transformList.consolidate();

     // Check if consolidation resulted in a transform
     if (consolidatedTransform) {
         const matrix = consolidatedTransform.matrix;
         return { x: matrix.e, y: matrix.f };
     } else {
         // If no transform after consolidation (shouldn't normally happen after initialization)
         // Fallback to ensure we have a 0,0 starting point
         const initialTranslate = svgElement.createSVGTransform();
         initialTranslate.setTranslate(0, 0);
         transformList.initialize(initialTranslate); // Replace anything there with translate(0,0)
         return { x: 0, y: 0 };
     }
  }


  function startDrag(event) {
    // Only react to left mouse button clicks
    if (event.button !== 0) return;

    const target = event.target;
    // Find the closest path element ancestor
    const potentialElement = target.closest('path');

    if (potentialElement) {
      selectedElement = potentialElement;
      isDragging = true;
      selectedElement.classList.add('active'); // For visual feedback

      // Get mouse position in SVG coordinates
      const startPoint = getSVGCoordinates(event);

      // Get the element's current translation
      const currentTranslation = getCurrentTranslation(selectedElement);

      // Calculate the offset between mouse click and element's translation origin
      offset.x = startPoint.x - currentTranslation.x;
      offset.y = startPoint.y - currentTranslation.y;

      // --- Crucial: Attach move and up listeners to the WINDOW ---
      // This ensures we capture events even if the cursor leaves the SVG
      window.addEventListener('mousemove', drag);
      window.addEventListener('touchmove', drag);
      window.addEventListener('mouseup', endDrag);
      window.addEventListener('touchend', endDrag);
       window.addEventListener('blur', endDrag); // Optional: Stop drag if window loses focus

      // Prevent default browser drag behavior (e.g., text selection, image ghosting)
      event.preventDefault();

    } else {
      // Clicked on SVG background or a non-draggable element
      selectedElement = null;
      isDragging = false;
    }
  }

  function drag(event) {
    if (!isDragging || !selectedElement) {
      return;
    }

    // Prevent default actions during drag (like text selection)
    event.preventDefault();

    // Get current mouse position in SVG coordinates
    const coord = getSVGCoordinates(event);

    // Calculate the new translation coordinates
    const newX = coord.x - offset.x;
    const newY = coord.y - offset.y;

    // Apply the new translation
    // Note: This overwrites other transforms. If you need to preserve rotations/scales,
    // you'd need to manipulate the transform list more carefully.
    // For simple dragging, setTranslate is usually sufficient.
    selectedElement.setAttribute('transform', `translate(${newX}, ${newY})`);
  }

  function endDrag(event) {
     // Only react if dragging was actually active
    if (!isDragging) {
       return;
    }

    // --- Crucial: Remove listeners from the WINDOW ---
    window.removeEventListener('mousemove', drag);
    window.removeEventListener('touchmove', drag);
    window.removeEventListener('mouseup', endDrag);
    window.removeEventListener('touchend', endDrag);
    window.removeEventListener('blur', endDrag);


    if (selectedElement) {
       selectedElement.classList.remove('active');
    }

    // Reset state
    isDragging = false;
    selectedElement = null;
    offset = { x: 0, y: 0 }; // Clear offset
  }

  // --- Initial Setup ---
  // Only attach mousedown to the SVG element initially
  svgElement.addEventListener('mousedown', startDrag);
  svgElement.addEventListener('touchstart', startDrag);

  

    // You would need corresponding touchmove and touchend handlers
    // calling drag() and endDrag() similarly, attached to window/document
    // during the touch drag sequence. (More complex than shown here)

  // Return a cleanup function if needed
  return function cleanup() {
    svgElement.removeEventListener('mousedown', startDrag);
    // Remove any potentially lingering window listeners (though endDrag should handle this)
    window.removeEventListener('mousemove', drag);
    window.removeEventListener('mouseup', endDrag);
    window.removeEventListener('blur', endDrag);
    // Remove touch listener if added
    // svgElement.removeEventListener('touchstart', ...);
  };
}

// Example Usage:
// const mySVG = document.getElementById('my-svg-element');
// if (mySVG) {
//   const cleanupDraggable = makeDraggable(mySVG);
//   // Later, if you need to disable dragging:
//   // cleanupDraggable();
// }

// Add some basic CSS for the active state (optional)
/*
.active {
  cursor: grabbing;
  opacity: 0.8;
}
path {
  cursor: grab;
}
*/
