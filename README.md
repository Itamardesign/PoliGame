# קואליציה קארט — Coalition Kart

A Hebrew 3D kart racer about Israeli politics. Six leaders race through a Jerusalem built in code, and the main mode is a three-race season for the Knesset's 120 seats: nobody wins 61 alone, so between races you build a coalition.

Single-player, in the browser, no backend. Everything except the party marks, the portraits and the font is generated in code: the city, the karts, the textures, the music and the sound.

## Run

`npm start`, then open http://127.0.0.1:4173. The static build is `dist/`. The original bus game is still at `/classic.html` (see `CLASSIC.md`).

## Deploy to Vercel

Import the repository with **Root Directory** `coalition-chaos` if you import the enclosing `Polili-Game3d` repository; otherwise leave it at the default. `vercel.json` serves `dist/` with no build step and no environment variables.

## Modes

- **The Race to 61 (המרוץ ל־61).** Three races (Knesset Avenue at 150cc, the reversed city at dusk at 200cc, Jerusalem at night at 250cc) hand out the 120 seats: mostly by finishing place, partly by the ballot slips (votes) each party collects. Between races you may invite up to two partners, but a party will not join as a junior partner if it holds more than four seats more than you. Partners stop targeting you and cover your back on track, and each brings a demand that handicaps you while they stay: starting from the back of the grid, a ballot cap, shorter drift boosts, an empty ballot box every third time, no launch boost, or no no-confidence votes. Hit a partner, or let them outrun you, and their loyalty drops until they walk out. The season ends with the count: a government, an opposition government, or a 60–60 deadlock.
- **Single race (מרוץ בודד).** Any course, three laps, six drivers.
- **Time trial (נגד השעון).** Race alone against a translucent ghost of your best run on that course, with a live gap to the ghost and lap splits. Every ballot box is a turbo.
- **Daily challenge (אתגר יומי).** The date picks the course, the driver and the seed of the starting field, the same for everyone that day. Results can be shared as a line of text.

## How it plays

- **Driving.** The kart accelerates by itself; W/↑ adds throttle and S/↓ brakes. Steer with A/D or ←/→; physical key codes are used, so a Hebrew keyboard layout works. Press W exactly as the countdown shows 1 for a launch boost. Hold Shift with a direction to drift; release after blue, orange or purple for stronger boosts. Shift in the air is a trick, which gives a boost on landing. C switches camera; Esc/P pauses. On phones and tablets, drag anywhere on the left of the screen to steer (an analog stick appears under the thumb), steer hard to auto-drift (the drift button fills with the charge and turns into a turbo badge while boosting), tap quickly to use the item; the item and the portrait fire on touch, so they work while steering; tilt and button steering are in the pause menu.
- **Rivals race on merit.** Each AI driver produces the same inputs a player would and runs through the same physics. They take a racing line, drift through corners, collect ballots and boxes, steer around hazards they can reach in time, take shortcuts, draft, block and ram on purpose. Each leader has a temperament (tactician, anchor, charger, wall, collector, hothead). Difficulty scales their awareness, how often they drift and the boost tier they hold for. A gentle catch-up keeps the field within a few seconds.
- **Items (קלפי).** Ballot boxes hand out items by position: leaders get defence, the back of the pack the heavy ones. Turbo, immunity, a surprise poll (hits the kart ahead), a vote magnet, a press leak (newsprint covers the screens of those ahead), a filibuster (a lectern dropped behind you), a spin doctor (reverses the steering of the kart ahead), a budget transfer (steals ballots) and a no-confidence vote (a gavel that lands on the leader through any shield).
- **Abilities.** Every leader has a signature move, charged by drifting, tricks, near misses and slipstreams and fired with E or by tapping the portrait: super immunity, breaking news, a protest barricade, resignation (out of the coalition and back in ahead), coalition funds and a siren that clears the road.
- **Vehicles differ.** Top speed, pick-up, grip, off-road pace and weight trade off. No vehicle tops every category.

## The world

The circuit is Jerusalem two weeks before election day, 27 October 2026. Knesset Avenue has a live poll screen showing the race as a seat projection, crowds behind police barriers and election banners, and the Central Elections Committee checkpoint: a gantry over one lane with a boost strip under it, where any item you carry is confiscated. The road climbs onto the Chords Bridge viaduct, drops through a hairpin into the Mahane Yehuda S-bends (with rally stands for and against the draft law, and the light rail alongside), passes a school serving as a polling station with a queue at the gate, flies off the crest of the hill toward Yemin Moshe and the Montefiore windmill, rounds the Old City hairpin and returns through the Knesset tunnel. A banner plane circles overhead for the Israelis flying home to vote, and between race events the ticker runs campaign headlines. Secret routes cut the Iraqi Market alleys and Bloomfield Garden.

**Ballot slips are votes.** Up to ten carried slips raise top speed (the HUD meter shows the bonus); a spin knocks three loose. In the Race to 61, 34 of each race's 40 seats go by finishing place (10, 8, 6, 5, 3, 2) and 6 are shared in proportion to the votes collected, by largest remainder.

Buildings are Jerusalem limestone with roller blinds, balconies and rooftop solar water heaters; olive groves, cypresses and date palms line the road; kerbs are painted red-and-white in corners and blue-and-white along city streets; overhead signs are Hebrew, English and Arabic. Each course has its own sky (day, dusk, night).

## Code

| Module | What it does |
| --- | --- |
| `race-model.js` | Race simulation: physics, pickups, finish times, catch-up |
| `race-ai.js` | Rival drivers: racing line, hazard avoidance, racecraft, items, abilities |
| `race-items.js` | Items, abilities, vehicle stats |
| `race-course.js` | Pickup and hazard layout shared by simulation and renderer |
| `gp.js` | The Race to 61 season: seats, talks, demands, loyalty, verdict |
| `ghost.js` | Time-trial recording and playback |
| `world-kit.js`, `world-set.js` | Procedural textures and props, and the dressed city |
| `kart-world.js`, `kart-drivers.js` | Karts and drivers |
| `kart-motion.js`, `kart-trails.js` | Kart animation, smoke, sparks and dust |
| `kart-hud.js`, `kart-menus.js`, `ui-*.js` | HUD, ticker, menus, the Knesset chamber chart |
| `kart-audio.js` | Synthesized engine, sound effects and music |
| `kart.js` | Rendering, input and the game loop |

## Validation

- `npm test` runs the simulation tests: physics, AI behaviour, items and abilities, the Grand Prix rules, ghosts.
- `npm run check` syntax-checks every module.
- `npm run test:browser` plays a full race with real keyboard input in Chromium, checks the Grand Prix talks and final count, a time trial and the phone layout, and fails on any page error.
- `npm run sim -- skilled 8` (or `casual`) runs headless races on every course and reports places, spread and hit causes. `tools/gp-sim.mjs` plays whole seasons. `tools/shoot.mjs`, `tools/flow.mjs`, `tools/modes.mjs` and `tools/perf.mjs` take screenshots and measure frame rate.

The simulation is deterministic per seed. On an Intel UHD 620 a race holds about 55–60 fps; render resolution adapts if frames run long.

This is satire. The leaders are caricatures, and the vehicles, abilities, items and results are invented. Nothing here is a poll or a forecast, and the roster is a selection for the game, not a full candidate list.

## Asset sources

Retrieved September 23, 2026. Trademarks remain the property of their owners; inclusion does not imply endorsement. Party logos are identifying marks in a satirical game.

- Likud: https://en.wikipedia.org/wiki/Likud — `Likud_Logo.svg` thumbnail, Wikimedia Commons. Leader reference: https://www.likud.org.il/
- Yesh Atid: https://yeshatid.org.il/wp-content/uploads/2026/03/לוגו-יש-עתיד-1.svg
- Democrats: https://democrats.org.il/wp-content/uploads/2026/08/logo-desktop.svg — leader: https://democrats.org.il/yair-golan/
- Yisrael Beytenu: https://beytenu.org.il/wp-content/uploads/2023/07/IB_New-Logo_Dark-4-1024x369.webp
- Shas: https://en.wikipedia.org/wiki/Shas — `Shas_logo.svg` thumbnail; leader reference https://www.knesset.tv/knesset-members/aryeh-machluf-deri/
- Otzma Yehudit: https://en.wikipedia.org/wiki/Otzma_Yehudit — `Otzma_Yehudit_2021_logo.svg` thumbnail; leader reference https://www.ozma-yeudit.co.il/מי-אנחנו/
- Heebo: Google Fonts, SIL Open Font License. Local font assets are TrueType files served by Google Fonts; `fonts.css` declares their actual format.
- Three.js: vendored, MIT; `dist/vendor/THREE-LICENSE.txt`.

Driver portraits (cropped from the originals, stylized, and mapped onto 3D heads; `dist/assets/faces/`, face landmarks in `dist/kart-faces.js`), retrieved September 29, 2026 from Wikimedia Commons:

- Benjamin Netanyahu: `Benjamin_Netanyahu,_February_2023.jpg`, Avi Ohayon, CC BY-SA 3.0
- Yair Lapid: `Yair_Lapid_(D1237-011).jpg`, Avi Ohayon, CC BY-SA 3.0
- Yair Golan: `Yair_Golan_(SHL_9404).jpg`, Shlomi Amsalem, CC BY-SA 4.0
- Avigdor Lieberman: `Avigdor_Lieberman_2017.jpg`, U.S. DoD (Jim Mattis visit), public domain
- Aryeh Deri: `אריה_דרעי_2.jpg`, רווח הפקות, CC BY-SA 3.0
- Itamar Ben-Gvir: `Itamar_Ben_Gvir_3_(cropped).jpg`, אלון נוריאל, CC BY-SA 3.0

The portraits are repainted in code at load (smoothed, banded into painted tones and inked along strong edges) before being mapped onto the heads; the modified faces are shared under the same CC BY-SA terms. All other 3D geometry, textures, the city, vehicles, animation, music and sound are original procedural work generated in code.
