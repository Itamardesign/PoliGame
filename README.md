# Coalition Chaos — Road to 61

A complete static, mobile-friendly Three.js arcade game about Israeli coalition chaos. Nonpartisan satire, with English and Hebrew UI. No signup or backend required.

## Play locally

Run `npm start`, then open `http://127.0.0.1:4173`. Serve `dist/` on any static host for production. Three.js is vendored with its MIT license; Google Fonts are optional with system fallbacks.

## Gameplay

Chaos edition: you have 61 seconds and start with 24 seats. Steer with arrow keys, A/D, swipes or on-screen arrows. Blue seats add 3; every fifth consecutive pickup adds 6. Red barriers remove 12, break the streak and add one scandal. Three scandals end the run regardless of seats. Falafel absorbs one collision.

Gold briefcases offer a deliberate gamble: +9 seats, +1 scandal, and a broken streak. A shield cannot erase the cost. After the first majority, four seats defect after six seconds, then every four seconds, even if the coalition drops below 61. Keep collecting to finish with a majority. Zero seats ends the run early; seats are capped at 120.

Space or the SPIN button clears nearby red barriers across all lanes. It has a 12-second cooldown and is only spent when a barrier is in range. Esc/P pauses. Speed and obstacle density rise across four phases, ending in the no-confidence vote. Every generated row retains one risk-free pickup lane.

Points combine survival time, pickups, best streak, time holding a majority and remaining seats, with a win bonus. The new rules use a separate personal-best key so scores from the easier original version are not mixed in.

Daily Chaos uses a deterministic course seeded by the Jerusalem calendar date and ruleset. Personal best and preferences are device-local. The share button copies a personalized roast, score receipt and challenge URL; it never sends messages automatically. A manual-copy fallback handles clipboard restrictions. Challenge links carry the exact course seed and ruleset, including daily courses, so friends play the same road even on another day. The results compare the friend's score with yours. Replay keeps the same seed for revenge; a separate button rolls a fresh road. Results are casual and not independently verified.

## Design rationale

- Immediate play, short rounds, fast retries, no login friction.
- Political math becomes a readable mechanic: collect seats and protect a majority.
- Fictional scandals and coalition bargaining jokes avoid favoring a party.
- Same-course daily challenges and score links support group-chat competition.
- Procedural 3D geometry, shared materials and a capped rendering resolution keep downloads and GPU load modest.

## Validation

`npm test` checks scoring, shields, three-scandal loss, gold-deal risk, duration, defections, spin cooldown, seat caps, course determinism, seed-link validation and reachability. Simulations cover winning perfect routes and losing stationary strategies. `npm run check` checks game script syntax.

## Election context

The Knesset has 120 members; 61 is an absolute majority. The electoral threshold is 3.25% of valid votes. Government formation follows confidence procedures; this is an arcade simplification, not an accurate government formation simulator. No real polling is represented and no election date is asserted in the game.

Primary sources researched September 22, 2026:
- https://main.knesset.gov.il/en/mk/pages/elections.aspx
- https://main.knesset.gov.il/EN/About/Pages/KnessetWork.aspx
- https://www.gov.il/BlobFolder/guide/knesset25-elections-info/he/info-pages_english.pdf

## Launch scope

This is a playable game, not a guaranteed growth outcome. A million-player launch needs public hosting, load-tested delivery, real-device playtesting and distribution. No fabricated player counts or global leaderboard. This version has no analytics, accounts, ads, tracking or server-verified scores.

Optional WebMCP tools, when supported by the browser: `read_coalition_game` and `start_coalition_run`. Unsupported browsers retain the full visible game interface.
