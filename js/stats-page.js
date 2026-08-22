/* =============================================================================
   /stats — series + individual box-score entry
   Requires captain or admin session (via /admin). Not linked from main nav.
   ============================================================================ */

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const root = $('#stats-app');
  if (!root) return;

  const FIELDS = StatsHub.fields;
  const FIELD_LABELS = {
    goals: 'G', assists: 'A', steals: 'S', blocks: 'B',
    turnovers: 'TO', swimOffAttempts: 'SOA', swimOffs: 'SO', shots: 'SH',
  };
  const FIELD_TITLES = {
    goals: 'Goals — torpedo placed in the opponent’s goal',
    assists: 'Assists — last pass/hand-off leading to a teammate’s goal',
    steals: 'Steals — takeaway from carrier or clear interception of an attempted pass (not a loose recovery)',
    blocks: 'Blocks — deny a look at goal only inside the scoring zone (near wall to 3rd lane line)',
    turnovers: 'Turnovers — lost possession without a shot or goal',
    swimOffAttempts: 'Swim-off attempts — times this player took the swim-off',
    swimOffs: 'Swim-off wins — first clean possession after restart',
    shots: 'Shots — scoring chances (includes goals)',
  };

  const BOX_CRITERIA_KEYS = ['G', 'A', 'S', 'B', 'TO', 'SOA', 'SO', 'SH'];

  let week = null;
  let matchId = null;
  let seriesGames = [{ home: '', away: '' }, { home: '', away: '' }, { home: '', away: '' }];
  let draft = null; // { homeLineup, awayLineup, box }
  let msg = { text: '', cls: '' };

  const fmtDate = (iso) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });

  function setMsg(text, cls = '') { msg = { text: text || '', cls }; }

  function fmtWhen(ts) {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleString();
    } catch (e) { return ''; }
  }

  function enteredByHtml(actor, at) {
    if (!actor?.label) return '';
    const when = fmtWhen(actor.at || at);
    return `Entered by ${actor.label}${when ? ` · ${when}` : ''}`;
  }

  function teamName(id) { return DB.teamName(id); }

  function weeks() {
    return [...new Set((DB.matches || []).map((m) => m.round))].sort((a, b) => a - b);
  }

  function matchesForWeek(r) {
    return (DB.matches || []).filter((m) => m.round === Number(r));
  }

  function currentMatch() {
    return (DB.matches || []).find((m) => m.id === matchId) || null;
  }

  function playersInForDate(date, teamId) {
    const roster = DB.rosterOf(teamId).map((p) => p.id);
    return roster.filter((id) => AttendanceHub.statusFor(date, id) === 'in');
  }

  function freeAgentOptions(exclude) {
    const ex = new Set(exclude || []);
    return DB.freeAgents()
      .filter((p) => DB.isSeason5(p.id) && !ex.has(p.id))
      .map((p) => `<option value="${p.id}">${p.name}</option>`)
      .join('');
  }

  function ensureBox(id) {
    if (!draft.box[id]) draft.box[id] = StatsHub.emptyLine(id);
  }

  function buildLineupsFromAttendance(match) {
    const homeLineup = playersInForDate(match.date, match.home);
    const awayLineup = playersInForDate(match.date, match.away);
    const box = {};
    [...homeLineup, ...awayLineup].forEach((id) => { box[id] = StatsHub.emptyLine(id); });
    return { homeLineup, awayLineup, box };
  }

  function loadDraftForMatch(match) {
    const saved = StatsHub.getResult(match.id);
    if (saved?.homeLineup?.length || saved?.awayLineup?.length || saved?.box?.length) {
      const box = {};
      (saved.box || []).forEach((b) => { box[b.playerId] = { ...b }; });
      [...(saved.homeLineup || []), ...(saved.awayLineup || [])].forEach((id) => {
        if (!box[id]) box[id] = StatsHub.emptyLine(id);
      });
      return {
        homeLineup: [...(saved.homeLineup || [])],
        awayLineup: [...(saved.awayLineup || [])],
        box,
      };
    }
    return buildLineupsFromAttendance(match);
  }

  function loadSeriesForMatch(match) {
    const saved = StatsHub.getResult(match.id);
    const empty = [{ home: '', away: '' }, { home: '', away: '' }, { home: '', away: '' }];
    if (!saved?.games?.length) return empty;
    return empty.map((slot, i) => {
      const g = saved.games[i];
      return g ? { home: String(g.home), away: String(g.away) } : { ...slot };
    });
  }

  function selectMatch(id) {
    matchId = id;
    const m = currentMatch();
    if (!m) {
      draft = null;
      seriesGames = [{ home: '', away: '' }, { home: '', away: '' }, { home: '', away: '' }];
      return;
    }
    seriesGames = loadSeriesForMatch(m);
    draft = loadDraftForMatch(m);
  }

  function addPlayer(side, playerId) {
    if (!draft || !playerId) return;
    const key = side === 'home' ? 'homeLineup' : 'awayLineup';
    const other = side === 'home' ? 'awayLineup' : 'homeLineup';
    draft[other] = draft[other].filter((id) => id !== playerId);
    if (!draft[key].includes(playerId)) draft[key].push(playerId);
    ensureBox(playerId);
  }

  function removePlayer(side, playerId) {
    const key = side === 'home' ? 'homeLineup' : 'awayLineup';
    draft[key] = draft[key].filter((id) => id !== playerId);
  }

  function seriesPreview() {
    const games = seriesGames
      .map((g) => ({ home: Number(g.home) || 0, away: Number(g.away) || 0 }))
      .filter((g) => g.home > 0 || g.away > 0);
    return StatsHub.seriesFromGames(games);
  }

  function sideTable(side) {
    const match = currentMatch();
    const teamId = side === 'home' ? match.home : match.away;
    const lineup = side === 'home' ? draft.homeLineup : draft.awayLineup;
    const title = `${side === 'home' ? 'Home' : 'Away'} — ${teamName(teamId)}`;
    const used = [...draft.homeLineup, ...draft.awayLineup];

    return `
      <section class="panel se-side">
        <div class="panel-head">
          <h3>${title}</h3>
          <label class="se-add">
            <span class="muted small">Add free agent</span>
            <select data-add-side="${side}">
              <option value="">—</option>
              ${freeAgentOptions(used)}
            </select>
          </label>
        </div>
        <p class="muted small se-hint">Prefilled from Attendance <b>In</b> on ${fmtDate(match.date)}.</p>
        <div class="table-scroll">
          <table class="tbl se-table">
            <thead>
              <tr>
                <th class="lft">Player</th>
                ${FIELDS.map((f) => `<th title="${FIELD_TITLES[f] || FIELD_LABELS[f]}">${FIELD_LABELS[f]}</th>`).join('')}
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${lineup.map((id) => {
                ensureBox(id);
                const p = DB.player(id);
                const line = draft.box[id];
                const guest = !p || p.teamId !== teamId;
                return `<tr>
                  <td class="lft strong">${p?.name || id}${guest ? ' <span class="guest">FA</span>' : ''}</td>
                  ${FIELDS.map((f) => `
                    <td><input class="se-num" type="number" min="0" max="99" step="1"
                      data-player="${id}" data-field="${f}" value="${line[f] || 0}" /></td>`).join('')}
                  <td><button type="button" class="btn btn-ghost se-remove" data-side="${side}" data-player="${id}">✕</button></td>
                </tr>`;
              }).join('') || '<tr><td colspan="9" class="muted">No In players — add free agents or update attendance.</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>`;
  }

  function paint() {
    if (week == null) week = weeks()[0] || 1;
    const weekMatches = matchesForWeek(week);
    if (!matchId || !weekMatches.some((m) => m.id === matchId)) {
      selectMatch(weekMatches[0]?.id || null);
    }
    const match = currentMatch();
    const preview = seriesPreview();
    const saved = match ? StatsHub.getResult(match.id) : null;

    root.innerHTML = `
      <div class="page-head">
        <h2>Match stats</h2>
      </div>
      <div class="se-toolbar">
        <span class="muted small">${AdminAuth.session()?.label || 'Admin'}</span>
        <a class="muted small" href="../admin/">← Admin</a>
        <a class="muted small" href="../">Dashboard</a>
        <button type="button" class="btn btn-ghost" id="se-logout">Log out</button>
      </div>
      <p class="draft-msg ${msg.cls}">${msg.text}</p>

      <section class="panel">
        <div class="panel-head"><h3>1 · Pick week &amp; game</h3></div>
        <div class="se-pickers">
          <label>Week
            <select id="se-week">
              ${weeks().map((r) => `<option value="${r}" ${Number(week) === r ? 'selected' : ''}>Week ${r}</option>`).join('')}
            </select>
          </label>
          <label>Game
            <select id="se-match">
              ${weekMatches.map((m) => {
                const tag = StatsHub.getResult(m.id) ? ' · saved' : '';
                return `<option value="${m.id}" ${m.id === matchId ? 'selected' : ''}>${teamName(m.home)} vs ${teamName(m.away)} · ${fmtDate(m.date)}${tag}</option>`;
              }).join('')}
            </select>
          </label>
        </div>
      </section>

      ${match ? `
      <section class="panel">
        <div class="panel-head">
          <h3>2 · Series scores</h3>
          <span class="muted small">Series ${preview.homeScore}–${preview.awayScore} · points ${preview.pointsHome}–${preview.pointsAway}</span>
        </div>
        <div class="se-games">
          ${seriesGames.map((g, i) => `
            <div class="se-game">
              <span class="se-game-label">Game ${i + 1}</span>
              <label>${teamName(match.home)}
                <input class="input se-score" type="number" min="0" max="5" data-game="${i}" data-side="home" value="${g.home}" />
              </label>
              <span class="se-vs">–</span>
              <label>${teamName(match.away)}
                <input class="input se-score" type="number" min="0" max="5" data-game="${i}" data-side="away" value="${g.away}" />
              </label>
            </div>`).join('')}
        </div>
        <div class="se-actions">
          <button type="button" class="btn" id="se-save-series" disabled>Submit series scores</button>
          <button type="button" class="btn btn-ghost" id="se-clear" disabled>Clear match</button>
        </div>
        <p class="muted small">${saved?.seriesSavedBy
          ? enteredByHtml(saved.seriesSavedBy, saved.seriesSavedAt)
          : 'Leave unused games blank (e.g. 2–0 series only needs Game 1 &amp; 2).'}</p>
      </section>

      <section class="panel">
        <div class="panel-head"><h3>3 · Individual stats</h3>
          <div class="se-head-actions">
            <button type="button" class="btn btn-ghost" id="se-criteria">Stat criteria</button>
            <span class="muted small">${saved?.boxSavedBy
              ? enteredByHtml(saved.boxSavedBy, saved.boxSavedAt)
              : (saved?.boxSavedAt ? 'Box scores saved' : 'Not submitted yet')}</span>
          </div>
        </div>
        <div class="se-grid">${sideTable('home')}${sideTable('away')}</div>
        <div class="se-actions" style="margin-top:14px">
          <button type="button" class="btn" id="se-save-box" disabled>Submit individual stats</button>
          <button type="button" class="btn btn-ghost" id="se-clear-box" disabled>Clear individual stats</button>
        </div>
      </section>` : ''}`;

    const syncSubmitButtons = () => {
      const ok = AdminAuth.isLoggedIn();
      const hasSaved = !!(matchId && StatsHub.getResult(matchId));
      const hasBox = !!(matchId && (StatsHub.getResult(matchId)?.boxSavedAt || StatsHub.getResult(matchId)?.box?.length));
      if ($('#se-save-series')) $('#se-save-series').disabled = !ok;
      if ($('#se-save-box')) $('#se-save-box').disabled = !ok;
      if ($('#se-clear')) $('#se-clear').disabled = !ok || !hasSaved;
      if ($('#se-clear-box')) $('#se-clear-box').disabled = !ok || !hasBox;
    };

    $('#se-logout')?.addEventListener('click', () => {
      AdminAuth.logout();
      window.location.href = '../admin/';
    });
    $('#se-criteria')?.addEventListener('click', () => openCriteriaModal());
    syncSubmitButtons();

    $('#se-week')?.addEventListener('change', (e) => {
      week = Number(e.target.value);
      const list = matchesForWeek(week);
      selectMatch(list[0]?.id || null);
      setMsg('');
      paint();
    });

    $('#se-match')?.addEventListener('change', (e) => {
      selectMatch(e.target.value);
      setMsg('');
      paint();
    });

    const bindZeroClear = (inp, { max = null, onCommit } = {}) => {
      inp.addEventListener('focus', () => {
        if (inp.value === '0') {
          inp.value = '';
        } else {
          inp.select();
        }
      });
      inp.addEventListener('blur', () => {
        let n = Math.round(Number(inp.value));
        if (!Number.isFinite(n) || inp.value === '') n = 0;
        if (n < 0) n = 0;
        if (max != null && n > max) n = max;
        inp.value = String(n);
        onCommit?.(n);
      });
      inp.addEventListener('input', () => {
        if (inp.value === '') return;
        let n = Number(inp.value);
        if (!Number.isFinite(n)) return;
        if (max != null && n > max) {
          inp.value = String(max);
          n = max;
        }
        onCommit?.(n);
      });
    };

    $$('.se-score').forEach((inp) => {
      bindZeroClear(inp, {
        max: 5,
        onCommit: (n) => {
          const i = Number(inp.dataset.game);
          seriesGames[i][inp.dataset.side] = String(n);
        },
      });
    });

    $$('[data-add-side]').forEach((sel) => {
      sel.addEventListener('change', () => {
        if (!sel.value) return;
        addPlayer(sel.dataset.addSide, sel.value);
        paint();
      });
    });

    $$('.se-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        removePlayer(btn.dataset.side, btn.dataset.player);
        paint();
      });
    });

    $$('.se-num').forEach((inp) => {
      bindZeroClear(inp, {
        onCommit: (n) => {
          ensureBox(inp.dataset.player);
          const line = draft.box[inp.dataset.player];
          line[inp.dataset.field] = Math.max(0, Math.round(n) || 0);
          if (line.swimOffs > line.swimOffAttempts) {
            line.swimOffAttempts = line.swimOffs;
          }
          inp.value = String(line[inp.dataset.field]);
          const att = document.querySelector(`.se-num[data-player="${inp.dataset.player}"][data-field="swimOffAttempts"]`);
          const win = document.querySelector(`.se-num[data-player="${inp.dataset.player}"][data-field="swimOffs"]`);
          if (att) att.value = String(line.swimOffAttempts || 0);
          if (win) win.value = String(line.swimOffs || 0);
        },
      });
    });

    $('#se-save-series')?.addEventListener('click', async () => {
      try {
        const games = seriesGames.map((g) => ({
          home: Math.min(5, Math.max(0, Number(g.home) || 0)),
          away: Math.min(5, Math.max(0, Number(g.away) || 0)),
        }));
        await StatsHub.saveSeries(matchId, games);
        setMsg(`Series saved — ${teamName(match.home)} ${preview.homeScore}–${preview.awayScore} ${teamName(match.away)}`, 'ok');
        paint();
      } catch (e) {
        setMsg(e.message || String(e), 'err');
        paint();
      }
    });

    $('#se-save-box')?.addEventListener('click', async () => {
      try {
        const homeLineup = [...draft.homeLineup];
        const awayLineup = [...draft.awayLineup];
        const box = [...new Set([...homeLineup, ...awayLineup])].map((id) => {
          ensureBox(id);
          return { ...draft.box[id], playerId: id };
        });
        await StatsHub.saveBox(matchId, { homeLineup, awayLineup, box });
        setMsg('Individual stats saved — player & team totals updated on the dashboard', 'ok');
        paint();
      } catch (e) {
        setMsg(e.message || String(e), 'err');
        paint();
      }
    });

    $('#se-clear')?.addEventListener('click', async () => {
      if (!confirm('Clear all saved series + box scores for this match?')) return;
      try {
        await StatsHub.clearMatch(matchId);
        selectMatch(matchId);
        setMsg('Match cleared', 'ok');
        paint();
      } catch (e) {
        setMsg(e.message || String(e), 'err');
        paint();
      }
    });

    $('#se-clear-box')?.addEventListener('click', async () => {
      if (!confirm('Clear individual stats for this match? Series scores will be kept.')) return;
      try {
        await StatsHub.clearBox(matchId);
        const m = currentMatch();
        draft = m ? buildLineupsFromAttendance(m) : null;
        setMsg('Individual stats cleared', 'ok');
        paint();
      } catch (e) {
        setMsg(e.message || String(e), 'err');
        paint();
      }
    });
  }

  function applyTheme() {
    let theme = 'dark';
    try { theme = localStorage.getItem('atxutl.theme') || 'dark'; } catch (e) {}
    document.documentElement.dataset.theme = theme;
  }

  function boxCriteriaList() {
    const index = window.PLAYER_STAT_INDEX || [];
    const want = new Set(BOX_CRITERIA_KEYS);
    return index.filter((s) => want.has(s.key));
  }

  function fillCriteriaModal() {
    const body = $('#stat-criteria-body');
    if (!body) return;
    const items = boxCriteriaList();
    body.innerHTML = items.length
      ? `<dl class="stat-criteria-dl">${items.map((s) =>
        `<dt><span class="ix-key">${s.key}</span> ${s.name}</dt><dd>${s.desc}</dd>`
      ).join('')}</dl>`
      : '<p class="muted">Stat definitions unavailable.</p>';
  }

  function openCriteriaModal() {
    fillCriteriaModal();
    const modal = $('#stat-criteria-modal');
    if (!modal) return;
    modal.hidden = false;
  }

  function closeCriteriaModal() {
    const modal = $('#stat-criteria-modal');
    if (modal) modal.hidden = true;
  }

  function bindCriteriaModal() {
    fillCriteriaModal();
    $('#stat-criteria-close')?.addEventListener('click', closeCriteriaModal);
    $('#stat-criteria-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'stat-criteria-modal') closeCriteriaModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeCriteriaModal();
    });
  }

  applyTheme();
  bindCriteriaModal();
  if (!AdminAuth.requireLogin('../admin/')) return;
  Promise.all([DraftHub.init(), AttendanceHub.init(), StatsHub.init()]).then(() => {
    paint();
  }).catch((e) => {
    root.innerHTML = `<p class="draft-msg err">${e.message || e}</p>`;
  });
})();