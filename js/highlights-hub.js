/* =============================================================================
   Highlights hub — user-submitted clip nominations
   -----------------------------------------------------------------------------
   Path: /season5-highlights/{pushId}
   Shape: { urls:[...], url, comment, createdAt, status: 'pending'|'approved'|'rejected' }
   ============================================================================ */

const HighlightsHub = (() => {
  const PATH = 'season5-highlights';
  const fbCfg = () => window.FIREBASE_CONFIG || {};

  let db = null;
  let mode = 'local';
  let connectionError = null;

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

  async function init() {
    connectionError = null;
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
    return { mode, connectionError };
  }

  async function submit({ url, urls, comment }) {
    const list = normalizeUrls(urls != null ? urls : url);
    const entry = {
      urls: list,
      url: list[0], // convenience for single-link readers
      comment: String(comment || '').trim().slice(0, 500),
      createdAt: Date.now(),
      status: 'pending',
    };

    if (mode === 'firebase' && db) {
      const ref = db.ref(PATH).push();
      await ref.set(entry);
      return { id: ref.key, ...entry };
    }

    const id = `local_${Date.now()}`;
    const map = readLocal();
    map[id] = entry;
    writeLocal(map);
    return { id, ...entry };
  }

  function status() {
    return { mode, connectionError };
  }

  return { init, submit, status };
})();

window.HighlightsHub = HighlightsHub;
