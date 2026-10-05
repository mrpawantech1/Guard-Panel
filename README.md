# 🛡️ Guard Panel

Web control panel for Guard Agent (Android app).

## Features

- 🔐 Password login (SHA-256)
- 📱 Multiple device support
- 📊 Live status (battery, network, location)
- 🗺️ Free live map (OpenStreetMap + Leaflet)
- 🎯 Google Maps link
- 📸 Photo/Video/Audio gallery (via Telegram)
- 📡 Live camera + mic stream viewer
- 🔔 Geofence with alerts
- 🛤️ GPS trail history
- 📅 Scheduled tasks
- 🔔 Browser notifications
- 📲 PWA installable

## Setup

### 1. Firebase Config
Edit `js/firebase-config.js`:
- Firebase config values (from Firebase console)
- Telegram bot token (from @BotFather)
- Telegram chat ID (from @userinfobot)

### 2. Deploy

**Option A — GitHub Pages:**
- Push to GitHub
- Settings → Pages → Source: `main` branch, `/root`
- Auto-deploys via workflow

**Option B — Netlify:**
- Connect GitHub repo
- Deploy automatically

**Option C — Vercel:**
- Import repo → Deploy

### 3. First Login

1. Open deployed URL
2. Enter any password → saved as new password
3. **Note it down** — same password next time

## Usage

1. Select device from dashboard
2. Send commands (Photo, Audio, Location, etc.)
3. View live location on map
4. Check gallery for media
5. Monitor live stream
6. Set geofences + get alerts

## File Structure
