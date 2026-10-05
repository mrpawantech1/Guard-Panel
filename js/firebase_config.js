// ============================================
// FIREBASE CONFIG
// Ye values google-services.json se lo
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

// Initialize Firebase (global)
firebase.initializeApp(firebaseConfig);

// Global references
window.db = firebase.database();
window.firebaseReady = true;

console.log('[Firebase] Initialized:', firebaseConfig.projectId);
