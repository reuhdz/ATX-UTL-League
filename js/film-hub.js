/* =============================================================================
   Film hub — live game-film URLs (Box / Drive / etc.)
   -----------------------------------------------------------------------------
   Path: /matchFilm/{roomId}/{matchId}
   Shape: { url: string, updatedAt: number }
   Media cards + game-log Film icons read from here first so new week links
   appear for open tabs without a page refresh or site deploy.
   ============================================================================ */

const FilmHub = (() => {
  const cfg = () => window.DRAFT_CONFIG || {};
  const fbCfg = () => window.FIREBASE_CONFIG || {};
  const roomId = () => cfg().roomId || 'season5';
  const path = () => `matchFilm/${roomId()}`;

  let db = null;
  let mode = 'local';
  let connectionError = null;
  let connected = false;
  /** @type {Record<string, { url: string, updatedAt?: number }>} */
  let links = {};
  const listeners = new Set();

  function emit() {
    listeners.forEach((fn) => {
      try { fn({ links, mode, connectionError, connected }); } catch (e) { /* ignore */ }
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
    return `atxutl.matchFilm.${roomId()}`;
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
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Film link must be http(s)');
      }
      return parsed.href;
    } catch (e) {
      if (e.message && e.message.includes('Film link')) throw e;
      throw new Error('Paste a valid film URL (e.g. Box or Drive share link)');
    }
  }

  function normalizeEntry(raw) {
    if (raw == null) return null;
    if (typeof raw === 'string') {
      const url = String(raw).trim();
      return url ? { url, updatedAt: null } : null;
    }
    if (typeof raw !== 'object') return null;
    const url = String(raw.url || '').trim();
    if (!url) return null;
    return { url, updatedAt: raw.updatedAt || null };
  }

  function normalizeMap(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    Object.keys(raw).forEach((id) => {
      const n = normalizeEntry(raw[id]);
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
        console.warn('FilmHub Firebase init failed, using local mode', e);
        connectionError = e.message || String(e);
        mode = 'local';
      }
    } else {
      mode = 'local';
    }

    if (mode === 'firebase') {
      const ref = db.ref(path());
      db.ref('.info/connected').on('value', (snap) => {
        connected = !!snap.val();
        emit();
      });
      ref.on('value', (snap) => {
        links = normalizeMap(snap.val());
        writeLocal(links);
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
        links = normalizeMap(readLocal());
        emit();
      }
    } else {
      links = normalizeMap(readLocal());
      emit();
    }

    return { mode, connectionError };
  }

  function urlFor(matchId) {
    if (!matchId) return '';
    return links[matchId]?.url || '';
  }

  function entryFor(matchId) {
    return matchId ? (links[matchId] || null) : null;
  }

  function all() {
    return { ...links };
  }

  async function setUrl(matchId, url) {
    if (!matchId) throw new Error('Select a match');
    const cleaned = normalizeUrl(url);
    const entry = { url: cleaned, updatedAt: Date.now() };
    links = { ...links, [matchId]: entry };
    if (mode === 'firebase' && db) {
      await db.ref(`${path()}/${matchId}`).set(entry);
      return entry;
    }
    writeLocal(links);
    emit();
    return entry;
  }

  async function clearUrl(matchId) {
    if (!matchId) throw new Error('Select a match');
    const next = { ...links };
    delete next[matchId];
    links = next;
    if (mode === 'firebase' && db) {
      await db.ref(`${path()}/${matchId}`).remove();
      return;
    }
    writeLocal(links);
    emit();
  }

  function status() {
    return { mode, configured: mode === 'firebase', connectionError, connected };
  }

  return {
    init, onChange, urlFor, entryFor, all, setUrl, clearUrl, normalizeUrl, status,
  };
})();

window.FilmHub = FilmHub;
