/* ========================================
   AirScan — Main Application Controller
   SPA Router, page management, glue code
   ======================================== */

const App = {
    currentPage: 'scan',
    currentSession: null,
    settings: null,

    /**
     * Initialize the entire application
     */
    init() {
        this.settings = Storage.getSettings();
        Camera.init();
        this.bindNavigation();
        this.bindScanPage();
        this.bindScoringPage();
        this.bindResultsPage();
        this.bindHistoryPage();
        this.bindStatsPage();
        this.bindReportPage();

        // Handle hash-based routing
        window.addEventListener('hashchange', () => this.onHashChange());
        this.onHashChange();

        // Set initial target type
        this.updateTargetTypeUI();
    },

    // --- Navigation ---

    bindNavigation() {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = btn.dataset.page;
                if (page) this.showPage(page);
            });
        });
    },

    showPage(name) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

        const page = document.getElementById(`page-${name}`);
        const nav = document.querySelector(`.nav-item[data-page="${name}"]`);
        if (page) page.classList.add('active');
        if (nav) nav.classList.add('active');

        this.currentPage = name;
        window.location.hash = name;

        // Page-specific init
        if (name === 'scoring') this.initScoringPage();
        if (name === 'results') this.renderResults();
        if (name === 'history') this.renderHistory();
        if (name === 'stats') this.renderStats();
        if (name === 'report') this.renderReport();
    },

    onHashChange() {
        const hash = window.location.hash.replace('#', '') || 'scan';
        const validPages = ['scan', 'scoring', 'results', 'history', 'stats', 'report'];
        if (validPages.includes(hash)) {
            this.showPage(hash);
        }
    },

    // --- Scan Page ---

    bindScanPage() {
        // Upload button
        const uploadBtn = document.getElementById('btn-upload');
        const fileInput = document.getElementById('file-input');
        if (uploadBtn && fileInput) {
            uploadBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => {
                Camera.handleFileUpload(e, (dataUrl) => this.onImageCaptured(dataUrl));
            });
        }

        // Camera button
        const cameraBtn = document.getElementById('btn-camera');
        if (cameraBtn) {
            cameraBtn.addEventListener('click', () => Camera.openCamera());
        }

        // Demo target button
        const demoBtn = document.getElementById('btn-demo');
        if (demoBtn) {
            demoBtn.addEventListener('click', () => this.loadDemoTarget());
        }

        // Target type selector
        document.querySelectorAll('.target-type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.target-type-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.settings.targetType = btn.dataset.type;
                Storage.saveSettings(this.settings);
                Target.setTargetType(this.settings.targetType);
                this.updateTargetTypeUI();
            });
        });
    },

    onImageCaptured(dataUrl) {
        // Start a new session
        this.currentSession = {
            id: Storage.generateId(),
            imageDataUrl: dataUrl,
            targetType: this.settings.targetType,
            shots: [],
            createdAt: new Date().toISOString()
        };

        // Navigate to scoring page
        this.showPage('scoring');
        Target.setBackgroundImage(dataUrl);
    },

    loadDemoTarget() {
        // Start a session without an image (use rendered target)
        this.currentSession = {
            id: Storage.generateId(),
            imageDataUrl: null,
            targetType: this.settings.targetType,
            shots: [],
            createdAt: new Date().toISOString()
        };
        this.showPage('scoring');
    },

    updateTargetTypeUI() {
        document.querySelectorAll('.target-type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === this.settings.targetType);
        });
    },

    // --- Scoring Page ---

    bindScoringPage() {
        // Done button
        const doneBtn = document.getElementById('btn-scoring-done');
        if (doneBtn) {
            doneBtn.addEventListener('click', () => this.finishScoring());
        }

        // Clear button
        const clearBtn = document.getElementById('btn-scoring-clear');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                Target.clearShots();
            });
        }

        // Undo button
        const undoBtn = document.getElementById('btn-scoring-undo');
        if (undoBtn) {
            undoBtn.addEventListener('click', () => {
                if (Target.shots.length > 0) {
                    Target.removeShot(Target.shots.length - 1);
                }
            });
        }

        // Reset view button
        const resetBtn = document.getElementById('btn-reset-view');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => Target.resetView());
        }

        // Delete selected shot button
        const deleteBtn = document.getElementById('btn-delete-shot');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (Target.selectedShot >= 0) {
                    Target.removeShot(Target.selectedShot);
                }
            });
        }

        // Background toggle
        const bgToggle = document.getElementById('toggle-background');
        if (bgToggle) {
            bgToggle.addEventListener('change', (e) => {
                Target.showBackground = e.target.checked;
                Target.draw();
            });
        }

        // Opacity slider
        const opacitySlider = document.getElementById('bg-opacity');
        if (opacitySlider) {
            opacitySlider.addEventListener('input', (e) => {
                Target.backgroundOpacity = parseFloat(e.target.value);
                Target.draw();
            });
        }

        // Decimal scoring toggle
        const decimalToggle = document.getElementById('toggle-decimal');
        if (decimalToggle) {
            decimalToggle.addEventListener('change', (e) => {
                this.settings.scoringMode = e.target.checked ? 'decimal' : 'integer';
                Storage.saveSettings(this.settings);
                this.onShotsUpdated();
            });
        }
    },

    initScoringPage() {
        Target.init('target-canvas');
        Target.setTargetType(this.settings.targetType);

        if (this.currentSession && this.currentSession.imageDataUrl) {
            Target.setBackgroundImage(this.currentSession.imageDataUrl);
        }

        // Reset if new session
        if (this.currentSession && this.currentSession.shots && this.currentSession.shots.length > 0) {
            Target.shots = [...this.currentSession.shots];
            Target.draw();
        }

        this.updateShotCounter();
        this.renderShotList();
    },

    onShotsUpdated() {
        if (!this.currentSession) return;
        this.currentSession.shots = [...Target.shots];
        this.updateShotCounter();
        this.renderShotList();
    },

    onShotSelected(index) {
        this.updateDeleteButton(index);
        // Scroll shot list to selected
        if (index >= 0) {
            const item = document.querySelector(`.shot-item[data-index="${index}"]`);
            if (item) item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    },

    updateShotCounter() {
        const counter = document.getElementById('shot-counter');
        if (counter) {
            counter.textContent = `${Target.shots.length} / ${this.settings.shotsPerSeries}`;
        }
    },

    updateDeleteButton(index) {
        const deleteBtn = document.getElementById('btn-delete-shot');
        if (deleteBtn) {
            deleteBtn.classList.toggle('hidden', index < 0);
        }
    },

    renderShotList() {
        const list = document.getElementById('shot-list');
        if (!list) return;

        const isDecimal = this.settings.scoringMode === 'decimal';

        if (Target.shots.length === 0) {
            list.innerHTML = `
        <div class="empty-state" style="padding: 16px;">
          <div class="text-muted" style="font-size: 0.8rem;">Tap on the target to place shots</div>
        </div>
      `;
            return;
        }

        list.innerHTML = Target.shots.map((shot, i) => {
            const scoreClass = shot.score >= 10 ? 'score-10' : (shot.score >= 9 ? 'score-9' : (shot.score >= 8 ? 'score-8' : (shot.score >= 7 ? 'score-7' : 'score-low')));
            const scoreText = isDecimal ? shot.decimal.toFixed(1) : shot.score;
            const isSelected = Target.selectedShot === i;

            return `
        <div class="shot-item ${isSelected ? 'selected' : ''}" data-index="${i}" onclick="App.selectShot(${i})" style="${isSelected ? 'border-color: var(--accent-green); background: var(--accent-green-subtle);' : ''}">
          <span class="shot-number">#${i + 1}</span>
          <span class="shot-score ${scoreClass}">${scoreText}${shot.isInnerTen ? ' ✕' : ''}</span>
          <span class="shot-coords">(${shot.x.toFixed(1)}, ${shot.y.toFixed(1)})</span>
          <button class="shot-delete" onclick="event.stopPropagation(); App.deleteShot(${i});" title="Delete shot">✕</button>
        </div>
      `;
        }).join('');
    },

    selectShot(index) {
        Target.selectedShot = Target.selectedShot === index ? -1 : index;
        Target.draw();
        this.onShotSelected(Target.selectedShot);
        this.renderShotList();
    },

    deleteShot(index) {
        Target.removeShot(index);
        this.renderShotList();
    },

    finishScoring() {
        if (Target.shots.length === 0) {
            this.showToast('Place at least one shot before finishing.', 'error');
            return;
        }

        // Calculate scores and analytics
        const scoreResult = Scoring.calculateTotalScore([...Target.shots], this.settings.targetType);
        const analytics = Analytics.computeAll(Target.shots);
        const aiTips = AIAnalysis.analyze(Target.shots, analytics, this.settings.targetType);
        const grade = AIAnalysis.getPerformanceGrade(scoreResult.total, scoreResult.maxPossible, analytics);

        // Build session
        this.currentSession = {
            ...this.currentSession,
            shots: [...Target.shots],
            totalScore: scoreResult.total,
            totalDecimal: scoreResult.totalDecimal,
            maxPossible: scoreResult.maxPossible,
            percentage: scoreResult.percentage,
            innerTens: scoreResult.innerTens,
            analytics,
            aiTips,
            grade,
            scoreBreakdown: Scoring.getScoreBreakdown(Target.shots),
            targetImageDataUrl: Target.exportImage()
        };

        // Save session
        Storage.saveSession(this.currentSession);

        // Navigate to results
        this.showPage('results');
    },

    // --- Results Page ---

    bindResultsPage() {
        const newBtn = document.getElementById('btn-new-session');
        if (newBtn) {
            newBtn.addEventListener('click', () => {
                this.currentSession = null;
                Target.clearShots();
                Target.backgroundImage = null;
                this.showPage('scan');
            });
        }
    },

    renderResults() {
        if (!this.currentSession || !this.currentSession.totalScore === undefined) {
            document.getElementById('results-content').innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🎯</div>
          <div class="empty-state-text">Complete a scoring session to see results.</div>
        </div>
      `;
            return;
        }

        const s = this.currentSession;
        const isDecimal = this.settings.scoringMode === 'decimal';

        document.getElementById('results-content').innerHTML = `
      <!-- Score Display -->
      <div class="results-score-display">
        ${s.grade ? `<div class="badge ${s.grade.grade === 'S' || s.grade.grade === 'A' ? 'badge-green' : 'badge-amber'}" style="margin-bottom: 8px;">
          <span style="font-size: 1rem;">${s.grade.grade}</span> ${s.grade.label}
        </div>` : ''}
        <div class="total-score">${isDecimal ? s.totalDecimal : s.totalScore}</div>
        <div class="max-score">out of ${s.maxPossible}</div>
        <div class="score-percentage">${s.percentage}%${s.innerTens ? ` · ${s.innerTens}× inner 10` : ''}</div>
      </div>

      <!-- Target Preview -->
      <div class="card" style="padding: 8px; margin-bottom: 16px;">
        ${s.targetImageDataUrl ? `<img src="${s.targetImageDataUrl}" alt="Target" style="width: 100%; border-radius: 8px;" />` : '<div class="text-center text-muted" style="padding: 32px;">No target image</div>'}
      </div>

      <!-- Score Breakdown -->
      <h3 class="section-title">Score Breakdown</h3>
      <div class="score-breakdown">
        ${[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(ring => {
            const count = s.scoreBreakdown ? (s.scoreBreakdown[ring] || 0) : 0;
            return `
            <div class="score-ring ${count > 0 ? 'has-shots' : ''}">
              <div class="score-ring-number">${ring}</div>
              <div class="score-ring-count">${count}</div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Shot Details -->
      <h3 class="section-title mt-lg">Shot Details</h3>
      <div class="shot-list">
        ${(s.shots || []).map((shot, i) => {
            const scoreClass = shot.score >= 10 ? 'score-10' : (shot.score >= 9 ? 'score-9' : (shot.score >= 8 ? 'score-8' : (shot.score >= 7 ? 'score-7' : 'score-low')));
            return `
            <div class="shot-item">
              <span class="shot-number">#${i + 1}</span>
              <span class="shot-score ${scoreClass}">${isDecimal ? shot.decimal.toFixed(1) : shot.score}${shot.isInnerTen ? ' ✕' : ''}</span>
              <span class="shot-coords">(${shot.x.toFixed(1)}, ${shot.y.toFixed(1)}) · ${shot.distance.toFixed(1)}mm</span>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Actions -->
      <div style="display: flex; gap: 8px; margin-top: 24px;">
        <button class="btn btn-primary" id="btn-new-session" onclick="App.startNewSession()">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Session
        </button>
      </div>
    `;
    },

    startNewSession() {
        this.currentSession = null;
        Target.clearShots();
        Target.backgroundImage = null;
        this.showPage('scan');
    },

    // --- History Page ---

    bindHistoryPage() {
        const clearBtn = document.getElementById('btn-clear-history');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (confirm('Delete all session history? This cannot be undone.')) {
                    Storage.clearAllSessions();
                    this.renderHistory();
                    this.showToast('History cleared.');
                }
            });
        }
    },

    renderHistory() {
        const sessions = Storage.getSessions();
        const container = document.getElementById('history-list');
        if (!container) return;

        if (sessions.length === 0) {
            container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-text">No sessions yet.<br>Complete a scoring session to see it here.</div>
        </div>
      `;
            return;
        }

        container.innerHTML = sessions.map((s, i) => {
            const date = new Date(s.createdAt || s.date);
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            const typeName = s.targetType === 'air_pistol' ? 'Air Pistol' : 'Air Rifle';
            const shotCount = (s.shots || []).length;

            return `
        <div class="history-item" onclick="App.loadSession('${s.id}')">
          <div style="width: 48px; height: 48px; background: var(--accent-green-subtle); border-radius: 12px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--border-glow); flex-shrink: 0;">
            <span style="font-size: 1.2rem;">🎯</span>
          </div>
          <div class="history-info">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="history-score">${s.totalScore || 0}</span>
              <span class="text-muted" style="font-size: 0.75rem;">/ ${shotCount * 10}</span>
              ${s.grade ? `<span class="badge ${s.grade.grade <= 'B' ? 'badge-green' : 'badge-amber'}" style="font-size: 0.55rem;">${s.grade.grade}</span>` : ''}
            </div>
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 2px;">
              <span class="history-type">${typeName}</span>
              <span class="history-date">${dateStr} · ${timeStr}</span>
            </div>
            <div class="text-muted" style="font-size: 0.7rem; margin-top: 2px;">${shotCount} shots</div>
          </div>
          <div class="history-arrow">›</div>
        </div>
      `;
        }).join('');
    },

    loadSession(id) {
        const session = Storage.getSessionById(id);
        if (!session) {
            this.showToast('Session not found.', 'error');
            return;
        }

        this.currentSession = session;
        this.showPage('results');
    },

    // --- Stats Page ---

    bindStatsPage() { },

    renderStats() {
        const container = document.getElementById('stats-content');
        if (!container) return;

        if (!this.currentSession || !this.currentSession.analytics) {
            // Try to show aggregate stats from all sessions
            const sessions = Storage.getSessions();
            if (sessions.length === 0) {
                container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📊</div>
            <div class="empty-state-text">Complete a scoring session to see statistics.</div>
          </div>
        `;
                return;
            }

            // Aggregate stats
            this.renderAggregateStats(container, sessions);
            return;
        }

        const s = this.currentSession;
        const a = s.analytics;

        container.innerHTML = `
      <!-- Current Session Stats -->
      <h3 class="section-title">Current Session</h3>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${Analytics.getMPIOffset(a.mpi).toFixed(1)}</div>
          <div class="stat-label">MPI Offset</div>
          <div class="stat-unit">mm from center</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${a.meanRadius.toFixed(1)}</div>
          <div class="stat-label">Mean Radius</div>
          <div class="stat-unit">mm</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${a.extremeSpread.toFixed(1)}</div>
          <div class="stat-label">Extreme Spread</div>
          <div class="stat-unit">mm</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${a.groupSize.toFixed(1)}</div>
          <div class="stat-label">Group Size</div>
          <div class="stat-unit">mm diameter</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${a.dispersion.horizontal.toFixed(1)}</div>
          <div class="stat-label">H. Dispersion</div>
          <div class="stat-unit">mm σ</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${a.dispersion.vertical.toFixed(1)}</div>
          <div class="stat-label">V. Dispersion</div>
          <div class="stat-unit">mm σ</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${a.consistency.toFixed(1)}</div>
          <div class="stat-label">Consistency</div>
          <div class="stat-unit">mm σ</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${Analytics.getMPIAngle(a.mpi).toFixed(0)}°</div>
          <div class="stat-label">MPI Angle</div>
          <div class="stat-unit">from center</div>
        </div>
      </div>

      <!-- AI Analysis -->
      ${s.aiTips && s.aiTips.length > 0 ? `
        <h3 class="section-title mt-lg">AI Coaching Analysis</h3>
        <div class="ai-analysis-card">
          <div class="ai-header">
            <span class="ai-badge">AI COACH</span>
            <span class="text-muted" style="font-size: 0.75rem;">${s.aiTips.length} insight${s.aiTips.length > 1 ? 's' : ''}</span>
          </div>
          ${s.aiTips.map(tip => `
            <div class="ai-tip">
              <span class="ai-tip-icon">${tip.icon}</span>
              <div class="ai-tip-text">
                <strong>${tip.title}</strong><br>
                ${tip.description}
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- Performance Trend -->
      ${this.renderTrend(s)}
    `;
    },

    renderAggregateStats(container, sessions) {
        const totalSessions = sessions.length;
        const avgScore = sessions.reduce((s, sess) => s + (sess.totalScore || 0), 0) / totalSessions;
        const bestScore = Math.max(...sessions.map(s => s.totalScore || 0));
        const totalShots = sessions.reduce((s, sess) => s + (sess.shots || []).length, 0);

        container.innerHTML = `
      <h3 class="section-title">Overall Statistics</h3>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${totalSessions}</div>
          <div class="stat-label">Sessions</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${totalShots}</div>
          <div class="stat-label">Total Shots</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${avgScore.toFixed(1)}</div>
          <div class="stat-label">Avg Score</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${bestScore}</div>
          <div class="stat-label">Best Score</div>
        </div>
      </div>

      <!-- Score History Chart -->
      <h3 class="section-title mt-lg">Score History</h3>
      <div class="card" style="padding: 16px;">
        <canvas id="score-history-chart" width="400" height="200" style="width: 100%; height: 160px;"></canvas>
      </div>
    `;

        // Draw simple score chart
        setTimeout(() => this.drawScoreChart(sessions), 100);
    },

    drawScoreChart(sessions) {
        const canvas = document.getElementById('score-history-chart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        canvas.width = canvas.clientWidth * dpr;
        canvas.height = canvas.clientHeight * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        const padding = { top: 20, right: 10, bottom: 25, left: 35 };

        const recentSessions = sessions.slice(0, 20).reverse();
        const scores = recentSessions.map(s => s.totalScore || 0);
        const maxScore = Math.max(...scores, 10);

        const chartW = w - padding.left - padding.right;
        const chartH = h - padding.top - padding.bottom;

        // Grid lines
        ctx.strokeStyle = '#1a2535';
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (chartH * i / 4);
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(w - padding.right, y);
            ctx.stroke();

            ctx.fillStyle = '#4a5568';
            ctx.font = '9px Inter, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(Math.round(maxScore * (1 - i / 4)), padding.left - 5, y + 3);
        }

        if (scores.length < 2) return;

        // Line
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.beginPath();

        scores.forEach((score, i) => {
            const x = padding.left + (i / (scores.length - 1)) * chartW;
            const y = padding.top + chartH - (score / maxScore) * chartH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Gradient fill
        const gradient = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom);
        gradient.addColorStop(0, 'rgba(0, 255, 136, 0.15)');
        gradient.addColorStop(1, 'rgba(0, 255, 136, 0)');
        ctx.fillStyle = gradient;
        ctx.lineTo(padding.left + chartW, h - padding.bottom);
        ctx.lineTo(padding.left, h - padding.bottom);
        ctx.closePath();
        ctx.fill();

        // Dots
        scores.forEach((score, i) => {
            const x = padding.left + (i / (scores.length - 1)) * chartW;
            const y = padding.top + chartH - (score / maxScore) * chartH;
            ctx.fillStyle = '#00ff88';
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        });
    },

    renderTrend(session) {
        const sessions = Storage.getSessions().filter(s => s.id !== session.id);
        const trend = Analytics.getTrend(session, sessions);
        const icon = trend.trend === 'up' ? '📈' : (trend.trend === 'down' ? '📉' : '➡️');
        const color = trend.trend === 'up' ? 'var(--accent-green)' : (trend.trend === 'down' ? 'var(--accent-red)' : 'var(--accent-amber)');

        return `
      <div class="card mt-lg" style="border-color: ${color}20;">
        <div class="flex-row gap-sm" style="margin-bottom: 8px;">
          <span style="font-size: 1.2rem;">${icon}</span>
          <span class="section-title" style="border: none; margin: 0; padding: 0;">Performance Trend</span>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5;">${trend.message}</p>
      </div>
    `;
    },

    // --- Report / Export Page ---

    bindReportPage() {
        document.getElementById('btn-export-pdf')?.addEventListener('click', () => {
            if (this.currentSession) {
                Export.exportPDF(this.currentSession, this.currentSession.targetImageDataUrl);
            } else {
                this.showToast('No active session to export.', 'error');
            }
        });

        document.getElementById('btn-export-csv')?.addEventListener('click', () => {
            if (this.currentSession) {
                Export.exportCSV(this.currentSession);
            } else {
                this.showToast('No active session to export.', 'error');
            }
        });

        document.getElementById('btn-export-image')?.addEventListener('click', () => {
            if (this.currentSession && this.currentSession.targetImageDataUrl) {
                Export.exportImage(this.currentSession.targetImageDataUrl);
            } else {
                this.showToast('No target image to export.', 'error');
            }
        });

        document.getElementById('btn-export-backup')?.addEventListener('click', () => {
            Export.exportBackup();
        });

        const restoreInput = document.getElementById('restore-input');
        document.getElementById('btn-import-backup')?.addEventListener('click', () => {
            restoreInput?.click();
        });
        restoreInput?.addEventListener('change', (e) => {
            if (e.target.files[0]) Export.importBackup(e.target.files[0]);
        });
    },

    renderReport() {
        const container = document.getElementById('report-content');
        if (!container) return;

        const hasSession = this.currentSession && this.currentSession.totalScore !== undefined;

        container.innerHTML = `
      <h3 class="section-title">Export Current Session</h3>
      ${hasSession ? `
        <div class="card" style="margin-bottom: 16px; padding: 16px;">
          <div class="flex-between">
            <div>
              <div style="font-family: var(--font-display); font-size: 0.8rem; color: var(--text-primary);">
                ${this.currentSession.targetType === 'air_pistol' ? 'Air Pistol' : 'Air Rifle'} · ${(this.currentSession.shots || []).length} shots
              </div>
              <div class="text-green" style="font-size: 1.2rem; font-weight: 700; font-family: var(--font-display);">
                ${this.currentSession.totalScore} / ${this.currentSession.maxPossible}
              </div>
            </div>
            <div style="font-size: 2rem;">🎯</div>
          </div>
        </div>

        <div class="export-options">
          <button class="btn btn-secondary" id="btn-export-pdf">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            Export PDF Report
          </button>
          <button class="btn btn-secondary" id="btn-export-csv">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>
            Export CSV Data
          </button>
          <button class="btn btn-secondary" id="btn-export-image">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            Export Target Image
          </button>
        </div>
      ` : `
        <div class="empty-state" style="padding: 24px;">
          <div class="text-muted" style="font-size: 0.85rem;">Complete a scoring session to export results.</div>
        </div>
      `}

      <h3 class="section-title mt-lg">Data Management</h3>
      <div class="export-options">
        <button class="btn btn-ghost" id="btn-export-backup">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export Backup
        </button>
        <button class="btn btn-ghost" id="btn-import-backup">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Restore Backup
        </button>
      </div>
      <input type="file" id="restore-input" accept=".json" style="display: none;" />

      <div class="info-card">
        <div class="info-card-header">
          <span>🛡️</span> DATA SAFETY
        </div>
        <div class="info-row">
          <span class="text-muted" style="font-size: 0.8rem;">All data is stored locally in your browser. No data is sent to any server.</span>
        </div>
      </div>
    `;

        // Re-bind export buttons (dynamic content)
        this.bindReportPage();
    },

    // --- Toast Notification ---

    showToast(message, type = 'success') {
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.className = 'toast';
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.className = `toast ${type === 'error' ? 'error' : ''}`;

        // Force reflow
        void toast.offsetHeight;
        toast.classList.add('show');

        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
};

// --- Boot ---
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
