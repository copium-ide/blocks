export function generate(shapeData, svgElement) {
    // Preserve existing transform
    let existingTransform = '';
    const oldPath = svgElement.querySelector('path');
    if (oldPath) {
        existingTransform = oldPath.style.transform;
    }

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
    const bezierControlPointFactor = 0.55228; 

    // Helper functions
    const getVector = (p1, p2) => ({ x: p2.x - p1.x, y: p2.y - p1.y });
    const getLength = (v) => Math.sqrt(v.x * v.x + v.y * v.y);
    const normalize = (v) => {
        const len = getLength(v);
        return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
    };
    const scaleVector = (v, scalar) => ({ x: v.x * scalar, y: v.y * scalar });
    const addVectors = (v1, v2) => ({ x: v1.x + v2.x, y: v1.y + v2.y });

    // --- Path Generation Loop ---
    for (let i = 0; i < numPoints; i++) {
        const currentPoint = points[i];
        const prevPoint = points[(i - 1 + numPoints) % numPoints];
        const nextPoint = points[(i + 1) % numPoints];
        
        const cornerRadius = currentPoint.cornerRadius !== undefined ? Math.max(0, currentPoint.cornerRadius) : defaultCornerRadius;

        const vectorPrev = getVector(prevPoint, currentPoint);
        const vectorNext = getVector(currentPoint, nextPoint);
        const lenPrev = getLength(vectorPrev);
        const lenNext = getLength(vectorNext);

        const limitedRadius = Math.min(cornerRadius, lenPrev / 2, lenNext / 2);

        const normalizedPrev = normalize(vectorPrev);
        const startTangentPoint = addVectors(currentPoint, scaleVector(normalizedPrev, -limitedRadius));

        const command = (i === 0) ? 'M' : 'L';
        d += `${command} ${startTangentPoint.x},${startTangentPoint.y} `;

        if (limitedRadius > 0) {
            const normalizedNext = normalize(vectorNext);
            const endTangentPoint = addVectors(currentPoint, scaleVector(normalizedNext, limitedRadius));

            // --- THIS IS THE CORRECTED CONTROL POINT LOGIC ---
            // It correctly calculates the control points relative to the corner vertex.
            const controlPoint1 = addVectors(
                startTangentPoint,
                scaleVector(normalize(getVector(startTangentPoint, currentPoint)), limitedRadius * bezierControlPointFactor)
            );
            const controlPoint2 = addVectors(
                endTangentPoint,
                scaleVector(normalize(getVector(endTangentPoint, currentPoint)), limitedRadius * bezierControlPointFactor)
            );
            // --- END OF CORRECTION ---
            
            d += `C ${controlPoint1.x},${controlPoint1.y} ${controlPoint2.x},${controlPoint2.y} ${endTangentPoint.x},${endTangentPoint.y} `;
        }
    }

    if (shapeData.closePath !== false) {
        d += "Z";
    }

    path.setAttribute('d', d);

    // Apply attributes, restore transform, and append
    if (shapeData.strokeWidth !== undefined) {
        path.setAttribute('stroke-width', shapeData.strokeWidth);
    }
    for (const key in shapeData) {
        const handledKeys = ['points', 'strokeWidth', 'closePath'];
        if (shapeData.hasOwnProperty(key) && !handledKeys.includes(key)) {
            path.setAttribute(key, shapeData[key]);
        }
    }
    path.style.transform = existingTransform;
    svgElement.appendChild(path);

    // Re-frame the SVG based on the new path's BBox
    const bBox = path.getBBox();
    const padding = shapeData.strokeWidth ? Number(shapeData.strokeWidth) : 2; 

    const viewBoxX = bBox.x - padding;
    const viewBoxY = bBox.y - padding;
    const viewBoxWidth = bBox.width + (padding * 2);
    const viewBoxHeight = bBox.height + (padding * 2);

    svgElement.setAttribute('viewBox', `${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`);
    
    const zoom = 10;
    svgElement.style.width = `${viewBoxWidth * zoom}px`;
    svgElement.style.height = `${viewBoxHeight * zoom}px`;
    svgElement.style.position = 'absolute';
    svgElement.style.overflow = 'visible';
}
