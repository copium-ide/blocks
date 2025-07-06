export function generate(svgElement, shapeData, text, scale = 1) {
    // --- The static variable to control font size ---
    // MODIFIED: Font size set to 1.5px as requested.
    const FONT_SIZE = '1.5px'; 

    // --- Static variable for left padding of the text ---
    const TEXT_PADDING_X = 0; // Adjust this value for more/less left padding

    // Clear previous content
    svgElement.innerHTML = '';

    if (!shapeData || !shapeData.points || !Array.isArray(shapeData.points) || shapeData.points.length < 2) {
        console.error("Invalid shape data:", shapeData);
        return;
    }

    // --- 1. Generate Path ---
    const path = document.createElementNS("http://www.w3.org/2000/svg", 'path');
    let d = "";
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

    // --- 2. Calculate ViewBox ---
    svgElement.appendChild(path);
    const bBox = path.getBBox();
    svgElement.removeChild(path);

    const padding = shapeData.strokeWidth ? Number(shapeData.strokeWidth) : 2;
    const translateX = -bBox.x + padding;
    const translateY = -bBox.y + padding;
    const viewBoxWidth = bBox.width + (padding * 2);
    const viewBoxHeight = bBox.height + (padding * 2);

    // --- 3. Set Attributes and Position Elements ---
    svgElement.setAttribute('viewBox', `0 0 ${viewBoxWidth} ${viewBoxHeight}`);
    svgElement.setAttribute('width', viewBoxWidth * scale);
    svgElement.setAttribute('height', viewBoxHeight * scale);

    path.setAttribute('transform', `translate(${translateX}, ${translateY})`);
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

    // --- 4. Add Text Element ---
    if (text) {
        const textElement = document.createElementNS("http://www.w3.org/2000/svg", 'text');
        textElement.textContent = text;
        
        // MODIFIED: Set 'x' to the static padding value for left alignment.
        textElement.setAttribute('x', TEXT_PADDING_X);
        textElement.setAttribute('y', viewBoxHeight / 2);
        
        // MODIFIED: Change text-anchor to 'start' for left alignment.
        textElement.setAttribute('text-anchor', 'start'); 
        textElement.setAttribute('dominant-baseline', 'middle');
        
        textElement.setAttribute('fill', 'white');
        textElement.setAttribute('font-family', 'sans-serif');
        
        // Use the static variable defined at the top of the function
        textElement.setAttribute('font-size', FONT_SIZE);
        
        textElement.setAttribute('font-weight', 'bold');
        textElement.style.pointerEvents = 'none';

        textElement.setAttribute('transform', `translate(${translateX}, ${translateY})`);
        
        svgElement.appendChild(textElement);
    }
}