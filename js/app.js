/* =============================================================================
   ATX UTL — App: routing, theming, and all tab renderers.
   Reads exclusively from window.DB / RULES / FAQ / RESEARCH / MEDIA.
   ============================================================================ */

const view = document.getElementById('view');
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let teamHighlight = null; // set when navigating via a team link

/* ---------- small helpers ------------------------------------------------- */
const teamColor = (id) => (DB.team(id) || {}).color || '#94a3b8';
const fmtDate = (iso) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const diff = (n) => (n > 0 ? `+${n}` : `${n}`);

function teamPill(id) {
  if (id === 'fa') return `<span class="team-pill fa">Free Agent</span>`;
  const t = DB.team(id);
  return `<button class="team-pill link" data-team="${id}" style="--tc:${t.color}">${t.emoji} ${t.name}</button>`;
}
const teamBadge = (id) => (id === 'fa' ? 'Free Agent'
  : `${DB.team(id).emoji} ${DB.team(id).name}`);

function teamTag(id) {
  if (id === 'fa') return `<span class="team-tag">Free Agent</span>`;
  const t = DB.team(id);
  return `<span class="team-tag" style="--tc:${t.color}">${t.emoji} ${t.name}</span>`;
}
function playerLink(id, label) {
  const p = DB.player(id);
  return `<button class="plink" data-player="${id}">${label || p.name}</button>`;
}
function levelTag(level) {
  const cls = level === 'Rookie' ? 'rookie' : level.includes('IR') ? 'ir' : 'pro';
  return `<span class="lvl-tag ${cls}">${level}</span>`;
}
function infoIcon(html) {
  return `<span class="info"><span class="info-i" tabindex="0" role="button" aria-label="More info">ⓘ</span><span class="info-pop">${html}</span></span>`;
}
/* Wrap wide tables so they scroll horizontally inside their panel (mobile) */
function wrapTables(root) {
  $$('table.tbl', root).forEach((t) => {
    if (!t.parentElement.classList.contains('table-scroll')) {
      const w = document.createElement('div');
      w.className = 'table-scroll';
      t.parentNode.insertBefore(w, t);
      w.appendChild(t);
    }
  });
}

/* =============================================================================
   DASHBOARD
   ============================================================================ */
function renderDashboard() {
  const standings = DB.standings();
  const rated = DB.ratedPlayers().filter((p) => p.matches > 0);
  const finals = DB.finals();
  const upcoming = DB.upcoming();
  const totalGoals = finals.reduce((s, m) => s + m.homeScore + m.awayScore, 0);
  const leader = rated[0];
  const topScorer = [...rated].sort((a, b) => b.goals - a.goals)[0];

  const cards = [
    { icon: '🎮', label: 'Matches played', value: finals.length, sub: `${upcoming.length} upcoming` },
    { icon: '🥅', label: 'Total goals', value: totalGoals, sub: `${(totalGoals / (finals.length || 1)).toFixed(1)} per game` },
    { icon: '⭐', label: 'Top rated', value: leader.name, sub: `${teamBadge(leader.teamId)} · ${leader.rating}/10` },
    { icon: '🔥', label: 'Golden torpedo', value: topScorer.name, sub: `${topScorer.goals} goals` },
  ];

  view.innerHTML = `
    <div class="page-head">
      <h2>Season Dashboard</h2>
      <p class="muted">${DB.league.season} · ${DB.league.full} · ${DB.league.venue}</p>
    </div>

    <div class="stat-cards">
      ${cards.map((c) => `
        <div class="stat-card">
          <div class="stat-icon">${c.icon}</div>
          <div class="stat-body">
            <div class="stat-value">${c.value}</div>
            <div class="stat-label">${c.label}</div>
            <div class="stat-sub">${c.sub}</div>
          </div>
        </div>`).join('')}
    </div>

    <div class="grid-2">
      <section class="panel">
        <div class="panel-head">
          <h3>🏆 Standings ${infoIcon(standingsGlossaryHtml())}</h3>
          <span class="muted small">hover ⓘ for columns</span>
        </div>
        <table class="tbl standings">
          <thead><tr>
            <th>#</th><th>Team</th>
            ${DB.glossary.map(([c, d]) => `<th title="${d}">${c}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${standings.map((s, i) => `
              <tr>
                <td class="rank">${i + 1}</td>
                <td>${teamPill(s.teamId)}</td>
                <td>${s.played}</td><td>${s.w}</td><td>${s.d}</td><td>${s.l}</td>
                <td>${s.gf}</td><td>${s.ga}</td><td>${diff(s.gf - s.ga)}</td>
                <td class="pts">${s.pts}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </section>

      <section class="panel">
        <div class="panel-head">
          <h3>⭐ Top players ${infoIcon(ratingInfoHtml())}</h3>
          <span class="muted small">rating</span>
        </div>
        <ul class="leader-list">
          ${rated.slice(0, 7).map((p, i) => `
            <li>
              <span class="lead-rank">${i + 1}</span>
              <span class="lead-name">${playerLink(p.playerId)}<small>${teamBadge(p.teamId)}</small></span>
              <span class="lead-stat">${p.goals}G · ${p.assists}A</span>
              <span class="rating-badge">${p.rating}</span>
            </li>`).join('')}
        </ul>
      </section>
    </div>

    <div class="grid-2">
      <section class="panel">
        <div class="panel-head"><h3>🗓️ Next games</h3></div>
        <div class="fixture-list">
          ${upcoming.slice(0, 4).map(fixtureRow).join('') || '<p class="muted">Season complete.</p>'}
        </div>
      </section>
      <section class="panel">
        <div class="panel-head"><h3>📋 Recent results</h3></div>
        <div class="fixture-list">${[...finals].slice(-4).reverse().map(resultRow).join('')}</div>
      </section>
    </div>

    <section class="panel">
      <div class="panel-head"><h3>📈 Goals scored by team</h3></div>
      <div class="chart-wrap"><canvas id="dash-goals"></canvas></div>
    </section>
  `;

  ChartHub.bar('dash-goals',
    standings.map((s) => DB.teamName(s.teamId)),
    [
      { label: 'Goals for', data: standings.map((s) => s.gf), backgroundColor: standings.map((s) => teamColor(s.teamId)), borderRadius: 6 },
      { label: 'Goals against', data: standings.map((s) => s.ga), backgroundColor: standings.map((s) => teamColor(s.teamId) + '55'), borderRadius: 6 },
    ]);
}

function standingsGlossaryHtml() {
  return '<b>Column key</b>' + DB.glossary.map(([c, d]) => `<span class="gl"><b>${c}</b> — ${d}</span>`).join('');
}
function ratingInfoHtml() {
  const w = DB.rating.weights;
  return '<b>How ratings work</b><span class="gl">' + DB.rating.describe + '</span>' +
    '<span class="gl">Weights: ' + Object.entries(w).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(', ') + '</span>';
}

function fixtureRow(m) {
  return `<div class="fixture">
      <span class="fx-date">${fmtDate(m.date)} · R${m.round}</span>
      <span class="fx-teams">${teamPill(m.home)} <em>vs</em> ${teamPill(m.away)}</span>
    </div>`;
}
function resultRow(m) {
  const hw = m.homeScore > m.awayScore, aw = m.awayScore > m.homeScore;
  return `<div class="fixture">
      <span class="fx-date">${fmtDate(m.date)} · R${m.round}</span>
      <span class="fx-teams">${teamPill(m.home)}
        <b class="score ${hw ? 'win' : ''}">${m.homeScore}</b><em>–</em><b class="score ${aw ? 'win' : ''}">${m.awayScore}</b>
        ${teamPill(m.away)}</span>
    </div>`;
}

/* =============================================================================
   TEAMS
   ============================================================================ */
function renderTeams() {
  const standings = DB.standings();
  const rankOf = {}; standings.forEach((s, i) => (rankOf[s.teamId] = i + 1));
  const totals = DB.playerTotals();

  view.innerHTML = `
    <div class="page-head"><h2>Teams</h2><p class="muted">Rosters, records and form. Tap a player for their profile.</p></div>
    <div class="team-grid">
      ${DB.teams.map((t) => {
        const s = standings.find((x) => x.teamId === t.id);
        const roster = DB.rosterOf(t.id);
        const next = DB.nextGameFor(t.id);
        const tt = DB.teamTotals(t.id);
        return `
          <section class="team-card ${teamHighlight === t.id ? 'flash' : ''}" id="team-${t.id}" style="--tc:${t.color}">
            <div class="team-card-head">
              <span class="team-emoji">${t.emoji}</span>
              <div><h3>${t.name}</h3><span class="muted small">Captain: ${t.captain}</span></div>
              <span class="team-rank">#${rankOf[t.id]}</span>
            </div>
            <div class="team-record">
              <span><b>${s.w}</b>W</span><span><b>${s.d}</b>D</span><span><b>${s.l}</b>L</span>
              <span class="sep"></span><span><b>${s.pts}</b> pts</span>
            </div>
            <div class="team-mini-stats">
              <span>🥅 ${tt.goals}</span><span>🎯 ${tt.assists}</span><span>🖐️ ${tt.steals}</span><span>🧱 ${tt.blocks}</span>
            </div>
            <ul class="roster-mini">
              ${roster.map((p) => `
                <li>
                  <span class="rm-name">${playerLink(p.id)}${p.name === t.captain ? ' <span class="cap">C</span>' : ''} ${levelTag(p.level)}</span>
                  <span class="rm-pos">${p.pos}</span>
                  <span class="rm-goals">${totals[p.id].goals}G</span>
                </li>`).join('')}
            </ul>
            <div class="team-next">${next ? `Next: ${fmtDate(next.date)} vs ${DB.teamName(next.home === t.id ? next.away : next.home)}` : 'Season complete'}</div>
          </section>`;
      }).join('')}
    </div>

    <section class="panel">
      <div class="panel-head"><h3>🧢 Free agents</h3><span class="muted small">guest into lineups</span></div>
      <div class="fa-grid">
        ${DB.freeAgents().map((p) => `
          <div class="fa-chip">${playerLink(p.id)} ${levelTag(p.level)}</div>`).join('')}
      </div>
    </section>
  `;

  if (teamHighlight) {
    const node = $(`#team-${teamHighlight}`);
    node?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setTimeout(() => node?.classList.remove('flash'), 1600);
    teamHighlight = null;
  }
}

/* =============================================================================
   ROSTER
   ============================================================================ */
let rosterSort = { key: 'rating', dir: -1 };
let rosterFilter = 'all';

function renderRoster() {
  const rated = DB.ratedPlayers();
  const cols = [
    ['rating', 'Rating'], ['name', 'Name'], ['teamId', 'Team'], ['level', 'Lvl'], ['pos', 'Pos'],
    ['goals', 'G'], ['assists', 'A'], ['steals', 'S'], ['blocks', 'B'], ['turnovers', 'TO'], ['matches', 'MP'],
  ];

  const draw = () => {
    let rows = rated.filter((p) =>
      rosterFilter === 'all' ? true : rosterFilter === 'fa' ? p.teamId === 'fa' : p.teamId === rosterFilter);
    const { key, dir } = rosterSort;
    rows = [...rows].sort((a, b) => {
      const av = a[key], bv = b[key];
      return typeof av === 'string' ? av.localeCompare(bv) * dir : (av - bv) * dir;
    });
    $('#roster-body').innerHTML = rows.map((p) => `
      <tr>
        <td>${p.matches ? `<span class="rating-badge">${p.rating}</span>` : '<span class="muted">—</span>'}</td>
        <td class="strong">${playerLink(p.playerId)}</td>
        <td>${teamPill(p.teamId)}</td>
        <td>${levelTag(p.level)}</td>
        <td><span class="pos-tag">${p.pos}</span></td>
        <td>${p.goals}</td><td>${p.assists}</td><td>${p.steals}</td>
        <td>${p.blocks}</td><td>${p.turnovers}</td><td>${p.matches}</td>
      </tr>`).join('');
  };

  view.innerHTML = `
    <div class="page-head"><h2>Player Roster</h2>
      <p class="muted">${rated.length} players · click a name for their profile · click a column to sort.</p></div>

    <div class="toolbar">
      <div class="seg" id="team-filter">
        <button class="seg-btn active" data-team="all">All</button>
        ${DB.teams.map((t) => `<button class="seg-btn" data-team="${t.id}">${t.emoji} ${t.name}</button>`).join('')}
        <button class="seg-btn" data-team="fa">🧢 Free agents</button>
      </div>
    </div>

    <section class="panel">
      <table class="tbl roster">
        <thead><tr>${cols.map(([k, l]) =>
          `<th data-key="${k}" class="sortable">${l}${k === 'rating' ? ' ' + infoIcon(ratingInfoHtml()) : ''}</th>`).join('')}</tr></thead>
        <tbody id="roster-body"></tbody>
      </table>
    </section>

    <section class="panel formula">
      <h3>🧮 How ratings are calculated</h3>
      <p>${DB.rating.describe}</p>
      <div class="weights">
        ${Object.entries(DB.rating.weights).map(([k, v]) =>
          `<span class="weight ${v < 0 ? 'neg' : ''}">${k}: ${v > 0 ? '+' : ''}${v}</span>`).join('')}
      </div>
    </section>
  `;

  $$('#team-filter .seg-btn').forEach((b) => b.addEventListener('click', () => {
    $$('#team-filter .seg-btn').forEach((x) => x.classList.remove('active'));
    b.classList.add('active'); rosterFilter = b.dataset.team; draw();
  }));
  $$('.roster th.sortable').forEach((th) => th.addEventListener('click', (e) => {
    if (e.target.closest('.info')) return; // don't sort when using info icon
    const key = th.dataset.key;
    rosterSort.dir = rosterSort.key === key ? -rosterSort.dir : -1;
    rosterSort.key = key;
    $$('.roster th').forEach((x) => x.classList.remove('sorted-asc', 'sorted-desc'));
    th.classList.add(rosterSort.dir === 1 ? 'sorted-asc' : 'sorted-desc');
    draw();
  }));
  draw();
}

/* =============================================================================
   SCHEDULE
   ============================================================================ */
function renderSchedule() {
  const byRound = {};
  DB.matches.forEach((m) => (byRound[m.round] = byRound[m.round] || []).push(m));

  view.innerHTML = `
    <div class="page-head"><h2>Schedule &amp; Results</h2>
      <p class="muted">Double round-robin · Sunday nights at ${DB.league.venue}</p></div>
    <div class="rounds">
      ${Object.keys(byRound).map((r) => {
        const games = byRound[r];
        const played = games.every((g) => g.status === 'final');
        return `<section class="panel round">
            <div class="panel-head"><h3>Round ${r}</h3>
              <span class="badge ${played ? 'done' : 'up'}">${played ? 'Final' : 'Upcoming'} · ${fmtDate(games[0].date)}</span></div>
            <div class="fixture-list">${games.map((g) => g.status === 'final' ? resultRow(g) : fixtureRow(g)).join('')}</div>
          </section>`;
      }).join('')}
    </div>`;
}

/* =============================================================================
   STATS (+ player spotlight tile)
   ============================================================================ */
let spotlightTeam = 'makos';
let spotlightPlayer = null;

function renderStats() {
  const rated = DB.ratedPlayers().filter((p) => p.matches > 0);
  const standings = DB.standings();
  const topScorers = [...rated].sort((a, b) => b.goals - a.goals).slice(0, 8);
  const topSteals = [...rated].sort((a, b) => b.steals - a.steals).slice(0, 8);

  view.innerHTML = `
    <div class="page-head"><h2>Stats Center</h2><p class="muted">League leaders, team comparisons, and a player spotlight.</p></div>

    <section class="panel spotlight">
      <div class="panel-head"><h3>🔦 Player spotlight</h3><span class="muted small">filter by roster</span></div>
      <div class="spot-controls">
        <div class="seg" id="spot-team">
          ${DB.teams.map((t) => `<button class="seg-btn" data-team="${t.id}">${t.emoji} ${t.name}</button>`).join('')}
          <button class="seg-btn" data-team="fa">🧢 Free agents</button>
        </div>
        <select id="spot-player" class="select"></select>
      </div>
      <div id="spot-body"></div>
    </section>

    <div class="grid-2">
      <section class="panel"><div class="panel-head"><h3>🥅 Top scorers</h3></div><div class="chart-wrap"><canvas id="c-scorers"></canvas></div></section>
      <section class="panel"><div class="panel-head"><h3>🖐️ Steals leaders</h3></div><div class="chart-wrap"><canvas id="c-steals"></canvas></div></section>
    </div>
    <div class="grid-2">
      <section class="panel"><div class="panel-head"><h3>🍩 Goal share by team</h3></div><div class="chart-wrap"><canvas id="c-share"></canvas></div></section>
      <section class="panel"><div class="panel-head"><h3>🕸️ Team profile</h3><span class="muted small">normalized 0–100</span></div>
        <div class="chart-wrap"><canvas id="c-radar"></canvas></div>
        <div class="radar-legend">
          ${TEAM_PROFILE_INDEX.map((d) => `<span class="rl-item" title="${d.desc}"><b>${d.key}</b></span>`).join('')}
        </div>
      </section>
    </div>
    <section class="panel"><div class="panel-head"><h3>📊 Points progression</h3></div><div class="chart-wrap"><canvas id="c-progress"></canvas></div></section>

    <section class="panel stat-index">
      <div class="panel-head"><h3>📖 Stat index</h3><span class="muted small">what each stat means &amp; how it’s figured</span></div>
      <div class="index-grid">
        <div class="index-col">
          <h4>Player box score</h4>
          <dl>${PLAYER_STAT_INDEX.map((s) => `<dt><span class="ix-key">${s.key}</span> ${s.name}</dt><dd>${s.desc}</dd>`).join('')}</dl>
        </div>
        <div class="index-col">
          <h4>Team &amp; standings</h4>
          <dl>${DB.glossary.map(([k, d]) => `<dt><span class="ix-key">${k}</span></dt><dd>${d}.</dd>`).join('')}
            <dt><span class="ix-key">Win pts</span></dt><dd>Win = 3, Draw = 1, Loss = 0. Standings sort by Pts, then GD, then GF.</dd>
          </dl>
        </div>
      </div>
      <div class="index-col wide">
        <h4>Rating</h4>
        <p class="muted">${DB.rating.describe}</p>
        <div class="weights">${Object.entries(DB.rating.weights).map(([k, v]) =>
          `<span class="weight ${v < 0 ? 'neg' : ''}">${k}: ${v > 0 ? '+' : ''}${v}</span>`).join('')}</div>
      </div>
      <div class="index-col wide">
        <h4>Team profile dimensions <span class="muted small">(radar — each axis normalized 0–100 across teams)</span></h4>
        <dl class="dim-dl">${TEAM_PROFILE_INDEX.map((d) => `<dt><span class="ix-key">${d.key}</span></dt><dd>${d.desc}</dd>`).join('')}</dl>
      </div>
      <div class="index-col wide">
        <h4>How the charts are built</h4>
        <ul class="chart-notes">
          <li><b>Top scorers / Steals leaders</b> — season totals summed from every final box score.</li>
          <li><b>Goal share</b> — each team’s Goals For as a slice of all goals scored.</li>
          <li><b>Team profile</b> — six dimensions (Attack, Defense, Playmaking, Steals, Blocks, Discipline) min-max normalized to 0–100 across the four teams, so the best on each axis reaches the rim.</li>
          <li><b>Points progression</b> — cumulative league points after each round.</li>
        </ul>
      </div>
    </section>
  `;

  ChartHub.bar('c-scorers', topScorers.map((p) => p.name),
    [{ label: 'Goals', data: topScorers.map((p) => p.goals), backgroundColor: topScorers.map((p) => teamColor(p.teamId)), borderRadius: 6 }], { indexAxis: 'y' });
  ChartHub.bar('c-steals', topSteals.map((p) => p.name),
    [{ label: 'Steals', data: topSteals.map((p) => p.steals), backgroundColor: topSteals.map((p) => teamColor(p.teamId)), borderRadius: 6 }], { indexAxis: 'y' });
  ChartHub.doughnut('c-share', standings.map((s) => DB.teamName(s.teamId)), standings.map((s) => s.gf), standings.map((s) => teamColor(s.teamId)));

  // Team profile: six dimensions, normalized 0–100 across teams so shapes differ.
  const axes = [
    ['Attack', (s, tt) => s.gf],
    ['Defense', (s, tt) => -s.ga],          // fewer goals against = better
    ['Playmaking', (s, tt) => tt.assists],
    ['Steals', (s, tt) => tt.steals],
    ['Blocks', (s, tt) => tt.blocks],
    ['Discipline', (s, tt) => -tt.turnovers], // fewer turnovers = better
  ];
  const teamMetrics = DB.teams.map((t) => {
    const s = standings.find((x) => x.teamId === t.id);
    const tt = DB.teamTotals(t.id);
    return { t, raw: axes.map(([, fn]) => fn(s, tt)) };
  });
  const scaled = axes.map((_, i) => {
    const vals = teamMetrics.map((m) => m.raw[i]);
    const min = Math.min(...vals), max = Math.max(...vals);
    return (v) => (max === min ? 60 : Math.round(15 + ((v - min) / (max - min)) * 85)); // 15..100
  });
  ChartHub.radar('c-radar', axes.map(([label]) => label),
    teamMetrics.map((m) => ({
      label: m.t.name,
      data: m.raw.map((v, i) => scaled[i](v)),
      borderColor: m.t.color, backgroundColor: m.t.color + '2e', pointBackgroundColor: m.t.color,
    })));

  const rounds = [...new Set(DB.finals().map((m) => m.round))].sort((a, b) => a - b);
  const running = {}; DB.teams.forEach((t) => (running[t.id] = 0));
  const series = {}; DB.teams.forEach((t) => (series[t.id] = []));
  rounds.forEach((r) => {
    DB.finals().filter((m) => m.round === r).forEach((m) => {
      if (m.homeScore > m.awayScore) running[m.home] += 3;
      else if (m.homeScore < m.awayScore) running[m.away] += 3;
      else { running[m.home]++; running[m.away]++; }
    });
    DB.teams.forEach((t) => series[t.id].push(running[t.id]));
  });
  ChartHub.line('c-progress', rounds.map((r) => `R${r}`),
    DB.teams.map((t) => ({ label: t.name, data: series[t.id], borderColor: t.color, backgroundColor: t.color + '22', tension: 0.3, fill: false })));

  // spotlight wiring
  const fillPlayers = () => {
    const list = DB.ratedPlayers().filter((p) => spotlightTeam === 'fa' ? p.teamId === 'fa' : p.teamId === spotlightTeam);
    spotlightPlayer = list[0] ? list[0].playerId : null;
    $('#spot-player').innerHTML = list.map((p) =>
      `<option value="${p.playerId}">${p.name}</option>`).join('');
    drawSpotlight();
  };
  $$('#spot-team .seg-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.team === spotlightTeam);
    b.addEventListener('click', () => {
      $$('#spot-team .seg-btn').forEach((x) => x.classList.remove('active'));
      b.classList.add('active'); spotlightTeam = b.dataset.team; fillPlayers();
    });
  });
  $('#spot-player').addEventListener('change', (e) => { spotlightPlayer = e.target.value; drawSpotlight(); });
  fillPlayers();
}

function drawSpotlight() {
  if (!spotlightPlayer) { $('#spot-body').innerHTML = '<p class="muted">No players.</p>'; return; }
  const p = DB.ratedPlayer(spotlightPlayer);
  const att = DB.attendancePct(p.playerId);
  const stat = (label, val) => `<div class="mini-stat"><span>${val}</span><small>${label}</small></div>`;
  $('#spot-body').innerHTML = `
    <div class="spot-card">
      <div class="spot-id">
        <div class="spot-avatar" style="--tc:${teamColor(p.teamId)}">${p.name[0]}</div>
        <div>
          <h4>${playerLink(p.playerId)} ${levelTag(p.level)}</h4>
          <p class="muted small">${teamBadge(p.teamId)} · ${p.pos}${att != null ? ` · ${att}% avail.` : ''}</p>
        </div>
        <div class="spot-rating">${p.matches ? p.rating : '—'}<small>rating</small></div>
      </div>
      <div class="mini-stats">
        ${stat('Goals', p.goals)}${stat('Assists', p.assists)}${stat('Steals', p.steals)}
        ${stat('Blocks', p.blocks)}${stat('Turnovers', p.turnovers)}${stat('Matches', p.matches)}
      </div>
      <div class="chart-wrap sm"><canvas id="c-spotlight"></canvas></div>
    </div>`;
  ChartHub.radar('c-spotlight', ['Goals', 'Assists', 'Steals', 'Blocks', 'Discipline'],
    [{ label: p.name, data: [p.goals, p.assists, p.steals, p.blocks, Math.max(0, 8 - p.turnovers)],
       borderColor: teamColor(p.teamId), backgroundColor: teamColor(p.teamId) + '33', pointBackgroundColor: teamColor(p.teamId) }]);
}

/* =============================================================================
   MEDIA
   ============================================================================ */
let mediaFilter = { team: 'all', q: '' };

function renderMedia() {
  const f = MEDIA.featured;
  const thumb = (hue) => `linear-gradient(135deg, hsl(${hue} 70% 45%), hsl(${(hue + 40) % 360} 65% 30%))`;

  view.innerHTML = `
    <div class="page-head"><h2>Media</h2><p class="muted">Featured footage and per-game clip folders.</p></div>

    <a class="featured" href="${f.url}" target="_blank" rel="noopener" style="background:${thumb(f.hue)}">
      <span class="media-tag">${f.tag}</span>
      <span class="play-lg">▶</span>
      <div class="featured-meta"><h3>${f.title}</h3><p>${f.desc}</p><span class="muted small">${f.source}</span></div>
    </a>

    <section class="panel">
      <div class="panel-head"><h3>🎞️ Game film</h3><span class="muted small">each tile opens that game’s clip folder</span></div>
      <div class="media-controls">
        <div class="seg" id="media-team">
          <button class="seg-btn ${mediaFilter.team === 'all' ? 'active' : ''}" data-team="all">All</button>
          ${DB.teams.map((t) => `<button class="seg-btn ${mediaFilter.team === t.id ? 'active' : ''}" data-team="${t.id}">${t.emoji} ${t.name}</button>`).join('')}
        </div>
        <input id="media-search" class="select search" type="search" placeholder="Search team or round (e.g. Makos, R5)…" value="${mediaFilter.q}" />
      </div>
      <div id="game-film" class="media-grid"></div>
    </section>

    <p class="muted small center">Clip folders resolve to <code>${MEDIA.filmBase}&lt;game&gt;/</code> — set <code>MEDIA.filmBase</code> in <code>js/content.js</code> to wherever your clips live.</p>
  `;

  const games = [...DB.matches].sort((a, b) => b.round - a.round);

  const draw = () => {
    const q = mediaFilter.q.trim().toLowerCase();
    const rows = games.filter((m) => {
      if (mediaFilter.team !== 'all' && m.home !== mediaFilter.team && m.away !== mediaFilter.team) return false;
      if (!q) return true;
      const hay = `${DB.teamName(m.home)} vs ${DB.teamName(m.away)} r${m.round} ${m.date}`.toLowerCase();
      return hay.split(/\s+/).some((w) => w.startsWith(q)) || hay.includes(q);
    });

    $('#game-film').innerHTML = rows.length ? rows.map((m) => {
      const slug = `r${m.round}-${m.home}-vs-${m.away}`;
      const href = `${MEDIA.filmBase}${slug}/`;
      const hueA = DB.team(m.home).color, hueB = DB.team(m.away).color;
      const scoreline = m.status === 'final'
        ? `<span class="game-score">${m.homeScore} – ${m.awayScore}</span>`
        : `<span class="game-score up">Upcoming</span>`;
      return `
        <a class="media-card game-card" href="${href}" target="_blank" rel="noopener" title="Open clip folder: ${slug}">
          <div class="media-thumb game-thumb" style="background:linear-gradient(135deg, ${hueA}, ${hueB})">
            <span class="media-tag">Round ${m.round}</span>
            ${scoreline}
            <span class="media-kind">📁</span>
          </div>
          <div class="media-body">
            <h4>${DB.teamName(m.home)} <em>vs</em> ${DB.teamName(m.away)}</h4>
            <div class="media-foot">
              <span class="game-teams">${teamTag(m.home)} ${teamTag(m.away)}</span>
              <span class="muted small">${fmtDate(m.date)}</span>
            </div>
          </div>
        </a>`;
    }).join('') : '<p class="muted">No games match your filter.</p>';
  };

  $$('#media-team .seg-btn').forEach((b) => b.addEventListener('click', () => {
    $$('#media-team .seg-btn').forEach((x) => x.classList.remove('active'));
    b.classList.add('active'); mediaFilter.team = b.dataset.team; draw();
  }));
  $('#media-search').addEventListener('input', (e) => { mediaFilter.q = e.target.value; draw(); });

  draw();
}

/* =============================================================================
   ATTENDANCE / AVAILABILITY
   ============================================================================ */
let attFilter = 'all';

function renderAttendance() {
  const nights = DB.availability.nights;
  const table = DB.availability.table;
  const statusMap = { in: ['In', 'in'], maybe: ['Maybe', 'maybe'], out: ['Out', 'out'] };

  view.innerHTML = `
    <div class="page-head"><h2>Attendance &amp; Availability</h2>
      <p class="muted">Who’s in for upcoming Sunday league nights at ${DB.league.venue}.</p></div>

    ${nights.length === 0 ? '<section class="panel"><p class="muted">No upcoming nights — season complete.</p></section>' : `
    <div class="att-summary">
      ${nights.map((d) => {
        const counts = { in: 0, maybe: 0, out: 0 };
        Object.values(table[d]).forEach((s) => counts[s]++);
        return `<div class="att-night">
            <div class="att-date">${fmtDate(d)}</div>
            <div class="att-counts">
              <span class="pill in">${counts.in} in</span>
              <span class="pill maybe">${counts.maybe} maybe</span>
              <span class="pill out">${counts.out} out</span>
            </div>
          </div>`;
      }).join('')}
    </div>

    <div class="toolbar">
      <div class="seg" id="att-filter">
        <button class="seg-btn active" data-team="all">All</button>
        ${DB.teams.map((t) => `<button class="seg-btn" data-team="${t.id}">${t.emoji} ${t.name}</button>`).join('')}
        <button class="seg-btn" data-team="fa">🧢 Free agents</button>
      </div>
    </div>

    <section class="panel">
      <table class="tbl att-table">
        <thead><tr><th class="lft">Player</th><th>Team</th>${nights.map((d) => `<th>${fmtDate(d)}</th>`).join('')}<th>Avail%</th></tr></thead>
        <tbody id="att-body"></tbody>
      </table>
    </section>`}
  `;

  if (!nights.length) return;

  const draw = () => {
    const players = DB.players.filter((p) => p.level !== 'Pro (IR)').filter((p) =>
      attFilter === 'all' ? true : attFilter === 'fa' ? p.teamId === 'fa' : p.teamId === attFilter);
    $('#att-body').innerHTML = players.map((p) => `
      <tr>
        <td class="lft strong">${playerLink(p.id)} ${levelTag(p.level)}</td>
        <td>${teamPill(p.teamId)}</td>
        ${nights.map((d) => {
          const [lbl, cls] = statusMap[table[d][p.id]];
          return `<td><span class="pill ${cls}">${lbl}</span></td>`;
        }).join('')}
        <td class="strong">${DB.attendancePct(p.id)}%</td>
      </tr>`).join('');
  };
  $$('#att-filter .seg-btn').forEach((b) => b.addEventListener('click', () => {
    $$('#att-filter .seg-btn').forEach((x) => x.classList.remove('active'));
    b.classList.add('active'); attFilter = b.dataset.team; draw();
  }));
  draw();
}

/* =============================================================================
   RULES & FAQ
   ============================================================================ */
function renderFaq() {
  view.innerHTML = `
    <div class="page-head"><h2>Rules &amp; FAQ</h2><p class="muted">How torpedo is played, and common questions.</p></div>
    <section class="panel">
      <div class="panel-head"><h3>📏 Rules of the game</h3></div>
      <div class="rules-grid">${RULES.map((r) => `<div class="rule"><h4>${r.title}</h4><p>${r.body}</p></div>`).join('')}</div>
    </section>
    <section class="panel">
      <div class="panel-head"><h3>❓ Frequently asked</h3></div>
      <div class="accordion">${FAQ.map((f, i) => `<details ${i === 0 ? 'open' : ''}><summary>${f.q}</summary><p>${f.a}</p></details>`).join('')}</div>
    </section>`;
}

/* =============================================================================
   RESEARCH
   ============================================================================ */
function renderResearch() {
  view.innerHTML = `
    <div class="page-head"><h2>Research Library</h2><p class="muted">Scientific studies relevant to UTL &amp; Underwater Rugby (UWR).</p></div>
    <section class="panel intro"><p>${RESEARCH.intro}</p></section>
    ${RESEARCH.categories.map((cat) => `
      <section class="panel">
        <div class="panel-head"><h3>${cat.name}</h3><span class="muted small">${cat.items.length} sources</span></div>
        <div class="study-list">
          ${cat.items.map((s) => `
            <article class="study">
              <div class="study-top"><span class="study-type">${s.type}</span><span class="study-year">${s.year}</span></div>
              <h4><a href="${s.url}" target="_blank" rel="noopener">${s.title}</a></h4>
              <p class="study-source">${s.source}</p>
              <p class="study-take">${s.takeaway}</p>
            </article>`).join('')}
        </div>
      </section>`).join('')}
    <section class="panel safety"><div class="panel-head"><h3>⚠️ Breath-hold safety</h3></div>
      <ul>${RESEARCH.safety.map((s) => `<li>${s}</li>`).join('')}</ul></section>`;
}

/* =============================================================================
   PLAYER PROFILE MODAL
   ============================================================================ */
function openProfile(id) {
  const p = DB.ratedPlayer(id);
  const log = DB.gameLog(id);
  const att = DB.attendancePct(id);
  const host = $('#profile-modal');
  const stat = (label, val) => `<div class="mini-stat"><span>${val}</span><small>${label}</small></div>`;

  $('#profile-card').innerHTML = `
    <div class="modal-head">
      <div class="prof-id">
        <div class="prof-avatar" style="--tc:${teamColor(p.teamId)}">${p.name[0]}</div>
        <div>
          <h2>${p.name} ${levelTag(p.level)}</h2>
          <p class="muted">${teamBadge(p.teamId)} · ${p.pos}${att != null ? ` · ${att}% availability` : ''}</p>
        </div>
      </div>
      <div class="prof-rating">${p.matches ? p.rating : '—'}<small>rating</small></div>
      <button class="icon-btn" id="profile-close" aria-label="Close">✕</button>
    </div>

    <div class="mini-stats">
      ${stat('Goals', p.goals)}${stat('Assists', p.assists)}${stat('Steals', p.steals)}
      ${stat('Blocks', p.blocks)}${stat('Turnovers', p.turnovers)}${stat('Matches', p.matches)}
    </div>

    <div class="prof-grid">
      <div class="chart-wrap sm"><canvas id="c-profile"></canvas></div>
      <div class="prof-log">
        <h4>Game log</h4>
        ${log.length ? `
        <table class="tbl gamelog">
          <thead><tr><th>R</th><th>Opp</th><th>Res</th><th>G</th><th>A</th><th>S</th><th>B</th><th>TO</th></tr></thead>
          <tbody>${log.map((g) => `
            <tr>
              <td>${g.round}</td>
              <td>${teamBadge(g.opp)}${g.guest ? ' <span class="guest">guest</span>' : ''}</td>
              <td><span class="res ${g.result}">${g.result} ${g.gf}-${g.ga}</span></td>
              <td>${g.goals}</td><td>${g.assists}</td><td>${g.steals}</td><td>${g.blocks}</td><td>${g.turnovers}</td>
            </tr>`).join('')}</tbody>
        </table>` : '<p class="muted">No league matches played yet this season.</p>'}
      </div>
    </div>
  `;

  wrapTables($('#profile-card'));
  host.hidden = false;
  document.body.style.overflow = 'hidden';
  $('#profile-close').addEventListener('click', closeProfile);

  if (p.matches) {
    ChartHub.radar('c-profile', ['Goals', 'Assists', 'Steals', 'Blocks', 'Discipline'],
      [{ label: p.name, data: [p.goals, p.assists, p.steals, p.blocks, Math.max(0, 8 - p.turnovers)],
         borderColor: teamColor(p.teamId), backgroundColor: teamColor(p.teamId) + '33', pointBackgroundColor: teamColor(p.teamId) }]);
  }
}
function closeProfile() {
  $('#profile-modal').hidden = true;
  document.body.style.overflow = '';
  ChartHub.destroy('c-profile');
}

/* =============================================================================
   ROUTER + THEMING + GLOBAL CLICK DELEGATION
   ============================================================================ */
const ROUTES = {
  dashboard: renderDashboard, teams: renderTeams, roster: renderRoster,
  schedule: renderSchedule, stats: renderStats, media: renderMedia,
  attendance: renderAttendance, research: renderResearch, faq: renderFaq,
};

function go(tab) {
  $$('#tabs .tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  (ROUTES[tab] || renderDashboard)();
  wrapTables(view);
  $('#tabs').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  try { localStorage.setItem('atxutl.tab', tab); } catch (e) {}
}

function initClicks() {
  document.body.addEventListener('click', (e) => {
    const pl = e.target.closest('[data-player]');
    if (pl) { openProfile(pl.dataset.player); return; }
    const tm = e.target.closest('[data-team]');
    if (tm && !tm.classList.contains('seg-btn')) { teamHighlight = tm.dataset.team; go('teams'); return; }
  });
  $('#profile-modal').addEventListener('click', (e) => { if (e.target.id === 'profile-modal') closeProfile(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeProfile(); });
}

function initTabs() {
  $$('#tabs .tab-btn').forEach((b) => b.addEventListener('click', () => go(b.dataset.tab)));
  $('#menu-toggle')?.addEventListener('click', () => $('#tabs').classList.toggle('open'));
}

function applyTheme() {
  let theme = 'dark', preset = 'aqua';
  try { theme = localStorage.getItem('atxutl.theme') || 'dark'; preset = localStorage.getItem('atxutl.preset') || 'aqua'; } catch (e) {}
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.preset = preset;
  $('#theme-toggle').textContent = theme === 'dark' ? '🌙' : '☀️';
  $$('.preset-picker .chip').forEach((c) => c.classList.toggle('active', c.dataset.preset === preset));
}
function initTheme() {
  $('#theme-toggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('atxutl.theme', next); } catch (e) {}
    applyTheme();
    go(localStorage.getItem('atxutl.tab') || 'dashboard');
  });
  $$('.preset-picker .chip').forEach((c) => c.addEventListener('click', () => {
    try { localStorage.setItem('atxutl.preset', c.dataset.preset); } catch (e) {}
    applyTheme();
  }));
}

/* ---------- boot ---------------------------------------------------------- */
applyTheme();
initTabs();
initTheme();
initClicks();
$('#brand-sub').textContent = DB.league.full;
$('#footer-venue').textContent = DB.league.venue;
let startTab = 'dashboard';
try { startTab = localStorage.getItem('atxutl.tab') || 'dashboard'; } catch (e) {}
go(startTab);
