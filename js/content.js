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
      'Each player’s core box-score (goals, assists, steals, blocks, turnovers) is weighted, ' +
      'divided by matches played (+2 prior), then normalized across the league onto a 1–10 scale. ' +
      'Swim-off attempts/wins and shots are tracked separately and do not feed the rating. ' +
      'Exact weights are on the Teams & Roster tab.',
  },
  {
    q: 'How is player position determined?',
    a:
      'Position is derived from season box scores, not assigned. ' +
      'Striker leans on goals/shots, Playmaker on assists/swim-off wins, Defender on blocks/steals. ' +
      'If the top two role scores are within 15%, both show as a combo (e.g. Striker/Defender). ' +
      'It updates automatically when new match stats are saved.',
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
      'Season 5 runs 8 weeks — Sunday league nights starting August 23, 2026. ' +
      'Weeks 1–6 are the regular season (each team plays once per week; two games per night). ' +
      'Standings use 3 points for a win, 1 for a draw, 0 for a loss. ' +
      'Weeks 7–8 are playoffs: Week 7 semis are Seed 1 vs Seed 4 and Seed 2 vs Seed 3; ' +
      'Week 8 is the championship final (semi winners) plus a 3rd-place game (semi losers).',
  },
  {
    q: 'How do I contest a box-score stat?',
    a:
      'Open a player spotlight or profile and tap Stat contention. Pick the match and stat, ' +
      'propose a value (contest an existing number or request a missing credit), add a comment, ' +
      'and optionally a video link. Captains and admin vote on /admin — after 5 votes, a majority ' +
      'for the request passes it so staff can apply the change to the box score.',
  },
  {
    q: 'How do game-day volunteers work?',
    a:
      'Use the Volunteer tab to sign up for referee, camera, or safety for a given week. ' +
      'The first signup is primary; anyone after that is a backup. You can remove yourself; ' +
      'if the primary leaves, the next backup becomes primary. Backups can also be promoted manually.',
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
  // Fallback folder base when Firebase has no film URL for a match.
  // Live links live in RTDB `/matchFilm/season5/{matchId}` (FilmHub).
  // Per-game folder slug: clips/r5-capybara-vs-team3/
  filmBase: 'clips/',

  // Offline / pre-Firebase fallback only. Prefer saving links via
  // Match stats → Game film (writes FilmHub) so open tabs update live.
  filmByMatchId: {},

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
    { kind: 'photo', title: 'Deepend Fitness — 14 ft arena', date: '2026-08-23', tag: 'Venue', hue: 210 },
  ],
};

/* ---- Player stat index (Stats page glossary / scorer’s sheet) ------------ */
const PLAYER_STAT_INDEX = [
  {
    key: 'G', name: 'Goals',
    desc:
      'Torpedo fully placed in the opponent’s goal on a legal play. Closest to a soccer/hockey goal. ' +
      'One value per score — no 2s/3s.',
  },
  {
    key: 'A', name: 'Assists',
    desc:
      'The last completed underwater pass or hand-off that directly leads to a teammate’s goal ' +
      '(primary assist). Credit one assist per goal when earned.',
  },
  {
    key: 'S', name: 'Steals',
    desc:
      'Taking the torpedo from the carrier, forcing an immediate change of possession while they ' +
      'still held it (takeaway), or a clear interception of an attempted pass to a teammate. ' +
      'Do not credit a steal for picking up a botched / loose pass with no clear recipient — ' +
      'that is a recovery, not an interception. Also do not credit a steal if the carrier already ' +
      'released / turned it over before contact — that is their Turnover.',
  },
  {
    key: 'B', name: 'Blocks',
    desc:
      'Stopping a scoring chance or goal-bound look only inside the scoring zone (between the near wall and the 3rd lane line). ' +
      'Do not credit blocks in mid-pool or elsewhere outside that scoring zone. ' +
      'Not every wrap or swim contact — only a clear denial of a look at goal. Distinct from a Steal ' +
      '(steal = take the torpedo; block = kill the chance without necessarily ending with possession).',
  },
  {
    key: 'TO', name: 'Turnovers',
    desc:
      'Possession ends without a shot or goal because of that player: surfacing with the torpedo, ' +
      'errant pass, stripped while carrying, or illegal score attempt (e.g. scoring off a swim-off ' +
      'with no prior pass). Lower is better; weighted negatively in Rating.',
  },
  {
    key: 'SOA', name: 'Swim-off attempts',
    desc:
      'Times this player took the swim-off after a restart. Tracked for possession; not used in Rating.',
  },
  {
    key: 'SO', name: 'Swim-off wins',
    desc:
      'Wins the swim-off — first clean underwater possession for your team after the restart buzzer. ' +
      'Hockey faceoff analog. Always ≤ attempts. Tracked for possession; not used in Rating.',
  },
  {
    key: 'SH', name: 'Shots / scoring chances',
    desc:
      'A deliberate look at goal: a shot or clear scoring chance (includes goals). Always ≥ Goals. ' +
      'Missed finishes still count as SH. Borrowed from soccer/hockey shot tracking. Not used in Rating.',
  },
  {
    key: 'MP', name: 'Matches Played',
    desc:
      'Matches the player appeared in this season. Free agents accrue MP via guest appearances.',
  },
];

/* ---- Team-profile radar dimensions (6 axes) ------------------------------ */
const TEAM_PROFILE_INDEX = [
  { key: 'Attack',     desc: 'Goals For — how much the team scores.' },
  { key: 'Defense',    desc: 'Goals Against, inverted — fewer conceded ranks higher.' },
  { key: 'Playmaking', desc: 'Total assists — passing that creates goals.' },
  { key: 'Steals',     desc: 'Takeaways from the carrier or clear interceptions of an attempted pass (not loose recoveries).' },
  { key: 'Blocks',     desc: 'Scoring chances denied inside the scoring zone only — between the near wall and the 3rd lane line (not the same as steals).' },
  { key: 'Discipline', desc: 'Turnovers, inverted — fewer giveaways ranks higher.' },
];

window.RULES = RULES;
window.FAQ = FAQ;
window.RESEARCH = RESEARCH;
window.MEDIA = MEDIA;
window.PLAYER_STAT_INDEX = PLAYER_STAT_INDEX;
window.TEAM_PROFILE_INDEX = TEAM_PROFILE_INDEX;
