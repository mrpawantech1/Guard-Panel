// ============================================
// DEVICES MANAGER
// Firebase se saare devices fetch karta hai
// ============================================

const Devices = {
    // State
    list: [],
    listeners: [],

    /**
     * Saare devices sunna shuru karo.
     */
    startListening(onUpdate) {
        console.log('[Devices] Starting listener');

        const ref = window.db.ref('devices');

        const callback = ref.on('value', (snap) => {
            const data = snap.val() || {};
            this.list = Object.keys(data).map(key => {
                const d = data[key] || {};
                return {
                    key: key,
                    info: d.info || {},
                    battery: d.battery || {},
                    network: d.network || {},
                    location: d.location || {},
                    currentApp: d.currentApp || {},
                    protection: d.protection || {},
                    lastSeen: d.lastSeen || 0,
                    status: this._computeStatus(d.lastSeen)
                };
            });

            // Sort — online first, then by lastSeen
            this.list.sort((a, b) => {
                if (a.status === 'online' && b.status !== 'online') return -1;
                if (a.status !== 'online' && b.status === 'online') return 1;
                return (b.lastSeen || 0) - (a.lastSeen || 0);
            });

            onUpdate(this.list);
        }, (error) => {
            console.error('[Devices] Listener error:', error);
        });

        this.listeners.push({ ref, callback });
    },

    /**
     * Status compute karo — lastSeen ke aadhar pe.
     */
    _computeStatus(lastSeen) {
        if (!lastSeen) return 'offline';
        const diff = Date.now() - lastSeen;
        // 5 minute ke andar = online
        return diff < 5 * 60 * 1000 ? 'online' : 'offline';
    },

    /**
     * Ek device ka live data sunna (dashboard ke liye).
     */
    watchDevice(deviceKey, onUpdate) {
        console.log('[Devices] Watching:', deviceKey);

        const ref = window.db.ref('devices/' + deviceKey);

        const callback = ref.on('value', (snap) => {
            const d = snap.val() || {};
            onUpdate({
                key: deviceKey,
                info: d.info || {},
                battery: d.battery || {},
                network: d.network || {},
                location: d.location || {},
                currentApp: d.currentApp || {},
                protection: d.protection || {},
                lastSeen: d.lastSeen || 0,
                status: this._computeStatus(d.lastSeen)
            });
        });

        return { ref, callback };
    },

    /**
     * Watch band karo.
     */
    unwatch(watcher) {
        if (watcher && watcher.ref) {
            watcher.ref.off('value', watcher.callback);
        }
    },

    /**
     * Saare listeners band karo.
     */
    stopAll() {
        this.listeners.forEach(l => l.ref.off('value', l.callback));
        this.listeners = [];
    },

    /**
     * Device ka naam nikalo (brand + model).
     */
    getDisplayName(device) {
        const info = device.info || {};
        const brand = info.brand || '';
        const model = info.model || '';
        if (brand && model) return `${brand} ${model}`;
        if (model) return model;
        return device.key.substring(0, 8);
    },

    /**
     * Time ago format.
     */
    timeAgo(timestamp) {
        if (!timestamp) return 'Kabhi nahi';
        const diff = Date.now() - timestamp;
        if (diff < 60_000) return 'Just now';
        if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
        if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
        return `${Math.floor(diff / 86_400_000)}d ago`;
    }
};
