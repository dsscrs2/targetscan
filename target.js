/* ========================================
   AirScan — Target Canvas Module
   Drawing, shot placement, visualization
   ======================================== */

const Target = {
    canvas: null,
    ctx: null,
    shots: [],
    targetType: 'air_rifle',
    canvasSize: 0,
    center: { x: 0, y: 0 },
    targetRadius: 0,
    backgroundImage: null,
    showBackground: true,
    backgroundOpacity: 0.3,
    selectedShot: -1,
    isDragging: false,
    dragShotIndex: -1,

    // Zoom & pan
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    lastPinchDist: 0,
    lastTouchX: 0,
    lastTouchY: 0,
    isPanning: false,

    // Calibration
    calibrationMode: false,
    calibrationPoints: [],
    calibrationScale: 1, // px per mm

    // Colors for shot markers
    SHOT_COLORS: {
        10: '#00ff88',
        9: '#66ff88',
        8: '#ffaa00',
        7: '#ff8844',
        6: '#ff6644',
        5: '#ff4466',
        4: '#ff2244',
        3: '#cc1133',
        2: '#aa0022',
        1: '#880011',
        0: '#666666'
    },

    /**
     * Initialize the target canvas
     */
    init(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        this.bindEvents();
        this.draw();
    },

    /**
     * Resize canvas to container
     */
    resize() {
        const container = this.canvas.parentElement;
        const size = Math.min(container.clientWidth, container.clientHeight);
        this.canvasSize = size;

        // Set actual canvas resolution (2x for retina)
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = size * dpr;
        this.canvas.height = size * dpr;
        this.canvas.style.width = size + 'px';
        this.canvas.style.height = size + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        this.center = { x: size / 2, y: size / 2 };
        this.targetRadius = size * 0.42; // 84% of canvas used for target
        this.draw();
    },

    /**
     * Bind touch and mouse events
     */
    bindEvents() {
        // Mouse events
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));

        // Touch events
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));

        // Resize
        window.addEventListener('resize', () => {
            clearTimeout(this._resizeTimer);
            this._resizeTimer = setTimeout(() => this.resize(), 100);
        });
    },

    /**
     * Main draw function
     */
    draw() {
        const ctx = this.ctx;
        const size = this.canvasSize;

        ctx.save();

        // Clear
        ctx.fillStyle = '#0a0e17';
        ctx.fillRect(0, 0, size, size);

        // Apply zoom & pan
        ctx.translate(this.center.x + this.offsetX, this.center.y + this.offsetY);
        ctx.scale(this.scale, this.scale);
        ctx.translate(-this.center.x, -this.center.y);

        // Draw background image if present
        if (this.backgroundImage && this.showBackground) {
            ctx.globalAlpha = this.backgroundOpacity;
            this._drawBackgroundImage(ctx);
            ctx.globalAlpha = 1;
        }

        // Draw target rings
        this._drawRings(ctx);

        // Draw shots
        this._drawShots(ctx);

        // Draw MPI & group center
        if (this.shots.length >= 2) {
            this._drawMPI(ctx);
        }

        ctx.restore();

        // Draw score bar at top (outside zoom)
        this._drawScoreBar(ctx);
    },

    /**
     * Draw concentric scoring rings
     */
    _drawRings(ctx) {
        const config = Scoring.getTargetConfig(this.targetType);
        const ringRadii = Scoring.getRingRadiiPx(this.targetType, this.targetRadius);
        const cx = this.center.x;
        const cy = this.center.y;

        // Outer background circle
        ctx.fillStyle = '#f5f0e8';
        ctx.beginPath();
        ctx.arc(cx, cy, this.targetRadius + 8, 0, Math.PI * 2);
        ctx.fill();

        // Draw rings from outer to inner
        for (let i = 0; i < ringRadii.length; i++) {
            const radius = ringRadii[i];
            const ringNumber = i + 1;

            // Ring fill — inner rings get darker
            if (ringNumber >= 7) {
                ctx.fillStyle = '#1a1a1a';
            } else if (ringNumber >= 4) {
                ctx.fillStyle = '#f5f0e8';
            } else {
                ctx.fillStyle = '#f5f0e8';
            }

            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fill();

            // Ring border
            ctx.strokeStyle = ringNumber >= 7 ? '#444' : '#999';
            ctx.lineWidth = ringNumber === 7 ? 1.5 : 0.8;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.stroke();

            // Ring number labels (on ring 1-9)
            if (ringNumber <= 9) {
                const labelRadius = (i === 0)
                    ? radius - 10
                    : (radius + ringRadii[i - 1]) / 2;

                ctx.font = `${Math.max(8, this.targetRadius * 0.04)}px 'Inter', sans-serif`;
                ctx.fillStyle = ringNumber >= 7 ? '#888' : '#999';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                // Draw at 4 positions (top, bottom, left, right)
                const positions = [
                    { x: cx, y: cy - labelRadius },
                    { x: cx, y: cy + labelRadius },
                ];
                positions.forEach(pos => {
                    ctx.fillText(ringNumber.toString(), pos.x, pos.y);
                });
            }
        }

        // Inner 10 (X ring / center dot)
        const innerTenRadius = (config.innerTenDiameter / config.ringDiameters[0]) * this.targetRadius;
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(innerTenRadius, 2), 0, Math.PI * 2);
        ctx.fill();

        // Center dot
        ctx.fillStyle = '#00ff88';
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(1.5, innerTenRadius * 0.3), 0, Math.PI * 2);
        ctx.fill();

        // Crosshair lines
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.15)';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(cx - this.targetRadius - 5, cy);
        ctx.lineTo(cx + this.targetRadius + 5, cy);
        ctx.moveTo(cx, cy - this.targetRadius - 5);
        ctx.lineTo(cx, cy + this.targetRadius + 5);
        ctx.stroke();
        ctx.setLineDash([]);
    },

    /**
     * Draw all shot markers
     */
    _drawShots(ctx) {
        const cx = this.center.x;
        const cy = this.center.y;

        this.shots.forEach((shot, i) => {
            // Convert mm to px
            const pos = Scoring.mmToPx(shot.x, shot.y, cx, cy, this.targetType, this.targetRadius);
            const score = shot.score !== undefined ? shot.score : '?';
            const color = this.SHOT_COLORS[score] || '#999';

            // Shot hole
            const pelletRadiusPx = this._mmToPxLength(Scoring.getTargetConfig(this.targetType).pelletDiameter / 2);
            const markerRadius = Math.max(pelletRadiusPx, 6);

            // Shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.beginPath();
            ctx.arc(pos.x + 1, pos.y + 1, markerRadius + 1, 0, Math.PI * 2);
            ctx.fill();

            // Pellet hole (dark)
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, markerRadius, 0, Math.PI * 2);
            ctx.fill();

            // Colored ring around shot
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, markerRadius + 2, 0, Math.PI * 2);
            ctx.stroke();

            // Glow effect
            ctx.strokeStyle = color + '40';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, markerRadius + 5, 0, Math.PI * 2);
            ctx.stroke();

            // Shot number label
            const labelOffset = markerRadius + 10;
            ctx.font = `bold ${Math.max(9, 11)}px 'Inter', sans-serif`;
            ctx.fillStyle = color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${i + 1}`, pos.x, pos.y - labelOffset);

            // Highlight selected shot
            if (this.selectedShot === i) {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, markerRadius + 8, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        });
    },

    /**
     * Draw MPI and group center indicator
     */
    _drawMPI(ctx) {
        if (this.shots.length < 2) return;

        const mpi = Analytics.meanPointOfImpact(this.shots);
        const pos = Scoring.mmToPx(mpi.x, mpi.y, this.center.x, this.center.y, this.targetType, this.targetRadius);

        // MPI crosshair
        const size = 8;
        ctx.strokeStyle = '#ff4466';
        ctx.lineWidth = 1.5;

        // Cross
        ctx.beginPath();
        ctx.moveTo(pos.x - size, pos.y);
        ctx.lineTo(pos.x + size, pos.y);
        ctx.moveTo(pos.x, pos.y - size);
        ctx.lineTo(pos.x, pos.y + size);
        ctx.stroke();

        // Diamond around MPI
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y - size);
        ctx.lineTo(pos.x + size, pos.y);
        ctx.lineTo(pos.x, pos.y + size);
        ctx.lineTo(pos.x - size, pos.y);
        ctx.closePath();
        ctx.strokeStyle = 'rgba(255, 68, 102, 0.5)';
        ctx.stroke();

        // MPI label
        ctx.font = '9px Inter, sans-serif';
        ctx.fillStyle = '#ff4466';
        ctx.textAlign = 'left';
        ctx.fillText('MPI', pos.x + size + 4, pos.y + 3);

        // Mean radius circle
        if (this.shots.length >= 3) {
            const mr = Analytics.meanRadius(this.shots, mpi);
            const mrPx = this._mmToPxLength(mr);
            ctx.strokeStyle = 'rgba(255, 68, 102, 0.2)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, mrPx, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    },

    /**
     * Draw background image
     */
    _drawBackgroundImage(ctx) {
        if (!this.backgroundImage) return;
        const img = this.backgroundImage;
        const size = this.canvasSize;

        // Fit image to canvas
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = (size - w) / 2;
        const y = (size - h) / 2;
        ctx.drawImage(img, x, y, w, h);
    },

    /**
     * Draw score summary bar at top
     */
    _drawScoreBar(ctx) {
        if (this.shots.length === 0) return;

        const size = this.canvasSize;
        const barHeight = 28;

        // Background
        ctx.fillStyle = 'rgba(6, 10, 19, 0.85)';
        ctx.fillRect(0, 0, size, barHeight);

        // Border
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.2)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, barHeight);
        ctx.lineTo(size, barHeight);
        ctx.stroke();

        // Total score
        const scoreResult = Scoring.calculateTotalScore([...this.shots], this.targetType);

        ctx.font = 'bold 13px Orbitron, sans-serif';
        ctx.fillStyle = '#00ff88';
        ctx.textAlign = 'left';
        ctx.fillText(`${scoreResult.total}/${scoreResult.maxPossible}`, 10, 18);

        // Shot count
        ctx.font = '10px Inter, sans-serif';
        ctx.fillStyle = '#8899aa';
        ctx.textAlign = 'right';
        ctx.fillText(`${this.shots.length} shots`, size - 10, 18);
    },

    // --- Event Handlers ---

    handleClick(e) {
        if (this.calibrationMode) {
            this._handleCalibrationClick(e);
            return;
        }

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Adjust for zoom & pan
        const adjustedX = (x - this.center.x - this.offsetX) / this.scale + this.center.x;
        const adjustedY = (y - this.center.y - this.offsetY) / this.scale + this.center.y;

        // Check if clicking on existing shot
        const clickedShot = this._findShotAt(adjustedX, adjustedY);
        if (clickedShot >= 0) {
            this.selectedShot = this.selectedShot === clickedShot ? -1 : clickedShot;
            this.draw();
            App.onShotSelected(this.selectedShot);
            return;
        }

        // Place new shot
        const mm = Scoring.pxToMm(adjustedX, adjustedY, this.center.x, this.center.y, this.targetType, this.targetRadius);
        this.addShot(mm.x, mm.y);
    },

    handleDoubleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const adjustedX = (x - this.center.x - this.offsetX) / this.scale + this.center.x;
        const adjustedY = (y - this.center.y - this.offsetY) / this.scale + this.center.y;

        const shotIndex = this._findShotAt(adjustedX, adjustedY);
        if (shotIndex >= 0) {
            this.removeShot(shotIndex);
        }
    },

    handleTouchStart(e) {
        e.preventDefault();

        if (e.touches.length === 2) {
            // Pinch zoom
            this.lastPinchDist = this._getPinchDist(e.touches);
            this.isPanning = false;
        } else if (e.touches.length === 1) {
            const touch = e.touches[0];
            this.lastTouchX = touch.clientX;
            this.lastTouchY = touch.clientY;
            this.touchStartTime = Date.now();
            this.touchMoved = false;

            // Check if touching existing shot for drag
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            const adjustedX = (x - this.center.x - this.offsetX) / this.scale + this.center.x;
            const adjustedY = (y - this.center.y - this.offsetY) / this.scale + this.center.y;

            const shotIndex = this._findShotAt(adjustedX, adjustedY);
            if (shotIndex >= 0) {
                this.isDragging = true;
                this.dragShotIndex = shotIndex;
                this.selectedShot = shotIndex;
            } else {
                this.isPanning = true;
            }
        }
    },

    handleTouchMove(e) {
        e.preventDefault();
        this.touchMoved = true;

        if (e.touches.length === 2) {
            // Pinch zoom
            const dist = this._getPinchDist(e.touches);
            const scaleFactor = dist / this.lastPinchDist;
            this.scale = Math.max(0.5, Math.min(5, this.scale * scaleFactor));
            this.lastPinchDist = dist;
            this.draw();
        } else if (e.touches.length === 1) {
            const touch = e.touches[0];
            const dx = touch.clientX - this.lastTouchX;
            const dy = touch.clientY - this.lastTouchY;

            if (this.isDragging && this.dragShotIndex >= 0) {
                // Drag shot
                const rect = this.canvas.getBoundingClientRect();
                const x = touch.clientX - rect.left;
                const y = touch.clientY - rect.top;
                const adjustedX = (x - this.center.x - this.offsetX) / this.scale + this.center.x;
                const adjustedY = (y - this.center.y - this.offsetY) / this.scale + this.center.y;
                const mm = Scoring.pxToMm(adjustedX, adjustedY, this.center.x, this.center.y, this.targetType, this.targetRadius);

                this.shots[this.dragShotIndex].x = mm.x;
                this.shots[this.dragShotIndex].y = mm.y;
                // Recalculate score
                const result = Scoring.calculateShotScore(mm.x, mm.y, this.targetType);
                this.shots[this.dragShotIndex].score = result.integer;
                this.shots[this.dragShotIndex].decimal = result.decimal;
                this.draw();
                App.onShotsUpdated();
            } else if (this.isPanning && this.scale > 1) {
                // Pan
                this.offsetX += dx;
                this.offsetY += dy;
                this.draw();
            }

            this.lastTouchX = touch.clientX;
            this.lastTouchY = touch.clientY;
        }
    },

    handleTouchEnd(e) {
        if (!this.touchMoved && e.changedTouches.length === 1) {
            const elapsed = Date.now() - this.touchStartTime;

            if (this.isDragging) {
                // Just selected/de-selected by tap
                App.onShotSelected(this.selectedShot);
            } else if (elapsed < 300) {
                // Quick tap — simulate click for shot placement
                const touch = e.changedTouches[0];
                const rect = this.canvas.getBoundingClientRect();
                const x = touch.clientX - rect.left;
                const y = touch.clientY - rect.top;
                const adjustedX = (x - this.center.x - this.offsetX) / this.scale + this.center.x;
                const adjustedY = (y - this.center.y - this.offsetY) / this.scale + this.center.y;

                // Check for tap on existing shot
                const shotIndex = this._findShotAt(adjustedX, adjustedY);
                if (shotIndex >= 0) {
                    this.selectedShot = this.selectedShot === shotIndex ? -1 : shotIndex;
                    this.draw();
                    App.onShotSelected(this.selectedShot);
                } else {
                    // Place new shot
                    const mm = Scoring.pxToMm(adjustedX, adjustedY, this.center.x, this.center.y, this.targetType, this.targetRadius);
                    this.addShot(mm.x, mm.y);
                }
            }
        }

        this.isDragging = false;
        this.dragShotIndex = -1;
        this.isPanning = false;
    },

    // --- Shot Management ---

    addShot(xMm, yMm) {
        const settings = Storage.getSettings();
        if (this.shots.length >= settings.shotsPerSeries) {
            App.showToast(`Maximum ${settings.shotsPerSeries} shots per series reached.`, 'error');
            return;
        }

        const result = Scoring.calculateShotScore(xMm, yMm, this.targetType);
        const shot = {
            x: Math.round(xMm * 100) / 100,
            y: Math.round(yMm * 100) / 100,
            score: result.integer,
            decimal: result.decimal,
            distance: result.distance,
            isInnerTen: result.isInnerTen,
            timestamp: Date.now()
        };

        this.shots.push(shot);
        this.selectedShot = this.shots.length - 1;
        this.draw();
        App.onShotsUpdated();
        App.onShotSelected(this.selectedShot);
    },

    removeShot(index) {
        if (index >= 0 && index < this.shots.length) {
            this.shots.splice(index, 1);
            this.selectedShot = -1;
            this.draw();
            App.onShotsUpdated();
            App.onShotSelected(-1);
        }
    },

    clearShots() {
        this.shots = [];
        this.selectedShot = -1;
        this.draw();
        App.onShotsUpdated();
    },

    /**
     * Load image as background
     */
    setBackgroundImage(dataUrl) {
        const img = new Image();
        img.onload = () => {
            this.backgroundImage = img;
            this.backgroundOpacity = 0.3;
            this.showBackground = true;
            this.draw();
        };
        img.src = dataUrl;
    },

    /**
     * Set target type and redraw
     */
    setTargetType(type) {
        this.targetType = type;
        // Recalculate all shot scores
        this.shots.forEach(shot => {
            const result = Scoring.calculateShotScore(shot.x, shot.y, type);
            shot.score = result.integer;
            shot.decimal = result.decimal;
            shot.distance = result.distance;
            shot.isInnerTen = result.isInnerTen;
        });
        this.draw();
        App.onShotsUpdated();
    },

    /**
     * Reset zoom & pan
     */
    resetView() {
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.draw();
    },

    /**
     * Get canvas as data URL for export
     */
    toDataURL() {
        return this.canvas.toDataURL('image/png');
    },

    /**
     * Export just the target with shots (no zoom/pan offset)
     */
    exportImage() {
        const savedScale = this.scale;
        const savedOffsetX = this.offsetX;
        const savedOffsetY = this.offsetY;

        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.draw();

        const dataUrl = this.canvas.toDataURL('image/png');

        this.scale = savedScale;
        this.offsetX = savedOffsetX;
        this.offsetY = savedOffsetY;
        this.draw();

        return dataUrl;
    },

    // --- Helpers ---

    _findShotAt(px, py) {
        const hitRadius = 15 / this.scale;
        for (let i = this.shots.length - 1; i >= 0; i--) {
            const pos = Scoring.mmToPx(this.shots[i].x, this.shots[i].y, this.center.x, this.center.y, this.targetType, this.targetRadius);
            const dist = Math.sqrt(Math.pow(px - pos.x, 2) + Math.pow(py - pos.y, 2));
            if (dist < hitRadius) return i;
        }
        return -1;
    },

    _getPinchDist(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    },

    _mmToPxLength(mm) {
        const config = Scoring.getTargetConfig(this.targetType);
        const outerRingRadius = config.ringDiameters[0] / 2;
        return (mm / outerRingRadius) * this.targetRadius;
    },

    _handleCalibrationClick(e) {
        // Calibration mode: user clicks 2 points to set scale
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.calibrationPoints.push({ x, y });

        if (this.calibrationPoints.length === 2) {
            const p1 = this.calibrationPoints[0];
            const p2 = this.calibrationPoints[1];
            const pxDist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

            // For now, assume the two points span the outer ring diameter
            const config = Scoring.getTargetConfig(this.targetType);
            const mmDist = config.ringDiameters[0]; // outer ring diameter
            this.calibrationScale = pxDist / mmDist;
            this.targetRadius = pxDist / 2;

            this.calibrationMode = false;
            this.calibrationPoints = [];
            this.draw();
            App.showToast('Target calibrated successfully!');
        } else {
            App.showToast('Click the opposite edge of the target.');
        }
    }
};
