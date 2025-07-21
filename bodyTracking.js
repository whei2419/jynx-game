// Body Tracking using MediaPipe
// This file handles body pose detection and sets global variables for game control

class BodyTracker {
    constructor() {
        this.camera = null;
        this.pose = null;
        this.isInitialized = false;
        this.videoElement = null;
        this.canvasElement = null;
        this.canvasCtx = null;
        
        // Initialize global variables
        window.bodyX = null;
        window.shoulderX = null;
        window.hipX = null;
        window.handX = null;
    }

    async initialize() {
        try {
            // Create video element for camera feed
            this.videoElement = document.createElement('video');
            this.videoElement.style.display = 'none'; // Hide the video element
            document.body.appendChild(this.videoElement);

            // Create canvas for pose visualization (optional)
            this.canvasElement = document.createElement('canvas');
            this.canvasElement.id = 'poseCanvas';
            this.canvasElement.style.position = 'absolute';
            this.canvasElement.style.top = '0';
            this.canvasElement.style.left = '0';
            this.canvasElement.style.zIndex = '1000';
            this.canvasElement.style.pointerEvents = 'none';
            this.canvasElement.width = window.innerWidth;
            this.canvasElement.height = window.innerHeight;
            this.canvasElement.style.display = 'none'; // Hide by default
            document.body.appendChild(this.canvasElement);
            this.canvasCtx = this.canvasElement.getContext('2d');

            // Initialize MediaPipe Pose
            if (typeof Pose !== 'undefined') {
                this.pose = new Pose({
                    locateFile: (file) => {
                        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
                    }
                });

                this.pose.setOptions({
                    modelComplexity: 1,
                    smoothLandmarks: true,
                    enableSegmentation: false,
                    smoothSegmentation: false,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });

                this.pose.onResults(this.onResults.bind(this));
            }

            // Initialize camera
            this.camera = new Camera(this.videoElement, {
                onFrame: async () => {
                    if (this.pose) {
                        await this.pose.send({ image: this.videoElement });
                    }
                },
                width: 640,
                height: 480
            });

            await this.camera.start();
            this.isInitialized = true;
            console.log('Body tracking initialized successfully');

        } catch (error) {
            console.error('Failed to initialize body tracking:', error);
            this.isInitialized = false;
        }
    }

    onResults(results) {
        if (results.poseLandmarks && results.poseLandmarks.length > 0) {
            const landmarks = results.poseLandmarks;
            const width = window.innerWidth;
            
            // Calculate different body part positions
            // MediaPipe pose landmarks indices:
            // 11: Left shoulder, 12: Right shoulder
            // 23: Left hip, 24: Right hip
            // 15: Left wrist, 16: Right wrist
            
            // Body center (average of shoulders and hips)
            const leftShoulder = landmarks[11];
            const rightShoulder = landmarks[12];
            const leftHip = landmarks[23];
            const rightHip = landmarks[24];
            
            if (leftShoulder && rightShoulder && leftHip && rightHip) {
                const bodyCenter = {
                    x: (leftShoulder.x + rightShoulder.x + leftHip.x + rightHip.x) / 4,
                    y: (leftShoulder.y + rightShoulder.y + leftHip.y + rightHip.y) / 4
                };
                window.bodyX = bodyCenter.x * width;
            }
            
            // Shoulder center
            if (leftShoulder && rightShoulder) {
                const shoulderCenter = {
                    x: (leftShoulder.x + rightShoulder.x) / 2
                };
                window.shoulderX = shoulderCenter.x * width;
            }
            
            // Hip center
            if (leftHip && rightHip) {
                const hipCenter = {
                    x: (leftHip.x + rightHip.x) / 2
                };
                window.hipX = hipCenter.x * width;
            }
            
            // Hand position (use right hand by default, fallback to left)
            const rightWrist = landmarks[16];
            const leftWrist = landmarks[15];
            
            if (rightWrist && rightWrist.visibility > 0.5) {
                window.handX = rightWrist.x * width;
            } else if (leftWrist && leftWrist.visibility > 0.5) {
                window.handX = leftWrist.x * width;
            }
        }
        
        // Optional: Draw pose on canvas for debugging
        if (this.canvasElement.style.display !== 'none') {
            this.drawPose(results);
        }
    }

    drawPose(results) {
        this.canvasCtx.save();
        this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
        
        if (results.poseLandmarks) {
            // Draw pose connections
            drawConnectors(this.canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, 
                          { color: '#00FF00', lineWidth: 4 });
            // Draw landmarks
            drawLandmarks(this.canvasCtx, results.poseLandmarks,
                         { color: '#FF0000', lineWidth: 2 });
        }
        this.canvasCtx.restore();
    }

    toggleVisualization() {
        if (this.canvasElement) {
            this.canvasElement.style.display = 
                this.canvasElement.style.display === 'none' ? 'block' : 'none';
        }
    }

    stop() {
        if (this.camera) {
            this.camera.stop();
        }
        if (this.videoElement) {
            this.videoElement.remove();
        }
        if (this.canvasElement) {
            this.canvasElement.remove();
        }
    }
}

// Global body tracker instance
window.bodyTracker = null;

// Initialize body tracking when page loads
window.addEventListener('load', async () => {
    // Check if MediaPipe is loaded
    if (typeof Pose !== 'undefined' && typeof Camera !== 'undefined') {
        window.bodyTracker = new BodyTracker();
        await window.bodyTracker.initialize();
    } else {
        console.warn('MediaPipe not loaded. Body tracking disabled.');
    }
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (window.bodyTracker) {
        window.bodyTracker.stop();
    }
});
