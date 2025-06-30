let video, canvas, ctx, handCursor;

let detector;
let hoverTimeout = null;
let lastHoveredElement = null;

// Smoothing variables
let smoothedHandX = 0;
let smoothedHandY = 0;
const smoothingFactor = 0.85; // Higher value = more smoothing, but more lag.

async function initHandTracking() {
    const loader = document.getElementById('text-loader');
    if (loader) {
        loader.style.display = 'block';
    }

    video = document.getElementById('video');
    canvas = document.getElementById('output');
    handCursor = document.getElementById('hand-cursor');

    if (!video || !canvas || !handCursor) {
        console.error("Hand tracking HTML elements not found. Make sure you have a <video id='video'>, <canvas id='output'>, and <div id='hand-cursor'> in your body.");
        if (loader) loader.style.display = 'none';
        return;
    }

    ctx = canvas.getContext('2d');

    // Make cursor visible from the start
    handCursor.style.display = 'block';

    try {
        resizeCanvas();
        await setupCamera();
        await loadModel();
        console.log("Hand tracking initialized");
        detect(); // Start detection loop
    } catch (error) {
        console.error("Initialization failed:", error);
    } finally {
        if (loader) {
            loader.style.display = 'none';
        }
    }
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);

async function setupCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: 1280, height: 720 },
            audio: false
        });
        video.srcObject = stream;
        video.play();
        return new Promise(resolve => {
            video.onloadedmetadata = () => resolve(video);
        });
    } catch (err) {
        console.error("Error accessing webcam:", err);
        alert("Could not access webcam. Please ensure it is enabled and permissions are granted.");
    }
}

async function loadModel() {
    try {
        detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
            modelType: poseDetection.movenet.modelType.MULTIPOSE_LIGHTNING
        });
    } catch (err) {
        console.error("Error loading model:", err);
        // Re-throw the error to be caught by the initHandTracking function
        throw err;
    }
}

function getBoundingBox(keypoints) {
    const valid = keypoints.filter(kp => kp.score > 0.3);
    if (valid.length === 0) return null;
    const xs = valid.map(kp => kp.x);
    const ys = valid.map(kp => kp.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        area: (maxX - minX) * (maxY - minY)
    };
}

function drawBox(bbox, scale, color = "lime") {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(bbox.x * scale.x, bbox.y * scale.y, bbox.width * scale.x, bbox.height * scale.y);
}

function handleDwell(element) {
    if (element && element !== lastHoveredElement) {
        if (lastHoveredElement) {
            lastHoveredElement.classList.remove('hand-hover');
            clearTimeout(hoverTimeout);
        }
        lastHoveredElement = element;
        element.classList.add('hand-hover');
        hoverTimeout = setTimeout(() => {
            console.log('Dwell-clicking:', element);
            // Always trigger a click. This allows page-specific event listeners to handle navigation.
            element.click();
            lastHoveredElement = null;
        }, 1000);
    }
}

function clearDwell() {
    if (lastHoveredElement) {
        lastHoveredElement.classList.remove('hand-hover');
        lastHoveredElement = null;
    }
    clearTimeout(hoverTimeout);
}

async function detect() {
    if (!detector || !video.srcObject) {
        requestAnimationFrame(detect);
        return;
    }

    const poses = await detector.estimatePoses(video);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const scale = {
        x: canvas.width / video.videoWidth,
        y: canvas.height / video.videoHeight
    };

    if (poses.length > 0) {
        let withBBoxes = poses.map(pose => ({
            pose,
            bbox: getBoundingBox(pose.keypoints)
        })).filter(p => p.bbox);

        if (withBBoxes.length > 0) {
            let closest = withBBoxes.reduce((max, curr) =>
                curr.bbox.area > max.bbox.area ? curr : max, withBBoxes[0]);

            drawBox(closest.bbox, scale);

            const right = closest.pose.keypoints.find(kp => kp.name === 'right_wrist');

            if (right && right.score > 0.3) {
                // Correct the X coordinate for the mirrored video
                const handXOnCanvas = right.x * scale.x;
                const handYOnCanvas = right.y * scale.y;

                // Apply smoothing
                smoothedHandX = smoothingFactor * smoothedHandX + (1 - smoothingFactor) * handXOnCanvas;
                smoothedHandY = smoothingFactor * smoothedHandY + (1 - smoothingFactor) * handYOnCanvas;


                handCursor.style.left = `${smoothedHandX}px`;
                handCursor.style.top = `${smoothedHandY}px`;

                window.handX = smoothedHandX;

                // Use closest() to find the button, making hover detection more stable
                let elementUnderCursor = document.elementFromPoint(smoothedHandX, smoothedHandY);
                const targetElement = elementUnderCursor ? elementUnderCursor.closest('.start-button') : null;

                if (targetElement) {
                    handleDwell(targetElement);
                } else {
                    clearDwell();
                }

            } else {
                // If hand is not detected, clear the dwell state but don't hide the cursor
                clearDwell();
            }
        } else {
             // If no poses with bounding boxes are found, clear the dwell state
             clearDwell();
        }
    } else {
        // If no poses are detected, clear the dwell state
        clearDwell();
    }

    requestAnimationFrame(detect);
}

function initializeHandTracking() {
    // Create and append the hand tracking elements to the DOM
    const container = document.createElement('div');
    container.id = 'hand-tracking-container';

    video = document.createElement('video');
    video.id = 'webcam';
    video.playsInline = true;
    video.muted = true;

    canvas = document.createElement('canvas');
    canvas.id = 'output';

    container.appendChild(video);
    container.appendChild(canvas);

    handCursor = document.createElement('div');
    handCursor.id = 'hand-cursor';

    document.body.appendChild(container);
    document.body.appendChild(handCursor);

    ctx = canvas.getContext('2d');
}

async function main() {
    initializeHandTracking();
    resizeCanvas();
    await setupCamera();
    await loadModel();
    detect();
}

main();
