/* /admin — staff console: overview, appeals, save history, tools */
(() => {
  const $ = (sel, root = document) => (root || document).querySelector(sel);
  const $$ = (sel, root = document) => [...(root || document).querySelectorAll(sel)];
  const root = $('#admin-app');
  if (!root) return;

  const FIELD_LABEL = {
    goals: 'Goals', assists: 'Assists', steals: 'Steals', blocks: 'Blocks',
    turnovers: 'Turnovers', swimOffAttempts: 'SOA', swimOffs: 'SO wins', shots: 'Shots',
  };

  let activeSection = 'overview';
  let hubsReady = false;
  let listenersBound = false;
  let shellReady = false;
  let refreshTimer = null;
  let lastStatsSig = null;
  let bootStarted = false;

  function applyTheme() {
    let theme = 'dark';
    try { theme = localStorage.getItem('atxutl.theme') || 'dark'; } catch (e) {}
    document.documentElement.dataset.theme = theme;
  }

  function fmtWhen(ts) {
    if (!ts) return '—';
    try {
      return new Date(ts).toLocaleString();
    } catch (e) {
      return '—';
    }
  }

  function matchTitle(m) {
    if (!m) return 'Unknown match';
    const label = m.label ? `${m.label} · ` : '';
    return `${label}W${m.round} · ${DB.teamName(m.home)} vs ${DB.teamName(m.away)}`;
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setBrandSub(text) {
    const el = $('.brand-sub');
    if (el) el.textContent = text;
  }

  function counts() {
    const appeals = typeof ContentionHub !== 'undefined' ? ContentionHub.list() : [];
    const open = appeals.filter((e) => e.status === 'open');
    const passed = appeals.filter((e) => e.status === 'passed');
    const matches = (window.DB?.matches || []).filter((m) => typeof StatsHub !== 'undefined' && StatsHub.getResult(m.id));
    let pendingHl = 0;
    try {
      if (typeof HighlightsHub !== 'undefined' && typeof HighlightsHub.list === 'function') {
        pendingHl = HighlightsHub.list().filter((e) => e && e.status === 'pending').length;
      }
    } catch (e) { pendingHl = 0; }
    let volClaims = 0;
    if (typeof VolunteerHub !== 'undefined') {
      (window.DB?.matches || []).forEach((m) => {
        VolunteerHub.roles.forEach((r) => {
          volClaims += VolunteerHub.listFor(m.id, r.id).length;
        });
      });
    }
    return {
      openAppeals: open.length,
      readyAppeals: passed.length,
      savedMatches: matches.length,
      pendingHighlights: pendingHl,
      volunteerClaims: volClaims,
      quorum: (typeof ContentionHub !== 'undefined' && ContentionHub.VOTE_QUORUM) || 5,
    };
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

  function ensureHistoryModal() {
    let host = $('#ad-history-modal');
    if (host) return host;
    host = document.createElement('div');
    host.id = 'ad-history-modal';
    host.className = 'modal-overlay';
    host.hidden = true;
    host.innerHTML = `<div class="modal-card ad-history-card" role="dialog" aria-modal="true" aria-labelledby="ad-history-title"></div>`;
    document.body.appendChild(host);
    host.addEventListener('click', (e) => {
      if (e.target.id === 'ad-history-modal') closeHistoryModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeHistoryModal();
    });
    return host;
  }

  function closeHistoryModal() {
    const host = $('#ad-history-modal');
    if (!host) return;
    host.hidden = true;
    document.body.style.overflow = '';
  }

  function openHistoryModal(matchId) {
    const match = (window.DB?.matches || []).find((m) => m.id === matchId);
    const history = StatsHub.historyFor(matchId).slice().reverse();
    const host = ensureHistoryModal();
    const card = host.querySelector('.ad-history-card');
    card.innerHTML = `
      <div class="modal-head">
        <h2 id="ad-history-title">Save history</h2>
        <button type="button" class="icon-btn" id="ad-history-close" aria-label="Close">✕</button>
      </div>
      <p class="muted small">${escapeHtml(matchTitle(match))}</p>
      ${history.length ? `
        <ol class="ad-history-list">
          ${history.map((h) => `
            <li>
              <div class="ad-history-main">
                <strong>${escapeHtml(h.label)}</strong>
                <span class="pill">${escapeHtml(StatsHub.actionLabel(h.action))}</span>
              </div>
              <div class="muted small">${fmtWhen(h.at)}${h.role ? ` · ${escapeHtml(h.role)}` : ''}</div>
            </li>`).join('')}
        </ol>` : '<p class="muted">No save history recorded for this match yet.</p>'}
    `;
    host.hidden = false;
    document.body.style.overflow = 'hidden';
    $('#ad-history-close')?.addEventListener('click', closeHistoryModal);
  }

  function paintOverview() {
    const host = $('#ad-section-overview');
    if (!host) return;
    const c = counts();
    const session = AdminAuth.session();
    const attention = [];
    if (c.readyAppeals) attention.push(`${c.readyAppeals} appeal${c.readyAppeals === 1 ? '' : 's'} ready to apply`);
    if (c.openAppeals) attention.push(`${c.openAppeals} open appeal${c.openAppeals === 1 ? '' : 's'} need votes`);
    if (c.pendingHighlights) attention.push(`${c.pendingHighlights} highlight nomination${c.pendingHighlights === 1 ? '' : 's'} pending`);

    const recentAppeals = typeof ContentionHub !== 'undefined'
      ? ContentionHub.list().slice(0, 4)
      : [];
    const recentSaves = (window.DB?.matches || [])
      .filter((m) => StatsHub.getResult(m.id))
      .map((m) => {
        const hist = StatsHub.historyFor(m.id);
        const last = hist[hist.length - 1];
        return { m, last, n: hist.length };
      })
      .sort((a, b) => (b.last?.at || 0) - (a.last?.at || 0))
      .slice(0, 4);

    host.innerHTML = `
      <div class="ad-welcome">
        <div>
          <h2>${escapeHtml(session?.role === 'admin' ? 'League admin' : 'Captain')} workspace</h2>
        </div>
        <button type="button" class="btn btn-ghost" id="ad-logout-top">Log out</button>
      </div>

      <div class="ad-metric-grid">
        <button type="button" class="ad-metric" data-goto-section="appeals">
          <span class="ad-metric-label">Open appeals</span>
          <span class="ad-metric-value">${c.openAppeals}</span>
          <span class="muted small">Need captain / admin votes</span>
        </button>
        <button type="button" class="ad-metric ${c.readyAppeals ? 'ad-metric-alert' : ''}" data-goto-section="appeals">
          <span class="ad-metric-label">Ready to apply</span>
          <span class="ad-metric-value">${c.readyAppeals}</span>
          <span class="muted small">Majority passed · apply to box</span>
        </button>
        <button type="button" class="ad-metric" data-goto-section="history">
          <span class="ad-metric-label">Matches with saves</span>
          <span class="ad-metric-value">${c.savedMatches}</span>
          <span class="muted small">Series / box score history</span>
        </button>
        <button type="button" class="ad-metric" data-goto-section="tools">
          <span class="ad-metric-label">Volunteer claims</span>
          <span class="ad-metric-value">${c.volunteerClaims}</span>
          <span class="muted small">Across all weeks</span>
        </button>
      </div>

      ${attention.length ? `
        <div class="ad-attention">
          <h3>Needs attention</h3>
          <ul>${attention.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
        </div>` : `
        <div class="ad-attention ad-attention-ok">
          <h3>All clear</h3>
          <p class="muted">No open appeals or pending highlight reviews right now.</p>
        </div>`}

      <div class="ad-split">
        <div class="ad-panel">
          <div class="panel-head">
            <h3>Recent appeals</h3>
            <button type="button" class="btn btn-ghost ad-goto" data-goto-section="appeals">View all</button>
          </div>
          ${recentAppeals.length ? `
            <ul class="ad-feed">
              ${recentAppeals.map((e) => `
                <li>
                  <div>
                    <strong>${escapeHtml(e.playerName)}</strong>
                    <span class="muted small"> · ${escapeHtml(FIELD_LABEL[e.field] || e.field)} → ${escapeHtml(e.proposedValue)}</span>
                  </div>
                  <span class="badge ${e.status === 'passed' ? 'done' : (e.status === 'open' ? 'up' : '')}">${escapeHtml(e.status)}</span>
                </li>`).join('')}
            </ul>` : '<p class="muted">No appeals yet.</p>'}
        </div>
        <div class="ad-panel">
          <div class="panel-head">
            <h3>Latest saves</h3>
            <button type="button" class="btn btn-ghost ad-goto" data-goto-section="history">View all</button>
          </div>
          ${recentSaves.length ? `
            <ul class="ad-feed">
              ${recentSaves.map(({ m, last, n }) => `
                <li>
                  <div>
                    <strong>${escapeHtml(matchTitle(m))}</strong>
                    <div class="muted small">${n} save${n === 1 ? '' : 's'}${last ? ` · ${escapeHtml(last.label)}` : ''}</div>
                  </div>
                  <button type="button" class="btn btn-ghost ad-open-history" data-match="${m.id}">History</button>
                </li>`).join('')}
            </ul>` : '<p class="muted">No saved match stats yet.</p>'}
        </div>
      </div>
    `;

    $('#ad-logout-top')?.addEventListener('click', () => {
      AdminAuth.logout();
      paint();
    });
    $$('[data-goto-section]', host).forEach((btn) => {
      btn.addEventListener('click', () => setSection(btn.dataset.gotoSection));
    });
    $$('.ad-open-history', host).forEach((btn) => {
      btn.addEventListener('click', () => openHistoryModal(btn.dataset.match));
    });
  }

  function paintSaveHistory() {
    const host = $('#ad-section-history');
    if (!host || typeof StatsHub === 'undefined') return;
    const matches = (window.DB?.matches || [])
      .filter((m) => StatsHub.getResult(m.id))
      .slice()
      .sort((a, b) => Number(b.round) - Number(a.round) || String(a.id).localeCompare(String(b.id)));

    host.innerHTML = `
      <div class="ad-section-head">
        <div>
          <h2>Match save history</h2>
          <p class="muted">Who worked on series scores and player box scores.</p>
        </div>
      </div>
      ${matches.length ? `
        <div class="ad-history-table-wrap">
          <table class="ad-history-table">
            <thead>
              <tr>
                <th class="lft">Match</th>
                <th>Saves</th>
                <th class="lft">Last by</th>
                <th class="lft">When</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${matches.map((m) => {
                const hist = StatsHub.historyFor(m.id);
                const last = hist[hist.length - 1];
                const res = StatsHub.getResult(m.id);
                return `<tr>
                  <td class="lft">
                    <div class="strong">${escapeHtml(matchTitle(m))}</div>
                    <div class="muted small">${res?.homeScore != null ? `${res.homeScore}–${res.awayScore}` : 'Saved'}</div>
                  </td>
                  <td>${hist.length}</td>
                  <td class="lft">${last ? escapeHtml(last.label) : '—'}</td>
                  <td class="lft muted small">${last ? fmtWhen(last.at) : '—'}</td>
                  <td><button type="button" class="btn btn-ghost ad-open-history" data-match="${m.id}">View</button></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>` : '<p class="muted">No saved match stats yet. Use Match stats entry to submit series and box scores.</p>'}
    `;

    $$('.ad-open-history', host).forEach((btn) => {
      btn.addEventListener('click', () => openHistoryModal(btn.dataset.match));
    });
  }

  function paintContentions() {
    const host = $('#ad-section-appeals');
    if (!host || typeof ContentionHub === 'undefined') return;
    const open = ContentionHub.list().filter((e) => e.status === 'open' || e.status === 'passed');
    const closed = ContentionHub.list().filter((e) => e.status === 'failed' || e.status === 'applied').slice(0, 10);
    const quorum = ContentionHub.VOTE_QUORUM || 5;

    const card = (e) => {
      const t = ContentionHub.tally(e.votes);
      const mine = ContentionHub.myVote(e.id);
      const match = (window.DB?.matches || []).find((m) => m.id === e.matchId);
      const pct = Math.min(100, Math.round((t.total / quorum) * 100));
      return `<article class="ad-appeal-card" data-id="${e.id}">
        <div class="ad-appeal-top">
          <div>
            <h3>${escapeHtml(e.playerName)} · ${FIELD_LABEL[e.field] || e.field}</h3>
            <p class="muted small">${e.action === 'request' ? 'Request credit' : 'Contest'}
              ${e.currentValue != null ? ` · was ${e.currentValue}` : ''} → <b>${e.proposedValue}</b>
              ${match ? ` · W${match.round} ${escapeHtml(DB.teamName(match.home))} vs ${escapeHtml(DB.teamName(match.away))}` : (e.round != null ? ` · W${e.round}` : '')}
            </p>
          </div>
          <span class="badge ${e.status === 'passed' ? 'done' : (e.status === 'open' ? 'up' : '')}">${e.status}</span>
        </div>
        ${e.comment ? `<p class="ad-appeal-comment">${escapeHtml(e.comment)}</p>` : ''}
        ${e.videoUrl ? `<p><a class="text-link" href="${escapeHtml(e.videoUrl)}" target="_blank" rel="noopener">Watch clip →</a></p>` : ''}
        <div class="ad-vote-meter" aria-hidden="true"><span style="width:${pct}%"></span></div>
        <p class="muted small">Votes ${t.forCount} for · ${t.againstCount} against · ${t.total}/${quorum}
          ${e.createdBy?.label ? ` · filed by ${escapeHtml(e.createdBy.label)}` : ''}</p>
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
      <div class="ad-section-head">
        <div>
          <h2>Stat appeals</h2>
          <p class="muted">Majority after ${quorum} votes. Passed appeals can be applied to the box score.</p>
        </div>
      </div>
      <p id="ad-sc-msg" class="draft-msg"></p>
      <h3 class="ad-subhead">Open / ready</h3>
      <div class="ad-appeal-grid">
        ${open.length ? open.map(card).join('') : '<p class="muted">No open appeals.</p>'}
      </div>
      <h3 class="ad-subhead">Recently closed</h3>
      <div class="ad-appeal-grid">
        ${closed.length ? closed.map(card).join('') : '<p class="muted">None yet.</p>'}
      </div>
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
          refreshSections();
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
          refreshSections();
        } catch (e) {
          setMsg(e.message || String(e), 'err');
        }
      });
    });
  }

  function paintTools() {
    const host = $('#ad-section-tools');
    if (!host) return;
    const c = counts();
    host.innerHTML = `
      <div class="ad-section-head">
        <div>
          <h2>Tools</h2>
          <p class="muted">Jump to entry pages and public league views.</p>
        </div>
      </div>
      <div class="ad-tool-grid">
        <a class="ad-tool-card" href="../stats/">
          <h3>Match stats entry</h3>
          <p class="muted">Claim a match, enter series scores, and file box scores.</p>
          <span class="text-link">Open stats →</span>
        </a>
        <a class="ad-tool-card" href="../season-5-highlights/">
          <h3>Highlight nominations</h3>
          <p class="muted">${c.pendingHighlights} pending review${c.pendingHighlights === 1 ? '' : 's'}.</p>
          <span class="text-link">Open highlights →</span>
        </a>
        <a class="ad-tool-card" href="../#volunteer">
          <h3>Volunteer board</h3>
          <p class="muted">${c.volunteerClaims} claim${c.volunteerClaims === 1 ? '' : 's'} across the season.</p>
          <span class="text-link">Open volunteer tab →</span>
        </a>
        <a class="ad-tool-card" href="../">
          <h3>League dashboard</h3>
          <p class="muted">Standings, schedule, roster, and public stats.</p>
          <span class="text-link">Open dashboard →</span>
        </a>
      </div>
    `;
  }

  function refreshSections() {
    if (!hubsReady || !shellReady) return;
    const painters = [
      ['overview', paintOverview],
      ['appeals', paintContentions],
      ['history', paintSaveHistory],
      ['tools', paintTools],
    ];
    painters.forEach(([id, fn]) => {
      try {
        fn();
      } catch (e) {
        console.error(`Admin ${id} paint failed`, e);
        const host = $(`#ad-section-${id === 'history' ? 'history' : id === 'appeals' ? 'appeals' : id === 'tools' ? 'tools' : 'overview'}`);
        if (host) {
          host.innerHTML = `<p class="draft-msg err">${escapeHtml(e.message || String(e))}</p>`;
        }
      }
    });
    syncNav();
  }

  function scheduleRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      refreshSections();
    }, 50);
  }

  function onStatsHubChange(state) {
    const sig = JSON.stringify(state?.results ?? {});
    if (sig === lastStatsSig) return;
    lastStatsSig = sig;
    scheduleRefresh();
  }

  function syncNav() {
    $$('.ad-nav-btn', root).forEach((b) => {
      b.classList.toggle('active', b.dataset.section === activeSection);
    });
    $$('.ad-section', root).forEach((sec) => {
      const on = sec.dataset.section === activeSection;
      sec.hidden = !on;
      sec.classList.toggle('ad-visible', on);
    });
  }

  function setSection(id) {
    activeSection = id || 'overview';
    syncNav();
    try { localStorage.setItem('atxutl.adminSection', activeSection); } catch (e) { /* ignore */ }
  }

  function paintShell(session) {
    setBrandSub(`${session.label || session.username} · staff`);
    root.innerHTML = `
      <nav class="ad-nav" aria-label="Admin sections">
        <button type="button" class="ad-nav-btn" data-section="overview">Overview</button>
        <button type="button" class="ad-nav-btn" data-section="appeals">Appeals</button>
        <button type="button" class="ad-nav-btn" data-section="history">Save history</button>
        <button type="button" class="ad-nav-btn" data-section="tools">Tools</button>
      </nav>
      <div id="ad-boot-msg" class="draft-msg"></div>
      <section class="ad-section ad-visible" data-section="overview" id="ad-section-overview"></section>
      <section class="ad-section" data-section="appeals" id="ad-section-appeals" hidden></section>
      <section class="ad-section" data-section="history" id="ad-section-history" hidden></section>
      <section class="ad-section" data-section="tools" id="ad-section-tools" hidden></section>
    `;
    $$('.ad-nav-btn', root).forEach((btn) => {
      btn.addEventListener('click', () => setSection(btn.dataset.section));
    });
    try {
      const saved = localStorage.getItem('atxutl.adminSection');
      if (saved && ['overview', 'appeals', 'history', 'tools'].includes(saved)) activeSection = saved;
    } catch (e) { /* ignore */ }
    shellReady = true;
    syncNav();
  }

  function paintLogin() {
    setBrandSub('Captain / admin login');
    root.innerHTML = `
      <div class="ad-login-wrap">
        <section class="panel ad-login-card">
          <p class="muted small ad-kicker">Staff access</p>
          <h2>Admin console</h2>
          <p class="muted">Captains and league admin manage stats, appeals, and season tools here.</p>
          <label class="se-pin"><span>Username</span>
            <input id="ad-user" class="input" autocomplete="username" placeholder="Captain name or utladmin" />
          </label>
          <label class="se-pin"><span>Password</span>
            <input id="ad-pass" class="input" type="password" autocomplete="current-password" placeholder="Team name (one word) or utlmaster" />
          </label>
          <button type="button" class="btn" id="ad-login">Log in</button>
          <p id="ad-msg" class="draft-msg"></p>
          <p class="muted small"><a href="../">← Back to dashboard</a></p>
        </section>
      </div>`;
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
  }

  function paint() {
    const s = AdminAuth.session();
    if (!s) {
      hubsReady = false;
      listenersBound = false;
      shellReady = false;
      lastStatsSig = null;
      paintLogin();
      return;
    }

    if (!shellReady || !$('.ad-nav', root)) {
      paintShell(s);
    }
    hubsReady = true;
    refreshSections();

    const bootMsg = $('#ad-boot-msg');
    if (bootMsg && !listenersBound) {
      bootMsg.className = 'draft-msg';
      bootMsg.textContent = 'Connecting to live data…';
    }

    const withTimeout = (promise, ms, label) => Promise.race([
      Promise.resolve().then(() => promise),
      new Promise((resolve) => {
        setTimeout(() => resolve({ timedOut: true, label }), ms);
      }),
    ]).catch((e) => ({ error: e, label }));

    Promise.all([
      typeof ContentionHub !== 'undefined' ? withTimeout(ContentionHub.init(), 10000, 'appeals') : Promise.resolve(),
      typeof StatsHub !== 'undefined' ? withTimeout(StatsHub.init(), 10000, 'stats') : Promise.resolve(),
      typeof VolunteerHub !== 'undefined' ? withTimeout(VolunteerHub.init(), 10000, 'volunteers') : Promise.resolve(),
      typeof HighlightsHub !== 'undefined' ? withTimeout(HighlightsHub.init(), 10000, 'highlights') : Promise.resolve(),
    ]).then((results) => {
      const timed = results.filter((r) => r && r.timedOut).map((r) => r.label);
      const errored = results.filter((r) => r && r.error);
      const msg = $('#ad-boot-msg');
      if (msg) {
        if (errored.length) {
          msg.className = 'draft-msg err';
          msg.textContent = errored.map((r) => r.error?.message || r.label).join(' · ');
        } else if (timed.length) {
          msg.className = 'draft-msg';
          msg.textContent = `Still syncing ${timed.join(', ')}… UI is ready.`;
          setTimeout(() => { if (msg.textContent.includes('Still syncing')) msg.textContent = ''; }, 4000);
        } else {
          msg.textContent = '';
        }
      }
      refreshSections();
      if (!listenersBound) {
        listenersBound = true;
        if (typeof StatsHub !== 'undefined') StatsHub.onChange(onStatsHubChange);
        if (typeof ContentionHub !== 'undefined') ContentionHub.onChange(() => scheduleRefresh());
        if (typeof VolunteerHub !== 'undefined') VolunteerHub.onChange(() => scheduleRefresh());
        if (typeof HighlightsHub !== 'undefined') HighlightsHub.onChange(() => scheduleRefresh());
      }
    });
  }

  applyTheme();
  paint();
})();
