// Throwaway generator for the Stage 5 design mockups.
// Usage: node design/mockups/build.mjs   -> writes sorbet.html, cloud.html, gelato.html (self-contained).
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- palettes
const WASTED_RING = 'rgba(244,238,251,.55)';

const shared = {
  '--halo': 'rgba(255,255,255,.6)',
  '--b-ink': '#ffffff',
  '--b-halo': 'rgba(30,25,50,.55)',
};

const directions = {
  sorbet: {
    name: 'Sorbet',
    mood: 'Warm cream, fruit-sorbet marbles, like a sunny kitchen jar.',
    base: {
      '--radius-sm': '12px',
      '--radius': '20px',
      '--radius-lg': '28px',
      '--glass-w': '2.5',
      '--glass-inner-op': '0',
      '--shine2-op': '.6',
      '--m-stroke-w': '1',
      '--tray-drop': '0 6px 6px',
      '--tray-alpha': '35%',
      '--card-bw': '1px',
    },
    light: {
      '--bg': '#fff8f3', '--surface': '#ffffff', '--surface-2': '#fdf0e8',
      '--text': '#2e2a36', '--muted': '#6b6378', '--border': '#f0dfd3',
      '--accent': '#ffb870', '--accent-ink': '#3b2414', '--accent-text': '#a4500f',
      '--accent-soft': '#ffe7cf', '--focus': '#4f5bd5',
      '--danger': '#c0392b', '--danger-soft': '#fdeae7',
      '--g-hi': '#e3fbef', '--g-base': '#8fe6bb', '--g-lo': '#4fb98a',
      '--r-hi': '#ffe1db', '--r-base': '#f08070', '--r-lo': '#c95647',
      '--b-hi': '#c9c6dd', '--b-base': '#6e6a8e', '--b-lo': '#45415f',
      '--s-hi': '#e6e9ff', '--s-base': '#9aa6f4', '--s-lo': '#6470c9',
      '--u': '#ebe6e1', '--empty': '#c9b9ab',
      '--ink': '#1f1d2b', '--u-ink': '#5c5566',
      '--gloss': 'rgba(255,255,255,.85)', '--m-stroke': 'rgba(46,42,54,.12)', '--b-ring': 'rgba(46,42,54,.12)',
      '--glass-top': 'rgba(255,255,255,.9)', '--glass-bottom': 'rgba(255,228,214,.45)',
      '--glass-stroke': '#e2c9b8', '--glass-shine': 'rgba(255,255,255,.95)', '--glass-rim': 'rgba(255,255,255,.98)',
      '--shadow-1': '0 1px 2px rgba(120,70,40,.06), 0 4px 14px rgba(120,70,40,.07)',
      '--shadow-2': '0 10px 30px rgba(120,70,40,.16)',
    },
    dark: {
      '--bg': '#1d1a2b', '--surface': '#27233a', '--surface-2': '#312c47',
      '--text': '#f4eefb', '--muted': '#b9b0cc', '--border': '#423c5c',
      '--accent': '#ffc28a', '--accent-ink': '#2a1a0c', '--accent-text': '#ffc28a',
      '--accent-soft': '#3e3049', '--focus': '#a9b4ff',
      '--danger': '#ffb4a8', '--danger-soft': '#45232b',
      '--g-hi': '#e0f8ec', '--g-base': '#86dfb2', '--g-lo': '#3f9f74',
      '--r-hi': '#ffe4de', '--r-base': '#f4978a', '--r-lo': '#c4605a',
      '--b-hi': '#c3bfdc', '--b-base': '#716c99', '--b-lo': '#46415f',
      '--s-hi': '#e8ebff', '--s-base': '#a5aef7', '--s-lo': '#6871c4',
      '--u': '#4d4a55', '--empty': '#6c6582',
      '--ink': '#1f1d2b', '--u-ink': '#e6e0ee',
      '--gloss': 'rgba(255,255,255,.6)', '--m-stroke': 'rgba(0,0,0,.25)', '--b-ring': WASTED_RING,
      '--glass-top': 'rgba(255,255,255,.08)', '--glass-bottom': 'rgba(255,194,138,.10)',
      '--glass-stroke': '#6c6582', '--glass-shine': 'rgba(255,255,255,.25)', '--glass-rim': 'rgba(255,255,255,.2)',
      '--shadow-1': '0 1px 2px rgba(0,0,0,.35), 0 4px 14px rgba(0,0,0,.35)',
      '--shadow-2': '0 10px 30px rgba(0,0,0,.55)',
    },
    extraCss: `
.chip{background:var(--surface-2);border:1px solid transparent}
.tabbar{background:var(--surface);border-radius:var(--radius-lg) var(--radius-lg) 0 0;box-shadow:0 -4px 18px rgba(120,70,40,.08)}
.theme-dark .tabbar{box-shadow:0 -4px 18px rgba(0,0,0,.35)}
`,
  },

  cloud: {
    name: 'Cloud',
    mood: 'Airy blue-white sky, cotton-candy marbles, frosted glass.',
    base: {
      '--radius-sm': '14px',
      '--radius': '22px',
      '--radius-lg': '32px',
      '--glass-w': '3',
      '--glass-inner-op': '.4',
      '--shine2-op': '.6',
      '--m-stroke-w': '1',
      '--tray-drop': '0 8px 8px',
      '--tray-alpha': '30%',
      '--card-bw': '1px',
    },
    light: {
      '--bg': '#f5f7ff', '--surface': '#ffffff', '--surface-2': '#eef1fb',
      '--text': '#252a3d', '--muted': '#5f6680', '--border': '#dde2f2',
      '--accent': '#c4b5ff', '--accent-ink': '#241a4d', '--accent-text': '#5b45c9',
      '--accent-soft': '#ece7ff', '--focus': '#3b5bdb',
      '--danger': '#c0392b', '--danger-soft': '#fdeaea',
      '--g-hi': '#e6fbf2', '--g-base': '#9ee6c4', '--g-lo': '#5cbf97',
      '--r-hi': '#ffe6e8', '--r-base': '#ff9aa2', '--r-lo': '#d9646f',
      '--b-hi': '#cfd2e0', '--b-base': '#6c7290', '--b-lo': '#474c66',
      '--s-hi': '#eef3ff', '--s-base': '#a9c4ff', '--s-lo': '#6f8fd9',
      '--u': '#e4e7ef', '--empty': '#b9c0d6',
      '--ink': '#1f2235', '--u-ink': '#565c74',
      '--gloss': 'rgba(255,255,255,.85)', '--m-stroke': 'rgba(37,42,61,.12)', '--b-ring': 'rgba(37,42,61,.12)',
      '--glass-top': 'rgba(255,255,255,.92)', '--glass-bottom': 'rgba(200,215,255,.5)',
      '--glass-stroke': '#c3cdea', '--glass-shine': 'rgba(255,255,255,.95)', '--glass-rim': 'rgba(255,255,255,.98)',
      '--shadow-1': '0 2px 6px rgba(60,80,160,.06), 0 8px 24px rgba(60,80,160,.10)',
      '--shadow-2': '0 14px 40px rgba(60,80,160,.18)',
    },
    dark: {
      '--bg': '#161a2b', '--surface': '#1f2438', '--surface-2': '#293049',
      '--text': '#eef1ff', '--muted': '#aab1cc', '--border': '#3a4260',
      '--accent': '#c4b5ff', '--accent-ink': '#1d1640', '--accent-text': '#c4b5ff',
      '--accent-soft': '#2e2a52', '--focus': '#9db4ff',
      '--danger': '#ffb4a8', '--danger-soft': '#45232b',
      '--g-hi': '#e2f8ee', '--g-base': '#8fdcb9', '--g-lo': '#4aa37e',
      '--r-hi': '#ffe6e8', '--r-base': '#f597a0', '--r-lo': '#c9616b',
      '--b-hi': '#c9cde0', '--b-base': '#6d729a', '--b-lo': '#474c69',
      '--s-hi': '#e9f0ff', '--s-base': '#9fb8f5', '--s-lo': '#6683c9',
      '--u': '#474c5e', '--empty': '#5d6584',
      '--ink': '#1f2235', '--u-ink': '#e4e8f7',
      '--gloss': 'rgba(255,255,255,.6)', '--m-stroke': 'rgba(0,0,0,.25)', '--b-ring': WASTED_RING,
      '--glass-top': 'rgba(255,255,255,.08)', '--glass-bottom': 'rgba(157,180,255,.12)',
      '--glass-stroke': '#5d6584', '--glass-shine': 'rgba(255,255,255,.25)', '--glass-rim': 'rgba(255,255,255,.2)',
      '--shadow-1': '0 2px 6px rgba(0,0,0,.35), 0 8px 24px rgba(0,0,0,.35)',
      '--shadow-2': '0 14px 40px rgba(0,0,0,.55)',
    },
    extraCss: `
.chip{background:var(--surface);border:1px solid var(--border)}
.tabbar{margin:0 12px 12px;border-radius:999px;background:var(--surface);box-shadow:var(--shadow-2);border:1px solid var(--border);height:64px}
.tab-pill{border-radius:999px}
`,
  },

  gelato: {
    name: 'Gelato',
    mood: 'Vanilla cream with sticker marbles: more chroma, a thin ink outline, the most playful.',
    base: {
      '--radius-sm': '10px',
      '--radius': '18px',
      '--radius-lg': '26px',
      '--glass-w': '2.5',
      '--glass-inner-op': '0',
      '--shine2-op': '0',
      '--m-stroke-w': '1.5',
      '--tray-drop': '0 3px 0',
      '--tray-alpha': '40%',
      '--card-bw': '1.5px',
    },
    light: {
      '--bg': '#fffaf0', '--surface': '#ffffff', '--surface-2': '#fff1dc',
      '--text': '#33261f', '--muted': '#6e5c50', '--border': '#f2dcc0',
      '--accent': '#ffd36e', '--accent-ink': '#3a2a05', '--accent-text': '#8a5a00',
      '--accent-soft': '#fff0c9', '--focus': '#4f5bd5',
      '--danger': '#c0392b', '--danger-soft': '#fdeae7',
      '--g-hi': '#d9f7e7', '--g-base': '#6fd6a0', '--g-lo': '#36a873',
      '--r-hi': '#ffdcd6', '--r-base': '#ff8577', '--r-lo': '#d9574a',
      '--b-hi': '#bdb8d4', '--b-base': '#5f5a7d', '--b-lo': '#3a3654',
      '--s-hi': '#e0e4ff', '--s-base': '#8f9bf0', '--s-lo': '#5a66c4',
      '--u': '#e8e1d8', '--empty': '#cdb99f',
      '--ink': '#2b1f19', '--u-ink': '#5e5046',
      '--gloss': 'rgba(255,255,255,.95)', '--m-stroke': 'rgba(51,38,31,.35)', '--b-ring': 'rgba(51,38,31,.35)',
      '--glass-top': 'rgba(255,255,255,.55)', '--glass-bottom': 'rgba(255,236,200,.35)',
      '--glass-stroke': 'rgba(51,38,31,.30)', '--glass-shine': 'rgba(255,255,255,.98)', '--glass-rim': 'rgba(255,255,255,.9)',
      '--shadow-1': '0 2px 0 rgba(51,38,31,.10)',
      '--shadow-2': '0 4px 0 rgba(51,38,31,.12)',
    },
    dark: {
      '--bg': '#221c27', '--surface': '#2c2533', '--surface-2': '#372f40',
      '--text': '#fbf3ea', '--muted': '#c4b6aa', '--border': '#4a4055',
      '--accent': '#ffd36e', '--accent-ink': '#2e2205', '--accent-text': '#ffd36e',
      '--accent-soft': '#463a2a', '--focus': '#a9b4ff',
      '--danger': '#ffb4a8', '--danger-soft': '#45232b',
      '--g-hi': '#d6f5e4', '--g-base': '#74d9a5', '--g-lo': '#3aa673',
      '--r-hi': '#ffdcd6', '--r-base': '#ff8f82', '--r-lo': '#cf5d52',
      '--b-hi': '#bdb8d4', '--b-base': '#6a6590', '--b-lo': '#3e3a58',
      '--s-hi': '#e0e4ff', '--s-base': '#9aa5f3', '--s-lo': '#5e69c0',
      '--u': '#4f4752', '--empty': '#6a5f6e',
      '--ink': '#2b1f19', '--u-ink': '#eee6ef',
      '--gloss': 'rgba(255,255,255,.85)', '--m-stroke': 'rgba(251,243,234,.55)', '--b-ring': WASTED_RING,
      '--glass-top': 'rgba(255,255,255,.05)', '--glass-bottom': 'rgba(255,211,110,.08)',
      '--glass-stroke': 'rgba(251,243,234,.30)', '--glass-shine': 'rgba(255,255,255,.35)', '--glass-rim': 'rgba(255,255,255,.2)',
      '--shadow-1': '0 2px 0 rgba(0,0,0,.35)',
      '--shadow-2': '0 4px 0 rgba(0,0,0,.55)',
    },
    extraCss: `
.chip{background:transparent;border:1.5px solid var(--c)}
.tabbar{background:var(--surface);border-top:2px solid var(--border)}
.card{border-color:var(--border)}
.btn-primary{box-shadow:0 3px 0 rgba(51,38,31,.18)}
.theme-dark .btn-primary{box-shadow:0 3px 0 rgba(0,0,0,.45)}
`,
  },
};

// ---------------------------------------------------------------- contrast helper (build-time report)
function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function cr(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
function report(key, d) {
  for (const mode of ['light', 'dark']) {
    const p = d[mode];
    const rows = [
      ['ink/Wanted', p['--ink'], p['--g-base']],
      ['ink/Unwanted', p['--ink'], p['--r-base']],
      ['ink/Sleep', p['--ink'], p['--s-base']],
      ['white/Wasted', '#ffffff', p['--b-base']],
      ['uInk/Unlogged', p['--u-ink'], p['--u']],
      ['white/Unwanted(split12)', '#ffffff', p['--r-base']],
      ['muted/surface', p['--muted'], p['--surface']],
      ['muted/bg', p['--muted'], p['--bg']],
      ['text/surface', p['--text'], p['--surface']],
      ['accentText/surface', p['--accent-text'], p['--surface']],
      ['accentText/accentSoft', p['--accent-text'], p['--accent-soft']],
      ['accentInk/accent', p['--accent-ink'], p['--accent']],
      ['muted/surface-2', p['--muted'], p['--surface-2']],
      ['empty/glass(surface)', p['--empty'], p['--surface']],
    ];
    console.log(`${key} ${mode}: ` + rows.map(([n, a, b]) => `${n}=${cr(a, b).toFixed(1)}`).join('  '));
  }
}

// ---------------------------------------------------------------- SVG pieces
const GLASS = 'M 13 17 V 28 C 13 46, 3 40, 3 62 V 287 a 24 24 0 0 0 24 24 H 161 a 24 24 0 0 0 24 -24 V 62 C 185 40, 175 46, 175 28 V 17';

function gradDefs(prefix, scale = 1) {
  const f = (n) => +(n * scale).toFixed(2);
  return ['g', 'b', 'r', 's']
    .map(
      (k) =>
        `<radialGradient id="${prefix}-${k}" gradientUnits="userSpaceOnUse" cx="${f(-5.6)}" cy="${f(-6.4)}" fx="${f(-6.4)}" fy="${f(-7.2)}" r="${f(24)}"><stop offset="0" style="stop-color:var(--${k}-hi)"/><stop offset=".42" style="stop-color:var(--${k}-base)"/><stop offset="1" style="stop-color:var(--${k}-lo)"/></radialGradient>`,
    )
    .join('');
}

const gloss = (s = 1) =>
  `<ellipse class="gloss" cx="${-6.4 * s}" cy="${-7.2 * s}" rx="${4.5 * s}" ry="${2.7 * s}" transform="rotate(-35 ${-6.4 * s} ${-7.2 * s})"/>`;

// Hour contents. k: g/b/r/s/u (u = unlogged), or 'f' future. split: [left, right]
function hourSpec(h) {
  if (h <= 6) return { k: 's' };
  if (h === 7) return { split: ['u', 'g'], ink: 'g' };
  if (h <= 10) return { k: 'g' };
  if (h === 11) return { k: 'b' };
  if (h === 12) return { split: ['b', 'r'], ink: 'b' };
  if (h === 13) return { k: 'r' };
  return { k: 'f' };
}
const fillFor = (th, k) => (k === 'u' ? 'var(--u)' : `url(#${th}-${k})`);
const inkClass = (k) => (k === 'b' ? 'hn hn-b' : k === 'u' ? 'hn hn-u' : k === 'f' ? 'hn hn-f' : 'hn');

function jar(th) {
  let marbles = '';
  for (let h = 0; h < 24; h++) {
    const col = h % 4;
    const row = Math.floor(h / 4);
    const cx = 34 + 40 * col;
    const cy = 280 - 40 * row;
    const s = hourSpec(h);
    let body = '';
    let ink;
    let label = `${h}:00 `;
    if (s.split) {
      const [l, r] = s.split;
      body =
        `<path class="m m-${l}" d="M -1.5 -16 A 16 16 0 0 0 -1.5 16 Z" fill="${fillFor(th, l)}"/>` +
        `<path class="m m-${r}" d="M 1.5 -16 A 16 16 0 0 1 1.5 16 Z" fill="${fillFor(th, r)}"/>` +
        (l !== 'u' ? gloss() : '');
      ink = inkClass(s.ink);
      label += 'split hour';
    } else if (s.k === 'f') {
      body = `<circle r="16" class="empty"/>`;
      ink = inkClass('f');
      label += 'future';
    } else {
      body = `<circle r="16" class="m m-${s.k}" fill="${fillFor(th, s.k)}"/>` + (s.k === 'u' ? '' : gloss());
      ink = inkClass(s.k);
      label += { g: 'Wanted', b: 'Wasted', r: 'Unwanted', s: 'Sleep', u: 'Unlogged' }[s.k];
    }
    marbles += `<g transform="translate(${cx} ${cy})" role="img" aria-label="${label}">${body}<text class="${ink}" text-anchor="middle" dy=".35em">${h}</text></g>`;
  }
  return `<svg class="jar" viewBox="0 0 188 314" width="300" role="img" aria-label="Jar of 24 hour marbles">
<defs>${gradDefs(th)}<linearGradient id="${th}-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--glass-top)"/><stop offset="1" style="stop-color:var(--glass-bottom)"/></linearGradient></defs>
<path d="${GLASS} Z" fill="url(#${th}-glass)"/>
${marbles}
<path d="${GLASS}" class="glass-inner" transform="translate(94 157) scale(.955 .965) translate(-94 -157)" fill="none"/>
<path d="${GLASS}" fill="none" class="glass-stroke"/>
<path d="M 13 66 V 262" class="shine1"/><path d="M 176 72 V 132" class="shine2"/><path d="M 18 23 V 30" class="shine2"/>
<rect x="7" y="3" width="174" height="14" rx="7" class="rim"/>
</svg>`;
}

function trayMarble(prefix, k, size = 52) {
  const s = size / 32;
  return `<svg class="tray-disc" viewBox="-26 -26 52 52" width="${size}" height="${size}" aria-hidden="true"><defs>${gradDefs(prefix, s)}</defs><circle r="26" class="m m-${k}" fill="url(#${prefix}-${k})" style="stroke-width:calc(var(--m-stroke-w)*1.2)"/>${gloss(s)}</svg>`;
}

const icon = {
  day: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
  week: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16M8 14h8M8 17h5"/>',
  month: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16M10 10v10M15 10v10M4 15h16"/>',
  stats: '<path d="M6 20v-7M12 20V5M18 20v-10"/>',
  settings: '<path d="M4 7h9M19 7h1M4 17h1M11 17h9"/><circle cx="16" cy="7" r="2.6"/><circle cx="8" cy="17" r="2.6"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/>',
  left: '<path d="m15 6-6 6 6 6"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
};
const svgIcon = (name, size = 24) =>
  `<svg class="ico" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon[name]}</svg>`;

// ---------------------------------------------------------------- phone frame
function entry(c, time, word, note) {
  return `<li class="entry"><span class="dot" style="background:var(--${c}-base)"></span><span class="entry-time">${time}</span><span class="entry-cat">${word}</span><span class="entry-note">${note}</span><span class="entry-chevron">${svgIcon('right', 18)}</span></li>`;
}
function chip(c, text, extra = '') {
  const dotStyle = c === 'u' ? 'var(--u)' : `var(--${c}-base)`;
  const line = c === 'u' ? 'var(--empty)' : c === 'b' ? 'var(--b-base)' : `var(--${c}-lo)`;
  return `<span class="chip" style="--c:${line}"><span class="dot${extra}" style="background:${dotStyle}"></span>${text}</span>`;
}

function frame(th, label) {
  const tabs = [
    ['day', 'Day'],
    ['week', 'Week'],
    ['month', 'Month'],
    ['stats', 'Stats'],
    ['settings', 'Settings'],
  ]
    .map(
      ([i, t]) =>
        `<a class="tab${i === 'day' ? ' active' : ''}"${i === 'day' ? ' aria-current="page"' : ''}><span class="tab-pill">${svgIcon(i)}</span><span class="tab-label">${t}</span></a>`,
    )
    .join('');
  return `<div class="frame theme-${label}" id="frame-${label}">
<div class="scroll">
<header class="card header"><button class="icon-btn" aria-label="Previous day">${svgIcon('left')}</button><div class="title"><div class="t1">Tuesday, Oct 20</div><div class="t2">Today</div></div><button class="icon-btn disabled" disabled aria-label="Next day">${svgIcon('right')}</button><button class="icon-btn" aria-label="Calendar">${svgIcon('cal')}</button></header>
<section class="card tray"><div class="tray-row">
<figure>${trayMarble(th + '-t1', 'g')}<figcaption>Wanted</figcaption></figure>
<figure>${trayMarble(th + '-t2', 'b')}<figcaption>Wasted</figcaption></figure>
<figure>${trayMarble(th + '-t3', 'r')}<figcaption>Unwanted</figcaption></figure>
</div><p class="hint">Drag a marble into the jar to log 13:00–14:00</p></section>
<section class="card jar-card">${jar(th)}</section>
<section class="chips" aria-label="Summary">${chip('g', 'Wanted 3.5h')}${chip('b', 'Wasted 1.5h', ' dot-b')}${chip('r', 'Unwanted 1.5h')}${chip('s', 'Sleep 7h')}${chip('u', 'Unlogged 0.5h')}</section>
<button class="btn-primary">Log time</button>
<section class="card entries"><h2>Entries</h2><ul>
${entry('g', '07:30–10:00', 'Wanted', 'Deep work on the report draft')}
${entry('g', '10:00–11:00', 'Wanted', 'Gym')}
${entry('b', '11:00–12:30', 'Wasted', 'Scrolling')}
${entry('r', '12:30–14:00', 'Unwanted', 'Taxes')}
</ul></section>
</div>
<nav class="tabbar" aria-label="Main">${tabs}</nav>
</div>`;
}

// ---------------------------------------------------------------- page
function toVars(obj) {
  return Object.entries(obj)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
}

const css = (d) => `
*{box-sizing:border-box}
:root{--ease-out:cubic-bezier(.2,.8,.3,1);--ease-bounce:cubic-bezier(.34,1.56,.64,1);--ease-spring:var(--ease-bounce);--dur-fast:120ms;--dur:220ms;--dur-slow:420ms}
@supports (transition-timing-function: linear(0, 1)){:root{--ease-spring:linear(0, .009, .035 2.1%, .141 4.4%, .723 12.9%, .938 16.7%, 1.017 19.4%, 1.067, 1.099 24.3%, 1.108 26%, 1.097, 1.064 31.9%, 1.009 37.1%, .98 41.9%, .977 44.2%, .982 48.1%, 1.004 58.4%, 1)}}
html,body{margin:0}
body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#ebe9f0;color:#2a2733;-webkit-font-smoothing:antialiased}
.page{max-width:1000px;margin:0 auto;padding:32px 24px 56px}
.page-head h1{margin:0 0 4px;font-size:28px}
.page-head p{margin:0 0 4px;color:#5d5a68}
.page-head .note{font-size:13px}
.phones{display:flex;gap:32px;justify-content:center;flex-wrap:wrap;margin-top:24px}
.col{margin:0}
.col>figcaption{font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#5d5a68;margin:0 0 8px 4px}
.theme-light{${toVars({ ...shared, ...d.base, ...d.light })}}
.theme-dark{${toVars({ ...shared, ...d.base, ...d.dark })}}
.theme-light,.theme-dark{color:var(--text);background:var(--bg)}

/* phone frame */
.frame{width:390px;height:844px;display:flex;flex-direction:column;position:relative;overflow:hidden;border-radius:38px;box-shadow:0 0 0 6px #14121c,0 18px 50px rgba(20,18,28,.3);font-size:15px;line-height:1.3}
.scroll{flex:1;min-height:0;overflow-y:auto;padding:18px 16px 18px;display:flex;flex-direction:column;gap:14px;scrollbar-width:none}
.scroll::-webkit-scrollbar{display:none}
.card{background:var(--surface);border:var(--card-bw) solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow-1)}
.header{display:flex;align-items:center;gap:6px;padding:10px 10px;min-height:68px}
.title{flex:1;text-align:center;min-width:0}
.t1{font-weight:700;font-size:17px}
.t2{font-size:13px;color:var(--muted);margin-top:1px}
.icon-btn{width:44px;height:44px;border-radius:50%;border:0;background:var(--surface-2);color:var(--text);display:grid;place-items:center;padding:0;flex:none;font:inherit}
.icon-btn.disabled{opacity:.38}
.ico{display:block}
.tray{padding:14px 12px 12px}
.tray-row{display:flex;justify-content:space-around}
.tray figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:6px}
.tray figcaption{font-size:13px;font-weight:600;color:var(--text)}
.tray-disc{display:block;overflow:visible}
.tray figure:nth-child(1) .tray-disc{filter:drop-shadow(var(--tray-drop) color-mix(in srgb,var(--g-lo) var(--tray-alpha),transparent))}
.tray figure:nth-child(2) .tray-disc{filter:drop-shadow(var(--tray-drop) color-mix(in srgb,var(--b-lo) var(--tray-alpha),transparent))}
.tray figure:nth-child(3) .tray-disc{filter:drop-shadow(var(--tray-drop) color-mix(in srgb,var(--r-lo) var(--tray-alpha),transparent))}
.hint{margin:12px 0 0;text-align:center;font-size:13px;color:var(--muted)}
.jar-card{padding:16px 0;display:flex;justify-content:center;background:linear-gradient(180deg,var(--surface),var(--surface-2))}
.jar{display:block;height:auto;overflow:visible}

/* marbles */
.m{stroke:var(--m-stroke);stroke-width:var(--m-stroke-w)}
.m-b{stroke:var(--b-ring);stroke-width:calc(var(--m-stroke-w) + .4px)}
.gloss{fill:var(--gloss)}
.empty{fill:none;stroke:var(--empty);stroke-width:1.5;stroke-dasharray:3 3}
.hn{font:700 13px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-variant-numeric:tabular-nums;fill:var(--ink);stroke:var(--halo);stroke-width:2.4px;stroke-linejoin:round;paint-order:stroke}
.hn-b{fill:var(--b-ink);stroke:var(--b-halo)}
.hn-u{fill:var(--u-ink);stroke:none}
.hn-f{fill:var(--muted);stroke:none}
.glass-stroke{stroke:var(--glass-stroke);stroke-width:var(--glass-w)}
.glass-inner{stroke:var(--glass-stroke);stroke-width:1.2;opacity:var(--glass-inner-op)}
.shine1{stroke:var(--glass-shine);stroke-width:5;stroke-linecap:round;fill:none}
.shine2{stroke:var(--glass-shine);stroke-width:3;stroke-linecap:round;opacity:var(--shine2-op);fill:none}
.rim{fill:var(--glass-rim);stroke:var(--glass-stroke);stroke-width:1.5}

/* chips, button, entries */
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{display:inline-flex;align-items:center;gap:7px;min-height:34px;padding:0 13px;border-radius:999px;font-weight:700;font-size:14px;color:var(--text)}
.dot{width:11px;height:11px;border-radius:50%;flex:none;display:inline-block}
.dot-b{box-shadow:0 0 0 1.4px var(--b-ring)}
.btn-primary{height:56px;border:0;border-radius:999px;background:var(--accent);color:var(--accent-ink);font:700 17px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;box-shadow:var(--shadow-1);width:100%;flex:none}
.entries{padding:14px 14px 6px}
.entries h2{margin:0 0 4px;font-size:15px}
.entries ul{list-style:none;margin:0;padding:0}
.entry{display:flex;align-items:center;gap:9px;min-height:48px;border-top:1px solid var(--border);font-size:14px}
.entry:first-child{border-top:0}
.entry-time{font-variant-numeric:tabular-nums;font-weight:600;white-space:nowrap}
.entry-cat{font-weight:700;white-space:nowrap}
.entry-note{flex:1;min-width:0;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.entry-chevron{color:var(--muted);display:grid;flex:none}

/* tab bar */
.tabbar{flex:none;display:flex;justify-content:space-around;align-items:center;height:72px;padding:6px 6px 8px}
.tab{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;color:var(--muted);font-size:11px;font-weight:600}
.tab-pill{width:56px;height:30px;border-radius:15px;display:grid;place-items:center}
.tab.active{color:var(--accent-text);font-weight:800}
.tab.active .tab-pill{background:var(--accent-soft)}
${d.extraCss}

/* motion strip */
.motion{margin-top:32px;padding:20px 24px 24px;border-radius:var(--radius-lg);background:var(--bg);color:var(--text);box-shadow:var(--shadow-1)}
.motion h2{margin:0 0 4px;font-size:18px}
.motion>p{margin:0 0 16px;font-size:13px;color:var(--muted)}
.m-row{display:flex;gap:16px;flex-wrap:wrap}
.m-cell{flex:1 1 220px;background:var(--surface);border:var(--card-bw) solid var(--border);border-radius:var(--radius);height:190px;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:12px;overflow:hidden;box-shadow:var(--shadow-1)}
.m-cell .cap{font-size:13px;font-weight:700;margin-top:10px}
.m-cell .cap small{display:block;font-weight:500;color:var(--muted);font-size:12px}
.m-stage{flex:1;display:flex;align-items:flex-end;justify-content:center;width:100%}
.m-ground{width:80%;height:2px;border-radius:2px;background:var(--border);margin-top:0}
.demo-wobble,.demo-drop,.demo-tab .tab-pill,.demo-tab .ico{will-change:transform}
.demo-tab{display:flex;flex-direction:column;align-items:center;gap:3px;color:var(--accent-text);font-weight:800;font-size:11px;margin-bottom:8px}
.demo-tab .tab-pill{background:var(--accent-soft)}
.demo-drop{transform-origin:50% 100%}
@media (prefers-reduced-motion: no-preference){
 .demo-wobble{animation:wobble 2.2s ease-in-out infinite}
 .demo-drop{animation:drop 2.2s infinite}
 .demo-tab .tab-pill{animation:pillBounce 2.2s var(--ease-spring) infinite}
 .demo-tab .ico{animation:iconBounce 2.2s var(--ease-spring) infinite}
}
@keyframes wobble{0%{transform:rotate(0) translateY(0)}15%{transform:rotate(-5deg) translateY(-2px)}30%{transform:rotate(5deg) translateY(-2px)}45%,100%{transform:rotate(0) translateY(0)}}
/* 700ms landing inside a 2.2s loop: impact at 55% (=17.5%), rebound at 72% (=22.9%), settled at 100% (=31.8%) */
@keyframes drop{0%{transform:translateY(-70px) scale(1);animation-timing-function:cubic-bezier(.5,0,1,1)}17.5%{transform:translateY(0) scale(1.14,.84);animation-timing-function:var(--ease-out)}22.9%{transform:translateY(0) scale(.96,1.04);animation-timing-function:var(--ease-out)}31.8%,100%{transform:translateY(0) scale(1)}}
@keyframes pillBounce{0%{transform:scale(.7)}14.5%,100%{transform:scale(1)}}
@keyframes iconBounce{0%{transform:translateY(-3px)}14.5%,100%{transform:translateY(0)}}

/* single-view modes used for screenshots (?view=light|dark|light-full|dark-full|both) */
body[data-view]{background:transparent}
body[data-view] .page{max-width:none;margin:0;padding:0}
body[data-view] .page-head,body[data-view] .motion{display:none}
body[data-view] .phones{margin:0;gap:0;flex-wrap:nowrap;justify-content:flex-start}
body[data-view] .col>figcaption{display:none}
body[data-view=light] .col-dark,body[data-view=light-full] .col-dark{display:none}
body[data-view=dark] .col-light,body[data-view=dark-full] .col-light{display:none}
body[data-view=light] .frame,body[data-view=dark] .frame,body[data-view=light-full] .frame,body[data-view=dark-full] .frame{border-radius:0;box-shadow:none}
body[data-view$=full] .frame,body[data-view=both] .frame{height:auto}
body[data-view$=full] .scroll,body[data-view=both] .scroll{overflow:visible}
body[data-view=both]{background:#ebe9f0}
body[data-view=both] .page{padding:28px 32px}
body[data-view=both] .phones{gap:40px}
body[data-view=both] .col>figcaption{display:block}
`;

function page(key, d) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Marbles Stage 5 mockup: ${d.name}</title>
<style>${css(d)}</style>
</head>
<body>
<script>var v=new URLSearchParams(location.search).get('view');if(v)document.body.dataset.view=v;</script>
<div class="page">
<div class="page-head"><h1>${d.name}</h1><p>${d.mood}</p><p class="note">Throwaway mockup: Day screen, light and dark, plus the motion strip. Add <code>?view=light</code> or <code>?view=dark</code> to see one frame alone.</p></div>
<div class="phones">
<figure class="col col-light"><figcaption>Light</figcaption>${frame(key + '-light', 'light')}</figure>
<figure class="col col-dark"><figcaption>Dark</figcaption>${frame(key + '-dark', 'dark')}</figure>
</div>
<section class="motion theme-light"><h2>Motion</h2><p>CSS-only loops (~2.2s). Curves from DESIGN.md section 2: wobble, squishy drop landing, tab bounce. Static under reduced motion.</p>
<div class="m-row">
<div class="m-cell"><div class="m-stage"><div class="demo-wobble">${trayMarble(key + '-mw', 'g')}</div></div><div class="m-ground" style="opacity:0"></div><div class="cap">Tray idle wobble<small>±5° + 2px lift, ease-in-out</small></div></div>
<div class="m-cell"><div class="m-stage"><div class="demo-drop">${trayMarble(key + '-md', 'r')}</div></div><div class="m-ground"></div><div class="cap">Squishy drop landing<small>scale(1.14,.84) at impact, then rebound</small></div></div>
<div class="m-cell"><div class="m-stage"><div class="demo-tab"><span class="tab-pill">${svgIcon('stats')}</span><span>Stats</span></div></div><div class="m-ground" style="opacity:0"></div><div class="cap">Tab bounce<small>pill .7 to 1, icon -3px to 0, spring</small></div></div>
</div></section>
</div>
</body>
</html>
`;
}

for (const [key, d] of Object.entries(directions)) {
  report(key, d);
  writeFileSync(join(here, `${key}.html`), page(key, d));
}
