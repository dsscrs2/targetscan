/* ========================================
   AirScan — Storage Manager
   localStorage CRUD for shooting sessions
   ======================================== */

const Storage = {
  SESSIONS_KEY: 'airscan_sessions',
  SETTINGS_KEY: 'airscan_settings',

  // --- Sessions ---

  getSessions() {
    try {
      const data = localStorage.getItem(this.SESSIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to load sessions:', e);
      return [];
    }
  },

  getSessionById(id) {
    const sessions = this.getSessions();
    return sessions.find(s => s.id === id) || null;
  },

  saveSession(session) {
    const sessions = this.getSessions();
    session.id = session.id || this.generateId();
    session.createdAt = session.createdAt || new Date().toISOString();
    session.updatedAt = new Date().toISOString();
    sessions.unshift(session); // newest first
    this._saveSessions(sessions);
    return session;
  },

  updateSession(id, updates) {
    const sessions = this.getSessions();
    const idx = sessions.findIndex(s => s.id === id);
    if (idx === -1) return null;
    sessions[idx] = { ...sessions[idx], ...updates, updatedAt: new Date().toISOString() };
    this._saveSessions(sessions);
    return sessions[idx];
  },

  deleteSession(id) {
    const sessions = this.getSessions().filter(s => s.id !== id);
    this._saveSessions(sessions);
  },

  clearAllSessions() {
    localStorage.removeItem(this.SESSIONS_KEY);
  },

  _saveSessions(sessions) {
    try {
      localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(sessions));
    } catch (e) {
      console.error('Failed to save sessions:', e);
      if (e.name === 'QuotaExceededError') {
        // Try removing oldest image data to free space
        this._freeSpace(sessions);
      }
    }
  },

  _freeSpace(sessions) {
    // Remove image data from oldest sessions first
    for (let i = sessions.length - 1; i >= 0; i--) {
      if (sessions[i].imageDataUrl) {
        sessions[i].imageDataUrl = null;
        try {
          localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(sessions));
          return true;
        } catch (e) {
          continue;
        }
      }
    }
    return false;
  },

  // --- Settings ---

  getSettings() {
    try {
      const data = localStorage.getItem(this.SETTINGS_KEY);
      return data ? JSON.parse(data) : this.getDefaultSettings();
    } catch (e) {
      return this.getDefaultSettings();
    }
  },

  saveSettings(settings) {
    localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
  },

  getDefaultSettings() {
    return {
      targetType: 'air_rifle',
      scoringMode: 'integer', // 'integer' or 'decimal'
      shotsPerSeries: 10,
      showGrid: true,
      showLabels: true,
      pelletDiameter: 4.5 // mm for 0.177 caliber
    };
  },

  // --- Export / Import ---

  exportAllData() {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      sessions: this.getSessions(),
      settings: this.getSettings()
    };
    return JSON.stringify(data, null, 2);
  },

  importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (data.sessions) {
        localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(data.sessions));
      }
      if (data.settings) {
        localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(data.settings));
      }
      return true;
    } catch (e) {
      console.error('Import failed:', e);
      return false;
    }
  },

  // --- Utility ---

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  }
};
