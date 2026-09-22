# Coalition Chaos — Road to 61

A complete static, mobile-friendly Three.js arcade game about Israeli coalition chaos. Nonpartisan satire, with English and Hebrew UI. No signup or backend required.

## Play locally

Run `npm start`, then open `http://127.0.0.1:4173`. Serve `dist/` on any static host for production. Three.js is vendored with its MIT license; Google Fonts are optional with system fallbacks.

## Gameplay

You have 61 seconds and start with 15 seats. Steer the bus with arrow keys, A/D, swipe gestures, or the on-screen buttons. Blue seats add 3; every fifth consecutive pickup adds 6. Red barriers remove 8 and break the streak. Falafel absorbs one collision. Reach 61 and finish with a majority; zero seats ends the run early. The seat count is capped at 120.

Daily Chaos uses a deterministic course seeded by the Jerusalem calendar date. Personal best and preferences are device-local. The share button invokes native sharing or copies a challenge URL; it does not send messages automatically. Daily challenge links use the current day's course; old links retain the score target, not the old daily course. Results are casual and not independently verified.

## Design rationale

- Immediate play, short rounds, fast retries, no login friction.
- Political math becomes a readable mechanic: collect seats and protect a majority.
- Fictional scandals and coalition bargaining jokes avoid favoring a party.
- Same-course daily challenges and score links support group-chat competition.
- Procedural 3D geometry, shared materials and a capped rendering resolution keep downloads and GPU load modest.

## Validation

`npm test` checks scoring, shields, loss conditions, duration, majority timing, seat caps, course determinism and reachability. `npm run check` checks game script syntax.

## Election context

The Knesset has 120 members; 61 is an absolute majority. The electoral threshold is 3.25% of valid votes. Government formation follows confidence procedures; this is an arcade simplification, not an accurate government formation simulator. No real polling is represented and no election date is asserted in the game.

Primary sources researched September 22, 2026:
- https://main.knesset.gov.il/en/mk/pages/elections.aspx
- https://main.knesset.gov.il/EN/About/Pages/KnessetWork.aspx
- https://www.gov.il/BlobFolder/guide/knesset25-elections-info/he/info-pages_english.pdf

## Launch scope

This is a playable game, not a guaranteed growth outcome. A million-player launch needs public hosting, load-tested delivery, real-device playtesting and distribution. No fabricated player counts or global leaderboard. This version has no analytics, accounts, ads, tracking or server-verified scores.

Optional WebMCP tools, when supported by the browser: `read_coalition_game` and `start_coalition_run`. Unsupported browsers retain the full visible game interface.
