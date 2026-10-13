// Every sound the game asks ElevenLabs for. `npm run sfx` turns this into dist/assets/sfx/*.mp3
// plus manifest.json; the game falls back to its synthesized sound for anything missing.
// seconds: 0.5–30. variants: several takes, picked at random in game. loop: seamless loop.
// volume: mix level in game (0–1). influence: how literally the prompt is followed (0–1).

export const SFX = {
  // Engine and driving loops. The engine crossfades low → high with revs.
  'engine-low': {
    prompt: 'Small go-kart gasoline engine at low RPM, steady throaty putter, close onboard mic, no music',
    seconds: 4,
    loop: true,
    volume: 0.55
  },
  'engine-high': {
    prompt: 'Racing go-kart engine screaming at high RPM, aggressive steady buzz, close onboard mic, no music',
    seconds: 4,
    loop: true,
    volume: 0.5
  },
  screech: {
    prompt: 'Car tyres screeching continuously while drifting sideways on asphalt, steady',
    seconds: 3,
    loop: true,
    volume: 0.45
  },
  'boost-loop': {
    prompt: 'Turbo afterburner roar, intense steady rushing jet whoosh',
    seconds: 3,
    loop: true,
    volume: 0.4
  },
  crowd: {
    prompt: 'Big outdoor political rally crowd in the distance, cheering, whistles, chanting, air horns',
    seconds: 10,
    loop: true,
    volume: 0.18
  },

  // Start of race.
  'countdown-beep': { prompt: 'Racing game countdown beep, single clean electronic tone', seconds: 0.5, volume: 0.6 },
  'countdown-go': {
    prompt: 'Racing game start signal, bright high electronic beep with an energetic burst',
    seconds: 1,
    volume: 0.7
  },
  'grid-rev': {
    prompt: 'Six go-kart engines revving together on a starting grid, tension building',
    seconds: 2.5,
    volume: 0.6
  },
  'launch-boost': {
    prompt: 'Kart engine hard rev with turbo blow-off whoosh, launching off the start line, tyres chirp',
    seconds: 1.5,
    volume: 0.7
  },

  // Drifting, boosts, air.
  'drift-start': { prompt: 'Short tyre chirp squeal as a kart flicks into a drift', seconds: 0.6, volume: 0.5, variants: 2 },
  'drift-boost-1': { prompt: 'Small turbo boost whoosh with an exhaust pop', seconds: 0.8, volume: 0.6 },
  'drift-boost-2': { prompt: 'Turbo boost whoosh with a loud exhaust backfire bang', seconds: 1, volume: 0.65 },
  'drift-boost-3': {
    prompt: 'Massive nitro blast with double backfire bangs and crackling sparks, arcade racing',
    seconds: 1.3,
    volume: 0.7
  },
  'boost-pad': {
    prompt: 'Arcade racing speed boost pad, electric zap with a rising whoosh',
    seconds: 1,
    volume: 0.6
  },
  jump: { prompt: 'Kart flying off a ramp, engine rev and wind rushing upward', seconds: 0.8, volume: 0.5 },
  land: {
    prompt: 'Kart landing hard on asphalt, suspension thud and tyre bounce',
    seconds: 0.6,
    volume: 0.6,
    variants: 2
  },
  trick: { prompt: 'Arcade trick success sparkle chime, upbeat whoosh', seconds: 0.8, volume: 0.55 },
  slipstream: { prompt: 'Wind rushing past a speeding car, aerodynamic whoosh building', seconds: 1, volume: 0.45 },
  'near-miss': { prompt: 'Fast car passing by very close, doppler whoosh', seconds: 0.8, volume: 0.5 },
  overtake: { prompt: 'Short punchy whoosh swish as a car overtakes, arcade', seconds: 0.5, volume: 0.45 },

  // Contact.
  wall: {
    prompt: 'Kart scraping and bumping against a concrete barrier, plastic crunch and metal scrape',
    seconds: 0.8,
    volume: 0.55,
    variants: 2
  },
  bump: { prompt: 'Two go-karts bumping into each other, hollow plastic and metal clunk', seconds: 0.5, volume: 0.55, variants: 2 },
  hit: {
    prompt: 'Cartoon kart crash and spin-out, tyres squealing, metal clatter, debris',
    seconds: 1.2,
    volume: 0.65,
    variants: 2
  },

  // Pickups and items.
  pickup: {
    prompt: 'Paper ballot slip collected, short bright coin chime with a paper swish, arcade',
    seconds: 0.5,
    volume: 0.4,
    variants: 3
  },
  jackpot: { prompt: 'Jackpot cascade of coins and bright chimes, arcade reward', seconds: 1.2, volume: 0.6 },
  'item-get': {
    prompt: 'Smashing through a plastic item box then a slot-machine roulette tick ending in a ding',
    seconds: 1,
    volume: 0.55
  },
  'item-boost': { prompt: 'Turbo activation, huge jet engine roar burst with a backfire', seconds: 1.5, volume: 0.7 },
  shield: { prompt: 'Magic force field shield powering up, shimmering energy hum', seconds: 1, volume: 0.55 },
  'shield-break': { prompt: 'Glassy energy shield shattering', seconds: 0.8, volume: 0.6 },
  poll: { prompt: 'Homing rocket launch whoosh with fast electronic beeping', seconds: 1.2, volume: 0.6 },
  magnet: { prompt: 'Magnet powering up, electric hum pulling metal, sci-fi', seconds: 1, volume: 0.5 },
  leak: { prompt: 'Stack of newspapers flapping and rustling as they fly through the air', seconds: 1, volume: 0.6 },
  filibuster: { prompt: 'Heavy wooden lectern dropped onto a road with a thud and a wobble', seconds: 0.8, volume: 0.6 },
  spin: { prompt: 'Cartoon dizzy spinning swirl with a wobbly slide whistle', seconds: 1, volume: 0.55 },
  budget: { prompt: 'Cash register ka-ching with coins pouring', seconds: 0.8, volume: 0.55 },
  noconf: { prompt: "Judge's wooden gavel banging three times, loud and echoing", seconds: 1.2, volume: 0.7 },
  warning: { prompt: 'Incoming missile lock-on warning, fast urgent beeping alarm', seconds: 1, volume: 0.55 },
  confiscated: { prompt: 'Police whistle blow followed by a heavy rubber stamp', seconds: 1, volume: 0.6 },
  veto: { prompt: 'Error buzzer and an empty cardboard box thump, comedic', seconds: 0.8, volume: 0.55 },
  warp: { prompt: 'Teleport zap whoosh, sci-fi warp', seconds: 1, volume: 0.55 },

  // Leader abilities.
  'ability-ready': { prompt: 'Power ready notification, bright magical shimmer rising', seconds: 0.8, volume: 0.55 },
  'ability-immunity': { prompt: 'Golden invincibility power-up, epic rising synth swell with a choir hit', seconds: 1.5, volume: 0.65 },
  'ability-breaking': { prompt: 'TV breaking news sting, short dramatic news jingle with a whoosh', seconds: 2, volume: 0.65 },
  'ability-protest': { prompt: 'Protest crowd chanting with a megaphone and drums, short burst', seconds: 1.5, volume: 0.65 },
  'ability-resign': { prompt: 'Door slam then a magical teleport whoosh', seconds: 1.5, volume: 0.6 },
  'ability-funds': { prompt: 'Shower of coins and banknotes with a cash register and a turbo whoosh', seconds: 1.5, volume: 0.65 },
  'ability-siren': { prompt: 'Police siren wail short burst with a loud horn', seconds: 1.5, volume: 0.65 },

  // Laps and results.
  lap: { prompt: 'Racing game lap complete chime with a short crowd cheer', seconds: 1.2, volume: 0.55 },
  'final-lap': { prompt: 'Final lap fanfare, short dramatic brass sting', seconds: 2, volume: 0.6 },
  'finish-win': { prompt: 'Victory fanfare with crowd cheering and fireworks popping', seconds: 4, volume: 0.65 },
  'finish-lose': { prompt: 'Comedic sad trombone wah wah wah', seconds: 2.5, volume: 0.6 },

  // Menus and coalition talks.
  'ui-click': { prompt: 'Soft clean user interface click', seconds: 0.5, volume: 0.4 },
  'ui-select': { prompt: 'Video game menu select, quick tick with a light whoosh', seconds: 0.5, volume: 0.45 },
  'race-start': { prompt: 'Kart engine starting up and revving, ready to race', seconds: 1.5, volume: 0.55 },
  'coalition-join': { prompt: 'Firm handshake and approving murmur with light applause', seconds: 1.2, volume: 0.55 },
  'coalition-reject': { prompt: 'Short disappointed crowd booing', seconds: 1.2, volume: 0.5 },
  'gov-formed': { prompt: 'Parliament applause and celebratory brass fanfare', seconds: 3, volume: 0.65 },
  'gov-failed': { prompt: 'Crowd groaning in disappointment then a gavel bang', seconds: 2.5, volume: 0.6 }
};

// The Hebrew announcer. Keys are the exact text the game passes to audio.say(); prompt may carry
// eleven_v3 audio tags for delivery.
export const VOICE = {
  'הקריין איתכם': '[excited] הקריין איתכם!',
  'שלוש': '[intense] שלוש!',
  'שתיים': '[intense] שתיים!',
  'אחת': '[intense] אחת!',
  'צא!': '[shouting] צאו!',
  'זינוק מושלם': '[excited] זינוק מושלם!',
  'מקום ראשון': '[excited] מקום ראשון!',
  'הקפה אחרונה': '[dramatic] הקפה אחרונה!',
  'נחיתה מושלמת': '[impressed] נחיתה מושלמת!',
  'הצבעת אי־אמון נגדכם': '[alarmed] הצבעת אי אמון נגדכם!',
  'סקר בדרך אליכם': '[warning] סקר בדרך אליכם!',
  'ניצחון!': '[shouting] [excited] ניצחון!',
  'סיימתם במקום 2': 'סיימתם במקום שני!',
  'סיימתם במקום 3': 'סיימתם במקום שלישי.',
  'סיימתם במקום 4': 'סיימתם במקום רביעי.',
  'סיימתם במקום 5': '[sighs] סיימתם במקום חמישי.',
  'סיימתם במקום 6': '[sighs] סיימתם במקום שישי.',
  'הממשלה הוקמה': '[excited] הממשלה הוקמה!',
  'אין ממשלה': '[sighs] אין ממשלה. הולכים לבחירות.'
};
