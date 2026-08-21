/* /season-5-highlights — captain/admin review + single vote */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const root = $('#hl-review-app');
  if (!root) return;

  if (!AdminAuth.requireLogin('../admin/')) return;

  let msg = { text: '', cls: '' };
  /** @type {Record<string, { round: string, matchId: string, playerId: string }>} */
  const draftMeta = {};

  const fmtDate = (iso) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });

  function setMsg(text, cls = '') { msg = { text: text || '', cls }; }

  function weeks() {
    return [...new Set((DB.matches || []).map((m) => m.round))].sort((a, b) => a - b);
  }

  function matchesForWeek(r) {
    return (DB.matches || []).filter((m) => m.round === Number(r));
  }

  function ensureDraft(id, entry) {
    if (!draftMeta[id]) {
      draftMeta[id] = {
        round: entry.round != null ? String(entry.round) : String(weeks()[0] || 1),
        matchId: entry.matchId || '',
        playerId: entry.playerId || '',
      };
      if (!draftMeta[id].matchId) {
        const first = matchesForWeek(draftMeta[id].round)[0];
        draftMeta[id].matchId = first?.id || '';
      }
    }
    return draftMeta[id];
  }

  function paint() {
    const session = AdminAuth.session();
    const items = HighlightsHub.list();
    const myVote = HighlightsHub.voterHighlightId(session.voterKey);

    root.innerHTML = `
      <div class="page-head">
        <h2>Season 5 highlights</h2>
      </div>
      <div class="se-toolbar">
        <span class="muted small">${session.label}</span>
        <a class="muted small" href="../admin/">← Admin</a>
        <button type="button" class="btn btn-ghost" id="hl-logout">Log out</button>
      </div>
      <p class="draft-msg ${msg.cls}">${msg.text}</p>
      <p class="muted small">Each captain/admin gets <b>one</b> vote. Top 3 voted clips per match appear under Media → Highlights.</p>

      ${items.length ? items.map((e) => {
        const meta = ensureDraft(e.id, e);
        const weekOpts = weeks().map((r) =>
          `<option value="${r}" ${String(meta.round) === String(r) ? 'selected' : ''}>Week ${r}</option>`).join('');
        const matchOpts = matchesForWeek(meta.round).map((m) =>
          `<option value="${m.id}" ${meta.matchId === m.id ? 'selected' : ''}>${DB.teamName(m.home)} vs ${DB.teamName(m.away)} · ${fmtDate(m.date)}</option>`).join('');
        const playerOpts = [
          `<option value="">— optional —</option>`,
          ...DB.season5Roster().map((p) =>
            `<option value="${p.id}" ${meta.playerId === p.id ? 'selected' : ''}>${p.name}</option>`),
        ].join('');
        const mine = myVote === e.id;
        return `
          <article class="panel hl-card" data-id="${e.id}">
            <div class="panel-head">
              <h3>${e.voteCount} vote${e.voteCount === 1 ? '' : 's'}${mine ? ' · your vote' : ''}</h3>
              <span class="muted small">${new Date(e.createdAt).toLocaleString()}</span>
            </div>
            <ul class="hl-url-review">
              ${(e.urls || []).map((u) => `<li><a href="${u}" target="_blank" rel="noopener">${u}</a></li>`).join('') || '<li class="muted">No links</li>'}
            </ul>
            ${e.comment ? `<p class="hl-comment">${e.comment}</p>` : ''}
            <div class="se-pickers hl-meta">
              <label>Week
                <select class="hl-round" data-id="${e.id}">${weekOpts}</select>
              </label>
              <label>Match
                <select class="hl-match" data-id="${e.id}">${matchOpts}</select>
              </label>
              <label>Player spotlight
                <select class="hl-player" data-id="${e.id}">${playerOpts}</select>
              </label>
            </div>
            <div class="se-actions">
              <button type="button" class="btn ${mine ? '' : ''}" data-vote="${e.id}">${mine ? 'Update my vote' : 'Vote'}</button>
              ${mine ? `<button type="button" class="btn btn-ghost" data-unvote="${e.id}">Remove my vote</button>` : ''}
            </div>
          </article>`;
      }).join('') : '<section class="panel"><p class="muted">No highlight nominations yet.</p></section>'}`;

    $('#hl-logout')?.addEventListener('click', () => {
      AdminAuth.logout();
      window.location.href = '../admin/';
    });

    $$('.hl-round').forEach((sel) => {
      sel.addEventListener('change', () => {
        const id = sel.dataset.id;
        ensureDraft(id, HighlightsHub.get(id) || {});
        draftMeta[id].round = sel.value;
        draftMeta[id].matchId = matchesForWeek(sel.value)[0]?.id || '';
        paint();
      });
    });
    $$('.hl-match').forEach((sel) => {
      sel.addEventListener('change', () => {
        ensureDraft(sel.dataset.id, {});
        draftMeta[sel.dataset.id].matchId = sel.value;
      });
    });
    $$('.hl-player').forEach((sel) => {
      sel.addEventListener('change', () => {
        ensureDraft(sel.dataset.id, {});
        draftMeta[sel.dataset.id].playerId = sel.value;
      });
    });

    $$('[data-vote]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.vote;
        const meta = ensureDraft(id, HighlightsHub.get(id) || {});
        try {
          btn.disabled = true;
          await HighlightsHub.vote(id, {
            voterKey: session.voterKey,
            round: meta.round,
            matchId: meta.matchId,
            playerId: meta.playerId || null,
          });
          setMsg('Vote saved — only this highlight counts for you', 'ok');
          paint();
        } catch (e) {
          setMsg(e.message || String(e), 'err');
          paint();
        }
      });
    });

    $$('[data-unvote]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await HighlightsHub.clearVote(session.voterKey);
          setMsg('Vote removed', 'ok');
          paint();
        } catch (e) {
          setMsg(e.message || String(e), 'err');
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
