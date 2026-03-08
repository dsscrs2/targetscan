# AirScan — 0.177 Air Gun Analytics

> Web-based shooting target scoring app for 0.177 air pistol and air rifle. Score to ISSF standards, get AI coaching, and track your progress.

![AirScan](https://img.shields.io/badge/AirScan-0.177%20Analytics-00ff88?style=for-the-badge&labelColor=0a0e17)
![License](https://img.shields.io/badge/License-Free-blue?style=for-the-badge&labelColor=0a0e17)

## Features

- 📸 **Upload or capture** target images via browser
- 🎯 **ISSF scoring** — air rifle & air pistol 10m targets
- 📍 **Manual shot placement** — tap to place, drag to adjust
- 🔢 **Integer & decimal scoring** (10.9 style for finals)
- 🤖 **AI coaching analysis** — detects flinching, trigger control, breathing patterns
- 📊 **Statistics** — MPI, extreme spread, mean radius, grouping, dispersion
- 📋 **Session history** — stored locally in your browser
- 📄 **Export** — PDF reports, CSV data, target images
- 💾 **Backup/restore** — export & import all data as JSON
- 🌙 **Dark neon theme** — optimized for mobile

## Quick Start

### Local Development

```bash
cd AntiGravity
python -m http.server 8080
# Open http://localhost:8080
```

### GitHub Pages Deployment

1. Push this folder to a GitHub repository
2. Go to **Settings → Pages**
3. Set source to "Deploy from a branch" → `main` / `root`
4. Your app will be live at `https://yourusername.github.io/repo-name/`

## Usage

1. **Open the app** → Home screen with upload options
2. **Upload/capture a target photo** or click "Try Demo Target"
3. **Tap on the target** to place pellet holes (up to 10 per series)
4. **Click "Finish & Calculate Score"** to see results
5. **Review** scores, analytics, and AI coaching tips
6. **Export** as PDF, CSV, or image

## Tech Stack

| | |
|---|---|
| Frontend | Vanilla HTML + CSS + JavaScript |
| Canvas | HTML5 Canvas API |
| Storage | localStorage |
| PDF | jsPDF (CDN) |
| Fonts | Google Fonts (Orbitron + Inter) |
| Deploy | GitHub Pages (static) |

## Project Structure

```
AntiGravity/
├── index.html          # Single-page app shell
├── css/
│   └── styles.css      # Design system (dark neon theme)
├── js/
│   ├── app.js          # SPA router & page controller
│   ├── camera.js       # Camera capture
│   ├── target.js       # Target canvas & shot placement
│   ├── scoring.js      # ISSF scoring engine
│   ├── analytics.js    # MPI, spread, grouping stats
│   ├── ai-analysis.js  # AI coaching engine
│   ├── storage.js      # localStorage CRUD
│   └── export.js       # PDF/CSV/image export
└── README.md
```

## Scoring Rules

Based on ISSF standards for 0.177 caliber (4.5mm pellet):

- Score is determined by where the **outer edge** of the pellet hole crosses a ring boundary
- Pellet diameter (4.5mm) is factored into calculations
- Decimal scoring interpolates within ring 10 for finals-style scoring

## Data Privacy

All data is stored **locally in your browser**. Nothing is ever sent to any server. Use the backup/restore feature to transfer data between devices.

---

Made with ❤️ by AntiGravity
