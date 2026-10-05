// ============================================
// FIREBASE CONFIG
// ============================================

const firebaseConfig = {
    apiKey: "AIzaSyB-DDZ5Eqdq1omKPYPHYXpQ35yzYge5oM8",
    authDomain: "guard-agent.firebaseapp.com",
    databaseURL: "https://guard-agent-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "guard-agent",
    storageBucket: "guard-agent.firebasestorage.app",
    messagingSenderId: "71081143323",
    appId: "1:71081143323:android:8af955325aa254794d9cbe"
};

// ============================================
// ⭐ TELEGRAM CONFIG — YAHAN APNI VALUES DAALO
// ============================================

const TELEGRAM_CONFIG = {
    // BotFather se mila token — EXACT paste karo
    botToken: "8701042265:AAFOrTlh1olcDxEA005KSdxt3vu953lRpas",

    // userinfobot se mila Chat ID (number, quotes ke andar)
    chatId: "8606290013"
};

// ============================================
// INITIALIZE
// ============================================

firebase.initializeApp(firebaseConfig);

// Global references (baaki scripts use karti hain)
window.db = firebase.database();
window.firebaseReady = true;
window.TELEGRAM = TELEGRAM_CONFIG;

console.log('[Firebase] Initialized:', firebaseConfig.projectId);
console.log('[Telegram] Bot configured:', TELEGRAM_CONFIG.botToken !== "7845XXXXX:AAH_YOUR_REAL_TOKEN_HERE" ? 'YES' : 'NO — please set token!');
