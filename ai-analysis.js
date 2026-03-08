/* ========================================
   AirScan — AI Shooting Analysis
   Rule-based coaching engine
   ======================================== */

const AIAnalysis = {

    /**
     * Analyze shot pattern and return coaching tips
     * @param {Array} shots - array of { x, y, score } in mm from center
     * @param {Object} analytics - result from Analytics.computeAll()
     * @param {string} targetType - 'air_rifle' or 'air_pistol'
     * @returns {Array} array of { type, title, description, severity, icon }
     */
    analyze(shots, analytics, targetType) {
        if (!shots || shots.length < 3) {
            return [{
                type: 'info',
                title: 'Need More Data',
                description: 'Place at least 3 shots to receive AI coaching analysis.',
                severity: 'low',
                icon: 'ℹ️'
            }];
        }

        const tips = [];
        const mpi = analytics.mpi;
        const mpiOffset = Analytics.getMPIOffset(mpi);
        const mpiAngle = Analytics.getMPIAngle(mpi);
        const dispersion = analytics.dispersion;
        const meanRadius = analytics.meanRadius;
        const extremeSpread = analytics.extremeSpread;

        // Threshold adjustments based on target type
        const isRifle = targetType === 'air_rifle';
        const offsetThreshold = isRifle ? 2.0 : 8.0;
        const tightGroupThreshold = isRifle ? 3.0 : 12.0;
        const scatteredThreshold = isRifle ? 8.0 : 30.0;
        const dispersionRatioThreshold = 1.8;

        // 1. Check MPI offset — sights adjustment needed
        if (mpiOffset > offsetThreshold) {
            const direction = this._getDirection(mpiAngle);
            const sightAdjust = this._getSightAdjustment(mpiAngle);

            if (meanRadius < tightGroupThreshold) {
                tips.push({
                    type: 'sight_adjustment',
                    title: 'Sight Adjustment Needed',
                    description: `Your group is tight but centered ${direction}. ${sightAdjust} Consistent grouping means your technique is solid — just adjust your sights.`,
                    severity: 'medium',
                    icon: '🎯'
                });
            } else {
                tips.push({
                    type: 'mpi_offset',
                    title: `Group Shifted ${direction}`,
                    description: `Mean Point of Impact is ${mpiOffset.toFixed(1)}mm ${direction} of center. ${sightAdjust}`,
                    severity: 'medium',
                    icon: '📍'
                });
            }
        }

        // 2. Check for flinching (low-left for right-handed shooters)
        if (mpiAngle >= 190 && mpiAngle <= 260 && mpiOffset > offsetThreshold) {
            tips.push({
                type: 'flinching',
                title: 'Possible Flinching/Anticipation',
                description: 'Shots grouped low-left suggest anticipating the shot. Focus on smooth trigger press and follow-through. Try dry-fire practice to build confidence.',
                severity: 'high',
                icon: '⚡'
            });
        }

        // 3. Horizontal stringing — trigger control issue
        if (dispersion.horizontal > 0 && dispersion.vertical > 0 &&
            dispersion.horizontal / dispersion.vertical > dispersionRatioThreshold) {
            tips.push({
                type: 'trigger_control',
                title: 'Trigger Control',
                description: `Horizontal spread (${dispersion.horizontal.toFixed(1)}mm) is significantly wider than vertical (${dispersion.vertical.toFixed(1)}mm). This typically indicates trigger jerking. Apply steady, straight-back pressure on the trigger.`,
                severity: 'high',
                icon: '👆'
            });
        }

        // 4. Vertical stringing — breathing issue
        if (dispersion.vertical > 0 && dispersion.horizontal > 0 &&
            dispersion.vertical / dispersion.horizontal > dispersionRatioThreshold) {
            tips.push({
                type: 'breathing',
                title: 'Breathing Control',
                description: `Vertical spread (${dispersion.vertical.toFixed(1)}mm) is significantly wider than horizontal (${dispersion.horizontal.toFixed(1)}mm). Fire during your natural respiratory pause. Practice timing your shot within the breathing cycle.`,
                severity: 'high',
                icon: '🌬️'
            });
        }

        // 5. Scattered shots — fundamentals
        if (meanRadius > scatteredThreshold) {
            tips.push({
                type: 'fundamentals',
                title: 'Review Fundamentals',
                description: `Shot group is widely scattered (mean radius: ${meanRadius.toFixed(1)}mm). Focus on the basics: stable stance/position, consistent grip, sight alignment, and smooth trigger control. Slow down and focus on each shot.`,
                severity: 'high',
                icon: '📋'
            });
        }

        // 6. Excellent grouping
        if (meanRadius < tightGroupThreshold && mpiOffset < offsetThreshold) {
            tips.push({
                type: 'excellent',
                title: 'Excellent Shooting!',
                description: `Tight group with ${meanRadius.toFixed(1)}mm mean radius, well centered. Your fundamentals are solid. Focus on maintaining consistency across multiple series.`,
                severity: 'positive',
                icon: '🏆'
            });
        }

        // 7. Good group but off center
        if (meanRadius < tightGroupThreshold && mpiOffset > offsetThreshold) {
            tips.push({
                type: 'good_group',
                title: 'Good Consistency',
                description: `Your shot group is tight (${meanRadius.toFixed(1)}mm mean radius) which shows excellent technique. Simply adjust your sights to center the group and you'll score significantly higher.`,
                severity: 'positive',
                icon: '✨'
            });
        }

        // 8. Check for outliers (flyers)
        const flyers = this._detectFlyers(shots, analytics);
        if (flyers.length > 0) {
            tips.push({
                type: 'flyers',
                title: `${flyers.length} Flyer${flyers.length > 1 ? 's' : ''} Detected`,
                description: `Shot${flyers.length > 1 ? 's' : ''} #${flyers.map(f => f.index + 1).join(', #')} ${flyers.length > 1 ? 'are' : 'is'} significantly outside your main group. Flyers often indicate a lapse in concentration, rushed shot, or disturbance. Maintain focus and abort the shot if your hold pattern deteriorates.`,
                severity: 'medium',
                icon: '🎪'
            });
        }

        // 9. Shot-to-shot progression
        const progression = this._analyzeProgression(shots);
        if (progression) {
            tips.push(progression);
        }

        // If no specific tips, give general encouragement
        if (tips.length === 0) {
            tips.push({
                type: 'general',
                title: 'Solid Performance',
                description: 'No significant issues detected. Keep practicing with focused, deliberate shots. Try to maintain this level of consistency.',
                severity: 'positive',
                icon: '👍'
            });
        }

        return tips;
    },

    /**
     * Generate a summary score/grade for the session
     */
    getPerformanceGrade(totalScore, maxScore, analytics) {
        const pct = (totalScore / maxScore) * 100;
        const mr = analytics.meanRadius;

        if (pct >= 95 && mr < 3) return { grade: 'S', label: 'Elite', color: '#ffd700' };
        if (pct >= 90) return { grade: 'A', label: 'Excellent', color: '#00ff88' };
        if (pct >= 80) return { grade: 'B', label: 'Good', color: '#66ff88' };
        if (pct >= 70) return { grade: 'C', label: 'Average', color: '#ffaa00' };
        if (pct >= 60) return { grade: 'D', label: 'Below Average', color: '#ff8844' };
        return { grade: 'F', label: 'Needs Work', color: '#ff4466' };
    },

    // --- Internal helpers ---

    _getDirection(angle) {
        if (angle >= 337.5 || angle < 22.5) return 'high';
        if (angle >= 22.5 && angle < 67.5) return 'high-right';
        if (angle >= 67.5 && angle < 112.5) return 'right';
        if (angle >= 112.5 && angle < 157.5) return 'low-right';
        if (angle >= 157.5 && angle < 202.5) return 'low';
        if (angle >= 202.5 && angle < 247.5) return 'low-left';
        if (angle >= 247.5 && angle < 292.5) return 'left';
        return 'high-left';
    },

    _getSightAdjustment(angle) {
        const adjustments = {
            'high': 'Lower your rear sight or raise front sight.',
            'high-right': 'Move rear sight down and to the left.',
            'right': 'Move rear sight to the left.',
            'low-right': 'Move rear sight up and to the left.',
            'low': 'Raise your rear sight or lower front sight.',
            'low-left': 'Move rear sight up and to the right.',
            'left': 'Move rear sight to the right.',
            'high-left': 'Move rear sight down and to the right.'
        };
        const dir = this._getDirection(angle);
        return adjustments[dir] || '';
    },

    _detectFlyers(shots, analytics) {
        if (shots.length < 4) return [];
        const mpi = analytics.mpi;
        const distances = shots.map((s, i) => ({
            index: i,
            dist: Math.sqrt(Math.pow(s.x - mpi.x, 2) + Math.pow(s.y - mpi.y, 2))
        }));

        const meanDist = distances.reduce((s, d) => s + d.dist, 0) / distances.length;
        const stdDev = Math.sqrt(
            distances.reduce((s, d) => s + Math.pow(d.dist - meanDist, 2), 0) / (distances.length - 1)
        );

        // A flyer is > 2.5 standard deviations from mean distance
        return distances.filter(d => d.dist > meanDist + 2.5 * stdDev);
    },

    _analyzeProgression(shots) {
        if (shots.length < 5) return null;

        // Check if later shots are worse (fatigue)
        const half = Math.floor(shots.length / 2);
        const firstHalf = shots.slice(0, half);
        const secondHalf = shots.slice(half);

        const avgFirst = firstHalf.reduce((s, sh) => s + (sh.score || 0), 0) / firstHalf.length;
        const avgSecond = secondHalf.reduce((s, sh) => s + (sh.score || 0), 0) / secondHalf.length;

        if (avgFirst - avgSecond > 1.5) {
            return {
                type: 'fatigue',
                title: 'Performance Dropping',
                description: `Your first ${half} shots averaged ${avgFirst.toFixed(1)} but your last ${secondHalf.length} averaged ${avgSecond.toFixed(1)}. This may indicate fatigue or loss of concentration. Consider shorter practice sessions with breaks.`,
                severity: 'medium',
                icon: '📉'
            };
        }

        if (avgSecond - avgFirst > 1.5) {
            return {
                type: 'warmup',
                title: 'Warming Up Well',
                description: `Your scores improved from ${avgFirst.toFixed(1)} avg to ${avgSecond.toFixed(1)} avg. Good warm-up progression! Consider doing a few sighting shots before scoring.`,
                severity: 'positive',
                icon: '📈'
            };
        }

        return null;
    }
};
