// Simple Body Tracking using TensorFlow PoseNet
// This is ONLY for the game page - other pages use hand tracking

class SimpleBodyTracker {
    constructor() {
        this.net = null;
        this.video = null;
        this.isInitialized = false;
        
        // Initialize global variables for BODY tracking (not hand tracking)
        window.bodyX = null;
        window.shoulderX = null;
        window.hipX = null;
        window.handX = null; // Still track hands as fallback for body tracking
        
        // Add smoothing variables for better movement
        this.smoothingBuffer = [];
        this.bufferSize = 5; // Number of frames to average
        this.velocitySmoothing = 0.15; // How much to smooth velocity changes
        this.lastVelocity = 0;
    }

    async initialize() {
        try {
            // Load PoseNet model with optimized settings for performance
            this.net = await posenet.load({
                architecture: 'MobileNetV1',
                outputStride: 16, // Use 16 for better compatibility
                inputResolution: { width: 257, height: 193 }, // Even smaller resolution for better performance
                multiplier: 0.5 // Fastest multiplier for outputStride 16
            });

            // Set up camera with lower resolution for better performance
            this.video = document.createElement('video');
            this.video.width = 257; // Match the input resolution
            this.video.height = 193;
            
            // Style the video for debug display at top of screen
            this.video.style.position = 'fixed';
            this.video.style.top = '10px';
            this.video.style.right = '10px';
            this.video.style.width = '200px';
            this.video.style.height = '150px';
            this.video.style.border = '2px solid #00ff00';
            this.video.style.borderRadius = '8px';
            this.video.style.zIndex = '9999';
            this.video.style.transform = 'scaleX(-1)'; // Mirror the video for natural view
            this.video.style.display = 'block'; // Show for debugging
            
            document.body.appendChild(this.video);

            // Create canvas overlay for skeleton visualization
            this.skeletonCanvas = document.createElement('canvas');
            this.skeletonCanvas.width = 200; // Match video display size
            this.skeletonCanvas.height = 150;
            this.skeletonCanvas.style.position = 'fixed';
            this.skeletonCanvas.style.top = '10px';
            this.skeletonCanvas.style.right = '10px';
            this.skeletonCanvas.style.width = '200px';
            this.skeletonCanvas.style.height = '150px';
            this.skeletonCanvas.style.zIndex = '10000'; // Above video
            this.skeletonCanvas.style.pointerEvents = 'none';
            this.skeletonCanvas.style.transform = 'scaleX(-1)'; // Mirror to match video
            
            document.body.appendChild(this.skeletonCanvas);
            this.skeletonCtx = this.skeletonCanvas.getContext('2d');

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    width: 257, 
                    height: 193,
                    facingMode: 'user',
                    frameRate: { ideal: 20, max: 20 } // Reduced from 30 to 20 fps
                }
            });
            
            this.video.srcObject = stream;
            await this.video.play();

            // Wait a bit for video to be ready, then start detection
            setTimeout(() => {
                this.detectPose();
            }, 1000);

            this.isInitialized = true;
            console.log('Simple body tracking initialized successfully (optimized for performance)');
            
            // Automatically show debug info for development
            this.showDebugInfo();
            
            // Add keyboard shortcuts for debug controls
            document.addEventListener('keydown', (event) => {
                if (event.key === 'v' || event.key === 'V') {
                    this.toggleDebugVideo();
                } else if (event.key === 'd' || event.key === 'D') {
                    this.toggleDebugOverlay();
                }
            });

        } catch (error) {
            console.error('Failed to initialize simple body tracking:', error);
            console.error('Make sure camera permissions are granted');
        }
    }

    async detectPose() {
        if (!this.net || !this.video || this.video.readyState < 2) {
            requestAnimationFrame(() => this.detectPose());
            return;
        }

        try {
            // Use estimateSinglePose to detect only the most prominent person
            const pose = await this.net.estimateSinglePose(this.video, {
                flipHorizontal: true,
                decodingMethod: 'single-person'
            });

            // Additional filtering: only process if we have high-confidence core keypoints
            if (pose && pose.keypoints && this.isValidPrimaryPerson(pose.keypoints)) {
                this.updateBodyPositions(pose.keypoints);
                this.drawSkeleton(pose.keypoints); // Draw skeleton overlay
            }

        } catch (error) {
            console.error('Pose detection error:', error);
        }

        // Reduce detection frequency for better performance - detect every 2 frames instead of every frame
        setTimeout(() => {
            requestAnimationFrame(() => this.detectPose());
        }, 33); // ~30fps instead of 20fps for better responsiveness
    }

    // Validate that this is the primary person we want to track (not background people)
    isValidPrimaryPerson(keypoints) {
        const getKeypoint = (name) => keypoints.find(kp => kp.part === name);
        
        // Get core keypoints for validation
        const nose = getKeypoint('nose');
        const leftShoulder = getKeypoint('leftShoulder');
        const rightShoulder = getKeypoint('rightShoulder');
        
        // Require high confidence on core keypoints to avoid tracking background people
        const minConfidence = 0.4; // Higher threshold for primary person detection
        
        // Must have nose OR both shoulders with high confidence
        const hasValidHead = nose && nose.score > minConfidence;
        const hasValidShoulders = leftShoulder && rightShoulder && 
                                 leftShoulder.score > minConfidence && 
                                 rightShoulder.score > minConfidence;
        
        // Accept if we have either a clear head OR clear shoulders
        if (!hasValidHead && !hasValidShoulders) {
            return false;
        }
        
        // Additional check: person should be reasonably centered and close to camera
        // (helps filter out people in background or edges)
        if (hasValidShoulders) {
            const shoulderCenterX = (leftShoulder.position.x + rightShoulder.position.x) / 2;
            const videoWidth = 257;
            const centerRatio = shoulderCenterX / videoWidth; // 0 to 1
            
            // Person should be somewhat centered (not completely at edges)
            if (centerRatio < 0.2 || centerRatio > 0.8) {
                return false;
            }
            
            // Shoulders should be reasonably sized (not too small = far away)
            const shoulderDistance = Math.abs(leftShoulder.position.x - rightShoulder.position.x);
            if (shoulderDistance < 30) { // Too small = probably background person
                return false;
            }
        }
        
        return true;
    }

    updateBodyPositions(keypoints) {
        const screenWidth = window.innerWidth;
        const videoWidth = 257; // Updated to match new video resolution
        
        // Find keypoints by name
        const getKeypoint = (name) => keypoints.find(kp => kp.part === name);
        
        const leftShoulder = getKeypoint('leftShoulder');
        const rightShoulder = getKeypoint('rightShoulder');
        const leftHip = getKeypoint('leftHip');
        const rightHip = getKeypoint('rightHip');
        const leftWrist = getKeypoint('leftWrist');
        const rightWrist = getKeypoint('rightWrist');

        // LEAN DIRECTION DETECTION (not position-based)
        // Bowl moves based on LEAN DIRECTION, not body position
        
        // OPTION 1: Direct shoulder center position tracking (FIXED DIRECTION + SMOOTHING)
        // This is the most reliable and fastest method
        
        if (leftShoulder && rightShoulder && 
            leftShoulder.score > 0.3 && rightShoulder.score > 0.3) {
            
            // Calculate center point between shoulders
            const shoulderCenterX = (leftShoulder.position.x + rightShoulder.position.x) / 2;
            
            // Convert to screen coordinates WITHOUT MIRRORING (since video is already mirrored)
            const rawPosition = (shoulderCenterX / videoWidth) * screenWidth;
            
            // Apply bounds with some padding
            const clampedPosition = Math.max(150, Math.min(screenWidth - 150, rawPosition));
            
            // Advanced smoothing for smoother bowl movement
            const smoothedPosition = this.applySmoothMovement(clampedPosition);
            
            window.bodyX = smoothedPosition;
            window.shoulderX = window.bodyX;
        }
        
        // Fallback: Hand position (if shoulders not detected)
        if ((!window.bodyX || window.bodyX === null) && 
            (rightWrist && rightWrist.score > 0.3)) {
            const handPosition = ((videoWidth - rightWrist.position.x) / videoWidth) * screenWidth;
            const clampedHandPosition = Math.max(50, Math.min(screenWidth - 50, handPosition));
            
            window.handX = clampedHandPosition;
            // Use hand position as bodyX if no shoulder detection
            if (!window.bodyX) {
                window.bodyX = clampedHandPosition;
            }
        } else if ((!window.bodyX || window.bodyX === null) && 
                   (leftWrist && leftWrist.score > 0.3)) {
            const handPosition = ((videoWidth - leftWrist.position.x) / videoWidth) * screenWidth;
            const clampedHandPosition = Math.max(50, Math.min(screenWidth - 50, handPosition));
            
            window.handX = clampedHandPosition;
            // Use hand position as bodyX if no shoulder detection
            if (!window.bodyX) {
                window.bodyX = clampedHandPosition;
            }
        }

        // Debug logging (increased frequency for troubleshooting)
        if (window.bodyX && Math.random() < 0.1) {
            const leftShoulder = getKeypoint('leftShoulder');
            const rightShoulder = getKeypoint('rightShoulder');
            if (leftShoulder && rightShoulder) {
                const shoulderTilt = rightShoulder.position.y - leftShoulder.position.y;
            }
        }
    }

    // Advanced smoothing for smoother bowl movement
    applySmoothMovement(newPosition) {
        // Add new position to buffer
        this.smoothingBuffer.push(newPosition);
        
        // Keep buffer at fixed size
        if (this.smoothingBuffer.length > this.bufferSize) {
            this.smoothingBuffer.shift();
        }
        
        // Calculate weighted average (more recent positions have more weight)
        let weightedSum = 0;
        let totalWeight = 0;
        
        for (let i = 0; i < this.smoothingBuffer.length; i++) {
            // More recent positions get higher weight
            const weight = (i + 1) / this.smoothingBuffer.length;
            weightedSum += this.smoothingBuffer[i] * weight;
            totalWeight += weight;
        }
        
        const averagePosition = weightedSum / totalWeight;
        
        // If this is the first position, use it directly
        if (window.bodyX === null) {
            this.lastVelocity = 0;
            return averagePosition;
        }
        
        // Calculate velocity (change in position)
        const currentVelocity = averagePosition - window.bodyX;
        
        // Smooth the velocity to prevent jerky movements
        const smoothedVelocity = this.lastVelocity * (1 - this.velocitySmoothing) + 
                                currentVelocity * this.velocitySmoothing;
        
        // Apply the smoothed velocity to get the final position
        const finalPosition = window.bodyX + smoothedVelocity;
        
        // Store velocity for next frame
        this.lastVelocity = smoothedVelocity;
        
        return finalPosition;
    }

    // Draw skeleton overlay on the debug video
    drawSkeleton(keypoints) {
        if (!this.skeletonCtx || !this.skeletonCanvas) return;
        
        // Clear previous frame
        this.skeletonCtx.clearRect(0, 0, this.skeletonCanvas.width, this.skeletonCanvas.height);
        
        // Scale factors to match canvas size to video resolution
        const scaleX = this.skeletonCanvas.width / 257; // 257 is video width
        const scaleY = this.skeletonCanvas.height / 193; // 193 is video height
        
        // Helper function to get keypoint by name
        const getKeypoint = (name) => keypoints.find(kp => kp.part === name);
        
        // Helper function to mirror X coordinate for natural view
        const mirrorX = (x) => this.skeletonCanvas.width - (x * scaleX);
        const scaleYCoord = (y) => y * scaleY;
        
        // Define skeleton connections (PoseNet body parts) - ONLY shoulder to head movement
        const connections = [
            // Head and neck
            ['nose', 'leftEye'],
            ['nose', 'rightEye'],
            ['leftEye', 'leftEar'],
            ['rightEye', 'rightEar'],
            
            // Shoulders only (for lean detection)
            ['leftShoulder', 'rightShoulder']
        ];
        
        // Draw connections (lines between keypoints)
        this.skeletonCtx.strokeStyle = '#00FF00'; // Green lines
        this.skeletonCtx.lineWidth = 2;
        this.skeletonCtx.beginPath();
        
        connections.forEach(([startName, endName]) => {
            const startPoint = getKeypoint(startName);
            const endPoint = getKeypoint(endName);
            
            if (startPoint && endPoint && startPoint.score > 0.15 && endPoint.score > 0.15) {
                const startX = mirrorX(startPoint.position.x);
                const startY = scaleYCoord(startPoint.position.y);
                const endX = mirrorX(endPoint.position.x);
                const endY = scaleYCoord(endPoint.position.y);
                
                this.skeletonCtx.moveTo(startX, startY);
                this.skeletonCtx.lineTo(endX, endY);
            }
        });
        
        this.skeletonCtx.stroke();
        
        // Draw keypoints (circles at joints)
        keypoints.forEach(keypoint => {
            if (keypoint.score > 0.15) {
                const x = mirrorX(keypoint.position.x);
                const y = scaleYCoord(keypoint.position.y);
                
                // Different colors for different confidence levels
                if (keypoint.score > 0.5) {
                    this.skeletonCtx.fillStyle = '#FF0000'; // Red for high confidence
                } else if (keypoint.score > 0.3) {
                    this.skeletonCtx.fillStyle = '#FFFF00'; // Yellow for medium confidence
                } else {
                    this.skeletonCtx.fillStyle = '#FFA500'; // Orange for low confidence
                }
                
                this.skeletonCtx.beginPath();
                this.skeletonCtx.arc(x, y, 3, 0, 2 * Math.PI);
                this.skeletonCtx.fill();
            }
        });
        
        // Highlight shoulder points used for leaning detection
        const leftShoulder = getKeypoint('leftShoulder');
        const rightShoulder = getKeypoint('rightShoulder');
        
        [leftShoulder, rightShoulder].forEach(point => {
            if (point && point.score > 0.15) {
                const x = mirrorX(point.position.x);
                const y = scaleYCoord(point.position.y);
                
                // Draw larger circle for lean detection points
                this.skeletonCtx.strokeStyle = '#00FFFF'; // Cyan outline
                this.skeletonCtx.lineWidth = 2;
                this.skeletonCtx.beginPath();
                this.skeletonCtx.arc(x, y, 6, 0, 2 * Math.PI);
                this.skeletonCtx.stroke();
            }
        });
    }

    // Toggle debug video visibility
    toggleDebugVideo() {
        if (this.video && this.skeletonCanvas) {
            if (this.video.style.display === 'none') {
                this.video.style.display = 'block';
                this.skeletonCanvas.style.display = 'block';
                console.log('Debug video with skeleton enabled');
            } else {
                this.video.style.display = 'none';
                this.skeletonCanvas.style.display = 'none';
                console.log('Debug video with skeleton disabled');
            }
        }
    }

    // Show debug info overlay
    showDebugInfo() {
        if (!this.debugOverlay) {
            this.debugOverlay = document.createElement('div');
            this.debugOverlay.style.position = 'fixed';
            this.debugOverlay.style.top = '170px'; // Below the video
            this.debugOverlay.style.right = '10px';
            this.debugOverlay.style.background = 'rgba(0, 0, 0, 0.7)';
            this.debugOverlay.style.color = '#00ff00';
            this.debugOverlay.style.padding = '10px';
            this.debugOverlay.style.borderRadius = '8px';
            this.debugOverlay.style.fontFamily = 'monospace';
            this.debugOverlay.style.fontSize = '12px';
            this.debugOverlay.style.zIndex = '9999';
            this.debugOverlay.style.minWidth = '180px';
            document.body.appendChild(this.debugOverlay);
        }
        
        // Update debug info every frame
        const updateDebugInfo = () => {
            if (this.debugOverlay && this.debugOverlay.style.display !== 'none') {
                this.debugOverlay.innerHTML = `
                    <div><strong>Body Tracking Debug</strong></div>
                    <div>Body X: ${window.bodyX ? window.bodyX.toFixed(0) : 'null'}</div>
                    <div>Shoulder X: ${window.shoulderX ? window.shoulderX.toFixed(0) : 'null'}</div>
                    <div>Hip X: ${window.hipX ? window.hipX.toFixed(0) : 'null'}</div>
                    <div>Hand X: ${window.handX ? window.handX.toFixed(0) : 'null'}</div>
                    <div>Screen Width: ${window.innerWidth}</div>
                    <div>Center: ${(window.innerWidth / 2).toFixed(0)}</div>
                `;
            }
            requestAnimationFrame(updateDebugInfo);
        };
        updateDebugInfo();
    }

    // Toggle debug overlay
    toggleDebugOverlay() {
        if (!this.debugOverlay) {
            this.showDebugInfo();
        } else {
            if (this.debugOverlay.style.display === 'none') {
                this.debugOverlay.style.display = 'block';
                console.log('Debug overlay enabled');
            } else {
                this.debugOverlay.style.display = 'none';
                console.log('Debug overlay disabled');
            }
        }
    }

    stop() {
        if (this.video && this.video.srcObject) {
            this.video.srcObject.getTracks().forEach(track => track.stop());
            this.video.remove();
        }
        if (this.skeletonCanvas) {
            this.skeletonCanvas.remove();
        }
        if (this.debugOverlay) {
            this.debugOverlay.remove();
        }
    }
}

// Initialize BODY tracking when game page loads (not for other pages)
window.addEventListener('load', async () => {
    console.log('simpleBodyTracking.js loaded on page:', window.location.pathname);
    console.log('PoseNet available:', typeof posenet !== 'undefined');
    
    // Only initialize if we're on the game page and PoseNet is available
    if (typeof posenet !== 'undefined' && (window.location.pathname.includes('game.html') || window.location.pathname.endsWith('/game.html') || window.location.pathname === '/game.html')) {
        console.log('Starting body tracking for game page...');
        window.simpleBodyTracker = new SimpleBodyTracker();
        await window.simpleBodyTracker.initialize();
    } else if (!window.location.pathname.includes('game.html')) {
        console.log('Body tracking script loaded but disabled - not on game page. Current path:', window.location.pathname);
        console.log('This script should only be loaded on game.html!');
    } else {
        console.warn('PoseNet not loaded. Body tracking disabled.');
    }
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (window.simpleBodyTracker) {
        window.simpleBodyTracker.stop();
    }
});
