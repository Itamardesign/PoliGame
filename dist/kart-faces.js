// Face crops come from freely licensed portraits (credits in README). Coordinates are in source-photo pixels:
// box = [x, y, width, height] from ear to ear and hair top to chin; landmarks drive the 3D face relief.
export const FACES = {
  netanyahu: {
    hair: '#cfcfcf',
    skin: '#d6a088',
    box: [262, 80, 410, 466],
    eyes: [
      [405, 325],
      [530, 325]
    ],
    nose: [465, 440],
    mouth: [468, 488]
  },
  bennett: {
    hair: '#6e5945',
    skin: '#e4b58e',
    box: [200, 58, 565, 720],
    eyes: [
      [378, 408],
      [580, 413]
    ],
    nose: [478, 535],
    mouth: [476, 630]
  },
  golan: {
    hair: '#9d9990',
    skin: '#d49c86',
    box: [310, 172, 382, 462],
    eyes: [
      [425, 428],
      [558, 428]
    ],
    nose: [490, 520],
    mouth: [492, 572]
  },
  lieberman: {
    hair: '#908c86',
    skin: '#c69a82',
    box: [195, 55, 445, 595],
    eyes: [
      [350, 300],
      [518, 300]
    ],
    nose: [438, 378],
    mouth: [445, 450]
  },
  deri: {
    hair: '#6d6862',
    skin: '#bd8d73',
    box: [240, 128, 460, 682],
    eyes: [
      [450, 400],
      [610, 400]
    ],
    nose: [540, 510],
    mouth: [525, 590]
  },
  bengvir: {
    hair: '#5d5956',
    skin: '#b98b71',
    box: [125, 95, 385, 481],
    eyes: [
      [245, 380],
      [385, 380]
    ],
    nose: [310, 470],
    mouth: [312, 510]
  },
  eisenkot: {
    hair: '#b8b6b2',
    skin: '#d9a08a',
    box: [140, 92, 715, 893],
    eyes: [
      [348, 528],
      [595, 522]
    ],
    nose: [480, 700],
    mouth: [480, 822]
  },
  smotrich: {
    hair: '#4a3a2c',
    skin: '#d39a7e',
    box: [205, 85, 565, 775],
    eyes: [
      [365, 500],
      [578, 488]
    ],
    nose: [485, 625],
    mouth: [480, 712]
  }
};
