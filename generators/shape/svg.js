export function generate(shapeData, svgElement) {
    // --- EDIT START: Preserve existing transform ---
    let existingTransform = '';
    // Find the current path element within the SVG, if it exists.
    const oldPath = svgElement.querySelector('path');
    if (oldPath) {
        // Store its CSS transform style. This is what makeDraggable modifies.
        existingTransform = oldPath.style.transform;
    }
    // --- EDIT END ---

    // Now, we can safely clear the SVG's content
    svgElement.innerHTML = '';

    if (!shapeData.points || !Array.isArray(shapeData.points) || shapeData.points.length < 2) {
        console.error("Invalid shape data: points must be an array with at least 2 points.");
        return;
    }

    const path = document.createElementNS("http://www.w3.org/2000/svg", 'path');
    let d = "";
    const points = shapeData.points;
    const numPoints = points.length;
    const defaultCornerRadius = 0;
    const bezierControlPointFactor = 0.55; // Approximation for a circular arc

    // Helper functions
    const getVector = (p1, p2) => ({ x: p2.x - p1.x, y: p2.y - p1.y });
    const getLength = (v) => Math.sqrt(v.x * v.x + v.y * v.y);
    const normalize = (v) => {
        const len = getLength(v);
        return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
    };
    const scaleVector = (v, scalar) => ({ x: v.x * scalar, y: v.y * scalar });
    const addVectors = (v1, v2) => ({ x: v1.x + v2.x, y: v1.y + v2.y });

    // --- Path generation logic remains the same ---
    const firstPoint = points[0];
    let initialCornerRadius = firstPoint.cornerRadius !== undefined ? Math.max(0, firstPoint.cornerRadius) : defaultCornerRadius;
    if (initialCornerRadius > 0 && numPoints > 1) {
        const prevPoint = points[points.length - 1];
        const vectorPrev = getVector(prevPoint, firstPoint);
        const lenPrev = getLength(vectorPrev);
        const normalizedPrev = normalize(vectorPrev);
        const limitedRadius = Math.min(initialCornerRadius, lenPrev / 2);
        const startTangentPoint = addVectors(firstPoint, scaleVector(normalizedPrev, -limitedRadius));
        d += `M ${startTangentPoint.x},${startTangentPoint.y} `;
    } else {
        d += `M ${firstPoint.x},${firstPoint.y} `;
    }

    for (let i = 0; i < numPoints; i++) {
        const currentPoint = points[i];
        const prevPoint = points[(i - 1 + numPoints) % numPoints];
        const nextPoint = points[(i + 1) % numPoints];
        const cornerRadius = currentPoint.cornerRadius !== undefined ? Math.max(0, currentPoint.cornerRadius) : defaultCornerRadius;

        if (cornerRadius <= 0) {
            d += `L ${currentPoint.x},${currentPoint.y} `;
        } else {
            const vectorPrev = getVector(prevPoint, currentPoint);
            const vectorNext = getVector(currentPoint, nextPoint);
            const lenPrev = getLength(vectorPrev);
            const lenNext = getLength(vectorNext);
            const limitedRadius = Math.min(cornerRadius, lenPrev / 2, lenNext / 2);
            const startTangentPoint = addVectors(currentPoint, scaleVector(normalizedPrev, -limitedRadius));
            const endTangentPoint = addVectors(currentPoint, scaleVector(normalizedNext, limitedRadius));

            if (i === 0 && d.startsWith('M')) {
                // If first point is rounded, we need to correct the initial M command
                d = `M ${startTangentPoint.x},${startTangentPoint.y} `;
            } else {
                 d += `L ${startTangentPoint.x},${startTangentPoint.y} `;
            }

            const controlPoint1 = addVectors(
                startTangentPoint,
                scaleVector(normalize(getVector(startTangentPoint, currentPoint)), limitedRadius * bezierControlPointFactor)
            );
            const controlPoint2 = addVectors(
                endTangentPoint,
                scaleVector(normalize(getVector(endTangentPoint, currentPoint)), limitedRadius * bezierControlPointFactor)
            );

            d += `C ${controlPoint1.x},${controlPoint1.y} ${controlPoint2.x},${controlPoint2.y} ${endTangentPoint.x},${endTangentPoint.y} `;
        }
    }
    // Closing the path to the correct starting point for rounded corners
    if (shapeData.closePath !== false) {
        d += "Z";
    }
    // --- End of path generation logic ---

    path.setAttribute('d', d);

    if (shapeData.strokeWidth !== undefined) {
        path.setAttribute('stroke-width', shapeData.strokeWidth);
    }
    for (const key in shapeData) {
        // Ensure not to overwrite attributes we've explicitly handled or shouldn't be attributes
        const handledKeys = ['points', 'strokeWidth', 'closePath'];
        if (shapeData.hasOwnProperty(key) && !handledKeys.includes(key)) {
            path.setAttribute(key, shapeData[key]);
        }
    }

    // --- EDIT START: Restore the transform ---
    // Apply the saved transform to the new path. If no transform existed, this will be an empty string.
    path.style.transform = existingTransform;
    // --- EDIT END ---

    svgElement.appendChild(path);

    // --- EDIT START: Use path's BBox and reframe the SVG ---
    // Calculate the bounding box of the newly created path. This is more accurate.
    // Note: getBBox is calculated *before* CSS transforms are applied.
    const bBox = path.getBBox(); 
    const padding = 10; // Add some padding around the shape

    const viewBoxX = bBox.x - padding;
    const viewBoxY = bBox.y - padding;
    const viewBoxWidth = bBox.width + (padding * 2);
    const viewBoxHeight = bBox.height + (padding * 2);

    // This section re-frames the entire SVG to fit the new shape.
    svgElement.setAttribute('viewBox', `${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`);
    
    // This resizes the SVG element itself in the DOM. You may or may not want this behavior.
    const zoom = 1; // Set a zoom factor for the display size
    svgElement.style.width = `${viewBoxWidth * zoom}px`;
    svgElement.style.height = `${viewBoxHeight * zoom}px`;
    svgElement.style.position = 'absolute';
    svgElement.style.overflow = 'visible';
    // --- EDIT END ---
}
