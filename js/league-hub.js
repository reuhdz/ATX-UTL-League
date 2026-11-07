/* =============================================================================
   League hub — admin-edited team names and roster overlays
   -----------------------------------------------------------------------------
   Path: /attendance/{roomId}/league  (extra child next to /table; draft reset
   does not touch it). Shape:
     {
       teams: { [teamId]: { name, visiting?, captainId? } },
       players: { [playerId]: { name, teamId?, added? } },
       rosterIds: string[] | null,   // season pool once an admin adds someone
       updatedAt, by
     }
   Everyone reads the overlay. League admin and captains can write
   (archived seasons stay admin-only).
   Team membership is also written to rosterAssignments so the draft tab
   stays in sync; the overlay is reapplied after draft updates so a draft
   reset does not drop admin-set names or extra players.
   ============================================================================ */

const LeagueHub = (() => {
  const cfg = () => window.DRAFT_CONFIG || {};
  const fbCfg = () => window.FIREBASE_CONFIG || {};
  const roomId = () => cfg().roomId || 'season5';
  const path = () => cfg().leaguePath || `attendance/${roomId()}/league`;

  let db = null;
  let mode = 'local';
  let connectionError = null;
  let state = emptyState();
  const listeners = new Set();

  function emptyState() {
    return { teams: {}, players: {}, rosterIds: null, updatedAt: 0, by: '' };
  }

  function isObj(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
  }

  function emit() {
    listeners.forEach((fn) => {
      try { fn({ state, mode, connectionError }); } catch (e) { /* ignore */ }
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
    return `atxutl.league.${roomId()}`;
  }

  function readLocal() {
    try {
      const raw = localStorage.getItem(localKey());
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function writeLocal(value) {
    try { localStorage.setItem(localKey(), JSON.stringify(value)); } catch (e) { /* ignore */ }
  }

  function normalize(raw) {
    if (!isObj(raw)) return emptyState();
    const teams = {};
    Object.entries(isObj(raw.teams) ? raw.teams : {}).forEach(([id, meta]) => {
      if (!isObj(meta)) return;
      const name = String(meta.name || '').trim().slice(0, 40);
      const captainId = String(meta.captainId || '').trim();
      teams[id] = {
        ...(name ? { name } : {}),
        ...(captainId ? { captainId } : {}),
        ...(meta.visiting === false ? { visiting: false } : {}),
        ...(meta.visiting === true ? { visiting: true } : {}),
      };
    });
    const players = {};
    Object.entries(isObj(raw.players) ? raw.players : {}).forEach(([id, meta]) => {
      if (!isObj(meta)) return;
      const name = String(meta.name || '').trim().slice(0, 40);
      const teamId = meta.teamId != null ? String(meta.teamId) : '';
      players[id] = {
        ...(name ? { name } : {}),
        ...(teamId ? { teamId } : {}),
        ...(meta.added ? { added: true } : {}),
      };
    });
    return {
      teams,
      players,
      rosterIds: Array.isArray(raw.rosterIds)
        ? raw.rosterIds.map((id) => String(id)).filter(Boolean)
        : null,
      updatedAt: Number(raw.updatedAt) || 0,
      by: String(raw.by || ''),
    };
  }

  function pinForName(name) {
    return `utl${String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  }

  function ensureAttendance(playerId) {
    const nights = window.DB?.availability?.nights || [];
    const table = window.DB?.availability?.table;
    if (!table) return;
    nights.forEach((d) => {
      if (table[d] && table[d][playerId] == null) table[d][playerId] = 'maybe';
    });
  }

  function apply(next = state) {
    Object.entries(next.teams || {}).forEach(([id, meta]) => {
      const t = window.DB?.team(id);
      if (!t) return;
      if (meta.name) {
        t.name = meta.name;
        if (window.DRAFT_CONFIG?.teamPins) {
          window.DRAFT_CONFIG.teamPins[id] = pinForName(meta.name);
        }
      }
      if (meta.visiting === false) t.visiting = false;
      if (meta.visiting === true) t.visiting = true;
      if (meta.captainId) {
        const cap = window.DB?.player(meta.captainId);
        if (cap && (!cap.teamId || cap.teamId === id)) t.captain = cap.name;
      }
    });

    Object.entries(next.players || {}).forEach(([id, meta]) => {
      let p = window.DB?.player(id);
      if (!p && meta.name) {
        p = { id, name: meta.name, teamId: meta.teamId || 'fa', skill: 0.5 };
        (window.DB?.players || []).push(p);
      }
      if (!p) return;
      if (meta.name) p.name = meta.name;
      if (meta.teamId) p.teamId = meta.teamId;
      ensureAttendance(id);
    });

    if (Array.isArray(next.rosterIds) && window.DB?.seasonRosterIds) {
      const ids = window.DB.seasonRosterIds;
      ids.splice(0, ids.length, ...next.rosterIds);
    }
  }

  function reapply() {
    apply(state);
  }

  function canEdit() {
    return !!(window.AdminAuth?.isAdmin?.() || window.AdminAuth?.isCaptain?.());
  }

  function requireEditor() {
    if (!canEdit()) throw new Error('Captain or admin login required');
    if (window.DB?.isArchived?.() && !window.AdminAuth?.isAdmin?.()) {
      throw new Error(`${window.DB.season?.label || 'This season'} is archived — only the league admin can edit it`);
    }
  }

  function actor() {
    return window.AdminAuth?.session?.()?.username || 'admin';
  }

  async function persist() {
    state = {
      ...state,
      updatedAt: Date.now(),
      by: actor(),
    };
    apply(state);
    if (mode === 'firebase' && db) {
      try {
        await db.ref(path()).set(state);
      } catch (e) {
        connectionError = e.message || String(e);
        writeLocal(state);
        emit();
        throw new Error(`Could not save league edits: ${connectionError}`);
      }
      connectionError = null;
      writeLocal(state);
      emit();
      return;
    }
    writeLocal(state);
    emit();
  }

  function ensureRosterIds() {
    if (!state.rosterIds) {
      state.rosterIds = [...(window.DB?.seasonRosterIds || [])];
    }
    return state.rosterIds;
  }

  function slugId(name) {
    const base = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24) || 'player';
    let id = base;
    let n = 2;
    while (window.DB?.player(id) || state.players[id]) id = `${base}${n++}`;
    return id;
  }

  async function assign(playerId, teamId) {
    if (!window.DraftHub?.assignTeam) {
      const p = window.DB?.player(playerId);
      if (p) p.teamId = teamId;
      return;
    }
    await window.DraftHub.assignTeam(playerId, teamId, {
      admin: !!window.AdminAuth?.isAdmin?.(),
    });
  }

  function clearCaptainIfNeeded(playerId) {
    Object.entries(state.teams || {}).forEach(([id, meta]) => {
      if (meta.captainId === playerId) {
        const next = { ...meta };
        delete next.captainId;
        state.teams[id] = next;
        const t = window.DB?.team(id);
        if (t) delete t.captain;
      }
    });
  }

  async function setTeamName(teamId, name) {
    requireEditor();
    const t = window.DB?.team(teamId);
    if (!t) throw new Error('Unknown team');
    const next = String(name || '').trim().slice(0, 40);
    if (!next) throw new Error('Enter a team name');
    state.teams[teamId] = { ...(state.teams[teamId] || {}), name: next };
    await persist();
    return t;
  }

  async function setCaptain(teamId, playerId) {
    requireEditor();
    const t = window.DB?.team(teamId);
    if (!t) throw new Error('Unknown team');
    const p = window.DB?.player(playerId);
    if (!p) throw new Error('Unknown player');
    if (p.teamId !== teamId) throw new Error('Captain must be on this roster');
    state.teams[teamId] = { ...(state.teams[teamId] || {}), captainId: playerId };
    await persist();
    return p;
  }

  function isTeamCaptain(teamId, playerId) {
    const overlayId = state.teams?.[teamId]?.captainId;
    if (overlayId) return overlayId === playerId;
    const t = window.DB?.team(teamId);
    const p = window.DB?.player(playerId);
    return !!(t && p && t.captain && p.name === t.captain);
  }

  async function setPlayerName(playerId, name) {
    requireEditor();
    const p = window.DB?.player(playerId);
    if (!p) throw new Error('Unknown player');
    const next = String(name || '').trim().slice(0, 40);
    if (!next) throw new Error('Enter a player name');
    state.players[playerId] = { ...(state.players[playerId] || {}), name: next };
    await persist();
    return p;
  }

  async function addPlayer({ name, teamId, playerId } = {}) {
    requireEditor();
    const team = teamId && teamId !== 'fa' ? window.DB?.team(teamId) : null;
    if (teamId && teamId !== 'fa' && !team) throw new Error('Unknown team');

    let id = String(playerId || '').trim();
    let created = false;
    if (id) {
      if (!window.DB?.player(id) && !state.players[id]) throw new Error('Unknown player');
    } else {
      const label = String(name || '').trim().slice(0, 40);
      if (!label) throw new Error('Enter a player name');
      const existing = (window.DB?.players || []).find((p) =>
        String(p.name).trim().toLowerCase() === label.toLowerCase());
      if (existing) {
        id = existing.id;
      } else {
        id = slugId(label);
        created = true;
        state.players[id] = { name: label, added: true };
      }
    }

    const roster = ensureRosterIds();
    if (!roster.includes(id)) roster.push(id);

    if (teamId) {
      state.players[id] = { ...(state.players[id] || {}), teamId };
      if (team?.visiting) {
        state.teams[teamId] = {
          ...(state.teams[teamId] || {}),
          name: (state.teams[teamId] && state.teams[teamId].name) || team.name,
          visiting: false,
        };
      }
    }

    apply(state);
    await persist();
    if (teamId) await assign(id, teamId);
    reapply();
    return { id, created };
  }

  async function removePlayer(playerId) {
    requireEditor();
    const p = window.DB?.player(playerId);
    if (!p) throw new Error('Unknown player');
    clearCaptainIfNeeded(playerId);
    state.players[playerId] = { ...(state.players[playerId] || {}), teamId: 'fa' };
    if (p.name && !state.players[playerId].name) state.players[playerId].name = p.name;
    apply(state);
    await persist();
    await assign(playerId, 'fa');
    reapply();
    return p;
  }

  async function movePlayer(playerId, teamId) {
    requireEditor();
    if (teamId === 'fa') return removePlayer(playerId);
    const fromId = window.DB?.player(playerId)?.teamId;
    if (fromId && fromId !== teamId) clearCaptainIfNeeded(playerId);
    return addPlayer({ playerId, teamId });
  }

  async function init() {
    connectionError = null;
    state = emptyState();

    if (isConfigured()) {
      try {
        if (!window.firebase.apps.length) window.firebase.initializeApp(fbCfg());
        db = window.firebase.database();
        mode = 'firebase';
      } catch (e) {
        connectionError = e.message || String(e);
        mode = 'local';
      }
    } else {
      mode = 'local';
    }

    if (mode === 'firebase') {
      db.ref(path()).on('value', (snap) => {
        state = normalize(snap.val());
        apply(state);
        connectionError = null;
        emit();
      }, (err) => {
        connectionError = err?.message || String(err);
        state = normalize(readLocal());
        apply(state);
        emit();
      });
    } else {
      state = normalize(readLocal());
      apply(state);
      emit();
    }
    return { mode };
  }

  return {
    init, onChange, apply, reapply,
    setTeamName, setPlayerName, setCaptain, isTeamCaptain,
    addPlayer, removePlayer, movePlayer, canEdit,
    status: () => ({ mode, connectionError, state, path: path() }),
  };
})();

window.LeagueHub = LeagueHub;
