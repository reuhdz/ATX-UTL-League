/* /admin — login, tool links, and team / roster editor (admin + captains) */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
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

  function toolLinks() {
    return `
      <section class="panel admin-links">
        <ul class="admin-link-list">
          <li><a class="btn" href="../stats/">Match stats entry</a></li>
          <li><a class="btn btn-ghost" href="../contention/">Stat contention</a></li>
          <li><a class="btn btn-ghost" href="../season-5-highlights/">Highlight nominations</a></li>
          <li><a class="btn btn-ghost" href="../#volunteer">Volunteer board</a></li>
          <li><a class="btn btn-ghost" href="../">League dashboard</a></li>
        </ul>
      </section>`;
  }

  function poolOptions(teamId) {
    const onTeam = new Set((DB.rosterOf(teamId) || []).map((p) => p.id));
    const inSeason = new Set(DB.seasonRosterIds || []);
    const seasonFa = (DB.players || []).filter((p) => inSeason.has(p.id) && p.teamId === 'fa' && !onTeam.has(p.id));
    const others = (DB.players || []).filter((p) => !onTeam.has(p.id) && !seasonFa.some((x) => x.id === p.id));
    const opt = (p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`;
    return `
      <option value="">Add existing player…</option>
      ${seasonFa.length ? `<optgroup label="Free agents">${seasonFa.map(opt).join('')}</optgroup>` : ''}
      ${others.length ? `<optgroup label="All-time directory">${others.map(opt).join('')}</optgroup>` : ''}`;
  }

  function teamSelect(playerId, currentId) {
    const opts = [
      `<option value="fa" ${currentId === 'fa' ? 'selected' : ''}>Free agent</option>`,
      ...(DB.teams || []).map((t) =>
        `<option value="${escapeHtml(t.id)}" ${t.id === currentId ? 'selected' : ''}>${escapeHtml(t.name)}</option>`),
    ];
    return `<select class="select lg-move" data-player="${escapeHtml(playerId)}" aria-label="Team">${opts.join('')}</select>`;
  }

  function editorHtml() {
    const st = window.LeagueHub?.status?.() || {};
    const archived = DB.isArchived();
    const teams = DB.teams || [];
    return `
      <section class="panel lg-editor" id="lg-editor">
        <div class="panel-head">
          <h3>Teams &amp; rosters</h3>
          <span class="muted small">${st.mode === 'firebase' ? 'Live' : 'This browser only'}</span>
        </div>
        <p class="muted small">Rename a team or a player, mark a captain, move someone between clubs, or add a new name. Changes show on the dashboard, draft, and stats pages for this season. The captain login is that player&apos;s name; the password is the team name as one word.</p>
        ${archived ? `<p class="draft-msg err">${escapeHtml(DB.season.label)} is archived — edits here change the historical record.</p>` : ''}
        <p id="lg-msg" class="draft-msg ${escapeHtml(lastMsg.cls)}">${escapeHtml(lastMsg.text)}</p>
        <div class="lg-grid">
          ${teams.map((t) => {
            const roster = DB.rosterOf(t.id);
            return `
            <article class="lg-team" style="--tc:${t.color}" data-team="${escapeHtml(t.id)}">
              <header class="lg-team-head">
                <label>Team name
                  <input class="input lg-team-name" maxlength="40" value="${escapeHtml(t.name)}" />
                </label>
                <button type="button" class="btn lg-save-team">Save name</button>
              </header>
              ${t.captain ? `<p class="muted small">Captain login: ${escapeHtml(t.captain)}</p>` : '<p class="muted small">No captain set — pick one with the radio on a roster row.</p>'}
              ${t.visiting ? `<p class="muted small">Visiting club — add a player to start tracking a roster.</p>` : ''}
              <ul class="lg-roster">
                ${roster.length ? roster.map((p) => {
                  const isCap = window.LeagueHub?.isTeamCaptain?.(t.id, p.id) || p.name === t.captain;
                  return `
                  <li>
                    <label class="lg-cap">
                      <input type="radio" class="lg-captain" name="lg-cap-${escapeHtml(t.id)}" data-team="${escapeHtml(t.id)}" data-player="${escapeHtml(p.id)}" ${isCap ? 'checked' : ''} />
                      <span>Captain</span>
                    </label>
                    <input class="input lg-player-name" maxlength="40" data-player="${escapeHtml(p.id)}" value="${escapeHtml(p.name)}" />
                    ${teamSelect(p.id, t.id)}
                    <button type="button" class="btn btn-ghost lg-remove" data-player="${escapeHtml(p.id)}">Remove</button>
                  </li>`;
                }).join('') : '<li class="muted">No players on this roster yet.</li>'}
              </ul>
              <div class="lg-add">
                <select class="select lg-existing">${poolOptions(t.id)}</select>
                <button type="button" class="btn btn-ghost lg-add-existing">Add</button>
                <input class="input lg-new-name" maxlength="40" placeholder="New player name" />
                <button type="button" class="btn lg-add-new">Add new</button>
              </div>
            </article>`;
          }).join('')}
        </div>
      </section>`;
  }

  let lastMsg = { text: '', cls: '' };

  function setMsg(text, cls = '') {
    lastMsg = { text: text || '', cls };
    const el = $('#lg-msg');
    if (!el) return;
    el.className = `draft-msg ${cls}`.trim();
    el.textContent = text || '';
  }

  function bindEditor() {
    const host = $('#lg-editor');
    if (!host || !window.LeagueHub) return;

    $$('.lg-save-team', host).forEach((btn) => {
      btn.addEventListener('click', async () => {
        const card = btn.closest('.lg-team');
        try {
          await LeagueHub.setTeamName(card.dataset.team, card.querySelector('.lg-team-name')?.value);
          setMsg('Team name saved.', 'ok');
          paint();
        } catch (e) { setMsg(e.message || String(e), 'err'); }
      });
    });

    $$('.lg-player-name', host).forEach((inp) => {
      inp.addEventListener('change', async () => {
        try {
          await LeagueHub.setPlayerName(inp.dataset.player, inp.value);
          setMsg('Player name saved.', 'ok');
          paint();
        } catch (e) { setMsg(e.message || String(e), 'err'); }
      });
    });

    $$('.lg-move', host).forEach((sel) => {
      sel.addEventListener('change', async () => {
        try {
          await LeagueHub.movePlayer(sel.dataset.player, sel.value);
          setMsg(sel.value === 'fa' ? 'Moved to free agents.' : 'Player moved.', 'ok');
          paint();
        } catch (e) { setMsg(e.message || String(e), 'err'); }
      });
    });

    $$('.lg-remove', host).forEach((btn) => {
      btn.addEventListener('click', async () => {
        const name = DB.player(btn.dataset.player)?.name || 'this player';
        if (!window.confirm(`Remove ${name} from this roster? They stay in the player directory as a free agent.`)) return;
        try {
          await LeagueHub.removePlayer(btn.dataset.player);
          setMsg('Removed from the roster.', 'ok');
          paint();
        } catch (e) { setMsg(e.message || String(e), 'err'); }
      });
    });

    $$('.lg-add-existing', host).forEach((btn) => {
      btn.addEventListener('click', async () => {
        const card = btn.closest('.lg-team');
        const id = card.querySelector('.lg-existing')?.value;
        if (!id) { setMsg('Pick a player to add.', 'err'); return; }
        try {
          await LeagueHub.addPlayer({ playerId: id, teamId: card.dataset.team });
          setMsg('Player added.', 'ok');
          paint();
        } catch (e) { setMsg(e.message || String(e), 'err'); }
      });
    });

    $$('.lg-captain', host).forEach((radio) => {
      radio.addEventListener('change', async () => {
        if (!radio.checked) return;
        try {
          const p = await LeagueHub.setCaptain(radio.dataset.team, radio.dataset.player);
          setMsg(`${p.name} is now the captain. Their login is that name; the password is the team name as one word.`, 'ok');
          paint();
        } catch (e) { setMsg(e.message || String(e), 'err'); }
      });
    });

    $$('.lg-add-new', host).forEach((btn) => {
      btn.addEventListener('click', async () => {
        const card = btn.closest('.lg-team');
        const name = card.querySelector('.lg-new-name')?.value;
        try {
          await LeagueHub.addPlayer({ name, teamId: card.dataset.team });
          setMsg('New player added.', 'ok');
          paint();
        } catch (e) { setMsg(e.message || String(e), 'err'); }
      });
    });
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

    const canEdit = AdminAuth.isAdmin() || AdminAuth.isCaptain();
    root.innerHTML = `
      ${seasonHead(`Welcome, ${escapeHtml(s.label || s.username)}`)}
      ${toolLinks()}
      ${canEdit ? editorHtml() : ''}
      <button type="button" class="btn btn-ghost" id="ad-logout">Log out</button>`;
    $('#ad-logout')?.addEventListener('click', () => {
      AdminAuth.logout();
      paint();
    });
    if (canEdit) bindEditor();
  }

  applyTheme();
  Promise.all([
    window.LeagueHub?.init?.() || Promise.resolve(),
    window.DraftHub?.init?.() || Promise.resolve(),
  ]).then(() => {
    paint();
    window.LeagueHub?.onChange?.(() => {
      if (!AdminAuth.isAdmin() && !AdminAuth.isCaptain()) return;
      if (document.activeElement?.closest?.('#lg-editor')) return;
      paint();
    });
  }).catch(() => paint());
})();
