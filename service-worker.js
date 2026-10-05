// ============================================
// SERVICE WORKER — Offline Support
// ============================================

const CACHE_NAME = 'guard-panel-v1';
const CACHE_URLS = [
    '/',
    '/index.html',
    '/dashboard.html',
    '/gallery.html',
    '/live.html',
    '/css/style.css',
    '/css/dashboard.css',
    '/css/gallery.css',
    '/js/firebase-config.js',
    '/js/auth.js',
    '/js/main.js',
    '/js/devices.js',
    '/js/dashboard.js',
    '/js/commands.js',
    '/js/telegram.js',
    '/js/gallery.js',
    '/js/audio-player.js',
    '/js/live.js'
];

// Install — cache files
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(CACHE_URLS.map(u => new Request(u, { cache: 'reload' })))
                .catch(err => console.warn('[SW] Cache addAll partial fail', err));
        })
    );
    self.skipWaiting();
});

// Activate — purane caches clear
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            );
        })
    );
    self.clients.claim();
});

// Fetch — cache-first for static, network-first for others
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Firebase requests bypass — always network
    if (url.hostname.includes('firebase') || 
        url.hostname.includes('googleapis') ||
        url.hostname.includes('telegram') ||
        url.hostname.includes('corsproxy') ||
        url.hostname.includes('allorigins')) {
        return;
    }

    // Same-origin static files — cache-first
    if (url.origin === location.origin) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                if (cached) return cached;
                return fetch(event.request).then((response) => {
                    // Cache naye responses
                    if (response && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, clone);
                        });
                    }
                    return response;
                }).catch(() => cached);
            })
        );
    }
});
