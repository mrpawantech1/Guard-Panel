// ============================================
// TELEGRAM FILE FETCHER
// file_id → file_path → direct URL
// ============================================

const Telegram = {
    // Cache in memory + localStorage
    cache: {},
    CACHE_KEY: 'tg_file_cache',
    CACHE_TTL: 50 * 60 * 1000, // 50 min (Telegram 1hr tak valid rakhta hai)

    /**
     * Init — cache load karo.
     */
    init() {
        try {
            const stored = localStorage.getItem(this.CACHE_KEY);
            if (stored) {
                this.cache = JSON.parse(stored);
                // Expired entries hatao
                const now = Date.now();
                Object.keys(this.cache).forEach(k => {
                    if (now - this.cache[k].ts > this.CACHE_TTL) {
                        delete this.cache[k];
                    }
                });
                console.log('[Telegram] Cache loaded:', Object.keys(this.cache).length);
            }
        } catch (e) {
            console.warn('[Telegram] Cache load failed', e);
            this.cache = {};
        }
    },

    /**
     * file_id se direct URL banao (cached ya fetch).
     * Returns: URL string ya null
     */
    async getFileUrl(fileId) {
        if (!fileId) return null;

        // Cache check
        const cached = this.cache[fileId];
        if (cached && (Date.now() - cached.ts < this.CACHE_TTL)) {
            return cached.url;
        }

        // Fetch new
        try {
            const filePath = await this._fetchFilePath(fileId);
            if (!filePath) return null;

            const url = `https://api.telegram.org/file/bot${window.TELEGRAM.botToken}/${filePath}`;

            // Save cache
            this.cache[fileId] = { url, ts: Date.now() };
            this._saveCache();

            return url;
        } catch (e) {
            console.error('[Telegram] getFileUrl error:', e);
            return null;
        }
    },

    /**
     * getFile API call (CORS proxy ke through).
     */
    async _fetchFilePath(fileId) {
        const apiUrl = `https://api.telegram.org/bot${window.TELEGRAM.botToken}/getFile?file_id=${fileId}`;
        const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(apiUrl)}`;

        try {
            const res = await fetch(proxyUrl);
            if (!res.ok) throw new Error('HTTP ' + res.status);

            const data = await res.json();
            if (!data.ok) throw new Error('Telegram API error');

            return data.result?.file_path || null;
        } catch (e) {
            console.warn('[Telegram] Direct proxy failed, trying allorigins...', e);

            // Fallback — allorigins
            try {
                const fallbackUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(apiUrl)}`;
                const res2 = await fetch(fallbackUrl);
                const data2 = await res2.json();
                if (!data2.ok) throw new Error('Telegram API error');
                return data2.result?.file_path || null;
            } catch (e2) {
                console.error('[Telegram] Both proxies failed', e2);
                return null;
            }
        }
    },

    /**
     * Cache ko localStorage mein save karo.
     */
    _saveCache() {
        try {
            localStorage.setItem(this.CACHE_KEY, JSON.stringify(this.cache));
        } catch (e) {
            // localStorage full — old entries clear karo
            this.cache = {};
            localStorage.removeItem(this.CACHE_KEY);
        }
    },

    /**
     * Cache clear.
     */
    clearCache() {
        this.cache = {};
        localStorage.removeItem(this.CACHE_KEY);
    },

    /**
     * File delete karne ki koshish (Telegram bot API se).
     */
    async deleteMessage(messageId) {
        try {
            const apiUrl = `https://api.telegram.org/bot${window.TELEGRAM.botToken}/deleteMessage?chat_id=${window.TELEGRAM.chatId}&message_id=${messageId}`;
            const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(apiUrl)}`;
            await fetch(proxyUrl);
            return true;
        } catch (e) {
            console.warn('[Telegram] delete failed', e);
            return false;
        }
    }
};

// Init on load
Telegram.init();
