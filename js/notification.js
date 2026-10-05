// ============================================
// BROWSER NOTIFICATIONS
// Firebase events pe push notification
// ============================================

const Notifications = {

    permission: 'default',
    enabled: false,
    lastSeenPhoto: null,
    lastSeenGeofence: null,
    deviceKey: null,
    listeners: [],

    /**
     * Initialize karo.
     */
    async init(deviceKey) {
        if (!('Notification' in window)) {
            console.warn('[Notif] Browser support nahi karta');
            return;
        }

        this.permission = Notification.permission;
        this.deviceKey = deviceKey;

        // LocalStorage se enabled state
        this.enabled = localStorage.getItem('notif_enabled') === 'true';

        if (this.permission !== 'granted') {
            this.enabled = false;
        }

        console.log('[Notif] Init — permission:', this.permission, 'enabled:', this.enabled);
    },

    /**
     * Permission maango.
     */
    async requestPermission() {
        if (!('Notification' in window)) {
            return false;
        }

        try {
            const result = await Notification.requestPermission();
            this.permission = result;

            if (result === 'granted') {
                this.enabled = true;
                localStorage.setItem('notif_enabled', 'true');
                this.show('Notifications ON', 'Ab aapko alerts milenge');
                return true;
            } else {
                this.enabled = false;
                localStorage.setItem('notif_enabled', 'false');
                return false;
            }
        } catch (e) {
            console.error('[Notif] Permission error:', e);
            return false;
        }
    },

    /**
     * Notifications enable/disable toggle.
     */
    toggle() {
        if (this.enabled) {
            this.enabled = false;
            localStorage.setItem('notif_enabled', 'false');
            return false;
        } else {
            return this.requestPermission();
        }
    },

    /**
     * Notification show karo.
     */
    show(title, body, options = {}) {
        if (!this.enabled || this.permission !== 'granted') return;

        try {
            const notif = new Notification(title, {
                body: body,
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🛡️</text></svg>',
                badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🛡️</text></svg>',
                tag: options.tag || 'guard-' + Date.now(),
                requireInteraction: false,
                silent: false
            });

            // Click karne pe panel kholo
            notif.onclick = () => {
                window.focus();
                if (options.url) {
                    window.location.href = options.url;
                }
                notif.close();
            };

            // Auto-close 8 sec baad
            setTimeout(() => notif.close(), 8000);

            console.log('[Notif] Shown:', title);
        } catch (e) {
            console.warn('[Notif] Show failed:', e);
        }
    },

    /**
     * Firebase events monitor karo — naye photo/audio pe notify.
     */
    startMonitoring(deviceKey) {
        this.deviceKey = deviceKey;

        // Photos
        const photoRef = window.db.ref(`devices/${deviceKey}/photos`).limitToLast(1);
        const photoCallback = photoRef.on('child_added', (snap) => {
            const data = snap.val();
            if (!data || !data.fileId) return;

            // Pehli baar skip karo
            if (this.lastSeenPhoto === null) {
                this.lastSeenPhoto = data.fileId;
                return;
            }

            if (data.fileId !== this.lastSeenPhoto) {
                this.lastSeenPhoto = data.fileId;
                this.show(
                    '📸 New Photo',
                    'Device se nayi photo aayi',
                    { tag: 'photo-' + data.fileId, url: 'gallery.html' }
                );
            }
        });

        this.listeners.push({ ref: photoRef, event: 'child_added', callback: photoCallback });

        // Audios
        const audioRef = window.db.ref(`devices/${deviceKey}/audios`).limitToLast(1);
        const audioCallback = audioRef.on('child_added', (snap) => {
            const data = snap.val();
            if (!data || !data.fileId) return;

            if (this.lastSeenAudio === undefined) {
                this.lastSeenAudio = data.fileId;
                return;
            }

            if (data.fileId !== this.lastSeenAudio) {
                this.lastSeenAudio = data.fileId;
                this.show(
                    '🎤 New Audio',
                    'Device se nayi audio recording aayi',
                    { tag: 'audio-' + data.fileId, url: 'gallery.html' }
                );
            }
        });

        this.listeners.push({ ref: audioRef, event: 'child_added', callback: audioCallback });

        // Geofence alerts
        const geofenceRef = window.db.ref(`geofenceAlerts/${deviceKey}`).limitToLast(1);
        const geofenceCallback = geofenceRef.on('child_added', (snap) => {
            const data = snap.val();
            if (!data) return;

            if (this.lastSeenGeofence === null) {
                this.lastSeenGeofence = snap.key;
                return;
            }

            if (snap.key !== this.lastSeenGeofence) {
                this.lastSeenGeofence = snap.key;
                const type = data.type === 'enter' ? '🚪 Entered' : '🚶 Exited';
                this.show(
                    '🔔 Geofence Alert',
                    `${type} zone ${data.fenceId ? '(' + data.fenceId.substring(0, 8) + ')' : ''}`,
                    { tag: 'geofence-' + snap.key, url: 'map.html' }
                );
            }
        });

        this.listeners.push({ ref: geofenceRef, event: 'child_added', callback: geofenceCallback });

        // Device status change
        const deviceRef = window.db.ref(`devices/${deviceKey}/lastSeen`);
        let wasOnline = null;
        const deviceCallback = deviceRef.on('value', (snap) => {
            const lastSeen = snap.val();
            if (!lastSeen) return;

            const isOnline = Date.now() - lastSeen < 5 * 60 * 1000;

            if (wasOnline === null) {
                wasOnline = isOnline;
                return;
            }

            if (wasOnline !== isOnline) {
                wasOnline = isOnline;
                this.show(
                    isOnline ? '🟢 Device Online' : '🔴 Device Offline',
                    isOnline ? 'Device ab online hai' : 'Device ne 5 min se update nahi bheja',
                    { tag: 'status-' + Date.now() }
                );
            }
        });

        this.listeners.push({ ref: deviceRef, event: 'value', callback: deviceCallback });

        console.log('[Notif] Monitoring started');
    },

    /**
     * Monitoring band karo.
     */
    stopMonitoring() {
        this.listeners.forEach(l => {
            try {
                l.ref.off(l.event, l.callback);
            } catch (_) {}
        });
        this.listeners = [];
        console.log('[Notif] Monitoring stopped');
    }
};
