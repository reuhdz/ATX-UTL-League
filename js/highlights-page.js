/* /season-5-highlights — public vote page (one vote per video per session) */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const root = $('#hl-review-app');
  if (!root) return;

  let msg = { text: '', cls: '' };
  let filterRound = 'all';
  let filterMatch = 'all';

  const fmtDate = (iso) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });

  function setMsg(text, cls = '') { msg = { text: text || '', cls }; }

  function weeks() {
    return [...new Set((DB.matches || []).map((m) => m.round))].sort((a, b) => a - b);
  }

  function matchesForWeek(r) {
    if (r === 'all') return DB.matches || [];
    return (DB.matches || []).filter((m) => m.round === Number(r));
  }

  function matchLabel(matchId) {
    const m = (DB.matches || []).find((x) => x.id === matchId);
    if (!m) return matchId || 'Unknown match';
    return `Week ${m.round} · ${DB.teamName(m.home)} vs ${DB.teamName(m.away)}`;
  }

  function paint() {
    const voter = HighlightsHub.sessionVoterKey();
    let items = HighlightsHub.list();
    if (filterRound !== 'all') {
      items = items.filter((e) => Number(e.round) === Number(filterRound));
    }
    if (filterMatch !== 'all') {
      items = items.filter((e) => e.matchId === filterMatch);
    }

    const weekOpts = [
      `<option value="all" ${filterRound === 'all' ? 'selected' : ''}>All weeks</option>`,
      ...weeks().map((r) =>
        `<option value="${r}" ${String(filterRound) === String(r) ? 'selected' : ''}>Week ${r}</option>`),
    ].join('');
    const matchOpts = [
      `<option value="all" ${filterMatch === 'all' ? 'selected' : ''}>All matches</option>`,
      ...matchesForWeek(filterRound).map((m) =>
        `<option value="${m.id}" ${filterMatch === m.id ? 'selected' : ''}>${DB.teamName(m.home)} vs ${DB.teamName(m.away)} · ${fmtDate(m.date)}</option>`),
    ].join('');

    root.innerHTML = `
      <div class="page-head">
        <h2>Season 5 highlights</h2>
      </div>
      <div class="se-toolbar">
        <a class="muted small" href="../">← Dashboard</a>
        <a class="muted small" href="../" id="hl-nominate-link">Nominate a clip</a>
      </div>
      <p class="draft-msg ${msg.cls}">${msg.text}</p>
      <p class="muted small">Vote for as many clips as you like — one vote per clip from this browser. Top 3 per week &amp; match appear under Media → Highlights.</p>

      <section class="panel">
        <div class="se-pickers">
          <label>Week
            <select id="hl-filter-week">${weekOpts}</select>
          </label>
          <label>Match
            <select id="hl-filter-match">${matchOpts}</select>
          </label>
        </div>
      </section>

      ${items.length ? items.map((e) => {
        const mine = HighlightsHub.hasVoted(e.id, voter);
        const player = e.playerId ? DB.player(e.playerId) : null;
        return `
          <article class="panel hl-card" data-id="${e.id}">
            <div class="panel-head">
              <h3>${e.voteCount} vote${e.voteCount === 1 ? '' : 's'}${mine ? ' · you voted' : ''}</h3>
              <span class="muted small">${new Date(e.createdAt).toLocaleString()}</span>
            </div>
            <p class="muted small">${matchLabel(e.matchId)}${e.round != null ? '' : ''}</p>
            ${player ? `<p class="muted small">Spotlight: ${player.name}</p>` : ''}
            <ul class="hl-url-review">
              ${(e.urls || []).map((u) => `<li><a href="${u}" target="_blank" rel="noopener">${u}</a></li>`).join('') || '<li class="muted">No links</li>'}
            </ul>
            ${e.comment ? `<p class="hl-comment">${e.comment}</p>` : ''}
            <div class="se-actions">
              ${mine
                ? `<button type="button" class="btn btn-ghost" data-unvote="${e.id}">Remove my vote</button>`
                : `<button type="button" class="btn" data-vote="${e.id}">Vote</button>`}
            </div>
          </article>`;
      }).join('') : '<section class="panel"><p class="muted">No highlight nominations yet for this filter.</p></section>'}`;

    $('#hl-nominate-link')?.addEventListener('click', (e) => {
      try { localStorage.setItem('atxutl.tab', 'media'); } catch (err) { /* ignore */ }
    });

    $('#hl-filter-week')?.addEventListener('change', (e) => {
      filterRound = e.target.value;
      filterMatch = 'all';
      paint();
    });
    $('#hl-filter-match')?.addEventListener('change', (e) => {
      filterMatch = e.target.value;
      paint();
    });

    $$('[data-vote]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          btn.disabled = true;
          await HighlightsHub.vote(btn.dataset.vote);
          setMsg('Vote recorded', 'ok');
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
          await HighlightsHub.clearVote(btn.dataset.unvote);
          setMsg('Vote removed', 'ok');
          paint();
        } catch (err) {
          setMsg(err.message || String(err), 'err');
          paint();
        }
      });
    });
  }

  function applyTheme() {
    let theme = 'dark';
    try { theme = localStorage.getItem('atxutl.theme') || 'dark'; } catch (e) {}
    document.documentElement.dataset.theme = theme;
  }

  applyTheme();
  HighlightsHub.init().then(() => {
    HighlightsHub.onChange(() => paint());
    paint();
  }).catch((e) => {
    root.innerHTML = `<p class="draft-msg err">${e.message || e}</p>`;
  });
})();
