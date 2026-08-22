/* =============================================================================
   Stats hub — Firebase live match results (Bo3 first-to-5 + box scores)
   -----------------------------------------------------------------------------
   Path: /matchResults/{roomId}/{matchId}
   Shape:
     {
       status: 'final',
       format: 'bo3-ft5',
       games: [{ home, away }, ...],   // up to 3 games, each first to 5
       homeScore, awayScore,           // series wins (0–2) — used for W/L
       pointsHome, pointsAway,         // sum of game points — used for GF/GA
       homeLineup, awayLineup, box,
       events: [{ id, playerId, type, url, note, createdAt }], // Option A/B clips
       seriesSavedAt, seriesSavedBy,
       boxSavedAt, boxSavedBy,
       updatedAt, updatedBy
     }
   Overlays window.DB.matches in place.
   ============================================================================ */

const StatsHub = (() => {
  const STAT_FIELDS = ['goals', 'assists', 'steals', 'blocks', 'turnovers', 'swimOffAttempts', 'swimOffs', 'shots'];
  const cfg = () => window.DRAFT_CONFIG || {};
  const fbCfg = () => window.FIREBASE_CONFIG || {};
  const roomId = () => cfg().roomId || 'season5';

  let db = null;
  let mode = 'local';
  let connectionError = null;
  let connected = false;
  let unsub = null;
  let unsubConn = null;
  /** @type {Record<string, object>} */
  let results = {};
  /** @type {object[]} */
  let baseMatches = [];
  const listeners = new Set();

  function emit() {
    listeners.forEach((fn) => {
      try { fn({ results, mode, connectionError, connected }); } catch (e) { /* ignore */ }
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

  function localKey() {
    return `atxutl.matchResults.${roomId()}`;
  }

  function readLocal() {
    try {
      const raw = localStorage.getItem(localKey());
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function writeLocal(value) {
    try { localStorage.setItem(localKey(), JSON.stringify(value)); } catch (e) { /* ignore */ }
  }

  function normalizePin(pin) {
    return String(pin || '').trim().toLowerCase();
  }

  function checkMasterPin(pin) {
    // Prefer captain/admin session from /admin; PIN kept as legacy fallback only.
    if (typeof AdminAuth !== 'undefined' && AdminAuth.isLoggedIn()) return true;
    const expected = normalizePin(cfg().masterPin || '');
    return !!expected && normalizePin(pin) === expected;
  }

  function actorFromSession() {
    const s = (typeof AdminAuth !== 'undefined' && AdminAuth.session) ? AdminAuth.session() : null;
    if (!s) {
      return { username: 'unknown', label: 'Unknown', role: null, at: Date.now() };
    }
    return {
      username: s.username || 'unknown',
      label: s.label || s.username || 'Unknown',
      role: s.role || null,
      at: Date.now(),
    };
  }

  function normalizeActor(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const username = String(raw.username || '').trim();
    if (!username) return null;
    return {
      username,
      label: String(raw.label || username).trim() || username,
      role: raw.role || null,
      at: raw.at || null,
    };
  }

  function cloneMatch(m) {
    return {
      ...m,
      box: Array.isArray(m.box) ? m.box.map((b) => ({ ...b })) : [],
      homeLineup: Array.isArray(m.homeLineup) ? [...m.homeLineup] : [],
      awayLineup: Array.isArray(m.awayLineup) ? [...m.awayLineup] : [],
      games: Array.isArray(m.games) ? m.games.map((g) => ({ ...g })) : null,
    };
  }

  function snapshotBase() {
    const matches = window.DB?.matches || [];
    if (!baseMatches.length) baseMatches = matches.map(cloneMatch);
  }

  function num(n, fallback = 0) {
    const v = Number(n);
    return Number.isFinite(v) && v >= 0 ? Math.round(v) : fallback;
  }

  function seriesFromGames(games) {
    let hw = 0;
    let aw = 0;
    let ph = 0;
    let pa = 0;
    (games || []).forEach((g) => {
      const h = num(g.home);
      const a = num(g.away);
      ph += h;
      pa += a;
      if (h > a) hw += 1;
      else if (a > h) aw += 1;
    });
    return { homeScore: hw, awayScore: aw, pointsHome: ph, pointsAway: pa };
  }

  function normalizeBoxLine(raw) {
    const line = { playerId: raw.playerId };
    STAT_FIELDS.forEach((k) => { line[k] = num(raw[k]); });
    return line;
  }

  function normalizeUrl(url) {
    const u = String(url || '').trim();
    if (!u) throw new Error('Paste a clip link');
    try {
      const parsed = new URL(u);
      if (!/^https?:$/i.test(parsed.protocol)) throw new Error('bad');
      return parsed.href;
    } catch (e) {
      throw new Error(`Invalid link: ${u}`);
    }
  }

  function normalizeEvent(raw, fallbackId) {
    if (!raw || typeof raw !== 'object') return null;
    const playerId = String(raw.playerId || '').trim();
    const type = String(raw.type || '').trim();
    if (!playerId || !STAT_FIELDS.includes(type)) return null;
    let url = '';
    try { url = normalizeUrl(raw.url); } catch (e) { return null; }
    return {
      id: String(raw.id || fallbackId || `ev_${Date.now()}`),
      playerId,
      type,
      url,
      note: String(raw.note || '').trim().slice(0, 200),
      createdAt: raw.createdAt || Date.now(),
    };
  }

  function normalizeEvents(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map((e, i) => normalizeEvent(e, `ev_${i}`)).filter(Boolean);
  }

  function normalizeResult(raw, matchId) {
    if (!raw || typeof raw !== 'object') return null;
    const games = Array.isArray(raw.games)
      ? raw.games
        .filter((g) => g && (g.home != null || g.away != null))
        .map((g) => ({ home: Math.min(5, num(g.home)), away: Math.min(5, num(g.away)) }))
      : [];
    const derived = seriesFromGames(games);
    const homeScore = games.length ? derived.homeScore : num(raw.homeScore);
    const awayScore = games.length ? derived.awayScore : num(raw.awayScore);
    const pointsHome = games.length ? derived.pointsHome : num(raw.pointsHome, homeScore);
    const pointsAway = games.length ? derived.pointsAway : num(raw.pointsAway, awayScore);
    const homeLineup = Array.isArray(raw.homeLineup) ? raw.homeLineup.filter(Boolean) : [];
    const awayLineup = Array.isArray(raw.awayLineup) ? raw.awayLineup.filter(Boolean) : [];
    const box = Array.isArray(raw.box) ? raw.box.filter((b) => b?.playerId).map(normalizeBoxLine) : [];
    const events = normalizeEvents(raw.events);
    return {
      matchId,
      status: 'final',
      format: 'bo3-ft5',
      games,
      homeScore,
      awayScore,
      pointsHome,
      pointsAway,
      homeLineup,
      awayLineup,
      box,
      events,
      seriesSavedAt: raw.seriesSavedAt || null,
      seriesSavedBy: normalizeActor(raw.seriesSavedBy),
      boxSavedAt: raw.boxSavedAt || null,
      boxSavedBy: normalizeActor(raw.boxSavedBy),
      updatedAt: raw.updatedAt || Date.now(),
      updatedBy: normalizeActor(raw.updatedBy),
    };
  }

  function normalizeMap(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    Object.keys(raw).forEach((id) => {
      const n = normalizeResult(raw[id], id);
      if (n) out[id] = n;
    });
    return out;
  }

  function applyToDB() {
    snapshotBase();
    const matches = window.DB?.matches;
    if (!matches) return;
    matches.forEach((m) => {
      const base = baseMatches.find((b) => b.id === m.id) || cloneMatch(m);
      Object.assign(m, cloneMatch(base));
      m.seriesSavedBy = null;
      m.boxSavedBy = null;
      m.updatedBy = null;
      m.events = [];
      const res = results[m.id];
      if (!res) return;
      m.status = 'final';
      m.format = res.format;
      m.games = res.games.map((g) => ({ ...g }));
      m.homeScore = res.homeScore;
      m.awayScore = res.awayScore;
      m.pointsHome = res.pointsHome;
      m.pointsAway = res.pointsAway;
      m.homeLineup = [...res.homeLineup];
      m.awayLineup = [...res.awayLineup];
      m.box = res.box.map((b) => ({ ...b }));
      m.events = (res.events || []).map((e) => ({ ...e }));
      m.seriesSavedBy = res.seriesSavedBy;
      m.boxSavedBy = res.boxSavedBy;
      m.updatedBy = res.updatedBy;
    });
  }

  async function probeDatabase(url) {
    try {
      const res = await fetch(`${url.replace(/\/$/, '')}/.json`, { method: 'GET' });
      const text = await res.text();
      if (res.status === 404) throw new Error('Realtime Database not found at databaseURL (404).');
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
    snapshotBase();
    connectionError = null;
    connected = false;

    if (isConfigured()) {
      try {
        await probeDatabase(fbCfg().databaseURL);
        if (!firebase.apps.length) firebase.initializeApp(fbCfg());
        db = firebase.database();
        mode = 'firebase';
      } catch (e) {
        console.warn('Stats Firebase init failed, using local mode', e);
        connectionError = e.message || String(e);
        mode = 'local';
      }
    } else {
      mode = 'local';
    }

    if (mode === 'firebase') {
      const ref = db.ref(`matchResults/${roomId()}`);
      unsubConn = db.ref('.info/connected').on('value', (snap) => {
        connected = !!snap.val();
        emit();
      });
      unsub = ref.on('value', (snap) => {
        results = normalizeMap(snap.val());
        applyToDB();
        connectionError = null;
        emit();
      }, (err) => {
        connectionError = `Match results sync error: ${err?.message || err}`;
        emit();
      });
      try {
        await ref.once('value');
      } catch (e) {
        connectionError = `Cannot read match results: ${e.message || e}`;
        mode = 'local';
        results = normalizeMap(readLocal());
        applyToDB();
        emit();
      }
    } else {
      results = normalizeMap(readLocal());
      applyToDB();
      emit();
    }

    return { mode, configured: mode === 'firebase', connectionError };
  }

  function getResult(matchId) {
    return results[matchId] || null;
  }

  function emptyLine(playerId) {
    const line = { playerId };
    STAT_FIELDS.forEach((k) => { line[k] = 0; });
    return line;
  }

  async function writeResult(matchId, next) {
    results = { ...results, [matchId]: next };
    if (mode === 'firebase' && db) {
      await db.ref(`matchResults/${roomId()}/${matchId}`).set(next);
      return next;
    }
    writeLocal(results);
    applyToDB();
    emit();
    return next;
  }

  /** Save series scores only (does not wipe existing box/lineups). */
  async function saveSeries(matchId, games, pin) {
    if (!checkMasterPin(pin)) throw new Error('Captain or admin login required to save series');
    const match = (window.DB?.matches || []).find((m) => m.id === matchId);
    if (!match) throw new Error('Unknown match');

    const cleaned = (games || [])
      .map((g) => ({ home: num(g.home), away: num(g.away) }))
      .filter((g) => g.home > 0 || g.away > 0);
    if (!cleaned.length) throw new Error('Enter at least one game score');

    const prev = results[matchId] || {};
    const derived = seriesFromGames(cleaned);
    const actor = actorFromSession();
    const next = normalizeResult({
      ...prev,
      games: cleaned,
      ...derived,
      homeLineup: prev.homeLineup || [],
      awayLineup: prev.awayLineup || [],
      box: prev.box || [],
      seriesSavedAt: actor.at,
      seriesSavedBy: actor,
      updatedAt: actor.at,
      updatedBy: actor,
    }, matchId);
    return writeResult(matchId, next);
  }

  /** Save individual box scores / lineups (keeps existing series games). */
  async function saveBox(matchId, payload, pin) {
    if (!checkMasterPin(pin)) throw new Error('Captain or admin login required to save player stats');
    const match = (window.DB?.matches || []).find((m) => m.id === matchId);
    if (!match) throw new Error('Unknown match');

    const prev = results[matchId] || {};
    if (!prev.games?.length && !payload.allowWithoutSeries) {
      throw new Error('Submit series scores first');
    }

    const homeLineup = Array.isArray(payload.homeLineup) ? payload.homeLineup.filter(Boolean) : [];
    const awayLineup = Array.isArray(payload.awayLineup) ? payload.awayLineup.filter(Boolean) : [];
    const box = Array.isArray(payload.box) ? payload.box.filter((b) => b?.playerId).map(normalizeBoxLine) : [];
    const events = payload.events != null ? normalizeEvents(payload.events) : normalizeEvents(prev.events);
    const actor = actorFromSession();

    const next = normalizeResult({
      ...prev,
      games: prev.games || [],
      homeScore: prev.homeScore,
      awayScore: prev.awayScore,
      pointsHome: prev.pointsHome,
      pointsAway: prev.pointsAway,
      homeLineup,
      awayLineup,
      box,
      events,
      boxSavedAt: actor.at,
      boxSavedBy: actor,
      updatedAt: actor.at,
      updatedBy: actor,
    }, matchId);
    return writeResult(matchId, next);
  }

  async function clearMatch(matchId, pin) {
    if (!checkMasterPin(pin)) throw new Error('Captain or admin login required to clear');
    if (mode === 'firebase' && db) {
      await db.ref(`matchResults/${roomId()}/${matchId}`).remove();
      return;
    }
    const next = { ...results };
    delete next[matchId];
    results = next;
    writeLocal(results);
    applyToDB();
    emit();
  }

  /** Clear individual box scores / lineups; keep series scores. */
  async function clearBox(matchId, pin) {
    if (!checkMasterPin(pin)) throw new Error('Captain or admin login required to clear player stats');
    const prev = results[matchId];
    if (!prev) throw new Error('No saved stats for this match');
    if (!prev.games?.length) {
      // Nothing but box data — clear the whole match
      return clearMatch(matchId, pin);
    }
    const next = normalizeResult({
      ...prev,
      games: prev.games || [],
      homeScore: prev.homeScore,
      awayScore: prev.awayScore,
      pointsHome: prev.pointsHome,
      pointsAway: prev.pointsAway,
      homeLineup: [],
      awayLineup: [],
      box: [],
      events: [],
      boxSavedAt: null,
      boxSavedBy: null,
      updatedAt: Date.now(),
      updatedBy: actorFromSession(),
    }, matchId);
    return writeResult(matchId, next);
  }

  /** All clips for a player across saved matches (optional type filter). */
  function clipsForPlayer(playerId, type = null) {
    const out = [];
    Object.keys(results).forEach((matchId) => {
      const res = results[matchId];
      const match = (window.DB?.matches || []).find((m) => m.id === matchId);
      (res.events || []).forEach((e) => {
        if (e.playerId !== playerId) return;
        if (type && e.type !== type) return;
        out.push({
          ...e,
          matchId,
          round: match?.round ?? null,
          date: match?.date || null,
          home: match?.home || null,
          away: match?.away || null,
        });
      });
    });
    return out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  function clipCountsForPlayer(playerId) {
    const counts = {};
    STAT_FIELDS.forEach((f) => { counts[f] = 0; });
    clipsForPlayer(playerId).forEach((e) => {
      if (counts[e.type] != null) counts[e.type] += 1;
    });
    return counts;
  }

  function status() {
    return { results, mode, connected, connectionError, fields: STAT_FIELDS };
  }

  return {
    init, onChange, status, getResult, saveSeries, saveBox, clearMatch, clearBox,
    checkMasterPin, emptyLine, seriesFromGames, fields: STAT_FIELDS,
    normalizeUrl, clipsForPlayer, clipCountsForPlayer,
  };
})();

window.StatsHub = StatsHub;
