export function makeDraggable(containerElement) {
  let isDragging = false;
  let selectedElement = null;
  // offset: Derived from initial pointer position and initial CSS translation.
  // Helps calculate new translation: new_tx = pointer_x - offset_x
  let offset = { x: 0, y: 0 };

  // Helper function to get current translation from CSS transform style
  function getCurrentCssTranslation(element) {
    const style = window.getComputedStyle(element);
    const matrix = style.transform || style.webkitTransform || style.mozTransform;

    if (!matrix || matrix === 'none') {
      return { x: 0, y: 0 };
    }

    const matrixValues = matrix.match(/matrix.*\((.+)\)/);
    if (matrixValues && matrixValues[1]) {
      const parts = matrixValues[1].split(',').map(s => parseFloat(s.trim()));
      if (parts.length === 6) { // 2D matrix: matrix(scaleX, skewY, skewX, scaleY, translateX, translateY)
        return { x: parts[4], y: parts[5] };
      }
    }
    return { x: 0, y: 0 }; // Fallback
  }

  // Helper to get consistent clientX/clientY from mouse or touch events
  function getPointerCoordinates(event) {
    if (event.touches && event.touches.length > 0) {
      return { x: event.touches[0].clientX, y: event.touches[0].clientY };
    } else if (event.changedTouches && event.changedTouches.length > 0) { // For touchend
      return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
    }
    // Mouse events
    return { x: event.clientX, y: event.clientY };
  }

  function startDrag(event) {
    if (event.type === 'mousedown' && event.button !== 0) return;

    const target = event.target;
    const potentialElement = target.closest('path, rect, circle, ellipse, line, polyline, polygon, text, g, .draggable');

    if (potentialElement && containerElement.contains(potentialElement)) {
      selectedElement = potentialElement;
      isDragging = true;
      selectedElement.classList.add('active');

      const pointerPos = getPointerCoordinates(event);
      // Get the current visual translation of the element. This IS its "last position" if previously dragged.
      const initialCssTranslation = getCurrentCssTranslation(selectedElement);

      // Offset is calculated from the current visual position.
      offset.x = pointerPos.x - initialCssTranslation.x;
      offset.y = pointerPos.y - initialCssTranslation.y;

      window.addEventListener('mousemove', drag);
      window.addEventListener('touchmove', drag, { passive: false });
      window.addEventListener('mouseup', endDrag);
      window.addEventListener('touchend', endDrag);
      window.addEventListener('blur', endDrag);

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

    if (event.cancelable) {
        event.preventDefault();
    }

    const pointerPos = getPointerCoordinates(event);
    const newX = pointerPos.x - offset.x;
    const newY = pointerPos.y - offset.y;

    // This style change persists after the drag ends, "keeping" the last position.
    selectedElement.style.transform = `translate(${newX}px, ${newY}px)`;
  }

  function endDrag() {
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
    // Offset is reset as it's specific to a drag session and current element state
    offset = { x: 0, y: 0 };
  }

  containerElement.addEventListener('mousedown', startDrag);
  containerElement.addEventListener('touchstart', startDrag, { passive: false });

  return function cleanup() {
    containerElement.removeEventListener('mousedown', startDrag);
    containerElement.removeEventListener('touchstart', startDrag);

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
// }

// CSS (optional)
/*
.active {
  cursor: grabbing !important;
  opacity: 0.8;
  outline: 1px dashed blue;
}

svg path, svg rect, svg circle, .draggable { // Example selectors
  cursor: grab;
}
*/
