/* /admin — login + tool links + stat contention voting */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...(root || document).querySelectorAll(sel)];
  const root = $('#admin-app');
  if (!root) return;

  const FIELD_LABEL = {
    goals: 'Goals', assists: 'Assists', steals: 'Steals', blocks: 'Blocks',
    turnovers: 'Turnovers', swimOffAttempts: 'SOA', swimOffs: 'SO wins', shots: 'Shots',
  };

  function applyTheme() {
    let theme = 'dark';
    try { theme = localStorage.getItem('atxutl.theme') || 'dark'; } catch (e) {}
    document.documentElement.dataset.theme = theme;
  }

  async function applyPassedContention(entry) {
    if (!entry?.matchId || typeof StatsHub === 'undefined') {
      await ContentionHub.markApplied(entry.id);
      return;
    }
    const prev = StatsHub.getResult(entry.matchId) || {};
    const box = Array.isArray(prev.box) ? prev.box.map((b) => ({ ...b })) : [];
    let line = box.find((b) => b.playerId === entry.playerId);
    if (!line) {
      line = StatsHub.emptyLine(entry.playerId);
      box.push(line);
    }
    line[entry.field] = Math.max(0, Math.round(Number(entry.proposedValue) || 0));
    if (entry.field === 'swimOffs' && line.swimOffs > (line.swimOffAttempts || 0)) {
      line.swimOffAttempts = line.swimOffs;
    }
    const homeLineup = [...(prev.homeLineup || [])];
    const awayLineup = [...(prev.awayLineup || [])];
    if (!homeLineup.includes(entry.playerId) && !awayLineup.includes(entry.playerId)) {
      homeLineup.push(entry.playerId);
    }
    await StatsHub.saveBox(entry.matchId, {
      homeLineup,
      awayLineup,
      box,
      events: prev.events || [],
      allowWithoutSeries: true,
    });
    await ContentionHub.markApplied(entry.id);
  }

  function paintContentions() {
    const host = $('#ad-contentions');
    if (!host || typeof ContentionHub === 'undefined') return;
    const open = ContentionHub.list().filter((e) => e.status === 'open' || e.status === 'passed');
    const closed = ContentionHub.list().filter((e) => e.status === 'failed' || e.status === 'applied').slice(0, 8);
    const quorum = ContentionHub.VOTE_QUORUM || 5;

    const card = (e) => {
      const t = ContentionHub.tally(e.votes);
      const mine = ContentionHub.myVote(e.id);
      const match = (window.DB?.matches || []).find((m) => m.id === e.matchId);
      return `<article class="panel hl-card contention-vote-card" data-id="${e.id}">
        <div class="panel-head">
          <h3>${e.playerName} · ${FIELD_LABEL[e.field] || e.field}</h3>
          <span class="badge ${e.status === 'passed' ? 'done' : 'up'}">${e.status}</span>
        </div>
        <p class="muted small">${e.action === 'request' ? 'Request credit' : 'Contest'}
          ${e.currentValue != null ? ` · was ${e.currentValue}` : ''} → <b>${e.proposedValue}</b>
          ${match ? ` · W${match.round} ${DB.teamName(match.home)} vs ${DB.teamName(match.away)}` : (e.round != null ? ` · W${e.round}` : '')}
        </p>
        <p class="hl-comment">${e.comment || ''}</p>
        ${e.videoUrl ? `<p><a href="${e.videoUrl}" target="_blank" rel="noopener">Watch clip →</a></p>` : ''}
        <p class="muted small">Votes: ${t.forCount} for · ${t.againstCount} against · ${t.total}/${quorum} cast
          ${e.createdBy?.label ? ` · by ${e.createdBy.label}` : ''}</p>
        <div class="se-actions">
          ${e.status === 'open' ? `
            <button type="button" class="btn ${mine === 'for' ? '' : 'btn-ghost'} sc-vote" data-id="${e.id}" data-choice="for">Vote for</button>
            <button type="button" class="btn ${mine === 'against' ? '' : 'btn-ghost'} sc-vote" data-id="${e.id}" data-choice="against">Vote against</button>
          ` : ''}
          ${e.status === 'passed' ? `
            <button type="button" class="btn sc-apply" data-id="${e.id}">Apply to box score</button>
          ` : ''}
        </div>
      </article>`;
    };

    host.innerHTML = `
      <h3>Open / ready contentions</h3>
      ${open.length ? open.map(card).join('') : '<p class="muted">No open contentions.</p>'}
      <h3 style="margin-top:18px">Recently closed</h3>
      ${closed.length ? closed.map(card).join('') : '<p class="muted">None yet.</p>'}
      <p id="ad-sc-msg" class="draft-msg"></p>
    `;

    const setMsg = (text, cls = '') => {
      const el = $('#ad-sc-msg');
      if (!el) return;
      el.className = `draft-msg ${cls}`.trim();
      el.textContent = text || '';
    };

    $$('.sc-vote', host).forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await ContentionHub.vote(btn.dataset.id, btn.dataset.choice);
          setMsg('Vote recorded', 'ok');
          paintContentions();
        } catch (e) {
          setMsg(e.message || String(e), 'err');
        }
      });
    });
    $$('.sc-apply', host).forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          const entry = ContentionHub.get(btn.dataset.id);
          await applyPassedContention(entry);
          setMsg('Applied to match box score', 'ok');
          paintContentions();
        } catch (e) {
          setMsg(e.message || String(e), 'err');
        }
      });
    });
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
          <li><a class="btn btn-ghost" href="../">League dashboard</a></li>
        </ul>
        <button type="button" class="btn btn-ghost" id="ad-logout">Log out</button>
      </section>
      <section class="panel">
        <div class="panel-head">
          <h3>Stat contentions</h3>
          <span class="muted small">Majority after ${typeof ContentionHub !== 'undefined' ? ContentionHub.VOTE_QUORUM : 5} votes</span>
        </div>
        <div id="ad-contentions"><p class="muted">Loading…</p></div>
      </section>`;
    $('#ad-logout')?.addEventListener('click', () => {
      AdminAuth.logout();
      paint();
    });

    const boot = typeof ContentionHub !== 'undefined'
      ? Promise.all([
        ContentionHub.init(),
        typeof StatsHub !== 'undefined' ? StatsHub.init() : Promise.resolve(),
      ])
      : Promise.resolve();
    boot.then(() => {
      paintContentions();
      ContentionHub.onChange(() => paintContentions());
    }).catch((e) => {
      const host = $('#ad-contentions');
      if (host) host.innerHTML = `<p class="draft-msg err">${e.message || e}</p>`;
    });
  }

  applyTheme();
  paint();
})();
