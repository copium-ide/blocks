export function generate(svgElement, shapeData, scale = 1) {
    // We no longer need to preserve the parent's transform, as it's not used.
    svgElement.innerHTML = '';

    if (!shapeData || !shapeData.points || !Array.isArray(shapeData.points) || shapeData.points.length < 2) {
        console.error("Invalid shape data:", shapeData);
        return;
    }

    const path = document.createElementNS("http://www.w3.org/2000/svg", 'path');
    let d = "";
    // ... The entire path generation 'd' string logic is identical ...
    // ... (Your existing code for the 'for' loop to build 'd') ...
    const points = shapeData.points;
    const numPoints = points.length;
    const defaultCornerRadius = 0;
    const bezierControlPointFactor = 0.55228; 
    const getVector = (p1, p2) => ({ x: p2.x - p1.x, y: p2.y - p1.y });
    const getLength = (v) => Math.sqrt(v.x * v.x + v.y * v.y);
    const normalize = (v) => {
        const len = getLength(v);
        return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
    };
    const scaleVector = (v, scalar) => ({ x: v.x * scalar, y: v.y * scalar });
    const addVectors = (v1, v2) => ({ x: v1.x + v2.x, y: v1.y + v2.y });
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
            const controlPoint1 = addVectors(startTangentPoint, scaleVector(normalize(getVector(startTangentPoint, currentPoint)), limitedRadius * bezierControlPointFactor));
            const controlPoint2 = addVectors(endTangentPoint, scaleVector(normalize(getVector(endTangentPoint, currentPoint)), limitedRadius * bezierControlPointFactor));
            d += `C ${controlPoint1.x},${controlPoint1.y} ${controlPoint2.x},${controlPoint2.y} ${endTangentPoint.x},${endTangentPoint.y} `;
        }
    }
    if (shapeData.closePath !== false) { d += "Z"; }
    path.setAttribute('d', d);
    
    // The rest of the logic for stabilizing the viewBox is still correct.
    svgElement.appendChild(path);
    const bBox = path.getBBox();
    svgElement.removeChild(path);

    const padding = shapeData.strokeWidth ? Number(shapeData.strokeWidth) : 2; 
    const translateX = -bBox.x + padding;
    const translateY = -bBox.y + padding;
    const viewBoxWidth = bBox.width + (padding * 2);
    const viewBoxHeight = bBox.height + (padding * 2);

    // This sets the CHILD's internal coordinate system.
    svgElement.setAttribute('viewBox', `0 0 ${viewBoxWidth} ${viewBoxHeight}`);
    
    // This positions the path correctly inside the CHILD's viewBox.
    path.setAttribute('transform', `translate(${translateX}, ${translateY})`);
    
    // Set the CHILD's size in the PARENT's coordinate system (which is pixels).
    // Use attributes, NOT style, for this.
    svgElement.setAttribute('width', viewBoxWidth * scale);
    svgElement.setAttribute('height', viewBoxHeight * scale);
    
    // Apply other path attributes
    if (shapeData.strokeWidth !== undefined) {
        path.setAttribute('stroke-width', shapeData.strokeWidth);
    }
    for (const key in shapeData) {
        const handledKeys = ['points', 'strokeWidth', 'closePath', 'snapPoints'];
        if (shapeData.hasOwnProperty(key) && !handledKeys.includes(key)) {
            path.setAttribute(key, shapeData[key]);
        }
    }
    
    svgElement.appendChild(path);
}