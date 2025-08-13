// Simple Body Tracking using TensorFlow PoseNet
// This is ONLY for the game page - other pages use hand tracking

class SimpleBodyTracker {
    constructor() {
        this.net = null;
        this.video = null;
        this.isInitialized = false;
              // Higher confidence threshold to filter out distant people
        const averageConfidence = keypoints.reduce((sum, kp) => sum + kp.score, 0) / keypoints.length;
        if (averageConfidence < 0.35) { // Reduced from 0.4 to 0.35 for shorter users
            return false; // Person too far or unclear
        }
        
        // Get essential keypoints for validation
        const leftShoulder = getKeypoint('leftShoulder');
        const rightShoulder = getKeypoint('rightShoulder');
        const nose = getKeypoint('nose');
        const leftWrist = getKeypoint('leftWrist');
        const rightWrist = getKeypoint('rightWrist');
        
        // Adaptive minimum confidence based on user detection
        const minConfidence = 0.4; // Reduced from 0.45 to 0.4 for better height accommodationInitialize global variables for BODY tracking (not hand tracking)
        window.bodyX = null;
        window.shoulderX = null;
        window.hipX = null;
        window.handX = null; // Still track hands as fallback for body tracking
        
        // Add smoothing variables for better movement
        this.smoothingBuffer = [];
        this.bufferSize = 2; // Number of frames to average (reduced from 3 for 10% more sensitivity)
        this.velocitySmoothing = 0.11; // How much to smooth velocity changes (reduced from 0.12 for 10% more responsiveness)
        this.lastVelocity = 0;
        
        // Person persistence tracking
        this.consecutiveDetections = 0;
        this.minConsecutiveFrames = 2; // Reduced from 3 to 2 for faster response
        this.lastValidPose = null;
        this.noDetectionFrames = 0;
        this.maxNoDetectionFrames = 15; // Increased from 10 to 15 for more stability
    }

    async initialize() {
        try {
            // Load PoseNet model with optimized settings for performance
            this.net = await posenet.load({
                architecture: 'MobileNetV1',
                outputStride: 16, // Keep at 16 for stability
                inputResolution: { width: 193, height: 145 }, // Reduced resolution further for speed
                multiplier: 0.5 // Fastest multiplier
            });

            // Set up camera with lower resolution for better performance
            this.video = document.createElement('video');
            this.video.width = 193; // Match the input resolution
            this.video.height = 145;
            
            // Style the video for debug display at top of screen
            this.video.style.position = 'fixed';
            this.video.style.top = '10px';
            this.video.style.right = '10px';
            this.video.style.width = '180px';
            this.video.style.height = '135px';
            this.video.style.border = '2px solid #00ff00';
            this.video.style.borderRadius = '8px';
            this.video.style.zIndex = '9999';
            this.video.style.transform = 'scaleX(-1)'; // Mirror the video for natural view
            this.video.style.display = 'block'; // Hidden by default for performance
            
            document.body.appendChild(this.video);

            // Create canvas overlay for skeleton visualization
            this.skeletonCanvas = document.createElement('canvas');
            this.skeletonCanvas.width = 180; // Match video display size
            this.skeletonCanvas.height = 135;
            this.skeletonCanvas.style.position = 'fixed';
            this.skeletonCanvas.style.top = '10px';
            this.skeletonCanvas.style.right = '10px';
            this.skeletonCanvas.style.width = '180px';
            this.skeletonCanvas.style.height = '135px';
            this.skeletonCanvas.style.zIndex = '10000'; // Above video
            this.skeletonCanvas.style.pointerEvents = 'none';
            this.skeletonCanvas.style.transform = 'scaleX(-1)'; // Mirror to match video
            this.skeletonCanvas.style.display = 'block'; // Hidden by default for performance
            
            document.body.appendChild(this.skeletonCanvas);
            this.skeletonCtx = this.skeletonCanvas.getContext('2d');

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    width: 193, 
                    height: 145,
                    facingMode: 'user',
                    frameRate: { ideal: 15, max: 20 } // Reduced from 20 to 15 fps for better performance
                }
            });
            
            this.video.srcObject = stream;
            await this.video.play();

            // Wait a bit for video to be ready, then start detection
            setTimeout(() => {
                this.detectPose();
            }, 1000);

            this.isInitialized = true;
            console.log('Simple body tracking initialized (optimized for multi-person performance)');
            
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
            // Use multi-person detection to find the best candidate
            const poses = await this.net.estimatePoses(this.video, {
                flipHorizontal: true,
                decodingMethod: 'multi-person',
                maxDetections: 3, // Limit to 3 people max for performance
                scoreThreshold: 0.3,
                nmsRadius: 30
            });

            // Filter and rank poses to find the closest person
            let bestPose = null;
            let bestScore = 0;

            if (poses && poses.length > 0) {
                for (const pose of poses) {
                    if (!pose.keypoints || pose.score < 0.2) continue;
                    
                    // Calculate a composite score for "closest person"
                    const proximityScore = this.calculateProximityScore(pose.keypoints);
                    
                    if (proximityScore > bestScore && this.isClosestPersonToCamera(pose.keypoints)) {
                        bestScore = proximityScore;
                        bestPose = pose;
                    }
                }
            }

            // Process the best pose if found
            if (bestPose) {
                // Check if this is the same person we were tracking (persistence check)
                if (this.isSamePerson(bestPose.keypoints, this.lastValidPose)) {
                    this.consecutiveDetections++;
                } else {
                    this.consecutiveDetections = 1; // Reset counter for new person
                }
                
                // Only update tracking if we've consistently detected this person
                if (this.consecutiveDetections >= this.minConsecutiveFrames) {
                    this.updateBodyPositions(bestPose.keypoints);
                    this.drawSkeletonOptimized(bestPose.keypoints); // Optimized drawing
                    this.lastValidPose = bestPose.keypoints;
                    this.noDetectionFrames = 0;
                    
                    // Debug logging every 60 frames (roughly once every 2 seconds) to reduce spam
                    if (Math.random() < 0.017) {
                        console.log('Body tracking active:', {
                            bodyX: window.bodyX?.toFixed(0),
                            consecutiveDetections: this.consecutiveDetections,
                            proximityScore: bestScore.toFixed(2),
                            totalPeople: poses.length
                        });
                    }
                }
            } else {
                this.handleNoDetection();
            }

        } catch (error) {
            console.error('Pose detection error:', error);
        }

        this.scheduleNextDetection();
    }

    // Separate method to handle no detection cases
    handleNoDetection() {
        this.consecutiveDetections = 0;
        this.noDetectionFrames++;
        
        // Debug logging for detection failures (less frequent)
        if (this.noDetectionFrames === 10) { // Log once when we start losing detection
            console.log('Body tracking lost person, frames without detection:', this.noDetectionFrames);
        }
        
        // Clear tracking data if no valid person for too long
        if (this.noDetectionFrames >= this.maxNoDetectionFrames) {
            window.bodyX = null;
            window.shoulderX = null;
            window.hipX = null;
            window.handX = null;
            this.lastValidPose = null;
            
            if (this.noDetectionFrames === this.maxNoDetectionFrames) { // Log once when clearing
                console.log('Body tracking cleared due to prolonged detection failure');
            }
        }
    }

    // Separate method to schedule next detection with adaptive timing
    scheduleNextDetection() {
        // Adaptive frame rate based on detection status
        let delay = 50; // Default ~20fps
        
        if (this.noDetectionFrames > 5) {
            // Slow down when no person detected to save CPU
            delay = 80; // ~12fps
        } else if (window.bodyX !== null) {
            // Speed up when actively tracking
            delay = 40; // ~25fps
        }
        
        setTimeout(() => {
            requestAnimationFrame(() => this.detectPose());
        }, delay);
    }

    // Check if the detected person is the same as previously tracked person
    isSamePerson(currentKeypoints, lastKeypoints) {
        if (!lastKeypoints) return true; // First detection
        
        const getKeypoint = (keypoints, name) => keypoints.find(kp => kp.part === name);
        
        // Compare shoulder positions to determine if it's the same person
        const currentLeftShoulder = getKeypoint(currentKeypoints, 'leftShoulder');
        const currentRightShoulder = getKeypoint(currentKeypoints, 'rightShoulder');
        const lastLeftShoulder = getKeypoint(lastKeypoints, 'leftShoulder');
        const lastRightShoulder = getKeypoint(lastKeypoints, 'rightShoulder');
        
        if (currentLeftShoulder && currentRightShoulder && lastLeftShoulder && lastRightShoulder) {
            // Calculate center positions
            const currentCenter = {
                x: (currentLeftShoulder.position.x + currentRightShoulder.position.x) / 2,
                y: (currentLeftShoulder.position.y + currentRightShoulder.position.y) / 2
            };
            
            const lastCenter = {
                x: (lastLeftShoulder.position.x + lastRightShoulder.position.x) / 2,
                y: (lastLeftShoulder.position.y + lastRightShoulder.position.y) / 2
            };
            
            // Calculate distance moved
            const distance = Math.sqrt(
                Math.pow(currentCenter.x - lastCenter.x, 2) + 
                Math.pow(currentCenter.y - lastCenter.y, 2)
            );
            
            // If person moved too much, it might be a different person
            return distance < 50; // Threshold for "same person"
        }
        
        return true; // Default to same person if we can't compare
    }

    // Determine if this is the closest person to the camera (enhanced filtering)
    isClosestPersonToCamera(keypoints) {
        const getKeypoint = (name) => keypoints.find(kp => kp.part === name);
        
        // Higher confidence threshold to filter out distant people
        const averageConfidence = keypoints.reduce((sum, kp) => sum + kp.score, 0) / keypoints.length;
        if (averageConfidence < 0.4) {
            return false; // Increased from 0.25 to 0.4
        }
        
        // Get essential keypoints for validation
        const leftShoulder = getKeypoint('leftShoulder');
        const rightShoulder = getKeypoint('rightShoulder');
        const nose = getKeypoint('nose');
        const leftWrist = getKeypoint('leftWrist');
        const rightWrist = getKeypoint('rightWrist');
        
        // Higher minimum confidence for detection
        const minConfidence = 0.45; // Increased from 0.3 to 0.45
        
        // Primary check: both shoulders must be very clear
        if (leftShoulder && rightShoulder && 
            leftShoulder.score > minConfidence && rightShoulder.score > minConfidence) {
            
            // More flexible shoulder distance check for different user sizes
            const shoulderDistance = Math.abs(leftShoulder.position.x - rightShoulder.position.x);
            if (shoulderDistance < 25) { // Reduced back to 25 for shorter users
                return false; // Person too far away
            }
            
            // Enhanced body size validation using head-to-shoulder distance
            if (nose && nose.score > minConfidence) {
                const headToShoulderY = Math.abs(nose.position.y - 
                    ((leftShoulder.position.y + rightShoulder.position.y) / 2));
                if (headToShoulderY < 10) { // Reduced from 15 to 10 for shorter users
                    return false;
                }
            }
            
            // More flexible centering check for different heights
            const shoulderCenterX = (leftShoulder.position.x + rightShoulder.position.x) / 2;
            const videoWidth = 193;
            const centerRatio = shoulderCenterX / videoWidth;
            
            if (centerRatio < 0.2 || centerRatio > 0.8) { // More flexible than 0.25-0.75
                return false; // Must be reasonably centered
            }
            
            // Much more flexible Y position validation for different user heights
            const shoulderY = (leftShoulder.position.y + rightShoulder.position.y) / 2;
            if (shoulderY < 15 || shoulderY > 130) { // Expanded from 25-120 to 15-130 for height flexibility
                return false;
            }
            
            // Additional validation: check if hands are visible (closer person more likely to have hands detected)
            let handBonus = 0;
            if (leftWrist && leftWrist.score > 0.3) handBonus++;
            if (rightWrist && rightWrist.score > 0.3) handBonus++;
            
            // Require at least decent overall body detection
            const keyBodyParts = ['nose', 'leftShoulder', 'rightShoulder'];
            const detectedKeyParts = keyBodyParts.filter(part => {
                const kp = getKeypoint(part);
                return kp && kp.score > minConfidence;
            }).length;
            
            if (detectedKeyParts < 2) { // Need at least 2 key body parts clearly visible
                return false;
            }
            
            return true; // Valid close person detection
        }
        
        // More flexible fallback: only accept nose if it's confident and reasonably positioned
        if (nose && nose.score > 0.5) { // Keep high threshold for nose-only detection
            if (nose.position.x > 40 && nose.position.x < 153 && // More flexible center area for different heights
                nose.position.y > 15 && nose.position.y < 100) {  // More flexible position for shorter users
                return true;
            }
        }
        
        // Enhanced fallback: single shoulder with good confidence for shorter users
        const goodLeftShoulder = leftShoulder && leftShoulder.score > 0.35; // Reduced from 0.4
        const goodRightShoulder = rightShoulder && rightShoulder.score > 0.35; // Reduced from 0.4
        
        // If we have at least one good shoulder, allow it for shorter users
        if (goodLeftShoulder || goodRightShoulder) {
            const shoulder = goodLeftShoulder ? leftShoulder : rightShoulder;
            // Check if shoulder is in reasonable position for shorter users
            if (shoulder.position.x > 30 && shoulder.position.x < 163 && 
                shoulder.position.y > 10 && shoulder.position.y < 135) {
                return true;
            }
        }
        
        return false;
    }

    // Calculate a proximity score to determine the closest person
    calculateProximityScore(keypoints) {
        const getKeypoint = (name) => keypoints.find(kp => kp.part === name);
        
        let score = 0;
        
        // Get key body parts
        const leftShoulder = getKeypoint('leftShoulder');
        const rightShoulder = getKeypoint('rightShoulder');
        const nose = getKeypoint('nose');
        const leftWrist = getKeypoint('leftWrist');
        const rightWrist = getKeypoint('rightWrist');
        
        // Shoulder distance (wider = closer)
        if (leftShoulder && rightShoulder && 
            leftShoulder.score > 0.4 && rightShoulder.score > 0.4) {
            const shoulderDistance = Math.abs(leftShoulder.position.x - rightShoulder.position.x);
            score += shoulderDistance * 2; // Weight shoulder distance heavily
            
            // Bonus for being centered
            const shoulderCenterX = (leftShoulder.position.x + rightShoulder.position.x) / 2;
            const centerNess = 1 - Math.abs(shoulderCenterX - 96.5) / 96.5; // 96.5 is half of 193
            score += centerNess * 30;
        }
        
        // Head visibility bonus
        if (nose && nose.score > 0.4) {
            score += nose.score * 20;
        }
        
        // Hand visibility bonus (closer people more likely to have hands visible)
        if (leftWrist && leftWrist.score > 0.3) score += 10;
        if (rightWrist && rightWrist.score > 0.3) score += 10;
        
        // Overall confidence bonus
        const avgConfidence = keypoints.reduce((sum, kp) => sum + kp.score, 0) / keypoints.length;
        score += avgConfidence * 25;
        
        return score;
    }

    updateBodyPositions(keypoints) {
        const screenWidth = window.innerWidth;
        const videoWidth = 193; // Updated to new resolution
        
        // Find keypoints by name
        const getKeypoint = (name) => keypoints.find(kp => kp.part === name);
        
        const leftShoulder = getKeypoint('leftShoulder');
        const rightShoulder = getKeypoint('rightShoulder');
        const leftWrist = getKeypoint('leftWrist');
        const rightWrist = getKeypoint('rightWrist');

        // Primary tracking: shoulder center (most reliable)
        if (leftShoulder && rightShoulder && 
            leftShoulder.score > 0.27 && rightShoulder.score > 0.27) { // Reverted back from 0.24 to 0.27
            
            // Calculate center point between shoulders
            const shoulderCenterX = (leftShoulder.position.x + rightShoulder.position.x) / 2;
            
            // Convert to screen coordinates
            const rawPosition = (shoulderCenterX / videoWidth) * screenWidth;
            
            // Apply bounds with padding
            const clampedPosition = Math.max(150, Math.min(screenWidth - 150, rawPosition));
            
            // Apply smoothing
            const smoothedPosition = this.applySmoothMovement(clampedPosition);
            
            window.bodyX = smoothedPosition;
            window.shoulderX = window.bodyX;
            
            return; // Exit early if we have good shoulder tracking
        }
        
        // Fallback: Hand position (simplified)
        const bestWrist = (rightWrist && rightWrist.score > 0.27) ? rightWrist : 
                         (leftWrist && leftWrist.score > 0.27) ? leftWrist : null; // Reverted back from 0.24 to 0.27
        
        if (bestWrist && (!window.bodyX || window.bodyX === null)) {
            const handPosition = ((videoWidth - bestWrist.position.x) / videoWidth) * screenWidth;
            const clampedHandPosition = Math.max(50, Math.min(screenWidth - 50, handPosition));
            
            window.handX = clampedHandPosition;
            window.bodyX = clampedHandPosition; // Use as bodyX if no shoulder tracking
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

    // Optimized skeleton drawing (only when debug is enabled)
    drawSkeletonOptimized(keypoints) {
        // Skip drawing if debug video is not visible (major performance boost)
        if (!this.skeletonCtx || !this.skeletonCanvas || 
            this.skeletonCanvas.style.display === 'none') {
            return;
        }
        
        // Only draw every 5th frame to reduce CPU usage (increased from 3 for better performance)
        if (!this.drawCounter) this.drawCounter = 0;
        this.drawCounter++;
        if (this.drawCounter % 5 !== 0) {
            return;
        }
        
        // Clear previous frame efficiently
        this.skeletonCtx.clearRect(0, 0, this.skeletonCanvas.width, this.skeletonCanvas.height);
        
        // Scale factors to match canvas size to video resolution
        const scaleX = this.skeletonCanvas.width / 193; // Updated resolution
        const scaleY = this.skeletonCanvas.height / 145; // Updated resolution
        
        // Helper function to get keypoint by name
        const getKeypoint = (name) => keypoints.find(kp => kp.part === name);
        
        // Helper function to mirror X coordinate for natural view
        const mirrorX = (x) => this.skeletonCanvas.width - (x * scaleX);
        const scaleYCoord = (y) => y * scaleY;
        
        // Get all required points for triangle
        const leftShoulder = getKeypoint('leftShoulder');
        const rightShoulder = getKeypoint('rightShoulder');
        const nose = getKeypoint('nose');
        
        // Only draw if we have all points for a proper triangle with good confidence
        const hasGoodTriangle = leftShoulder && rightShoulder && nose &&
                               leftShoulder.score > 0.35 && rightShoulder.score > 0.35 && nose.score > 0.35;
        
        if (hasGoodTriangle) {
            // Draw triangle connections
            this.skeletonCtx.strokeStyle = '#00FF00';
            this.skeletonCtx.lineWidth = 2;
            this.skeletonCtx.beginPath();
            
            const leftX = mirrorX(leftShoulder.position.x);
            const leftY = scaleYCoord(leftShoulder.position.y);
            const rightX = mirrorX(rightShoulder.position.x);
            const rightY = scaleYCoord(rightShoulder.position.y);
            const noseX = mirrorX(nose.position.x);
            const noseY = scaleYCoord(nose.position.y);
            
            // Draw triangle: nose to left shoulder to right shoulder back to nose
            this.skeletonCtx.moveTo(noseX, noseY);
            this.skeletonCtx.lineTo(leftX, leftY);
            this.skeletonCtx.lineTo(rightX, rightY);
            this.skeletonCtx.lineTo(noseX, noseY);
            this.skeletonCtx.stroke();
            
            // Draw the three points of the triangle
            this.skeletonCtx.fillStyle = '#FF0000'; // Red for shoulders
            this.skeletonCtx.beginPath();
            this.skeletonCtx.arc(leftX, leftY, 4, 0, 2 * Math.PI);
            this.skeletonCtx.fill();
            
            this.skeletonCtx.beginPath();
            this.skeletonCtx.arc(rightX, rightY, 4, 0, 2 * Math.PI);
            this.skeletonCtx.fill();
            
            this.skeletonCtx.fillStyle = '#00FFFF'; // Cyan for nose
            this.skeletonCtx.beginPath();
            this.skeletonCtx.arc(noseX, noseY, 4, 0, 2 * Math.PI);
            this.skeletonCtx.fill();
        } else {
            // Fallback: just draw shoulder line if triangle is not complete
            if (leftShoulder && rightShoulder && leftShoulder.score > 0.27 && rightShoulder.score > 0.27) { // Reverted back from 0.24 to 0.27
                this.skeletonCtx.strokeStyle = '#FFAA00'; // Orange for incomplete detection
                this.skeletonCtx.lineWidth = 2;
                this.skeletonCtx.beginPath();
                
                const leftX = mirrorX(leftShoulder.position.x);
                const leftY = scaleYCoord(leftShoulder.position.y);
                const rightX = mirrorX(rightShoulder.position.x);
                const rightY = scaleYCoord(rightShoulder.position.y);
                
                this.skeletonCtx.moveTo(leftX, leftY);
                this.skeletonCtx.lineTo(rightX, rightY);
                this.skeletonCtx.stroke();
                
                // Draw shoulder points
                this.skeletonCtx.fillStyle = '#FFAA00';
                this.skeletonCtx.beginPath();
                this.skeletonCtx.arc(leftX, leftY, 3, 0, 2 * Math.PI);
                this.skeletonCtx.fill();
                
                this.skeletonCtx.beginPath();
                this.skeletonCtx.arc(rightX, rightY, 3, 0, 2 * Math.PI);
                this.skeletonCtx.fill();
            }
        }
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
