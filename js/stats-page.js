/* =============================================================================
   /stats — admin series + individual box-score entry
   Master PIN gated. Not linked from main nav.
   ============================================================================ */

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const root = $('#stats-app');
  if (!root) return;

  const SESSION_KEY = 'atxutl.stats.unlocked';
  const FIELDS = StatsHub.fields;
  const FIELD_LABELS = {
    goals: 'G', assists: 'A', steals: 'S', blocks: 'B',
    turnovers: 'TO', swimOffs: 'SO', shots: 'SH',
  };

  let unlocked = false;
  let pinVal = '';
  let week = null;
  let matchId = null;
  let seriesGames = [{ home: '', away: '' }, { home: '', away: '' }, { home: '', away: '' }];
  let draft = null; // { homeLineup, awayLineup, box }
  let msg = { text: '', cls: '' };

  try { unlocked = sessionStorage.getItem(SESSION_KEY) === '1'; } catch (e) {}

  const fmtDate = (iso) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });

  function setMsg(text, cls = '') { msg = { text: text || '', cls }; }

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
                ${FIELDS.map((f) => `<th>${FIELD_LABELS[f]}</th>`).join('')}
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
                    <td><input class="se-num" type="number" min="0" step="1"
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
    const st = StatsHub.status();

    if (!unlocked) {
      root.innerHTML = `
        <div class="page-head">
          <h2>Match stats</h2>
          <p class="muted">Admin only — master PIN required.</p>
        </div>
        <section class="panel se-lock">
          <label class="se-pin"><span>Master PIN</span>
            <input id="se-pin" class="input" type="password" autocomplete="off" />
          </label>
          <button type="button" class="btn" id="se-unlock">Unlock</button>
          <p class="draft-msg ${msg.cls}">${msg.text}</p>
          <p class="muted small"><a href="../">← Dashboard</a></p>
        </section>`;
      $('#se-unlock')?.addEventListener('click', () => {
        const pin = ($('#se-pin')?.value || '').trim();
        if (!StatsHub.checkMasterPin(pin)) {
          setMsg('Incorrect master PIN', 'err');
          paint();
          return;
        }
        pinVal = pin;
        unlocked = true;
        try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) {}
        setMsg('');
        paint();
      });
      $('#se-pin')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') $('#se-unlock')?.click();
      });
      return;
    }

    if (week == null) week = weeks()[0] || 1;
    const weekMatches = matchesForWeek(week);
    if (!matchId || !weekMatches.some((m) => m.id === matchId)) {
      selectMatch(weekMatches[0]?.id || null);
    }
    const match = currentMatch();
    const preview = seriesPreview();
    const saved = match ? StatsHub.getResult(match.id) : null;
    const conn = st.connectionError
      ? `Sync issue: ${st.connectionError}`
      : st.mode === 'firebase' ? (st.connected ? 'Live Firebase' : 'Connecting…') : 'Local only';

    root.innerHTML = `
      <div class="page-head">
        <h2>Match stats</h2>
        <p class="muted">Submit series scores separately from individual box scores. Series updates standings; box scores update player/team totals.</p>
      </div>
      <div class="se-toolbar">
        <label class="se-pin"><span>Master PIN</span>
          <input id="se-pin" class="input" type="password" autocomplete="off" value="${String(pinVal).replace(/"/g, '&quot;')}" />
        </label>
        <span class="muted small">${conn}</span>
        <a class="muted small" href="../">← Dashboard</a>
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
                <input class="input se-score" type="number" min="0" max="20" data-game="${i}" data-side="home" value="${g.home}" />
              </label>
              <span class="se-vs">–</span>
              <label>${teamName(match.away)}
                <input class="input se-score" type="number" min="0" max="20" data-game="${i}" data-side="away" value="${g.away}" />
              </label>
            </div>`).join('')}
        </div>
        <div class="se-actions">
          <button type="button" class="btn" id="se-save-series">Submit series scores</button>
          <button type="button" class="btn btn-ghost" id="se-clear" ${saved ? '' : 'disabled'}>Clear match</button>
        </div>
        <p class="muted small">Leave unused games blank (e.g. 2–0 series only needs Game 1 &amp; 2).</p>
      </section>

      <section class="panel">
        <div class="panel-head"><h3>3 · Individual stats</h3>
          <span class="muted small">${saved?.boxSavedAt ? 'Box scores saved' : 'Not submitted yet'}</span>
        </div>
        <div class="se-grid">${sideTable('home')}${sideTable('away')}</div>
        <div class="se-actions" style="margin-top:14px">
          <button type="button" class="btn" id="se-save-box">Submit individual stats</button>
        </div>
      </section>` : ''}`;

    $('#se-pin')?.addEventListener('input', (e) => { pinVal = e.target.value; });

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

    $$('.se-score').forEach((inp) => {
      inp.addEventListener('input', () => {
        const i = Number(inp.dataset.game);
        seriesGames[i][inp.dataset.side] = inp.value;
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
      inp.addEventListener('change', () => {
        ensureBox(inp.dataset.player);
        draft.box[inp.dataset.player][inp.dataset.field] = Math.max(0, Math.round(Number(inp.value) || 0));
        inp.value = draft.box[inp.dataset.player][inp.dataset.field];
      });
    });

    $('#se-save-series')?.addEventListener('click', async () => {
      try {
        const pin = ($('#se-pin')?.value || pinVal || '').trim();
        const games = seriesGames.map((g) => ({ home: g.home, away: g.away }));
        await StatsHub.saveSeries(matchId, games, pin);
        setMsg(`Series saved — ${teamName(match.home)} ${preview.homeScore}–${preview.awayScore} ${teamName(match.away)}`, 'ok');
        paint();
      } catch (e) {
        setMsg(e.message || String(e), 'err');
        paint();
      }
    });

    $('#se-save-box')?.addEventListener('click', async () => {
      try {
        const pin = ($('#se-pin')?.value || pinVal || '').trim();
        const homeLineup = [...draft.homeLineup];
        const awayLineup = [...draft.awayLineup];
        const box = [...new Set([...homeLineup, ...awayLineup])].map((id) => {
          ensureBox(id);
          return { ...draft.box[id], playerId: id };
        });
        await StatsHub.saveBox(matchId, { homeLineup, awayLineup, box }, pin);
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
        const pin = ($('#se-pin')?.value || pinVal || '').trim();
        await StatsHub.clearMatch(matchId, pin);
        selectMatch(matchId);
        setMsg('Match cleared', 'ok');
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

  applyTheme();
  Promise.all([DraftHub.init(), AttendanceHub.init(), StatsHub.init()]).then(() => {
    paint();
  }).catch((e) => {
    root.innerHTML = `<p class="draft-msg err">${e.message || e}</p>`;
  });
})();
