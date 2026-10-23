# Stage 7 Design: a Week view worth having

Status: **draft, waiting for the user to pick a direction** from the mockups (section 3). The header change (section 2) applies to every direction.

**Problem.** Week (`src/views/WeekView.tsx`) is a row of 7 MiniJars, and Month (`src/views/MonthView.tsx`) is a grid of the same MiniJars, so Week adds nothing that Month doesn't already show. Month stays as it is.

**Fixed (user):** the Week/Month switch link in both headers goes away. "This week", "This month", the ‹ › arrows and the week Share button stay. At least one direction keeps jars and at least one drops them. Tapping a day still opens `/day/:date`.

**How Week differs from Stats.** Stats (`/stats/week/:date`) answers "how much, in total, as a percentage". Every direction below answers a **per-day or per-time-of-day** question that Stats can't answer, and none of them shows percentages. Each direction ends with a quiet "Week stats ›" link to `/stats/week/:date`, so totals have one home.

**Shared ground rules (all directions)**
- Data: the same single `useDays(uid, keys[0], keys[6])` subscription, giving 7 `DayDoc`s. No new reads, no per-day listeners. Notes and reflections are already on the doc.
- Colors come from the Stage 6 order and tokens: Purposeful `p` (`--marble-p`, mint), Productive `g` (`--marble-g`, sky), Unwanted `r` (coral), Wasted `b` (darkest, with `--marble-b-ring` in dark mode), Sleep (periwinkle), Unlogged (matte gray), Future (`--marble-empty` dashed), DST n/a (`--marble-na`). Labels come from `CATEGORY_LABEL`, and the order from `CATEGORIES`.
- Precedence is unchanged (DST n/a > logged > future > sleep > unlogged). Colors are always computed by `src/lib/jar`, never by the view.
- Today uses `--today-bg` plus a 3px `--accent` outline and a "Today" badge. Weekends use `--weekend-bg`. A past day with nothing logged uses the same `isEmptyPastDay` rule the jars use.
- Motion uses transform and opacity only, and is wrapped in `@media (prefers-reduced-motion: no-preference)`. Under reduced motion everything renders in its final state.

## 1. Directions

### A. Timeline (recommended, drops jars)
**Best at:** time-of-day patterns. "I always lose 21:00–23:00", "Purposeful only happens before 09:00", "Wednesday started late". No other screen shows *when*, across days.

The layout is 7 day columns × 48 half-hour rows, like a mini calendar week. Each column is the day's 48 slot colors, merged into rounded segments of the same color.

```
┌ card ────────────────────────────────────┐   390px wide, page padding 16
│ ‹      Oct 19 – Oct 25        ›          │   header (section 2)
│        2026                              │
│ [This week]  [Share]                     │
└──────────────────────────────────────────┘
┌ card ────────────────────────────────────┐
│      Mon  Tue  Wed  Thu  Fri  Sat  Sun   │   day name + date, 0.7rem
│       19   20   21   22  (23)  24   25   │   today = accent-soft pill
│ 00 ┤ ▓▓▓  ▓▓▓  ███  ·    ▓▓▓  ┆ ┆  ┆ ┆   │   ▓ sleep  █ logged  ░ unlogged
│    │ ▓▓▓  ▓▓▓  ▓▓▓  N    ▓▓▓  ┆ ┆  ┆ ┆   │   ┆ future (dashed outline)
│ 06 ┤ ▓▓▓  ▓▓▓  ▓▓▓  o    ▓▓▓  ┆ ┆  ┆ ┆   │   "Nothing logged" written
│    │ ██●  ░░░  ░░░  t    ██●  ┆ ┆  ┆ ┆   │   vertically in Thu's column
│ 12 ┤ ███  ███  ███  h    ███  ┆ ┆  ┆ ┆   │   ● = this segment has a note
│    │ ███  ███  ███  i    ██━━━━━━━━━━━   │   ━ now line (today only)
│ 18 ┤ ██●  ███  ██●  n    ┆ ┆  ┆ ┆  ┆ ┆   │
│    │ ███  ███  ░░░  g    ┆ ┆  ┆ ┆  ┆ ┆   │
│ 24 ┤ ░▓▓  ▓▓▓  ▓▓▓  ·    ┆ ┆  ┆ ┆  ┆ ┆   │
│                                          │
│ ● Purposeful 7h  ● Productive 19.5h      │   week legend = SummaryChips
│ ● Unwanted 4h  ● Wasted 9h  ● Sleep 34h  │   over all 168 marbles (hours,
│ ● Unlogged 11.5h       Week stats ›      │   no %), so color is paired with text
└──────────────────────────────────────────┘
```
- **Sizing at 390px:** a 358px card with 10px padding and a 24px hour gutter leaves about 314px, so 7 columns of 40px with 6px gaps. Rows are 8px (48 × 8 = 384px of chart), and the whole view fits above the tab bar on an 844px screen. On desktop (≥ 640px), columns grow to 64px and rows to 10px.
- **Components:** a new `WeekTimeline.tsx` (one `<ol>` of 7 column links). Each column is a flex stack of segments with `flex-grow: len`. Segments use `--marble-*` base colors, flat (no gloss), `--radius-sm` scaled down to 4px, with a 1px `--surface` gap between segments. Wasted segments get `--marble-b-ring` as an inset 1px shadow in dark mode. Future segments are transparent with a 1.5px dashed `--marble-empty` border. DST n/a segments use `--marble-na`. Hour gutter labels every 6h (`00 06 12 18 24`) are 0.65rem `--text-muted`, with faint `--border` gridlines.
- **Orientation:** 00:00 at the **top**, like a calendar (open question 2; the jar puts 00:00 at the bottom).
- **Note marker:** a 5px `--surface` dot with a `--text` ring at the top-right of the segment containing a note's start slot. It's decorative, and the column label carries the note count.
- **Now line:** on today's column, a 2px `--accent` line at the current time, updated by `useNow`.
- **Interactions:** tapping or clicking a column opens `/day/:date` (the whole column is the tap target, at least 40×384). Desktop hover shows a `title` per segment ("09:00–12:30 Productive"). Nothing is draggable.
- **States:** **today** gets the accent-soft date pill, the column outline and the now line. **Future** days are fully dashed. **Nothing logged** shows a `--surface-2` column with "Nothing logged" set vertically in 0.65rem muted text, with no sleep fill, matching the bare jar. **Loading** is a skeleton of 7 `--surface-2` columns.
- **Motion:** on mount, columns fade in with `scaleY` from 0.96 (origin top), a 40ms stagger, `--dur-slow` and `--ease-out`.
- **A11y:** each column link has an `aria-label` like "Tue Oct 20, today: Purposeful 2h, Productive 8.5h, Unwanted 0.5h, Wasted 4h, Sleep 8h, Unlogged 1h, 3 notes" (built from `summarize`, in `CATEGORIES` order). Segments are `aria-hidden`. The legend chips pair every color with a word. The hour gutter is `aria-hidden`.
- **Changes vs. today:** `.week-grid` and MiniJars are removed from Week. Adds a timeline card and a legend. Share stays **as is** (a 7-jar PNG; open question 4).
- **New pure helpers (`src/lib/jar`, tests first):** `slotColors(input: ComputeMarblesInput): MarbleColor[]` (48 entries; `computeMarbles` is refactored to use it, with no behavior change), and `colorRuns(colors): { start, len, color }[]`, which merges by color and ignores `breaks`, the same as the jar. In `src/lib/time`: `slotFraction(date, now): number | null` for the now line, if no helper exists already. The note count is `Object.keys(doc.notes).length`.
- **Build size:** medium. About 40 lines of lib plus tests, about 150 lines of component, about 90 lines of CSS, and a small WeekView edit.

### B. Shelf journal (keeps jars)
**Best at:** reviewing the week's story and comparing days side by side: what each day held, plus the notes and reflection you wrote. It reads like a diary, not a calendar.

The layout is a vertical list of 7 day rows. Each row has a MiniJar on the left and the day's words on the right.

```
┌ card: header (section 2) ────────────────┐
└──────────────────────────────────────────┘
┌ row ─────────────────────────────────────┐   each row: card, ~92px, gap 8
│ ╭─╮  Mon 19                           ›  │
│ │●│  ▰▰▰▰▰▰▰▱▱▱▱▱▰▰▰▰                  │   proportion bar of logged time
│ │●│  Purposeful 3h · Productive 7.5h     │   (p g r b order), 6px tall
│ ╰─╯  Unwanted 1h · Wasted 2.5h           │   0.75rem
│      “Cooked dinner with Sam” +2 notes   │   first note, italic, muted, 1 line
└──────────────────────────────────────────┘
┌ row (today: accent outline) ─────────────┐
│ ╭─╮  Fri 23  [TODAY]                  ›  │
│ │●│  ▰▰▰▰▰▱▱▱▱                           │
│ ╰─╯  Purposeful 0.5h · Productive 3.5h … │
│      “Report draft”                      │
└──────────────────────────────────────────┘
┌ row (nothing logged) ────────────────────┐
│ ╭─╮  Thu 22                           ›  │   bare jar, "Nothing logged"
│ ╰─╯  Nothing logged                      │   muted, row ~64px
└──────────────────────────────────────────┘
┌ row (future, 60% opacity, no link) ──────┐
│ ╭┄╮  Sat 24 · Not yet                    │
└──────────────────────────────────────────┘
                     Week stats ›
```
- **Components:** a new `WeekDayRow.tsx` holding a `MiniJar` (size 44) and a `CategoryBar` (a new tiny component: a flex row of `--cat-*` segments with `flex-grow: hours` and 2px gaps, `aria-hidden`). It's followed by a text line of non-zero categories and a note line. The reflection (`doc.reflection`) is shown instead of the first note when one exists, prefixed "Reflection:". Rows are `--surface` cards using `--radius` and `--shadow-1`. Weekend rows use `--weekend-bg`.
- **Interactions:** each row is a link to `/day/:date`. Future rows aren't links (the day view blocks the future anyway).
- **States:** today gets the outline and badge. Future rows are dimmed, with a dashed-marble jar and "Not yet". Nothing-logged rows show a bare jar and "Nothing logged" and are shorter. Sleep and Unlogged are left out of the text line, because they're in the jar and in Stats.
- **Motion:** rows fade and rise 8px with a 30ms stagger on mount.
- **A11y:** each row link has an `aria-label` with the day, its summary and the note count. The note text is read as normal content. The bar is decorative because the text line carries the numbers.
- **Changes vs. today:** the 7-across grid becomes a 7-row list. MiniJars stay. Share stays **as is**.
- **New pure helpers:** `firstNote(doc): { text, count } | null`, ordering by slot (in `src/lib/entries`, tested). Summaries reuse `summarize`.
- **Build size:** small to medium. About 20 lines of lib plus tests, about 120 lines across 2 components, and about 70 lines of CSS.

### C. Balance (drops jars)
**Best at:** a one-glance verdict per day. Which days leaned toward chosen time and which drained away, and the week's net. Bars diverge from a center line.

```
┌ card: header (section 2) ────────────────┐
└──────────────────────────────────────────┘
┌ card ────────────────────────────────────┐
│  Unwanted + Wasted │ Purposeful + Productive│  legend row with colored dots
│          −16h      │      +29.5h          │  week totals, 1.1rem bold
├────────────────────┼─────────────────────┤
│ Mon 19   ▒▒▒▓▓▓▓▓▓ │ ████████████▓▓▓▓    │  left: r (inner) then b (outer)
│          3.5h      │      10.5h          │  right: p (inner) then g (outer)
│ Tue 20      ▓▓▓▓▓▓ │ ██████████████      │  hours under each side, 0.7rem
│ Wed 21     ▒▒▒▓▓▓▓ │ █████████           │
│ Thu 22      Nothing logged               │
│ Fri 23 ●     ▒▒▓▓  │ ████████  ┆┆┆       │  today: badge, dashed "so far" end cap
│ Sat 24          ·  │  ·  Not yet          │
│ Sun 25          ·  │  ·  Not yet          │
├──────────────────────────────────────────┤
│ Sleep 34h · Unlogged 11.5h  Week stats › │  muted footer line
└──────────────────────────────────────────┘
```
- **Sizing:** label column 56px, then two halves of about 135px each. The scale is shared across the week: the widest side of any day fills its half, so days compare honestly. Rows are 44px (tap target).
- **Components:** a new `WeekBalance.tsx`. Bars are flex segments in `--marble-*` colors with `--radius-sm` ends at the outer edge only. The center axis is a 1px `--border-strong` line. When a segment is at least 28px wide it carries its hours inside, in `--cat-ink` (or `--cat-b-ink` on Wasted).
- **Interactions:** each row is a link to `/day/:date`. Future rows aren't links.
- **States:** today has the badge and outline plus a dashed end cap meaning "so far". Future rows show "Not yet". Nothing-logged rows show centered "Nothing logged". A day with no unwanted time shows an empty left side and "0h".
- **Motion:** bars grow outward from the center (`scaleX` from 0, origin at the axis, `--dur-slow`, `--ease-spring`, 40ms stagger).
- **A11y:** row `aria-label`: "Mon Oct 19: Purposeful 3h, Productive 7.5h; Unwanted 1h, Wasted 2.5h". The legend row names both groups in words. The in-bar hours plus the legend pair color with text.
- **Risk:** it makes a value judgment (Purposeful + Productive is "good"). That matches the SPEC vision ("wanted versus wasted or unwanted"), but it's the user's call (open question 5). It's also the closest of the three to Stats, though it's still per day and has no percentages.
- **Changes vs. today:** removes the jars from Week. Share stays **as is**.
- **New pure helpers (`src/lib/jar`, tested):** `balanceOf(sum): { plus, minus }` and `weekScale(sums): number`.
- **Build size:** small to medium. About 20 lines of lib plus tests, about 120 lines of component, and about 70 lines of CSS.

### Recommendation: A (Timeline)
It's the only direction that shows something no screen shows today, the *time of day* across the week. It's visually the furthest from the month grid, and it reuses the exact marble color logic, so it's honest about sleep, unlogged and the future. It also stays fully on one screen at 390px. B is the safe pick if the user values notes and reflections over patterns. C is the most opinionated.

## 2. Header change (all directions)
- **`WeekView.tsx`:** delete the `<Link className="btn" to={`/month/...`}>Month</Link>` in `date-tools` (around lines 58–60). `date-tools` keeps `This week` and `ShareButton`.
- **`MonthView.tsx`:** delete the `<Link className="btn" to={`/week/${range.start}`}>Week</Link>` (around lines 61–63). `range` is still used by `useDays`. `date-tools` keeps only `This month`. Check that a single button still aligns, since `date-tools` is a flex row.
- No CSS change is expected, so check at 360px and 390px.
- SPEC F5 is updated at build time to describe the chosen Week view and to say that Week and Month are reached from the tab bar.

## 3. Mockup worker brief (hand to Sonnet 5.5 verbatim)

> You are building static design mockups for the **Week view** of Marbles, a mobile-first time-tracking PWA. Each day is 48 half-hour slots, and each hour is a marble in a glass jar. Repo: `/Users/danieldai/repos/marbles`. Read `docs/stage7/DESIGN.md` sections 1 and 2 (the three directions: Timeline, Shelf journal, Balance). Edit nothing outside `design/mockups/week/**`, and do not commit.
>
> **Files to create:**
> - `design/mockups/week/build.mjs`: a Node script with no dependencies that holds the fake data below and writes `timeline.html`, `shelf.html` and `balance.html` next to itself. Compute every color and total from the data (precedence: DST n/a > logged > future > sleep > unlogged). Never hand-type totals.
> - `design/mockups/week/shoot.mjs`: copy `design/mockups/shoot.mjs` and change the names list to `['timeline','shelf','balance']`, the input to `week/<name>.html`, and the output dir to `design/mockups/week/screens/`. Keep its `?view=light|dark|light-full|dark-full|both` contract.
> - Each HTML file is self-contained, with inline CSS and SVG and no external fonts, images or CDNs. Use `system-ui`. `?view=light` or `?view=dark` renders one 390px-wide phone in a `.page` element. No param (or `?view=both`) renders light and dark side by side inside `.phones`. Put the theme in CSS variables on `.theme-light` and `.theme-dark`.
>
> **Tokens** (copy from `src/styles/tokens.css`, Sorbet): light bg `#fff8f3`, surface `#fff`, surface-2 `#fdf0e8`, border `#f0dfd3`, border-strong `#a48d7d`, text `#2e2a36`, muted `#6b6378`, accent `#ffb870`, accent-soft `#ffe7cf`, accent-soft-text `#a4500f`, today-bg `#fff0e0`, weekend-bg `#fdf4ee`. Dark: bg `#1d1a2b`, surface `#27233a`, surface-2 `#312c47`, border `#423c5c`, border-strong `#7d759a`, text `#f4eefb`, muted `#b9b0cc`, accent `#ffc28a`, accent-soft `#3e3049`, accent-soft-text `#ffc28a`, today-bg `#3e3049`, weekend-bg `#2b2740`. Marbles as base/hi/lo, light then dark:
> - Purposeful `p`: `#8fe6bb/#e3fbef/#4fb98a`, then `#86dfb2/#e0f8ec/#3f9f74`
> - Productive `g`: `#7cc4ef/#e2f4fd/#3f93c4`, then `#86cbf2/#e2f4fd/#4499c9`
> - Unwanted `r`: `#f08070/#ffe1db/#c95647`, then `#f4978a/#ffe4de/#c4605a`
> - Wasted `b`: `#6e6a8e/#928eb4/#45415f`, then `#716c99/#8f8ab4/#46415f`, with a dark-mode ring `rgba(244,238,251,.55)`
> - Sleep: `#9aa6f4/#e6e9ff/#6470c9`, then `#a5aef7/#e8ebff/#6871c4`
> - Unlogged (flat): `#ebe6e1`, then `#4d4a55`
> - Future: empty with a dashed `#c9b9ab` stroke, then `#6c6582`
>
> Ink is `#1f1d2b`, except white on Wasted. The radii are 12/20/28px, and pills are 999px.
>
> **Fake week** (week starts Monday; sleep window 23:00–07:00; **today is Fri Oct 23 2026, now 15:00**, so slots from 15:00 onward today are future). Slots not listed are sleep if inside 23:00–07:00, otherwise unlogged (or future if after now).
> - **Mon 19:** 07:30–09:00 p "Morning run"; 09:00–12:00 g "Sprint planning"; 13:00–17:30 g; 17:30–18:30 r "Commute traffic"; 18:30–20:00 p "Cooked dinner with Sam"; 20:00–22:30 b "Doomscrolling". Reflection: "Solid day; the evening slipped."
> - **Tue 20:** 08:00–12:00 g; 12:00–12:30 r; 12:30–17:00 g "Shipped the export fix"; 17:00–19:00 b; 19:00–21:00 p "Guitar practice"; 21:00–23:00 b.
> - **Wed 21:** 00:00–01:00 b "Couldn't sleep, phone" (logged time overrides sleep); 09:30–11:00 r "Dentist"; 11:00–16:00 g; 16:00–16:30 b; 16:30–18:00 p "Climbing gym"; 18:00–23:00 left unlogged.
> - **Thu 22:** no document (a past day with **nothing logged**).
> - **Fri 23 (today):** 07:00–07:30 p "Meditation"; 09:00–12:30 g "Report draft"; 12:30–13:30 r "Taxes"; 13:30–14:30 b; 14:30–15:00 unlogged; 15:00 onward is future.
> - **Sat 24, Sun 25:** future (all empty).
>
> **Each phone, top to bottom:**
> 1. Header card: `‹`, the title "Oct 19 – Oct 25" with a muted "2026" under it, and `›`. Below that, the buttons `This week` and `Share` (pill buttons). There's **no** Month button.
> 2. The direction's body, exactly as sketched in DESIGN.md section 1: A is the 7×48 timeline plus legend chips; B is 7 rows with MiniJar, bar, text and note; C is the diverging bars with a legend, totals and footer. Each ends with "Week stats ›".
> 3. A fixed bottom tab bar: Day, **Week (active)**, Month, Stats, Settings, with simple inline stroke icons. The active tab is accent-soft with accent-soft-text.
>
> **MiniJar (B only):** reuse the jar SVG spec in `docs/stage5/DESIGN.md` section 5, "Jar SVG" bullets (viewBox `0 0 188 314`, hour h at `cx = 34 + 40*(h%4)`, `cy = 280 - 40*floor(h/4)`, r 16, glossy radial gradient, flat unlogged, dashed future, split half marbles). Render it at 44px wide with **no hour numbers**. Thursday is a bare jar with no marbles.
>
> **Also show:** the today highlight (today-bg, a 3px accent outline, and a "TODAY" badge or pill), weekend tint on Sat and Sun, note dots (A), and the now line at 15:00 on Friday (A). Every color must sit next to a text label somewhere on screen.
>
> **Run:** `node design/mockups/week/build.mjs`, then `node design/mockups/week/shoot.mjs`. Headless Chrome is at `/Applications/Google Chrome.app`. If shoot hangs in the sandbox, rerun it unsandboxed. Output: `design/mockups/week/screens/{timeline,shelf,balance}-{light,dark}.png` (390×844 at 2x), plus `-full` and `-both`. Open each PNG and check that text, segments and the Wasted color in dark mode are legible, and that Timeline fits above the tab bar.
>
> **Verify:** `rg -n "https?://" design/mockups/week` matches only SVG `xmlns`. Report concisely (10 lines or fewer): file paths, screenshot paths, and any size or color you changed for legibility, with the reason.

## 4. Build breakdown (after the user picks)
Credits use Sonnet 5.5 at 200/1M input and 1000/1M output.

**Wave 0 (all directions; Sonnet, can merge into Wave 2).** Header removal in `src/views/WeekView.tsx` and `src/views/MonthView.tsx`. That's 2 deletions, about 5 credits.

**A. Timeline**
| Wave | Owner paths | Work | Tests | ≈ credits |
|---|---|---|---|---|
| 1 | `src/lib/jar/**`, `src/lib/time/**` | `slotColors` (then refactor `computeMarbles` onto it), `colorRuns`, `slotFraction` | precedence per slot, DST spring and fall days, runs merge across breaks, now fraction for today/past/future | 40 |
| 2 | `src/components/WeekTimeline.tsx`, `src/views/WeekView.tsx`, `src/views/calendar.css`, `src/views/MonthView.tsx` | component, legend via `SummaryChips` over 168 marbles, "Week stats" link, header removal | aria-label text for one column (component test if the setup exists, otherwise via a lib label helper) | 70 |
| 3 | review, fixer, smoke (390/360, light/dark, reduced motion) | | | 60 |

Total about **170**.

**B. Shelf journal**
| Wave | Owner paths | Work | ≈ credits |
|---|---|---|---|
| 1 | `src/lib/entries/**` | `firstNote` with tests (ordering, empty notes, reflection precedence if put in lib) | 25 |
| 2 | `src/components/{WeekDayRow,CategoryBar}.tsx`, `src/views/WeekView.tsx`, `src/views/MonthView.tsx`, `src/views/calendar.css` | rows, bar, states, header removal | 60 |
| 3 | review, fixer, smoke | | 55 |

Total about **140**.

**C. Balance**
| Wave | Owner paths | Work | ≈ credits |
|---|---|---|---|
| 1 | `src/lib/jar/**` | `balanceOf`, `weekScale` with tests | 20 |
| 2 | `src/components/WeekBalance.tsx`, `src/views/WeekView.tsx`, `src/views/MonthView.tsx`, `src/views/calendar.css` | bars, scale, states, header removal | 60 |
| 3 | review, fixer, smoke | | 55 |

Total about **135**.

The share image (`src/share/**`) is untouched in all three. A matching share image would be an extra wave (about 50 credits) owning `src/share/**`.

Doc updates at build time: SPEC F5 (the Week view description, tab-bar navigation); PLAN Stage 7 section.

## 5. Open questions for the user
1. **Direction:** A Timeline (recommended), B Shelf journal, or C Balance, after seeing the mockups.
2. **Timeline orientation (if A):** 00:00 at the top like a calendar (proposed), or at the bottom to match the jar?
3. **Nothing-logged days (A and C):** blank like the bare jar (proposed), or show the computed sleep and unlogged fill?
4. **Share image:** keep the 7-jar PNG as is (proposed), or redraw it to match the chosen direction (about 50 more credits)?
5. **Balance framing (if C):** is grouping Purposeful + Productive versus Unwanted + Wasted the verdict you want, and are those group labels OK?
