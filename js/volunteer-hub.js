/* =============================================================================
   Volunteer hub — per-game game-day roles
   -----------------------------------------------------------------------------
   Path: /volunteers/{roomId}/{matchId}/{role}
   Shape: [ { username, label, claimedAt }, ... ]
   First entry = primary; later entries = backups (background ordering).
   Roles: ref | ref2 (extra referee) | camera | safety
   addedBy is set when someone else put the volunteer on the list by name.
   ============================================================================ */

const VolunteerHub = (() => {
  const ROLES = [
    { id: 'ref', label: 'Referee' },
    { id: 'ref2', label: 'Extra referee' },
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
      ...(raw.addedBy ? { addedBy: String(raw.addedBy) } : {}),
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

  function personFromName(name) {
    const label = String(name || '').trim().slice(0, 40);
    if (!label) return null;
    return { username: `vol_${label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`, label };
  }

  function identity() {
    try {
      return personFromName(localStorage.getItem(NAME_KEY));
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
    if (window.DB?.isArchived?.()) {
      throw new Error(`${window.DB.season.label} is archived — the volunteer board is read-only`);
    }
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

  /** Put someone else on a role by name (e.g. an extra referee). */
  async function addByName(matchId, role, name) {
    if (!matchId) throw new Error('Select a game');
    if (!ROLES.some((r) => r.id === role)) throw new Error('Unknown role');
    const who = identity();
    if (!who) throw new Error('Enter your name first');
    const person = personFromName(name);
    if (!person) throw new Error('Enter a name');
    const list = [...listFor(matchId, role)];
    if (list.some((p) => sameUser(p.username, person.username))) {
      throw new Error(`${person.label} is already on this list`);
    }
    list.push({ ...person, addedBy: who.username, claimedAt: Date.now() });
    await writeMatchRole(matchId, role, list);
    return list;
  }

  function canRemove(person, who = identity()) {
    if (!person || !who) return false;
    return sameUser(person.username, who.username) || sameUser(person.addedBy, who.username);
  }

  /** Remove a volunteer — allowed for that volunteer or whoever added them by name. */
  async function remove(matchId, role, username) {
    const prev = listFor(matchId, role);
    const target = prev.find((p) => sameUser(p.username, username));
    if (!target) throw new Error('Volunteer not found');
    if (!canRemove(target)) throw new Error('Only that volunteer or whoever added them can remove them');
    await writeMatchRole(matchId, role, prev.filter((p) => p !== target));
    return prev;
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
    listFor, primary, isSignedUp, claim, leave, promote, addByName, canRemove, remove,
    status: () => ({ mode, connectionError }),
  };
})();

window.VolunteerHub = VolunteerHub;
