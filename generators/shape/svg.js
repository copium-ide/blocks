export function generate(shapeData, svgElement) {
    // Preserve existing transform from the SVG element itself, not a child path
    let existingTransform = svgElement.style.transform || '';

    svgElement.innerHTML = '';

    if (!shapeData || !shapeData.points || !Array.isArray(shapeData.points) || shapeData.points.length < 2) {
        console.error("Invalid shape data: points must be an array with at least 2 points.", shapeData);
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

        // Limit radius to prevent segment overlap
        const limitedRadius = Math.min(cornerRadius, lenPrev / 2, lenNext / 2);

        const normalizedPrev = normalize(vectorPrev);
        const startTangentPoint = addVectors(currentPoint, scaleVector(normalizedPrev, -limitedRadius));

        const command = (i === 0) ? 'M' : 'L';
        d += `${command} ${startTangentPoint.x},${startTangentPoint.y} `;

        if (limitedRadius > 0) {
            const normalizedNext = normalize(vectorNext);
            const endTangentPoint = addVectors(currentPoint, scaleVector(normalizedNext, limitedRadius));

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

    if (shapeData.closePath !== false) {
        d += "Z";
    }

    path.setAttribute('d', d);

    // Apply attributes, but ignore keys that are not valid SVG attributes.
    if (shapeData.strokeWidth !== undefined) {
        path.setAttribute('stroke-width', shapeData.strokeWidth);
    }
    for (const key in shapeData) {
        // ADDED 'snapPoints' to this list
        const handledKeys = ['points', 'strokeWidth', 'closePath', 'snapPoints'];
        if (shapeData.hasOwnProperty(key) && !handledKeys.includes(key)) {
            path.setAttribute(key, shapeData[key]);
        }
    }
    
    svgElement.appendChild(path);
    svgElement.style.transform = existingTransform; // Restore transform to the parent SVG

    // Re-frame the SVG's viewBox based on the new path's BBox
    const bBox = path.getBBox();
    const padding = shapeData.strokeWidth ? Number(shapeData.strokeWidth) : 2; 

    const viewBoxX = bBox.x - padding;
    const viewBoxY = bBox.y - padding;
    const viewBoxWidth = bBox.width + (padding * 2);
    const viewBoxHeight = bBox.height + (padding * 2);

    svgElement.setAttribute('viewBox', `${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`);
    
    // Set a reasonable default size for the SVG element in the DOM.
    // This can be overridden by CSS.
    const zoom = 10;
    svgElement.style.width = `${viewBoxWidth * zoom}px`;
    svgElement.style.height = `${viewBoxHeight * zoom}px`;
}