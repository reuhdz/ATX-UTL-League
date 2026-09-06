/* /admin — login + tool links + stat contention voting + save history */
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
      <p class="muted small">${matchTitle(match)}</p>
      ${history.length ? `
        <ol class="ad-history-list">
          ${history.map((h) => `
            <li>
              <div class="ad-history-main">
                <strong>${h.label}</strong>
                <span class="pill">${StatsHub.actionLabel(h.action)}</span>
              </div>
              <div class="muted small">${fmtWhen(h.at)}${h.role ? ` · ${h.role}` : ''}</div>
            </li>`).join('')}
        </ol>` : '<p class="muted">No save history recorded for this match yet.</p>'}
    `;
    host.hidden = false;
    document.body.style.overflow = 'hidden';
    $('#ad-history-close')?.addEventListener('click', closeHistoryModal);
  }

  function paintSaveHistory() {
    const host = $('#ad-save-history');
    if (!host || typeof StatsHub === 'undefined') return;
    const matches = (window.DB?.matches || [])
      .filter((m) => StatsHub.getResult(m.id))
      .slice()
      .sort((a, b) => Number(b.round) - Number(a.round) || String(a.id).localeCompare(b.id));

    if (!matches.length) {
      host.innerHTML = '<p class="muted">No saved match stats yet.</p>';
      return;
    }

    host.innerHTML = `
      <ul class="ad-history-match-list">
        ${matches.map((m) => {
          const hist = StatsHub.historyFor(m.id);
          const last = hist[hist.length - 1];
          return `<li>
            <div>
              <div class="strong">${matchTitle(m)}</div>
              <div class="muted small">${hist.length} save${hist.length === 1 ? '' : 's'}
                ${last ? ` · last: ${last.label} (${StatsHub.actionLabel(last.action)})` : ''}</div>
            </div>
            <button type="button" class="btn btn-ghost ad-open-history" data-match="${m.id}">View history</button>
          </li>`;
        }).join('')}
      </ul>`;

    $$('.ad-open-history', host).forEach((btn) => {
      btn.addEventListener('click', () => openHistoryModal(btn.dataset.match));
    });
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
          paintSaveHistory();
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
          <h3>Match save history</h3>
          <span class="muted small">Who saved series / box scores</span>
        </div>
        <div id="ad-save-history"><p class="muted">Loading…</p></div>
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

    const boot = Promise.all([
      typeof ContentionHub !== 'undefined' ? ContentionHub.init() : Promise.resolve(),
      typeof StatsHub !== 'undefined' ? StatsHub.init() : Promise.resolve(),
    ]);
    boot.then(() => {
      paintSaveHistory();
      paintContentions();
      if (typeof StatsHub !== 'undefined') {
        StatsHub.onChange(() => paintSaveHistory());
      }
      if (typeof ContentionHub !== 'undefined') {
        ContentionHub.onChange(() => paintContentions());
      }
    }).catch((e) => {
      const host = $('#ad-contentions');
      if (host) host.innerHTML = `<p class="draft-msg err">${e.message || e}</p>`;
      const hist = $('#ad-save-history');
      if (hist) hist.innerHTML = `<p class="draft-msg err">${e.message || e}</p>`;
    });
  }

  applyTheme();
  paint();
})();
