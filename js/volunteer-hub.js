/* =============================================================================
   Volunteer hub — per-game game-day roles
   -----------------------------------------------------------------------------
   Path: /volunteers/{roomId}/{matchId}/{role}
   Shape: [ { username, label, claimedAt }, ... ]
   First entry = primary; later entries = backups (background ordering).
   Roles: ref | camera | safety
   ============================================================================ */

const VolunteerHub = (() => {
  const ROLES = [
    { id: 'ref', label: 'Referee' },
    { id: 'camera', label: 'Camera' },
    { id: 'safety', label: 'Safety' },
  ];
  const NAME_KEY = 'atxutl.volunteerName';
  const cfg = () => window.DRAFT_CONFIG || {};
  const fbCfg = () => window.FIREBASE_CONFIG || {};
  const roomId = () => cfg().roomId || 'season5';
  const path = () => `volunteers/${roomId()}`;

  let db = null;
  let mode = 'local';
  let connectionError = null;
  /** @type {Record<string, Record<string, object[]>>} matchId -> role -> list */
  let table = {};
  const listeners = new Set();

  function emit() {
    listeners.forEach((fn) => {
      try { fn({ table, mode, connectionError }); } catch (e) { /* ignore */ }
    });
  }

  function onChange(fn) {
    if (typeof fn === 'function') listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function isConfigured() {
    const c = fbCfg();
    return !!(c.enabled && c.apiKey && c.apiKey !== 'YOUR_API_KEY' && c.databaseURL
      && !String(c.databaseURL).includes('YOUR_PROJECT') && window.firebase);
  }

  function localKey() {
    return `atxutl.volunteers.v2.${roomId()}`;
  }

  function readLocal() {
    try {
      const raw = localStorage.getItem(localKey());
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function writeLocal(map) {
    try { localStorage.setItem(localKey(), JSON.stringify(map)); } catch (e) { /* ignore */ }
  }

  function sameUser(a, b) {
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  }

  function normalizePerson(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const username = String(raw.username || '').trim();
    const label = String(raw.label || username).trim();
    if (!username || !label) return null;
    return {
      username,
      label,
      claimedAt: Number(raw.claimedAt) || Date.now(),
    };
  }

  function normalizeList(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map(normalizePerson).filter(Boolean);
  }

  function looksLikeRoleMap(row) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
    return ROLES.some((r) => Object.prototype.hasOwnProperty.call(row, r.id));
  }

  function normalizeTable(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    Object.keys(raw).forEach((matchId) => {
      const row = raw[matchId];
      // Skip legacy week-number maps that aren't match ids with role children
      if (!looksLikeRoleMap(row)) return;
      out[matchId] = {};
      ROLES.forEach((r) => {
        out[matchId][r.id] = normalizeList(row[r.id]);
      });
    });
    return out;
  }

  function identity() {
    try {
      const saved = localStorage.getItem(NAME_KEY);
      if (saved && saved.trim()) {
        const label = saved.trim().slice(0, 40);
        return { username: `vol_${label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`, label };
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function setDisplayName(name) {
    const label = String(name || '').trim().slice(0, 40);
    if (!label) throw new Error('Enter your name');
    try { localStorage.setItem(NAME_KEY, label); } catch (e) { /* ignore */ }
    return identity();
  }

  async function writeMatchRole(matchId, role, list) {
    const id = String(matchId);
    if (mode === 'firebase' && db) {
      await db.ref(`${path()}/${id}/${role}`).set(list);
      return;
    }
    table = {
      ...table,
      [id]: {
        ...(table[id] || {}),
        [role]: list,
      },
    };
    writeLocal(table);
    emit();
  }

  async function init() {
    connectionError = null;
    if (isConfigured()) {
      try {
        if (!firebase.apps.length) firebase.initializeApp(fbCfg());
        db = firebase.database();
        mode = 'firebase';
      } catch (e) {
        console.warn('VolunteerHub Firebase init failed', e);
        connectionError = e.message || String(e);
        mode = 'local';
      }
    } else {
      mode = 'local';
    }

    if (mode === 'firebase') {
      db.ref(path()).on('value', (snap) => {
        table = normalizeTable(snap.val());
        connectionError = null;
        emit();
      }, (err) => {
        connectionError = err?.message || String(err);
        emit();
      });
    } else {
      table = normalizeTable(readLocal());
      emit();
    }
    return { mode };
  }

  function listFor(matchId, role) {
    return (table[String(matchId)] && table[String(matchId)][role]) || [];
  }

  function primary(matchId, role) {
    return listFor(matchId, role)[0] || null;
  }

  function isSignedUp(matchId, role, who = identity()) {
    if (!who) return false;
    return listFor(matchId, role).some((p) => sameUser(p.username, who.username));
  }

  async function claim(matchId, role) {
    if (!matchId) throw new Error('Select a game');
    if (!ROLES.some((r) => r.id === role)) throw new Error('Unknown role');
    const who = identity();
    if (!who) throw new Error('Enter your name first');
    const list = [...listFor(matchId, role)];
    if (list.some((p) => sameUser(p.username, who.username))) {
      throw new Error('You are already on this list');
    }
    list.push({ ...who, claimedAt: Date.now() });
    await writeMatchRole(matchId, role, list);
    return list;
  }

  async function leave(matchId, role) {
    const who = identity();
    if (!who) throw new Error('Enter your name first');
    const prev = listFor(matchId, role);
    const list = prev.filter((p) => !sameUser(p.username, who.username));
    if (list.length === prev.length) throw new Error('You are not on this list');
    await writeMatchRole(matchId, role, list);
    return list;
  }

  /** Promote a backup to primary (must already be on the list). */
  async function promote(matchId, role, username) {
    const list = [...listFor(matchId, role)];
    const idx = list.findIndex((p) => sameUser(p.username, username));
    if (idx < 0) throw new Error('Volunteer not found');
    if (idx === 0) return list;
    const [person] = list.splice(idx, 1);
    list.unshift(person);
    await writeMatchRole(matchId, role, list);
    return list;
  }

  return {
    init, onChange, roles: ROLES, identity, setDisplayName,
    listFor, primary, isSignedUp, claim, leave, promote,
    status: () => ({ mode, connectionError }),
  };
})();

window.VolunteerHub = VolunteerHub;
