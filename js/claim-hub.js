/* =============================================================================
   Soft match claim — claim/release only (no heartbeats).
   -----------------------------------------------------------------------------
   Path: /matchClaims/{roomId}/{matchId}
   Shape: {
     sessionId, username, label, role,
     matchId, week, round, home, away,
     claimedAt
   }
   Ownership is the logged-in username. Non-owners cannot save that game.
   Claims older than 16 hours are treated as expired and cleared.
   ============================================================================ */

const ClaimHub = (() => {
  const CLAIM_MAX_AGE_MS = 16 * 60 * 60 * 1000; // 16 hours from claimedAt
  const cfg = () => window.DRAFT_CONFIG || {};
  const fbCfg = () => window.FIREBASE_CONFIG || {};
  const roomId = () => cfg().roomId || 'season5';
  const path = () => `matchClaims/${roomId()}`;

  let db = null;
  let mode = 'local';
  let ready = false;
  let sessionId = null;
  /** @type {Record<string, object>} */
  let claimsByMatch = Object.create(null);
  const listeners = new Set();
  /** @type {Set<string>} */
  const expiring = new Set();

  function emit() {
    listeners.forEach((fn) => {
      try { fn(); } catch (e) { /* ignore */ }
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
    return `atxutl.matchClaims.${roomId()}`;
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

  function ensureSessionId() {
    if (sessionId) return sessionId;
    try {
      sessionId = sessionStorage.getItem('atxutl.statsClaimSession');
      if (!sessionId) {
        sessionId = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
        sessionStorage.setItem('atxutl.statsClaimSession', sessionId);
      }
    } catch (e) {
      sessionId = `s_tmp_${Date.now().toString(36)}`;
    }
    return sessionId;
  }

  function actor() {
    const s = (typeof AdminAuth !== 'undefined' && AdminAuth.session) ? AdminAuth.session() : null;
    if (!s) return null;
    const username = String(s.username || '').trim();
    if (!username) return null;
    return {
      username,
      label: String(s.label || username).trim() || username,
      role: s.role || null,
    };
  }

  function sameUser(a, b) {
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  }

  function normalizeClaim(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const username = String(raw.username || '').trim();
    if (!username) return null;
    return {
      sessionId: String(raw.sessionId || '').trim(),
      username,
      label: String(raw.label || username).trim() || username,
      role: raw.role || null,
      matchId: String(raw.matchId || '').trim() || null,
      week: raw.week != null ? Number(raw.week) : null,
      round: raw.round != null ? Number(raw.round) : null,
      home: raw.home ? String(raw.home) : null,
      away: raw.away ? String(raw.away) : null,
      claimedAt: Number(raw.claimedAt) || 0,
    };
  }

  function normalizeMap(raw) {
    const out = Object.create(null);
    if (!raw || typeof raw !== 'object') return out;
    Object.keys(raw).forEach((matchId) => {
      const claim = normalizeClaim(raw[matchId]);
      if (claim) out[matchId] = claim;
    });
    return out;
  }

  function isStale(claim) {
    if (!claim || !claim.claimedAt) return true;
    return (Date.now() - Number(claim.claimedAt)) > CLAIM_MAX_AGE_MS;
  }

  function formatClaimedAt(ts) {
    const n = Number(ts);
    if (!n) return '';
    try {
      return new Date(n).toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch (e) {
      return new Date(n).toISOString();
    }
  }

  async function removeClaimRecord(matchId) {
    const id = String(matchId);
    if (mode === 'firebase' && db) {
      await db.ref(`${path()}/${id}`).remove();
      return;
    }
    if (!claimsByMatch[id]) return;
    const next = { ...claimsByMatch };
    delete next[id];
    claimsByMatch = next;
    writeLocal(claimsByMatch);
    emit();
  }

  /** Clear a claim older than 16h (fire-and-forget; deduped per match). */
  function expireIfStale(matchId) {
    const id = String(matchId);
    const claim = claimsByMatch[id];
    if (!claim || !isStale(claim) || expiring.has(id)) return false;
    expiring.add(id);
    removeClaimRecord(id).catch((e) => {
      console.warn('ClaimHub expire failed', e);
    }).finally(() => {
      expiring.delete(id);
    });
    return true;
  }

  function sweepStale() {
    Object.keys(claimsByMatch).forEach((id) => { expireIfStale(id); });
  }

  async function init() {
    if (ready) return { mode };
    ensureSessionId();

    if (isConfigured()) {
      try {
        if (!firebase.apps.length) firebase.initializeApp(fbCfg());
        db = firebase.database();
        mode = 'firebase';
      } catch (e) {
        console.warn('ClaimHub Firebase init failed, using local mode', e);
        mode = 'local';
      }
    } else {
      mode = 'local';
    }

    if (mode === 'firebase') {
      db.ref(path()).on('value', (snap) => {
        claimsByMatch = normalizeMap(snap.val());
        sweepStale();
        emit();
      }, (err) => {
        console.warn('ClaimHub sync error', err);
      });
    } else {
      claimsByMatch = normalizeMap(readLocal());
      sweepStale();
      emit();
    }

    ready = true;
    return { mode };
  }

  /** Active (non-stale) claim, or null. Stale claims are cleared. */
  function getClaim(matchId) {
    const id = String(matchId);
    const claim = claimsByMatch[id] || null;
    if (!claim) return null;
    if (isStale(claim)) {
      expireIfStale(id);
      return null;
    }
    return claim;
  }

  /** True when the logged-in username owns the active claim for this match. */
  function isMine(matchId) {
    const claim = getClaim(matchId);
    const who = actor();
    return !!(claim && who && sameUser(claim.username, who.username));
  }

  /**
   * Unclaimed / expired → anyone logged in may edit.
   * Claimed by me → edit.
   * Claimed by someone else (fresh) → no edit.
   */
  function canEdit(matchId) {
    const claim = getClaim(matchId);
    if (!claim) return true;
    return isMine(matchId);
  }

  function assertCanEdit(matchId) {
    if (canEdit(matchId)) return;
    const claim = getClaim(matchId);
    const name = claim?.label || claim?.username || 'another captain';
    const when = claim?.claimedAt ? ` (since ${formatClaimedAt(claim.claimedAt)})` : '';
    throw new Error(`${name} claimed this game${when} — ask them to Release`);
  }

  /**
   * @param {string} matchId
   * @param {{ week?: number, round?: number, home?: string, away?: string }} [meta]
   */
  async function claim(matchId, meta = {}) {
    if (!matchId) throw new Error('Select a match');
    const who = actor();
    if (!who) throw new Error('Log in to claim a game');

    const existing = getClaim(matchId);
    if (existing && !sameUser(existing.username, who.username)) {
      throw new Error(`${existing.label || existing.username} already claimed this game at ${formatClaimedAt(existing.claimedAt)}`);
    }

    const payload = {
      sessionId: ensureSessionId(),
      username: who.username,
      label: who.label,
      role: who.role,
      matchId: String(matchId),
      week: meta.week != null ? Number(meta.week) : null,
      round: meta.round != null ? Number(meta.round) : null,
      home: meta.home ? String(meta.home) : null,
      away: meta.away ? String(meta.away) : null,
      claimedAt: mode === 'firebase'
        ? firebase.database.ServerValue.TIMESTAMP
        : Date.now(),
    };

    if (mode === 'firebase' && db) {
      await db.ref(`${path()}/${matchId}`).set(payload);
      return;
    }
    claimsByMatch = {
      ...claimsByMatch,
      [String(matchId)]: normalizeClaim({ ...payload, claimedAt: Date.now() }),
    };
    writeLocal(claimsByMatch);
    emit();
  }

  async function release(matchId) {
    if (!matchId) return;
    const claim = getClaim(matchId);
    if (!claim) return;
    const who = actor();
    if (!who || !sameUser(claim.username, who.username)) {
      throw new Error('Only the claimer can release this game');
    }
    await removeClaimRecord(matchId);
  }

  return {
    init,
    onChange,
    getClaim,
    isMine,
    canEdit,
    assertCanEdit,
    claim,
    release,
    isStale,
    formatClaimedAt,
    CLAIM_MAX_AGE_MS,
  };
})();

window.ClaimHub = ClaimHub;
