/* =============================================================================
   ATX UTL — League data (single source of truth)
   -----------------------------------------------------------------------------
   PLAYERS is the all-time ATX player directory. Each entry in SEASONS defines
   one season's teams, roster and schedule; exactly one season is active per
   page load (picked by ?season= or the session's last choice, defaulting to
   the current season). Live results, rosters and attendance are overlaid from
   Firebase, scoped per season by its roomId (js/firebase-config.js).

   Standings, leaderboards, ratings, profiles, attendance and every chart are
   computed from this one dataset — so all tabs stay in sync automatically.
   ============================================================================ */

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

/* ---- Players (all-time ATX directory). skill 0..1 gently biases box scores.
        teamId 'fa' = free agent / unassigned. teamId here is the Season 5
        base; other seasons reset it from their own baseTeams at load.
        Overall roster view hides team affiliation; season views show it.  */
const PLAYERS = [
  // Season 5 captains (team-affiliated)
  { id: 'reuben', name: 'Reuben', teamId: 'capybara', skill: 0.78 },
  { id: 'rich',   name: 'Rich',   teamId: 'team1',    skill: 0.64 },
  { id: 'zach',   name: 'Zach',   teamId: 'team2',    skill: 0.75 },
  { id: 'travis', name: 'Travis', teamId: 'team2',    skill: 0.64 },
  { id: 'river',  name: 'River',  teamId: 'team3',    skill: 0.76 },

  // Season 5 pool (unassigned) + broader overall roster
  { id: 'lesley',      name: 'Lesley',      teamId: 'fa', skill: 0.90 },
  { id: 'bonney',      name: 'Bonney',      teamId: 'fa', skill: 0.68 },
  { id: 'max',         name: 'Max',         teamId: 'fa', skill: 0.72 },
  { id: 'sk',          name: 'SK',          teamId: 'fa', skill: 0.80 },
  { id: 'justin',      name: 'Justin',      teamId: 'fa', skill: 0.60 },
  { id: 'eric',        name: 'Eric',        teamId: 'fa', skill: 0.39 },
  { id: 'michal',      name: 'Michal',      teamId: 'fa', skill: 0.45 },
  { id: 'jacqueline',  name: 'Jacqueline',  teamId: 'fa', skill: 0.41 },
  { id: 'andriy',      name: 'Andriy',      teamId: 'fa', skill: 0.40 },
  { id: 'judson',      name: 'Judson',      teamId: 'fa', skill: 0.40 },
  { id: 'mauricio',    name: 'Mauricio',    teamId: 'fa', skill: 0.40 },
  { id: 'brooke',      name: 'Brooke',      teamId: 'fa', skill: 0.39 },
  { id: 'kora',        name: 'Kora',        teamId: 'fa', skill: 0.40 },
  { id: 'kevin',       name: 'Kevin',       teamId: 'fa', skill: 0.40 },

  // Overall roster (additional ATX players)
  { id: 'jamese',  name: 'James E',     teamId: 'fa', skill: 0.70 },
  { id: 'walter',  name: 'Walter',      teamId: 'fa', skill: 0.85 },
  { id: 'shaneye', name: 'Shaneye',     teamId: 'fa', skill: 0.42 },
  { id: 'kellie',  name: 'Kellie',      teamId: 'fa', skill: 0.64 },
  { id: 'manny',   name: 'Manny',       teamId: 'fa', skill: 0.70 },
  { id: 'will',    name: 'Will',        teamId: 'fa', skill: 0.68 },
  { id: 'benb',    name: 'Ben B',       teamId: 'fa', skill: 0.66 },
  { id: 'emma',    name: 'Emma',        teamId: 'fa', skill: 0.38 },
  { id: 'liam',    name: 'Liam',        teamId: 'fa', skill: 0.40 },
  { id: 'jack',    name: 'Jack Armstrong', teamId: 'fa', skill: 0.38 },
  { id: 'sage',    name: 'Sage',        teamId: 'fa', skill: 0.80 },
  { id: 'eddy',    name: 'Eddy',        teamId: 'fa', skill: 0.62 },
  { id: 'glenn',   name: 'Glenn',       teamId: 'fa', skill: 0.82 },
  { id: 'patrick', name: 'Patrick',     teamId: 'fa', skill: 0.63 },
  { id: 'scheese', name: 'Sean Cheese', teamId: 'fa', skill: 0.61 },
  { id: 'scroc',   name: 'Sean Croc',   teamId: 'fa', skill: 0.59 },

  // Added for UTL Nationals
  { id: 'john',    name: 'John',        teamId: 'fa', skill: 0.40 },
  { id: 'trevor',  name: 'Trevor',      teamId: 'fa', skill: 0.40 },

  // SC Guapos (Nationals). teamId stays free-agent here; Nationals baseTeams assigns the club.
  { id: 'erikflegal',    name: 'Erik Flegal',    teamId: 'fa', skill: 0.50 },
  { id: 'aquilaturk',    name: 'Aquila Turk',    teamId: 'fa', skill: 0.50 },
  { id: 'chrisemde',     name: 'Chris Emde',     teamId: 'fa', skill: 0.50 },
  { id: 'isaackeohone',  name: 'Isaac Keohone',  teamId: 'fa', skill: 0.50 },
  { id: 'lanejohnson',   name: 'Lane Johnson',   teamId: 'fa', skill: 0.50 },
  { id: 'matmacdonnell', name: 'Mat MacDonnell', teamId: 'fa', skill: 0.50 },
  { id: 'rickyquintero', name: 'Ricky Quintero', teamId: 'fa', skill: 0.50 },
  { id: 'samuelbrooks',  name: 'Samuel Brooks',  teamId: 'fa', skill: 0.50 },
  { id: 'josecaride',    name: 'Jose Caride',    teamId: 'fa', skill: 0.50 },

  // KC Misfits (Nationals)
  { id: 'jeremygulley',   name: 'Jeremy Gulley',   teamId: 'fa', skill: 0.50 },
  { id: 'scottstecklein', name: 'Scott Stecklein', teamId: 'fa', skill: 0.50 },
  { id: 'xavierperry',    name: 'Xavier Perry',    teamId: 'fa', skill: 0.50 },
  { id: 'elimills',       name: 'Eli Mills',       teamId: 'fa', skill: 0.50 },
  { id: 'nickfisher',     name: 'Nick Fisher',     teamId: 'fa', skill: 0.50 },
  { id: 'graydenpeoples', name: 'Grayden Peoples', teamId: 'fa', skill: 0.50 },
  { id: 'joshpreston',    name: 'Josh Preston',    teamId: 'fa', skill: 0.50 },
  { id: 'israelgulley',   name: 'Israel Gulley',   teamId: 'fa', skill: 0.50 },
  { id: 'mikejohnson',    name: 'Mike Johnson',    teamId: 'fa', skill: 0.50 },
];

function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d + days).toLocaleDateString('en-CA');
}

/* ---- Playoff bracket (shared): semis 1v4 / 2v3, then 3rd place + final.
        Match ids are the Firebase result keys — never renumber a played season.
        firstGame offsets the ids when semis and finals share a round. */
function bracketMatches(semis, finals) {
  const at = (stage, i) => ({ ...(stage.times?.[i] || {}) });
  const id = (stage, i) => `r${stage.round}g${(stage.firstGame || 0) + i}`;
  return [
    {
      id: id(semis, 0), round: semis.round, date: semis.date,
      home: 'seed:1', away: 'seed:4',
      phase: 'playoff', playoff: 'semi-a',
      label: 'Semifinal A · Seed 1 vs Seed 4',
      ...at(semis, 0),
    },
    {
      id: id(semis, 1), round: semis.round, date: semis.date,
      home: 'seed:2', away: 'seed:3',
      phase: 'playoff', playoff: 'semi-b',
      label: 'Semifinal B · Seed 2 vs Seed 3',
      ...at(semis, 1),
    },
    {
      id: id(finals, 0), round: finals.round, date: finals.date,
      home: 'loser:semi-a', away: 'loser:semi-b',
      phase: 'playoff', playoff: 'consolation',
      label: '3rd Place Game',
      ...at(finals, 0),
    },
    {
      id: id(finals, 1), round: finals.round, date: finals.date,
      home: 'winner:semi-a', away: 'winner:semi-b',
      phase: 'playoff', playoff: 'final',
      label: 'Championship Final',
      ...at(finals, 1),
    },
  ];
}

/* =============================================================================
   Season 5 (archived) — 8-week ATX league, weeks 1–6 regular, 7–8 playoffs
   ============================================================================ */
const SEASON5_TEAMS = [
  { id: 'capybara', name: 'Capybara',      color: '#0ea5e9', captain: 'Reuben' },
  { id: 'team1',    name: 'Flying Hellfish', color: '#22c55e', captain: 'Rich' },
  { id: 'team2',    name: 'Lone Starfish', color: '#f59e0b', captain: 'Zach' },
  { id: 'team3',    name: 'Splash Damage', color: '#ef4444', captain: 'River' },
];

/* Captains keep team affiliation; others were drafted (live rosterAssignments). */
const SEASON5_ROSTER = [
  'reuben', 'rich', 'river', 'zach', 'eric', 'justin',
  'bonney', 'max', 'lesley', 'michal', 'sk', 'jacqueline',
  'kellie', 'sage', 'walter', 'glenn', 'liam', 'eddy', 'jack',
  'andriy', 'scroc', 'judson', 'mauricio', 'shaneye', 'brooke', 'travis',
  'jamese', 'kora', 'scheese', 'kevin', 'benb', 'patrick',
  'manny', 'will',
];

function buildSeason5Schedule(season) {
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
    const iso = addDays(season.startDate, i * 7);
    games.forEach(([home, away], gi) =>
      matches.push({
        id: `r${i + 1}g${gi}`,
        round: i + 1,
        date: iso,
        home,
        away,
        phase: 'regular',
        slot: gi === 0 ? '8am' : '9am',
        timeLabel: gi === 0 ? '8:00 AM' : '9:00 AM',
      }));
  });

  // Week 7 — Semifinals (seeds 1v4 @ 8am, 2v3 @ 9am); Week 8 — 3rd place @ 8am, final @ 9am
  const slots = [{ slot: '8am', timeLabel: '8:00 AM' }, { slot: '9am', timeLabel: '9:00 AM' }];
  matches.push(...bracketMatches(
    { round: 7, date: addDays(season.startDate, 6 * 7), times: slots },
    { round: 8, date: addDays(season.startDate, 7 * 7), times: slots },
  ));
  return matches;
}

/* =============================================================================
   UTL Nationals (current) — 6-team tournament.
   Texas sends three drafted teams. SC Guapos and KC Misfits bring set rosters
   (not drafted). LSOC is still a visiting club — series scores only.
   ============================================================================ */
const NATIONALS_TEAMS = [
  { id: 'tx1',       name: 'Lone Starfish', color: '#f59e0b', captain: 'Zach',         region: 'TX' },
  { id: 'tx2',       name: 'Capybaras',     color: '#0ea5e9', captain: 'Reuben',       region: 'TX' },
  { id: 'tx3',       name: 'Splash Damage', color: '#ef4444', captain: 'River',        region: 'TX' },
  { id: 'scguapos',  name: 'SC Guapos',     color: '#a855f7', captain: 'Erik Flegal',  region: 'SC' },
  { id: 'kcmisfits', name: 'KC Misfits',    color: '#ec4899', captain: 'Jeremy Gulley', region: 'KC' },
  { id: 'lsoc',      name: 'LSOC',          color: '#22c55e', visiting: true },
];

/* Texas draft pool, plus the locked SC Guapos and KC Misfits rosters. */
const NATIONALS_ROSTER = [
  'sk', 'jacqueline', 'reuben', 'max', 'sage', 'john', 'trevor',
  'glenn', 'bonney', 'lesley', 'zach', 'scheese', 'rich', 'eric',
  'justin', 'benb', 'manny', 'eddy', 'jack', 'river', 'walter',
  'erikflegal', 'aquilaturk', 'chrisemde', 'isaackeohone', 'lanejohnson',
  'matmacdonnell', 'rickyquintero', 'samuelbrooks', 'josecaride',
  'jeremygulley', 'scottstecklein', 'xavierperry', 'elimills', 'nickfisher',
  'graydenpeoples', 'joshpreston', 'israelgulley', 'mikejohnson',
];

/* Tournament weekend — Sat Nov 7 (round robin) and Sun Nov 8 (placement games). */
const NATIONALS_DAYS = ['2026-11-07', '2026-11-08'];

function buildNationalsSchedule() {
  // Saturday (round 1): single round robin — every team plays the other five once.
  // LSOC vs KC Misfits opens the tournament, and the order gives every team at least
  // one game off between games.
  const saturday = [
    ['lsoc', 'kcmisfits'], ['tx1', 'tx3'], ['scguapos', 'tx2'],
    ['tx1', 'kcmisfits'], ['lsoc', 'scguapos'], ['tx2', 'tx3'],
    ['tx1', 'scguapos'], ['kcmisfits', 'tx3'], ['lsoc', 'tx2'],
    ['tx3', 'scguapos'], ['tx1', 'lsoc'], ['tx2', 'kcmisfits'],
    ['tx3', 'lsoc'], ['scguapos', 'kcmisfits'], ['tx1', 'tx2'],
  ];
  const [satDay, sunDay] = NATIONALS_DAYS;
  const game = (n) => ({ timeLabel: `Game ${n}` });

  const matches = saturday.map(([home, away], i) => ({
    id: `r1g${i}`, round: 1, date: satDay, home, away,
    phase: 'regular',
    ...game(i + 1),
  }));

  // Sunday (round 2): Saturday's standings seed the semis, then 3rd place + final.
  matches.push(...bracketMatches(
    { round: 2, date: sunDay, times: [game(1), game(2)] },
    { round: 2, firstGame: 2, date: sunDay, times: [game(3), game(4)] },
  ));
  return matches;
}

/* =============================================================================
   Season registry — first non-archived entry is the default view.
   ============================================================================ */
const SEASONS = [
  {
    id: 'nationals',
    label: 'UTL Nationals',
    tag: 'NAT',
    archived: false,
    startDate: NATIONALS_DAYS[0],
    venue: 'Austin, Texas',
    overviewSub: 'Nov 7–8, 2026 · Austin, Texas · 6-team tournament · Saturday round robin, Sunday placement games',
    footer: 'Nov 7–8, 2026',
    scheduleSub: 'Saturday: round robin — every team plays the other five once · Sunday: placement — Saturday\'s top 4 seeds play the Semifinals (1 vs 4, 2 vs 3), then the 3rd-place game and the Championship Final',
    roundNoun: 'Day',
    roundAbbr: 'D',
    roundTitles: { 1: 'Saturday, Nov 7 · Round robin', 2: 'Sunday, Nov 8 · Placement' },
    teams: NATIONALS_TEAMS,
    rosterIds: NATIONALS_ROSTER,
    baseTeams: {
      zach: 'tx1', reuben: 'tx2', river: 'tx3',
      erikflegal: 'scguapos', aquilaturk: 'scguapos', chrisemde: 'scguapos',
      isaackeohone: 'scguapos', lanejohnson: 'scguapos', matmacdonnell: 'scguapos',
      rickyquintero: 'scguapos', samuelbrooks: 'scguapos', josecaride: 'scguapos',
      jeremygulley: 'kcmisfits', scottstecklein: 'kcmisfits', xavierperry: 'kcmisfits',
      elimills: 'kcmisfits', nickfisher: 'kcmisfits', graydenpeoples: 'kcmisfits',
      joshpreston: 'kcmisfits', israelgulley: 'kcmisfits', mikejohnson: 'kcmisfits',
    },
    playoffSeeds: [],
    minNights: 0,
    faqSchedule:
      'UTL Nationals is a 6-team tournament: Lone Starfish, Capybaras and Splash Damage (drafted from the ' +
      'Texas pool) plus SC Guapos, KC Misfits and LSOC, played Nov 7–8, 2026 in Austin, Texas. ' +
      'Saturday is a single round robin — every team plays the other five once (3 points for a win, ' +
      '1 for a draw) — and the final standings set Sunday\'s placement games: Semifinals are Seed 1 vs ' +
      'Seed 4 and Seed 2 vs Seed 3, followed by the 3rd-place game and the Championship Final.',
    schedule: buildNationalsSchedule,
  },
  {
    id: 'season5',
    label: 'Season 5',
    tag: 'S5',
    archived: true,
    startDate: '2026-08-23',
    weeks: 8,
    venue: 'Deepend Fitness — Austin, Texas',
    overviewSub: 'Started Aug 23, 2026 · 8 weeks · season complete',
    footer: 'started Aug 23, 2026',
    scheduleSub: 'Weeks 1–6 regular season · Weeks 7–8 playoffs · First game 8:00 AM · Second game 9:00 AM',
    roundNoun: 'Week',
    roundAbbr: 'W',
    roundTitles: { 7: 'Week 7 · Semifinals', 8: 'Week 8 · Finals' },
    teams: SEASON5_TEAMS,
    rosterIds: SEASON5_ROSTER,
    baseTeams: null, // PLAYERS teamIds are the Season 5 base
    /* Official Season 5 playoff seeds (locked):
       1 Lone Starfish · 2 Capybara · 3 Splash Damage · 4 Flying Hellfish */
    playoffSeeds: ['team2', 'capybara', 'team3', 'team1'],
    minNights: 4,
    faqSchedule:
      'Season 5 ran 8 weeks — Sunday league nights starting August 23, 2026. ' +
      'Weeks 1–6 were the regular season (each team played once per week; two games per night). ' +
      'Standings use 3 points for a win, 1 for a draw, 0 for a loss. ' +
      'Weeks 7–8 were playoffs: Week 7 semis were Seed 1 vs Seed 4 (8:00 AM) and Seed 2 vs Seed 3 (9:00 AM); ' +
      'Week 8 was the 3rd-place game at 8:00 AM and the championship final at 9:00 AM.',
    schedule: buildSeason5Schedule,
  },
];

const SEASON_KEY = 'atxutl.season';
const DEFAULT_SEASON = SEASONS.find((s) => !s.archived) || SEASONS[0];
const findSeason = (id) => SEASONS.find((s) => s.id === id) || null;

/* ?season= wins (and is remembered for this tab); otherwise the tab's last pick. */
function resolveSeason() {
  let fromUrl = null;
  try { fromUrl = new URLSearchParams(window.location.search).get('season'); } catch (e) { /* ignore */ }
  if (findSeason(fromUrl)) {
    try { sessionStorage.setItem(SEASON_KEY, fromUrl); } catch (e) { /* ignore */ }
    return findSeason(fromUrl);
  }
  let saved = null;
  try { saved = sessionStorage.getItem(SEASON_KEY); } catch (e) { /* ignore */ }
  return findSeason(saved) || DEFAULT_SEASON;
}

const SEASON = resolveSeason();
const TEAMS = SEASON.teams;
if (SEASON.baseTeams) {
  PLAYERS.forEach((p) => { p.teamId = SEASON.baseTeams[p.id] || 'fa'; });
}

const LEAGUE = {
  name: 'ATX UTL',
  full: 'Austin Underwater Torpedo League',
  venue: SEASON.venue,
  season: SEASON.label,
  startDate: SEASON.startDate,
  weeks: SEASON.weeks || null,
  poolDepth: '14 ft',
  seed: 20260823,
};

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

/* ---- Other seasons' box totals for the Overall (all-seasons) view.
        Shape: { [seasonId]: { [playerId]: { goals, assists, ... matches } } }
        Filled by StatsHub from each other season's saved match results;
        careerTotals sums these with the active season. ---------------------- */
const STAT_ZERO = () => ({
  goals: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0,
  swimOffAttempts: 0, swimOffs: 0, shots: 0, matches: 0,
});
const OTHER_SEASON_TOTALS = {};

const rosterOf = (tid) => PLAYERS.filter((p) => p.teamId === tid);
const FA_POOL = PLAYERS.filter((p) => p.teamId === 'fa').map((p) => p.id);
let guestIdx = 0;
const nextGuest = () => {
  const id = FA_POOL[guestIdx++ % FA_POOL.length];
  return PLAYERS.find((p) => p.id === id);
};

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

/* ---- Assemble season: fixtures start upcoming; StatsHub overlays results --- */
const MATCHES = (() => {
  const sched = SEASON.schedule(SEASON);
  return sched.map((m) =>
    ({ ...m, status: 'scheduled', homeScore: null, awayScore: null, box: [], homeLineup: [], awayLineup: [] }));
})();

/* ---- Availability for the season's game days (season roster only) -------- */
const AVAILABILITY = (() => {
  // scheduled game days, padded with weekly nights up to the season's minimum
  const nights = [...new Set(MATCHES.filter((m) => m.status === 'scheduled').map((m) => m.date))].sort();
  const allDates = MATCHES.map((m) => m.date).sort();
  let cursor = new Date((nights[nights.length - 1] || allDates[allDates.length - 1]) + 'T00:00:00');
  while (nights.length < (SEASON.minNights || 0)) {
    cursor.setDate(cursor.getDate() + 7);
    nights.push(cursor.toISOString().slice(0, 10));
  }
  const playable = SEASON.rosterIds
    .map((id) => PLAYERS.find((p) => p.id === id))
    .filter(Boolean);
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
  seasonRosterIds: SEASON.rosterIds,
  matches: MATCHES,
  availability: AVAILABILITY,

  season: SEASON,
  defaultSeasonId: DEFAULT_SEASON.id,
  seasons: SEASONS.map(({ id, label, tag, archived }) => ({ id, label, tag, archived })),
  isArchived: () => !!SEASON.archived,

  /** Reload the current page on another season (keeps the hash / active tab). */
  switchSeason(id) {
    if (!findSeason(id)) return;
    try { sessionStorage.setItem(SEASON_KEY, id); } catch (e) { /* ignore */ }
    const url = new URL(window.location.href);
    if (id === DEFAULT_SEASON.id) url.searchParams.delete('season');
    else url.searchParams.set('season', id);
    if (url.href === window.location.href) window.location.reload();
    else window.location.assign(url.href);
  },

  roundName: (n) => `${SEASON.roundNoun} ${n}`,
  roundShort: (n) => `${SEASON.roundAbbr}${n}`,
  roundTitle: (n) => (SEASON.roundTitles && SEASON.roundTitles[n]) || `${SEASON.roundNoun} ${n}`,

  /** Teams whose players are tracked here (a visiting club has no roster). */
  rosterTeams: () => TEAMS.filter((t) => !t.visiting),

  torpedoScore(p) {
    const w = AWARDS.torpedo;
    return p.goals * w.goals + p.assists * w.assists;
  },
  gloveScore(p) {
    const w = AWARDS.glove;
    return p.blocks * w.blocks + p.steals * w.steals;
  },

  /** Players with at least one match, already sorted by rating. */
  playedPlayers() {
    return this.ratedPlayers().filter((p) => p.matches > 0);
  },

  /**
   * Live top-N for Overview award tiles. Recomputed from current box scores
   * (including StatsHub overlays) so the lists move as stats are saved.
   * kind: 'rated' | 'torpedo' | 'glove'
   */
  awardContenders(kind, n = 5) {
    const played = this.playedPlayers();
    const ranked = kind === 'torpedo'
      ? [...played].sort((a, b) => this.torpedoScore(b) - this.torpedoScore(a) || b.goals - a.goals)
      : kind === 'glove'
        ? [...played].sort((a, b) => this.gloveScore(b) - this.gloveScore(a) || b.blocks - a.blocks)
        : played;
    return ranked.slice(0, n);
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

  isRegular: (m) => (m.phase || 'regular') === 'regular',

  /** Regular-season (pool play) standings only — used for playoff seeding. */
  regularStandings() {
    const table = {};
    TEAMS.forEach((t) => (table[t.id] = { teamId: t.id, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, played: 0 }));
    this.finals().filter((m) => this.isRegular(m)).forEach((m) => {
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
   * Locked playoff seeds for the active season (empty = seed from standings
   * once every regular-season / pool-play match is final).
   */
  playoffSeeds: SEASON.playoffSeeds || [],

  /**
   * Fill playoff home/away from seeds + completed semis.
   * Always resolves placeholders — even after a match is marked final — so the
   * schedule and /stats entry never stay stuck on "Seed 1" / "Winner TBD".
   * Mutates MATCHES in place (same pattern as StatsHub overlays).
   */
  refreshPlayoffAssignments() {
    const locked = this.playoffSeeds && this.playoffSeeds.length >= 4;
    const regularDone = MATCHES.filter((m) => this.isRegular(m)).every((m) => m.status === 'final');
    const seeds = locked
      ? this.playoffSeeds.slice()
      : (regularDone ? this.regularStandings().map((s) => s.teamId) : []);
    const seedOf = (n) => seeds[n - 1] || `seed:${n}`;
    const bySlot = {};
    MATCHES.forEach((m) => {
      if (m.playoff) bySlot[m.playoff] = m;
    });

    const semiA = bySlot['semi-a'];
    const semiB = bySlot['semi-b'];
    const final = bySlot.final;
    const consol = bySlot.consolation;

    // Semis always follow the seed bracket (1v4 @ 8am, 2v3 @ 9am).
    if (semiA) {
      semiA.home = seedOf(1);
      semiA.away = seedOf(4);
    }
    if (semiB) {
      semiB.home = seedOf(2);
      semiB.away = seedOf(3);
    }

    // Championship / 3rd place: winners & losers of semis when known.
    if (final && semiA && semiB) {
      const wA = this.playoffWinner(semiA);
      const wB = this.playoffWinner(semiB);
      final.home = wA || 'winner:semi-a';
      final.away = wB || 'winner:semi-b';
    }
    if (consol && semiA && semiB) {
      const lA = this.playoffLoser(semiA);
      const lB = this.playoffLoser(semiB);
      consol.home = lA || 'loser:semi-a';
      consol.away = lB || 'loser:semi-b';
    }
    return MATCHES;
  },

  rosterOf: (tid) => rosterOf(tid),
  freeAgents: () => PLAYERS.filter((p) => p.teamId === 'fa'),
  seasonRoster: () => SEASON.rosterIds.map((id) => PLAYERS.find((p) => p.id === id)).filter(Boolean),
  inSeason: (id) => SEASON.rosterIds.includes(id),

  finals: () => MATCHES.filter((m) => m.status === 'final'),
  upcoming: () => MATCHES.filter((m) => m.status === 'scheduled'),

  /** Regular season / pool play only — playoffs do not affect the table. */
  standings() {
    return this.regularStandings();
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

  /** Store another season's per-player totals (from its saved results). */
  setSeasonTotals(seasonId, totals) {
    if (!seasonId || seasonId === SEASON.id) return;
    OTHER_SEASON_TOTALS[seasonId] = totals || {};
  },

  /* All-time totals: every other season's totals + current season box scores */
  careerTotals() {
    const season = this.playerTotals();
    const totals = {};
    PLAYERS.forEach((p) => {
      const acc = STAT_ZERO();
      Object.values(OTHER_SEASON_TOTALS).forEach((seasonMap) => {
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
