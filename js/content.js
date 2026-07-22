/* =============================================================================
   ATX UTL — Editorial content: Rules, FAQ, and Research library
   All copy lives here so the tabs stay data-driven and easy to edit.
   ============================================================================ */

const RULES = [
  {
    title: 'The objective',
    body:
      'Two teams of five compete in the deep end (ideally 13–14 ft) to place an ' +
      '~11 oz rubber torpedo into the opponent’s bottom-anchored goal. Substitutes ' +
      'wait on the wall and rotate in as players surface for air.',
  },
  {
    title: 'Match & game format',
    body:
      'A match is played to 5 points (roughly 10 minutes). A game is best-of-three ' +
      'matches — win two matches to win the game. Rounds restart from a throw-off ' +
      'after each goal.',
  },
  {
    title: 'Possession is underwater only',
    body:
      'You may swim with, hand off, or pass the torpedo — but only while submerged. ' +
      'Surface with any part of your body while holding the torpedo and it’s a ' +
      'penalty / turnover to the other team. You can surface to breathe once the ' +
      'torpedo is released.',
  },
  {
    title: 'Throw-off rule',
    body:
      'After a throw-off, at least one pass must be completed before the receiving ' +
      'team can score. Scoring straight off the throw-off with no pass is a turnover.',
  },
  {
    title: 'Contact',
    body:
      'Tackling, pulling, holding back and grappling are allowed only on the player ' +
      'in possession. Contact on players without the torpedo is foul play.',
  },
  {
    title: 'Foul play (prohibited)',
    body:
      'No kicking, punching, choking, single-limb submissions, mask/goggle ripping, ' +
      'or pulling swimwear. No fins — this keeps momentum (and collisions) low.',
  },
  {
    title: 'Safety systems',
    body:
      'Referees are in-water. A buzzer pulse stops play instantly for any foul, ' +
      'surface call or unsafe situation. Lockout and tap-out rules protect players; ' +
      'the water “keeps everyone honest.”',
  },
];

const FAQ = [
  {
    q: 'What is the Underwater Torpedo League (UTL)?',
    a:
      'A competitive underwater sport founded in 2017 by former U.S. Marine Raiders ' +
      'Prime Hall and Don Tran, evolved from military water-survival training. ATX ' +
      'UTL is the Austin, Texas chapter, played at Deepend Fitness.',
  },
  {
    q: 'How many players are on a team?',
    a: 'Five in the water per side, plus substitutes who rotate as players surface for air.',
  },
  {
    q: 'How do you score?',
    a: 'Get the torpedo into the opposing goal while staying submerged. Matches are played to 5.',
  },
  {
    q: 'How are player ratings calculated?',
    a:
      'Each player’s box-score (goals, assists, steals, blocks, turnovers) is weighted, ' +
      'divided by matches played, then normalized across the league onto a 1–10 scale. ' +
      'The exact weights are shown on the Roster tab.',
  },
  {
    q: 'Do I need freediving experience to play?',
    a:
      'No — clubs teach comfort and breath-hold progressively. Never train breath-holding ' +
      'alone or unsupervised; shallow-water blackout gives no warning.',
  },
  {
    q: 'How is the schedule structured?',
    a:
      'Season 1 is a double round-robin — every team plays every other team twice. ' +
      'Standings use 3 points for a win, 1 for a draw, 0 for a loss.',
  },
  {
    q: 'Where does ATX UTL play?',
    a: 'Eans Aquatic Center in Austin, Texas, in ~13 ft of water.',
  },
];

/* ---- Research library: UTL background + peer-reviewed UWR / apnea studies -- */
const RESEARCH = {
  intro:
    'UTL is young and largely undocumented in the sports-science literature, but it ' +
    'shares its core physiological demands — repeated maximal breath-holds, high ' +
    'anaerobic output, and cold/immersion responses — with the established sport of ' +
    'Underwater Rugby (UWR) and with competitive apnea. The studies below are the ' +
    'most relevant evidence base for training, safety and performance in torpedo-style play.',

  categories: [
    {
      name: 'Sport background (UTL)',
      items: [
        {
          title: 'Underwater Torpedo League — Official rules & about',
          source: 'UTL Nation',
          year: 2024,
          url: 'https://utlnation.com/about/',
          type: 'Primary source',
          takeaway:
            'Canonical ruleset: 5-a-side, best-of-three matches to 5 points, submerged ' +
            'possession, contact only on the torpedo carrier, referee buzzer safety stops.',
        },
        {
          title: 'What to know about the Underwater Torpedo League',
          source: 'USA Today',
          year: 2023,
          url: 'https://www.usatoday.com/story/sports/outdoors/2023/07/22/underwater-torpedo-league-what-to-know-about-popular-underwater-sport/70421372007/',
          type: 'Feature',
          takeaway:
            'Origin as Camp Pendleton water-survival training; two annual tournaments ' +
            '(spring + the Aqua Bowl); dual in-water referees for safety.',
        },
        {
          title: 'The Underwater Torpedo League Is as Wild as It Sounds',
          source: 'Outside',
          year: 2022,
          url: 'https://www.outsideonline.com/outdoor-adventure/water-activities/underwater-torpedo-league/',
          type: 'Feature',
          takeaway:
            'No-fins rule reduces collision momentum; strong safety record attributed to ' +
            'in-water refs and the self-limiting nature of breath-hold play.',
        },
      ],
    },
    {
      name: 'Underwater Rugby physiology (UWR)',
      items: [
        {
          title:
            'Evaluation of physical and physiological parameters of elite underwater rugby players',
          source: 'Journal of Human Sciences 14(4)',
          year: 2017,
          url: 'https://doi.org/10.14687/jhs.v14i4.4728',
          type: 'Peer-reviewed study',
          takeaway:
            'Elite UWR players show higher pulmonary volumes/capacities than swimmers and ' +
            'water-polo players. Breath-hold performance (50 m & 8×25 m apnea) correlated ' +
            'with body composition — a target for sport-specific conditioning.',
        },
        {
          title:
            'Assessing physical performance of UWR world champions: experts vs. novices',
          source: 'Journal of Physical Education and Sport (Art 327)',
          year: 2023,
          url: 'http://efsupit.ro/images/stories/october2023/Art327.pdf',
          type: 'Peer-reviewed study',
          takeaway:
            'Experts out-perform novices in aerobic and anaerobic power, fatigue index, ' +
            'max strength, non-linear underwater displacement and flexibility — a useful ' +
            'testing battery for player development.',
        },
      ],
    },
    {
      name: 'Apnea & breath-hold training',
      items: [
        {
          title:
            'Effect of dry dynamic apnea on aerobic power in elite athletes: a warm-up method',
          source: 'Frontiers in Physiology 14:1269656',
          year: 2023,
          url: 'https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2023.1269656/full',
          type: 'Peer-reviewed study',
          takeaway:
            'A single dry dynamic-apnea warm-up (6 max breath-holds during light cycling) ' +
            'acutely improved aerobic power vs. standard warm-up — via spleen contraction, ' +
            'raised O₂ availability and sympathetic activation.',
        },
        {
          title:
            'Apnea training adaptations in aquatic athletes (pilot case studies)',
          source: 'Semantic Scholar preprint',
          year: 2019,
          url: 'https://pdfs.semanticscholar.org/9d71/a5b79188d07415e883b888bfa36708ee5536.pdf',
          type: 'Review / pilot',
          takeaway:
            'Long-term apnea conditioning strengthens the diving reflex and extends ' +
            'breath-hold, but benefits are highly protocol- and sport-specific — static ' +
            'vs. dynamic, wet vs. dry matters.',
        },
      ],
    },
  ],

  safety: [
    'Never breath-hold alone or unsupervised in water — shallow-water blackout gives no warning.',
    'Do not hyperventilate before a hold; it suppresses the urge to breathe and raises blackout risk.',
    'Always train with a spotter/buddy and clear surface-and-recover signals.',
    'Keep aggressive CO₂ tables dry; keep in-water O₂/hold work supervised.',
  ],
};

/* ---- Media gallery -------------------------------------------------------- */
const MEDIA = {
  // Each game tile links to a folder of uploaded clips. Point this at wherever
  // your clips live (a relative folder next to the site, a Google Drive folder,
  // an S3 bucket, etc.). The per-game folder slug is appended, e.g.
  //   clips/r5-makos-vs-carp/
  filmBase: 'clips/',

  featured: {
    kind: 'video',
    title: 'Aqua Bowl spirit — full-send torpedo battles',
    source: 'UTL Nation',
    url: 'https://www.youtube.com/results?search_query=underwater+torpedo+league',
    tag: 'Featured',
    hue: 200,
    desc:
      'A taste of top-level torpedo play: bottom-of-the-pool scrambles, breath-hold ' +
      'runs and goal-line stands. (Links out to UTL footage.)',
  },
  items: [
    { kind: 'photo', title: 'Makos vs Legion — Round 4 opener', team: 'makos', date: '2026-06-28', tag: 'Game photo', hue: 200 },
    { kind: 'video', title: 'Lesley’s buzzer-beater from the throw-off', team: 'makos', date: '2026-06-28', tag: 'Highlight', hue: 195 },
    { kind: 'photo', title: 'Carp defensive wall holds the line', team: 'carp', date: '2026-06-21', tag: 'Game photo', hue: 38 },
    { kind: 'video', title: 'George hat-trick reel', team: 'carp', date: '2026-06-21', tag: 'Highlight', hue: 40 },
    { kind: 'photo', title: 'Chlorine Crocs pre-dive huddle', team: 'crocs', date: '2026-06-14', tag: 'Behind the scenes', hue: 140 },
    { kind: 'video', title: 'Glenn’s goal-line steal of the season', team: 'crocs', date: '2026-06-14', tag: 'Highlight', hue: 150 },
    { kind: 'photo', title: 'Legion rookies’ first league night', team: 'legion', date: '2026-06-07', tag: 'Game photo', hue: 0 },
    { kind: 'video', title: 'SK breaks the lockout — fast break', team: 'legion', date: '2026-06-07', tag: 'Highlight', hue: 5 },
    { kind: 'photo', title: 'Deepend Fitness — 14 ft arena', date: '2026-06-07', tag: 'Venue', hue: 210 },
  ],
};

/* ---- Player stat index (Stats page glossary) ----------------------------- */
const PLAYER_STAT_INDEX = [
  { key: 'G',  name: 'Goals',          desc: 'Torpedo placed in the opponent’s goal — the primary scoring stat.' },
  { key: 'A',  name: 'Assists',        desc: 'A pass or hand-off that directly leads to a teammate’s goal.' },
  { key: 'S',  name: 'Steals',         desc: 'Taking the torpedo away from an opponent (a takeaway / turnover forced).' },
  { key: 'B',  name: 'Blocks',         desc: 'Stopping a shot or intercepting a pass — usually defenders and goalies.' },
  { key: 'TO', name: 'Turnovers',      desc: 'Losing possession — surfacing with the torpedo, a bad pass, or losing a wrap-up. Lower is better (weighted negatively in Rating).' },
  { key: 'MP', name: 'Matches Played', desc: 'Games the player appeared in this season. Free agents accrue this via guest appearances.' },
];

/* ---- Team-profile radar dimensions (6 axes) ------------------------------ */
const TEAM_PROFILE_INDEX = [
  { key: 'Attack',     desc: 'Goals For — how much the team scores.' },
  { key: 'Defense',    desc: 'Goals Against, inverted — fewer conceded ranks higher.' },
  { key: 'Playmaking', desc: 'Total assists — passing that creates goals.' },
  { key: 'Steals',     desc: 'Total takeaways won from opponents.' },
  { key: 'Blocks',     desc: 'Shots and passes stopped.' },
  { key: 'Discipline', desc: 'Turnovers, inverted — fewer giveaways ranks higher.' },
];

window.RULES = RULES;
window.FAQ = FAQ;
window.RESEARCH = RESEARCH;
window.MEDIA = MEDIA;
window.PLAYER_STAT_INDEX = PLAYER_STAT_INDEX;
window.TEAM_PROFILE_INDEX = TEAM_PROFILE_INDEX;
