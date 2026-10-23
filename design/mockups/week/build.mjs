// Week view mockups (Stage 7). No dependencies. Usage: node design/mockups/week/build.mjs
// Writes timeline.html, shelf.html and balance.html next to this file. Every total comes from the fake data below.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/* ------------------------------------------------------------------ data */
// "Today" is Fri Oct 23 2026, 15:00. Week starts Monday. Sleep window 23:00-07:00.
const NOW_SLOT = 30; // 15:00
const TODAY_INDEX = 4; // Fri
const SLEEP_END = 14; // 07:00 (slots 0..13 are sleep)
const SLEEP_START = 46; // 23:00
const slot = (hm) => {
  const [h, m] = hm.split(':').map(Number);
  return h * 2 + (m >= 30 ? 1 : 0);
};
// entry = [start, end, category, note?]
const WEEK = [
  { name: 'Mon', date: 19, doc: true, reflection: 'Solid day; the evening slipped.', entries: [
    ['07:30', '09:00', 'p', 'Morning run'], ['09:00', '12:00', 'g', 'Sprint planning'], ['13:00', '17:30', 'g'],
    ['17:30', '18:30', 'r', 'Commute traffic'], ['18:30', '20:00', 'p', 'Cooked dinner with Sam'], ['20:00', '22:30', 'b', 'Doomscrolling'],
  ] },
  { name: 'Tue', date: 20, doc: true, entries: [
    ['08:00', '12:00', 'g'], ['12:00', '12:30', 'r'], ['12:30', '17:00', 'g', 'Shipped the export fix'],
    ['17:00', '19:00', 'b'], ['19:00', '21:00', 'p', 'Guitar practice'], ['21:00', '23:00', 'b'],
  ] },
  { name: 'Wed', date: 21, doc: true, entries: [
    ['00:00', '01:00', 'b', "Couldn't sleep, phone"], ['09:30', '11:00', 'r', 'Dentist'], ['11:00', '16:00', 'g'],
    ['16:00', '16:30', 'b'], ['16:30', '18:00', 'p', 'Climbing gym'],
  ] },
  { name: 'Thu', date: 22, doc: false, entries: [] }, // past day, nothing logged
  { name: 'Fri', date: 23, doc: true, today: true, entries: [
    ['07:00', '07:30', 'p', 'Meditation'], ['09:00', '12:30', 'g', 'Report draft'], ['12:30', '13:30', 'r', 'Taxes'], ['13:30', '14:30', 'b'],
  ] },
  { name: 'Sat', date: 24, doc: false, entries: [] },
  { name: 'Sun', date: 25, doc: false, entries: [] },
];
const CATS = [ // CATEGORIES order: Purposeful, Productive, Unwanted, Wasted
  ['p', 'Purposeful'], ['g', 'Productive'], ['r', 'Unwanted'], ['b', 'Wasted'],
];
const LABEL = { p: 'Purposeful', g: 'Productive', r: 'Unwanted', b: 'Wasted', s: 'Sleep', u: 'Unlogged', f: 'Future' };

// per-day slot categories: p g r b logged, s sleep, u unlogged, f future, n nothing-logged past day (bare)
function computeDay(d, i) {
  const slots = new Array(48).fill('u');
  const notes = {};
  const futureDay = i > TODAY_INDEX;
  const nothing = !futureDay && !d.entries.length;
  const logged = new Array(48).fill(null);
  for (const [a, b, c, note] of d.entries) {
    for (let s = slot(a); s < slot(b); s++) logged[s] = c;
    if (note) notes[slot(a)] = note;
  }
  for (let s = 0; s < 48; s++) {
    const isFuture = futureDay || (i === TODAY_INDEX && s >= NOW_SLOT);
    if (logged[s]) slots[s] = logged[s];
    else if (isFuture) slots[s] = 'f';
    else if (nothing) slots[s] = 'n';
    else slots[s] = s < SLEEP_END || s >= SLEEP_START ? 's' : 'u';
  }
  const sum = { p: 0, g: 0, r: 0, b: 0, s: 0, u: 0 };
  for (const c of slots) if (c in sum) sum[c] += 0.5;
  const kind = futureDay ? 'future' : nothing ? 'nothing' : 'logged';
  const noteSlots = Object.keys(notes).map(Number).sort((a, b) => a - b);
  return {
    ...d, i, slots, notes, noteSlots, sum, kind,
    isToday: !!d.today, isWeekend: i >= 5,
    loggedHours: sum.p + sum.g + sum.r + sum.b,
    noteCount: noteSlots.length,
    firstNote: noteSlots.length ? notes[noteSlots[0]] : null,
  };
}
const days = WEEK.map(computeDay);
const week = { p: 0, g: 0, r: 0, b: 0, s: 0, u: 0 };
for (const d of days) for (const k in week) week[k] += d.sum[k];
const plusOf = (d) => d.sum.p + d.sum.g;
const minusOf = (d) => d.sum.r + d.sum.b;
const scale = Math.max(...days.map((d) => Math.max(plusOf(d), minusOf(d))));
const maxLogged = Math.max(...days.map((d) => d.loggedHours));

const hrs = (h) => `${Number.isInteger(h) ? h : h.toFixed(1)}h`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const dayFull = (d) => `${d.name} Oct ${d.date}`;
function runs(slots) {
  const out = [];
  for (let s = 0; s < 48; s++) {
    const c = slots[s];
    if (out.length && out[out.length - 1].c === c) out[out.length - 1].len++;
    else out.push({ start: s, len: 1, c });
  }
  return out;
}
const clock = (s) => `${String(Math.floor(s / 2)).padStart(2, '0')}:${s % 2 ? '30' : '00'}`;
const summaryText = (d) => {
  if (d.kind === 'future') return 'not yet';
  if (d.kind === 'nothing') return 'nothing logged';
  const parts = CATS.filter(([k]) => d.sum[k] > 0).map(([k, l]) => `${l} ${hrs(d.sum[k])}`);
  return parts.join(', ');
};

/* ---------------------------------------------------------------- tokens */
const shared = {
  radius: '20px', 'radius-sm': '12px', 'radius-lg': '28px', ink: '#1f1d2b', 'b-ink': '#ffffff',
};
const light = {
  bg: '#fff8f3', surface: '#ffffff', 'surface-2': '#fdf0e8', border: '#f0dfd3', 'border-strong': '#a48d7d',
  text: '#2e2a36', muted: '#6b6378', accent: '#ffb870', 'accent-soft': '#ffe7cf', 'accent-soft-text': '#a4500f',
  'today-bg': '#fff0e0', 'weekend-bg': '#fdf4ee',
  p: '#8fe6bb', 'p-hi': '#e3fbef', 'p-lo': '#4fb98a',
  g: '#7cc4ef', 'g-hi': '#e2f4fd', 'g-lo': '#3f93c4',
  r: '#f08070', 'r-hi': '#ffe1db', 'r-lo': '#c95647',
  b: '#6e6a8e', 'b-hi': '#928eb4', 'b-lo': '#45415f', 'b-ring': 'transparent',
  s: '#9aa6f4', 's-hi': '#e6e9ff', 's-lo': '#6470c9',
  u: '#ebe6e1', empty: '#c9b9ab',
  'glass-top': 'rgba(255,255,255,.9)', 'glass-bottom': 'rgba(255,228,214,.45)', 'glass-stroke': '#e2c9b8',
  'glass-shine': 'rgba(255,255,255,.95)', 'glass-rim': 'rgba(255,255,255,.98)', gloss: 'rgba(255,255,255,.75)',
  'shadow-1': '0 1px 2px rgba(120,70,40,.06), 0 4px 14px rgba(120,70,40,.07)',
};
const dark = {
  bg: '#1d1a2b', surface: '#27233a', 'surface-2': '#312c47', border: '#423c5c', 'border-strong': '#7d759a',
  text: '#f4eefb', muted: '#b9b0cc', accent: '#ffc28a', 'accent-soft': '#3e3049', 'accent-soft-text': '#ffc28a',
  'today-bg': '#3e3049', 'weekend-bg': '#2b2740',
  p: '#86dfb2', 'p-hi': '#e0f8ec', 'p-lo': '#3f9f74',
  g: '#86cbf2', 'g-hi': '#e2f4fd', 'g-lo': '#4499c9',
  r: '#f4978a', 'r-hi': '#ffe4de', 'r-lo': '#c4605a',
  b: '#716c99', 'b-hi': '#8f8ab4', 'b-lo': '#46415f', 'b-ring': 'rgba(244,238,251,.55)',
  s: '#a5aef7', 's-hi': '#e8ebff', 's-lo': '#6871c4',
  u: '#4d4a55', empty: '#6c6582',
  'glass-top': 'rgba(255,255,255,.08)', 'glass-bottom': 'rgba(255,194,138,.1)', 'glass-stroke': '#6c6582',
  'glass-shine': 'rgba(255,255,255,.25)', 'glass-rim': 'rgba(255,255,255,.2)', gloss: 'rgba(255,255,255,.45)',
  'shadow-1': '0 1px 2px rgba(0,0,0,.35), 0 4px 14px rgba(0,0,0,.35)',
};
const toVars = (o) => Object.entries(o).map(([k, v]) => `--${k}:${v}`).join(';');

/* ----------------------------------------------------------- shared bits */
const ico = (inner) => `<svg class="ico" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
const ICONS = {
  Day: ico('<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>'),
  Week: ico('<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 10h18M9 10v10M15 10v10M8 3v4M16 3v4"/>'),
  Month: ico('<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" stroke-width="2.6"/>'),
  Stats: ico('<path d="M5 20V11M12 20V5M19 20v-6"/>'),
  Settings: ico('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
};
const tabbar = () => `<nav class="tabbar" aria-label="Main">${['Day', 'Week', 'Month', 'Stats', 'Settings']
  .map((t) => `<span class="tab${t === 'Week' ? ' active' : ''}"><span class="tab-pill">${ICONS[t]}</span>${t}</span>`).join('')}</nav>`;
const chev = (dir) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="${dir === 'l' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}"/></svg>`;
const header = () => `<section class="card hdr"><div class="hdr-top"><span class="icon-btn" aria-label="Previous week">${chev('l')}</span><div class="title"><div class="t1">Oct 19 – Oct 25</div><div class="t2">2026</div></div><span class="icon-btn" aria-label="Next week">${chev('r')}</span></div><div class="date-tools"><span class="btn">This week</span><span class="btn">Share</span></div></section>`;
const dot = (k) => `<i class="dot c-${k}"></i>`;

// jar gradients, defined once per phone with theme-suffixed ids
const defs = (t) => `<svg width="0" height="0" style="position:absolute" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><defs>
<linearGradient id="gl-${t}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--glass-top)"/><stop offset="1" style="stop-color:var(--glass-bottom)"/></linearGradient>
${['p', 'g', 'r', 'b', 's'].map((k) => `<radialGradient id="mg-${k}-${t}" gradientUnits="userSpaceOnUse" cx="-5.6" cy="-6.4" fx="-6.4" fy="-7.2" r="24"><stop offset="0" style="stop-color:var(--${k}-hi)"/><stop offset=".42" style="stop-color:var(--${k})"/><stop offset="1" style="stop-color:var(--${k}-lo)"/></radialGradient>`).join('')}
</defs></svg>`;

const GLASS = 'M 13 17 V 28 C 13 46, 3 40, 3 62 V 287 a 24 24 0 0 0 24 24 H 161 a 24 24 0 0 0 24 -24 V 62 C 185 40, 175 46, 175 28 V 17 Z';
const GLASS_OPEN = GLASS.replace(' Z', '');
const LEFT = 'M -1.5 -16 A 16 16 0 0 0 -1.5 16 Z';
const RIGHT = 'M 1.5 -16 A 16 16 0 0 1 1.5 16 Z';
// MiniJar: no hour numbers. Stroke widths are heavier than the full jar so they survive at 34-44px.
function miniJar(d, t, width) {
  const body = [];
  if (d.kind !== 'nothing') {
    for (let h = 0; h < 24; h++) {
      const a = d.slots[2 * h];
      const b = d.slots[2 * h + 1];
      const cx = 34 + 40 * (h % 4);
      const cy = 280 - 40 * Math.floor(h / 4);
      const fill = (k) => (k === 'u' ? 'var(--u)' : `url(#mg-${k}-${t})`);
      const gloss = '<ellipse cx="-6.4" cy="-7.2" rx="4.5" ry="2.7" transform="rotate(-35 -6.4 -7.2)" fill="var(--gloss)"/>';
      const ring = (k) => (k === 'b' ? ' stroke="var(--b-ring)" stroke-width="3"' : '');
      let g;
      if (a === b) {
        if (a === 'f') g = '<circle r="15" fill="none" stroke="var(--empty)" stroke-width="3.5" stroke-dasharray="6 6"/>';
        else g = `<circle r="16" fill="${fill(a)}"${ring(a)}/>${a === 'u' ? '' : gloss}`;
      } else {
        const half = (k, p) => (k === 'f' ? `<path d="${p}" fill="none" stroke="var(--empty)" stroke-width="3.5" stroke-dasharray="6 6"/>` : `<path d="${p}" fill="${fill(k)}"${ring(k)}/>`);
        g = `${half(a, LEFT)}${half(b, RIGHT)}${a !== 'u' && a !== 'f' ? gloss : ''}`;
      }
      body.push(`<g transform="translate(${cx} ${cy})">${g}</g>`);
    }
  }
  return `<svg class="mini-jar" width="${width}" viewBox="0 0 188 314" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">
<path d="${GLASS}" fill="url(#gl-${t})"/>${body.join('')}<path d="${GLASS_OPEN}" fill="none" stroke="var(--glass-stroke)" stroke-width="7"/>
<path d="M 13 66 V 262" stroke="var(--glass-shine)" stroke-width="9" stroke-linecap="round" fill="none"/><path d="M 176 72 V 132" stroke="var(--glass-shine)" stroke-width="6" stroke-linecap="round" opacity=".6" fill="none"/>
<rect x="7" y="3" width="174" height="14" rx="7" fill="var(--glass-rim)" stroke="var(--glass-stroke)" stroke-width="4"/></svg>`;
}

const baseCss = `
*{box-sizing:border-box}
:root{--ease-out:cubic-bezier(.2,.8,.3,1);--ease-spring:cubic-bezier(.34,1.56,.64,1);--dur-slow:420ms}
html,body{margin:0}
body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#ebe9f0;color:#2a2733;-webkit-font-smoothing:antialiased}
.page{max-width:1000px;margin:0 auto;padding:32px 24px 56px}
.page-head h1{margin:0 0 4px;font-size:28px}
.page-head p{margin:0 0 4px;color:#5d5a68}
.page-head .note{font-size:13px}
.phones{display:flex;gap:32px;justify-content:center;flex-wrap:wrap;margin-top:24px}
.col{margin:0}
.col>figcaption{font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#5d5a68;margin:0 0 8px 4px}
.theme-light{${toVars({ ...shared, ...light })}}
.theme-dark{${toVars({ ...shared, ...dark })}}
.theme-light,.theme-dark{color:var(--text);background:var(--bg)}
a{color:inherit;text-decoration:none}
.frame{width:390px;height:844px;display:flex;flex-direction:column;position:relative;overflow:hidden;border-radius:38px;box-shadow:0 0 0 6px #14121c,0 18px 50px rgba(20,18,28,.3);font-size:15px;line-height:1.3}
.scroll{flex:1;min-height:0;overflow:hidden;padding:18px 16px;display:flex;flex-direction:column;gap:14px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow-1)}
.hdr{padding:10px 10px 12px}
.hdr-top{display:flex;align-items:center;gap:6px;min-height:56px}
.title{flex:1;text-align:center;min-width:0}
.t1{font-weight:700;font-size:17px}
.t2{font-size:13px;color:var(--muted);margin-top:1px}
.icon-btn{width:44px;height:44px;border-radius:50%;background:var(--surface-2);color:var(--text);display:grid;place-items:center;flex:none}
.date-tools{display:flex;justify-content:center;gap:8px;margin-top:6px}
.btn{height:36px;padding:0 16px;border-radius:999px;background:var(--surface-2);border:1px solid var(--border);display:inline-flex;align-items:center;font-weight:600;font-size:14px}
.dot{width:10px;height:10px;border-radius:50%;flex:none;display:inline-block}
.c-p{background:var(--p)}.c-g{background:var(--g)}.c-r{background:var(--r)}.c-b{background:var(--b);box-shadow:inset 0 0 0 1px var(--b-ring)}.c-s{background:var(--s)}.c-u{background:var(--u)}
.dot.c-b{box-shadow:0 0 0 1.4px var(--b-ring)}
.dot.c-f{background:transparent;border:1.5px dashed var(--empty)}
.badge{display:inline-flex;align-items:center;height:16px;padding:0 6px;border-radius:999px;background:var(--accent);color:var(--ink);font-weight:800;font-size:10px;letter-spacing:.05em;text-transform:uppercase}
.stats-link{font-weight:700;font-size:13px;color:var(--accent-soft-text);white-space:nowrap}
.tabbar{flex:none;display:flex;justify-content:space-around;align-items:center;height:72px;padding:6px 6px 8px;background:var(--surface);border-radius:28px 28px 0 0;box-shadow:0 -4px 18px rgba(120,70,40,.08)}
.theme-dark .tabbar{box-shadow:0 -4px 18px rgba(0,0,0,.35)}
.tab{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;color:var(--muted);font-size:11px;font-weight:600}
.tab-pill{width:56px;height:30px;border-radius:15px;display:grid;place-items:center}
.tab.active{color:var(--accent-soft-text);font-weight:800}
.tab.active .tab-pill{background:var(--accent-soft)}
.tab .ico{width:22px;height:22px}
@keyframes colIn{from{opacity:0;transform:scaleY(.96)}to{opacity:1;transform:none}}
@keyframes rowIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes grow{from{transform:scaleX(0)}to{transform:none}}
body[data-view]{background:transparent}
body[data-view] .page{max-width:none;margin:0;padding:0}
body[data-view] .page-head{display:none}
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
body[data-view] *{animation:none!important}
`;

function page(file, title, note, css, body) {
  const frame = (t) => `<div class="frame theme-${t}">${defs(t)}<div class="scroll">${header()}${body(t)}</div>${tabbar()}</div>`;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Marbles Stage 7 Week mockup: ${title}</title>
<style>${baseCss}${css}</style>
</head>
<body>
<script>var v=new URLSearchParams(location.search).get('view');if(v)document.body.dataset.view=v;</script>
<div class="page">
<div class="page-head"><h1>Week: ${title}</h1><p>${note}</p><p class="note">Throwaway mockup, fake week (today is Fri Oct 23, now 15:00). Add <code>?view=light</code> or <code>?view=dark</code> for one phone.</p></div>
<div class="phones">
<figure class="col col-light"><figcaption>Light</figcaption>${frame('light')}</figure>
<figure class="col col-dark"><figcaption>Dark</figcaption>${frame('dark')}</figure>
</div>
</div>
</body>
</html>
`;
  writeFileSync(join(here, file), html);
}

/* ------------------------------------------------------------- A Timeline */
const ROW = 8;
const timelineCss = `
.wt{padding:10px 10px 12px}
.wt-body{display:flex;gap:0}
.wt-gutter{width:24px;flex:none;padding-top:58px}
.wt-labels{position:relative;height:${48 * ROW}px;font-size:10.5px;font-weight:600;color:var(--muted);font-variant-numeric:tabular-nums}
.wt-labels span{position:absolute;left:0;transform:translateY(-50%);line-height:1}
.wt-cols{flex:1;list-style:none;margin:0;padding:0;display:flex;gap:5px}
.wt-col{flex:1;min-width:0;border-radius:8px}
.wt-col>a{display:flex;flex-direction:column;align-items:center;border-radius:8px;background:var(--col-bg,transparent);height:100%;padding-bottom:0}
.wt-col.today>a{outline:3px solid var(--accent);outline-offset:0}
.wt-head{height:52px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:2px;padding-top:3px}
.wt-dn{font-size:11.5px;font-weight:700;color:var(--muted);line-height:14px}
.wt-dd{min-width:26px;height:22px;padding:0 4px;border-radius:999px;display:grid;place-items:center;font-size:13px;font-weight:700;line-height:1}
.today .wt-dd{background:var(--accent-soft);color:var(--accent-soft-text)}
.today .wt-dn{color:var(--accent-soft-text)}
.wt-badge{font-size:9.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--accent-soft-text);line-height:10px;height:10px}
.wt-chart{position:relative;width:100%;height:${48 * ROW}px;margin-top:6px;border-radius:6px;
 background-image:${[0, 1, 2, 3, 4].map(() => 'linear-gradient(var(--border),var(--border))').join(',')};background-size:100% 1px;background-repeat:no-repeat;
 background-position:${[0, 96, 192, 288, 383].map((y) => `0 ${y}px`).join(',')}}
.seg{position:absolute;left:0;right:0;border-radius:4px}
.seg.c-f{background:transparent;border:1.5px dashed var(--empty);box-shadow:none}
.note-dot{position:absolute;top:-2px;right:-2px;width:8px;height:8px;border-radius:50%;background:var(--surface);border:1.5px solid var(--text);z-index:2}
.wt-now{position:absolute;left:-3px;right:-3px;top:${NOW_SLOT * ROW - 1}px;height:3px;border-radius:2px;background:var(--accent);box-shadow:0 0 0 1px var(--text);z-index:3}
.wt-none{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.wt-none span{writing-mode:vertical-rl;font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.02em;white-space:nowrap}
.wt-col.nothing .wt-chart{background-color:var(--surface-2)}
.wt-legend{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:12px;padding:0 2px}
.chip{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;white-space:nowrap}
.chip small{font-size:12.5px;font-weight:600;color:var(--muted)}
.wt-key{display:flex;align-items:center;gap:14px;margin-top:10px;padding:8px 2px 0;border-top:1px solid var(--border);font-size:12px;font-weight:600;color:var(--muted);flex-wrap:wrap}
.wt-key .k{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.wt-key .nowk{width:16px;height:3px;border-radius:2px;background:var(--accent);box-shadow:0 0 0 1px var(--text)}
.wt-key .notek{width:8px;height:8px;border-radius:50%;background:var(--surface);border:1.5px solid var(--text)}
.wt-key .stats-link{margin-left:auto}
@media (prefers-reduced-motion: no-preference){
 .wt-col>a{transform-origin:top;animation:colIn var(--dur-slow) var(--ease-out) both}
 ${days.map((_, i) => `.wt-col:nth-child(${i + 1})>a{animation-delay:${i * 40}ms}`).join('')}
}
`;
function timelineBody() {
  const labels = [['00', 0], ['06', 12], ['12', 24], ['18', 36], ['24', 48]]
    .map(([l, s]) => `<span style="top:${s * ROW}px">${l}</span>`).join('');
  const cols = days.map((d) => {
    let segs = '';
    if (d.kind === 'nothing') segs = '<div class="wt-none"><span>Nothing logged</span></div>';
    else {
      const rs = runs(d.slots);
      segs = rs.map((r) => {
        const hasNote = d.noteSlots.some((n) => n >= r.start && n < r.start + r.len);
        return `<div class="seg c-${r.c}" style="top:calc(${r.start * ROW}px + .5px);height:calc(${r.len * ROW}px - 1px)" title="${clock(r.start)}–${clock(r.start + r.len)} ${LABEL[r.c]}">${hasNote ? '<i class="note-dot"></i>' : ''}</div>`;
      }).join('');
    }
    const now = d.isToday ? '<div class="wt-now" title="Now 15:00"></div>' : '';
    const cls = [d.isToday ? 'today' : '', d.kind === 'nothing' ? 'nothing' : '', d.isWeekend ? 'weekend' : ''].join(' ');
    const bg = d.isToday ? 'var(--today-bg)' : d.kind === 'nothing' ? 'var(--surface-2)' : d.isWeekend ? 'var(--weekend-bg)' : 'transparent';
    const parts = CATS.concat([['s', 'Sleep'], ['u', 'Unlogged']]).filter(([k]) => d.sum[k] > 0 && d.kind === 'logged').map(([k, l]) => `${l} ${hrs(d.sum[k])}`);
    const aria = `${dayFull(d)}${d.isToday ? ', today' : ''}: ${d.kind === 'logged' ? parts.join(', ') + `, ${d.noteCount} notes` : summaryText(d)}`;
    return `<li class="wt-col ${cls}"><a href="#" aria-label="${esc(aria)}" style="--col-bg:${bg}"><div class="wt-head"><span class="wt-dn">${d.name}</span><span class="wt-dd">${d.date}</span><span class="wt-badge">${d.isToday ? 'Today' : ''}</span></div><div class="wt-chart">${segs}${now}</div></a></li>`;
  }).join('');
  const chips = CATS.concat([['s', 'Sleep'], ['u', 'Unlogged']])
    .map(([k, l]) => `<span class="chip">${dot(k)}${l} <small>${hrs(week[k])}</small></span>`).join('');
  return () => `<section class="card wt"><div class="wt-body"><div class="wt-gutter" aria-hidden="true"><div class="wt-labels">${labels}</div></div><ol class="wt-cols">${cols}</ol></div>
<div class="wt-legend">${chips}</div>
<div class="wt-key"><span class="k">${dot('f')}Future</span><span class="k"><i class="nowk"></i>Now 15:00</span><span class="k"><i class="notek"></i>Note</span><a class="stats-link" href="#">Week stats ›</a></div></section>`;
}

/* --------------------------------------------------------------- B Shelf */
const shelfCss = `
.rows{display:flex;flex-direction:column;gap:8px}
.row{display:flex;align-items:center;gap:12px;padding:10px 12px;min-height:92px}
.row.short{min-height:72px}
.row.weekend{background:var(--weekend-bg)}
.row.today{background:var(--today-bg);outline:3px solid var(--accent)}
.row.future{opacity:.6}
.row-jar{width:44px;flex:none;display:flex;justify-content:center}
.row.short .row-jar{width:44px}
.row-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}
.row-top{display:flex;align-items:center;gap:8px;font-weight:700;font-size:15px}
.row-top .muted{font-weight:600;color:var(--muted);font-size:13px}
.catbar{height:6px;border-radius:999px;background:var(--surface-2);display:flex;overflow:hidden}
.catbar-fill{display:flex;gap:2px;height:100%}
.catbar-fill i{display:block;height:100%;border-radius:999px;min-width:3px}
.catbar-fill i.c-b{box-shadow:inset 0 0 0 1px var(--b-ring)}
.row-cats{font-size:12px;line-height:1.45;color:var(--text);font-weight:600}
.row-cats .it{display:inline-flex;align-items:center;gap:5px;white-space:nowrap;margin-right:2px}
.row-cats .it{margin-right:10px}
.row-cats .dot{width:8px;height:8px}
.row-note{font-size:12px;color:var(--muted);font-style:italic;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.row-note .more{font-style:normal;font-weight:600}
.row-note .lbl{font-style:normal;font-weight:700}
.row-empty{font-size:13px;color:var(--muted);font-weight:600}
.row-chev{color:var(--muted);flex:none;display:grid}
.stats-wrap{text-align:right;padding:0 4px}
@media (prefers-reduced-motion: no-preference){
 .row{animation:rowIn var(--dur-slow) var(--ease-out) both}
 ${days.map((_, i) => `.row:nth-child(${i + 1}){animation-delay:${i * 30}ms}`).join('')}
}
`;
function shelfBody() {
  return (t) => {
    const rows = days.map((d) => {
      const cls = ['row', 'card', d.isToday ? 'today' : '', d.isWeekend ? 'weekend' : '', d.kind === 'future' ? 'future' : '', d.kind !== 'logged' ? 'short' : ''].join(' ');
      const jar = `<div class="row-jar">${miniJar(d, t, d.kind === 'logged' ? 44 : 34)}</div>`;
      const badge = d.isToday ? '<span class="badge">Today</span>' : '';
      if (d.kind === 'future') {
        return `<div class="${cls}" aria-label="${dayFull(d)}: not yet">${jar}<div class="row-body"><div class="row-top">${d.name} ${d.date}<span class="muted">· Not yet</span></div></div></div>`;
      }
      if (d.kind === 'nothing') {
        return `<a class="${cls}" href="#" aria-label="${dayFull(d)}: nothing logged">${jar}<div class="row-body"><div class="row-top">${d.name} ${d.date}</div><div class="row-empty">Nothing logged</div></div><span class="row-chev">${chev('r')}</span></a>`;
      }
      const fill = CATS.filter(([k]) => d.sum[k] > 0).map(([k]) => `<i class="c-${k}" style="flex-grow:${d.sum[k]}"></i>`).join('');
      const barW = (d.loggedHours / maxLogged * 100).toFixed(1);
      const cats = CATS.filter(([k]) => d.sum[k] > 0).map(([k, l]) => `<span class="it">${dot(k)}${l} ${hrs(d.sum[k])}</span>`).join('');
      const more = d.noteCount > 1 ? ` <span class="more">+${d.noteCount - 1} note${d.noteCount - 1 === 1 ? '' : 's'}</span>` : '';
      const noteLine = d.reflection
        ? `<div class="row-note"><span class="lbl">Reflection:</span> “${esc(d.reflection)}” <span class="more">· ${d.noteCount} notes</span></div>`
        : d.firstNote ? `<div class="row-note">“${esc(d.firstNote)}”${more}</div>` : '';
      const aria = `${dayFull(d)}${d.isToday ? ', today' : ''}: ${summaryText(d)}, ${d.noteCount} notes`;
      return `<a class="${cls}" href="#" aria-label="${esc(aria)}">${jar}<div class="row-body"><div class="row-top">${d.name} ${d.date}${badge}</div><div class="catbar" aria-hidden="true"><div class="catbar-fill" style="width:${barW}%">${fill}</div></div><div class="row-cats">${cats}</div>${noteLine}</div><span class="row-chev">${chev('r')}</span></a>`;
    }).join('');
    return `<div class="rows">${rows}</div><div class="stats-wrap"><a class="stats-link" href="#">Week stats ›</a></div>`;
  };
}

/* ------------------------------------------------------------- C Balance */
const HALF = 141;
const balanceCss = `
.bal{padding:10px 8px 12px}
.bal-grid{display:grid;grid-template-columns:56px ${HALF}px 1px ${HALF}px;align-items:center}
.bal-head{padding-bottom:8px;margin-bottom:2px;border-bottom:1px solid var(--border-strong);align-items:end}
.bal-side{padding:0 8px;display:flex;flex-direction:column;gap:3px}
.bal-side.l{align-items:flex-end;text-align:right}
.bal-side.r{align-items:flex-start;text-align:left}
.bal-name{font-size:12px;font-weight:700;display:flex;align-items:center;gap:4px;flex-wrap:wrap;line-height:1.25}
.bal-side.l .bal-name{justify-content:flex-end}
.bal-total{font-size:17.6px;font-weight:800;font-variant-numeric:tabular-nums}
.axis{align-self:stretch;background:var(--border-strong)}
.brow{display:grid;grid-template-columns:56px ${HALF}px 1px ${HALF}px;align-items:center;height:48px;border-radius:12px;position:relative}
.brow.today{background:var(--today-bg);outline:3px solid var(--accent);z-index:1}
.brow.weekend{background:var(--weekend-bg)}
.brow.future{opacity:.6}
.blabel{padding-left:6px;display:flex;flex-direction:column;gap:2px;font-size:13px;font-weight:700;line-height:1.1}
.blabel .d{font-size:12px;font-weight:600;color:var(--muted)}
.blabel .badge{height:14px;font-size:9px;padding:0 5px;width:max-content}
.half{height:100%;display:flex;flex-direction:column;justify-content:center;gap:2px}
.bar{height:22px;display:flex;overflow:hidden}
.half.l .bar{flex-direction:row-reverse;justify-content:flex-start}
.half.r .bar{flex-direction:row;justify-content:flex-start}
.bseg{font-style:normal;display:grid;place-items:center;font-size:11px;font-weight:800;color:var(--ink);font-variant-numeric:tabular-nums;flex:none;height:100%;box-shadow:inset 0 0 0 1px transparent}
.bseg.c-b{color:var(--b-ink);box-shadow:inset 0 0 0 1px var(--b-ring)}
.bseg.outer-l{border-radius:8px 0 0 8px}
.bseg.outer-r{border-radius:0 8px 8px 0}
.bseg+.bseg{margin-left:0}
.half.l .bseg+.bseg{margin-right:1px}
.half.r .bseg+.bseg{margin-left:1px}
.cap{width:12px;height:100%;border:1.5px dashed var(--border-strong);border-left:0;border-radius:0 8px 8px 0;flex:none;margin-left:2px}
.bval{font-size:11.5px;font-weight:700;color:var(--muted);font-variant-numeric:tabular-nums;line-height:1}
.half.l .bval{text-align:right;padding-right:6px}
.half.r .bval{text-align:left;padding-left:6px}
.bmsg{grid-column:2 / 5;text-align:center;font-size:13px;font-weight:600;color:var(--muted)}
.bal-foot{display:flex;align-items:center;gap:12px;margin-top:10px;padding:10px 6px 0;border-top:1px solid var(--border-strong);font-size:12.5px;font-weight:600;color:var(--muted);flex-wrap:wrap}
.bal-foot .it{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.bal-foot .stats-link{margin-left:auto}
@media (prefers-reduced-motion: no-preference){
 .half.l .bar{transform-origin:right;animation:grow var(--dur-slow) var(--ease-spring) both}
 .half.r .bar{transform-origin:left;animation:grow var(--dur-slow) var(--ease-spring) both}
 ${days.map((_, i) => `.brow:nth-of-type(${i + 1}) .bar{animation-delay:${i * 40}ms}`).join('')}
}
`;
function balanceBody() {
  const pxPerH = HALF / scale;
  const bars = (d, keys, side) => {
    const segs = keys.filter((k) => d.sum[k] > 0);
    return segs.map((k, idx) => {
      const w = d.sum[k] / scale * 100;
      const inside = d.sum[k] * pxPerH >= 28 ? hrs(d.sum[k]) : '';
      const outer = idx === segs.length - 1 ? ` outer-${side}` : '';
      return `<i class="bseg c-${k}${outer}" style="width:${w.toFixed(2)}%" title="${LABEL[k]} ${hrs(d.sum[k])}">${inside}</i>`;
    }).join('');
  };
  const rows = days.map((d) => {
    const cls = ['brow', d.isToday ? 'today' : '', d.isWeekend ? 'weekend' : '', d.kind === 'future' ? 'future' : ''].join(' ');
    const label = `<div class="blabel"><span>${d.name}</span><span class="d">${d.date}</span>${d.isToday ? '<span class="badge">Today</span>' : ''}</div>`;
    if (d.kind === 'future') return `<div class="${cls}" aria-label="${dayFull(d)}: not yet">${label}<div class="bmsg">·  Not yet  ·</div></div>`;
    if (d.kind === 'nothing') return `<a class="${cls}" href="#" aria-label="${dayFull(d)}: nothing logged">${label}<div class="bmsg">Nothing logged</div></a>`;
    const aria = `${dayFull(d)}${d.isToday ? ', today' : ''}: ${CATS.filter(([k]) => (k === 'p' || k === 'g') && d.sum[k] > 0).map(([k, l]) => `${l} ${hrs(d.sum[k])}`).join(', ')}; ${CATS.filter(([k]) => (k === 'r' || k === 'b') && d.sum[k] > 0).map(([k, l]) => `${l} ${hrs(d.sum[k])}`).join(', ') || 'no unwanted or wasted time'}`;
    const cap = d.isToday ? '<i class="cap" title="so far"></i>' : '';
    return `<a class="${cls}" href="#" aria-label="${esc(aria)}">${label}
<div class="half l"><div class="bar">${bars(d, ['r', 'b'], 'l')}</div><div class="bval">${hrs(minusOf(d))}</div></div><div class="axis"></div>
<div class="half r"><div class="bar">${bars(d, ['p', 'g'], 'r')}${cap}</div><div class="bval">${hrs(plusOf(d))}${d.isToday ? ' so far' : ''}</div></div></a>`;
  }).join('');
  const minus = week.r + week.b;
  const plus = week.p + week.g;
  return () => `<section class="card bal">
<div class="bal-grid bal-head"><div></div>
<div class="bal-side l"><div class="bal-name">${dot('r')}${dot('b')}Unwanted + Wasted</div><div class="bal-total">−${hrs(minus)}</div></div><div class="axis"></div>
<div class="bal-side r"><div class="bal-name">${dot('p')}${dot('g')}Purposeful + Productive</div><div class="bal-total">+${hrs(plus)}</div></div></div>
${rows}
<div class="bal-foot"><span class="it">${dot('s')}Sleep ${hrs(week.s)}</span><span class="it">${dot('u')}Unlogged ${hrs(week.u)}</span><a class="stats-link" href="#">Week stats ›</a></div></section>`;
}

page('timeline.html', 'Timeline', 'Direction A: 7 day columns by 48 half-hour rows. Drops jars.', timelineCss, timelineBody());
page('shelf.html', 'Shelf journal', 'Direction B: one row per day with a MiniJar, a proportion bar and the day’s words. Keeps jars.', shelfCss, shelfBody());
page('balance.html', 'Balance', 'Direction C: bars diverge from a center line, wanted on the right. Drops jars.', balanceCss, balanceBody());

console.log('week totals (h):', JSON.stringify(week), 'scale', scale, 'maxLogged', maxLogged);
