/* =============================================================================
   Draft hub — Firebase live draft + team assignment form
   -----------------------------------------------------------------------------
   Paths in Realtime Database:
     /drafts/{roomId}     live draft state
     /rosterAssignments   { [playerId]: { teamId, updatedAt, by } }
   When Firebase is disabled/unconfigured, falls back to localStorage so the
   UI is still usable for single-device testing.
   ============================================================================ */

const DraftHub = (() => {
  const cfg = () => window.DRAFT_CONFIG || {};
  const fbCfg = () => window.FIREBASE_CONFIG || {};
  const roomId = () => cfg().roomId || 'season5';

  const BASE_TEAMS = Object.fromEntries(
    (window.DB?.players || []).map((p) => [p.id, p.teamId])
  );

  let db = null;
  let mode = 'local'; // 'firebase' | 'local'
  let connectionError = null;
  let connected = false;
  let unsubDraft = null;
  let unsubRoster = null;
  let unsubConn = null;
  let draftState = null;
  let assignments = {};
  const listeners = new Set();

  function emit() {
    listeners.forEach((fn) => {
      try { fn({ draft: draftState, assignments, mode, connectionError, connected }); } catch (e) { /* ignore */ }
    });
  }

  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function isConfigured() {
    const c = fbCfg();
    return !!(c.enabled && c.apiKey && c.apiKey !== 'YOUR_API_KEY' && c.databaseURL
      && !String(c.databaseURL).includes('YOUR_PROJECT') && window.firebase);
  }

  function localKey(kind) {
    return `atxutl.${kind}.${roomId()}`;
  }

  function readLocal(kind, fallback) {
    try {
      const raw = localStorage.getItem(localKey(kind));
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }

  function writeLocal(kind, value) {
    try { localStorage.setItem(localKey(kind), JSON.stringify(value)); } catch (e) { /* ignore */ }
  }

  function defaultDraft() {
    const pool = (window.DB?.season5RosterIds || []).slice();
    const teamIds = (window.DB?.teams || []).map((t) => t.id);
    // Snake order across 4 rounds of picks (enough for a full S5 pool)
    const order = [];
    const rounds = Math.ceil(pool.length / Math.max(teamIds.length, 1));
    for (let r = 0; r < rounds; r++) {
      const seq = r % 2 === 0 ? teamIds : [...teamIds].reverse();
      order.push(...seq);
    }
    return {
      status: 'idle',
      pickIndex: 0,
      order,
      pool,
      picks: [],
      updatedAt: Date.now(),
    };
  }

  function applyAssignments(map) {
    assignments = map || {};
    const players = window.DB?.players || [];
    players.forEach((p) => {
      const base = BASE_TEAMS[p.id] ?? 'fa';
      p.teamId = assignments[p.id]?.teamId || base;
    });
  }

  async function probeDatabase(url) {
    try {
      const res = await fetch(`${url.replace(/\/$/, '')}/.json`, { method: 'GET' });
      const text = await res.text();
      if (res.status === 404) {
        throw new Error(
          'Realtime Database not found at databaseURL (404). In Firebase Console create Build → Realtime Database (not Firestore), then paste the exact DB URL into js/firebase-config.js.'
        );
      }
      if (res.status === 401 || res.status === 403 || text.includes('Permission denied')) {
        // Reachable but locked — still a valid DB URL.
        return { ok: true, locked: true };
      }
      return { ok: true, locked: false };
    } catch (e) {
      if (e.message.includes('Realtime Database not found')) throw e;
      throw new Error(`Cannot reach databaseURL (${url}): ${e.message}`);
    }
  }

  async function init() {
    // Capture base teams once DB is present
    (window.DB?.players || []).forEach((p) => {
      if (!(p.id in BASE_TEAMS)) BASE_TEAMS[p.id] = p.teamId;
    });

    connectionError = null;
    connected = false;

    if (isConfigured()) {
      try {
        await probeDatabase(fbCfg().databaseURL);
        if (!firebase.apps.length) firebase.initializeApp(fbCfg());
        db = firebase.database();
        mode = 'firebase';
      } catch (e) {
        console.warn('Firebase init failed, using local mode', e);
        connectionError = e.message || String(e);
        mode = 'local';
      }
    } else {
      mode = 'local';
      if (!window.firebase) {
        connectionError = 'Firebase SDK failed to load (CDN blocked?).';
      } else if (!fbCfg().enabled) {
        connectionError = 'Firebase config enabled flag is false.';
      }
    }

    if (mode === 'firebase') {
      const draftRef = db.ref(`drafts/${roomId()}`);
      const rosterRef = db.ref('rosterAssignments');
      unsubConn = db.ref('.info/connected').on('value', (snap) => {
        connected = !!snap.val();
        emit();
      });
      unsubDraft = draftRef.on('value', (snap) => {
        draftState = snap.val() || defaultDraft();
        connectionError = null;
        emit();
      }, (err) => {
        connectionError = `Draft sync error: ${err?.message || err}`;
        emit();
      });
      unsubRoster = rosterRef.on('value', (snap) => {
        applyAssignments(snap.val() || {});
        emit();
      }, (err) => {
        connectionError = `Roster sync error: ${err?.message || err}`;
        emit();
      });
      // Ensure draft node exists
      try {
        const snap = await draftRef.once('value');
        if (!snap.exists()) await draftRef.set(defaultDraft());
      } catch (e) {
        connectionError = `Cannot write draft state: ${e.message || e}. Check Realtime Database rules (test mode).`;
        mode = 'local';
        draftState = readLocal('draft', defaultDraft());
        applyAssignments(readLocal('roster', {}));
        emit();
      }
    } else {
      draftState = readLocal('draft', defaultDraft());
      applyAssignments(readLocal('roster', {}));
      emit();
    }

    return { mode, configured: mode === 'firebase', connectionError };
  }

  function checkPin(pin) {
    return String(pin || '') === String(cfg().commissionerPin || '');
  }

  async function setDraft(next) {
    next = { ...next, updatedAt: Date.now() };
    draftState = next;
    if (mode === 'firebase') {
      try {
        await db.ref(`drafts/${roomId()}`).set(next);
      } catch (e) {
        connectionError = `Draft write failed: ${e.message || e}`;
        emit();
        throw new Error(connectionError);
      }
    } else {
      writeLocal('draft', next);
      emit();
    }
  }

  async function startDraft(pin) {
    if (!checkPin(pin)) throw new Error('Wrong commissioner PIN');
    const fresh = defaultDraft();
    fresh.status = 'live';
    await setDraft(fresh);
  }

  async function resetDraft(pin) {
    if (!checkPin(pin)) throw new Error('Wrong commissioner PIN');
    await setDraft(defaultDraft());
  }

  async function makePick(playerId, pin) {
    if (!checkPin(pin)) throw new Error('Wrong commissioner PIN');
    const d = { ...(draftState || defaultDraft()) };
    if (d.status !== 'live') throw new Error('Draft is not live');
    if (!d.pool.includes(playerId)) throw new Error('Player not in pool');
    const teamId = d.order[d.pickIndex];
    if (!teamId) throw new Error('Draft is complete');

    d.pool = d.pool.filter((id) => id !== playerId);
    d.picks = [...(d.picks || []), { playerId, teamId, at: Date.now() }];
    d.pickIndex += 1;
    if (d.pickIndex >= d.order.length || d.pool.length === 0) d.status = 'done';
    await setDraft(d);
    await assignTeam(playerId, teamId, pin, { fromDraft: true });
  }

  async function syncGithub(playerId, teamId, pin) {
    const endpoint = cfg().rosterSync?.endpoint;
    if (!endpoint) return { skipped: true, reason: 'No rosterSync.endpoint configured' };
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, teamId, pin }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`GitHub sync failed (${res.status}) ${text}`.trim());
    }
    return res.json().catch(() => ({ ok: true }));
  }

  async function assignTeam(playerId, teamId, pin, opts = {}) {
    if (!checkPin(pin)) throw new Error('Wrong commissioner PIN');
    const validTeam = teamId === 'fa' || (window.DB?.teams || []).some((t) => t.id === teamId);
    if (!validTeam) throw new Error('Unknown team');
    if (!window.DB?.player(playerId)) throw new Error('Unknown player');

    const entry = { teamId, updatedAt: Date.now(), by: opts.fromDraft ? 'draft' : 'form' };
    const next = { ...assignments, [playerId]: entry };

    if (mode === 'firebase') {
      try {
        await db.ref(`rosterAssignments/${playerId}`).set(entry);
      } catch (e) {
        throw new Error(`Roster write failed: ${e.message || e}`);
      }
    } else {
      writeLocal('roster', next);
      applyAssignments(next);
      emit();
    }

    let github = { skipped: true };
    if (!opts.fromDraft || opts.syncGithub) {
      try { github = await syncGithub(playerId, teamId, pin); }
      catch (e) { github = { ok: false, error: e.message }; }
    }
    return { ok: true, github };
  }

  function status() {
    return {
      mode,
      configured: mode === 'firebase',
      connected,
      connectionError,
      draft: draftState,
      assignments,
      databaseURL: fbCfg().databaseURL || '',
      currentTeamId: draftState?.status === 'live'
        ? draftState.order?.[draftState.pickIndex] || null
        : null,
    };
  }

  return {
    init, onChange, status, checkPin,
    startDraft, resetDraft, makePick, assignTeam,
    defaultDraft,
  };
})();

window.DraftHub = DraftHub;
