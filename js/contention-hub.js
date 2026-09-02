/* =============================================================================
   Stat contention hub — contest / request box-score changes
   -----------------------------------------------------------------------------
   Path: /statContentions/{roomId}/{id}
   Shape:
     {
       id, playerId, playerName, matchId, round, field,
       action: 'contest' | 'request',
       currentValue, proposedValue,
       videoUrl, comment,
       createdAt, createdBy: { username, label },
       status: 'open' | 'passed' | 'failed' | 'applied',
       votes: { [voterKey]: 'for' | 'against' },
       updatedAt
     }
   Captains + admin vote. After ≥5 votes, majority "for" passes.
   ============================================================================ */

const ContentionHub = (() => {
  const STAT_FIELDS = ['goals', 'assists', 'steals', 'blocks', 'turnovers', 'swimOffAttempts', 'swimOffs', 'shots'];
  const VOTE_QUORUM = 5;
  const cfg = () => window.DRAFT_CONFIG || {};
  const fbCfg = () => window.FIREBASE_CONFIG || {};
  const roomId = () => cfg().roomId || 'season5';
  const path = () => `statContentions/${roomId()}`;

  let db = null;
  let mode = 'local';
  let connectionError = null;
  /** @type {Record<string, object>} */
  let entries = {};
  const listeners = new Set();

  function emit() {
    listeners.forEach((fn) => {
      try { fn({ entries, mode, connectionError }); } catch (e) { /* ignore */ }
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
    return `atxutl.statContentions.${roomId()}`;
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

  function normalizeUrl(url) {
    const u = String(url || '').trim();
    if (!u) return '';
    try {
      const parsed = new URL(u);
      if (!/^https?:$/i.test(parsed.protocol)) throw new Error('bad');
      return parsed.href;
    } catch (e) {
      throw new Error('Video link must be a valid http(s) URL');
    }
  }

  function tally(votes) {
    const v = votes && typeof votes === 'object' ? votes : {};
    let forCount = 0;
    let againstCount = 0;
    Object.keys(v).forEach((k) => {
      if (v[k] === 'for') forCount += 1;
      else if (v[k] === 'against') againstCount += 1;
    });
    return { forCount, againstCount, total: forCount + againstCount };
  }

  function deriveStatus(entry) {
    if (!entry) return 'open';
    if (entry.status === 'applied') return 'applied';
    const { forCount, againstCount, total } = tally(entry.votes);
    if (total < VOTE_QUORUM) return 'open';
    if (forCount > againstCount) return 'passed';
    if (againstCount > forCount) return 'failed';
    return 'open'; // tie stays open until broken
  }

  function normalize(raw, id) {
    if (!raw || typeof raw !== 'object') return null;
    const playerId = String(raw.playerId || '').trim();
    const field = String(raw.field || '').trim();
    if (!playerId || !STAT_FIELDS.includes(field)) return null;
    const action = raw.action === 'request' ? 'request' : 'contest';
    const votes = {};
    if (raw.votes && typeof raw.votes === 'object') {
      Object.keys(raw.votes).forEach((k) => {
        const val = raw.votes[k];
        if (val === 'for' || val === 'against') votes[k] = val;
      });
    }
    const entry = {
      id: String(raw.id || id),
      playerId,
      playerName: String(raw.playerName || playerId),
      matchId: String(raw.matchId || '').trim() || null,
      round: raw.round != null ? Number(raw.round) : null,
      field,
      action,
      currentValue: raw.currentValue != null ? Number(raw.currentValue) : null,
      proposedValue: Number(raw.proposedValue),
      videoUrl: String(raw.videoUrl || '').trim(),
      comment: String(raw.comment || '').trim().slice(0, 500),
      createdAt: Number(raw.createdAt) || 0,
      createdBy: raw.createdBy && typeof raw.createdBy === 'object'
        ? {
          username: String(raw.createdBy.username || '').trim(),
          label: String(raw.createdBy.label || raw.createdBy.username || '').trim(),
        }
        : null,
      votes,
      status: raw.status === 'applied' ? 'applied' : 'open',
      updatedAt: Number(raw.updatedAt) || Number(raw.createdAt) || 0,
    };
    if (!Number.isFinite(entry.proposedValue) || entry.proposedValue < 0) return null;
    entry.status = entry.status === 'applied' ? 'applied' : deriveStatus(entry);
    return entry;
  }

  function normalizeMap(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    Object.keys(raw).forEach((id) => {
      const n = normalize(raw[id], id);
      if (n) out[id] = n;
    });
    return out;
  }

  async function persist(id, entry) {
    if (mode === 'firebase' && db) {
      await db.ref(`${path()}/${id}`).set(entry);
      return;
    }
    entries = { ...entries, [id]: entry };
    writeLocal(entries);
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
        console.warn('ContentionHub Firebase init failed', e);
        connectionError = e.message || String(e);
        mode = 'local';
      }
    } else {
      mode = 'local';
    }

    if (mode === 'firebase') {
      db.ref(path()).on('value', (snap) => {
        entries = normalizeMap(snap.val());
        connectionError = null;
        emit();
      }, (err) => {
        connectionError = err?.message || String(err);
        emit();
      });
    } else {
      entries = normalizeMap(readLocal());
      emit();
    }
    return { mode };
  }

  function list(filterStatus) {
    return Object.values(entries)
      .filter((e) => !filterStatus || e.status === filterStatus)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  function get(id) {
    return entries[String(id)] || null;
  }

  function voterKey() {
    const s = (typeof AdminAuth !== 'undefined' && AdminAuth.session) ? AdminAuth.session() : null;
    return s?.voterKey || s?.username || null;
  }

  function canVote() {
    return typeof AdminAuth !== 'undefined' && AdminAuth.canVote && AdminAuth.canVote();
  }

  async function submit(payload) {
    const playerId = String(payload.playerId || '').trim();
    const field = String(payload.field || '').trim();
    if (!playerId) throw new Error('Select a player');
    if (!STAT_FIELDS.includes(field)) throw new Error('Select a stat');
    const action = payload.action === 'request' ? 'request' : 'contest';
    const proposedValue = Math.max(0, Math.round(Number(payload.proposedValue)));
    if (!Number.isFinite(proposedValue)) throw new Error('Enter a proposed value');
    const comment = String(payload.comment || '').trim();
    if (!comment) throw new Error('Add a short comment explaining the request');
    const videoUrl = payload.videoUrl ? normalizeUrl(payload.videoUrl) : '';
    const p = window.DB?.player?.(playerId);
    const s = (typeof AdminAuth !== 'undefined' && AdminAuth.session) ? AdminAuth.session() : null;
    const id = `sc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const entry = normalize({
      id,
      playerId,
      playerName: p?.name || playerId,
      matchId: payload.matchId || null,
      round: payload.round != null ? payload.round : null,
      field,
      action,
      currentValue: payload.currentValue != null ? Number(payload.currentValue) : null,
      proposedValue,
      videoUrl,
      comment: comment.slice(0, 500),
      createdAt: Date.now(),
      createdBy: s
        ? { username: s.username, label: s.label || s.username }
        : { username: 'public', label: String(payload.submitterName || 'Player').trim() || 'Player' },
      votes: {},
      status: 'open',
      updatedAt: Date.now(),
    }, id);
    if (!entry) throw new Error('Could not create contention');
    await persist(id, entry);
    return entry;
  }

  async function vote(id, choice) {
    if (!canVote()) throw new Error('Captain or admin login required to vote');
    const key = voterKey();
    if (!key) throw new Error('Missing voter identity');
    if (choice !== 'for' && choice !== 'against') throw new Error('Invalid vote');
    const prev = get(id);
    if (!prev) throw new Error('Contention not found');
    if (prev.status === 'applied') throw new Error('Already applied');
    if (prev.status === 'failed') throw new Error('Voting closed — request failed');
    if (prev.status === 'passed') throw new Error('Already passed — apply or wait');

    const votes = { ...(prev.votes || {}), [key]: choice };
    const next = normalize({
      ...prev,
      votes,
      updatedAt: Date.now(),
      status: 'open',
    }, id);
    next.status = deriveStatus(next);
    await persist(id, next);
    return next;
  }

  async function clearVote(id) {
    if (!canVote()) throw new Error('Captain or admin login required');
    const key = voterKey();
    const prev = get(id);
    if (!prev || !prev.votes?.[key]) return prev;
    if (prev.status !== 'open' && tally(prev.votes).total >= VOTE_QUORUM) {
      throw new Error('Voting already resolved');
    }
    const votes = { ...prev.votes };
    delete votes[key];
    const next = normalize({ ...prev, votes, updatedAt: Date.now(), status: 'open' }, id);
    next.status = deriveStatus(next);
    await persist(id, next);
    return next;
  }

  async function markApplied(id) {
    const prev = get(id);
    if (!prev) throw new Error('Contention not found');
    if (prev.status !== 'passed' && prev.status !== 'applied') {
      throw new Error('Only passed contentions can be applied');
    }
    const next = { ...prev, status: 'applied', updatedAt: Date.now() };
    await persist(id, next);
    return next;
  }

  function myVote(id) {
    const key = voterKey();
    const e = get(id);
    return (key && e?.votes?.[key]) || null;
  }

  return {
    init, onChange, list, get, submit, vote, clearVote, markApplied, myVote,
    canVote, voterKey, tally, fields: STAT_FIELDS, VOTE_QUORUM,
    status: () => ({ mode, connectionError, count: Object.keys(entries).length }),
  };
})();

window.ContentionHub = ContentionHub;
