// Line icons for items and help, drawn on a 24px grid.
const PATHS = {
  empty: 'M4 9h16v11H4z M9 9V5h6v4 M10 13h4',
  boost: 'M13 2L4 14h7l-1 8 9-12h-7z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  poll: 'M4 20h16 M7 16v-5 M12 16V7 M17 16v-8',
  magnet: 'M6 4v8a6 6 0 0 0 12 0V4 M6 8h4 M14 8h4',
  leak: 'M4 5h13v14H6a2 2 0 0 1-2-2z M17 9h3v8a2 2 0 0 1-2 2 M7 9h7 M7 12h7 M7 15h4',
  filibuster: 'M5 4h14l-2 6H7z M12 10v10 M8 20h8',
  spin: 'M20 12a8 8 0 1 1-2.3-5.6 M20 4v4h-4',
  budget:
    'M5 7c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3z M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7 M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5',
  noconf: 'M13 3l8 8-3 3-8-8z M11.5 9.5L4 17l3 3 7.5-7.5 M3 21h9',
  steer:
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M3.5 10h5.5 M15 10h5.5 M12 15v6',
  drift: 'M4 17c4 0 5-10 10-10h6 M16 4l4 3-4 3 M4 20h6',
  ballot: 'M6 3h12v18H6z M9 8h6 M9 12h6 M9 16h3',
  ability: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z',
  ticker: 'M3 6h18v12H3z M7 10h10 M7 14h6'
};

export function icon(name, label = '') {
  const d = PATHS[name] ?? PATHS.empty;
  return `<svg viewBox="0 0 24 24"${label ? ` role="img" aria-label="${label}"` : ' aria-hidden="true"'}><path d="${d}"/></svg>`;
}
