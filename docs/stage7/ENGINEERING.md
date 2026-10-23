# Stage 7 Engineering: Week Timeline

Status: plan, ready to build. Direction **A, Timeline**, was chosen by the user. Visual spec: [DESIGN.md](./DESIGN.md) section 1A. Mockup: `design/mockups/week/timeline.html`.

## 1. Summary and dependencies

**Scope**
- Remove the Week/Month switch link from both calendar headers.
- Replace the 7 MiniJars in Week with a 7 × 48 timeline: 00:00 at the top, rounded color segments, note dots, a now line, today and weekend styling, a nothing-logged state, a legend of week hours, a key row (Future / Now / Note), and a "Week stats ›" link.
- Share is **unchanged**. `ShareButton` with `kind: 'week'` keeps its 7-jar PNG, so WeekView keeps computing `weekDays` for it.

**No changes to:** `src/types.ts`, data, rules, `src/share/**`, `src/components/tray.css`, `src/views/stats.css`, or iOS. There are no new reads; the timeline uses the existing `useDays(uid, keys[0], keys[6])` subscription.

**Depends on Stage 6.** It is already committed (`58ae583`, `a924e17`, `470f587`); confirm its review and fixer have landed before Wave 2.
- `Category = 'p'|'g'|'b'|'r'` and `MarbleColor` in `src/types.ts`.
- `CATEGORIES = ['p','g','r','b']`, `CATEGORY_LABEL`, `isCategory`, `summarize` and the `Summary` type with `p`, all in `src/lib/jar/index.ts`.
- The `--marble-p` / `-g` / `-r` / `-b` / `-sleep` / `-unlogged` / `-na` / `-empty` and `--marble-b-ring` tokens (light and dark) in `src/styles/tokens.css`.
- The `.chips`, `.chip` and `.dot-{p,g,b,r,sleep,unlogged,empty}` classes in `src/styles/base.css`.

**Overlap with Stage 6.** Stage 6 Wave 1 owned `src/lib/**`. Wave 2A owned `src/views/*.css` and `src/components/**`, and Wave 2B owned `src/views/*.tsx`. Stage 7 touches `src/lib/jar/index.ts`, `src/lib/time/slots.ts`, `WeekView.tsx`, `MonthView.tsx`, `calendar.css` and `CalendarViews.test.tsx`. **Gate:** `git status` must be clean for those paths before each Stage 7 wave starts. The timeline CSS goes in a **new** file, so no file Stage 6 styles is edited apart from removing the `.week-grid` rules from `calendar.css`.

## 2. Pure API (tests first, `TZ=America/Los_Angeles`)

### 2a. `src/lib/jar/index.ts` (refactor, no behavior change)
```ts
/** 48 slot colors; precedence: DST n/a > logged > future (empty) > sleep > unlogged. */
export function slotColors(input: ComputeMarblesInput): MarbleColor[];
/** Hours per category from slot colors (0.5 each); empty and n/a are not counted. */
export function summarizeColors(colors: readonly MarbleColor[]): Summary;
```
- `computeMarbles` pairs up `slotColors(input)`, and `summarize(marbles)` keeps its signature. The existing `jar.test.ts` cases are the regression guard; add one test asserting `computeMarbles` and `slotColors` agree on every half for a mixed day.

### 2b. `src/lib/time/slots.ts`
```ts
/** Wall-clock position of `now` within day k, in [0, 1); null unless k is now's local date. */
export function dayFraction(k: DateKey, now: Date): number | null;
```
- The result is `(getHours()*60 + getMinutes()) / 1440`. It uses the wall clock, not elapsed milliseconds, because the chart's 48 rows are wall-clock rows on DST days too.

### 2c. `src/lib/jar/timeline.ts` (new; imports from `./index` and `../time`; **not** re-exported from `index.ts`, to avoid an import cycle)
```ts
export interface TimelineSegment {
  start: number;          // slot 0..47
  length: number;         // slots
  color: MarbleColor;
  label: string;          // "09:00–12:00 Productive" (formatSlotRange + CATEGORY_LABEL)
  hasNote: boolean;       // a valid note key falls in [start, start+length)
}
export interface TimelineDay {
  date: DateKey;
  segments: TimelineSegment[];   // [] when nothingLogged
  nothingLogged: boolean;        // isEmptyPastDay(date, today, doc?.slots)
  isToday: boolean;
  isWeekend: boolean;            // getDay() is 0 or 6, independent of weekStart
  summary: Summary;              // summarizeColors of this day's slotColors
  noteCount: number;
  hasReflection: boolean;
  nowFraction: number | null;    // dayFraction(date, now)
  ariaLabel: string;             // see below
  description: string;           // logged runs only: "Productive 09:00–12:00, Wasted 20:00–22:30"
}
export function colorRuns(colors: readonly MarbleColor[]): Array<{ start: number; length: number; color: MarbleColor }>;
export function weekTimeline(input: {
  dates: DateKey[];                                  // weekRange(...) output, 7 keys in order
  days: Record<DateKey, DayDoc | undefined>;
  settingsSleep: SleepWindow;                        // used when a day has no doc
  now: Date;
}): { days: TimelineDay[]; total: Summary };         // total = sum of the 7 summaries
```

**Rules**
- **Runs.** `colorRuns` merges adjacent equal colors and **ignores `breaks`**, the same as the jar. Two back-to-back Productive entries form one segment, and its dot covers both notes.
- **Sleep snapshot.** Use `doc?.sleep ?? settingsSleep`, the same as WeekView today.
- **Valid notes.** A note counts only if `isCategory(slots[key])`. Stale keys are ignored. A midnight-crossing entry's note lives on its start day only, so the 00:00 continuation has no dot.
- **Reflections** have no time, so they get **no dot**. They're mentioned in `ariaLabel` only.
- **`ariaLabel` format:**
  - Logged day: `"Tue Oct 20, today: Purposeful 2h, Productive 8.5h, Sleep 8h, Unlogged 1h, 3 notes, reflection"`. Use `weekdayMonthDay`, include only non-zero entries in `CATEGORIES` order then Sleep and Unlogged, and use the `1 note` / `N notes` wording.
  - Nothing logged: `"Thu Oct 22: nothing logged"`.
  - Future day: `"Sat Oct 24: not yet"`.
- **Hours format.** Share one helper with `formatSummary` (integer, or one decimal place).

### 2d. Test list
`timeline.test.ts`, plus additions to `jar.test.ts` and `time.test.ts`:
1. `slotColors` precedence: n/a beats logged on the spring-forward day, logged beats future, future beats sleep, and sleep beats unlogged.
2. `colorRuns`: empty input, a single run of 48, alternating colors, and same-category entries separated by a `breaks` mark merging into one run.
3. **Spring-forward week** (Mon Mar 2 – Sun Mar 8 2026): Mar 8 has an `na` segment at slots 4–5 (02:00–03:00), its summary totals 23h, and `total` excludes the n/a time.
4. **Fall-back week** (Oct 26 – Nov 1 2026): Nov 1 has 48 rows, no `na`, and totals 24h (a documented limitation).
5. **Midnight crossing:** Tue 22:00 → Wed 01:00 Productive gives Tue a `g` run 44–48 with a dot, and Wed a `g` run 0–2 with no dot, followed by sleep.
6. **Wednesday 00:00 logged over sleep:** Wasted at slots 0–1 inside a 23:00–07:00 window shows `b` there and `sleep` from slot 2 to 14.
7. **Today partially future** (now 15:00): slots up to 29 are past or computed, slot 30 is `empty` through 47 as one segment, and `nowFraction` is 0.625. A slot that has already begun (14:45 → slot 29) is not future.
8. **Empty past day** (no doc, and all `'.'` slots): `nothingLogged`, `segments: []`, the nothing-logged label, and it contributes 0 to `total`. Today with nothing logged is **not** blank.
9. **Future day:** a single `empty` segment 0–48, "not yet", and `nowFraction` null.
10. **Week start:** `weekRange(…,'sun')` vs `'mon'` keeps the order of `dates`, and `isWeekend` is true for Sat and Sun in both.
11. Notes: a stale key on a `'.'` slot is ignored, two notes in one merged run give one dot and `noteCount` 2, and reflection appears in `ariaLabel`.
12. `total` equals the sum of the daily summaries. Each past day's 6 keys sum to 24, or 23 on spring-forward.
13. `dayFraction`: today 00:00 gives 0, 23:59 gives about 0.9993, another day gives null, and 03:30 on Mar 8 gives 210/1440.

## 3. Component design

**Files**
- `src/components/WeekTimeline.tsx`
- `src/components/weekTimeline.css` (a new file, imported by the component)

**Props**
```ts
interface WeekTimelineProps {
  days: TimelineDay[];
  total: Summary;
  statsHref: string;     // `/stats/week/${keys[0]}`
  showNow: boolean;      // the week contains today
  nowLabel: string;      // "Now 15:00", from slotToHHmm-like formatting of now
}
```
- WeekView also renders `<WeekTimelineSkeleton />` (7 `--surface-2` columns, exported from the same file) while `loading`.

**Rendering: HTML and CSS, not SVG.**
- Each column chart is a `position: relative` box. Each segment is an absolutely positioned `div` with `top: calc(var(--s) * 100% / 48 + 0.5px)` and `height: calc(var(--l) * 100% / 48 - 1px)`. `--s` and `--l` are set as inline custom properties (cast `as CSSProperties`).
- Why not SVG:
  - The chart height is fluid. SVG would distort the dashed future strokes, the 4px radii and the vertical "Nothing logged" text under `preserveAspectRatio="none"`, or need JavaScript measurement.
  - HTML gives dashed borders, `writing-mode: vertical-rl`, `title` tooltips, focus outlines and token classes for free.
  - jsdom can query the result.
- The columns are a CSS grid (`grid-template-columns: repeat(7, minmax(0, 1fr))`, gap 6px), and the hour gutter is the first 24px track.

**Markup**
```
section.card.wt
  div.wt-body > div.wt-gutter[aria-hidden] (00 06 12 18 24) + ol.wt-cols
    li.wt-col(.today .weekend .nothing) > Link.wt-link to=/day/:date aria-label aria-describedby
      div.wt-head: span.wt-dn (Mon) span.wt-dd (19) span.wt-badge (Today | empty)
      div.wt-chart[aria-hidden] (gridlines every 12 rows as background gradients)
        div.wt-seg.c-{p|g|b|r|sleep|unlogged|empty|na} title=label > i.wt-note? 
        div.wt-now style=--now (today only)
        div.wt-none > span "Nothing logged" (nothingLogged only)
      span.sr-only#wt-desc-{date} = description
  ul.chips.wt-legend (6 chips from total, CATEGORIES then Sleep, Unlogged; `.dot-*` + "Purposeful 7h")
  div.wt-key: Future (.dot-empty), Now (only if showNow; nowLabel), Note, DST n/a (only if any na segment), Link.stats-link "Week stats ›"
```

**Styling notes**
- Segment colors: `.c-x { background: var(--marble-x) }`. They're flat, with 4px radius.
- `.c-empty` is transparent with a `1.5px dashed var(--marble-empty)` border.
- `.c-b` gets an inset `0 0 0 1px var(--marble-b-ring)` shadow.
- Column backgrounds: `.weekend` uses `--weekend-bg`, `.today` uses `--today-bg` with a `3px solid var(--accent)` outline, and `.nothing .wt-chart` uses `--surface-2`.
- Focus: `:focus-visible` uses a box-shadow ring (`0 0 0 3px var(--text)`), so it doesn't fight today's outline.
- The note dot is 8px `--surface` with a 1.5px `--text` border at the segment's top-right. The now line is 3px `--accent` with a 1px `--text` halo.
- Hidden description text uses the existing `.sr-only` class in `base.css`.

**Motion.** Under `@media (prefers-reduced-motion: no-preference)` only, `.wt-link` gets a `colIn` animation (opacity plus `scaleY(.96)`, origin top, `--dur-slow`, `--ease-out`, `animation-delay: calc(var(--i) * 40ms)`). The now line is not animated.

**Height (fit at 390 × 844)**
- Set `.wt-chart { height: var(--wt-chart-h) }` with `--wt-chart-h: clamp(288px, calc(100dvh - var(--tabbar-h) - env(safe-area-inset-bottom, 0px) - var(--wt-chrome)), 480px)`.
- `--wt-chrome` (about 360px) is everything else on the page: page padding, the header card, the gap, the card padding, the 58px column head, a 2-row legend and the key row.
- At 844 − 64 − 34 − 360 the chart is about 386px, so rows are about 8px, matching the mockup.
- On short phones (667px) it clamps to 288px (6px rows) and the page scrolls a little, with no clipping.
- On desktop it caps at 480px (10px rows). Columns grow with the card (max-width already set by layout).
- `--wt-chrome` is the single tuning knob for the smoke test.
- At 360px wide, columns are about 36px. That's fine for WCAG 2.5.8 (24px minimum), and each column is the full chart height.

## 4. WeekView and MonthView changes and tests

**`WeekView.tsx`**
- Delete the `Month` `<Link>` (lines 58–60).
- Keep `weekDays` (computeMarbles) for `ShareButton` only, and drop the `MiniJar` import and the `.week-grid` list.
- Add `const tl = useMemo(() => weekTimeline({ dates: keys, days, settingsSleep: {start, end}, now }), [...])`, then render `<WeekTimeline …/>` or the skeleton.

**`MonthView.tsx`.** Delete the `Week` `<Link>` (lines 61–63). `range` is still used by `useDays`.

**`calendar.css`.** Remove only the `.week-grid*` rules. `.day-cell`, `.day-name` and `.today-badge` stay because Month uses them. Check that a lone `This month` button still aligns in `.date-tools`.

**`CalendarViews.test.tsx`**
- The `describe.each([WeekView, MonthView])` block (lines 88–129) queries jar `img` roles. It becomes **Month-only**, with the same 4 tests.
- A new `describe('WeekView timeline')` uses the same fakeRepo and the fake time Wed Oct 14 12:00:
  1. Mon Oct 12 with all `'.'` slots: the link has the name `Mon Oct 12: nothing logged`, its text includes "Nothing logged", and it has 0 `.wt-seg`.
  2. Tue Oct 13 with `LOGGED`: the link name matches `/^Tue Oct 13: Productive 1h/`, a `.wt-seg.c-g` exists, and the link's href is `/day/2026-10-13`.
  3. Wed Oct 14 (today): the link name contains `, today`, `.wt-now` exists, and `.wt-seg.c-empty` exists.
  4. Thu Oct 15 has a single `.c-empty` segment and the name `Thu Oct 15: not yet`.
  5. The "Week stats" link points to `/stats/week/2026-10-12`, and the legend has the text `Productive 1h`.
  6. Headers: Week has no link named `Month`, and Month has no link named `Week`. "This week", "This month" and Share are still present.
- No other test file references `.week-grid` (check with `rg week-grid src`).

## 5. Build waves (Sonnet 5.5; sequential; the orchestrator re-verifies after each)

**Verification for every wave:** `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, then **unsandboxed** `npm run build` and `VITE_DEMO=false npm run build`, then `git status` (only the owned paths are changed).

**Wave 1: pure lib** (about 35 credits)
- Owns: `src/lib/jar/index.ts`, `src/lib/jar/timeline.ts`, `src/lib/jar/timeline.test.ts`, `src/lib/jar/jar.test.ts`, `src/lib/time/slots.ts`, `src/lib/time/time.test.ts`.
- Work: write the tests in 2d first, then implement 2a–2c. No behavior change to `computeMarbles` or `summarize`.
- Commit: `feat(lib): week timeline segments, slot colors and day fraction` + blank line + `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`

**Wave 2: UI and header** (about 70 credits; starts after Wave 1 is verified)
- Owns: `src/components/WeekTimeline.tsx`, `src/components/weekTimeline.css`, `src/views/WeekView.tsx`, `src/views/MonthView.tsx`, `src/views/calendar.css`, `src/views/CalendarViews.test.tsx`.
- Reads: DESIGN 1A, this doc's sections 3 and 4, `timeline.html` and `screens/timeline-both.png`.
- Work: sections 3 and 4. Use tokens only (no hex in CSS), and don't edit `base.css` or `tokens.css`. If a missing utility is needed, ask the orchestrator.
- Commit: `feat(ui): week timeline view and drop Week/Month switch links` + trailer.

**Wave 3: review, fix and smoke** (about 85 credits)
- **Sonnet review** over `git diff <pre-wave-1>..HEAD`. Focus on precedence, DST, aria text, no extra subscriptions, reduced motion and token use.
- **Sonnet fixer** for high-confidence findings. Commit: `fix(ui): week timeline review fixes` + trailer.
- **Browser smoke test:** run `VITE_DEMO=true npm run dev -- --port 5173 --strictPort`. At 390 × 844 and 360 × 740, in light, dark and reduced motion, check:
  - The chart and legend fit above the tab bar at 844, and only scroll a little at 667.
  - The now line is on today, and a nothing-logged column shows its vertical label.
  - Tapping a column opens Day.
  - Tab and Enter reach every column and the "Week stats ›" link.
  - Share still produces the 7-jar PNG.
  - The Month header shows only "This month".
  - Stop the dev server by PID.

**After Wave 3, the orchestrator updates docs:** SPEC F5 (the Week timeline, with Week and Month reached from the tab bar), the PLAN Stage 7 section, and a HANDOFF row.

## 6. Credit estimate (Sonnet 5.5: 200 per 1M input, 1000 per 1M output)
| Step | In / out tokens | ≈ credits |
|---|---|---|
| Wave 1 lib and tests | 100k / 15k | 35 |
| Wave 2 UI and tests | 200k / 30k | 70 |
| Code review | 120k / 6k | 30 |
| Fixer | 60k / 8k | 20 |
| Browser smoke (2 sizes × light, dark, reduced motion) | 150k / 5k | 35 |
| **Total (workers only)** | | **≈ 190** |

Orchestrator (Opus) verification overhead is not included.

## 7. Risks and open questions

**Risks**
- **Fit varies by device chrome.** `--wt-chrome` is a measured constant, so if the header or legend wraps differently it drifts. Mitigation: the clamp's floor and ceiling, plus tuning during the smoke test.
- **The fall-back day hides the repeated hour.** This is the existing documented limitation, unchanged.
- **Merged runs hide entry boundaries** (breaks are ignored, as in the jar). Notes from several entries share one dot, and `noteCount` in the aria label stays exact.
- **Stage 6 tail edits** to `WeekView`, `MonthView`, `calendar.css` or `src/lib/jar/index.ts` would conflict. That's what the clean-status gate in section 1 is for.
- **jsdom and CSS:** tests assert classes and aria, not geometry. Geometry is checked only in the smoke test.

**Open questions (defaults in bold; the build can proceed on these)**
1. **Short screens:** **rows shrink to 6px, and the page scrolls slightly below that**, or always force the timeline to fit by shrinking further?
2. **Reflections:** **no dot, only mentioned in the column's screen-reader label**, or add a small marker under the date?
3. **Future days stay tappable** (they open Day, as today), or make them non-links?

No `src/types.ts` changes are needed.
