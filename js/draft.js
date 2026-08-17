/* =============================================================================
   Draft hub — Firebase live draft
   -----------------------------------------------------------------------------
   Paths in Realtime Database:
     /drafts/{roomId}     live draft state
     /rosterAssignments   { [playerId]: { teamId, updatedAt, by } }
   Falls back to localStorage when Firebase is unavailable.
   ============================================================================ */

const DraftHub = (() => {
  const cfg = () => window.DRAFT_CONFIG || {};
  const fbCfg = () => window.FIREBASE_CONFIG || {};
  const roomId = () => cfg().roomId || 'season5';

  const BASE_TEAMS = Object.fromEntries(
    (window.DB?.players || []).map((p) => [p.id, p.teamId])
  );

  let db = null;
  let mode = 'local';
  let connectionError = null;
  let connected = false;
  let unsubDraft = null;
  let unsubRoster = null;
  let unsubConn = null;
  let draftState = null;
  let assignments = {};
  let expireTimer = null;
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

  function captainIds() {
    return cfg().captainIds || ['river', 'zach', 'reuben', 'rich'];
  }

  function draftTeamOrder() {
    return cfg().draftOrder || ['team3', 'team2', 'capybara', 'team1'];
  }

  function turnSeconds() {
    return Number(cfg().turnSeconds) || 120;
  }

  function normalizePin(pin) {
    return String(pin || '').trim().toLowerCase();
  }

  function teamPin(teamId) {
    return normalizePin((cfg().teamPins || {})[teamId]);
  }

  function checkTeamPin(pin, teamId) {
    const expected = teamPin(teamId);
    return !!expected && normalizePin(pin) === expected;
  }

  function checkMasterPin(pin) {
    const expected = normalizePin(cfg().masterPin || '');
    return !!expected && normalizePin(pin) === expected;
  }

  function isAnyCaptainPin(pin) {
    return Object.keys(cfg().teamPins || {}).some((tid) => checkTeamPin(pin, tid));
  }

  function canAuthorizeReset(pin) {
    return checkMasterPin(pin) || isAnyCaptainPin(pin);
  }

  function teamIdForCaptainPin(pin) {
    const pins = cfg().teamPins || {};
    return Object.keys(pins).find((tid) => checkTeamPin(pin, tid)) || null;
  }

  function emptyReady() {
    return Object.fromEntries(draftTeamOrder().map((id) => [id, false]));
  }

  function allCaptainsReady(ready) {
    return draftTeamOrder().every((id) => !!(ready && ready[id]));
  }

  function defaultDraft() {
    const captains = new Set(captainIds());
    const pool = (window.DB?.season5RosterIds || []).filter((id) => !captains.has(id));
    const teamIds = draftTeamOrder();
    const order = [];
    const rounds = Math.ceil(pool.length / Math.max(teamIds.length, 1));
    for (let r = 0; r < rounds; r++) {
      const seq = r % 2 === 0 ? teamIds : [...teamIds].reverse();
      order.push(...seq);
    }
    return {
      status: 'waiting', // waiting for captains to ready / master start
      pickIndex: 0,
      order,
      pool,
      picks: [],
      ready: emptyReady(),
      turnStartedAt: null,
      turnSeconds: turnSeconds(),
      updatedAt: Date.now(),
    };
  }

  function normalizeDraft(raw) {
    const base = defaultDraft();
    if (!raw || typeof raw !== 'object') return base;
    const ready = { ...base.ready, ...(raw.ready || {}) };
    let status = raw.status || 'waiting';
    if (status === 'idle') status = 'waiting';
    return {
      ...base,
      ...raw,
      status,
      ready,
      turnSeconds: raw.turnSeconds || turnSeconds(),
      pool: Array.isArray(raw.pool) ? raw.pool : base.pool,
      order: Array.isArray(raw.order) ? raw.order : base.order,
      picks: Array.isArray(raw.picks) ? raw.picks : [],
    };
  }

  function applyAssignments(map) {
    assignments = map || {};
    const captains = new Set(captainIds());
    const players = window.DB?.players || [];
    players.forEach((p) => {
      if (assignments[p.id]?.teamId) {
        p.teamId = assignments[p.id].teamId;
        return;
      }
      p.teamId = captains.has(p.id) ? (BASE_TEAMS[p.id] || p.teamId) : 'fa';
    });
  }

  function turnRemainingMs(d = draftState) {
    if (!d || d.status !== 'live' || !d.turnStartedAt) return null;
    const total = (d.turnSeconds || turnSeconds()) * 1000;
    return Math.max(0, total - (Date.now() - d.turnStartedAt));
  }

  function scheduleExpireWatch() {
    if (expireTimer) clearInterval(expireTimer);
    expireTimer = setInterval(() => {
      const d = draftState;
      if (!d || d.status !== 'live' || !d.turnStartedAt) return;
      const left = turnRemainingMs(d);
      emit(); // keep clocks painting
      if (left === 0) {
        expireTurn().catch(() => { /* another client may win the race */ });
      }
    }, 250);
  }

  async function probeDatabase(url) {
    try {
      const res = await fetch(`${url.replace(/\/$/, '')}/.json`, { method: 'GET' });
      const text = await res.text();
      if (res.status === 404) {
        throw new Error('Realtime Database not found at databaseURL (404).');
      }
      if (res.status === 401 || res.status === 403 || text.includes('Permission denied')) {
        return { ok: true, locked: true };
      }
      return { ok: true, locked: false };
    } catch (e) {
      if (e.message.includes('Realtime Database not found')) throw e;
      throw new Error(`Cannot reach databaseURL (${url}): ${e.message}`);
    }
  }

  async function init() {
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
    }

    if (mode === 'firebase') {
      const draftRef = db.ref(`drafts/${roomId()}`);
      const rosterRef = db.ref('rosterAssignments');
      unsubConn = db.ref('.info/connected').on('value', (snap) => {
        connected = !!snap.val();
        emit();
      });
      unsubDraft = draftRef.on('value', (snap) => {
        draftState = normalizeDraft(snap.val());
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
      try {
        const snap = await draftRef.once('value');
        if (!snap.exists()) await draftRef.set(defaultDraft());
        else draftState = normalizeDraft(snap.val());
      } catch (e) {
        connectionError = `Cannot write draft state: ${e.message || e}`;
        mode = 'local';
        draftState = normalizeDraft(readLocal('draft', defaultDraft()));
        applyAssignments(readLocal('roster', {}));
        emit();
      }
    } else {
      draftState = normalizeDraft(readLocal('draft', defaultDraft()));
      applyAssignments(readLocal('roster', {}));
      emit();
    }

    scheduleExpireWatch();
    return { mode, configured: mode === 'firebase', connectionError };
  }

  async function setDraft(next) {
    next = normalizeDraft({ ...next, updatedAt: Date.now() });
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

  async function clearDraftAssignments() {
    const captains = new Set(captainIds());

    if (mode === 'firebase') {
      try {
        await db.ref('rosterAssignments').remove();
      } catch (e) {
        throw new Error(`Could not clear roster assignments: ${e.message || e}`);
      }
    } else {
      writeLocal('roster', {});
    }

    assignments = {};
    const players = window.DB?.players || [];
    players.forEach((p) => {
      if (captains.has(p.id)) {
        p.teamId = BASE_TEAMS[p.id] || p.teamId;
      } else {
        p.teamId = 'fa';
        BASE_TEAMS[p.id] = 'fa';
      }
    });
    emit();
  }

  function beginLive(from) {
    return {
      ...from,
      status: 'live',
      pickIndex: 0,
      picks: [],
      turnStartedAt: Date.now(),
      turnSeconds: turnSeconds(),
    };
  }

  async function startDraft(pin) {
    const d = normalizeDraft(draftState || defaultDraft());
    if (d.status === 'live') throw new Error('Draft is already live');
    if (d.status === 'done') throw new Error('Draft is complete — reset first');

    if (checkMasterPin(pin)) {
      const ready = emptyReady();
      draftTeamOrder().forEach((id) => { ready[id] = true; });
      const next = beginLive({ ...d, ready, pool: defaultDraft().pool, order: defaultDraft().order });
      await setDraft(next);
      return { started: true, by: 'master' };
    }

    const teamId = teamIdForCaptainPin(pin);
    if (!teamId) throw new Error('Enter your captain PIN to ready up (or master PIN to start)');

    const ready = { ...(d.ready || emptyReady()), [teamId]: true };
    let next = {
      ...d,
      status: 'waiting',
      ready,
      pool: d.pool?.length ? d.pool : defaultDraft().pool,
      order: d.order?.length ? d.order : defaultDraft().order,
    };

    if (allCaptainsReady(ready)) {
      next = beginLive(next);
      await setDraft(next);
      return { started: true, by: 'all-ready', teamId };
    }

    await setDraft(next);
    return { started: false, teamId, ready };
  }

  async function resetDraft(pin) {
    if (!canAuthorizeReset(pin)) throw new Error('Enter master or captain PIN to reset');
    await clearDraftAssignments();
    await setDraft(defaultDraft());
  }

  async function advanceTurn(d, extraPick) {
    const picks = [...(d.picks || [])];
    if (extraPick) picks.push(extraPick);
    let pickIndex = (d.pickIndex || 0) + 1;
    let status = d.status;
    let turnStartedAt = Date.now();
    if (pickIndex >= (d.order || []).length || (d.pool || []).length === 0) {
      status = 'done';
      turnStartedAt = null;
    }
    return { ...d, picks, pickIndex, status, turnStartedAt, turnSeconds: turnSeconds() };
  }

  async function expireTurn() {
    const d = normalizeDraft(draftState || defaultDraft());
    if (d.status !== 'live' || !d.turnStartedAt) return;
    if (turnRemainingMs(d) > 0) return;

    const teamId = d.order[d.pickIndex];
    // Avoid double-skip across clients: only skip if this turnStartedAt is still current.
    if (mode === 'firebase') {
      const ref = db.ref(`drafts/${roomId()}`);
      const result = await ref.transaction((cur) => {
        if (!cur || cur.status !== 'live') return cur;
        if (cur.turnStartedAt !== d.turnStartedAt) return cur; // already advanced
        if (Date.now() - cur.turnStartedAt < (cur.turnSeconds || turnSeconds()) * 1000) return cur;
        const skippedTeam = cur.order[cur.pickIndex];
        const picks = [...(cur.picks || []), { skipped: true, teamId: skippedTeam, at: Date.now() }];
        let pickIndex = (cur.pickIndex || 0) + 1;
        let status = 'live';
        let turnStartedAt = Date.now();
        if (pickIndex >= (cur.order || []).length || (cur.pool || []).length === 0) {
          status = 'done';
          turnStartedAt = null;
        }
        return {
          ...cur,
          picks,
          pickIndex,
          status,
          turnStartedAt,
          turnSeconds: turnSeconds(),
          updatedAt: Date.now(),
        };
      });
      if (result.snapshot) draftState = normalizeDraft(result.snapshot.val());
      emit();
      return;
    }

    const next = await advanceTurn(d, { skipped: true, teamId, at: Date.now() });
    await setDraft(next);
  }

  async function makePick(playerId, pin) {
    const d = normalizeDraft(draftState || defaultDraft());
    if (d.status !== 'live') throw new Error('Draft is not live yet');
    if (!d.pool.includes(playerId)) throw new Error('Player not in pool');
    const teamId = d.order[d.pickIndex];
    if (!teamId) throw new Error('Draft is complete');
    const master = checkMasterPin(pin);
    if (!master && !checkTeamPin(pin, teamId)) {
      const name = window.DB?.teamName(teamId) || teamId;
      throw new Error(`Only ${name}'s captain (or master PIN) can pick now`);
    }

    const pool = d.pool.filter((id) => id !== playerId);
    let next = {
      ...d,
      pool,
      picks: [...(d.picks || []), { playerId, teamId, at: Date.now(), byMaster: master }],
      pickIndex: (d.pickIndex || 0) + 1,
      turnStartedAt: Date.now(),
      turnSeconds: turnSeconds(),
    };
    if (next.pickIndex >= next.order.length || pool.length === 0) {
      next.status = 'done';
      next.turnStartedAt = null;
    }
    await setDraft(next);
    await assignTeam(playerId, teamId, { fromDraft: true });
  }

  async function syncGithub(playerId, teamId) {
    const endpoint = cfg().rosterSync?.endpoint;
    if (!endpoint) return { skipped: true, reason: 'No rosterSync.endpoint configured' };
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, teamId }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`GitHub sync failed (${res.status}) ${text}`.trim());
    }
    return res.json().catch(() => ({ ok: true }));
  }

  async function assignTeam(playerId, teamId, opts = {}) {
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
    if (opts.syncGithub) {
      try { github = await syncGithub(playerId, teamId); }
      catch (e) { github = { ok: false, error: e.message }; }
    }
    return { ok: true, github };
  }

  function status() {
    const d = draftState ? normalizeDraft(draftState) : null;
    return {
      mode,
      configured: mode === 'firebase',
      connected,
      connectionError,
      draft: d,
      assignments,
      databaseURL: fbCfg().databaseURL || '',
      currentTeamId: d?.status === 'live' ? d.order?.[d.pickIndex] || null : null,
      turnRemainingMs: turnRemainingMs(d),
      turnSeconds: turnSeconds(),
    };
  }

  return {
    init, onChange, status,
    startDraft, resetDraft, makePick, assignTeam, expireTurn,
    defaultDraft, teamPin, checkTeamPin, draftTeamOrder, turnRemainingMs,
  };
})();

window.DraftHub = DraftHub;
