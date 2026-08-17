/* =============================================================================
   Firebase + roster-sync config
   -----------------------------------------------------------------------------
   Project: utl-draft
   Make sure Realtime Database is created in Firebase Console.
   If connection fails, copy the exact databaseURL from:
   Build → Realtime Database → Data tab (browser URL / SDK snippet).
   ============================================================================ */

window.FIREBASE_CONFIG = {
  enabled: true,
  apiKey: 'AIzaSyAgyG6GkU0K9Oc27aFkkdt0vMiKmbe6-MM',
  authDomain: 'utl-draft.firebaseapp.com',
  databaseURL: 'https://utl-draft-default-rtdb.firebaseio.com',
  projectId: 'utl-draft',
  storageBucket: 'utl-draft.firebasestorage.app',
  messagingSenderId: '955242718154',
  appId: '1:955242718154:web:0a3dfae6f680ff3974e533',
  measurementId: 'G-LV5WXWP332',
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
