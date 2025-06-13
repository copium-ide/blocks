/**
 * Makes SVG elements draggable using CSS transforms.
 *
 * @param {SVGElement} svgElement The main SVG container element.
 * @returns {function} A cleanup function to remove all event listeners.
 */
export function makeDraggable(svgElement) {
  let isDragging = false;
  let selectedElement = null;
  let offset = { x: 0, y: 0 }; // Stores offset between click point and element's translation origin

  /**
   * Converts mouse or touch event coordinates to SVG's coordinate system.
   * This is crucial for correctly handling zoom and pan on the SVG.
   */
  function getSVGCoordinates(event) {
    const pt = svgElement.createSVGPoint();

    // Standardize coordinate source based on event type
    if (event.touches && event.touches.length > 0) {
      pt.x = event.touches[0].clientX;
      pt.y = event.touches[0].clientY;
    } else if (event.changedTouches && event.changedTouches.length > 0) { // For touchend
      pt.x = event.changedTouches[0].clientX;
      pt.y = event.changedTouches[0].clientY;
    } else { // For mouse events (mousedown, mousemove, mouseup)
      pt.x = event.clientX;
      pt.y = event.clientY;
    }

    // Get the transformation matrix that maps screen coordinates to SVG coordinates
    const ctm = svgElement.getScreenCTM();
    if (!ctm) {
        // This can happen if the SVG is not in the DOM or is display:none
        console.error("SVG getScreenCTM is not available.");
        return { x: 0, y: 0 };
    }
    
    // Apply the inverse transformation to get the point in SVG space
    const svgP = pt.matrixTransform(ctm.inverse());
    return { x: svgP.x, y: svgP.y };
  }

  /**
   * Gets the current X and Y translation from an element's CSS transform style.
   * Parses the 'matrix(a, b, c, d, tx, ty)' value.
   */
  function getCurrentTranslation(element) {
    const style = window.getComputedStyle(element);
    // Use 'transform' property, with fallbacks for older browsers
    const matrix = style.transform || style.webkitTransform || style.mozTransform;

    // "none" is the default value when no transform is applied
    if (matrix === 'none' || !matrix) {
      return { x: 0, y: 0 };
    }

    // The transform is returned as a matrix: "matrix(a, b, c, d, tx, ty)"
    const matrixValues = matrix.match(/matrix.*\((.+)\)/);
    if (matrixValues && matrixValues[1]) {
      const parts = matrixValues[1].split(',').map(s => parseFloat(s.trim()));
      // tx is the 5th value (index 4), ty is the 6th value (index 5)
      if (parts.length === 6) {
        return { x: parts[4], y: parts[5] };
      }
    }
    
    // Fallback if parsing fails (e.g., for 3D transforms or other complex functions)
    return { x: 0, y: 0 };
  }

  function startDrag(event) {
    // Only drag with the main mouse button (button 0) or a single touch
    if (event.type === 'mousedown' && event.button !== 0) {
      return;
    }

    // Find the target element that should be dragged.
    // Can be a path, rect, circle, or a group <g> element.
    const target = event.target;
    const potentialElement = target.closest('path, rect, circle, g, text');

    // Ensure the found element is a direct child or descendant of our target SVG
    if (potentialElement && svgElement.contains(potentialElement)) {
      isDragging = true;
      selectedElement = potentialElement;
      selectedElement.classList.add('active'); // Add class for visual feedback (e.g., cursor, outline)

      const startPoint = getSVGCoordinates(event);
      const currentTranslation = getCurrentTranslation(selectedElement);
      
      // Calculate the offset from the element's translated origin to the mouse click point.
      // This ensures the element doesn't "jump" to the cursor on drag start.
      offset.x = startPoint.x - currentTranslation.x;
      offset.y = startPoint.y - currentTranslation.y;

      // Attach move and end listeners to the window, not the element.
      // This allows dragging to continue even if the cursor leaves the element's bounds.
      window.addEventListener('mousemove', drag);
      window.addEventListener('mouseup', endDrag);
      window.addEventListener('touchmove', drag, { passive: false }); // passive:false is needed to call preventDefault()
      window.addEventListener('touchend', endDrag);
      window.addEventListener('blur', endDrag); // Stop dragging if the window loses focus
      
      // Prevent default browser behavior (e.g., text selection, image ghosting).
      // On touch devices, this also prevents scrolling.
      if (event.cancelable) {
        event.preventDefault();
      }
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

    // Apply the new position by updating the CSS transform property.
    // This is hardware-accelerated in most browsers and is more performant than
    // changing SVG attributes like 'x', 'y', or the 'transform' attribute.
    selectedElement.style.transform = `translate(${newX}px, ${newY}px)`;
  }

  function endDrag(event) {
    if (!isDragging) {
      return;
    }

    // Clean up all window-level event listeners
    window.removeEventListener('mousemove', drag);
    window.removeEventListener('mouseup', endDrag);
    window.removeEventListener('touchmove', drag);
    window.removeEventListener('touchend', endDrag);
    window.removeEventListener('blur', endDrag);
    
    if (selectedElement) {
      selectedElement.classList.remove('active');
    }

    // Reset state variables
    isDragging = false;
    selectedElement = null;
  }

  // --- Initial Setup ---
  // Attach the starting listeners to the SVG element itself.
  svgElement.addEventListener('mousedown', startDrag);
  svgElement.addEventListener('touchstart', startDrag, { passive: false }); // passive:false to allow preventDefault

  // Return a cleanup function to allow the user to disable dragging later
  return function cleanup() {
    svgElement.removeEventListener('mousedown', startDrag);
    svgElement.removeEventListener('touchstart', startDrag);

    // In case dragging is active when cleanup is called, remove window listeners too.
    window.removeEventListener('mousemove', drag);
    window.removeEventListener('mouseup', endDrag);
    window.removeEventListener('touchmove', drag);
    window.removeEventListener('touchend', endDrag);
    window.removeEventListener('blur', endDrag);
  };
}

// =======================
//      EXAMPLE USAGE
// =======================

/*
// In your HTML:
// <svg id="my-svg-element" viewBox="0 0 400 300">
//   <g id="draggable-group">
//     <rect x="150" y="100" width="100" height="100" fill="royalblue" />
//     <circle cx="200" cy="150" r="20" fill="white" />
//   </g>
//   <rect class="draggable-rect" x="20" y="20" width="80" height="80" fill="crimson" />
// </svg>

// In your CSS:
// svg .active {
//   cursor: grabbing;
//   opacity: 0.8;
//   outline: 2px dashed steelblue;
// }
// svg g, svg .draggable-rect {
//   cursor: grab;
// }


// In your JavaScript:
const mySVG = document.getElementById('my-svg-element');
if (mySVG) {
    // To make specific elements draggable, you can adjust the selector inside startDrag:
    // For example: target.closest('g, .draggable-rect');
    const cleanupDraggable = makeDraggable(mySVG);
  
    // Later, if you need to disable dragging:
    // document.getElementById('stop-button').onclick = () => {
    //   cleanupDraggable();
    //   console.log('Dragging has been disabled.');
    // };
}
*/
