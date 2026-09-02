/* =============================================================================
   ATX UTL — League data (single source of truth)
   -----------------------------------------------------------------------------
   Roster is the real ATX UTL active-player list (teams + free agents).
   Match results, box scores, guest appearances and availability are produced by
   a SEEDED random generator so the demo data is realistic yet stable across
   reloads (change LEAGUE.seed to reshuffle the whole season).

   Standings, leaderboards, ratings, profiles, attendance and every chart are
   computed from this one dataset — so all tabs stay in sync automatically.
   ============================================================================ */

const LEAGUE = {
  name: 'ATX UTL',
  full: 'Austin Underwater Torpedo League',
  venue: 'Deepend Fitness — Austin, Texas',
  season: 'Season 5',
  startDate: '2026-08-23',
  weeks: 8,
  poolDepth: '14 ft',
  seed: 20260823,
};

/* ---- Rating formula (transparent, shown in the UI) ----------------------- */
const RATING = {
  weights: { goals: 3, assists: 2, steals: 1.5, blocks: 3, turnovers: -1.5 },
  prior: 2, // small-sample shrinkage: divide by (matches + prior)
  describe:
    'Rating = (Goals×3 + Assists×2 + Steals×1.5 + Blocks×3 − Turnovers×1.5) ÷ (Matches Played + 2), ' +
    'then normalized across the league onto a 1–10 scale. The “+2” steadies small samples so a ' +
    'player with only one or two games can’t top the table on a fluke.',
};

/* ---- Derived position (from season box scores; updates as new games land) - */
const POSITION = {
  prior: 2,
  /** If #2 score is within this fraction of #1, show combo (e.g. Striker/Defender). */
  utilityMargin: 0.15,
  describe:
    'Position is derived from season box scores (not assigned). ' +
    'Striker ← Goals×3 + Shots + Assists; Playmaker ← Assists×3 + Swim-off wins; ' +
    'Defender ← Blocks×3 + Steals×1.5 — each divided by (Matches + 2). ' +
    'Highest score wins; if the top two are within 15%, both show as a combo (e.g. Striker/Defender).',
};

function derivePosition(t) {
  const mp = Number(t?.matches) || 0;
  if (mp <= 0) {
    return { label: '', primary: '', secondary: '', scores: { Striker: 0, Playmaker: 0, Defender: 0 } };
  }
  const denom = mp + POSITION.prior;
  const scores = {
    Striker: ((t.goals || 0) * 3 + (t.shots || 0) + (t.assists || 0)) / denom,
    Playmaker: ((t.assists || 0) * 3 + (t.swimOffs || 0)) / denom,
    Defender: ((t.blocks || 0) * 3 + (t.steals || 0) * 1.5) / denom,
  };
  const ranked = Object.keys(scores)
    .map((name) => ({ name, score: scores[name] }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const top = ranked[0];
  const second = ranked[1];
  if (!top || top.score <= 0) {
    return { label: '', primary: '', secondary: '', scores };
  }
  const close = second
    && top.score > 0
    && second.score / top.score >= (1 - POSITION.utilityMargin);
  if (close) {
    return {
      label: `${top.name}/${second.name}`,
      primary: top.name,
      secondary: second.name,
      scores,
    };
  }
  return { label: top.name, primary: top.name, secondary: '', scores };
}

/* ---- Season awards (Overview cards) — weighted so both stats count ------- */
const AWARDS = {
  // Golden Torpedo: offense — goals count twice assists
  torpedo: { goals: 2, assists: 1 },
  // Golden Glove: defense — blocks count twice steals
  glove: { blocks: 2, steals: 1 },
};

/* ---- Column glossary (info panes) ---------------------------------------- */
const STANDINGS_GLOSSARY = [
  ['P', 'Played — matches completed'],
  ['W', 'Wins (3 pts each)'],
  ['D', 'Draws (1 pt each)'],
  ['L', 'Losses (0 pts)'],
  ['GF', 'Goals For — scored'],
  ['GA', 'Goals Against — conceded'],
  ['GD', 'Goal Difference (GF − GA)'],
  ['Pts', 'Points — the ranking total'],
];

/* ---- Teams --------------------------------------------------------------- */
const TEAMS = [
  { id: 'capybara', name: 'Capybara',      color: '#0ea5e9', captain: 'Reuben' },
  { id: 'team1',    name: 'Flying Hellfish', color: '#22c55e', captain: 'Rich' },
  { id: 'team2',    name: 'Lone Starfish', color: '#f59e0b', captain: 'Zach' },
  { id: 'team3',    name: 'Splash Damage', color: '#ef4444', captain: 'River' },
];

/* ---- Season 5 roster (captains keep team affiliation; others are FA) ----- */
const SEASON5_ROSTER = [
  'reuben', 'rich', 'river', 'zach', 'eric', 'justin',
  'bonney', 'max', 'lesley', 'michal', 'sk', 'jacqueline',
  'kellie', 'sage', 'walter', 'glenn', 'liam', 'eddy', 'jack',
  'andriy', 'scroc', 'judson', 'mauricio', 'shaneye', 'brooke', 'travis',
  'jamese', 'kora', 'scheese', 'kevin', 'benb', 'patrick',
];

/* ---- Players (real active roster). skill 0..1 gently biases box scores.
        teamId 'fa' = free agent / unassigned. Season 5 captains have teams.
        Overall roster view hides team affiliation; Season 5 view shows it.
        level: Pro/Rookie/IR.  */
const PLAYERS = [
  // Season 5 captains (team-affiliated)
  { id: 'reuben', name: 'Reuben', teamId: 'capybara', level: 'Pro',  skill: 0.78 },
  { id: 'rich',   name: 'Rich',   teamId: 'team1',    level: 'Pro', skill: 0.64 },
  { id: 'zach',   name: 'Zach',   teamId: 'team2',    level: 'Pro',  skill: 0.75 },
  { id: 'travis', name: 'Travis', teamId: 'team2',    level: 'Pro',  skill: 0.64 },
  { id: 'river',  name: 'River',  teamId: 'team3',    level: 'Pro',  skill: 0.76 },

  // Season 5 pool (unassigned) + broader overall roster
  { id: 'lesley',      name: 'Lesley',      teamId: 'fa', level: 'Pro',  skill: 0.90 },
  { id: 'bonney',      name: 'Bonney',      teamId: 'fa', level: 'Pro', skill: 0.68 },
  { id: 'max',         name: 'Max',         teamId: 'fa', level: 'Pro',  skill: 0.72 },
  { id: 'sk',          name: 'SK',          teamId: 'fa', level: 'Pro',  skill: 0.80 },
  { id: 'justin',      name: 'Justin',      teamId: 'fa', level: 'Pro', skill: 0.60 },
  { id: 'eric',        name: 'Eric',        teamId: 'fa', level: 'Rookie',  skill: 0.39 },
  { id: 'michal',      name: 'Michal',      teamId: 'fa', level: 'Rookie',  skill: 0.45 },
  { id: 'jacqueline',  name: 'Jacqueline',  teamId: 'fa', level: 'Rookie',  skill: 0.41 },
  { id: 'andriy',      name: 'Andriy',      teamId: 'fa', level: 'Rookie',  skill: 0.40 },
  { id: 'judson',      name: 'Judson',      teamId: 'fa', level: 'Rookie',  skill: 0.40 },
  { id: 'mauricio',    name: 'Mauricio',    teamId: 'fa', level: 'Rookie',  skill: 0.40 },
  { id: 'brooke',      name: 'Brooke',      teamId: 'fa', level: 'Rookie',  skill: 0.39 },
  { id: 'kora',        name: 'Kora',        teamId: 'fa', level: 'Rookie',  skill: 0.40 },
  { id: 'kevin',       name: 'Kevin',       teamId: 'fa', level: 'Rookie',  skill: 0.40 },

  // Overall roster (additional ATX players)
  { id: 'jamese',  name: 'James E',     teamId: 'fa', level: 'Pro', skill: 0.70 },
  { id: 'walter',  name: 'Walter',      teamId: 'fa', level: 'Pro',  skill: 0.85 },
  { id: 'shaneye', name: 'Shaneye',     teamId: 'fa', level: 'Rookie',  skill: 0.42 },
  { id: 'kellie',  name: 'Kellie',      teamId: 'fa', level: 'Pro',  skill: 0.64 },
  { id: 'manny',   name: 'Manny',       teamId: 'fa', level: 'Pro',  skill: 0.70 },
  { id: 'benb',    name: 'Ben B',       teamId: 'fa', level: 'Pro', skill: 0.66 },
  { id: 'emma',    name: 'Emma',        teamId: 'fa', level: 'Rookie',  skill: 0.38 },
  { id: 'liam',    name: 'Liam',        teamId: 'fa', level: 'Rookie',  skill: 0.40 },
  { id: 'jack',    name: 'Jack Armstrong', teamId: 'fa', level: 'Rookie',  skill: 0.38 },
  { id: 'sage',    name: 'Sage',        teamId: 'fa', level: 'Pro',  skill: 0.80 },
  { id: 'eddy',    name: 'Eddy',        teamId: 'fa', level: 'Pro',  skill: 0.62 },
  { id: 'glenn',   name: 'Glenn',       teamId: 'fa', level: 'Pro', skill: 0.82 },
  { id: 'patrick', name: 'Patrick',     teamId: 'fa', level: 'Pro',  skill: 0.63 },
  { id: 'scheese', name: 'Sean Cheese', teamId: 'fa', level: 'Pro',  skill: 0.61 },
  { id: 'scroc',   name: 'Sean Croc',   teamId: 'fa', level: 'Pro', skill: 0.59 },
];

/* ===========================================================================
   Seeded random generator (mulberry32) — deterministic dummy data
   =========================================================================== */
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = makeRng(LEAGUE.seed);
const rint = (min, max) => Math.floor(rng() * (max - min + 1)) + min;

/* ---- Completed prior-season box totals for Overall (all-seasons) view.
        Shape: { [seasonNumber]: { [playerId]: { goals, assists, ... matches } } }
        Empty until past seasons are recorded; careerTotals still sums these
        with the current season so Overall stays all-seasons-ready. ----------- */
const STAT_ZERO = () => ({
  goals: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0,
  swimOffAttempts: 0, swimOffs: 0, shots: 0, matches: 0,
});
const PRIOR_SEASONS = {
  // 1: { reuben: { goals: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0, swimOffAttempts: 0, swimOffs: 0, shots: 0, matches: 0 }, ... },
};

const rosterOf = (tid) => PLAYERS.filter((p) => p.teamId === tid);
const FA_POOL = PLAYERS.filter((p) => p.teamId === 'fa' && p.level !== 'Pro (IR)').map((p) => p.id);
let guestIdx = 0;
const nextGuest = () => {
  const id = FA_POOL[guestIdx++ % FA_POOL.length];
  return PLAYERS.find((p) => p.id === id);
};

/* ---- Build schedule: weeks 1–6 regular season, 7–8 playoffs --------------- */
function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d + days).toLocaleDateString('en-CA');
}

function buildSchedule() {
  // Regular season: 6 weeks · each team plays once per week
  const regular = [
    [['team3', 'team2'], ['capybara', 'team1']],
    [['team1', 'team3'], ['team2', 'capybara']],
    [['team1', 'team2'], ['capybara', 'team3']],
    [['team1', 'capybara'], ['team3', 'team2']],
    [['team2', 'capybara'], ['team3', 'team1']],
    [['team3', 'capybara'], ['team2', 'team1']],
  ];
  const matches = [];
  regular.forEach((games, i) => {
    const iso = addDays(LEAGUE.startDate, i * 7);
    games.forEach(([home, away], gi) =>
      matches.push({
        id: `r${i + 1}g${gi}`,
        round: i + 1,
        date: iso,
        home,
        away,
        phase: 'regular',
      }));
  });

  // Week 7 — Semifinals (seeds from regular-season standings)
  const d7 = addDays(LEAGUE.startDate, 6 * 7);
  matches.push({
    id: 'r7g0', round: 7, date: d7,
    home: 'seed:1', away: 'seed:4',
    phase: 'playoff', playoff: 'semi-a',
    label: 'Semifinal A · Seed 1 vs Seed 4',
  });
  matches.push({
    id: 'r7g1', round: 7, date: d7,
    home: 'seed:2', away: 'seed:3',
    phase: 'playoff', playoff: 'semi-b',
    label: 'Semifinal B · Seed 2 vs Seed 3',
  });

  // Week 8 — Final + 3rd place
  const d8 = addDays(LEAGUE.startDate, 7 * 7);
  matches.push({
    id: 'r8g0', round: 8, date: d8,
    home: 'winner:semi-a', away: 'winner:semi-b',
    phase: 'playoff', playoff: 'final',
    label: 'Championship Final',
  });
  matches.push({
    id: 'r8g1', round: 8, date: d8,
    home: 'loser:semi-a', away: 'loser:semi-b',
    phase: 'playoff', playoff: 'consolation',
    label: '3rd Place Game',
  });
  return matches;
}

/* ---- Lineup for a team in a match: present roster (~82%) + one FA guest --- */
function lineup(teamId) {
  let present = rosterOf(teamId).filter(() => rng() < 0.82);
  if (present.length < 4) present = rosterOf(teamId).slice();
  present = present.concat(nextGuest()); // pickup guest
  return present;
}

const teamStrength = (players) => players.reduce((s, p) => s + p.skill, 0) / players.length;

function boxFor(players, goalsScored) {
  const totalSkill = players.reduce((s, p) => s + p.skill, 0) || 1;
  const stats = players.map((p) => ({
    playerId: p.id,
    goals: 0,
    assists: rint(0, p.skill > 0.7 ? 3 : 2),
    steals: rint(0, p.skill > 0.6 ? 4 : 3),
    blocks: rint(0, 2),
    turnovers: rint(0, 3),
    swimOffAttempts: rint(0, p.skill > 0.65 ? 3 : 2),
    swimOffs: 0, // filled below as wins ≤ attempts
    shots: 0, // scoring chances (filled below; always ≥ goals)
  }));
  for (let g = 0; g < goalsScored; g++) {
    let r = rng() * totalSkill;
    for (const s of stats) {
      r -= players.find((p) => p.id === s.playerId).skill;
      if (r <= 0) { s.goals++; break; }
    }
  }
  // Shots / scoring chances ≥ goals (missed looks + finishes)
  stats.forEach((s) => {
    const p = players.find((x) => x.id === s.playerId);
    s.shots = s.goals + rint(0, p.skill > 0.7 ? 4 : 3);
    s.swimOffs = Math.min(s.swimOffAttempts, rint(0, s.swimOffAttempts));
  });
  return stats;
}

function playMatch(match) {
  const home = lineup(match.home);
  const away = lineup(match.away);
  const genGoals = (a, b) =>
    Math.max(0, Math.min(8, Math.round(3 + (teamStrength(a) - teamStrength(b)) * 4 + (rng() * 4 - 2))));
  const hs = genGoals(home, away);
  const as = genGoals(away, home);
  return {
    homeScore: hs,
    awayScore: as,
    homeLineup: home.map((p) => p.id),
    awayLineup: away.map((p) => p.id),
    box: [...boxFor(home, hs), ...boxFor(away, as)],
  };
}

/* ---- Assemble season: no games played yet — all fixtures upcoming -------- */
const MATCHES = (() => {
  const sched = buildSchedule();
  return sched.map((m) =>
    ({ ...m, status: 'scheduled', homeScore: null, awayScore: null, box: [], homeLineup: [], awayLineup: [] }));
})();

/* ---- Availability for upcoming league nights (Season 5 roster only) ------ */
const AVAILABILITY = (() => {
  // upcoming scheduled nights, then extend to at least 4 future Sunday nights
  const nights = [...new Set(MATCHES.filter((m) => m.status === 'scheduled').map((m) => m.date))].sort();
  const allDates = MATCHES.map((m) => m.date).sort();
  let cursor = new Date((nights[nights.length - 1] || allDates[allDates.length - 1]) + 'T00:00:00');
  while (nights.length < 4) {
    cursor.setDate(cursor.getDate() + 7);
    nights.push(cursor.toISOString().slice(0, 10));
  }
  const playable = SEASON5_ROSTER
    .map((id) => PLAYERS.find((p) => p.id === id))
    .filter((p) => p && p.level !== 'Pro (IR)');
  const out = {};
  nights.forEach((date) => {
    out[date] = {};
    playable.forEach((p) => { out[date][p.id] = 'maybe'; });
  });
  return { nights, table: out };
})();

/* ===========================================================================
   Derivations — every tab reads from these helpers
   =========================================================================== */
const DB = {
  league: LEAGUE,
  rating: RATING,
  position: POSITION,
  awards: AWARDS,
  glossary: STANDINGS_GLOSSARY,
  teams: TEAMS,
  players: PLAYERS,
  season5RosterIds: SEASON5_ROSTER,
  matches: MATCHES,
  availability: AVAILABILITY,

  torpedoScore(p) {
    const w = AWARDS.torpedo;
    return p.goals * w.goals + p.assists * w.assists;
  },
  gloveScore(p) {
    const w = AWARDS.glove;
    return p.blocks * w.blocks + p.steals * w.steals;
  },

  team: (id) => TEAMS.find((t) => t.id === id),
  player: (id) => PLAYERS.find((p) => p.id === id),
  teamName: (id) => {
    if (id === 'fa') return 'Free Agent';
    if (!id) return 'TBD';
    if (String(id).startsWith('seed:')) return `Seed ${String(id).slice(5)}`;
    if (String(id).startsWith('winner:')) return 'Winner TBD';
    if (String(id).startsWith('loser:')) return 'Loser TBD';
    return (TEAMS.find((t) => t.id === id) || {}).name || id;
  },
  isPlaceholderTeam: (id) => {
    const s = String(id || '');
    return s.startsWith('seed:') || s.startsWith('winner:') || s.startsWith('loser:');
  },
  matchLabel: (m) => m?.label || null,

  /** Regular-season standings only (rounds 1–6) for playoff seeding. */
  regularStandings() {
    const table = {};
    TEAMS.forEach((t) => (table[t.id] = { teamId: t.id, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, played: 0 }));
    this.finals().filter((m) => (m.phase || 'regular') === 'regular' || Number(m.round) <= 6).forEach((m) => {
      if (this.isPlaceholderTeam(m.home) || this.isPlaceholderTeam(m.away)) return;
      const h = table[m.home];
      const a = table[m.away];
      if (!h || !a) return;
      h.played++; a.played++;
      const hg = m.pointsHome != null ? m.pointsHome : m.homeScore;
      const ag = m.pointsAway != null ? m.pointsAway : m.awayScore;
      h.gf += hg; h.ga += ag;
      a.gf += ag; a.ga += hg;
      if (m.homeScore > m.awayScore) { h.w++; a.l++; h.pts += 3; }
      else if (m.homeScore < m.awayScore) { a.w++; h.l++; a.pts += 3; }
      else { h.d++; a.d++; h.pts++; a.pts++; }
    });
    return Object.values(table).sort(
      (x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf);
  },

  playoffWinner(m) {
    if (!m || m.status !== 'final') return null;
    if (this.isPlaceholderTeam(m.home) || this.isPlaceholderTeam(m.away)) return null;
    if (m.homeScore > m.awayScore) return m.home;
    if (m.homeScore < m.awayScore) return m.away;
    return null; // draw — no auto-advance
  },
  playoffLoser(m) {
    if (!m || m.status !== 'final') return null;
    if (this.isPlaceholderTeam(m.home) || this.isPlaceholderTeam(m.away)) return null;
    if (m.homeScore > m.awayScore) return m.away;
    if (m.homeScore < m.awayScore) return m.home;
    return null;
  },

  /**
   * Fill playoff home/away from regular-season seeds + completed semis.
   * Mutates MATCHES in place (same pattern as StatsHub overlays).
   */
  refreshPlayoffAssignments() {
    const seeds = this.regularStandings().map((s) => s.teamId);
    const seedOf = (n) => seeds[n - 1] || `seed:${n}`;
    const bySlot = {};
    MATCHES.forEach((m) => {
      if (m.playoff) bySlot[m.playoff] = m;
    });

    const semiA = bySlot['semi-a'];
    const semiB = bySlot['semi-b'];
    const final = bySlot.final;
    const consol = bySlot.consolation;

    if (semiA) {
      if (seeds.length >= 4 || semiA.status !== 'final') {
        // Keep resolved teams once a semi is final; otherwise refresh from seeds
        if (semiA.status !== 'final') {
          semiA.home = seedOf(1);
          semiA.away = seedOf(4);
        }
      }
    }
    if (semiB) {
      if (semiB.status !== 'final') {
        semiB.home = seedOf(2);
        semiB.away = seedOf(3);
      }
    }

    if (final && semiA && semiB) {
      const wA = this.playoffWinner(semiA);
      const wB = this.playoffWinner(semiB);
      if (final.status !== 'final') {
        final.home = wA || 'winner:semi-a';
        final.away = wB || 'winner:semi-b';
      }
    }
    if (consol && semiA && semiB) {
      const lA = this.playoffLoser(semiA);
      const lB = this.playoffLoser(semiB);
      if (consol.status !== 'final') {
        consol.home = lA || 'loser:semi-a';
        consol.away = lB || 'loser:semi-b';
      }
    }
    return MATCHES;
  },

  rosterOf: (tid) => rosterOf(tid),
  freeAgents: () => PLAYERS.filter((p) => p.teamId === 'fa'),
  season5Roster: () => SEASON5_ROSTER.map((id) => PLAYERS.find((p) => p.id === id)).filter(Boolean),
  isSeason5: (id) => SEASON5_ROSTER.includes(id),

  finals: () => MATCHES.filter((m) => m.status === 'final'),
  upcoming: () => MATCHES.filter((m) => m.status === 'scheduled'),

  standings() {
    // Regular season only (weeks 1–6) — playoffs do not affect the table / seeding.
    const table = {};
    TEAMS.forEach((t) => (table[t.id] = { teamId: t.id, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, played: 0 }));
    this.finals().filter((m) => (m.phase || 'regular') === 'regular' || Number(m.round) <= 6).forEach((m) => {
      if (this.isPlaceholderTeam(m.home) || this.isPlaceholderTeam(m.away)) return;
      const h = table[m.home];
      const a = table[m.away];
      if (!h || !a) return;
      h.played++; a.played++;
      // Series wins decide W/L; summed game points feed GF/GA when present.
      const hg = m.pointsHome != null ? m.pointsHome : m.homeScore;
      const ag = m.pointsAway != null ? m.pointsAway : m.awayScore;
      h.gf += hg; h.ga += ag;
      a.gf += ag; a.ga += hg;
      if (m.homeScore > m.awayScore) { h.w++; a.l++; h.pts += 3; }
      else if (m.homeScore < m.awayScore) { a.w++; h.l++; a.pts += 3; }
      else { h.d++; a.d++; h.pts++; a.pts++; }
    });
    return Object.values(table).sort(
      (x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf);
  },

  nextGameFor(teamId) {
    return this.upcoming().find((m) => m.home === teamId || m.away === teamId);
  },

  playerTotals() {
    const totals = {};
    PLAYERS.forEach((p) => (totals[p.id] = {
      playerId: p.id, goals: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0,
      swimOffAttempts: 0, swimOffs: 0, shots: 0, matches: 0,
    }));
    this.finals().forEach((m) => m.box.forEach((b) => {
      const t = totals[b.playerId];
      if (!t) return;
      t.goals += b.goals || 0; t.assists += b.assists || 0; t.steals += b.steals || 0;
      t.blocks += b.blocks || 0; t.turnovers += b.turnovers || 0;
      t.swimOffAttempts += b.swimOffAttempts || 0;
      t.swimOffs += b.swimOffs || 0; t.shots += b.shots || 0; t.matches++;
    }));
    return totals;
  },

  /* All-time totals: every entry in PRIOR_SEASONS + current season box scores */
  careerTotals() {
    const season = this.playerTotals();
    const totals = {};
    PLAYERS.forEach((p) => {
      const acc = STAT_ZERO();
      Object.values(PRIOR_SEASONS).forEach((seasonMap) => {
        const prior = seasonMap[p.id];
        if (!prior) return;
        acc.goals += prior.goals || 0;
        acc.assists += prior.assists || 0;
        acc.steals += prior.steals || 0;
        acc.blocks += prior.blocks || 0;
        acc.turnovers += prior.turnovers || 0;
        acc.swimOffAttempts += prior.swimOffAttempts || 0;
        acc.swimOffs += prior.swimOffs || 0;
        acc.shots += prior.shots || 0;
        acc.matches += prior.matches || 0;
      });
      const cur = season[p.id];
      totals[p.id] = {
        playerId: p.id,
        goals: acc.goals + cur.goals,
        assists: acc.assists + cur.assists,
        steals: acc.steals + cur.steals,
        blocks: acc.blocks + cur.blocks,
        turnovers: acc.turnovers + cur.turnovers,
        swimOffAttempts: acc.swimOffAttempts + cur.swimOffAttempts,
        swimOffs: acc.swimOffs + cur.swimOffs,
        shots: acc.shots + cur.shots,
        matches: acc.matches + cur.matches,
      };
    });
    return totals;
  },

  _rateFromTotals(totals) {
    const w = RATING.weights;
    const raw = PLAYERS.map((p) => {
      const t = totals[p.id];
      const score = t.goals * w.goals + t.assists * w.assists + t.steals * w.steals +
        t.blocks * w.blocks + t.turnovers * w.turnovers;
      const derived = derivePosition(t);
      return {
        ...p, ...t,
        pos: derived.label,
        posPrimary: derived.primary,
        posSecondary: derived.secondary,
        posScores: derived.scores,
        perMatch: t.matches ? score / t.matches : 0,
        eff: t.matches ? score / (t.matches + RATING.prior) : 0,
      };
    });
    const played = raw.filter((r) => r.matches > 0).map((r) => r.eff);
    const min = played.length ? Math.min(...played) : 0;
    const max = played.length ? Math.max(...played) : 0;
    return raw
      .map((r) => ({
        ...r,
        rating: r.matches === 0 ? 0
          : (max === min ? 5 : Math.round(1 + ((r.eff - min) / (max - min)) * 9)),
      }))
      .sort((a, b) => b.rating - a.rating || b.goals - a.goals);
  },

  /** Derived position label for a totals-shaped object (or rated player). */
  positionOf(t) {
    return derivePosition(t || {}).label;
  },

  ratedPlayers() { return this._rateFromTotals(this.playerTotals()); },
  ratedCareerPlayers() { return this._rateFromTotals(this.careerTotals()); },

  ratedPlayer(id) { return this.ratedPlayers().find((p) => p.playerId === id); },
  ratedCareerPlayer(id) { return this.ratedCareerPlayers().find((p) => p.playerId === id); },

  teamTotals(teamId) {
    const totals = this.playerTotals();
    return rosterOf(teamId).reduce((acc, p) => {
      const t = totals[p.id];
      acc.goals += t.goals; acc.assists += t.assists; acc.steals += t.steals;
      acc.blocks += t.blocks; acc.turnovers += t.turnovers;
      acc.swimOffAttempts += t.swimOffAttempts; acc.swimOffs += t.swimOffs; acc.shots += t.shots;
      return acc;
    }, { goals: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0, swimOffAttempts: 0, swimOffs: 0, shots: 0 });
  },

  /* Per-match log for one player (used by profiles) */
  gameLog(playerId) {
    const log = [];
    this.finals().forEach((m) => {
      const line = m.box.find((b) => b.playerId === playerId);
      if (!line) return;
      const p = this.player(playerId);
      const forTeam = m.homeLineup.includes(playerId) ? m.home : m.away;
      const opp = forTeam === m.home ? m.away : m.home;
      const gf = forTeam === m.home ? m.homeScore : m.awayScore;
      const ga = forTeam === m.home ? m.awayScore : m.homeScore;
      const guest = p.teamId === 'fa' || forTeam !== p.teamId;
      log.push({
        matchId: m.id,
        round: m.round,
        date: m.date,
        home: m.home,
        away: m.away,
        forTeam,
        opp,
        gf,
        ga,
        guest,
        result: gf > ga ? 'W' : gf < ga ? 'L' : 'D',
        ...line,
      });
    });
    return log;
  },

  attendancePct(playerId) {
    const nights = AVAILABILITY.nights;
    if (!nights.length) return null;
    let ins = 0;
    nights.forEach((d) => { if (AVAILABILITY.table[d][playerId] === 'in') ins++; });
    return Math.round((ins / nights.length) * 100);
  },
};

window.DB = DB;
