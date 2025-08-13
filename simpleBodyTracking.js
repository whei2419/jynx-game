// Shoulder-to-Head Body Tracking using TensorFlow PoseNet
// This is ONLY for the game page - other pages use hand tracking
// 
// UPDATED: Now focuses specifically on shoulder-to-head movement for bowl control
// - Primary tracking uses weighted combination of shoulder center (60%) and head position (40%)
// - OPTIMIZED FOR WIDE BODY MOVEMENTS: Reduced confidence thresholds and increased movement tolerance
// - Provides more natural and intuitive control by tracking upper torso movement
// - Falls back to shoulder-only or head-only tracking when needed
// - Maintains hand tracking as final fallback option
// - Enhanced smoothing that adapts to rapid movement speeds

class SimpleBodyTracker {
    constructor() {
        this.net = null;
        this.video = null;
        this.isInitialized = false;
        
        // Initialize global variables for SHOULDER-TO-HEAD tracking (optimized for bowl control)
        window.bodyX = null;
        window.shoulderX = null;
        window.headX = null;
        window.shoulderToHeadX = null; // Main tracking variable for bowl movement
        window.handX = null; // Keep as fallback
        
        // Add smoothing variables for better movement (optimized for wide movements)
        this.smoothingBuffer = [];
        this.bufferSize = 2; // Keep small for responsiveness to wide movements
        this.velocitySmoothing = 0.15; // Increased from 0.11 for better responsiveness to wide movements
        this.lastVelocity = 0;
        
        // Person persistence tracking - reduced for better responsiveness to wide movements
        this.consecutiveDetections = 0;
        this.minConsecutiveFrames = 1; // Reduced from 2 to 1 for faster response to wide movements
        this.lastValidPose = null;
        this.noDetectionFrames = 0;
        this.maxNoDetectionFrames = 10; // Reduced from 15 to 10 for faster recovery
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
                        console.log('Shoulder-to-head tracking active:', {
                            shoulderToHeadX: window.shoulderToHeadX?.toFixed(0),
                            headX: window.headX?.toFixed(0),
                            shoulderX: window.shoulderX?.toFixed(0),
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
            window.headX = null;
            window.shoulderToHeadX = null;
            window.handX = null;
            this.lastValidPose = null;
            
            if (this.noDetectionFrames === this.maxNoDetectionFrames) { // Log once when clearing
                console.log('Body tracking cleared due to prolonged detection failure');
            }
        }
    }

    // Separate method to schedule next detection with adaptive timing (optimized for wide movements)
    scheduleNextDetection() {
        // More aggressive frame rates for better wide movement tracking
        let delay = 35; // Increased from 50 to ~28fps
        
        if (this.noDetectionFrames > 5) {
            // Faster recovery when no person detected
            delay = 60; // Reduced from 80 to ~16fps
        } else if (window.bodyX !== null) {
            // Much faster when actively tracking for wide movements
            delay = 25; // Reduced from 40 to ~40fps
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
            
            // Allow for much larger movements to support wide body movement tracking
            // Increased threshold significantly to handle side-to-side movements
            return distance < 120; // Increased from 50 to 120 for wide body movements
        }
        
        return true; // Default to same person if we can't compare
    }

    // Determine if this is the closest person to the camera (enhanced for shoulder-to-head tracking)
    isClosestPersonToCamera(keypoints) {
        const getKeypoint = (name) => keypoints.find(kp => kp.part === name);
        
        // More permissive confidence threshold to maintain tracking during wide movements
        const averageConfidence = keypoints.reduce((sum, kp) => sum + kp.score, 0) / keypoints.length;
        if (averageConfidence < 0.3) { // Reduced from 0.4 to 0.3 for better wide movement tracking
            return false;
        }
        
        // Get essential keypoints for shoulder-to-head tracking
        const leftShoulder = getKeypoint('leftShoulder');
        const rightShoulder = getKeypoint('rightShoulder');
        const nose = getKeypoint('nose');
        const leftEye = getKeypoint('leftEye');
        const rightEye = getKeypoint('rightEye');
        const leftWrist = getKeypoint('leftWrist');
        const rightWrist = getKeypoint('rightWrist');
        
        // Higher minimum confidence for detection
        const minConfidence = 0.35; // Reduced from 0.45 to 0.35 for better tracking during wide movements
        
        // Primary check: both shoulders must be very clear (essential for shoulder-to-head tracking)
        if (leftShoulder && rightShoulder && 
            leftShoulder.score > minConfidence && rightShoulder.score > minConfidence) {
            
            // More flexible shoulder distance check for different user sizes
            const shoulderDistance = Math.abs(leftShoulder.position.x - rightShoulder.position.x);
            if (shoulderDistance < 20) { // Reduced from 25 to 20 for closer/smaller users
                return false; // Person too far away
            }
            
            // Enhanced head detection validation for shoulder-to-head tracking
            let hasGoodHead = false;
            if (nose && nose.score > minConfidence) {
                const headToShoulderY = Math.abs(nose.position.y - 
                    ((leftShoulder.position.y + rightShoulder.position.y) / 2));
                if (headToShoulderY >= 8) { // Reduced from 10 to 8 for better head detection
                    hasGoodHead = true;
                }
            } else if (leftEye && rightEye && leftEye.score > 0.25 && rightEye.score > 0.25) {
                // Alternative: use eyes if nose not available
                const eyeCenterY = (leftEye.position.y + rightEye.position.y) / 2;
                const headToShoulderY = Math.abs(eyeCenterY - 
                    ((leftShoulder.position.y + rightShoulder.position.y) / 2));
                if (headToShoulderY >= 6) { // Reduced from 8 to 6 for better eye detection
                    hasGoodHead = true;
                }
            }
            
            // MUCH more flexible centering check to allow wide body movements
            const shoulderCenterX = (leftShoulder.position.x + rightShoulder.position.x) / 2;
            const videoWidth = 193;
            const centerRatio = shoulderCenterX / videoWidth;
            
            // Allow the person to move across almost the entire frame width
            if (centerRatio < 0.05 || centerRatio > 0.95) { // Much more permissive (was 0.2-0.8)
                return false; // Only reject if they're completely off-screen
            }
            
            // Much more flexible Y position validation for different user heights
            const shoulderY = (leftShoulder.position.y + rightShoulder.position.y) / 2;
            if (shoulderY < 10 || shoulderY > 140) { // Even more flexible (was 15-130)
                return false;
            }
            
            // Bonus for having good head detection (important for shoulder-to-head tracking)
            if (hasGoodHead) {
                return true; // Excellent detection for shoulder-to-head tracking
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
        
        // Much more flexible fallback: accept nose across wider range for wide body movements
        if (nose && nose.score > 0.4) { // Reduced from 0.5 for better tracking during wide movements
            if (nose.position.x > 10 && nose.position.x < 183 && // Much wider range (was 40-153)
                nose.position.y > 10 && nose.position.y < 110) {  // More flexible Y range
                return true;
            }
        }
        
        // Enhanced fallback: single shoulder with good confidence - very permissive for wide movements
        const goodLeftShoulder = leftShoulder && leftShoulder.score > 0.25; // Further reduced from 0.35
        const goodRightShoulder = rightShoulder && rightShoulder.score > 0.25; // Further reduced from 0.35
        
        // If we have at least one good shoulder, allow it across much wider range
        if (goodLeftShoulder || goodRightShoulder) {
            const shoulder = goodLeftShoulder ? leftShoulder : rightShoulder;
            // Much more permissive position check for wide body movements
            if (shoulder.position.x > 5 && shoulder.position.x < 188 && // Much wider X range (was 30-163)
                shoulder.position.y > 5 && shoulder.position.y < 140) { // Wider Y range (was 10-135)
                return true;
            }
        }
        
        return false;
    }

    // Calculate a proximity score to determine the closest person (optimized for shoulder-to-head tracking)
    calculateProximityScore(keypoints) {
        const getKeypoint = (name) => keypoints.find(kp => kp.part === name);
        
        let score = 0;
        
        // Get key body parts for shoulder-to-head tracking
        const leftShoulder = getKeypoint('leftShoulder');
        const rightShoulder = getKeypoint('rightShoulder');
        const nose = getKeypoint('nose');
        const leftEye = getKeypoint('leftEye');
        const rightEye = getKeypoint('rightEye');
        const leftWrist = getKeypoint('leftWrist');
        const rightWrist = getKeypoint('rightWrist');
        
        // Shoulder distance (wider = closer) - heavily weighted for shoulder-to-head tracking
        if (leftShoulder && rightShoulder && 
            leftShoulder.score > 0.4 && rightShoulder.score > 0.4) {
            const shoulderDistance = Math.abs(leftShoulder.position.x - rightShoulder.position.x);
            score += shoulderDistance * 3; // Increased weight for shoulders
            
            // Bonus for being centered
            const shoulderCenterX = (leftShoulder.position.x + rightShoulder.position.x) / 2;
            const centerNess = 1 - Math.abs(shoulderCenterX - 96.5) / 96.5; // 96.5 is half of 193
            score += centerNess * 35; // Increased centering bonus
        }
        
        // Head visibility bonus - heavily weighted for shoulder-to-head tracking
        if (nose && nose.score > 0.4) {
            score += nose.score * 30; // Increased from 20 to 30
            
            // Additional bonus if nose is well-positioned relative to shoulders
            if (leftShoulder && rightShoulder) {
                const shoulderCenterY = (leftShoulder.position.y + rightShoulder.position.y) / 2;
                const headToShoulderDistance = Math.abs(nose.position.y - shoulderCenterY);
                if (headToShoulderDistance > 10 && headToShoulderDistance < 50) {
                    score += 20; // Good head-to-shoulder positioning
                }
            }
        } else if (leftEye && rightEye && leftEye.score > 0.3 && rightEye.score > 0.3) {
            // Alternative head tracking using eyes
            const eyeScore = (leftEye.score + rightEye.score) / 2;
            score += eyeScore * 25; // Good alternative to nose
        }
        
        // Hand visibility bonus (closer people more likely to have hands visible)
        if (leftWrist && leftWrist.score > 0.3) score += 10;
        if (rightWrist && rightWrist.score > 0.3) score += 10;
        
        // Overall confidence bonus
        const avgConfidence = keypoints.reduce((sum, kp) => sum + kp.score, 0) / keypoints.length;
        score += avgConfidence * 25;
        
        // Special bonus for having both good shoulders AND good head (ideal for shoulder-to-head tracking)
        const hasGoodShoulders = leftShoulder && rightShoulder && 
                                leftShoulder.score > 0.4 && rightShoulder.score > 0.4;
        const hasGoodHead = (nose && nose.score > 0.4) || 
                           (leftEye && rightEye && leftEye.score > 0.3 && rightEye.score > 0.3);
        
        if (hasGoodShoulders && hasGoodHead) {
            score += 50; // Big bonus for ideal shoulder-to-head tracking setup
        }
        
        return score;
    }

    updateBodyPositions(keypoints) {
        const screenWidth = window.innerWidth;
        const videoWidth = 193; // Updated to new resolution
        
        // Find keypoints by name
        const getKeypoint = (name) => keypoints.find(kp => kp.part === name);
        
        const leftShoulder = getKeypoint('leftShoulder');
        const rightShoulder = getKeypoint('rightShoulder');
        const nose = getKeypoint('nose');
        const leftEye = getKeypoint('leftEye');
        const rightEye = getKeypoint('rightEye');
        const leftWrist = getKeypoint('leftWrist');
        const rightWrist = getKeypoint('rightWrist');

        // Primary tracking: Shoulder-to-head center calculation
        let shoulderCenterX = null;
        let headCenterX = null;
        let shoulderToHeadX = null;

        // Calculate shoulder center position (more permissive for wide movements)
        if (leftShoulder && rightShoulder && 
            leftShoulder.score > 0.22 && rightShoulder.score > 0.22) { // Reduced from 0.27
            shoulderCenterX = (leftShoulder.position.x + rightShoulder.position.x) / 2;
        }

        // Calculate head center position (more permissive for wide movements)
        if (nose && nose.score > 0.25) { // Reduced from 0.3
            headCenterX = nose.position.x;
        } else if (leftEye && rightEye && leftEye.score > 0.20 && rightEye.score > 0.20) { // Reduced from 0.25
            headCenterX = (leftEye.position.x + rightEye.position.x) / 2;
        } else if (leftEye && leftEye.score > 0.25) { // Reduced from 0.3
            headCenterX = leftEye.position.x;
        } else if (rightEye && rightEye.score > 0.25) { // Reduced from 0.3
            headCenterX = rightEye.position.x;
        }

        // Calculate shoulder-to-head center for bowl control
        if (shoulderCenterX !== null && headCenterX !== null) {
            // Weight the calculation: 60% shoulder, 40% head for stable movement
            shoulderToHeadX = (shoulderCenterX * 0.6) + (headCenterX * 0.4);
            
            // Convert to screen coordinates
            const rawPosition = (shoulderToHeadX / videoWidth) * screenWidth;
            
            // Much more permissive bounds to allow wide body movements
            const clampedPosition = Math.max(50, Math.min(screenWidth - 50, rawPosition)); // Reduced from 150 to 50
            
            // Apply smoothing
            const smoothedPosition = this.applySmoothMovement(clampedPosition);
            
            // Set all tracking variables
            window.shoulderToHeadX = smoothedPosition;
            window.bodyX = smoothedPosition; // Primary control variable
            window.shoulderX = (shoulderCenterX / videoWidth) * screenWidth;
            window.headX = (headCenterX / videoWidth) * screenWidth;
            
            return; // Exit early if we have good shoulder-to-head tracking
        }
        
        // Fallback 1: Shoulder only tracking
        if (shoulderCenterX !== null) {
            const rawPosition = (shoulderCenterX / videoWidth) * screenWidth;
            const clampedPosition = Math.max(50, Math.min(screenWidth - 50, rawPosition)); // More permissive
            const smoothedPosition = this.applySmoothMovement(clampedPosition);
            
            window.shoulderX = smoothedPosition;
            window.bodyX = smoothedPosition;
            
            return;
        }
        
        // Fallback 2: Head only tracking
        if (headCenterX !== null) {
            const rawPosition = (headCenterX / videoWidth) * screenWidth;
            const clampedPosition = Math.max(50, Math.min(screenWidth - 50, rawPosition)); // More permissive
            const smoothedPosition = this.applySmoothMovement(clampedPosition);
            
            window.headX = smoothedPosition;
            window.bodyX = smoothedPosition;
            
            return;
        }
        
        // Fallback 3: Hand position (legacy support) - more permissive for wide movements
        const bestWrist = (rightWrist && rightWrist.score > 0.22) ? rightWrist : 
                         (leftWrist && leftWrist.score > 0.22) ? leftWrist : null; // Reduced from 0.27
        
        if (bestWrist && (!window.bodyX || window.bodyX === null)) {
            const handPosition = ((videoWidth - bestWrist.position.x) / videoWidth) * screenWidth;
            const clampedHandPosition = Math.max(25, Math.min(screenWidth - 25, handPosition)); // More permissive (was 50)
            
            window.handX = clampedHandPosition;
            window.bodyX = clampedHandPosition; // Use as bodyX if no shoulder/head tracking
        }
    }

    // Advanced smoothing for smoother bowl movement (optimized for wide body movements)
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
        
        // Detect rapid movements and reduce smoothing for better responsiveness
        const rapidMovementThreshold = 50; // pixels per frame
        const isRapidMovement = Math.abs(currentVelocity) > rapidMovementThreshold;
        
        // Adjust smoothing based on movement speed
        const adaptiveSmoothing = isRapidMovement ? 
            this.velocitySmoothing * 1.5 : // More aggressive for rapid movements
            this.velocitySmoothing;
        
        // Smooth the velocity to prevent jerky movements
        const smoothedVelocity = this.lastVelocity * (1 - adaptiveSmoothing) + 
                                currentVelocity * adaptiveSmoothing;
        
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
            
            // Calculate and draw the shoulder-to-head control center
            const shoulderCenterX = (leftX + rightX) / 2;
            const shoulderCenterY = (leftY + rightY) / 2;
            const controlCenterX = (shoulderCenterX * 0.6) + (noseX * 0.4);
            const controlCenterY = (shoulderCenterY * 0.6) + (noseY * 0.4);
            
            // Draw control center as a larger yellow circle
            this.skeletonCtx.fillStyle = '#FFFF00'; // Yellow for control center
            this.skeletonCtx.beginPath();
            this.skeletonCtx.arc(controlCenterX, controlCenterY, 6, 0, 2 * Math.PI);
            this.skeletonCtx.fill();
            
            // Draw lines from shoulders to control center
            this.skeletonCtx.strokeStyle = '#FFFF00';
            this.skeletonCtx.lineWidth = 1;
            this.skeletonCtx.setLineDash([3, 3]); // Dashed line
            this.skeletonCtx.beginPath();
            this.skeletonCtx.moveTo(shoulderCenterX, shoulderCenterY);
            this.skeletonCtx.lineTo(controlCenterX, controlCenterY);
            this.skeletonCtx.stroke();
            this.skeletonCtx.setLineDash([]); // Reset to solid line
            
            // Draw the three points of the triangle
            this.skeletonCtx.fillStyle = '#FF0000'; // Red for shoulders
            this.skeletonCtx.beginPath();
            this.skeletonCtx.arc(leftX, leftY, 4, 0, 2 * Math.PI);
            this.skeletonCtx.fill();
            
            this.skeletonCtx.beginPath();
            this.skeletonCtx.arc(rightX, rightY, 4, 0, 2 * Math.PI);
            this.skeletonCtx.fill();
            
            this.skeletonCtx.fillStyle = '#00FFFF'; // Cyan for nose/head
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
