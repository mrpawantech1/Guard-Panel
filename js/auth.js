// ============================================
// AUTHENTICATION
// Simple password → SHA-256 hash → Firebase compare
// ============================================

const AUTH = {
    // localStorage keys
    SESSION_KEY: 'guard_session',
    SESSION_EXPIRY_HOURS: 24 * 7, // 7 din

    // Firebase mein admin config path
    CONFIG_PATH: 'config/admin',

    /**
     * Password ka SHA-256 hash banao.
     */
    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    /**
     * Login attempt — password ko hash karke Firebase se compare karo.
     */
    async login(password, remember = true) {
        try {
            // 1. Password hash banao
            const hash = await this.hashPassword(password);

            // 2. Firebase se stored hash fetch karo
            const snap = await window.db.ref(this.CONFIG_PATH).once('value');
            const data = snap.val();

            // 3. Agar admin config nahi hai, toh pehli baar setup karo
            if (!data || !data.passwordHash) {
                // First-time setup
                await window.db.ref(this.CONFIG_PATH).set({
                    passwordHash: hash,
                    createdAt: Date.now(),
                    note: 'Change this hash to change password'
                });
                console.log('[Auth] First-time setup — password saved');
                this._saveSession(remember);
                return { success: true, firstTime: true };
            }

            // 4. Hash compare karo
            if (data.passwordHash === hash) {
                console.log('[Auth] Login success');
                this._saveSession(remember);
                return { success: true };
            } else {
                console.warn('[Auth] Wrong password');
                return { success: false, error: 'Galat password' };
            }
        } catch (e) {
            console.error('[Auth] Login error:', e);
            return { success: false, error: 'Connection error' };
        }
    },

    /**
     * Session save karo localStorage mein.
     */
    _saveSession(remember) {
        const expiry = Date.now() + (remember 
            ? this.SESSION_EXPIRY_HOURS * 60 * 60 * 1000 
            : 24 * 60 * 60 * 1000); // 1 din if not remember

        const session = {
            token: this._generateToken(),
            expiry: expiry,
            createdAt: Date.now()
        };

        if (remember) {
            localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
        } else {
            sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
        }
    },

    /**
     * Check karo — user logged in hai?
     */
    isLoggedIn() {
        const sessionStr = localStorage.getItem(this.SESSION_KEY) 
                        || sessionStorage.getItem(this.SESSION_KEY);
        if (!sessionStr) return false;

        try {
            const session = JSON.parse(sessionStr);
            if (Date.now() > session.expiry) {
                this.logout();
                return false;
            }
            return true;
        } catch (_) {
            return false;
        }
    },

    /**
     * Logout — session clear karo.
     */
    logout() {
        localStorage.removeItem(this.SESSION_KEY);
        sessionStorage.removeItem(this.SESSION_KEY);
        console.log('[Auth] Logged out');
    },

    /**
     * Random token banao.
     */
    _generateToken() {
        const arr = new Uint8Array(32);
        crypto.getRandomValues(arr);
        return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
    },

    /**
     * Password change karo (naya hash save).
     */
    async changePassword(newPassword) {
        try {
            const hash = await this.hashPassword(newPassword);
            await window.db.ref(this.CONFIG_PATH).update({
                passwordHash: hash,
                updatedAt: Date.now()
            });
            console.log('[Auth] Password changed');
            return { success: true };
        } catch (e) {
            console.error('[Auth] Change password error:', e);
            return { success: false, error: e.message };
        }
    }
};
