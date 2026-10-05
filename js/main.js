// ============================================
// MAIN — Login Page Controller
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('[Main] Login page loaded');

    // Agar already logged in hai, toh dashboard pe bhejo
    if (AUTH.isLoggedIn()) {
        console.log('[Main] Already logged in — redirecting');
        window.location.href = 'dashboard.html';
        return;
    }

    // Form elements
    const form = document.getElementById('loginForm');
    const passwordInput = document.getElementById('password');
    const rememberCheckbox = document.getElementById('rememberMe');
    const loginBtn = document.getElementById('loginBtn');
    const loginBtnText = document.getElementById('loginBtnText');
    const errorEl = document.getElementById('loginError');

    // Form submit handler
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const password = passwordInput.value.trim();
        if (!password) {
            errorEl.textContent = 'Password daalo';
            return;
        }

        // Loading state
        loginBtn.disabled = true;
        loginBtnText.innerHTML = '<span class="loader"></span>Signing in...';
        errorEl.textContent = '';

        // Login attempt
        const result = await AUTH.login(password, rememberCheckbox.checked);

        if (result.success) {
            errorEl.style.color = 'var(--success)';
            errorEl.textContent = result.firstTime 
                ? 'First-time setup complete! Redirecting...' 
                : 'Login successful! Redirecting...';

            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 800);
        } else {
            errorEl.style.color = 'var(--error)';
            errorEl.textContent = result.error || 'Login failed';
            loginBtn.disabled = false;
            loginBtnText.textContent = 'Sign In';
            passwordInput.value = '';
            passwordInput.focus();
        }
    });

    // Auto-focus password input
    passwordInput.focus();
});
