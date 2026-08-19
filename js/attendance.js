/* =============================================================================
   Attendance hub — Firebase live availability
   -----------------------------------------------------------------------------
   Path in Realtime Database:
     /attendance/{roomId}/table/{date}/{playerId}  → 'in' | 'maybe' | 'out'
   Falls back to localStorage when Firebase is unavailable.
   Anyone can update; changes sync live to all clients.
   ============================================================================ */

const AttendanceHub = (() => {
  const STATUSES = ['in', 'maybe', 'out'];
  const cfg = () => window.DRAFT_CONFIG || {};
  const fbCfg = () => window.FIREBASE_CONFIG || {};
  const roomId = () => cfg().roomId || 'season5';

  let db = null;
  let mode = 'local';
  let connectionError = null;
  let connected = false;
  let unsubTable = null;
  let unsubConn = null;
  /** @type {Record<string, Record<string, string>>} */
  let liveTable = {};
  const listeners = new Set();

  function emit() {
    listeners.forEach((fn) => {
      try {
        fn({ table: liveTable, mode, connectionError, connected });
      } catch (e) { /* ignore */ }
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
    return `atxutl.attendance.${roomId()}`;
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

  function nights() {
    return window.DB?.availability?.nights || [];
  }

  function playableIds() {
    const roster = window.DB?.season5RosterIds || [];
    return roster.filter((id) => {
      const p = window.DB?.player(id);
      return p && p.level !== 'Pro (IR)';
    });
  }

  function normalizeStatus(val) {
    return STATUSES.includes(val) ? val : 'maybe';
  }

  function normalizeTable(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    Object.keys(raw).forEach((date) => {
      const row = raw[date];
      if (!row || typeof row !== 'object') return;
      out[date] = {};
      Object.keys(row).forEach((pid) => {
        out[date][pid] = normalizeStatus(row[pid]);
      });
    });
    return out;
  }

  /** Merge live overrides into DB.availability so attendancePct / UI stay in sync. */
  function applyToDB() {
    const avail = window.DB?.availability;
    if (!avail?.table) return;
    nights().forEach((date) => {
      if (!avail.table[date]) avail.table[date] = {};
      playableIds().forEach((pid) => {
        avail.table[date][pid] = statusFor(date, pid);
      });
    });
  }

  function statusFor(date, playerId) {
    return normalizeStatus(liveTable?.[date]?.[playerId] || 'maybe');
  }

  function cycleStatus(current) {
    const i = STATUSES.indexOf(normalizeStatus(current));
    return STATUSES[(i + 1) % STATUSES.length];
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
    connectionError = null;
    connected = false;

    if (isConfigured()) {
      try {
        await probeDatabase(fbCfg().databaseURL);
        if (!firebase.apps.length) firebase.initializeApp(fbCfg());
        db = firebase.database();
        mode = 'firebase';
      } catch (e) {
        console.warn('Attendance Firebase init failed, using local mode', e);
        connectionError = e.message || String(e);
        mode = 'local';
      }
    } else {
      mode = 'local';
    }

    if (mode === 'firebase') {
      const tableRef = db.ref(`attendance/${roomId()}/table`);
      unsubConn = db.ref('.info/connected').on('value', (snap) => {
        connected = !!snap.val();
        emit();
      });
      unsubTable = tableRef.on('value', (snap) => {
        liveTable = normalizeTable(snap.val());
        applyToDB();
        connectionError = null;
        emit();
      }, (err) => {
        connectionError = `Attendance sync error: ${err?.message || err}`;
        emit();
      });
      try {
        // Touch path so write rules failures surface early
        await tableRef.once('value');
      } catch (e) {
        connectionError = `Cannot read attendance: ${e.message || e}`;
        mode = 'local';
        liveTable = normalizeTable(readLocal());
        applyToDB();
        emit();
      }
    } else {
      liveTable = normalizeTable(readLocal());
      applyToDB();
      emit();
    }

    return { mode, configured: mode === 'firebase', connectionError };
  }

  async function setStatus(playerId, date, status) {
    const next = normalizeStatus(status);
    if (!playerId || !date) throw new Error('Missing player or date');
    if (!nights().includes(date)) throw new Error('Unknown league night');
    if (!playableIds().includes(playerId)) throw new Error('Player not on Season 5 roster');

    if (mode === 'firebase' && db) {
      await db.ref(`attendance/${roomId()}/table/${date}/${playerId}`).set(next);
      await db.ref(`attendance/${roomId()}/updatedAt`).set(Date.now());
      return next;
    }

    if (!liveTable[date]) liveTable[date] = {};
    liveTable[date][playerId] = next;
    writeLocal(liveTable);
    applyToDB();
    emit();
    return next;
  }

  async function cycle(playerId, date) {
    return setStatus(playerId, date, cycleStatus(statusFor(date, playerId)));
  }

  function status() {
    return {
      table: liveTable,
      mode,
      connected,
      connectionError,
      nights: nights(),
    };
  }

  return {
    init, onChange, status, statusFor, setStatus, cycle, cycleStatus,
    statuses: STATUSES,
  };
})();
