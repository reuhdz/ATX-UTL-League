/* =============================================================================
   Firebase + draft config
   -----------------------------------------------------------------------------
   Project: utl-draft
   Captain PINs = "utl" + team name as one lowercase word.
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

window.DRAFT_CONFIG = {
  roomId: 'season5',
  /* Snake draft first-round order by captain: River, Zach, Reuben, Rich */
  draftOrder: ['team3', 'team2', 'capybara', 'team1'],
  /* Captains are pre-assigned and excluded from the draft pool */
  captainIds: ['river', 'zach', 'reuben', 'rich'],
  /* Other locked roster spots (not captains) — keep team, skip draft */
  preAssignedIds: ['travis'],
  /* Master PIN can pick on any turn */
  turnSeconds: 120, // 2 minutes per pick
  masterPin: 'utlmaster',
  /* utl + team name (one word, lowercase) */
  teamPins: {
    team3: 'utlsplashdamage',   // River — Splash Damage
    team2: 'utllonestarfish',   // Zach — Lone Starfish
    capybara: 'utlcapybara',    // Reuben — Capybara
    team1: 'utlflyinghellfish', // Rich — Flying Hellfish
  },
  rosterSync: {
    endpoint: '',
  },
};
