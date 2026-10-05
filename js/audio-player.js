// ============================================
// CUSTOM AUDIO PLAYER
// Telegram URL se audio play karta hai
// ============================================

const AudioPlayer = {

    players: {},

    /**
     * Audio list render karo.
     */
    renderList(container, audios, options = {}) {
        if (!audios || audios.length === 0) {
            container.innerHTML = `
                <div class="gallery-empty">
                    <div class="gallery-empty-icon">🎤</div>
                    <div>Koi audio nahi</div>
                </div>
            `;
            return;
        }

        container.innerHTML = audios.map((a, i) => {
            const id = `audio_${i}_${Date.now()}`;
            return `
                <div class="audio-item">
                    <div class="audio-item-header">
                        <div class="audio-item-title">🎤 ${options.label || 'Recording'}</div>
                        <div class="audio-item-time">${timeAgo(a.time)}</div>
                    </div>
                    <div class="custom-audio">
                        <button class="audio-play-btn" data-audio-id="${id}" data-file-id="${a.fileId}">▶</button>
                        <div class="audio-progress" data-progress-id="${id}">
                            <div class="audio-progress-fill"></div>
                        </div>
                        <div class="audio-duration" data-duration-id="${id}">--:--</div>
                    </div>
                    <audio id="${id}" preload="none"></audio>
                </div>
            `;
        }).join('');

        // Setup handlers
        container.querySelectorAll('[data-audio-id]').forEach(btn => {
            const id = btn.dataset.audioId;
            const fileId = btn.dataset.fileId;
            const audioEl = document.getElementById(id);
            const progressEl = container.querySelector(`[data-progress-id="${id}"]`);
            const fillEl = progressEl.querySelector('.audio-progress-fill');
            const durationEl = container.querySelector(`[data-duration-id="${id}"]`);

            btn.addEventListener('click', async () => {
                if (audioEl.src) {
                    // Already loaded — just play/pause
                    this._toggle(audioEl, btn);
                    return;
                }

                // Load URL
                btn.disabled = true;
                btn.textContent = '⏳';

                const url = await Telegram.getFileUrl(fileId);
                if (!url) {
                    btn.disabled = false;
                    btn.textContent = '▶';
                    alert('Audio load fail hua');
                    return;
                }

                audioEl.src = url;
                btn.disabled = false;

                // Events
                audioEl.addEventListener('loadedmetadata', () => {
                    durationEl.textContent = formatDuration(audioEl.duration);
                });

                audioEl.addEventListener('timeupdate', () => {
                    if (audioEl.duration) {
                        const pct = (audioEl.currentTime / audioEl.duration) * 100;
                        fillEl.style.width = pct + '%';
                        durationEl.textContent = formatDuration(audioEl.currentTime);
                    }
                });

                audioEl.addEventListener('ended', () => {
                    btn.textContent = '▶';
                    btn.classList.remove('playing');
                    fillEl.style.width = '0%';
                    durationEl.textContent = formatDuration(audioEl.duration);
                });

                audioEl.addEventListener('error', () => {
                    alert('Audio play error');
                    btn.textContent = '▶';
                });

                // Progress click — seek
                progressEl.addEventListener('click', (e) => {
                    if (!audioEl.duration) return;
                    const rect = progressEl.getBoundingClientRect();
                    const pct = (e.clientX - rect.left) / rect.width;
                    audioEl.currentTime = pct * audioEl.duration;
                });

                audioEl.play();
                btn.textContent = '⏸';
                btn.classList.add('playing');
            });
        });
    },

    _toggle(audioEl, btn) {
        if (audioEl.paused) {
            audioEl.play();
            btn.textContent = '⏸';
            btn.classList.add('playing');
        } else {
            audioEl.pause();
            btn.textContent = '▶';
            btn.classList.remove('playing');
        }
    }
};

function formatDuration(sec) {
    if (!sec || isNaN(sec) || !isFinite(sec)) return '--:--';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

function timeAgo(timestamp) {
    if (!timestamp) return '—';
    const diff = Date.now() - timestamp;
    if (diff < 60_000) return 'Just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    if (diff < 2_592_000_000) return `${Math.floor(diff / 86_400_000)}d ago`;
    return new Date(timestamp).toLocaleDateString();
}
