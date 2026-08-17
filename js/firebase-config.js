/* =============================================================================
   Firebase + roster-sync config
   -----------------------------------------------------------------------------
   1) Create a Firebase project → Realtime Database
   2) Paste your web app config below (Firebase console → Project settings)
   3) Use open test rules only while drafting, then lock them down
   4) Optional: set rosterSync.endpoint to a Worker that commits team
      changes to GitHub (see .github/workflows/roster-assign.yml)
   ============================================================================ */

window.FIREBASE_CONFIG = {
  // Set enabled: true after pasting a real Firebase web config.
  enabled: false,
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  databaseURL: 'https://YOUR_PROJECT-default-rtdb.firebaseio.com',
  projectId: 'YOUR_PROJECT',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

/* Commissioner PIN checked client-side (casual protection). Change this. */
window.DRAFT_CONFIG = {
  roomId: 'season5',
  commissionerPin: 'deepend',
  /* Optional HTTPS endpoint that accepts:
       POST { playerId, teamId, pin }
     and triggers the roster-assign GitHub Action / commits to main. */
  rosterSync: {
    endpoint: '', // e.g. 'https://roster-sync.your-worker.workers.dev'
  },
};
