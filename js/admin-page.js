/* /admin — staff console: overview, appeals, save history, tools
   Critical path is local (data.js + admin-auth). Firebase/hubs fill live islands. */
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
  let shellReady = false;
  let shellBound = false;
  let bootStarted = false;
  let bootScheduled = false;
  let listenersBound = false;
  let refreshTimer = null;
  let lastStatsSig = null;
  let pollTimer = null;

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

  function hub(name) {
    try {
      const h = window[name];
      return h && typeof h === 'object' ? h : null;
    } catch (e) {
      return null;
    }
  }

  function liveHubsPresent() {
    return !!(hub('StatsHub') || hub('ContentionHub') || hub('VolunteerHub') || hub('HighlightsHub'));
  }

  function setText(sel, value) {
    const el = $(sel, root);
    if (!el) return;
    const next = String(value);
    if (el.textContent !== next) el.textContent = next;
  }

  function setIsland(sel, html) {
    const el = typeof sel === 'string' ? $(sel, root) : sel;
    if (!el) return;
    if (el.getAttribute('data-html') === html) return;
    el.setAttribute('data-html', html);
    el.innerHTML = html;
  }

  function counts() {
    const appeals = hub('ContentionHub') ? ContentionHub.list() : [];
    const open = appeals.filter((e) => e.status === 'open');
    const passed = appeals.filter((e) => e.status === 'passed');
    const stats = hub('StatsHub');
    const matches = (window.DB?.matches || []).filter((m) => stats && stats.getResult(m.id));
    let pendingHl = 0;
    try {
      const hl = hub('HighlightsHub');
      if (hl && typeof hl.list === 'function') {
        pendingHl = hl.list().filter((e) => e && e.status === 'pending').length;
      }
    } catch (e) { pendingHl = 0; }
    let volClaims = 0;
    const vol = hub('VolunteerHub');
    if (vol) {
      (window.DB?.matches || []).forEach((m) => {
        vol.roles.forEach((r) => {
          volClaims += vol.listFor(m.id, r.id).length;
        });
      });
    }
    return {
      openAppeals: open.length,
      readyAppeals: passed.length,
      savedMatches: matches.length,
      pendingHighlights: pendingHl,
      volunteerClaims: volClaims,
      quorum: (hub('ContentionHub') && ContentionHub.VOTE_QUORUM) || 5,
    };
  }

  async function applyPassedContention(entry) {
    const stats = hub('StatsHub');
    if (!entry?.matchId || !stats) {
      await ContentionHub.markApplied(entry.id);
      return;
    }
    const prev = stats.getResult(entry.matchId) || {};
    const box = Array.isArray(prev.box) ? prev.box.map((b) => ({ ...b })) : [];
    let line = box.find((b) => b.playerId === entry.playerId);
    if (!line) {
      line = stats.emptyLine(entry.playerId);
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
    await stats.saveBox(entry.matchId, {
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
    const stats = hub('StatsHub');
    const match = (window.DB?.matches || []).find((m) => m.id === matchId);
    const history = stats ? stats.historyFor(matchId).slice().reverse() : [];
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
                <span class="pill">${escapeHtml(stats.actionLabel(h.action))}</span>
              </div>
              <div class="muted small">${fmtWhen(h.at)}${h.role ? ` · ${escapeHtml(h.role)}` : ''}</div>
            </li>`).join('')}
        </ol>` : '<p class="muted">No save history recorded for this match yet.</p>'}
    `;
    host.hidden = false;
    document.body.style.overflow = 'hidden';
    $('#ad-history-close')?.addEventListener('click', closeHistoryModal);
  }

  function fillOverview() {
    const c = counts();
    setText('#ad-metric-open', c.openAppeals);
    setText('#ad-metric-ready', c.readyAppeals);
    setText('#ad-metric-saves', c.savedMatches);
    setText('#ad-metric-vol', c.volunteerClaims);
    const readyBtn = $('[data-goto-section="appeals"].ad-metric-ready', root);
    if (readyBtn) readyBtn.classList.toggle('ad-metric-alert', !!c.readyAppeals);

    const attention = [];
    if (c.readyAppeals) attention.push(`${c.readyAppeals} appeal${c.readyAppeals === 1 ? '' : 's'} ready to apply`);
    if (c.openAppeals) attention.push(`${c.openAppeals} open appeal${c.openAppeals === 1 ? '' : 's'} need votes`);
    if (c.pendingHighlights) attention.push(`${c.pendingHighlights} highlight nomination${c.pendingHighlights === 1 ? '' : 's'} pending`);
    const att = $('#ad-attention', root);
    if (att) {
      att.classList.toggle('ad-attention-ok', !attention.length);
      setIsland(att, attention.length
        ? `<h3>Needs attention</h3><ul>${attention.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`
        : `<h3>All clear</h3><p class="muted">No open appeals or pending highlight reviews right now.</p>`);
    }

    const recentAppeals = hub('ContentionHub') ? ContentionHub.list().slice(0, 4) : [];
    setIsland('#ad-recent-appeals', recentAppeals.length ? `
      <ul class="ad-feed">
        ${recentAppeals.map((e) => `
          <li>
            <div>
              <strong>${escapeHtml(e.playerName)}</strong>
              <span class="muted small"> · ${escapeHtml(FIELD_LABEL[e.field] || e.field)} → ${escapeHtml(e.proposedValue)}</span>
            </div>
            <span class="badge ${e.status === 'passed' ? 'done' : (e.status === 'open' ? 'up' : '')}">${escapeHtml(e.status)}</span>
          </li>`).join('')}
      </ul>` : '<p class="muted">No appeals yet.</p>');

    const stats = hub('StatsHub');
    const recentSaves = stats
      ? (window.DB?.matches || [])
        .filter((m) => stats.getResult(m.id))
        .map((m) => {
          const hist = stats.historyFor(m.id);
          const last = hist[hist.length - 1];
          return { m, last, n: hist.length };
        })
        .sort((a, b) => (b.last?.at || 0) - (a.last?.at || 0))
        .slice(0, 4)
      : [];
    setIsland('#ad-recent-saves', recentSaves.length ? `
      <ul class="ad-feed">
        ${recentSaves.map(({ m, last, n }) => `
          <li>
            <div>
              <strong>${escapeHtml(matchTitle(m))}</strong>
              <div class="muted small">${n} save${n === 1 ? '' : 's'}${last ? ` · ${escapeHtml(last.label)}` : ''}</div>
            </div>
            <button type="button" class="btn btn-ghost ad-open-history" data-match="${m.id}">History</button>
          </li>`).join('')}
      </ul>` : '<p class="muted">No saved match stats yet.</p>');
  }

  function fillSaveHistory() {
    const stats = hub('StatsHub');
    if (!stats) {
      setIsland('#ad-history-body', '<p class="muted">No saved match stats yet. Use Match stats entry to submit series and box scores.</p>');
      return;
    }
    const matches = (window.DB?.matches || [])
      .filter((m) => stats.getResult(m.id))
      .slice()
      .sort((a, b) => Number(b.round) - Number(a.round) || String(a.id).localeCompare(String(b.id)));

    setIsland('#ad-history-body', matches.length ? `
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
              const hist = stats.historyFor(m.id);
              const last = hist[hist.length - 1];
              const res = stats.getResult(m.id);
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
      </div>` : '<p class="muted">No saved match stats yet. Use Match stats entry to submit series and box scores.</p>');
  }

  function appealCard(e) {
    const ch = hub('ContentionHub');
    if (!ch) return '';
    const t = ch.tally(e.votes);
    const mine = ch.myVote(e.id);
    const match = (window.DB?.matches || []).find((m) => m.id === e.matchId);
    const quorum = ch.VOTE_QUORUM || 5;
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
  }

  function fillAppeals() {
    const ch = hub('ContentionHub');
    const quorum = (ch && ch.VOTE_QUORUM) || 5;
    setText('#ad-appeals-copy', `Majority after ${quorum} votes. Passed appeals can be applied to the box score.`);
    if (!ch) {
      setIsland('#ad-appeals-open', '<p class="muted">No open appeals.</p>');
      setIsland('#ad-appeals-closed', '<p class="muted">None yet.</p>');
      return;
    }
    const open = ch.list().filter((e) => e.status === 'open' || e.status === 'passed');
    const closed = ch.list().filter((e) => e.status === 'failed' || e.status === 'applied').slice(0, 10);
    setIsland('#ad-appeals-open', open.length ? open.map(appealCard).join('') : '<p class="muted">No open appeals.</p>');
    setIsland('#ad-appeals-closed', closed.length ? closed.map(appealCard).join('') : '<p class="muted">None yet.</p>');
  }

  function fillTools() {
    const c = counts();
    setText('#ad-tool-hl', `${c.pendingHighlights} pending review${c.pendingHighlights === 1 ? '' : 's'}.`);
    setText('#ad-tool-vol', `${c.volunteerClaims} claim${c.volunteerClaims === 1 ? '' : 's'} across the season.`);
  }

  function fillLive() {
    if (!shellReady) return;
    const painters = [
      ['overview', fillOverview],
      ['appeals', fillAppeals],
      ['history', fillSaveHistory],
      ['tools', fillTools],
    ];
    painters.forEach(([id, fn]) => {
      try {
        fn();
      } catch (e) {
        console.error(`Admin ${id} fill failed`, e);
        const island = $(`#ad-section-${id} .ad-island-error`, root) || $(`#ad-section-${id}`, root);
        if (island && id !== 'overview' && id !== 'tools') {
          const errHost = $(`#ad-section-${id} .ad-fill-error`, root);
          if (errHost) errHost.textContent = e.message || String(e);
        }
      }
    });
  }

  function scheduleFill() {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      fillLive();
    }, 50);
  }

  function onStatsHubChange(state) {
    const sig = JSON.stringify(state?.results ?? {});
    if (sig === lastStatsSig) return;
    lastStatsSig = sig;
    scheduleFill();
  }

  function setAppealMsg(text, cls = '') {
    const el = $('#ad-sc-msg', root);
    if (!el) return;
    el.className = `draft-msg ${cls}`.trim();
    el.textContent = text || '';
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

  function setBootMsg(text, cls = '') {
    const msg = $('#ad-boot-msg', root);
    if (!msg) return;
    msg.className = `draft-msg ad-boot-msg ${cls}`.trim();
    msg.textContent = text || '';
    msg.hidden = !text;
  }

  function bindShellEvents() {
    if (shellBound) return;
    shellBound = true;
    root.addEventListener('click', async (e) => {
      const nav = e.target.closest('.ad-nav-btn');
      if (nav && root.contains(nav)) {
        setSection(nav.dataset.section);
        return;
      }
      if (e.target.closest('#ad-logout-top')) {
        AdminAuth.logout();
        paint();
        return;
      }
      const goto = e.target.closest('[data-goto-section]');
      if (goto && root.contains(goto)) {
        setSection(goto.dataset.gotoSection);
        return;
      }
      const hist = e.target.closest('.ad-open-history');
      if (hist && root.contains(hist)) {
        openHistoryModal(hist.dataset.match);
        return;
      }
      const vote = e.target.closest('.sc-vote');
      if (vote && root.contains(vote)) {
        try {
          await ContentionHub.vote(vote.dataset.id, vote.dataset.choice);
          setAppealMsg('Vote recorded', 'ok');
          fillLive();
        } catch (err) {
          setAppealMsg(err.message || String(err), 'err');
        }
        return;
      }
      const apply = e.target.closest('.sc-apply');
      if (apply && root.contains(apply)) {
        try {
          const entry = ContentionHub.get(apply.dataset.id);
          await applyPassedContention(entry);
          setAppealMsg('Applied to match box score', 'ok');
          fillLive();
        } catch (err) {
          setAppealMsg(err.message || String(err), 'err');
        }
      }
    });
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
      <p id="ad-boot-msg" class="draft-msg ad-boot-msg" hidden></p>
      <section class="ad-section ad-visible" data-section="overview" id="ad-section-overview">
        <div class="ad-welcome">
          <div>
            <h2>${escapeHtml(session?.role === 'admin' ? 'League admin' : 'Captain')} workspace</h2>
          </div>
          <button type="button" class="btn btn-ghost" id="ad-logout-top">Log out</button>
        </div>
        <div class="ad-metric-grid">
          <button type="button" class="ad-metric" data-goto-section="appeals">
            <span class="ad-metric-label">Open appeals</span>
            <span class="ad-metric-value" id="ad-metric-open">0</span>
            <span class="muted small">Need captain / admin votes</span>
          </button>
          <button type="button" class="ad-metric ad-metric-ready" data-goto-section="appeals">
            <span class="ad-metric-label">Ready to apply</span>
            <span class="ad-metric-value" id="ad-metric-ready">0</span>
            <span class="muted small">Majority passed · apply to box</span>
          </button>
          <button type="button" class="ad-metric" data-goto-section="history">
            <span class="ad-metric-label">Matches with saves</span>
            <span class="ad-metric-value" id="ad-metric-saves">0</span>
            <span class="muted small">Series / box score history</span>
          </button>
          <button type="button" class="ad-metric" data-goto-section="tools">
            <span class="ad-metric-label">Volunteer claims</span>
            <span class="ad-metric-value" id="ad-metric-vol">0</span>
            <span class="muted small">Across all weeks</span>
          </button>
        </div>
        <div id="ad-attention" class="ad-attention ad-attention-ok">
          <h3>All clear</h3>
          <p class="muted">No open appeals or pending highlight reviews right now.</p>
        </div>
        <div class="ad-split">
          <div class="ad-panel">
            <div class="panel-head">
              <h3>Recent appeals</h3>
              <button type="button" class="btn btn-ghost" data-goto-section="appeals">View all</button>
            </div>
            <div id="ad-recent-appeals"><p class="muted">No appeals yet.</p></div>
          </div>
          <div class="ad-panel">
            <div class="panel-head">
              <h3>Latest saves</h3>
              <button type="button" class="btn btn-ghost" data-goto-section="history">View all</button>
            </div>
            <div id="ad-recent-saves"><p class="muted">No saved match stats yet.</p></div>
          </div>
        </div>
      </section>
      <section class="ad-section" data-section="appeals" id="ad-section-appeals" hidden>
        <div class="ad-section-head">
          <div>
            <h2>Stat appeals</h2>
            <p class="muted" id="ad-appeals-copy">Majority after 5 votes. Passed appeals can be applied to the box score.</p>
          </div>
        </div>
        <p id="ad-sc-msg" class="draft-msg"></p>
        <h3 class="ad-subhead">Open / ready</h3>
        <div id="ad-appeals-open" class="ad-appeal-grid"><p class="muted">No open appeals.</p></div>
        <h3 class="ad-subhead">Recently closed</h3>
        <div id="ad-appeals-closed" class="ad-appeal-grid"><p class="muted">None yet.</p></div>
      </section>
      <section class="ad-section" data-section="history" id="ad-section-history" hidden>
        <div class="ad-section-head">
          <div>
            <h2>Match save history</h2>
            <p class="muted">Who worked on series scores and player box scores.</p>
          </div>
        </div>
        <div id="ad-history-body"><p class="muted">No saved match stats yet. Use Match stats entry to submit series and box scores.</p></div>
      </section>
      <section class="ad-section" data-section="tools" id="ad-section-tools" hidden>
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
            <p class="muted" id="ad-tool-hl">0 pending reviews.</p>
            <span class="text-link">Open highlights →</span>
          </a>
          <a class="ad-tool-card" href="../#volunteer">
            <h3>Volunteer board</h3>
            <p class="muted" id="ad-tool-vol">0 claims across the season.</p>
            <span class="text-link">Open volunteer tab →</span>
          </a>
          <a class="ad-tool-card" href="../">
            <h3>League dashboard</h3>
            <p class="muted">Standings, schedule, roster, and public stats.</p>
            <span class="text-link">Open dashboard →</span>
          </a>
        </div>
      </section>
    `;
    try {
      const saved = localStorage.getItem('atxutl.adminSection');
      if (saved && ['overview', 'appeals', 'history', 'tools'].includes(saved)) activeSection = saved;
    } catch (e) { /* ignore */ }
    shellReady = true;
    bindShellEvents();
    syncNav();
    fillLive();
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

  function withTimeout(promise, ms, label) {
    return Promise.race([
      Promise.resolve().then(() => promise),
      new Promise((resolve) => {
        setTimeout(() => resolve({ timedOut: true, label }), ms);
      }),
    ]).catch((e) => ({ error: e, label }));
  }

  function bindHubListeners() {
    if (listenersBound) return;
    listenersBound = true;
    const stats = hub('StatsHub');
    const contention = hub('ContentionHub');
    const volunteer = hub('VolunteerHub');
    const highlights = hub('HighlightsHub');
    if (stats) stats.onChange(onStatsHubChange);
    if (contention) contention.onChange(() => scheduleFill());
    if (volunteer) volunteer.onChange(() => scheduleFill());
    if (highlights) highlights.onChange(() => scheduleFill());
  }

  function bootLive(reason) {
    if (bootStarted) return;
    if (!liveHubsPresent()) {
      if (reason === 'load' || reason === 'give-up') setBootMsg('');
      return;
    }
    bootStarted = true;
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }

    if (AdminAuth.session()) {
      setBootMsg('Connecting to live data…');
    }

    Promise.all([
      hub('ContentionHub') ? withTimeout(ContentionHub.init(), 10000, 'appeals') : Promise.resolve(),
      hub('StatsHub') ? withTimeout(StatsHub.init(), 10000, 'stats') : Promise.resolve(),
      hub('VolunteerHub') ? withTimeout(VolunteerHub.init(), 10000, 'volunteers') : Promise.resolve(),
      hub('HighlightsHub') ? withTimeout(HighlightsHub.init(), 10000, 'highlights') : Promise.resolve(),
    ]).then((results) => {
      const timed = results.filter((r) => r && r.timedOut).map((r) => r.label);
      const errored = results.filter((r) => r && r.error);
      if (errored.length) {
        setBootMsg(errored.map((r) => r.error?.message || r.label).join(' · '), 'err');
      } else if (timed.length) {
        setBootMsg(`Still syncing ${timed.join(', ')}… UI is ready.`);
        setTimeout(() => {
          const msg = $('#ad-boot-msg', root);
          if (msg && msg.textContent.includes('Still syncing')) setBootMsg('');
        }, 4000);
      } else {
        setBootMsg('');
      }
      fillLive();
      bindHubListeners();
    });
  }

  function scheduleBoot() {
    if (bootStarted) return;
    if (liveHubsPresent()) {
      bootLive('present');
      return;
    }
    if (bootScheduled) return;
    bootScheduled = true;
    window.addEventListener('load', () => bootLive('load'), { once: true });
    setTimeout(() => {
      if (!bootStarted) setBootMsg('');
      if (liveHubsPresent()) bootLive('timeout-ready');
    }, 2500);
    const t0 = Date.now();
    pollTimer = setInterval(() => {
      if (bootStarted) {
        clearInterval(pollTimer);
        pollTimer = null;
        return;
      }
      if (liveHubsPresent()) {
        clearInterval(pollTimer);
        pollTimer = null;
        bootLive('poll');
        return;
      }
      if (Date.now() - t0 > 15000) {
        clearInterval(pollTimer);
        pollTimer = null;
        bootLive('give-up');
      }
    }, 100);
  }

  function paint() {
    const s = AdminAuth.session();
    bindShellEvents();
    if (!s) {
      shellReady = false;
      lastStatsSig = null;
      paintLogin();
      scheduleBoot();
      return;
    }

    if (!shellReady || !$('.ad-nav', root)) {
      paintShell(s);
    } else {
      fillLive();
    }
    scheduleBoot();
  }

  applyTheme();
  paint();
})();
