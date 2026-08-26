/* =============================================================================
   Soft match claim — informational only (no hard lock, no heartbeats).
   -----------------------------------------------------------------------------
   Path: /matchClaims/{roomId}/{matchId}
   Shape: { sessionId, username, label, claimedAt }
   Claim stays until Release (or someone Claims instead). Saves are never blocked.
   ============================================================================ */

const ClaimHub = (() => {
  const cfg = () => window.DRAFT_CONFIG || {};
  const fbCfg = () => window.FIREBASE_CONFIG || {};
  const roomId = () => cfg().roomId || 'season5';
  const path = () => `matchClaims/${roomId()}`;

  let db = null;
  let mode = 'local';
  let ready = false;
  let sessionId = null;
  /** @type {Record<string, { sessionId: string, username: string, label: string, claimedAt: number }>} */
  let claimsByMatch = Object.create(null);
  const listeners = new Set();

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
    const username = (s && (s.username || s.label)) || 'captain';
    const label = (s && (s.label || s.username)) || username;
    return { username: String(username), label: String(label) };
  }

  function normalizeClaim(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const sid = String(raw.sessionId || '').trim();
    const user = String(raw.username || '').trim();
    if (!sid || !user) return null;
    return {
      sessionId: sid,
      username: user,
      label: String(raw.label || user).trim() || user,
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
        emit();
      }, (err) => {
        console.warn('ClaimHub sync error', err);
      });
    } else {
      claimsByMatch = normalizeMap(readLocal());
      emit();
    }

    ready = true;
    return { mode };
  }

  function getClaim(matchId) {
    return claimsByMatch[String(matchId)] || null;
  }

  function isMine(matchId) {
    const claim = getClaim(matchId);
    return !!(claim && claim.sessionId === ensureSessionId());
  }

  async function claim(matchId) {
    if (!matchId) return;
    const who = actor();
    const payload = {
      sessionId: ensureSessionId(),
      username: who.username,
      label: who.label,
      claimedAt: mode === 'firebase'
        ? firebase.database.ServerValue.TIMESTAMP
        : Date.now(),
    };
    if (mode === 'firebase' && db) {
      await db.ref(`${path()}/${matchId}`).set(payload);
      return;
    }
    claimsByMatch = { ...claimsByMatch, [String(matchId)]: normalizeClaim({
      ...payload,
      claimedAt: Date.now(),
    }) };
    writeLocal(claimsByMatch);
    emit();
  }

  async function release(matchId) {
    if (!matchId) return;
    if (mode === 'firebase' && db) {
      await db.ref(`${path()}/${matchId}`).remove();
      return;
    }
    const next = { ...claimsByMatch };
    delete next[String(matchId)];
    claimsByMatch = next;
    writeLocal(claimsByMatch);
    emit();
  }

  return { init, onChange, getClaim, isMine, claim, release };
})();

window.ClaimHub = ClaimHub;
