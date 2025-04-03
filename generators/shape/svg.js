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

    const getVector = (p1, p2) => ({ x: p2.x - p1.x, y: p2.y - p1.y });
    const getLength = (v) => Math.sqrt(v.x * v.x + v.y * v.y);
    const normalize = (v) => {
        const len = getLength(v);
        return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
    };
    const scaleVector = (v, scalar) => ({ x: v.x * scalar, y: v.y * scalar });
    const addVectors = (v1, v2) => ({ x: v1.x + v2.x, y: v1.y + v2.y });

    d += `M ${points[0].x},${points[0].y} `;

    for (let i = 0; i < numPoints; i++) {
        const currentPoint = points[i];
        const prevPoint = points[(i - 1 + numPoints) % numPoints];
        const nextPoint = points[(i + 1) % numPoints];
        const cornerRadius = currentPoint.cornerRadius !== undefined ? Math.max(0, currentPoint.cornerRadius) : defaultCornerRadius;

        if (cornerRadius <= 0) {
            if (i > 0) {
                d += `L ${currentPoint.x},${currentPoint.y} `;
            }
        } else {
            const vectorPrev = getVector(prevPoint, currentPoint);
            const vectorNext = getVector(currentPoint, nextPoint);

            const lenPrev = getLength(vectorPrev);
            const lenNext = getLength(vectorNext);

            const normalizedPrev = normalize(vectorPrev);
            const normalizedNext = normalize(vectorNext);

            const limitedRadius = Math.min(cornerRadius, lenPrev / 2, lenNext / 2);

            const startTangentPoint = addVectors(currentPoint, scaleVector(normalizedPrev, -limitedRadius));
            const endTangentPoint = addVectors(currentPoint, scaleVector(normalizedNext, limitedRadius));

            if (i > 0) {
                d += `L ${startTangentPoint.x},${startTangentPoint.y} `;
            } else {
                d = `M ${startTangentPoint.x},${startTangentPoint.y} `;
            }

            // Control points moved to the other side of the tangent
            const controlPoint1 = addVectors(startTangentPoint, scaleVector(normalize(getVector(startTangentPoint, currentPoint)), limitedRadius * bezierControlPointFactor));
            const controlPoint2 = addVectors(endTangentPoint, scaleVector(normalize(getVector(endTangentPoint, currentPoint)), limitedRadius * bezierControlPointFactor));


            d += `C ${controlPoint1.x},${controlPoint1.y} ${controlPoint2.x},${controlPoint2.y} ${endTangentPoint.x},${endTangentPoint.y} `;
        }
    }

    if (shapeData.closePath !== false) {
        d += "Z";
    }

    path.setAttribute('d', d);

    for (const key in shapeData) {
        if (key !== 'points' && shapeData.hasOwnProperty(key)) {
            path.setAttribute(key, shapeData[key]);
        }
    }

    svgElement.appendChild(path);

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pt of points) {
        minX = Math.min(minX, pt.x);
        minY = Math.min(minY, pt.y);
        maxX = Math.max(maxX, pt.x);
        maxY = Math.max(maxY, pt.y);
    }
    svgElement.setAttribute('viewBox', `${minX} ${minY} ${maxX - minX} ${maxY - minY}`);
    svgElement.style.setProperty('width', `${(maxX - minX) * 10}px`);
    svgElement.style.setProperty('height', `${(maxY - minY) * 10}px`);
}