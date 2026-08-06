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
  weights: { goals: 3, assists: 2, steals: 1.5, blocks: 2, turnovers: -1.5 },
  prior: 2, // small-sample shrinkage: divide by (matches + prior)
  describe:
    'Rating = (Goals×3 + Assists×2 + Steals×1.5 + Blocks×2 − Turnovers×1.5) ÷ (Matches Played + 2), ' +
    'then normalized across the league onto a 1–10 scale. The “+2” steadies small samples so a ' +
    'player with only one or two games can’t top the table on a fluke.',
};

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
  { id: 'team1',    name: 'Hellfish',      color: '#22c55e', captain: 'Rich' },
  { id: 'team2',    name: 'Team 2',        color: '#f59e0b', captain: 'Zach' },
  { id: 'team3',    name: 'Splash Damage', color: '#ef4444', captain: 'River' },
];

/* ---- Players (real active roster). skill 0..1 gently biases box scores.
        teamId 'fa' = free agent (guests into lineups). level: Pro/Rookie/IR.  */
const PLAYERS = [
  // Team captains (only rostered players)
  { id: 'reuben', name: 'Reuben', teamId: 'capybara', level: 'Pro', pos: 'Striker',  skill: 0.78 },
  { id: 'rich',   name: 'Rich',   teamId: 'team1',    level: 'Pro', pos: 'Defender', skill: 0.64 },
  { id: 'zach',   name: 'Zach',   teamId: 'team2',    level: 'Pro', pos: 'Striker',  skill: 0.75 },
  { id: 'river',  name: 'River',  teamId: 'team3',    level: 'Pro', pos: 'Striker',  skill: 0.76 },

  // Free agents (guest into lineups)
  { id: 'lesley',  name: 'Lesley',      teamId: 'fa', level: 'Pro',    pos: 'Striker',  skill: 0.90 },
  { id: 'jamese',  name: 'James E',     teamId: 'fa', level: 'Pro',    pos: 'Defender', skill: 0.70 },
  { id: 'walter',  name: 'Walter',      teamId: 'fa', level: 'Pro',    pos: 'Utility',  skill: 0.85 },
  { id: 'shaneye', name: 'Shaneye',     teamId: 'fa', level: 'Rookie', pos: 'Utility',  skill: 0.42 },
  { id: 'jamesb',  name: 'James B',     teamId: 'fa', level: 'Pro',    pos: 'Defender', skill: 0.68 },
  { id: 'kellie',  name: 'Kellie',      teamId: 'fa', level: 'Pro',    pos: 'Utility',  skill: 0.64 },
  { id: 'manny',   name: 'Manny',       teamId: 'fa', level: 'Pro',    pos: 'Striker',  skill: 0.70 },
  { id: 'max',     name: 'Max',         teamId: 'fa', level: 'Pro',    pos: 'Striker',  skill: 0.72 },
  { id: 'sk',      name: 'SK',          teamId: 'fa', level: 'Pro',    pos: 'Striker',  skill: 0.80 },
  { id: 'benb',    name: 'Ben B',       teamId: 'fa', level: 'Pro',    pos: 'Defender', skill: 0.66 },
  { id: 'emma',        name: 'Emma',        teamId: 'fa', level: 'Rookie', pos: 'Utility',  skill: 0.38 },
  { id: 'jacqueline',  name: 'Jacqueline',  teamId: 'fa', level: 'Rookie', pos: 'Utility',  skill: 0.41 },
  { id: 'eric',        name: 'Eric',        teamId: 'fa', level: 'Rookie', pos: 'Utility',  skill: 0.39 },
  { id: 'liam',        name: 'Liam',        teamId: 'fa', level: 'Rookie', pos: 'Utility',  skill: 0.40 },
  { id: 'jack',        name: 'Jack',        teamId: 'fa', level: 'Rookie', pos: 'Utility',  skill: 0.38 },
  { id: 'sage',        name: 'Sage',        teamId: 'fa', level: 'Pro',    pos: 'Striker',  skill: 0.80 },
  { id: 'eddy',    name: 'Eddy',        teamId: 'fa', level: 'Pro',    pos: 'Utility',  skill: 0.62 },
  { id: 'glenn',   name: 'Glenn',       teamId: 'fa', level: 'Pro',    pos: 'Defender', skill: 0.82 },
  { id: 'justin',  name: 'Justin',      teamId: 'fa', level: 'Pro',    pos: 'Defender', skill: 0.60 },
  { id: 'patrick', name: 'Patrick',     teamId: 'fa', level: 'Pro',    pos: 'Striker',  skill: 0.63 },
  { id: 'scheese', name: 'Sean Cheese', teamId: 'fa', level: 'Pro',    pos: 'Utility',  skill: 0.61 },
  { id: 'scroc',   name: 'Sean Croc',   teamId: 'fa', level: 'Pro',    pos: 'Defender', skill: 0.59 },
  { id: 'travis',  name: 'Travis',      teamId: 'fa', level: 'Pro',    pos: 'Utility',  skill: 0.64 },
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

const rosterOf = (tid) => PLAYERS.filter((p) => p.teamId === tid);
const FA_POOL = PLAYERS.filter((p) => p.teamId === 'fa' && p.level !== 'Pro (IR)').map((p) => p.id);
let guestIdx = 0;
const nextGuest = () => {
  const id = FA_POOL[guestIdx++ % FA_POOL.length];
  return PLAYERS.find((p) => p.id === id);
};

/* ---- Build an 8-week balanced schedule (each team plays once per week) --- */
function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d + days).toLocaleDateString('en-CA');
}

function buildSchedule() {
  // 16 games · 8 per team · pairings 2–3× each · 4 home games each
  // First/second Sunday slot: team1 & team2 4/4; capybara 5/3; team3 3/5 (best possible)
  const rounds = [
    [['team3', 'team2'], ['capybara', 'team1']],
    [['team1', 'team3'], ['team2', 'capybara']],
    [['team1', 'team2'], ['capybara', 'team3']],
    [['team1', 'capybara'], ['team3', 'team2']],
    [['team2', 'capybara'], ['team3', 'team1']],
    [['team3', 'capybara'], ['team2', 'team1']],
    [['capybara', 'team1'], ['team2', 'team3']],
    [['capybara', 'team2'], ['team1', 'team3']],
  ];
  const matches = [];
  rounds.forEach((games, i) => {
    const iso = addDays(LEAGUE.startDate, i * 7);
    games.forEach(([home, away], gi) =>
      matches.push({ id: `r${i + 1}g${gi}`, round: i + 1, date: iso, home, away }));
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
    blocks: p.pos === 'Goalie' || p.pos === 'Defender' ? rint(0, 3) : rint(0, 1),
    turnovers: rint(0, 3),
  }));
  for (let g = 0; g < goalsScored; g++) {
    let r = rng() * totalSkill;
    for (const s of stats) {
      r -= players.find((p) => p.id === s.playerId).skill;
      if (r <= 0) { s.goals++; break; }
    }
  }
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

/* ---- Availability for upcoming league nights ----------------------------- */
const AVAILABILITY = (() => {
  // upcoming scheduled nights, then extend to at least 4 future Sunday nights
  const nights = [...new Set(MATCHES.filter((m) => m.status === 'scheduled').map((m) => m.date))].sort();
  const allDates = MATCHES.map((m) => m.date).sort();
  let cursor = new Date((nights[nights.length - 1] || allDates[allDates.length - 1]) + 'T00:00:00');
  while (nights.length < 4) {
    cursor.setDate(cursor.getDate() + 7);
    nights.push(cursor.toISOString().slice(0, 10));
  }
  const playable = PLAYERS.filter((p) => p.level !== 'Pro (IR)');
  const out = {};
  nights.forEach((date) => {
    out[date] = {};
    playable.forEach((p) => {
      const r = rng();
      const rostered = p.teamId !== 'fa';
      out[date][p.id] = rostered
        ? (r < 0.62 ? 'in' : r < 0.86 ? 'maybe' : 'out')
        : (r < 0.4 ? 'in' : r < 0.7 ? 'maybe' : 'out');
    });
  });
  return { nights, table: out };
})();

/* ===========================================================================
   Derivations — every tab reads from these helpers
   =========================================================================== */
const DB = {
  league: LEAGUE,
  rating: RATING,
  awards: AWARDS,
  glossary: STANDINGS_GLOSSARY,
  teams: TEAMS,
  players: PLAYERS,
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
  teamName: (id) => (id === 'fa' ? 'Free Agent' : (TEAMS.find((t) => t.id === id) || {}).name || id),
  rosterOf: (tid) => rosterOf(tid),
  freeAgents: () => PLAYERS.filter((p) => p.teamId === 'fa'),

  finals: () => MATCHES.filter((m) => m.status === 'final'),
  upcoming: () => MATCHES.filter((m) => m.status === 'scheduled'),

  standings() {
    const table = {};
    TEAMS.forEach((t) => (table[t.id] = { teamId: t.id, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, played: 0 }));
    this.finals().forEach((m) => {
      const h = table[m.home], a = table[m.away];
      h.played++; a.played++;
      h.gf += m.homeScore; h.ga += m.awayScore;
      a.gf += m.awayScore; a.ga += m.homeScore;
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
      playerId: p.id, goals: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0, matches: 0,
    }));
    this.finals().forEach((m) => m.box.forEach((b) => {
      const t = totals[b.playerId];
      t.goals += b.goals; t.assists += b.assists; t.steals += b.steals;
      t.blocks += b.blocks; t.turnovers += b.turnovers; t.matches++;
    }));
    return totals;
  },

  ratedPlayers() {
    const totals = this.playerTotals();
    const w = RATING.weights;
    const raw = PLAYERS.map((p) => {
      const t = totals[p.id];
      const score = t.goals * w.goals + t.assists * w.assists + t.steals * w.steals +
        t.blocks * w.blocks + t.turnovers * w.turnovers;
      return {
        ...p, ...t,
        perMatch: t.matches ? score / t.matches : 0,
        eff: t.matches ? score / (t.matches + RATING.prior) : 0, // shrunk toward 0 for small samples
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

  ratedPlayer(id) { return this.ratedPlayers().find((p) => p.playerId === id); },

  teamTotals(teamId) {
    const totals = this.playerTotals();
    return rosterOf(teamId).reduce((acc, p) => {
      const t = totals[p.id];
      acc.goals += t.goals; acc.assists += t.assists; acc.steals += t.steals;
      acc.blocks += t.blocks; acc.turnovers += t.turnovers;
      return acc;
    }, { goals: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 });
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
        round: m.round, date: m.date, opp, gf, ga, guest,
        result: gf > ga ? 'W' : gf < ga ? 'L' : 'D', ...line,
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
