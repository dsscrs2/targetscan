/* ========================================
   AirScan — ISSF Scoring Engine
   0.177 (4.5mm) Air Pistol & Air Rifle
   ======================================== */

const Scoring = {

    // ISSF 10m Air Rifle target ring outer diameters (mm)
    // Ring 1 (outermost) to ring 10 (innermost), plus inner 10
    AIR_RIFLE: {
        name: 'Air Rifle 10m',
        ringDiameters: [
            45.5,  // Ring 1
            40.5,  // Ring 2
            35.5,  // Ring 3
            30.5,  // Ring 4
            25.5,  // Ring 5
            20.5,  // Ring 6
            15.5,  // Ring 7
            10.5,  // Ring 8
            5.5,   // Ring 9
            0.5    // Ring 10 (dot)
        ],
        innerTenDiameter: 0.5,  // Inner 10 dot diameter
        pelletDiameter: 4.5
    },

    // ISSF 10m Air Pistol target ring outer diameters (mm)
    AIR_PISTOL: {
        name: 'Air Pistol 10m',
        ringDiameters: [
            155.5, // Ring 1
            139.5, // Ring 2
            123.5, // Ring 3
            107.5, // Ring 4
            91.5,  // Ring 5
            75.5,  // Ring 6
            59.5,  // Ring 7
            43.5,  // Ring 8
            27.5,  // Ring 9
            11.5   // Ring 10
        ],
        innerTenDiameter: 5.0, // Inner 10 (X ring)
        pelletDiameter: 4.5
    },

    /**
     * Get target config by type string
     */
    getTargetConfig(targetType) {
        return targetType === 'air_pistol' ? this.AIR_PISTOL : this.AIR_RIFLE;
    },

    /**
     * Calculate the score for a single shot.
     * ISSF rule: the score is determined by the position of the outer edge 
     * of the pellet hole (shot center distance minus pellet radius).
     *
     * @param {number} shotXmm - X position in mm from target center
     * @param {number} shotYmm - Y position in mm from target center
     * @param {string} targetType - 'air_rifle' or 'air_pistol'
     * @returns {{ integer: number, decimal: number, distance: number }}
     */
    calculateShotScore(shotXmm, shotYmm, targetType) {
        const config = this.getTargetConfig(targetType);
        const distance = Math.sqrt(shotXmm * shotXmm + shotYmm * shotYmm);
        const pelletRadius = config.pelletDiameter / 2;

        // Outer edge of pellet hole - this is what counts for scoring
        const outerEdgeDistance = distance - pelletRadius;

        // Check inner 10 first
        if (outerEdgeDistance <= config.innerTenDiameter / 2) {
            // Decimal scoring within inner 10
            const decimal = this._calculateDecimal(outerEdgeDistance, config);
            return { integer: 10, decimal, distance, isInnerTen: true };
        }

        // Check each ring from 10 (innermost) outward
        for (let ring = config.ringDiameters.length - 1; ring >= 0; ring--) {
            const ringRadius = config.ringDiameters[ring] / 2;
            if (outerEdgeDistance <= ringRadius) {
                const score = ring + 1; // rings are 1-indexed
                const decimal = this._calculateDecimalForRing(outerEdgeDistance, score, config);
                return { integer: score, decimal, distance, isInnerTen: false };
            }
        }

        // Outside all rings — score 0
        return { integer: 0, decimal: 0.0, distance, isInnerTen: false };
    },

    /**
     * Calculate decimal score (10.0 – 10.9 style)
     * Used in finals shooting
     */
    _calculateDecimal(outerEdgeDistance, config) {
        // Ring 10 radius
        const ring10Radius = config.ringDiameters[config.ringDiameters.length - 1] / 2;
        // Ring 9 radius
        const ring9Radius = config.ringDiameters[config.ringDiameters.length - 2] / 2;
        const ringWidth = ring9Radius - ring10Radius;

        if (outerEdgeDistance <= 0) return 10.9;

        // Interpolate within ring 10
        const fraction = outerEdgeDistance / ring10Radius;
        const decimalPart = Math.max(0, 9 - Math.floor(fraction * 10));
        return 10 + decimalPart / 10;
    },

    _calculateDecimalForRing(outerEdgeDistance, ringScore, config) {
        if (ringScore >= 10) {
            return this._calculateDecimal(outerEdgeDistance, config);
        }

        const idx = ringScore - 1; // 0-indexed
        const thisRingRadius = config.ringDiameters[idx] / 2;
        const nextRingRadius = (idx + 1 < config.ringDiameters.length)
            ? config.ringDiameters[idx + 1] / 2 : 0;
        const ringWidth = thisRingRadius - nextRingRadius;

        if (ringWidth <= 0) return ringScore + 0.0;

        const posInRing = outerEdgeDistance - nextRingRadius;
        const fraction = 1 - (posInRing / ringWidth);
        const decimalPart = Math.min(9, Math.floor(fraction * 10));
        return ringScore + decimalPart / 10;
    },

    /**
     * Calculate total scores for an array of shots
     */
    calculateTotalScore(shots, targetType) {
        let total = 0;
        let totalDecimal = 0;
        let innerTens = 0;

        shots.forEach(shot => {
            const result = this.calculateShotScore(shot.x, shot.y, targetType);
            shot.score = result.integer;
            shot.decimal = result.decimal;
            shot.distance = result.distance;
            shot.isInnerTen = result.isInnerTen;
            total += result.integer;
            totalDecimal += result.decimal;
            if (result.isInnerTen) innerTens++;
        });

        const maxPossible = shots.length * 10;
        return {
            total,
            totalDecimal: Math.round(totalDecimal * 10) / 10,
            maxPossible,
            percentage: maxPossible > 0 ? ((total / maxPossible) * 100).toFixed(1) : '0.0',
            innerTens,
            shotCount: shots.length
        };
    },

    /**
     * Get count of shots per scoring ring
     */
    getScoreBreakdown(shots) {
        const breakdown = {};
        for (let i = 0; i <= 10; i++) {
            breakdown[i] = 0;
        }
        breakdown['X'] = 0; // inner tens

        shots.forEach(shot => {
            if (shot.score !== undefined) {
                breakdown[shot.score] = (breakdown[shot.score] || 0) + 1;
                if (shot.isInnerTen) breakdown['X']++;
            }
        });

        return breakdown;
    },

    /**
     * Get ring radii in pixels for canvas rendering.
     * Maps real mm dimensions to canvas pixel coordinates.
     */
    getRingRadiiPx(targetType, canvasRadius) {
        const config = this.getTargetConfig(targetType);
        const outerRingRadius = config.ringDiameters[0] / 2; // ring 1 outer radius in mm
        const scale = canvasRadius / outerRingRadius;

        return config.ringDiameters.map(d => (d / 2) * scale);
    },

    /**
     * Convert pixel coordinates on canvas to mm from center
     */
    pxToMm(pxX, pxY, canvasCenterX, canvasCenterY, targetType, canvasRadius) {
        const config = this.getTargetConfig(targetType);
        const outerRingRadius = config.ringDiameters[0] / 2;
        const scale = outerRingRadius / canvasRadius;

        return {
            x: (pxX - canvasCenterX) * scale,
            y: (canvasCenterY - pxY) * scale // Y is inverted (canvas Y goes down)
        };
    },

    /**
     * Convert mm coordinates to canvas pixels
     */
    mmToPx(mmX, mmY, canvasCenterX, canvasCenterY, targetType, canvasRadius) {
        const config = this.getTargetConfig(targetType);
        const outerRingRadius = config.ringDiameters[0] / 2;
        const scale = canvasRadius / outerRingRadius;

        return {
            x: canvasCenterX + mmX * scale,
            y: canvasCenterY - mmY * scale
        };
    }
};
