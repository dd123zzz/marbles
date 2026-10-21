# Stage 5 Design: pastel overhaul

Status: **draft, waiting for the user to pick a direction** from the mockups (section 5). The motion spec, token mapping, checklist, and build plan apply to whichever direction is picked.

Fixed constraints: pastel versions of the same hues; Wasted is the darkest of the three categories; no new font, confetti, illustrations, or textures; fun comes only from motion; drag-to-drop and Loose physics behavior are unchanged; color is always paired with text; every animation has a `prefers-reduced-motion` fallback.

## 1. Directions

**Colorblind strategy (all directions).** Hue alone isn't enough, so the marbles follow a fixed lightness ladder: Unlogged (lightest, matte, no gloss, which is already true today) > Wanted > Sleep ≈ Unwanted > **Wasted (darkest)**. Sleep and Unwanted have similar lightness but sit on the blue-versus-red axis, which survives deutan and protan vision. Wanted is a *blue-leaning* mint, so deutans don't see it as a match for coral. Hour numbers switch from "white with dark halo everywhere" to **dark ink with a light halo**, except on Wasted, which uses white ink with a dark halo.

Contrast figures are approximate (computed by hand from relative luminance). "Ink" means the hour-number color, which is 13px bold with a 2.4px halo. AA for non-large text is 4.5:1.

### A. Sorbet (recommended)
Mood: *warm cream, fruit-sorbet marbles, like a sunny kitchen jar.* It's the closest to the current warm direction, so it carries the least risk, and it has the best lightness separation of the three.

| Token | Light | Dark (dusk plum) |
|---|---|---|
| background | `#fff8f3` | `#1d1a2b` |
| surface | `#ffffff` | `#27233a` |
| surface-2 | `#fdf0e8` | `#312c47` |
| text | `#2e2a36` | `#f4eefb` |
| muted text | `#6b6378` | `#b9b0cc` |
| border | `#f0dfd3` | `#423c5c` |
| accent (fill) / accent ink | `#ffb870` / `#3b2414` | `#ffc28a` / `#2a1a0c` |
| accent text (links, active tab) | `#a4500f` | `#ffc28a` |
| accent soft (pills) | `#ffe7cf` | `#3e3049` |
| focus ring | `#4f5bd5` | `#a9b4ff` |
| danger / danger soft | `#c0392b` / `#fdeae7` | `#ffb4a8` / `#45232b` |
| Wanted (hi / base / lo) | `#e3fbef` / `#8fe6bb` / `#4fb98a` | `#e0f8ec` / `#86dfb2` / `#3f9f74` |
| Unwanted | `#ffe1db` / `#f08070` / `#c95647` | `#ffe4de` / `#f4978a` / `#c4605a` |
| Wasted | `#c9c6dd` / `#6e6a8e` / `#45415f` | `#c3bfdc` / `#716c99` / `#46415f` |
| Sleep | `#e6e9ff` / `#9aa6f4` / `#6470c9` | `#e8ebff` / `#a5aef7` / `#6871c4` |
| Unlogged (matte, flat) | `#ebe6e1` | `#4d4a55` |
| Future (empty) dashed stroke | `#c9b9ab` | `#6c6582` |
| ink / halo | `#1f1d2b` / `rgba(255,255,255,.6)` | same |
| Wasted ink / halo | `#ffffff` / `rgba(30,25,50,.55)` | same |
| Unlogged ink | `#5c5566` (no halo) | `#e6e0ee` (no halo) |

- **Contrast.** Light mode: text on surface ≈13.5, on surface-2 ≈12; muted on surface ≈5.6, on bg ≈5.4, on surface-2 ≈5.0; accent text on white ≈5.6; accent ink on accent ≈9. Dark mode: text on surface ≈13, muted on surface ≈7.3, on surface-2 ≈6.5. Hour ink in light mode: Wanted ≈9, Unwanted ≈6.8, Sleep ≈7, Wasted (white) ≈5.1, Unlogged ≈6. In dark mode: Wanted ≈9, Unwanted ≈7, Sleep ≈7.5, Wasted ≈4.9, Unlogged ≈6.6. Wasted against the dark surface is ≈3.1 (non-text, passes 3:1) and also gets a ring `rgba(244,238,251,.55)` 1.4px.
- **Marble finish.** The radial gradient keeps the current stops (hi 0, base .42, lo 1). Lo is a deeper *hue*, never black, so the marbles read as soft candy. Gloss is `rgba(255,255,255,.85)` in light mode and `.6` in dark. Marble stroke is `rgba(46,42,54,.12)` in light mode and `rgba(0,0,0,.25)` in dark.
- **Glass.** Light: top `rgba(255,255,255,.9)`, bottom `rgba(255,228,214,.45)` (peach tint), stroke `#e2c9b8`, shine `rgba(255,255,255,.95)`, rim `rgba(255,255,255,.98)`. Dark: top `rgba(255,255,255,.08)`, bottom `rgba(255,194,138,.10)`, stroke `#6c6582`, shine `rgba(255,255,255,.25)`, rim `rgba(255,255,255,.2)`.
- **Shape.** Radii are sm 12 / base 20 / lg 28. Shadows are warm-tinted: shadow-1 `0 1px 2px rgba(120,70,40,.06), 0 4px 14px rgba(120,70,40,.07)`, shadow-2 `0 10px 30px rgba(120,70,40,.16)`. In dark mode use black at .35/.55.
- **Tray, chips, and tab bar.** Tray marbles are 52px with a soft colored drop shadow (`0 6px 12px` in the lo color at 35%). Chips are surface-2 pills with a colored dot and bold text. The tab bar is a surface bar with radius-lg top corners. The active tab gets an accent-soft pill, accent-text label, and bold weight. The 3px indicator bar is replaced by the pill plus bold text, which is still not color-only.

### B. Cloud
Mood: *airy blue-white sky, cotton-candy marbles, frosted glass.* It's cooler and calmer, and it has the softest overall look.

| Token | Light | Dark (moonlit navy) |
|---|---|---|
| background / surface / surface-2 | `#f5f7ff` / `#ffffff` / `#eef1fb` | `#161a2b` / `#1f2438` / `#293049` |
| text / muted / border | `#252a3d` / `#5f6680` / `#dde2f2` | `#eef1ff` / `#aab1cc` / `#3a4260` |
| accent / ink / accent text | `#c4b5ff` / `#241a4d` / `#5b45c9` | `#c4b5ff` / `#1d1640` / `#c4b5ff` |
| accent soft / focus | `#ece7ff` / `#3b5bdb` | `#2e2a52` / `#9db4ff` |
| danger | `#c0392b` | `#ffb4a8` |
| Wanted hi/base/lo | `#e6fbf2` / `#9ee6c4` / `#5cbf97` | `#e2f8ee` / `#8fdcb9` / `#4aa37e` |
| Unwanted | `#ffe6e8` / `#ff9aa2` / `#d9646f` | `#ffe6e8` / `#f597a0` / `#c9616b` |
| Wasted | `#cfd2e0` / `#6c7290` / `#474c66` | `#c9cde0` / `#7277a0` / `#474c69` |
| Sleep | `#eef3ff` / `#a9c4ff` / `#6f8fd9` | `#e9f0ff` / `#9fb8f5` / `#6683c9` |
| Unlogged (matte) / empty stroke | `#e4e7ef` / `#b9c0d6` | `#474c5e` / `#5d6584` |

- **Contrast.** Light: text ≈14, muted ≈5.9 on white and ≈5.3 on surface-2, accent text ≈6.3. Dark: text ≈14, muted ≈7.6. Ink: Wanted ≈9.5, Unwanted ≈7.3, Sleep ≈8.5, Wasted (white) ≈4.6, Unlogged ≈6. Wanted and Unwanted are closer in lightness here (≈1.4:1, versus ≈1.8:1 for Sorbet), so it's weaker for CVD.
- **Glass.** Frosted: top `rgba(255,255,255,.92)`, bottom `rgba(200,215,255,.5)`, stroke `#c3cdea` at 3px, plus a second inner stroke at 40% for thickness. Dark: bottom `rgba(157,180,255,.12)`.
- **Shape.** Radii are sm 14 / base 22 / lg 32. Shadows are wide and blue-tinted (`rgba(60,80,160,.10)`).
- **Tray, chips, and tab bar.** The tab bar floats: an inset pill 12px from the edges with shadow-2. Chips are white with a 1px border.

### C. Gelato
Mood: *vanilla cream with "sticker" marbles.* It has more chroma and a thin ink outline, so it's the most playful and graphic of the three.

| Token | Light | Dark (berry dusk) |
|---|---|---|
| background / surface / surface-2 | `#fffaf0` / `#ffffff` / `#fff1dc` | `#221c27` / `#2c2533` / `#372f40` |
| text / muted / border | `#33261f` / `#6e5c50` / `#f2dcc0` | `#fbf3ea` / `#c4b6aa` / `#4a4055` |
| accent / ink / accent text | `#ffd36e` / `#3a2a05` / `#8a5a00` | `#ffd36e` / `#2e2205` / `#ffd36e` |
| accent soft / focus | `#fff0c9` / `#4f5bd5` | `#463a2a` / `#a9b4ff` |
| Wanted hi/base/lo | `#d9f7e7` / `#6fd6a0` / `#36a873` | `#d6f5e4` / `#74d9a5` / `#3aa673` |
| Unwanted | `#ffdcd6` / `#ff8577` / `#d9574a` | `#ffdcd6` / `#ff8f82` / `#cf5d52` |
| Wasted | `#bdb8d4` / `#5f5a7d` / `#3a3654` | `#bdb8d4` / `#6a6590` / `#3e3a58` |
| Sleep | `#e0e4ff` / `#8f9bf0` / `#5a66c4` | `#e0e4ff` / `#9aa5f3` / `#5e69c0` |
| Unlogged (matte) / empty stroke | `#e8e1d8` / `#cdb99f` | `#4f4752` / `#6a5f6e` |

- **Contrast.** Light: text ≈15, muted ≈6.4, accent text ≈5.9. Dark: text ≈15, muted ≈8. Ink: Wanted ≈8, Unwanted ≈6.5, Sleep ≈6.8, Wasted (white) ≈6.5, Unlogged ≈6.
- **Marble finish.** Every marble gets a 1.5px outline in text color at 35% (55% in dark mode), and the gloss is a crisp small ellipse.
- **Glass.** Clearer and more cartoon-like: stroke is text color at 30% (2.5px), the fill is nearly clear, and there's one bold shine streak.
- **Shape.** Radii are sm 10 / base 18 / lg 26. Shadows are short "sticker" offsets: `0 2px 0 rgba(51,38,31,.10)`.
- **Tray, chips, and tab bar.** Chips are outlined pills in the category color. The tab bar is solid surface with a 2px top border.

## 2. Motion spec (all directions, transform and opacity only)

Add these tokens to `tokens.css`: `--ease-out: cubic-bezier(.2,.8,.3,1)`, `--ease-bounce: cubic-bezier(.34,1.56,.64,1)`, and `--ease-spring`, which defaults to `--ease-bounce`. Inside `@supports (transition-timing-function: linear(0, 1))`, set `--ease-spring` to:
`linear(0, .009, .035 2.1%, .141 4.4%, .723 12.9%, .938 16.7%, 1.017 19.4%, 1.067, 1.099 24.3%, 1.108 26%, 1.097, 1.064 31.9%, 1.009 37.1%, .98 41.9%, .977 44.2%, .982 48.1%, 1.004 58.4%, 1)`.
Durations: `--dur-fast: 120ms`, `--dur: 220ms`, `--dur-slow: 420ms`.

The global reduced-motion rule in `base.css` stays as the safety net. Each item below also sets an explicit fallback.

| # | Animation | Trigger | Property and keyframes | Duration and easing | Reduced motion |
|---|---|---|---|---|---|
| 1 | Tray idle wobble | Today only; tray not disabled or lifted | `rotate(-5deg)` → `5deg` → `0` plus `translateY(-2px)`. Runs inside an 8s loop (moves only in the first 18%) and is staggered by 300ms per marble | 8s infinite, ease-in-out | `animation: none` |
| 2 | Tray press squish | `.tray-marble:active .tray-disc` | `scale(.9, .94)` | `--dur-fast` `--ease-out` | none |
| 3 | Pickup pop | `.tray-overlay .tray-disc` on mount | scale 1 → 1.14 → 1.06 (the overlay's JS transform is untouched; only the child disc animates) | 260ms `--ease-spring` | none |
| 4 | Squishy drop landing | Existing `.marble-drop` | Same fall; at impact (55%) `scale(1.14, .84)` with origin at center bottom, then the rebound `scale(.96, 1.04)` at 72%, then 1 | 700ms, same piecewise curves | existing 200ms fade |
| 5 | Category change pop | Existing `.marble-pop` | scale 1 → 1.18 → .96 → 1 | 380ms `--ease-spring` | existing fade |
| 6 | Jar armed swell | `.jar-slot.jar-armed` | `scale(1.02)` (filter glow kept) | `--dur` `--ease-bounce` | no scale |
| 7 | Chip pop | Value change (needs the `key` change in section 4) and `:active` | scale .85 → 1.08 → 1; press `scale(.94)` | 300ms `--ease-spring` | none |
| 8 | Button press | `.btn:active`, `.category:active`, `.icon-btn:active` | `scale(.96)` | `--dur-fast` `--ease-out`, release `--ease-bounce` | none |
| 9 | Sheet spring | `.sheet` mount | `translateY(100%)` → 0 with spring overshoot; backdrop fades in | `--dur-slow` `--ease-spring`; backdrop 200ms | 150ms opacity fade |
| 10 | Category selected | `.category.selected` | scale 1 → 1.06 → 1; the check mark scales from 0 | 280ms `--ease-spring` | none |
| 11 | Toast in | `.toast` mount | `translateY(16px) scale(.96)` → 0 / 1 and opacity | 360ms `--ease-spring` | 150ms opacity |
| 12 | Tab bounce | `a[aria-current='page'] .tab-icon` starts matching (CSS restarts it on each route) | pill `scale(.7)` → 1.1 → 1; icon `translateY(-3px)` → 0 | 320ms `--ease-spring` | none |
| 13 | Segmented thumb | `.segmented input:checked + span` | scale .92 → 1 | `--dur` `--ease-bounce` | none |
| 14 | Stats bar grow | `.stats-bar` mount | `scaleX(0)` → 1, origin left, staggered by 40ms | 500ms `--ease-spring` | none |

The Loose jar (`PhysicsJar`) and the drag overlay's positioning logic stay as they are. Only the colors coming from tokens change there.

## 3. Token mapping (`src/styles/tokens.css`)

`JarDefs` builds `var(--marble-${c})`, `-hi`, and `-lo` from `GRADIENT_COLORS`, so **marble token names must not change**.

| Current | New | Note |
|---|---|---|
| `--bg --surface --surface-2 --border --text --text-muted` | same | new values |
| `--accent --accent-hover --accent-soft --accent-soft-text` | same | accent becomes a pastel fill |
| `--accent-contrast` | same name, dark ink value | text on the pastel accent |
| — | **add** `--accent-text` | links and active tab label; `base.css` `a` switches to it |
| `--focus --danger --danger-soft --backdrop --toast-*` | same | new values; toast stays high-contrast (text-colored bg) |
| `--shadow-1 --shadow-2` | same | tinted; **add** `--shadow-lift` for the tray overlay (replaces the hardcoded value in `tray.css`) |
| `--cat-g --cat-b --cat-r --cat-b-ring` | same | pastel fills, alias `var(--marble-*)` |
| — | **add** `--cat-ink`, `--cat-b-ink` | replaces `color: #ffffff` in `sheet.css` `.category` |
| `--marble-{g,b,r,sleep,unlogged}{,-hi,-lo}` | same | new values (unlogged hi and lo equal the base, so it reads flat) |
| `--marble-na --marble-na-text --marble-empty --marble-gloss --marble-b-ring --marble-b-glow` | same | new values |
| — | **add** `--marble-stroke` | replaces `rgba(0,0,0,.14)` in `jar.css` |
| — | **add** `--marble-ink --marble-ink-halo --marble-b-ink --marble-b-ink-halo --marble-unlogged-ink` | hour numbers |
| `--glass-top --glass-bottom --glass-stroke --glass-shine --glass-rim` | same | new values |
| `--today-bg --weekend-bg` | same | Sorbet `#fff0e0`/`#fdf4ee`, dark `#3e3049`/`#2b2740` |
| `--radius-sm --radius --radius-lg` | same | values per direction |
| — | **add** `--radius-pill: 999px`, `--ease-*`, `--dur-*` | motion tokens (section 2) |
| `--tap --tabbar-h --font` | unchanged | no new font |

Nothing is removed.

## 4. Per-screen checklist (beyond tokens)

| Area | Change | Files |
|---|---|---|
| Global | `a` uses `--accent-text`; button and icon-button press (#8); chip pop (#7); segmented thumb (#13); `.dot-b` ring stays | `base.css` |
| Jar (day, mini, Loose) | `.marble` stroke token; hour ink per color (`.marble-hour-on-b`, `.marble-hour-unlogged`); drop squish (#4) and pop (#5) | `jar.css`, `physicsJar.css` |
| Hour ink markup | For split marbles, `hourText` currently passes `'g'`. It should pass a class for the darkest half (b, then unlogged, then other) so the ink reads | `MarbleShape.tsx` (small TS change, plus a test in `Jar.test.tsx`) |
| Tray | Idle wobble (#1), squish (#2), pickup pop (#3), colored shadow, `--shadow-lift` | `tray.css` **CSS only** |
| Day screen | Jar-card gradient, armed swell (#6), Log button pastel pill, **Entries one-line rows** (dot, time range, category word, note truncated with an ellipsis, chevron) | `day.css` |
| Summary chips | `key={value}` on each chip to retrigger the pop | `SummaryChips.tsx` |
| Sheets (log, sleep, reset) | Spring (#9); category buttons use pastel fill with `--cat-ink` (Wasted uses `--cat-b-ink`); selected pop (#10) | `sheet.css`, `sleepSheet.css`, `resetDataSheet.css` |
| Toasts | Spring-in (#11); Undo action uses an accent pill | `toast.css` |
| Tab bar and icons | Pill indicator plus bounce (#12); drop the 3px bar; icons get round caps and joins, same glyphs | `layout.css`, `icons.tsx` |
| Week and month | Rounder cells; today badge uses accent soft with accent text | `calendar.css` |
| Stats | Bars use `--marble-*` everywhere (today `.stats-bar-b` uses `--cat-b`); grow animation (#14) | `stats.css` |
| Settings, Export, Sign-in, Reflection | Tokens only, plus segmented and button polish from `base.css` | `forms.css`, `reflection.css` |

**Overlap with the engineering track.** The engineering track (drop window plus one-line Entries list) owns markup in `DayView.tsx`, `MarbleTray.tsx`, and the Entries list. The design build edits **no** markup in those files, only CSS, so it must target their final class names:
- `.tray-*` stays as is.
- Entries rows should use `.entry`, `.entry-time`, `.entry-cat`, `.entry-note`, and `.entry-chevron`. The PM should confirm these names with the engineering track.
- **Merge engineering Stage 5 first**, then the design waves, so `day.css` isn't edited by two agents at once.

## 5. Mockup worker brief (hand to Sonnet 5.5 verbatim)

> You are building static design mockups for Marbles, a mobile-first app where each hour of a day is a marble in a glass jar. Repo: `/Users/danieldai/repos/marbles`. Read `docs/stage5/DESIGN.md` sections 1 and 2 for the exact hex values of each direction (Sorbet, Cloud, Gelato). Do **not** edit anything outside `design/mockups/**`, and do not commit.
>
> **Build** `design/mockups/sorbet.html`, `cloud.html`, and `gelato.html`. Each is one self-contained file with inline CSS and an inline SVG. There's no build step, no JS framework, no external fonts, images, or CDNs; use `system-ui`. Each file shows **two 390×844 phone frames side by side**, light and dark, by putting the palette in CSS variables on `.theme-light` / `.theme-dark` wrappers. A small JS toggle is optional.
>
> **Day screen content, top to bottom:**
> 1. Header card: `‹` button, the title "Tuesday, Oct 20" with the muted line "Today" under it, a `›` button (disabled look), and a calendar icon button.
> 2. Tray: three 52px glossy marbles (Wanted, Wasted, Unwanted) with captions under each, and the hint line "Drag a marble into the jar to log 13:00–14:00".
> 3. Jar card holding the SVG jar (spec below).
> 4. Summary chips (dot plus text): `Wanted 3.5h`, `Wasted 1.5h`, `Unwanted 1.5h`, `Sleep 7h`, `Unlogged 0.5h`.
> 5. Full-width "Log time" primary pill button (56px tall).
> 6. Entries card with one line per entry (dot, time, category word, truncated note, chevron):
>    - `07:30–10:00 · Wanted · Deep work on the report draft`
>    - `10:00–11:00 · Wanted · Gym` (back-to-back with the previous line, but still a **separate** line)
>    - `11:00–12:30 · Wasted · Scrolling`
>    - `12:30–14:00 · Unwanted · Taxes`
> 7. Fixed bottom tab bar with Day (active), Week, Month, Stats, and Settings. Draw simple inline stroke icons, and style the active tab as described in DESIGN.md.
>
> **Jar SVG.** `viewBox="0 0 188 314"`, width about 300px.
> - Glass body path: `M 13 17 V 28 C 13 46, 3 40, 3 62 V 287 a 24 24 0 0 0 24 24 H 161 a 24 24 0 0 0 24 -24 V 62 C 185 40, 175 46, 175 28 V 17 Z`.
> - Fill it with a vertical linear gradient from glass-top to glass-bottom. Then draw the marbles. Then draw the same path (without `Z`) as a stroke with no fill (glass-stroke, 2.5px), shine lines `M 13 66 V 262` (5px, round cap), `M 176 72 V 132` and `M 18 23 V 30` (3px, 60% opacity), and a rim `rect x=7 y=3 width=174 height=14 rx=7` filled with glass-rim and stroked with glass-stroke.
> - Marble for hour h: `col = h % 4`, `row = floor(h / 4)`, `cx = 34 + 40*col`, `cy = 280 - 40*row`, `r = 16`. Hour 0 is bottom-left; hour 23 is top-right.
> - Each glossy marble uses a `radialGradient` (`gradientUnits="userSpaceOnUse"`, drawn around a marble at the origin, placed with `translate(cx cy)`): `cx=-5.6 cy=-6.4 fx=-6.4 fy=-7.2 r=24`, stops at 0 = hi, .42 = base, 1 = lo.
> - Gloss: an ellipse at `cx=-6.4 cy=-7.2 rx=4.5 ry=2.7`, `rotate(-35 -6.4 -7.2)`.
> - Unlogged is a flat fill with no gloss.
> - Future marbles are an empty circle with a dashed stroke (1.5px, dasharray 3 3).
> - A half marble is split vertically with a 3px gap. The left (:00–:30) half is `M -1.5 -16 A 16 16 0 0 0 -1.5 16 Z`, and the right half is `M 1.5 -16 A 16 16 0 0 1 1.5 16 Z`.
> - Hour numbers are centered 13px bold tabular text, using the ink and halo colors from DESIGN.md via `paint-order: stroke` and a 2.4px stroke. Wasted marbles use the white ink. For a split marble, use the ink of the darker half.
> - The Wasted marble gets the ring described in DESIGN.md in dark mode.
>
> **Jar contents:**
> - Hours 0–6: Sleep.
> - Hour 7: split, left Unlogged and right Wanted.
> - Hours 8, 9, and 10: Wanted.
> - Hour 11: Wasted.
> - Hour 12: split, left Wasted and right Unwanted.
> - Hour 13: Unwanted.
> - Hours 14–23: future (empty).
> - Show an hour number on every marble.
>
> **Motion demo.** Below the phones, add a "Motion" strip with CSS-only loops (each replaying every ~2s) of: the tray marble wobble, the squishy drop landing, and the tab bounce. Use the curves in DESIGN.md section 2. Wrap them in `@media (prefers-reduced-motion: no-preference)`.
>
> **Screenshots.** Use headless Chrome or Playwright if it's available locally (`npx playwright` is fine, since npm is allowed), or else the Cursor browser tools via `file://`. Capture each phone frame at 390×844 to `design/mockups/screens/{sorbet,cloud,gelato}-{light,dark}.png`. Open each PNG and check that all marbles, hour numbers, and text are legible.
>
> **Verify** there are no external URLs (`rg -n "https?://" design/mockups` should only match the SVG `xmlns`). Report concisely: the file paths, the screenshot paths, and any palette value you had to adjust for legibility, with the reason.

## 6. Build breakdown (after the user picks a direction)

**Prerequisite:** engineering Stage 5 is merged, the user has picked a direction, and SPEC/AGENTS are updated for the new sleep color (orchestrator doc edit).

| Wave | Agent | Owns | Work | Est. credits |
|---|---|---|---|---|
| A | Haiku 5.5 | `src/styles/tokens.css`, `src/styles/base.css` (only the `a` rule) | Swap in the chosen palette (light and dark) plus motion tokens per section 3 | ~10 |
| B1 (parallel) | Sonnet 5.5 | `jar.css`, `physicsJar.css`, `tray.css`, `day.css`, `MarbleShape.tsx`, `Jar.test.tsx` | Hour ink, marble stroke, motions #1–#6, Entries row styling | ~110 |
| B2 (parallel) | Sonnet 5.5 | `base.css`, `sheet.css`, `toast.css`, `layout.css`, `sleepSheet.css`, `resetDataSheet.css`, `SummaryChips.tsx` | Motions #7–#13, category buttons, tab bar | ~90 |
| B3 (parallel) | Haiku 5.5 | `calendar.css`, `stats.css`, `forms.css`, `reflection.css`, `icons.tsx` | Token cleanup, stats bar tokens and #14, round icon caps | ~25 |
| C | Sonnet 5.5 code review, then a Sonnet fixer | read-only, then the flagged files | Review: contrast, reduced motion, transform/opacity only, no markup drift | ~60 + ~45 |
| D | Sonnet 5.5 browser-use | none | Demo mode at 390px, light and dark: drag-drop, Loose jar, log/sleep/reset sheets, toasts, all tabs, reduced-motion emulation | ~70 |

- **Verification after every wave (orchestrator):** `npm test`, `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run build`, `VITE_DEMO=false npm run build`, and `git status`.
- **Commits:** `style(stage5): <wave>` with the Copilot trailer.
- **Total:** about 410 credits for the build, plus about 120 for the mockup worker. That's roughly 530 credits (about $5.30). Estimates assume Sonnet at about 200k in / 20k out per worker and Haiku at about 100k / 10k.

## 7. Open questions for the user

**Answered (user, 2026-10-20):**
- **Direction: Sorbet.**
- Sleep moves to Sorbet periwinkle `#9aa6f4`; update SPEC section 2 and the AGENTS conventions at build time.
- Tray wobble every 8s, today only, stopping while dragging.
- All three mockups were built.
- **Split-marble hour numbers** use dark ink with a light halo on every split marble, regardless of the halves. This replaces the "ink of the darker half" rule in sections 1 and 5.


1. **Sleep color.** Move Sleep from `#4f46e5` to pastel periwinkle (`#9aa6f4` in Sorbet)? *Default: yes.* SPEC section 2 and the AGENTS conventions would be updated to match.
2. **Idle tray wobble frequency.** *Default: a short wobble every 8s, today only, stopping while dragging.* The alternative is wobbling only once on load and after a successful drop.
3. **Mockup direction count.** Build all three (Sorbet, Cloud, Gelato), or only Sorbet and Cloud to save about 40 credits? *Default: all three.*
