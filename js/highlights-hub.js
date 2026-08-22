/* =============================================================================
   Highlights hub — public nominations + session votes
   -----------------------------------------------------------------------------
   Path: /season5-highlights/{id}
   Shape:
     {
       urls, url, comment, createdAt, status,
       round, matchId, playerId,   // set at nomination
       votes: { [voterKey]: true },
       updatedAt
     }
   Visitors get a stable session voter key (localStorage).
   Each voter may cast at most one vote per highlight (can vote on many clips).
   Top 3 by vote count per week+match feed Media → Highlights.
   ============================================================================ */

const HighlightsHub = (() => {
  const PATH = 'season5-highlights';
  const VOTER_KEY = 'atxutl.hlVoter';
  const fbCfg = () => window.FIREBASE_CONFIG || {};

  let db = null;
  let mode = 'local';
  let connectionError = null;
  let connected = false;
  /** @type {Record<string, object>} */
  let entries = {};
  const listeners = new Set();

  function emit() {
    listeners.forEach((fn) => {
      try { fn({ entries, mode, connectionError, connected }); } catch (e) { /* ignore */ }
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
    return 'atxutl.season5-highlights';
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

  /** Stable anonymous voter id for this browser session/device. */
  function sessionVoterKey() {
    try {
      let id = localStorage.getItem(VOTER_KEY);
      if (!id) {
        id = `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem(VOTER_KEY, id);
      }
      return id;
    } catch (e) {
      return `v_tmp_${Date.now().toString(36)}`;
    }
  }

  function normalizeUrl(url) {
    const u = String(url || '').trim();
    if (!u) throw new Error('Paste at least one video link');
    try {
      const parsed = new URL(u);
      if (!/^https?:$/i.test(parsed.protocol)) throw new Error('bad');
      return parsed.href;
    } catch (e) {
      throw new Error(`Invalid link: ${u}`);
    }
  }

  function normalizeUrls(urls) {
    const list = (Array.isArray(urls) ? urls : [urls])
      .map((u) => String(u || '').trim())
      .filter(Boolean);
    if (!list.length) throw new Error('Paste at least one video link');
    const out = [];
    const seen = new Set();
    list.forEach((u) => {
      const href = normalizeUrl(u);
      if (!seen.has(href)) {
        seen.add(href);
        out.push(href);
      }
    });
    return out;
  }

  function normalizeEntry(id, raw) {
    if (!raw || typeof raw !== 'object') return null;
    const urls = Array.isArray(raw.urls) && raw.urls.length
      ? raw.urls.map((u) => {
        try { return normalizeUrl(u); } catch (e) { return null; }
      }).filter(Boolean)
      : (raw.url ? [String(raw.url)] : []);
    if (!urls.length && !raw.comment) return null;
    const votes = raw.votes && typeof raw.votes === 'object' ? { ...raw.votes } : {};
    Object.keys(votes).forEach((k) => { if (!votes[k]) delete votes[k]; });
    return {
      id,
      urls,
      url: urls[0] || raw.url || '',
      comment: String(raw.comment || '').trim().slice(0, 500),
      createdAt: raw.createdAt || Date.now(),
      status: raw.status || 'pending',
      round: raw.round != null ? Number(raw.round) : null,
      matchId: raw.matchId || null,
      playerId: raw.playerId || null,
      votes,
      voteCount: Object.keys(votes).length,
      updatedAt: raw.updatedAt || raw.createdAt || Date.now(),
    };
  }

  function normalizeMap(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    Object.keys(raw).forEach((id) => {
      const n = normalizeEntry(id, raw[id]);
      if (n) out[id] = n;
    });
    return out;
  }

  async function init() {
    connectionError = null;
    connected = false;
    if (isConfigured()) {
      try {
        if (!firebase.apps.length) firebase.initializeApp(fbCfg());
        db = firebase.database();
        mode = 'firebase';
      } catch (e) {
        connectionError = e.message || String(e);
        mode = 'local';
      }
    } else {
      mode = 'local';
    }

    if (mode === 'firebase') {
      const ref = db.ref(PATH);
      db.ref('.info/connected').on('value', (snap) => {
        connected = !!snap.val();
        emit();
      });
      ref.on('value', (snap) => {
        entries = normalizeMap(snap.val());
        connectionError = null;
        emit();
      }, (err) => {
        connectionError = err?.message || String(err);
        emit();
      });
      try {
        await ref.once('value');
      } catch (e) {
        connectionError = e.message || String(e);
        mode = 'local';
        entries = normalizeMap(readLocal());
        emit();
      }
    } else {
      entries = normalizeMap(readLocal());
      emit();
    }

    return { mode, connectionError };
  }

  function list() {
    return Object.values(entries).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  function get(id) {
    return entries[id] || null;
  }

  async function persist(id, entry) {
    entries = { ...entries, [id]: entry };
    if (mode === 'firebase' && db) {
      const { id: _omit, voteCount, ...payload } = entry;
      await db.ref(`${PATH}/${id}`).set(payload);
      return entry;
    }
    writeLocal(entries);
    emit();
    return entry;
  }

  async function submit({ url, urls, comment, round, matchId, playerId }) {
    const listUrls = normalizeUrls(urls != null ? urls : url);
    if (!matchId) throw new Error('Select a match');
    if (round == null || Number.isNaN(Number(round))) throw new Error('Select a week');

    const entry = {
      urls: listUrls,
      url: listUrls[0],
      comment: String(comment || '').trim().slice(0, 500),
      createdAt: Date.now(),
      status: 'pending',
      round: Number(round),
      matchId,
      playerId: playerId || null,
      votes: {},
      updatedAt: Date.now(),
    };

    if (mode === 'firebase' && db) {
      const ref = db.ref(PATH).push();
      await ref.set(entry);
      return { id: ref.key, ...entry, voteCount: 0 };
    }

    const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return persist(id, normalizeEntry(id, entry));
  }

  function hasVoted(highlightId, voterKey = sessionVoterKey()) {
    const e = entries[highlightId];
    return !!(e && e.votes && e.votes[voterKey]);
  }

  /** Cast one vote on this highlight (idempotent if already voted). */
  async function vote(highlightId, voterKey = sessionVoterKey()) {
    if (!voterKey) throw new Error('Session required to vote');
    const target = entries[highlightId];
    if (!target) throw new Error('Highlight not found');
    if (target.votes && target.votes[voterKey]) return target;

    const cur = {
      ...target,
      votes: { ...target.votes, [voterKey]: true },
      updatedAt: Date.now(),
    };
    cur.voteCount = Object.keys(cur.votes).length;

    if (mode === 'firebase' && db) {
      await db.ref().update({
        [`${PATH}/${highlightId}/votes/${voterKey}`]: true,
        [`${PATH}/${highlightId}/updatedAt`]: Date.now(),
      });
      return cur;
    }

    entries = { ...entries, [highlightId]: cur };
    writeLocal(entries);
    emit();
    return cur;
  }

  /** Remove this session's vote from one highlight. */
  async function clearVote(highlightId, voterKey = sessionVoterKey()) {
    if (!voterKey || !highlightId) return null;
    const target = entries[highlightId];
    if (!target || !target.votes || !target.votes[voterKey]) return null;

    if (mode === 'firebase' && db) {
      await db.ref().update({
        [`${PATH}/${highlightId}/votes/${voterKey}`]: null,
        [`${PATH}/${highlightId}/updatedAt`]: Date.now(),
      });
      return highlightId;
    }

    const next = { ...target, votes: { ...target.votes } };
    delete next.votes[voterKey];
    next.voteCount = Object.keys(next.votes).length;
    next.updatedAt = Date.now();
    entries = { ...entries, [highlightId]: next };
    writeLocal(entries);
    emit();
    return highlightId;
  }

  /**
   * Top N voted highlights for a week + match.
   * Prefer matchId; also require round when provided / available.
   */
  function topForMatch(matchId, n = 3, round = null) {
    const match = (window.DB?.matches || []).find((m) => m.id === matchId);
    const week = round != null ? Number(round) : (match?.round ?? null);
    return list()
      .filter((e) => {
        if (e.matchId !== matchId || e.voteCount <= 0) return false;
        if (week == null) return true;
        return e.round == null || Number(e.round) === week;
      })
      .sort((a, b) => b.voteCount - a.voteCount || b.updatedAt - a.updatedAt)
      .slice(0, n);
  }

  function status() {
    return { mode, connectionError, connected, count: Object.keys(entries).length };
  }

  return {
    init, onChange, list, get, submit, vote, clearVote, hasVoted,
    sessionVoterKey, topForMatch, status,
  };
})();

window.HighlightsHub = HighlightsHub;
