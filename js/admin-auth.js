/* =============================================================================
   Admin / captain session auth (client-side gate for /admin tools)
   -----------------------------------------------------------------------------
   Captains: username = captain first name, password = team name one word
   Admin:    username = utladmin, password = utlmaster
   ============================================================================ */

const AdminAuth = (() => {
  const KEY = 'atxutl.auth';

  function norm(s) {
    return String(s || '').trim().toLowerCase();
  }

  function teamPassword(team) {
    return norm(team.name).replace(/[^a-z0-9]/g, '');
  }

  function accounts() {
    const list = [{
      role: 'admin',
      username: 'utladmin',
      password: 'utlmaster',
      label: 'League admin',
      voterKey: 'utladmin',
    }];
    (window.DB?.teams || []).forEach((t) => {
      list.push({
        role: 'captain',
        username: norm(t.captain),
        password: teamPassword(t),
        label: `${t.captain} · ${t.name}`,
        teamId: t.id,
        captain: t.captain,
        voterKey: norm(t.captain),
      });
    });
    return list;
  }

  function read() {
    try {
      const raw = sessionStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function write(session) {
    try {
      if (session) sessionStorage.setItem(KEY, JSON.stringify(session));
      else sessionStorage.removeItem(KEY);
    } catch (e) { /* ignore */ }
  }

  function login(username, password) {
    const u = norm(username);
    const p = norm(password).replace(/[^a-z0-9]/g, '');
    const acct = accounts().find((a) => a.username === u && a.password === p);
    if (!acct) throw new Error('Invalid username or password');
    const session = {
      role: acct.role,
      username: acct.username,
      label: acct.label,
      teamId: acct.teamId || null,
      captain: acct.captain || null,
      voterKey: acct.voterKey,
      at: Date.now(),
    };
    write(session);
    return session;
  }

  function logout() {
    write(null);
  }

  function session() {
    return read();
  }

  function isLoggedIn() {
    return !!read();
  }

  function isAdmin() {
    return read()?.role === 'admin';
  }

  function isCaptain() {
    return read()?.role === 'captain';
  }

  function canVote() {
    return isAdmin() || isCaptain();
  }

  function requireLogin(redirectTo = '../admin/') {
    if (!isLoggedIn()) {
      window.location.href = redirectTo;
      return false;
    }
    return true;
  }

  function requireAdmin(redirectTo = '../admin/') {
    if (!isAdmin()) {
      window.location.href = redirectTo;
      return false;
    }
    return true;
  }

  return {
    login, logout, session, isLoggedIn, isAdmin, isCaptain, canVote,
    requireLogin, requireAdmin, accounts, teamPassword,
  };
})();

window.AdminAuth = AdminAuth;
