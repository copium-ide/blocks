export function generate(shapeData, svgElement) {
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
    const bezierControlPointFactor = 0.55;

    // Helper functions
    const getVector = (p1, p2) => ({ x: p2.x - p1.x, y: p2.y - p1.y });
    const getLength = (v) => Math.sqrt(v.x * v.x + v.y * v.y);
    const normalize = (v) => {
        const len = getLength(v);
        return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
    };
    const scaleVector = (v, scalar) => ({ x: v.x * scalar, y: v.y * scalar });
    const addVectors = (v1, v2) => ({ x: v1.x + v2.x, y: v1.y + v2.y });

    // Begin path with the first point (or tangent if rounded)
    const firstPoint = points[0];
    let initialCornerRadius = firstPoint.cornerRadius !== undefined ? Math.max(0, firstPoint.cornerRadius) : defaultCornerRadius;
    if (initialCornerRadius > 0 && numPoints > 1) {
        // Calculate initial tangent point for first point
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

    // Process each point in the shape data
    for (let i = 0; i < numPoints; i++) {
        const currentPoint = points[i];
        const prevPoint = points[(i - 1 + numPoints) % numPoints];
        const nextPoint = points[(i + 1) % numPoints];
        const cornerRadius = currentPoint.cornerRadius !== undefined ? Math.max(0, currentPoint.cornerRadius) : defaultCornerRadius;

        if (cornerRadius <= 0) {
            // No rounded corner, simply draw a line
            if (i > 0) {
                d += `L ${currentPoint.x},${currentPoint.y} `;
            }
        } else {
            // Calculate vectors and tangents for rounded corners
            const vectorPrev = getVector(prevPoint, currentPoint);
            const vectorNext = getVector(currentPoint, nextPoint);

            const lenPrev = getLength(vectorPrev);
            const lenNext = getLength(vectorNext);

            const normalizedPrev = normalize(vectorPrev);
            const normalizedNext = normalize(vectorNext);

            // Limit the corner radius so it doesn't exceed half the length of the adjacent segments
            const limitedRadius = Math.min(cornerRadius, lenPrev / 2, lenNext / 2);

            // Determine start and end tangent points along the segments
            const startTangentPoint = addVectors(currentPoint, scaleVector(normalizedPrev, -limitedRadius));
            const endTangentPoint = addVectors(currentPoint, scaleVector(normalizedNext, limitedRadius));

            if (i > 0) {
                d += `L ${startTangentPoint.x},${startTangentPoint.y} `;
            } else {
                // For the very first point if it’s rounded, move to the start tangent point
                d = `M ${startTangentPoint.x},${startTangentPoint.y} `;
            }

            // Compute control points for the cubic Bezier curve
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

    // Close the path if desired
    if (shapeData.closePath !== false) {
        d += "Z";
    }

    // Set the path's "d" attribute
    path.setAttribute('d', d);

    // Use strokeWidth from shapeData if available
    if (shapeData.strokeWidth !== undefined) {
        path.setAttribute('stroke-width', shapeData.strokeWidth);
    }

    // Apply additional attributes from shapeData to the path element
    for (const key in shapeData) {
        if (key !== 'points' && shapeData.hasOwnProperty(key) && key !== 'strokeWidth') {
            path.setAttribute(key, shapeData[key]);
        }
    }

    svgElement.appendChild(path);

    // Calculate bounding box of the shape points
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pt of points) {
        minX = Math.min(minX, pt.x);
        minY = Math.min(minY, pt.y);
        maxX = Math.max(maxX, pt.x);
        maxY = Math.max(maxY, pt.y);
    }

    // Adjust viewBox and dimensions to account for stroke width if provided
    const strokeWidth = shapeData.strokeWidth !== undefined ? Number(shapeData.strokeWidth) : 0;
    const halfStroke = strokeWidth / 2;
    const viewBoxX = minX - halfStroke;
    const viewBoxY = minY - halfStroke;
    const viewBoxWidth = (maxX - minX) + strokeWidth;
    const viewBoxHeight = (maxY - minY) + strokeWidth;

    svgElement.setAttribute('viewBox', `${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`);
    svgElement.style.setProperty('width', `${viewBoxWidth * 10}px`);
    svgElement.style.setProperty('height', `${viewBoxHeight * 10}px`);
    svgElement.style.setProperty('position', `absolute`);
    svgElement.style.setProperty('overflow', `visible`);
}
