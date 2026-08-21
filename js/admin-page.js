/* /admin — login + tool links */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const root = $('#admin-app');
  if (!root) return;

  function applyTheme() {
    let theme = 'dark';
    try { theme = localStorage.getItem('atxutl.theme') || 'dark'; } catch (e) {}
    document.documentElement.dataset.theme = theme;
  }

  function paint() {
    const s = AdminAuth.session();
    if (!s) {
      root.innerHTML = `
        <div class="page-head"><h2>Staff login</h2></div>
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
      <div class="page-head">
        <h2>Welcome, ${s.label || s.username}</h2>
      </div>
      <section class="panel admin-links">
        <ul class="admin-link-list">
          <li><a class="btn" href="../stats/">Match stats entry</a></li>
          <li><a class="btn" href="../season-5-highlights/">Season 5 highlights review</a></li>
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
