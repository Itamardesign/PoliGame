# קואליציה קארט — Coalition Kart

A playable Hebrew 3D election kart racer, evolved from the existing Coalition Chaos art direction. Original procedural karts and caricatures; real party marks. No Nintendo assets.

## Run

`npm start` then open http://127.0.0.1:4173. The static release is `dist/`. The original bus game remains at `/classic.html` (original documentation: `CLASSIC.md`). Three.js, Hebrew fonts and all logos are bundled locally. No backend, tracking, account or network connection is required after loading the files.

## Deploy to Vercel

Import this repository as a Vercel project with **Root Directory** set to `coalition-chaos` if importing the enclosing `Polili-Game3d` repository. If the repository itself starts in this folder, leave Root Directory at its default. The included `vercel.json` selects the static `dist/` output and requires no build command or environment variables. The main game is at `/`, and the original bus game is at `/classic.html`.

## Play

- Six selectable leaders: Benjamin Netanyahu / Likud, Yair Lapid / Yesh Atid, Yair Golan / Democrats, Avigdor Lieberman / Yisrael Beytenu, Aryeh Deri / Shas, Itamar Ben Gvir / Otzma Yehudit.
- Six bespoke vehicles, each with its own chassis and gimmick: Likud's armoured state limousine (tinted VIP cabin, chrome grille, fender flags), Yesh Atid's wedge GT (side pods, rear wing, blinking ON AIR sign, anchor's desk mic), the Democrats' protest dune buggy (tall roll cage, megaphone, flag, exposed V-twin, knobby tyres), Yisrael Beytenu's muscle car (supercharger through the hood, side pipes, ducktail), Shas' gilded throne carriage (velvet throne, crown, lanterns, gold spoked wheels) and Otzma Yehudit's lifted patrol 4x4 (flashing police light bar, bull bar, snorkel, spare wheel). Vehicle choice is cosmetic; player baseline stats are equal.
- Three laps of an expanded 817-unit Jerusalem circuit (23% longer), with 20-unit-wide tarmac (57% wider). Four color-coded districts: Knesset Boulevard, Promises Bridge, Coalition Market and Spin Park. Textured asphalt, banked shoulders, corner chevrons, market stalls, a windmill and an oversized ballot landmark. Five AI opponents, continuous lateral steering, centrifugal corner forces, live position, minimap and local best times per difficulty.
- Auto acceleration, with extra throttle on W/Up or the touch gas button. Smooth, damped steering with arrows or A/D, using physical key codes so Hebrew keyboard layouts work. Right steers screen-right everywhere on the circuit. Down/S brakes. C switches chase cameras; steering sensitivity is adjustable in the pause menu and saved locally. Hold Shift and steer for drift charge; release after blue for boost, after orange for a longer boost, or purple for ultra turbo. Tap Shift in the air for a trick and landing boost. Press W/Up or touch gas as the countdown reaches 1 for a launch boost.
- Space or the item card activates a campaign item: promises turbo, parliamentary immunity (six seconds; absorbs one attack), a visible flying surprise poll (slows the closest opponent ahead), or a seven-second ballot magnet. Opponents use items too.
- Ballot pickups increase top speed up to ten. Inside-line cyan pads provide boosts. Grass slows the kart; barricades stun it. Kart contact nudges and gently slows both cars, including AI rivals, with a brief impact cooldown.
- Rolling spin balls cross the road with visible warning strips; a close dodge earns turbo. Golden bonus gates switch sides each lap and award three ballots plus boost. Turbo contact can stun rivals; shields absorb one hit.
- Two real shortcuts: a blossom garden and an arched sandstone alley. Look for question-mark gates and colored stones, enter at speed, and hold a narrow line to save time. Both have trick ramps; shortcuts preserve lap progress.
- Photo-true drivers: each leader's face is taken from a freely licensed portrait and projected onto a 3D head whose relief (brow, eye sockets, nose, mouth, chin) follows that photo's landmarks. It is blended into a matching hair/skin base, with 3D ears and kippot where worn. Bodies are SDF-sculpted suits whose shirt, tie and pin colours match the same photos. Three drift tiers, tire marks, jump tricks, slipstream boosts, impact bursts, shield bubbles, item projectiles, speed effects and optional engine audio make actions visible and audible.
- 150cc is competitive. 200cc opponents are faster and require boost use. No-input play loses; accurate steering and item timing matter.
- On phones and touch tablets, the race fills the visible screen with a compact HUD and large thumb controls for steering, gas, brake and drift. Touch buttons support simultaneous steering and drift. Esc/P pauses. Tab switching pauses automatically. Optional sound, fullscreen, replay and garage controls included.

This is a single-player arcade race, not multiplayer. The race winner is humorously crowned prime minister; it is not a simulation of government formation. No polls or real election outcomes are represented. This is a selected game roster, not a complete candidate list.

## Validation

`npm test` runs original model tests and kart simulation tests. `npm run check` checks all game modules.

Browser QA scripts under `tests/kart-*.mjs` and `tests/circuit-browser.mjs` use Playwright (the bundled runtime path can be replaced with an installed package). The additional `tests/wow-browser.mjs` drives a full race using real keyboard input and checks shortcut entries/exits, timed launch and airborne tricks. Tests cover desktop/mobile render, driver choice, drift, pause/resume, full race, results and replay. Screenshots are in `test-results/`.

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

The modified face crops are shared under the same CC BY-SA terms. All other 3D geometry, environment and vehicle customization are original procedural work. Static colored meshes are merged by material for fewer draw calls. Render pixel ratio is capped at 1.6x device pixel ratio.
