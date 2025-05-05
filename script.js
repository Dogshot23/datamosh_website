const imageUpload = document.getElementById('imageUpload');
const glitchCanvas = document.getElementById('glitchCanvas');
const glitchCtx = glitchCanvas.getContext('2d');

let uploadedImage = null; // Store the uploaded image object
let lastMouseX = null;
let lastMouseY = null;
let imageUploaded = false; // Flag to track if an image has been uploaded
let lastMoveDirection = { x: 0, y: 0 }; // Initialize with no movement

// --- Glitch Parameters for Block Smearing (Adjusted for much bigger blocks and ~75% less distortion) ---
const effectAreaSize = 100; // Affected area size (kept at 100)
const numberOfSmearBlocks = 4; // Drastically reduced number of blocks smeared per movement
const minSmearBlockSize = 60; // Much larger minimum block size
const maxSmearBlockSize = 100; // Much larger maximum block size
const blockSmearDistance = 4; // Significantly reduced base distance blocks are moved
const blockSmearRandomness = 3; // Reduced randomness in the block destination

// --- Audio Setup (Keeping the current low-pitch, glitchy settings) ---
let audioContext = null;
let oscillator = null;
let gainNode = null;
const glitchFrequencies = [60, 80, 120, 180, 240]; // Lower frequencies
let currentGlitchFrequencyIndex = 0;

// Function to initialize or resume the AudioContext and create nodes
function initAudio() {
    // Check if audio context is already initialized and running
    if (audioContext && audioContext.state === 'running') {
        return; // Audio is already good to go
    }

    // Initialize or resume AudioContext with user interaction
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Create an oscillator (e.g., square wave for 8-bit feel)
        oscillator = audioContext.createOscillator();
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(glitchFrequencies[currentGlitchFrequencyIndex], audioContext.currentTime); // Initial frequency
        currentGlitchFrequencyIndex = (currentGlitchFrequencyIndex + 1) % glitchFrequencies.length;

        // Create a gain node to control volume
        gainNode = audioContext.createGain();
        gainNode.gain.setValueAtTime(0, audioContext.currentTime); // Start silently

        // Connect the nodes: oscillator -> gain -> destination (speakers)
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Start the oscillator (it will play silently as gain is 0)
        oscillator.start();

        console.log('Audio context and nodes initialized/resumed.');

    } catch (e) {
        console.error('Web Audio API is not supported in this browser or failed to initialize:', e);
    }
}

// Function to handle direction changes and play glitch sounds
function handleDirectionChange(direction) {
    if (!audioContext || audioContext.state !== 'running' || !oscillator || !gainNode) {
        return; // Audio not initialized or not running
    }

    // Determine the primary direction quadrant
    let currentDirection = { x: 0, y: 0 };
    if (Math.abs(direction.x) > Math.abs(direction.y)) {
        currentDirection.x = direction.x > 0 ? 1 : -1;
    } else {
        currentDirection.y = direction.y > 0 ? 1 : -1;
    }

    // Play a glitch sound only if there's a significant change in primary direction
    if (currentDirection.x !== lastMoveDirection.x || currentDirection.y !== lastMoveDirection.y) {
        currentGlitchFrequencyIndex = (currentGlitchFrequencyIndex + 1) % glitchFrequencies.length;
        const baseFrequency = glitchFrequencies[currentGlitchFrequencyIndex];

        // --- Glitchy Pitch Modulation on Direction Change ---
        const glitchDuration = 0.08; // Short duration for the glitch effect
        const numberOfJumps = 3; // Number of rapid pitch changes
        const frequencyRandomness = 80; // Range of random frequency deviation for jumps

        oscillator.frequency.setValueAtTime(baseFrequency, audioContext.currentTime); // Start at the base pitch for this direction

        for(let i = 0; i < numberOfJumps; i++) {
             const randomFactor = (Math.random() - 0.5) * frequencyRandomness;
             const glitchFreq = Math.max(30, baseFrequency + randomFactor); // Ensure frequency stays above a very low minimum
             const jumpTime = audioContext.currentTime + (i + 1) * (glitchDuration / numberOfJumps);
             oscillator.frequency.linearRampToValueAtTime(glitchFreq, jumpTime);
        }
         // Ramp back to the final base frequency after the jumps
        oscillator.frequency.linearRampToValueAtTime(baseFrequency, audioContext.currentTime + glitchDuration + 0.05);


        // --- Glitchy Volume Envelope on Direction Change ---
        gainNode.gain.setValueAtTime(0.4, audioContext.currentTime); // Start with a short, noticeable volume
        // Quickly ramp volume down after the pitch changes
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + glitchDuration + 0.1);


        lastMoveDirection = currentDirection; // Update the last recorded direction
    }
}

// Function to resize canvas and tile the image
function resizeAndTileCanvas() {
    glitchCanvas.width = window.innerWidth;
    glitchCanvas.height = window.innerHeight;

    if (uploadedImage) {
        const imgWidth = uploadedImage.width;
        const imgHeight = uploadedImage.height;
        const canvasWidth = glitchCanvas.width;
        const canvasHeight = glitchCanvas.height;

        glitchCtx.clearRect(0, 0, canvasWidth, canvasHeight); // Clear canvas before tiling

        // Tile the image
        for (let y = 0; y < canvasHeight; y += imgHeight) {
            for (let x = 0; x < canvasWidth; x += imgWidth) {
                glitchCtx.drawImage(uploadedImage, x, y, imgWidth, imgHeight);
            }
        }
    } else {
        // If no image is uploaded, draw the initial instruction
        drawInitialInstruction();
    }
}

// Function to draw the initial instruction text
function drawInitialInstruction() {
    glitchCtx.fillStyle = '#FFFFFF'; // White text
    glitchCtx.font = '24px sans-serif';
    glitchCtx.textAlign = 'center';
    glitchCtx.textBaseline = 'middle';
    glitchCtx.clearRect(0, 0, glitchCanvas.width, glitchCanvas.height); // Clear before drawing text

    let instructionText = 'Double Click to Upload Image';
    // Draw the text only if no image is uploaded
    if (!imageUploaded) {
         glitchCtx.fillText(instructionText, glitchCanvas.width / 2, glitchCanvas.height / 2);
    }
     // If image is uploaded, tiling handles the display, no text needed.
}


// Handle window resizing
window.addEventListener('resize', resizeAndTileCanvas);

// Handle image upload
imageUpload.addEventListener('change', (e) => {
    console.log('Image upload triggered');
    const file = e.target.files[0];
    if (!file) {
        console.log('No file selected');
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        console.log('FileReader loaded');
        const img = new Image();
        img.onload = () => {
            console.log('Image loaded and ready to tile');
            uploadedImage = img; // Store the uploaded image
            imageUploaded = true; // Set flag

            // Reset last mouse position and direction for fresh smearing on the new image
            lastMouseX = null;
            lastMouseY = null;
            lastMoveDirection = {x: 0, y: 0};

            resizeAndTileCanvas(); // Resize and tile on load

        };
        img.onerror = (err) => {
            console.error('Error loading image:', err);
            // Optionally revert imageUploaded flag or show error message
             imageUploaded = false;
             uploadedImage = null;
             resizeAndTileCanvas(); // Redraw instruction or indicate error
        };
        img.src = event.target.result;
         console.log('Image source set');
    };
    reader.onerror = (err) => {
        console.error('Error reading file:', err);
         // Optionally revert imageUploaded flag or show error message
         imageUploaded = false;
         uploadedImage = null;
         resizeAndTileCanvas(); // Redraw instruction or indicate error
    };
    reader.readAsDataURL(file);
     console.log('FileReader reading file');
});

// Function to copy a block of pixels within the same pixel data array
// Copies from src to dest within the 'pixels' array
function copyBlock(pixels, dataWidth, dataHeight, srcX, srcY, destX, destY, blockWidth, blockHeight) {
    // Create a temporary buffer to hold the source block data during copy
    // This prevents issues if source and destination overlap
    const tempBlockData = new Uint8ClampedArray(blockWidth * blockHeight * 4);

    // Copy source block to temporary buffer
    for (let y = 0; y < blockHeight; y++) {
        for (let x = 0; x < blockWidth; x++) {
            const srcIndex = ((srcY + y) * dataWidth + (srcX + x)) * 4;
            const tempIndex = (y * blockWidth + x) * 4;

            if (srcIndex >= 0 && srcIndex + 3 < pixels.length) { // Added bounds check for srcIndex
                tempBlockData[tempIndex] = pixels[srcIndex];
                tempBlockData[tempIndex + 1] = pixels[srcIndex + 1];
                tempBlockData[tempIndex + 2] = pixels[srcIndex + 2];
                tempBlockData[tempIndex + 3] = pixels[srcIndex + 3];
            } else {
                 // If source is out of bounds, fill with transparent or black
                 tempBlockData[tempIndex] = 0;
                 tempBlockData[tempIndex + 1] = 0;
                 tempBlockData[tempIndex + 2] = 0;
                 tempBlockData[tempIndex + 3] = 0; // Transparent
            }
        }
    }

    // Copy from temporary buffer to destination in the main pixels array
    for (let y = 0; y < blockHeight; y++) {
        for (let x = 0; x < blockWidth; x++) {
            const destIndex = ((destY + y) * dataWidth + (destX + x)) * 4;
            const tempIndex = (y * blockWidth + x) * 4;

             if (destIndex >= 0 && destIndex + 3 < pixels.length) { // Added bounds check for destIndex
                pixels[destIndex] = tempBlockData[tempIndex];
                pixels[destIndex + 1] = tempBlockData[tempIndex + 1];
                pixels[destIndex + 2] = tempBlockData[tempIndex + 2];
                pixels[destIndex + 3] = tempBlockData[tempIndex + 3];
             }
        }
    }
}


// Handle mouse movement for localized block smearing effect AND audio modulation
function handleMouseMove(e) {
     // Apply smear effect whenever mouse moves, if image is uploaded
     if (!uploadedImage) {
         return;
     }

     // console.log('handleMouseMove called');

     // Initialize last position if null (first move over canvas after load)
     if (lastMouseX === null || lastMouseY === null) {
         const rect = glitchCanvas.getBoundingClientRect();
         lastMouseX = e.clientX - rect.left;
         lastMouseY = e.clientY - rect.top;
         // console.log(`handleMouseMove: Initialized lastMouse on first move: ${lastMouseX}, ${lastMouseY}`);
         return; // Return on the very first move as there's no previous position for direction
     }

    const rect = glitchCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;


    // Calculate mouse movement vector
    const moveX = mouseX - lastMouseX;
    const moveY = mouseY - lastMouseY;

    // Update last mouse position
    lastMouseX = mouseX;
    lastMouseY = mouseY;

    // If no significant movement, no smearing and no significant audio change
    const moveMagnitude = Math.sqrt(moveX * moveX + moveY * moveY);
    if (moveMagnitude < 1) { // Threshold for movement to trigger effect/audio
        // Optionally reduce gain to silence when mouse is still
        if (audioContext && gainNode) {
             gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.1);
        }
        return;
    }

    // Trigger direction change audio based on the movement vector
    handleDirectionChange({ x: moveX, y: moveY });


    // Calculate the *mirrored* position relative to the center
    const canvasCenterX = glitchCanvas.width / 2;
    const canvasCenterY = glitchCanvas.height / 2;

    const mirroredX = canvasCenterX + (canvasCenterX - mouseX);
    const mirroredY = canvasCenterY + (canvasCenterY - mouseY);


    // Calculate the area to apply the effect (centered around the MIRRORED position)
    const areaX = Math.max(0, Math.floor(mirroredX - effectAreaSize / 2));
    const areaY = Math.max(0, Math.floor(mirroredY - effectAreaSize / 2));
    const areaWidth = Math.min(effectAreaSize, glitchCanvas.width - areaX);
    const areaHeight = Math.min(effectAreaSize, glitchCanvas.height - areaY);

    if (areaWidth <= 0 || areaHeight <= 0) {
        // console.log('handleMouseMove: Area size <= 0, returning.');
        return;
    }

    // console.log(`handleMouseMove: Effect Area: ${areaX}, ${areaY}, ${areaWidth}, ${areaHeight}`);

    // Get the image data for the effect area from the *current* state of the canvas
    const areaImageData = glitchCtx.getImageData(areaX, areaY, areaWidth, areaHeight);
    const areaPixels = areaImageData.data;
    const currentAreaWidth = areaImageData.width;
    const currentAreaHeight = areaImageData.height;

    // console.log(`handleMouseMove: Area ImageData dimensions: ${currentAreaWidth}, ${currentAreaHeight}`);
    // console.log(`handleMouseMove: Area Pixels length: ${areaPixels.length}`);


    // Calculate the opposite direction vector (based on the REAL mouse movement), potentially normalized
    let smearDirX = 0;
    let smearDirY = 0;

    if (moveMagnitude > 0) {
        const normalizedMoveX = moveX / moveMagnitude;
        const normalizedMoveY = moveY / moveMagnitude;

        // Smear in the opposite direction (mirror opposite of REAL movement)
        smearDirX = -normalizedMoveX;
        smearDirY = -normalizedMoveY;
    }

    // --- Apply Directional Block Smearing ---
    // Work directly on areaPixels. When a block is copied, it will overwrite
    // the pixels at the destination, creating the smear trail effect.

    for (let i = 0; i < numberOfSmearBlocks; i++) {
        // Determine random block size
        const blockWidth = Math.floor(Math.random() * (maxSmearBlockSize - minSmearBlockSize + 1)) + minSmearBlockSize;
        const blockHeight = Math.floor(Math.random() * (maxSmearBlockSize - minSmearBlockSize + 1)) + minSmearBlockSize;

         // Ensure block size is at least 1x1
        const actualBlockWidth = Math.max(1, Math.min(blockWidth, currentAreaWidth));
        const actualBlockHeight = Math.max(1, Math.min(blockHeight, currentAreaHeight));


        // Determine random source position within the area, ensuring the block fits
        // Use Math.max(0, ...) to avoid negative results if area is smaller than block size
        const srcX = Math.floor(Math.random() * Math.max(1, currentAreaWidth - actualBlockWidth + 1));
        const srcY = Math.floor(Math.random() * Math.max(1, currentAreaHeight - actualBlockHeight + 1));


        // Calculate base destination position by moving from source in opposite direction (based on REAL movement)
        let destX = srcX + smearDirX * blockSmearDistance;
        let destY = srcY + smearDirY * blockSmearDistance;

        // Add randomness to the destination
        destX += (Math.random() - 0.5) * blockSmearRandomness;
        destY += (Math.random() - 0.5) * blockSmearRandomness;

        // Clamp destination position so the entire block fits within the area bounds
         // Use Math.max(0, ...) to avoid negative results if area is smaller than block size
        const clampedDestX = Math.max(0, Math.min(currentAreaWidth - actualBlockWidth, Math.floor(destX)));
        const clampedDestY = Math.max(0, Math.min(currentAreaHeight - actualBlockHeight, Math.floor(destY)));

        // Copy the block from the source position to the clamped destination position
        copyBlock(areaPixels, currentAreaWidth, currentAreaHeight, srcX, srcY, clampedDestX, clampedDestY, actualBlockWidth, actualBlockHeight);
    }


    // Put the modified area data back onto the glitch canvas
    glitchCtx.putImageData(areaImageData, areaX, areaY);


    // --- Audio Modulation based on Movement Speed ---
    // Only modulate audio gain if initialized and running
    if (audioContext && audioContext.state === 'running' && uploadedImage) {
        // Map movement magnitude to gain (volume)
        const gainSensitivity = 30; // Adjust for how sensitive volume is to speed
        const gainValue = Math.min(0.4, moveMagnitude / gainSensitivity); // Max gain 0.4 to avoid clipping
        gainNode.gain.linearRampToValueAtTime(gainValue, audioContext.currentTime + 0.05); // Smooth change
    }
}


// Handle double clicks on the canvas to trigger upload AND initialize audio
glitchCanvas.addEventListener('dblclick', () => {
     console.log('Canvas double-clicked, attempting to trigger file upload');
    const fileInput = document.getElementById('imageUpload');
    if (fileInput) {
        fileInput.click();
        console.log('imageUpload.click() called');
        initAudio(); // Initialize audio on double click (user gesture)
    } else {
        console.error('Error: imageUpload element not found!');
    }
});

// Initial resize and draw instruction
resizeAndTileCanvas();
console.log('Initial setup complete.');

// Add the mousemove listener initially
glitchCanvas.addEventListener('mousemove', handleMouseMove);

// The mouseenter listener can also initialize audio if the user hovers before dblclicking
glitchCanvas.addEventListener('mouseenter', handleMouseEnter);

function handleMouseEnter(e) {
     if (lastMouseX === null || lastMouseY === null) {
        const rect = glitchCanvas.getBoundingClientRect();
        lastMouseX = e.clientX - rect.left;
        lastMouseY = e.clientY - rect.top;
        console.log(`Mouse entered canvas, initialized lastMouse: ${lastMouseX}, ${lastMouseY}`);
     }
     // Initialize audio on mouse enter as well (user gesture)
     // This ensures audio starts if user hovers before dblclicking
     initAudio();
}