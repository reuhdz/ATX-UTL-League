/* /contention — captains + admin vote on stat appeals */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const root = $('#sc-review-app');
  if (!root) return;

  const FIELD_LABELS = {
    goals: 'Goals', assists: 'Assists', steals: 'Steals', blocks: 'Blocks',
    turnovers: 'Turnovers', swimOffAttempts: 'Swim-off attempts',
    swimOffs: 'Swim-off wins', shots: 'Shots',
  };

  let filter = 'open';
  let msg = { text: '', cls: '' };

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setMsg(text, cls = '') { msg = { text: text || '', cls }; }

  function applyTheme() {
    let theme = 'dark';
    try { theme = localStorage.getItem('atxutl.theme') || 'dark'; } catch (e) {}
    document.documentElement.dataset.theme = theme;
  }

  function matchLabel(entry) {
    const m = (window.DB?.matches || []).find((x) => x.id === entry.matchId);
    if (m) {
      const round = m.round != null ? `Week ${m.round}` : '';
      return `${round}${round ? ' · ' : ''}${DB.teamName(m.home)} vs ${DB.teamName(m.away)}`;
    }
    if (entry.round != null) return `Week ${entry.round}`;
    return 'Match not specified';
  }

  function playerName(entry) {
    return window.DB?.player?.(entry.playerId)?.name || entry.playerName || entry.playerId;
  }

  function counts() {
    const all = ContentionHub.list();
    const out = { all: all.length, open: 0, passed: 0, failed: 0, applied: 0 };
    all.forEach((e) => { if (out[e.status] != null) out[e.status] += 1; });
    return out;
  }

  function cardHtml(e) {
    const t = ContentionHub.tally(e.votes);
    const mine = ContentionHub.myVote(e.id);
    const quorum = ContentionHub.VOTE_QUORUM;
    const field = FIELD_LABELS[e.field] || e.field;
    const action = e.action === 'request' ? 'Request credit' : 'Contest value';
    const current = e.currentValue == null ? '—' : String(e.currentValue);
    const when = e.createdAt ? new Date(e.createdAt).toLocaleString() : '';
    const who = e.createdBy?.label || e.createdBy?.username || 'Player';
    const open = e.status === 'open';
    const passed = e.status === 'passed';

    return `
      <article class="panel contention-vote-card" data-id="${escapeHtml(e.id)}">
        <div class="panel-head">
          <h3>${escapeHtml(playerName(e))} · ${escapeHtml(field)}</h3>
          <span class="pill ${escapeHtml(e.status)}">${escapeHtml(e.status)}</span>
        </div>
        <div class="contention-vote-meta">
          <span class="muted small">${escapeHtml(matchLabel(e))}</span>
          <span class="muted small">${escapeHtml(action)}</span>
          <span class="muted small">${escapeHtml(who)}${when ? ` · ${escapeHtml(when)}` : ''}</span>
        </div>
        <p><b>${current}</b> → <b>${escapeHtml(String(e.proposedValue))}</b></p>
        ${e.comment ? `<p class="hl-comment">${escapeHtml(e.comment)}</p>` : ''}
        ${e.videoUrl ? `<p class="muted small"><a href="${escapeHtml(e.videoUrl)}" target="_blank" rel="noopener">Watch clip</a></p>` : ''}
        <p class="contention-vote-tally">${t.forCount} for · ${t.againstCount} against · ${t.total}/${quorum} votes${mine ? ` · you voted ${mine}` : ''}</p>
        <div class="se-actions">
          ${open ? `
            <button type="button" class="btn${mine === 'for' ? '' : ' btn-ghost'}" data-vote="${escapeHtml(e.id)}" data-choice="for">For</button>
            <button type="button" class="btn${mine === 'against' ? '' : ' btn-ghost'}" data-vote="${escapeHtml(e.id)}" data-choice="against">Against</button>
            ${mine ? `<button type="button" class="btn btn-ghost" data-unvote="${escapeHtml(e.id)}">Clear my vote</button>` : ''}
          ` : ''}
          ${passed ? `
            <a class="btn btn-ghost" href="../stats/">Open match stats</a>
            <button type="button" class="btn" data-apply="${escapeHtml(e.id)}">Mark applied</button>
          ` : ''}
        </div>
      </article>`;
  }

  function paint() {
    const n = counts();
    const items = filter === 'all' ? ContentionHub.list() : ContentionHub.list(filter);
    const filters = [
      ['open', 'Open'],
      ['passed', 'Passed'],
      ['failed', 'Failed'],
      ['applied', 'Applied'],
      ['all', 'All'],
    ];

    root.innerHTML = `
      <div class="page-head">
        <h2>Stat contention</h2>
      </div>
      <div class="se-toolbar">
        <span class="muted small">${escapeHtml(AdminAuth.session()?.label || 'Staff')}</span>
        <a class="muted small" href="../admin/">← Admin</a>
        <a class="muted small" href="../">Dashboard</a>
        <button type="button" class="btn btn-ghost" id="sc-logout">Log out</button>
      </div>
      <p class="draft-msg ${msg.cls}">${escapeHtml(msg.text)}</p>
      <p class="muted small">Vote on player stat appeals. After ${ContentionHub.VOTE_QUORUM} votes, a majority <b>for</b> passes the request so it can be applied on Match stats.</p>

      <section class="panel">
        <div class="seg" role="tablist" aria-label="Appeal status">
          ${filters.map(([id, label]) =>
            `<button type="button" class="seg-btn${filter === id ? ' active' : ''}" data-filter="${id}">${label}${id === 'all' ? ` (${n.all})` : ` (${n[id]})`}</button>`
          ).join('')}
        </div>
      </section>

      ${items.length
        ? items.map(cardHtml).join('')
        : `<section class="panel"><p class="muted">No ${filter === 'all' ? '' : `${filter} `}stat appeals.</p></section>`}`;

    $('#sc-logout')?.addEventListener('click', () => {
      AdminAuth.logout();
      window.location.href = '../admin/';
    });

    $$('[data-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        filter = btn.dataset.filter;
        paint();
      });
    });

    $$('[data-vote]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          btn.disabled = true;
          await ContentionHub.vote(btn.dataset.vote, btn.dataset.choice);
          setMsg(`Voted ${btn.dataset.choice}`, 'ok');
          paint();
        } catch (err) {
          setMsg(err.message || String(err), 'err');
          paint();
        }
      });
    });

    $$('[data-unvote]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await ContentionHub.clearVote(btn.dataset.unvote);
          setMsg('Vote cleared', 'ok');
          paint();
        } catch (err) {
          setMsg(err.message || String(err), 'err');
          paint();
        }
      });
    });

    $$('[data-apply]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          btn.disabled = true;
          await ContentionHub.markApplied(btn.dataset.apply);
          setMsg('Marked applied', 'ok');
          paint();
        } catch (err) {
          setMsg(err.message || String(err), 'err');
          paint();
        }
      });
    });
  }

  applyTheme();
  if (!AdminAuth.requireLogin('../admin/')) return;

  ContentionHub.init().then(() => {
    ContentionHub.onChange(() => paint());
    paint();
  }).catch((e) => {
    root.innerHTML = `<p class="draft-msg err">${escapeHtml(e.message || e)}</p>`;
  });
})();
