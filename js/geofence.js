// ============================================
// GEOFENCE MANAGER
// ============================================

const Geofence = {
    list: [],
    listener: null,
    deviceKey: null,
    map: null,
    layerGroup: null,

    init(deviceKey, map, layerGroup) {
        this.deviceKey = deviceKey;
        this.map = map;
        this.layerGroup = layerGroup;
        this.startListening();
    },

    startListening() {
        if (!this.deviceKey) return;

        const ref = window.db.ref('geofences/' + this.deviceKey);

        const callback = ref.on('value', (snap) => {
            const data = snap.val() || {};
            this.list = Object.keys(data).map(id => ({
                id: id,
                ...data[id]
            }));

            this.renderOnMap();
            this.updateUI();
        });

        this.listener = { ref, callback };
    },

    renderOnMap() {
        if (!this.layerGroup) return;
        this.layerGroup.clearLayers();

        this.list.forEach(fence => {
            if (!fence.lat || !fence.lng) return;

            const radius = fence.radius || 200;

            const circle = L.circle([fence.lat, fence.lng], {
                radius: radius,
                color: '#0F3460',
                fillColor: '#0F3460',
                fillOpacity: 0.15,
                weight: 2
            });

            const marker = L.circleMarker([fence.lat, fence.lng], {
                radius: 6,
                color: '#FFFFFF',
                fillColor: '#0F3460',
                fillOpacity: 1,
                weight: 2
            });

            marker.bindPopup(`
                <div style="font-family: sans-serif; min-width: 120px;">
                    <strong>${this._escape(fence.name || 'Geofence')}</strong><br>
                    <small>Radius: ${radius}m</small><br>
                    <small>Alert: ${fence.alertOn || 'both'}</small>
                </div>
            `);

            circle.addTo(this.layerGroup);
            marker.addTo(this.layerGroup);
        });
    },

    async add(name, lat, lng, radius, alertOn) {
        try {
            await window.db.ref('geofences/' + this.deviceKey).push({
                name: name || 'Zone',
                lat: lat,
                lng: lng,
                radius: radius || 200,
                alertOn: alertOn || 'both',
                createdAt: Date.now(),
                enabled: true
            });

            await window.db.ref('commands/' + this.deviceKey).set({
                cmd: 'GEOFENCE_ADD',
                status: 'pending',
                sentAt: Date.now()
            });

            return { success: true };
        } catch (e) {
            console.error('[Geofence] Add error:', e);
            return { success: false, error: e.message };
        }
    },

    async remove(id) {
        try {
            await window.db.ref('geofences/' + this.deviceKey + '/' + id).remove();

            await window.db.ref('commands/' + this.deviceKey).set({
                cmd: 'GEOFENCE_DEL',
                status: 'pending',
                sentAt: Date.now()
            });

            return { success: true };
        } catch (e) {
            console.error('[Geofence] Remove error:', e);
            return { success: false, error: e.message };
        }
    },

    updateUI() {
        const listEl = document.getElementById('geofenceList');
        const countEl = document.getElementById('geofenceCount');
        if (!listEl || !countEl) return;

        countEl.textContent = this.list.length;

        if (this.list.length === 0) {
            listEl.innerHTML = '<div class="geofence-empty">Koi geofence nahi hai</div>';
            return;
        }

        listEl.innerHTML = this.list.map(f => `
            <div class="geofence-item">
                <div class="geofence-item-info">
                    <div class="geofence-item-name">📍 ${this._escape(f.name || 'Zone')}</div>
                    <div class="geofence-item-details">
                        ${f.radius || 200}m • ${f.alertOn || 'both'}
                    </div>
                </div>
                <button class="geofence-del-btn" data-id="${f.id}">🗑️</button>
            </div>
        `).join('');

        listEl.querySelectorAll('[data-id]').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Ye geofence delete karein?')) return;
                const result = await this.remove(btn.dataset.id);
                if (result.success) {
                    this._toast('Geofence deleted', 'success');
                } else {
                    this._toast('Delete fail hua', 'error');
                }
            });
        });
    },

    destroy() {
        if (this.listener) {
            this.listener.ref.off('value', this.listener.callback);
            this.listener = null;
        }
    },

    _escape(str) {
        if (!str) return '';
        return str.replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;',
            '"': '&quot;', "'": '&#39;'
        }[c]));
    },

    _toast(msg, type) {
        if (window.showToast) window.showToast(msg, type);
    }
};
