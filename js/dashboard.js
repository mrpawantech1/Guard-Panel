// ============================================
// DASHBOARD CONTROLLER
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('[Dashboard] Loaded');

    // Auth check
    if (!AUTH.isLoggedIn()) {
        window.location.href = 'index.html';
        return;
    }

    // Selected device key — URL se ya localStorage se
    let selectedDeviceKey = localStorage.getItem('selectedDevice') || null;
    let deviceWatcher = null;

    // ========== ELEMENTS ==========
    const devicesList = document.getElementById('devicesList');
    const selectedSection = document.getElementById('selectedDeviceSection');
    const selectedName = document.getElementById('selectedDeviceName');
    const selectedStatus = document.getElementById('selectedDeviceStatus');

    const batteryValue = document.getElementById('batteryValue');
    const networkValue = document.getElementById('networkValue');
    const locationValue = document.getElementById('locationValue');
    const currentAppValue = document.getElementById('currentAppValue');
    const protectionValue = document.getElementById('protectionValue');
    const lastSeenValue = document.getElementById('lastSeenValue');

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

    // ========== DEVICES LIST ==========
    Devices.startListening((devices) => {
        renderDevices(devices);

        // Agar selected device hai, toh section show karo
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

        // Click handlers
        devicesList.querySelectorAll('.device-card').forEach(card => {
            card.addEventListener('click', () => {
                const key = card.dataset.key;
                selectDevice(key);
            });
        });
    }

    function selectDevice(key) {
        console.log('[Dashboard] Selected:', key);
        selectedDeviceKey = key;
        localStorage.setItem('selectedDevice', key);

        // Re-render
        Devices.list.forEach(d => {
            const card = devicesList.querySelector(`[data-key="${d.key}"]`);
            if (card) {
                card.classList.toggle('active', d.key === key);
            }
        });

        const device = Devices.list.find(d => d.key === key);
        if (device) showDeviceSection(device);
    }

    function showDeviceSection(device) {
        selectedSection.classList.remove('hidden');

        // Name + status
        selectedName.textContent = Devices.getDisplayName(device);
        selectedStatus.textContent = device.status === 'online' ? '🟢 Online' : '🔴 Offline';
        selectedStatus.className = 'status-badge ' + device.status;

        // Watch this device's live data
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
        if (d.network && d.network.type) {
            networkValue.textContent = d.network.type;
        } else {
            networkValue.textContent = '—';
        }

        // Location
        if (d.location && d.location.lat) {
            locationValue.textContent = `${d.location.lat.toFixed(3)}, ${d.location.lng.toFixed(3)}`;
        } else {
            locationValue.textContent = '—';
        }

        // Current App
        if (d.currentApp && d.currentApp.name) {
            const ago = Devices.timeAgo(d.currentApp.time);
            currentAppValue.textContent = `${d.currentApp.name}`;
        } else {
            currentAppValue.textContent = '—';
        }

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
    }

    // ========== ACTION BUTTONS ==========
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!selectedDeviceKey) {
                showToast('Pehle koi device select karo', 'error');
                return;
            }

            const cmd = btn.dataset.cmd;
            await sendCommand(selectedDeviceKey, cmd);

            // Visual feedback
            btn.classList.add('sent');
            btn.disabled = true;
            setTimeout(() => {
                btn.classList.remove('sent');
                btn.disabled = false;
            }, 2000);
        });
    });

    /**
     * Command Firebase mein bhejo.
     */
    async function sendCommand(deviceKey, cmd) {
        try {
            const ref = window.db.ref('commands/' + deviceKey);
            await ref.set({
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

    // ========== HELPERS ==========
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
});
