/* /admin — login + tool links (no Firebase; live tools open on their own pages) */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const root = $('#admin-app');
  if (!root) return;

  function applyTheme() {
    let theme = 'dark';
    try { theme = localStorage.getItem('atxutl.theme') || 'dark'; } catch (e) {}
    document.documentElement.dataset.theme = theme;
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function seasonHead(title) {
    const captains = (window.DB?.teams || []).filter((t) => t.captain).map((t) => t.captain);
    return `
      <div class="page-head">
        <h2>${title}</h2>
        <p class="muted">${escapeHtml(DB.season.label)} · captain logins: ${escapeHtml(captains.join(', ') || 'none')}</p>
      </div>
      <div class="se-toolbar">${SeasonSwitcher.html()}</div>
      ${SeasonSwitcher.bannerHtml()}`;
  }

  function paint() {
    const s = AdminAuth.session();
    if (!s) {
      root.innerHTML = `
        ${seasonHead('Staff login')}
        <section class="panel se-lock">
          <label class="se-pin"><span>Username</span>
            <input id="ad-user" class="input" autocomplete="username" placeholder="Captain name or utladmin" />
          </label>
          <label class="se-pin"><span>Password</span>
            <input id="ad-pass" class="input" type="password" autocomplete="current-password" placeholder="Team name (one word) or utlmaster" />
          </label>
          <button type="button" class="btn" id="ad-login">Log in</button>
          <p id="ad-msg" class="draft-msg"></p>
          <p class="muted small"><a href="../">← Dashboard</a></p>
        </section>`;
      const doLogin = () => {
        try {
          AdminAuth.login($('#ad-user')?.value, $('#ad-pass')?.value);
          paint();
        } catch (e) {
          const el = $('#ad-msg');
          if (el) {
            el.className = 'draft-msg err';
            el.textContent = e.message || String(e);
          }
        }
      };
      $('#ad-login')?.addEventListener('click', doLogin);
      ['ad-user', 'ad-pass'].forEach((id) => {
        $(`#${id}`)?.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') doLogin();
        });
      });
      return;
    }

    root.innerHTML = `
      ${seasonHead(`Welcome, ${escapeHtml(s.label || s.username)}`)}
      <section class="panel admin-links">
        <ul class="admin-link-list">
          <li><a class="btn" href="../stats/">Match stats entry</a></li>
          <li><a class="btn btn-ghost" href="../contention/">Stat contention</a></li>
          <li><a class="btn btn-ghost" href="../season-5-highlights/">Highlight nominations</a></li>
          <li><a class="btn btn-ghost" href="../#volunteer">Volunteer board</a></li>
          <li><a class="btn btn-ghost" href="../">League dashboard</a></li>
        </ul>
        <button type="button" class="btn btn-ghost" id="ad-logout">Log out</button>
      </section>`;
    $('#ad-logout')?.addEventListener('click', () => {
      AdminAuth.logout();
      paint();
    });
  }

  applyTheme();
  paint();
})();
