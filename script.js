const IMAGE_SIZE = 256;
let imageAData = null;
let imageBData = null;
let targetImageData = null;
let particles = [];
let animationId = null;
let isAnimating = false;
let isRealtimeMode = false;
let realtimeAnimationId = null;

let isDrawing = false;
let lastX = 0;
let lastY = 0;

const imageAInput = document.getElementById('imageA');
const imageBInput = document.getElementById('imageB');
const previewACanvas = document.getElementById('previewA');
const previewBCanvas = document.getElementById('previewB');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');

const drawCanvas = document.getElementById('drawCanvas');
const targetImageInput = document.getElementById('targetImage');
const targetPreviewCanvas = document.getElementById('targetPreview');
const brushSize = document.getElementById('brushSize');
const brushColor = document.getElementById('brushColor');
const brushSizeValue = document.getElementById('brushSizeValue');
const clearDrawBtn = document.getElementById('clearDrawBtn');
const startRealtimeBtn = document.getElementById('startRealtimeBtn');
const stopRealtimeBtn = document.getElementById('stopRealtimeBtn');
const resetDrawBtn = document.getElementById('resetDrawBtn');

const animationCanvas = document.getElementById('animationCanvas');
const statusText = document.getElementById('status');
const uploadModeBtn = document.getElementById('uploadModeBtn');
const drawModeBtn = document.getElementById('drawModeBtn');
const uploadModeSection = document.getElementById('uploadMode');
const drawModeSection = document.getElementById('drawMode');

uploadModeBtn.addEventListener('click', () => switchMode('upload'));
drawModeBtn.addEventListener('click', () => switchMode('draw'));

imageAInput.addEventListener('change', (e) => handleImageUpload(e, 'A'));
imageBInput.addEventListener('change', (e) => handleImageUpload(e, 'B'));
startBtn.addEventListener('click', startAnimation);
resetBtn.addEventListener('click', reset);

targetImageInput.addEventListener('change', handleTargetImageUpload);
brushSize.addEventListener('input', updateBrushSize);
clearDrawBtn.addEventListener('click', clearDrawing);
startRealtimeBtn.addEventListener('click', startRealtimeAnimation);
stopRealtimeBtn.addEventListener('click', stopRealtimeAnimation);
resetDrawBtn.addEventListener('click', resetDrawMode);

drawCanvas.addEventListener('mousedown', startDrawing);
drawCanvas.addEventListener('mousemove', draw);
drawCanvas.addEventListener('mouseup', stopDrawing);
drawCanvas.addEventListener('mouseout', stopDrawing);

drawCanvas.addEventListener('touchstart', handleTouchStart);
drawCanvas.addEventListener('touchmove', handleTouchMove);
drawCanvas.addEventListener('touchend', stopDrawing);

function loadImageToCanvas(file, size) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            const img = new Image();

            img.onload = () => {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = size;
                tempCanvas.height = size;
                const ctx = tempCanvas.getContext('2d');

                ctx.drawImage(img, 0, 0, size, size);

                const imageData = ctx.getImageData(0, 0, size, size);
                resolve(imageData);
            };

            img.onerror = reject;
            img.src = event.target.result;
        };

        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function extractPixels(imageData) {
    const pixels = [];
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = (y * width + x) * 4;
            pixels.push({
                r: data[index],
                g: data[index + 1],
                b: data[index + 2],
                x: x,
                y: y
            });
        }
    }

    return pixels;
}

function computeBrightness(r, g, b) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
}

function mapPixels(sourcePixels, targetPixels) {
    const sourceWithBrightness = sourcePixels.map(p => ({
        ...p,
        brightness: computeBrightness(p.r, p.g, p.b)
    }));

    const targetWithBrightness = targetPixels.map(p => ({
        x: p.x,
        y: p.y,
        brightness: computeBrightness(p.r, p.g, p.b)
    }));

    sourceWithBrightness.sort((a, b) => a.brightness - b.brightness);
    targetWithBrightness.sort((a, b) => a.brightness - b.brightness);

    const mappedParticles = sourceWithBrightness.map((sourcePixel, i) => {
        const targetPosition = targetWithBrightness[i];
        return {
            r: sourcePixel.r,
            g: sourcePixel.g,
            b: sourcePixel.b,
            startX: sourcePixel.x,
            startY: sourcePixel.y,
            x: sourcePixel.x,
            y: sourcePixel.y,
            targetX: targetPosition.x,
            targetY: targetPosition.y
        };
    });

    return mappedParticles;
}

function animate() {
    const duration = 4000;
    const startTime = performance.now();
    const ctx = animationCanvas.getContext('2d');

    function animationLoop(currentTime) {
        if (!isAnimating) return;

        const elapsed = currentTime - startTime;
        let t = Math.min(elapsed / duration, 1);

        t = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

        ctx.clearRect(0, 0, animationCanvas.width, animationCanvas.height);

        particles.forEach(p => {
            p.x = p.startX + (p.targetX - p.startX) * t;
            p.y = p.startY + (p.targetY - p.startY) * t;

            ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
            ctx.fillRect(p.x, p.y, 1, 1);
        });

        const percentComplete = Math.round(t * 100);
        statusText.textContent = `Animating... ${percentComplete}%`;

        if (t < 1) {
            animationId = requestAnimationFrame(animationLoop);
        } else {
            statusText.textContent = 'Animation complete! Click Reset to try again.';
            isAnimating = false;
            startBtn.disabled = true;
        }
    }

    animationId = requestAnimationFrame(animationLoop);
}

async function handleImageUpload(event, imageType) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        statusText.textContent = `Loading Image ${imageType}...`;

        const imageData = await loadImageToCanvas(file, IMAGE_SIZE);

        if (imageType === 'A') {
            imageAData = imageData;
        } else {
            imageBData = imageData;
        }

        const previewCanvas = imageType === 'A' ? previewACanvas : previewBCanvas;
        previewCanvas.width = IMAGE_SIZE;
        previewCanvas.height = IMAGE_SIZE;
        const ctx = previewCanvas.getContext('2d');
        ctx.putImageData(imageData, 0, 0);

        if (imageAData && imageBData) {
            statusText.textContent = 'Both images loaded! Click Start Animation to begin.';
            startBtn.disabled = false;
        } else {
            statusText.textContent = imageType === 'A'
                ? 'Image A loaded. Now upload Image B.'
                : 'Image B loaded. Now upload Image A.';
        }
    } catch (error) {
        console.error('Error loading image:', error);
        statusText.textContent = `Error loading Image ${imageType}. Please try again.`;
    }
}

function startAnimation() {
    if (!imageAData || !imageBData) {
        statusText.textContent = 'Please upload both images first.';
        return;
    }

    if (isAnimating) return;

    statusText.textContent = 'Preparing animation...';
    startBtn.disabled = true;

    animationCanvas.width = IMAGE_SIZE;
    animationCanvas.height = IMAGE_SIZE;

    const pixelsA = extractPixels(imageAData);
    const pixelsB = extractPixels(imageBData);

    particles = mapPixels(pixelsA, pixelsB);

    isAnimating = true;
    statusText.textContent = 'Starting animation...';
    animate();
}

function reset() {
    isAnimating = false;
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    imageAData = null;
    imageBData = null;
    particles = [];

    const canvases = [previewACanvas, previewBCanvas, animationCanvas];
    canvases.forEach(canvas => {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    imageAInput.value = '';
    imageBInput.value = '';

    startBtn.disabled = true;
    statusText.textContent = 'Upload both images to begin';
}

statusText.textContent = 'Upload both images to begin';

initializeDrawCanvas();

function switchMode(mode) {
    stopAllAnimations();

    if (mode === 'upload') {
        uploadModeBtn.classList.add('active');
        drawModeBtn.classList.remove('active');
        uploadModeSection.classList.add('active');
        drawModeSection.classList.remove('active');
        statusText.textContent = 'Upload both images to begin';
    } else {
        drawModeBtn.classList.add('active');
        uploadModeBtn.classList.remove('active');
        drawModeSection.classList.add('active');
        uploadModeSection.classList.remove('active');
        statusText.textContent = 'Draw something and upload a target image';
    }

    const ctx = animationCanvas.getContext('2d');
    ctx.clearRect(0, 0, animationCanvas.width, animationCanvas.height);
}

function stopAllAnimations() {
    isAnimating = false;
    isRealtimeMode = false;

    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    if (realtimeAnimationId) {
        cancelAnimationFrame(realtimeAnimationId);
        realtimeAnimationId = null;
    }
}

function initializeDrawCanvas() {
    drawCanvas.width = IMAGE_SIZE;
    drawCanvas.height = IMAGE_SIZE;
    const ctx = drawCanvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, IMAGE_SIZE, IMAGE_SIZE);
}

function updateBrushSize() {
    brushSizeValue.textContent = `${brushSize.value}px`;
}

function clearDrawing() {
    const ctx = drawCanvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, IMAGE_SIZE, IMAGE_SIZE);

    if (isRealtimeMode) {
        updateRealtimeAnimation();
    }
}

function startDrawing(e) {
    isDrawing = true;
    const rect = drawCanvas.getBoundingClientRect();
    const scaleX = drawCanvas.width / rect.width;
    const scaleY = drawCanvas.height / rect.height;
    lastX = (e.clientX - rect.left) * scaleX;
    lastY = (e.clientY - rect.top) * scaleY;
}

function handleTouchStart(e) {
    e.preventDefault();
    isDrawing = true;
    const rect = drawCanvas.getBoundingClientRect();
    const scaleX = drawCanvas.width / rect.width;
    const scaleY = drawCanvas.height / rect.height;
    const touch = e.touches[0];
    lastX = (touch.clientX - rect.left) * scaleX;
    lastY = (touch.clientY - rect.top) * scaleY;
}

function draw(e) {
    if (!isDrawing) return;

    const rect = drawCanvas.getBoundingClientRect();
    const scaleX = drawCanvas.width / rect.width;
    const scaleY = drawCanvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const ctx = drawCanvas.getContext('2d');
    ctx.strokeStyle = brushColor.value;
    ctx.lineWidth = brushSize.value;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();

    lastX = x;
    lastY = y;

    if (isRealtimeMode) {
        updateRealtimeAnimation();
    }
}

function handleTouchMove(e) {
    if (!isDrawing) return;
    e.preventDefault();

    const rect = drawCanvas.getBoundingClientRect();
    const scaleX = drawCanvas.width / rect.width;
    const scaleY = drawCanvas.height / rect.height;
    const touch = e.touches[0];
    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top) * scaleY;

    const ctx = drawCanvas.getContext('2d');
    ctx.strokeStyle = brushColor.value;
    ctx.lineWidth = brushSize.value;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();

    lastX = x;
    lastY = y;

    if (isRealtimeMode) {
        updateRealtimeAnimation();
    }
}

function stopDrawing() {
    isDrawing = false;
}

async function handleTargetImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        statusText.textContent = 'Loading target image...';

        targetImageData = await loadImageToCanvas(file, IMAGE_SIZE);

        targetPreviewCanvas.width = IMAGE_SIZE;
        targetPreviewCanvas.height = IMAGE_SIZE;
        const ctx = targetPreviewCanvas.getContext('2d');
        ctx.putImageData(targetImageData, 0, 0);

        statusText.textContent = 'Target image loaded! Start drawing and click Start Real-Time Animation.';
        startRealtimeBtn.disabled = false;
    } catch (error) {
        console.error('Error loading target image:', error);
        statusText.textContent = 'Error loading target image. Please try again.';
    }
}

function startRealtimeAnimation() {
    if (!targetImageData) {
        statusText.textContent = 'Please upload a target image first.';
        return;
    }

    isRealtimeMode = true;
    startRealtimeBtn.disabled = true;
    stopRealtimeBtn.disabled = false;
    statusText.textContent = 'Real-time mode active! Draw to see pixels rearrange.';

    animationCanvas.width = IMAGE_SIZE;
    animationCanvas.height = IMAGE_SIZE;

    updateRealtimeAnimation();
}

function stopRealtimeAnimation() {
    isRealtimeMode = false;
    startRealtimeBtn.disabled = false;
    stopRealtimeBtn.disabled = true;
    statusText.textContent = 'Real-time mode stopped.';

    if (realtimeAnimationId) {
        cancelAnimationFrame(realtimeAnimationId);
        realtimeAnimationId = null;
    }
}

function updateRealtimeAnimation() {
    if (!isRealtimeMode || !targetImageData) return;

    const ctx = drawCanvas.getContext('2d');
    const drawingData = ctx.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE);

    const sourcePixels = extractPixels(drawingData);
    const targetPixels = extractPixels(targetImageData);

    particles = mapPixels(sourcePixels, targetPixels);

    if (realtimeAnimationId) {
        cancelAnimationFrame(realtimeAnimationId);
        realtimeAnimationId = null;
    }

    animateRealtimeTransition();
}

function animateRealtimeTransition() {
    const duration = 2000;
    const startTime = performance.now();
    const ctx = animationCanvas.getContext('2d');

    function realtimeLoop(currentTime) {
        if (!isRealtimeMode) return;

        const elapsed = currentTime - startTime;
        let t = Math.min(elapsed / duration, 1);

        t = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

        ctx.clearRect(0, 0, animationCanvas.width, animationCanvas.height);

        particles.forEach(p => {
            const currentX = p.startX + (p.targetX - p.startX) * t;
            const currentY = p.startY + (p.targetY - p.startY) * t;

            ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
            ctx.fillRect(currentX, currentY, 1, 1);
        });

        if (t < 1) {
            realtimeAnimationId = requestAnimationFrame(realtimeLoop);
        } else {
            realtimeAnimationId = null;
        }
    }

    realtimeAnimationId = requestAnimationFrame(realtimeLoop);
}

function resetDrawMode() {
    stopRealtimeAnimation();

    initializeDrawCanvas();

    targetImageData = null;
    const ctx = targetPreviewCanvas.getContext('2d');
    ctx.clearRect(0, 0, targetPreviewCanvas.width, targetPreviewCanvas.height);

    const animCtx = animationCanvas.getContext('2d');
    animCtx.clearRect(0, 0, animationCanvas.width, animationCanvas.height);

    targetImageInput.value = '';

    startRealtimeBtn.disabled = true;
    stopRealtimeBtn.disabled = true;
    statusText.textContent = 'Draw something and upload a target image';
}
