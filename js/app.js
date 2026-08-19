/* =============================================================================
   ATX UTL — App: routing, theming, and all tab renderers.
   Reads exclusively from window.DB / RULES / FAQ / RESEARCH / MEDIA.
   ============================================================================ */

const view = document.getElementById('view');
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let teamHighlight = null; // set when navigating via a team link
let scrollTarget = null;  // CSS selector to scroll to after tab change

/* ---------- small helpers ------------------------------------------------- */
const teamColor = (id) => (DB.team(id) || {}).color || '#94a3b8';
const fmtDate = (iso) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const diff = (n) => (n > 0 ? `+${n}` : `${n}`);

function teamPill(id) {
  if (id === 'fa') return `<span class="team-pill fa">Free Agent</span>`;
  const t = DB.team(id);
  return `<button class="team-pill link" data-team="${id}" style="--tc:${t.color}">${t.name}</button>`;
}
const teamBadge = (id) => (id === 'fa' ? 'Free Agent' : DB.team(id).name);

function teamTag(id) {
  if (id === 'fa') return `<span class="team-tag">Free Agent</span>`;
  const t = DB.team(id);
  return `<span class="team-tag" style="--tc:${t.color}">${t.name}</span>`;
}
function playerLink(id, label) {
  const p = DB.player(id);
  return `<button class="plink" data-player="${id}">${label || p.name}</button>`;
}
function levelTag(level) {
  const cls = level === 'Rookie' ? 'rookie' : level.includes('IR') ? 'ir' : 'pro';
  return `<span class="lvl-tag ${cls}">${level}</span>`;
}
function playerPos(p, matches) {
  const mp = matches ?? p.matches ?? 0;
  return mp > 0 ? p.pos : '';
}
function posTag(p, matches) {
  const pos = playerPos(p, matches);
  return pos ? `<span class="pos-tag">${pos}</span>` : '<span class="muted">—</span>';
}
function posSuffix(p) {
  return p.matches ? ` · ${p.pos}` : '';
}
function infoIcon(html) {
  return `<span class="info"><button type="button" class="info-i" aria-label="More info" aria-expanded="false">ⓘ</button><span class="info-pop" role="tooltip">${html}</span></span>`;
}

function closeAllInfoPops(except) {
  $$('.info-pop.is-open').forEach((pop) => {
    if (except && pop === except) return;
    pop.classList.remove('is-open');
    const btn = pop.previousElementSibling;
    if (btn?.classList?.contains('info-i')) btn.setAttribute('aria-expanded', 'false');
  });
}

function positionInfoPop(info) {
  const pop = info.querySelector('.info-pop');
  const icon = info.querySelector('.info-i');
  if (!pop || !icon) return;
  pop.classList.add('is-open');
  icon.setAttribute('aria-expanded', 'true');

  const pad = 12;
  // Measure after display so size is correct
  const ir = icon.getBoundingClientRect();
  const pw = pop.offsetWidth;
  const ph = pop.offsetHeight;
  let left = ir.left + ir.width / 2 - pw / 2;
  let top = ir.bottom + 8;

  if (left + pw > window.innerWidth - pad) left = window.innerWidth - pad - pw;
  if (left < pad) left = pad;

  if (top + ph > window.innerHeight - pad) top = ir.top - ph - 8;
  if (top < pad) top = pad;

  pop.style.left = `${Math.round(left)}px`;
  pop.style.top = `${Math.round(top)}px`;
}

function bindInfoPops(root = document) {
  $$('.info', root).forEach((info) => {
    if (info.dataset.bound) return;
    info.dataset.bound = '1';
    const icon = info.querySelector('.info-i');
    const pop = info.querySelector('.info-pop');
    if (!icon || !pop) return;
    let hideTimer = null;

    const show = () => {
      clearTimeout(hideTimer);
      closeAllInfoPops(pop);
      positionInfoPop(info);
    };
    const hide = () => {
      pop.classList.remove('is-open');
      icon.setAttribute('aria-expanded', 'false');
    };
    const scheduleHide = () => {
      if (!window.matchMedia('(hover: hover)').matches) return;
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hide, 140);
    };

    icon.addEventListener('mouseenter', () => {
      if (window.matchMedia('(hover: hover)').matches) show();
    });
    pop.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    info.addEventListener('mouseleave', scheduleHide);
    pop.addEventListener('mouseleave', scheduleHide);
    icon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (pop.classList.contains('is-open')) hide();
      else show();
    });
  });
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
  bindInfoPops(root);
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
  // Golden Torpedo: Goals×2 + Assists×1 (goals weighted higher)
  const topScorer = [...rated].sort((a, b) =>
    DB.torpedoScore(b) - DB.torpedoScore(a) || b.goals - a.goals)[0];
  // Golden Glove: Blocks×2 + Steals×1 (blocks weighted higher)
  const topDefense = [...rated].sort((a, b) =>
    DB.gloveScore(b) - DB.gloveScore(a) || b.blocks - a.blocks)[0];

  const cards = [
    { icon: '🎮', label: 'Matches played', value: finals.length, sub: `${upcoming.length} upcoming` },
    { icon: '🥅', label: 'Total goals', value: totalGoals, sub: finals.length ? `${(totalGoals / finals.length).toFixed(1)} per game` : 'Season not started' },
    {
      icon: '⭐', label: 'Top rated', info: ratingInfoHtml(),
      value: leader ? playerLink(leader.playerId) : '—',
      sub: leader ? `${teamBadge(leader.teamId)} · ${leader.rating}/10` : 'No games yet',
    },
    {
      icon: '🔥', label: 'Golden Torpedo', info: goldenTorpedoInfoHtml(),
      value: topScorer ? playerLink(topScorer.playerId) : '—',
      sub: topScorer ? `${topScorer.goals} goals · ${topScorer.assists} assists` : 'No offense yet',
    },
    {
      icon: '🧤', label: 'Golden Glove', info: goldenGloveInfoHtml(),
      value: topDefense ? playerLink(topDefense.playerId) : '—',
      sub: topDefense ? `${topDefense.steals} steals · ${topDefense.blocks} blocks` : 'No defense yet',
    },
  ];

  view.innerHTML = `
    <div class="page-head">
      <h2>${DB.league.season} Overview</h2>
      <p class="muted">Starts ${fmtDate(DB.league.startDate)} · ${DB.league.weeks} weeks</p>
    </div>

    <div class="stat-cards">
      ${cards.map((c) => `
        <div class="stat-card">
          <div class="stat-icon">${c.icon}</div>
          <div class="stat-body">
            <div class="stat-value">${c.value}</div>
            <div class="stat-label">${c.label}${c.info ? ' ' + infoIcon(c.info) : ''}</div>
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
          <button class="text-link" data-goto="teams" data-scroll="#full-roster">View roster →</button>
        </div>
        <ul class="leader-list">
          ${rated.length ? rated.slice(0, 7).map((p, i) => `
            <li>
              <span class="lead-rank">${i + 1}</span>
              <span class="lead-name">${playerLink(p.playerId)}<small>${teamBadge(p.teamId)}</small></span>
              <span class="lead-stat">${p.goals}G · ${p.assists}A</span>
              <span class="rating-badge">${p.rating}</span>
            </li>`).join('') : '<li class="muted">No games played yet. <button class="text-link" data-goto="teams" data-scroll="#full-roster">See roster →</button></li>'}
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
        <div class="fixture-list">${finals.length ? [...finals].slice(-4).reverse().map(resultRow).join('') : '<p class="muted">No results yet.</p>'}</div>
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
function goldenTorpedoInfoHtml() {
  const w = DB.awards.torpedo;
  return '<b>Golden Torpedo</b>' +
    '<span class="gl">Awarded to the league’s top offensive player for the season.</span>' +
    `<span class="gl"><b>How it’s calculated</b> — Offense score = Goals×${w.goals} + Assists×${w.assists}. Highest score wins; ties break by Goals.</span>` +
    '<span class="gl">Goals are weighted higher so finishers lead, but playmakers still climb the board with assists.</span>';
}
function goldenGloveInfoHtml() {
  const w = DB.awards.glove;
  return '<b>Golden Glove</b>' +
    '<span class="gl">Awarded to the league’s top defensive player for the season.</span>' +
    `<span class="gl"><b>How it’s calculated</b> — Defense score = Blocks×${w.blocks} + Steals×${w.steals}. Highest score wins; ties break by Blocks.</span>` +
    '<span class="gl">Blocks are weighted higher so shot-stoppers lead, but takeaways still count toward the award.</span>';
}

function fixtureRow(m) {
  return `<div class="fixture">
      <span class="fx-date">${fmtDate(m.date)} · W${m.round}</span>
      <span class="fx-teams">${teamPill(m.home)} <em>vs</em> ${teamPill(m.away)}</span>
    </div>`;
}
function resultRow(m) {
  const hw = m.homeScore > m.awayScore, aw = m.awayScore > m.homeScore;
  return `<div class="fixture">
      <span class="fx-date">${fmtDate(m.date)} · W${m.round}</span>
      <span class="fx-teams">${teamPill(m.home)}
        <b class="score ${hw ? 'win' : ''}">${m.homeScore}</b><em>–</em><b class="score ${aw ? 'win' : ''}">${m.awayScore}</b>
        ${teamPill(m.away)}</span>
    </div>`;
}

/* =============================================================================
   TEAMS & ROSTER
   ============================================================================ */
let rosterSort = { key: 'rating', dir: -1 };
let rosterView = 'season5'; // 'season5' | 'overall'

function renderTeamsRoster() {
  const standings = DB.standings();
  const rankOf = {}; standings.forEach((s, i) => (rankOf[s.teamId] = i + 1));
  const totals = DB.playerTotals();
  const seasonRated = DB.ratedPlayers();
  const careerRated = DB.ratedCareerPlayers();
  const season5Count = DB.season5Roster().length;

  const colsFor = (view) => [
    ['rating', 'Rating'], ['name', 'Name'],
    ...(view === 'season5' ? [['teamId', 'Team']] : []),
    ['level', 'Lvl'], ['pos', 'Pos'],
    ['goals', 'G'], ['assists', 'A'], ['steals', 'S'], ['blocks', 'B'], ['turnovers', 'TO'],
    ['swimOffs', 'SO'], ['shots', 'SH'], ['matches', 'MP'],
  ];

  const bindSort = () => {
    $$('.roster th.sortable').forEach((th) => th.addEventListener('click', (e) => {
      if (e.target.closest('.info')) return;
      const key = th.dataset.key;
      rosterSort.dir = rosterSort.key === key ? -rosterSort.dir : -1;
      rosterSort.key = key;
      $$('.roster th').forEach((x) => x.classList.remove('sorted-asc', 'sorted-desc'));
      th.classList.add(rosterSort.dir === 1 ? 'sorted-asc' : 'sorted-desc');
      draw();
    }));
  };

  const draw = () => {
    const seasonView = rosterView === 'season5';
    const cols = colsFor(rosterView);
    // If current sort key isn't in this view (e.g. teamId on overall), fall back
    if (!cols.some(([k]) => k === rosterSort.key)) rosterSort = { key: 'rating', dir: -1 };

    const { key, dir } = rosterSort;
    // Season 5 = current-season stats; Overall = all-seasons career stats (no team col)
    let rows = seasonView
      ? seasonRated.filter((p) => DB.isSeason5(p.playerId))
      : careerRated;
    rows = [...rows].sort((a, b) => {
      const av = a[key], bv = b[key];
      return typeof av === 'string' ? av.localeCompare(bv) * dir : (av - bv) * dir;
    });

    $('#roster-head').innerHTML = `<tr>${cols.map(([k, l]) => {
      const sorted = k === rosterSort.key
        ? (rosterSort.dir === 1 ? ' sorted-asc' : ' sorted-desc') : '';
      return `<th data-key="${k}" class="sortable${sorted}">${l}${k === 'rating' ? ' ' + infoIcon(ratingInfoHtml()) : ''}</th>`;
    }).join('')}</tr>`;

    $('#roster-body').innerHTML = rows.map((p) => `
      <tr>
        <td>${p.matches ? `<span class="rating-badge">${p.rating}</span>` : '<span class="muted">—</span>'}</td>
        <td class="strong">${playerLink(p.playerId)}</td>
        ${seasonView ? `<td>${teamPill(p.teamId)}</td>` : ''}
        <td>${levelTag(p.level)}</td>
        <td>${posTag(p)}</td>
        <td>${p.goals}</td><td>${p.assists}</td><td>${p.steals}</td>
        <td>${p.blocks}</td><td>${p.turnovers}</td>
        <td>${p.swimOffs}</td><td>${p.shots}</td><td>${p.matches}</td>
      </tr>`).join('');

    const title = seasonView ? '🌊 Season 5 roster' : '👤 Overall roster';
    const meta = seasonView
      ? `${season5Count} players · Season 5 stats`
      : `${careerRated.length} players · all-seasons stats · no team affiliation`;
    $('#roster-title').textContent = title;
    $('#roster-meta').textContent = meta;

    $$('#roster-view-toggle .seg-btn').forEach((b) =>
      b.classList.toggle('active', b.dataset.view === rosterView));

    bindSort();
    wrapTables($('#full-roster'));
  };

  view.innerHTML = `
    <div class="page-head">
      <h2>Teams &amp; Roster</h2>
      <p class="muted">Season 5 stats or all-time career totals — toggle below.</p>
    </div>

    <div class="team-grid">
      ${DB.teams.map((t) => {
        const s = standings.find((x) => x.teamId === t.id);
        const roster = DB.rosterOf(t.id);
        const next = DB.nextGameFor(t.id);
        const tt = DB.teamTotals(t.id);
        return `
          <section class="team-card ${teamHighlight === t.id ? 'flash' : ''}" id="team-${t.id}" style="--tc:${t.color}">
            <div class="team-card-head">
              <div><h3>${t.name}</h3><span class="muted small">Captain: ${t.captain}</span></div>
              <span class="team-rank">#${rankOf[t.id]}</span>
            </div>
            <div class="team-record">
              <span><b>${s.w}</b>W</span><span><b>${s.d}</b>D</span><span><b>${s.l}</b>L</span>
              <span class="sep"></span><span><b>${s.pts}</b> pts</span>
            </div>
            <div class="team-mini-stats">
              <span>🥅 ${tt.goals}</span><span>🅰️ ${tt.assists}</span><span>🖐️ ${tt.steals}</span>
              <span>🧱 ${tt.blocks}</span><span>🏁 ${tt.swimOffs} SO</span><span>🏹 ${tt.shots} SH</span>
            </div>
            <ul class="roster-mini">
              ${roster.map((p) => `
                <li>
                  <span class="rm-name">${playerLink(p.id)}${p.name === t.captain ? ' <span class="cap">C</span>' : ''} ${levelTag(p.level)}</span>
                  <span class="rm-pos">${playerPos(p, totals[p.id].matches) || '—'}</span>
                  <span class="rm-goals">${totals[p.id].goals}G</span>
                </li>`).join('')}
            </ul>
            <div class="team-next">${next ? `Next: ${fmtDate(next.date)} vs ${DB.teamName(next.home === t.id ? next.away : next.home)}` : 'Season complete'}</div>
          </section>`;
      }).join('')}
    </div>

    <section class="panel formula">
      <h3>🧮 How ratings are calculated</h3>
      <p>${DB.rating.describe}</p>
      <div class="weights">
        ${Object.entries(DB.rating.weights).map(([k, v]) =>
          `<span class="weight ${v < 0 ? 'neg' : ''}">${k}: ${v > 0 ? '+' : ''}${v}</span>`).join('')}
      </div>
    </section>

    <div class="toolbar">
      <div class="seg" id="roster-view-toggle">
        <button class="seg-btn" data-view="season5">Season 5</button>
        <button class="seg-btn" data-view="overall">Overall</button>
      </div>
    </div>

    <section class="panel" id="full-roster">
      <div class="panel-head">
        <h3 id="roster-title"></h3>
        <span class="muted small" id="roster-meta"></span>
      </div>
      <table class="tbl roster">
        <thead id="roster-head"></thead>
        <tbody id="roster-body"></tbody>
      </table>
    </section>
  `;

  if (teamHighlight) {
    const node = $(`#team-${teamHighlight}`);
    node?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setTimeout(() => node?.classList.remove('flash'), 1600);
    teamHighlight = null;
  }

  $$('#roster-view-toggle .seg-btn').forEach((b) => b.addEventListener('click', () => {
    rosterView = b.dataset.view;
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
    <div class="page-head"><h2>Schedule &amp; Results</h2></div>
    <div class="rounds">
      ${Object.keys(byRound).map((r) => {
        const games = byRound[r];
        const played = games.every((g) => g.status === 'final');
        return `<section class="panel round">
            <div class="panel-head"><h3>Week ${r}</h3>
              <span class="badge ${played ? 'done' : 'up'}">${played ? 'Final' : 'Upcoming'} · ${fmtDate(games[0].date)}</span></div>
            <div class="fixture-list">${games.map((g) => g.status === 'final' ? resultRow(g) : fixtureRow(g)).join('')}</div>
          </section>`;
      }).join('')}
    </div>`;
}

/* =============================================================================
   STATS (+ player spotlight tile)
   ============================================================================ */
let spotlightTeam = 'capybara';
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
          ${DB.teams.map((t) => `<button class="seg-btn" data-team="${t.id}">${t.name}</button>`).join('')}
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
          <li><b>Points progression</b> — cumulative league points after each week.</li>
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
  ChartHub.line('c-progress', rounds.map((r) => `W${r}`),
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
          <p class="muted small">${teamBadge(p.teamId)}${posSuffix(p)}${att != null ? ` · ${att}% avail.` : ''}</p>
        </div>
        <div class="spot-rating">${p.matches ? p.rating : '—'}<small>rating</small></div>
      </div>
      <div class="mini-stats">
        ${stat('Goals', p.goals)}${stat('Assists', p.assists)}${stat('Steals', p.steals)}
        ${stat('Blocks', p.blocks)}${stat('Turnovers', p.turnovers)}${stat('Swim-offs', p.swimOffs)}
        ${stat('Shots', p.shots)}${stat('Matches', p.matches)}
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
    <div class="page-head"><h2>Media</h2></div>

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
          ${DB.teams.map((t) => `<button class="seg-btn ${mediaFilter.team === t.id ? 'active' : ''}" data-team="${t.id}">${t.name}</button>`).join('')}
        </div>
        <input id="media-search" class="select search" type="search" placeholder="Search team or week (e.g. Capybara, W5)…" value="${mediaFilter.q}" />
      </div>
      <div id="game-film" class="media-grid"></div>
    </section>

    <p class="muted small center">Clip folders resolve to <code>${MEDIA.filmBase}&lt;game&gt;/</code> — set <code>MEDIA.filmBase</code> in <code>js/content.js</code> to wherever your clips live.</p>
  `;

  const games = [...DB.matches].sort((a, b) => a.round - b.round || a.id.localeCompare(b.id));

  const draw = () => {
    const q = mediaFilter.q.trim().toLowerCase();
    const rows = games.filter((m) => {
      if (mediaFilter.team !== 'all' && m.home !== mediaFilter.team && m.away !== mediaFilter.team) return false;
      if (!q) return true;
      const hay = `${DB.teamName(m.home)} vs ${DB.teamName(m.away)} w${m.round} r${m.round} ${m.date}`.toLowerCase();
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
            <span class="media-tag">Week ${m.round}</span>
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
let attUnsub = null;

function renderAttendance() {
  const statusMap = { in: ['In', 'in'], maybe: ['Maybe', 'maybe'], out: ['Out', 'out'] };
  const seasonPlayers = () => DB.season5Roster().filter((p) => p.level !== 'Pro (IR)');
  const nights = () => DB.availability.nights;

  view.innerHTML = `
    <div class="page-head">
      <h2>Attendance &amp; Availability</h2>
      <p class="muted">Season 5 roster — tap a status to update. Changes sync live for everyone.</p>
    </div>
    <p id="att-live-msg" class="draft-msg"></p>

    <div id="att-empty" class="panel" hidden><p class="muted">No upcoming nights — season complete.</p></div>
    <div id="att-live" hidden>
      <div class="att-summary" id="att-summary"></div>
      <div class="toolbar">
        <div class="seg" id="att-filter">
          <button class="seg-btn" data-team="all">All</button>
          ${DB.teams.map((t) => `<button class="seg-btn" data-team="${t.id}">${t.name}</button>`).join('')}
          <button class="seg-btn" data-team="fa">🧢 Free agents</button>
        </div>
      </div>
      <section class="panel">
        <table class="tbl att-table">
          <thead><tr></tr></thead>
          <tbody id="att-body"></tbody>
        </table>
      </section>
    </div>
  `;

  const setMsg = (text, cls = '') => {
    const el = $('#att-live-msg');
    if (!el) return;
    el.className = `draft-msg ${cls}`.trim();
    el.textContent = text || '';
  };

  const paintConn = () => {
    const st = AttendanceHub.status();
    if (st.connectionError) {
      setMsg(`Live sync issue: ${st.connectionError} — changes may stay on this device only.`, 'err');
    } else if (st.mode === 'firebase' && st.connected) {
      setMsg('Live — updates save for everyone.', 'ok');
    } else if (st.mode === 'firebase') {
      setMsg('Connecting to live attendance…');
    } else {
      setMsg('Offline mode — availability is saved on this device only.', 'err');
    }
  };

  const paint = () => {
    if (!$('#att-live-msg')) return;
    const ns = nights();
    const playersAll = seasonPlayers();
    paintConn();

    if (!ns.length) {
      if ($('#att-empty')) $('#att-empty').hidden = false;
      if ($('#att-live')) $('#att-live').hidden = true;
      return;
    }
    if ($('#att-empty')) $('#att-empty').hidden = true;
    if ($('#att-live')) $('#att-live').hidden = false;
    if (!$('#att-body')) return;

    $('#att-summary').innerHTML = ns.map((d) => {
      const counts = { in: 0, maybe: 0, out: 0 };
      playersAll.forEach((p) => {
        const s = AttendanceHub.statusFor(d, p.id);
        if (counts[s] != null) counts[s]++;
      });
      return `<div class="att-night">
          <div class="att-date">${fmtDate(d)}</div>
          <div class="att-counts">
            <span class="pill in">${counts.in} in</span>
            <span class="pill maybe">${counts.maybe} maybe</span>
            <span class="pill out">${counts.out} out</span>
          </div>
        </div>`;
    }).join('');

    const headRow = $('#att-live thead tr');
    if (headRow) {
      headRow.innerHTML = `<th class="lft">Player</th><th>Team</th>${ns.map((d) => `<th>${fmtDate(d)}</th>`).join('')}<th>Avail%</th>`;
    }

    $$('#att-filter .seg-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.team === attFilter);
    });

    const players = playersAll.filter((p) =>
      attFilter === 'all' ? true : attFilter === 'fa' ? p.teamId === 'fa' : p.teamId === attFilter);

    $('#att-body').innerHTML = players.map((p) => `
      <tr>
        <td class="lft strong">${playerLink(p.id)} ${levelTag(p.level)}</td>
        <td>${teamPill(p.teamId)}</td>
        ${ns.map((d) => {
          const status = AttendanceHub.statusFor(d, p.id);
          const [lbl, cls] = statusMap[status];
          return `<td><button type="button" class="pill ${cls} att-toggle" data-att-player="${p.id}" data-date="${d}" title="Click to cycle In / Maybe / Out">${lbl}</button></td>`;
        }).join('')}
        <td class="strong">${DB.attendancePct(p.id)}%</td>
      </tr>`).join('');

    $$('#att-body .att-toggle').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          btn.disabled = true;
          await AttendanceHub.cycle(btn.dataset.attPlayer, btn.dataset.date);
        } catch (e) {
          setMsg(e.message || String(e), 'err');
        } finally {
          btn.disabled = false;
        }
      });
    });
  };

  $$('#att-filter .seg-btn').forEach((b) => b.addEventListener('click', () => {
    attFilter = b.dataset.team;
    paint();
  }));

  if (attUnsub) attUnsub();
  attUnsub = AttendanceHub.onChange(() => paint());
  paint();
}

/* =============================================================================
   RULES & FAQ
   ============================================================================ */
function renderFaq() {
  view.innerHTML = `
    <div class="page-head"><h2>Rules &amp; FAQ</h2><p class="muted">How torpedo is played, common questions, and the research library.</p></div>
    <section class="panel">
      <div class="panel-head"><h3>📏 Rules of the game</h3></div>
      <div class="rules-grid">${RULES.map((r) => `<div class="rule"><h4>${r.title}</h4><p>${r.body}</p></div>`).join('')}</div>
    </section>
    <section class="panel">
      <div class="panel-head"><h3>❓ Frequently asked</h3></div>
      <div class="accordion">${FAQ.map((f, i) => `<details ${i === 0 ? 'open' : ''}><summary>${f.q}</summary><p>${f.a}</p></details>`).join('')}</div>
    </section>
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
          <h2>${p.name} ${levelTag(p.level)}${DB.isSeason5(p.playerId) ? ' <span class="s5-tag">S5</span>' : ''}</h2>
          <p class="muted">${DB.isSeason5(p.playerId) ? teamBadge(p.teamId) : 'ATX roster'}${posSuffix(p)}${att != null ? ` · ${att}% availability` : ''}</p>
        </div>
      </div>
      <div class="prof-rating">${p.matches ? p.rating : '—'}<small>rating</small></div>
      <button class="icon-btn" id="profile-close" aria-label="Close">✕</button>
    </div>

    <div class="mini-stats">
      ${stat('Goals', p.goals)}${stat('Assists', p.assists)}${stat('Steals', p.steals)}
      ${stat('Blocks', p.blocks)}${stat('Turnovers', p.turnovers)}${stat('Swim-offs', p.swimOffs)}
      ${stat('Shots', p.shots)}${stat('Matches', p.matches)}
    </div>

    <div class="prof-grid">
      <div class="chart-wrap sm"><canvas id="c-profile"></canvas></div>
      <div class="prof-log">
        <h4>Game log</h4>
        ${log.length ? `
        <table class="tbl gamelog">
          <thead><tr><th>W</th><th>Opp</th><th>Res</th><th>G</th><th>A</th><th>S</th><th>B</th><th>TO</th><th>SO</th><th>SH</th></tr></thead>
          <tbody>${log.map((g) => `
            <tr>
              <td>${g.round}</td>
              <td>${teamBadge(g.opp)}${g.guest ? ' <span class="guest">guest</span>' : ''}</td>
              <td><span class="res ${g.result}">${g.result} ${g.gf}-${g.ga}</span></td>
              <td>${g.goals}</td><td>${g.assists}</td><td>${g.steals}</td><td>${g.blocks}</td><td>${g.turnovers}</td>
              <td>${g.swimOffs || 0}</td><td>${g.shots || 0}</td>
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
   DRAFT (Firebase live draft)
   ============================================================================ */
let draftUnsub = null;
let draftClockTimer = null;

function formatClock(ms) {
  if (ms == null) return '--:--';
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function renderDraft() {
  const pinVal = () => ($('#draft-pin')?.value || '').trim();
  const setMsg = (sel, text, cls = '') => {
    const el = $(sel);
    if (!el) return;
    el.className = `draft-msg ${cls}`.trim();
    el.textContent = text || '';
  };

  const boardOrder = () => {
    const order = DraftHub.draftTeamOrder();
    return order.map((id) => DB.team(id)).filter(Boolean);
  };

  const paintClock = () => {
    const st = DraftHub.status();
    const clock = $('#draft-clock');
    if (!clock) return;
    if (st.draft?.status === 'live' && st.turnRemainingMs != null) {
      clock.textContent = formatClock(st.turnRemainingMs);
      clock.dataset.expired = st.turnRemainingMs <= 0 ? '1' : '0';
      clock.hidden = false;
    } else {
      clock.textContent = '--:--';
      clock.dataset.expired = '0';
      clock.hidden = st.draft?.status !== 'live';
    }
  };

  const paint = () => {
    const st = DraftHub.status();
    const d = st.draft || DraftHub.defaultDraft();
    const teamName = (id) => DB.teamName(id);
    const currentTeamId = st.currentTeamId;
    const pool = d.pool || [];
    const picks = d.picks || [];
    const ready = d.ready || {};

    if ($('#draft-status-pill')) {
      const label = d.status === 'waiting' ? 'waiting for captains' : (d.status || 'waiting');
      $('#draft-status-pill').textContent = label;
      $('#draft-status-pill').dataset.state = d.status || 'waiting';
    }
    if ($('#draft-turn')) {
      if (d.status === 'live' && currentTeamId) {
        const t = DB.team(currentTeamId);
        $('#draft-turn').innerHTML =
          `On the clock: <b>${teamName(currentTeamId)}</b> (${t?.captain || 'Captain'}) · pick #${(d.pickIndex || 0) + 1}`;
      } else if (d.status === 'done') {
        $('#draft-turn').textContent = 'Draft complete';
      } else if (d.status === 'waiting') {
        const pending = DraftHub.draftTeamOrder()
          .filter((id) => !ready[id])
          .map((id) => DB.team(id)?.captain || id);
        $('#draft-turn').textContent = pending.length
          ? `Waiting on: ${pending.join(', ')}`
          : 'All captains ready — starting…';
      } else {
        $('#draft-turn').textContent = 'Draft not started';
      }
    }
    if ($('#draft-pin')) {
      if (d.status === 'live' && currentTeamId) {
        const t = DB.team(currentTeamId);
        $('#draft-pin').placeholder = `${t?.captain || 'Captain'}'s PIN`;
      } else {
        $('#draft-pin').placeholder = 'Captain PIN to ready / master to start';
      }
    }
    if ($('#draft-start')) {
      $('#draft-start').textContent = d.status === 'waiting' ? 'Ready / Start' : 'Start draft';
      $('#draft-start').disabled = d.status === 'live' || d.status === 'done';
    }

    paintClock();

    const poolKey = `${d.status}|${pool.join(',')}`;
    if ($('#draft-pool') && $('#draft-pool').dataset.key !== poolKey) {
      $('#draft-pool').dataset.key = poolKey;
      $('#draft-pool').innerHTML = pool.length
        ? pool.map((id) => {
            const p = DB.player(id);
            return `<button type="button" class="draft-chip" data-pick="${id}">${p?.name || id}</button>`;
          }).join('')
        : '<p class="muted">Pool empty.</p>';
      $$('#draft-pool [data-pick]').forEach((btn) => {
        btn.disabled = d.status !== 'live';
      });
    } else if ($('#draft-pool')) {
      $$('#draft-pool [data-pick]').forEach((btn) => {
        btn.disabled = d.status !== 'live';
      });
    }

    const picksKey = JSON.stringify(picks);
    if ($('#draft-picks') && $('#draft-picks').dataset.key !== picksKey) {
      $('#draft-picks').dataset.key = picksKey;
      $('#draft-picks').innerHTML = picks.length
        ? `<ol class="draft-pick-list">${[...picks].reverse().map((pk) => {
            if (pk.skipped) {
              return `<li class="muted">Skipped → ${teamName(pk.teamId)}</li>`;
            }
            const p = DB.player(pk.playerId);
            return `<li><span class="strong">${p?.name || pk.playerId}</span> → ${teamName(pk.teamId)}</li>`;
          }).join('')}</ol>`
        : '<p class="muted">No picks yet.</p>';
    }

    const boardsKey = `${d.status}|${currentTeamId || ''}|${JSON.stringify(ready)}|${boardOrder().map((t) => `${t.id}:${DB.rosterOf(t.id).map((p) => p.id).join(',')}`).join(';')}`;
    if ($('#draft-team-boards') && $('#draft-team-boards').dataset.key !== boardsKey) {
      $('#draft-team-boards').dataset.key = boardsKey;
      $('#draft-team-boards').innerHTML = boardOrder().map((t) => {
        const roster = DB.rosterOf(t.id);
        const onClock = d.status === 'live' && currentTeamId === t.id;
        const isReady = !!ready[t.id];
        return `<div class="draft-team-card${onClock ? ' on-clock' : ''}${isReady && d.status === 'waiting' ? ' is-ready' : ''}" style="--tc:${t.color}">
          <h4>${t.name}${onClock ? ' · on the clock' : ''}${isReady && d.status === 'waiting' ? ' · ready' : ''}</h4>
          <p class="muted small">Captain: ${t.captain}</p>
          <ul>${roster.map((p) => `<li>${playerLink(p.id)}${p.name === t.captain ? ' <span class="cap">C</span>' : ''}</li>`).join('') || '<li class="muted">—</li>'}</ul>
        </div>`;
      }).join('');
    }
  };

  view.innerHTML = `
    <div class="page-head">
      <h2>Draft Room</h2>
    </div>

    <section class="panel">
      <div class="panel-head"><h3>🏟️ Team boards</h3></div>
      <div id="draft-team-boards" class="draft-team-boards"></div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <h3>🎯 Season 5 draft</h3>
        <div class="draft-head-meta">
          <span class="draft-clock" id="draft-clock" hidden>--:--</span>
          <span class="pill draft-state" id="draft-status-pill">waiting</span>
        </div>
      </div>
      <div class="draft-controls">
        <label class="draft-field">PIN
          <input id="draft-pin" class="input" type="password" autocomplete="off" placeholder="Captain PIN to ready / master to start" />
        </label>
        <button type="button" class="btn" id="draft-start">Ready / Start</button>
        <button type="button" class="btn btn-ghost" id="draft-reset">Reset</button>
      </div>
      <p id="draft-turn" class="draft-turn muted">Waiting for captains</p>
      <div class="panel-head tight"><h4>Available pool</h4></div>
      <div id="draft-pool" class="draft-pool"></div>
      <div class="panel-head tight"><h4>Recent picks</h4></div>
      <div id="draft-picks"></div>
      <p id="draft-live-msg" class="draft-msg"></p>
    </section>
  `;

  // Event delegation so pool remounts never drop the first click
  $('#draft-pool')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-pick]');
    if (!btn || btn.disabled) return;
    e.preventDefault();
    try {
      await DraftHub.makePick(btn.dataset.pick, pinVal());
      setMsg('#draft-live-msg', `Picked ${DB.player(btn.dataset.pick)?.name}`, 'ok');
    } catch (err) {
      setMsg('#draft-live-msg', err.message || String(err), 'err');
    }
  });

  $('#draft-start')?.addEventListener('click', async () => {
    try {
      const res = await DraftHub.startDraft(pinVal());
      if (res.started) {
        setMsg('#draft-live-msg', 'Draft is live — 2:00 on the clock', 'ok');
      } else {
        const name = DB.team(res.teamId)?.name || 'Team';
        setMsg('#draft-live-msg', `${name} is ready — waiting for other captains`, 'ok');
      }
    } catch (e) {
      setMsg('#draft-live-msg', e.message || String(e), 'err');
    }
  });
  $('#draft-reset')?.addEventListener('click', async () => {
    try {
      await DraftHub.resetDraft(pinVal());
      setMsg('#draft-live-msg', 'Draft reset — drafted players returned to free agents', 'ok');
    } catch (e) {
      setMsg('#draft-live-msg', e.message || String(e), 'err');
    }
  });

  if (draftUnsub) draftUnsub();
  draftUnsub = DraftHub.onChange(() => paint());
  if (draftClockTimer) clearInterval(draftClockTimer);
  draftClockTimer = setInterval(paintClock, 250);
  paint();
}

/* =============================================================================
   ROUTER + THEMING + GLOBAL CLICK DELEGATION
   ============================================================================ */
const ROUTES = {
  overview: renderDashboard, teams: renderTeamsRoster,
  schedule: renderSchedule, stats: renderStats, media: renderMedia,
  attendance: renderAttendance, draft: renderDraft, faq: renderFaq,
};

function go(tab) {
  if (tab === 'research' || tab === 'dashboard') tab = 'overview';
  if (tab === 'roster') tab = 'teams';
  $$('#tabs .tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  (ROUTES[tab] || renderDashboard)();
  wrapTables(view);
  $('#tabs').classList.remove('open');
  if (scrollTarget) {
    const sel = scrollTarget;
    scrollTarget = null;
    requestAnimationFrame(() => {
      const node = $(sel);
      if (node) node.scrollIntoView({ block: 'start', behavior: 'smooth' });
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  try { localStorage.setItem('atxutl.tab', tab); } catch (e) {}
}

function initClicks() {
  document.body.addEventListener('click', (e) => {
    if (!e.target.closest('.info')) closeAllInfoPops();
    const goTo = e.target.closest('[data-goto]');
    if (goTo) {
      scrollTarget = goTo.dataset.scroll || null;
      go(goTo.dataset.goto);
      return;
    }
    if (e.target.closest('.att-toggle')) return;
    const pl = e.target.closest('[data-player]');
    if (pl) { openProfile(pl.dataset.player); return; }
    const tm = e.target.closest('[data-team]');
    if (tm && !tm.classList.contains('seg-btn')) { teamHighlight = tm.dataset.team; go('teams'); return; }
  });
  $('#profile-modal').addEventListener('click', (e) => { if (e.target.id === 'profile-modal') closeProfile(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeAllInfoPops(); closeProfile(); }
  });
  window.addEventListener('resize', () => {
    $$('.info-pop.is-open').forEach((pop) => {
      const info = pop.closest('.info');
      if (info) positionInfoPop(info);
    });
  }, { passive: true });
  window.addEventListener('scroll', (e) => {
    if (e.target?.closest?.('.info-pop')) return;
    closeAllInfoPops();
  }, { passive: true, capture: true });
}

function initTabs() {
  $$('#tabs .tab-btn').forEach((b) => b.addEventListener('click', () => go(b.dataset.tab)));
  $('#menu-toggle')?.addEventListener('click', () => $('#tabs').classList.toggle('open'));
}

function applyTheme() {
  let theme = 'dark';
  try { theme = localStorage.getItem('atxutl.theme') || 'dark'; } catch (e) {}
  document.documentElement.dataset.theme = theme;
  $('#theme-toggle').textContent = theme === 'dark' ? '🌙' : '☀️';
}
function initTheme() {
  $('#theme-toggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('atxutl.theme', next); } catch (e) {}
    applyTheme();
    go(localStorage.getItem('atxutl.tab') || 'overview');
  });
}

/* ---------- boot ---------------------------------------------------------- */
applyTheme();
initTabs();
initTheme();
initClicks();
$('#brand-sub').textContent = DB.league.full;
$('#footer-venue').textContent = DB.league.venue;
Promise.all([DraftHub.init(), AttendanceHub.init()]).then(() => {
  DraftHub.onChange(() => {
    let tab = 'overview';
    try { tab = localStorage.getItem('atxutl.tab') || 'overview'; } catch (e) {}
    // Draft tab paints itself; refresh roster-dependent tabs live.
    // Attendance paints via AttendanceHub — only remount when teams change.
    if (tab === 'teams') go(tab);
    if (tab === 'attendance') go(tab);
  });
  let startTab = 'overview';
  try { startTab = localStorage.getItem('atxutl.tab') || 'overview'; } catch (e) {}
  if (startTab === 'dashboard') startTab = 'overview';
  if (startTab === 'roster') startTab = 'teams';
  go(startTab);
}).catch(() => {
  go('overview');
});
