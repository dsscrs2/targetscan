/* ========================================
   AirScan — Camera Module
   Browser camera capture & file upload
   ======================================== */

const Camera = {
    stream: null,
    videoElement: null,

    /**
     * Initialize camera elements
     */
    init() {
        this.videoElement = document.getElementById('camera-video');
        this.captureBtn = document.getElementById('camera-capture-btn');
        this.closeBtn = document.getElementById('camera-close-btn');
        this.overlay = document.getElementById('camera-overlay');

        if (this.captureBtn) {
            this.captureBtn.addEventListener('click', () => this.capturePhoto());
        }
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.closeCamera());
        }
    },

    /**
     * Open browser camera (prefer rear camera on mobile)
     */
    async openCamera() {
        try {
            const constraints = {
                video: {
                    facingMode: { ideal: 'environment' }, // rear camera
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.videoElement.srcObject = this.stream;
            await this.videoElement.play();
            this.overlay.classList.add('active');

        } catch (err) {
            console.error('Camera error:', err);

            if (err.name === 'NotAllowedError') {
                App.showToast('Camera access denied. Please allow camera permissions.', 'error');
            } else if (err.name === 'NotFoundError') {
                App.showToast('No camera found on this device.', 'error');
            } else {
                App.showToast('Could not access camera: ' + err.message, 'error');
            }
            return false;
        }
        return true;
    },

    /**
     * Capture current video frame as image
     */
    capturePhoto() {
        if (!this.videoElement || !this.stream) return;

        const canvas = document.createElement('canvas');
        canvas.width = this.videoElement.videoWidth;
        canvas.height = this.videoElement.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(this.videoElement, 0, 0);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        this.closeCamera();

        // Forward to target module
        if (typeof App !== 'undefined') {
            App.onImageCaptured(dataUrl);
        }
    },

    /**
     * Close camera and release stream
     */
    closeCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.videoElement) {
            this.videoElement.srcObject = null;
        }
        this.overlay.classList.remove('active');
    },

    /**
     * Handle file input change event
     * @param {Event} event - input[type=file] change event
     * @param {Function} callback - called with dataUrl
     */
    handleFileUpload(event, callback) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            App.showToast('Please select an image file.', 'error');
            return;
        }

        // Check file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            App.showToast('Image is too large. Maximum size is 10MB.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            if (callback) callback(dataUrl);
        };
        reader.onerror = () => {
            App.showToast('Failed to read image file.', 'error');
        };
        reader.readAsDataURL(file);
    }
};
