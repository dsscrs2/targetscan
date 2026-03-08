/* ========================================
   AirScan — Shooting Analytics Engine
   MPI, Spread, Grouping, Dispersion
   ======================================== */

const Analytics = {

    /**
     * Compute all analytics for an array of shots
     * Each shot: { x: mm, y: mm }
     * @returns {Object} full analytics result
     */
    computeAll(shots) {
        if (!shots || shots.length === 0) {
            return this._emptyResult();
        }

        const mpi = this.meanPointOfImpact(shots);
        const extremeSpread = this.extremeSpread(shots);
        const meanRadius = this.meanRadius(shots, mpi);
        const groupSize = this.groupSize(shots);
        const dispersion = this.dispersion(shots, mpi);
        const consistency = this.consistency(shots, mpi);

        return {
            mpi,
            extremeSpread,
            meanRadius,
            groupSize,
            dispersion,
            consistency,
            shotCount: shots.length
        };
    },

    /**
     * Mean Point of Impact — average position of all shots
     */
    meanPointOfImpact(shots) {
        if (shots.length === 0) return { x: 0, y: 0 };
        const sumX = shots.reduce((sum, s) => sum + s.x, 0);
        const sumY = shots.reduce((sum, s) => sum + s.y, 0);
        return {
            x: sumX / shots.length,
            y: sumY / shots.length
        };
    },

    /**
     * Extreme Spread — maximum distance between any two shots (mm)
     */
    extremeSpread(shots) {
        if (shots.length < 2) return 0;
        let maxDist = 0;
        for (let i = 0; i < shots.length; i++) {
            for (let j = i + 1; j < shots.length; j++) {
                const dist = this._distance(shots[i], shots[j]);
                if (dist > maxDist) maxDist = dist;
            }
        }
        return Math.round(maxDist * 100) / 100;
    },

    /**
     * Mean Radius — average distance of each shot from MPI (mm)
     */
    meanRadius(shots, mpi) {
        if (shots.length === 0) return 0;
        mpi = mpi || this.meanPointOfImpact(shots);
        const totalDist = shots.reduce((sum, s) => sum + this._distance(s, mpi), 0);
        return Math.round((totalDist / shots.length) * 100) / 100;
    },

    /**
     * Group Size — diameter of smallest enclosing circle (mm)
     * Approximated as extreme spread (exact MEC is computationally expensive)
     */
    groupSize(shots) {
        return this.extremeSpread(shots);
    },

    /**
     * Dispersion — standard deviation along X and Y axes (mm)
     */
    dispersion(shots, mpi) {
        if (shots.length < 2) return { horizontal: 0, vertical: 0, ratio: 1 };
        mpi = mpi || this.meanPointOfImpact(shots);

        const n = shots.length;
        const varX = shots.reduce((sum, s) => sum + Math.pow(s.x - mpi.x, 2), 0) / (n - 1);
        const varY = shots.reduce((sum, s) => sum + Math.pow(s.y - mpi.y, 2), 0) / (n - 1);

        const horizontal = Math.round(Math.sqrt(varX) * 100) / 100;
        const vertical = Math.round(Math.sqrt(varY) * 100) / 100;
        const ratio = vertical > 0 ? Math.round((horizontal / vertical) * 100) / 100 : 1;

        return { horizontal, vertical, ratio };
    },

    /**
     * Consistency — standard deviation of distances from MPI
     * Lower = more consistent shot placement
     */
    consistency(shots, mpi) {
        if (shots.length < 2) return 0;
        mpi = mpi || this.meanPointOfImpact(shots);

        const distances = shots.map(s => this._distance(s, mpi));
        const meanDist = distances.reduce((a, b) => a + b, 0) / distances.length;
        const variance = distances.reduce((sum, d) => sum + Math.pow(d - meanDist, 2), 0) / (distances.length - 1);
        return Math.round(Math.sqrt(variance) * 100) / 100;
    },

    /**
     * Get MPI offset angle in degrees (0 = up/north, clockwise)
     * Used for AI analysis to detect directional patterns
     */
    getMPIAngle(mpi) {
        if (mpi.x === 0 && mpi.y === 0) return 0;
        // atan2 with Y inverted for compass-style (0=N, 90=E)
        let angle = Math.atan2(mpi.x, mpi.y) * (180 / Math.PI);
        if (angle < 0) angle += 360;
        return Math.round(angle * 10) / 10;
    },

    /**
     * Get MPI offset distance from center (mm)
     */
    getMPIOffset(mpi) {
        return Math.round(this._distance(mpi, { x: 0, y: 0 }) * 100) / 100;
    },

    /**
     * Trend analysis — compare current session to previous sessions
     */
    getTrend(currentSession, previousSessions) {
        if (!previousSessions || previousSessions.length === 0) {
            return { trend: 'neutral', message: 'First session — keep shooting to track progress!' };
        }

        const lastScores = previousSessions
            .slice(0, 5)
            .map(s => s.totalScore || 0);
        const avgPrevious = lastScores.reduce((a, b) => a + b, 0) / lastScores.length;
        const current = currentSession.totalScore || 0;
        const diff = current - avgPrevious;

        if (diff > 5) return { trend: 'up', message: `Excellent! +${diff.toFixed(0)} above your recent average.`, diff };
        if (diff > 0) return { trend: 'up', message: `Good improvement! +${diff.toFixed(1)} above average.`, diff };
        if (diff > -3) return { trend: 'neutral', message: 'Consistent with your recent performance.', diff };
        return { trend: 'down', message: `${diff.toFixed(1)} below recent average. Review fundamentals.`, diff };
    },

    // --- Helpers ---

    _distance(a, b) {
        return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
    },

    _emptyResult() {
        return {
            mpi: { x: 0, y: 0 },
            extremeSpread: 0,
            meanRadius: 0,
            groupSize: 0,
            dispersion: { horizontal: 0, vertical: 0, ratio: 1 },
            consistency: 0,
            shotCount: 0
        };
    }
};
