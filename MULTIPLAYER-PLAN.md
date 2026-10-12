# Multiplayer plan — Coalition Kart

Goal: 2–3 human drivers plus bots filling the remaining seats (6 karts total, e.g. 2+4 or 3+3), first on one screen, then online.

The work is split into phases. Each one ships on its own, and every later phase builds on Phase 1.

| Phase | What you get | Estimate |
| --- | --- | --- |
| 1. N-human core | Simulation supports any number of humans; single-player unchanged | 2–3 days |
| 2. Split-screen | 2–3 players on one computer (keyboard + gamepads) | 2–3 days |
| 3. Online | Room codes, each player on their own device, phones included | 1–2 weeks |
| 4. Polish & QA | Lag tuning, reconnects, tests, deploy | 3–5 days |

Grand Prix mode (`gp.js`, coalitions, handicaps) stays single-player in v1. It is built around one party forming a coalition. Multiplayer is for single races only.

---

## Phase 1 — Support N humans in the simulation

Today "the player" means `racers[0]` with `player: true`. That flag is used in about 60 places, with three different meanings:

1. **This kart is driven by a human** (simulation)
2. **This is the kart the camera follows** (rendering)
3. **This is "you" in the text** (HUD and Hebrew messages: "אתם")

Split it into:

- `r.human` (boolean) and `r.seat` (0..n-1) — set in `makeRace`. Used by the simulation.
- `viewerId` — which racer a given screen is showing. Used by the renderer, HUD and audio only. Never stored in `race`.

### 1.1 `race-model.js`
- `makeRace(..., options.humans = [partyId, ...])`. The grid order puts humans first. `brain` is created only for non-humans.
- **Pull the per-racer body of `stepRace` out into `stepRacer(race, r, dt, control, curve)`.** Phase 3's client prediction also needs this, so do it now.
- `stepRace(race, dt, inputs, curves)`: `inputs` and `curves` are keyed by racer id. Humans read from `inputs` and bots from `aiInput`. Keep a compatibility path so the current `stepRace(race, dt, input, curve)` call still works for single-player and the existing tests.
- **Catch-up / rubber-banding** (`lead` at line ~367, and the `if (!r.player)` pace block): bots pace against the *leading human* rather than `racers[0]`. Without this, bots wait for the slowest human, which feels unfair to the faster ones.
- **End of race** (around line ~523): today the race ends the moment the player finishes. New rule: `race.done` when *all humans* have finished, **or** 20 seconds after the first human finishes (remaining humans get a projected time, as bots do now). Expose `race.finishedHumans` so the UI can show "waiting for…".
- **Stats** `race.drifts / jumps / used / shortcuts`: move them onto each racer (`r.stats.drifts` …) so every human gets their own results line.
- `startRace(race, launches)`: launch boost per human seat.
- Handicap and coalition checks (`r.player && race.handicap…`): change to `r.human`. They are inactive outside GP anyway.

### 1.2 Other simulation modules
- `race-ai.js:162` (`player = racers.find(o => o.player)`) and `:184`, `:286`: "is a human" → `o.human`. The AI's blocking and targeting should treat every human as a preferred target, not just one.
- `race-items.js:40,48,55`: `racer.player` → `racer.human`. `race.used++` moves onto the racer.
- `kart-encounters.js:10,11,44,88`: `r.player` → `r.human`. Note that line 10 depends on `wasRoute` / `before`, which kart.js passes only for the player. Store `r.prevS` / `r.prevRoute` for every racer inside `stepRacer` and drop those arguments.

### 1.3 Renderer, HUD and menus: one viewer instead of `racers[0]`
Replace `race.racers[0]` with `viewer()` (the racer for `viewerId`) in:
- `kart.js` — 188, 370–371, 531, 538, 568–586 (event filtering: "is this event about me?"), 625, 739 (hide own name tag), 777, 804, 807, 861, 896, 961, 1095.
- `kart-hud.js` — 48–80 (Hebrew phrasing: "אתם" when `e.id === viewerId`, the leader's name otherwise, including other humans), 93, 145–149, 156, 178–179.
- `kart-menus.js:80,98` — results list marks "· אתם" for the viewer and shows other humans by their leader name.
- `kart-effects.js:118,211,217,243,315` — screen shake only for the viewer.
- `kart-motion.js:127` — idle head-bob for everyone except humans.
- Events: `emitRace` already includes `player: racer.player`. Change it to `human`, and let consumers compare `e.id === viewerId`.

### 1.4 Tests
- Add `tests/multi.test.mjs`: a 2-human race where both inputs are scripted. Check that it finishes, that ranking contains both, that it ends only after both finish (or the 20-second rule), and that bots pace against the leading human.
- All existing tests (`npm test`) must pass unchanged. Single-player is just `humans: [selected]`.

**Done when:** the single-player game plays exactly as before, and `tools/sim.mjs` can run a headless 3-human + 3-bot race.

---

## Phase 2 — Split-screen (same computer)

### 2.1 Input
Currently arrows *and* WASD both drive one kart. In multiplayer they split:

| | Steer | Gas / brake | Drift | Item | Ability |
| --- | --- | --- | --- | --- | --- |
| P1 | A / D | W / S | Left Shift | Space | E |
| P2 | ← / → | ↑ / ↓ | Right Shift | Enter | / (slash) |
| P3 | Gamepad 1 | Left stick / triggers | B / RB | A | Y |

- `kart-input.js`: `KEY_ACTIONS` becomes per-seat maps. Add `readGamepad(index)` using the browser Gamepad API (`navigator.getGamepads()`), polled in `frame()`.
- Single-player keeps today's mapping (both sets → seat 0).
- Pause (Esc/P) is shared. Camera toggle (C) cycles the camera of the focused viewport, or of all of them.

### 2.2 Rendering
- One `WebGLRenderer`, with N cameras. Each frame, loop over viewports using `renderer.setViewport` + `setScissor` + `setScissorTest(true)`.
  - 2 players: left/right halves (better than top/bottom for a racer on a wide screen).
  - 3 players: three columns, or a 2+1 layout. Try both.
- `setCamera()` (kart.js:746) becomes `setCamera(cam, viewer, state)`. `camSwing` and the camera mode move into a per-viewport object.
- Performance: the scene is drawn N times. With split-screen active, lower the pixel ratio cap from 1.6 to about 1.0 and reduce shadow-map size. Measure with `tools/perf.mjs`.

### 2.3 HUD
- The HUD is DOM over the canvas. Create one HUD container per viewport (`makeHud` is already a factory, so call it N times), each absolutely positioned over its viewport.
- Shared elements (countdown, pause menu, results) stay centered and global.
- Minimap: one shared map in the middle, with every human highlighted in their party color.

### 2.4 Menus
- Home screen: a "שחקנים: 1 / 2 / 3" (players) toggle in single-race mode. Each human picks a distinct party in turn ("P2, choose your leader"). Bots take the remaining parties.
- Results: show the full ranking, highlighting every human.
- Split-screen is hidden on touch devices.

**Done when:** two people can finish a 3-lap race side by side at 60 fps on a mid-range laptop. A browser test (`tests/split-browser.mjs`) drives both seats with keyboard input.

---

## Phase 3 — Online

### 3.1 Architecture: host-authoritative
- **The host is one player's browser.** It runs the full simulation: all karts, bots, items, pickups, encounters and collisions (`stepRace`, `stepEncounters`, `bumpRivals`).
- **Guests** send only their inputs. They receive snapshots and events, and render them with the existing renderer.
- **Relay server**: a small WebSocket server that forwards messages within a room. It contains no game logic.
  - Vercel cannot hold WebSocket connections, so the game stays on Vercel and the relay is deployed separately.
  - **Chosen: Cloudflare Workers + Durable Objects (Workers Free plan)**, in a new `relay/` folder deployed with `wrangler`. Each room code maps to one Durable Object (`idFromName(code)`), and that object holds the room's WebSockets and forwards messages.
    - Why not Render free: it spins down after 15 idle minutes and takes about 1 minute to wake, which is bad for "join my room". Its nearest region to Israel is Frankfurt. Cloudflare has no cold start, runs close to the players, and the account already exists.
    - Free-plan budget: 100k requests/day, where incoming WebSocket messages count 20:1, and 13,000 GB-s/day of duration. One 3-player race (~3 min, ~100 incoming msgs/s) ≈ 900 request units, which is **roughly 100 races per day for free**. Duration allows about 29 hours of live rooms per day. Going over the limit makes requests fail until 00:00 UTC. You are never billed.
    - Ways to stretch the budget: send guest inputs at 20/s instead of 30, put `events` inside `snap`, and use the WebSocket Hibernation API so empty lobbies cost no duration.
  - For local development, run the relay with `wrangler dev` (local Durable Objects).
  - The client reads the relay URL from a constant or query param (for example `?relay=wss://…`).
- Why not lockstep (everyone simulates in sync): the simulation uses variable `dt` and floating-point math, so copies would drift apart between browsers and devices.

### 3.2 Protocol (JSON first; optimize later if needed)
| Message | Direction | Content |
| --- | --- | --- |
| `create` / `join` | client → relay | room code (4 letters), nickname |
| `lobby` | host → all | seats: party, nickname, ready; level; difficulty |
| `pick` / `ready` | guest → host | party choice / ready flag |
| `start` | host → all | seed, level, difficulty, humans, start time in host clock |
| `input` | guest → host, ~30/s | seq, steer, drift, brake, accelerate, item, ability (edge-triggered with seq so a press is never lost) |
| `snap` | host → all, ~20/s | time; per racer `s, x, speed, steer, lateral, air, boost, shield, stun, charge, drifting, routeId, item, coins, finish`; projectiles; drops; hidden pickups; last processed input seq per guest |
| `events` | host → all | `race.events` since the last snap (drives effects, sounds, toasts) |
| `ping` / `pong` | both | clock offset and latency |
| `results` | host → all | final ranking |

### 3.3 Guest client
- **Other karts**: render about 100 ms behind the newest snapshot and interpolate between two snaps. Positions are already 1D along the track (`s`, `x`), so interpolation is simple.
- **Own kart — client-side prediction**: run `stepRacer` (from Phase 1) locally on your own kart every frame with your own input, so steering responds instantly. When a snap arrives, take the host's state for your kart, re-apply the inputs the host hasn't processed yet (using the last processed seq), and blend toward the corrected position over ~100 ms instead of snapping.
- Items, hits, pickups and collisions come only from the host. A guest pressing "item" sends the request, and the effect shows when the host's event arrives. That's ~50–100 ms of delay, acceptable for items.
- Countdown: synchronized using the clock offset from ping/pong, so everyone sees "GO!" together.

### 3.4 Host client
- Same game loop as split-screen, with remote inputs in place of keyboard seats. Use the latest received input per guest. If a guest's input is older than 500 ms, treat it as neutral.
- Every 50 ms: build and send `snap` + `events`.
- The host plays too and has zero lag. That's an accepted advantage in v1.

### 3.5 Lobby UI
- Home screen: new "משחק עם חברים" (play with friends) button → **Create room** (shows the code plus a share link `/?room=ABCD`) or **Join** (type a code).
- Lobby shows the 6 party seats: humans claim a party, empty ones are labeled "בוט" (bot). The host picks the course and difficulty and presses start once everyone is ready.
- Max 3 humans in v1. The protocol works for up to 6.

### 3.6 Failure handling
- **Guest disconnects mid-race**: the host converts their kart to a bot (`r.human = false; r.brain = makeBrain(id, race.random)`) and shows a toast.
- **Guest reconnects with the same room + seat token** within 30 seconds: they get their kart back.
- **Host disconnects**: v1 ends the race for everyone with a message. Host migration is out of scope.
- **Tab hidden**: today the game auto-pauses. In online mode the host must not pause the race. Keep simulating and only pause rendering. On guests, hiding the tab just stops sending input.

**Done when:** three devices on different networks (one of them a phone) finish a race. Remote karts look smooth and your own kart feels like single-player at ≤120 ms ping.

---

## Phase 4 — Polish, testing, deploy

- **Lag testing**: add a debug flag `?lag=150&jitter=30&loss=2` that delays and drops messages in the client network layer. Tune the interpolation delay and correction blending.
- **Bandwidth**: the JSON snap for 6 racers is about 1.5 KB × 20/s ≈ 30 KB/s per guest, which is fine. If needed, round values and only send fields that changed.
- **Automated tests**:
  - Unit: protocol encode/decode, prediction and reconciliation converge (`tests/net.test.mjs`).
  - Browser: Playwright opens two pages against a local relay, both join a room, race and finish (`tests/online-browser.mjs`).
- **Deploy**: relay on Fly.io/Render with its URL in the client config. The game stays on Vercel. Update README (remove "This is a single-player arcade race, not multiplayer").
- **Abuse limits**: the relay caps room size (6), message rate and message size, and drops idle rooms after 10 minutes. No accounts, no stored data.

---

## Suggested order of work
1. Phase 1, in small commits: `stepRacer` extraction → `human` / `viewerId` split → end-of-race rule → tests.
2. Phase 2 split-screen. This tests the N-human core with real players before any networking.
3. Phase 3 relay + lobby, then snapshots with interpolation only (no prediction). The game is already playable this way on low-ping connections.
4. Add prediction and reconciliation, then the Phase 4 polish.

## Open questions
- Should the host be able to fill seats with more bots or fewer (for example 2 humans + 2 bots), or always 6 karts?
- Should split-screen and online be combined (two people on one computer joining an online room)? The architecture allows it, but it's out of scope for v1.
- Should AI difficulty adapt to the mix of humans, or stay on the host's chosen setting? The plan assumes the chosen setting.
