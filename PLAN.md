# Marbles — Development Plan

Staged delivery. **Stage 1 (MVP) is function over form**: the goal is a working core loop with plain styling. Later stages add polish and features. Each stage ends deployed to GitHub Pages and usable.

See [SPEC.md](./SPEC.md) for feature definitions.

---

## Architecture Summary

```
GitHub Pages (static)            Firebase (Spark / free)
┌───────────────────────┐        ┌───────────────────────────┐
│ React + Vite + TS SPA │──SDK──▶│ Auth (Google, email/pw)   │
│ HashRouter            │        │ Firestore (+ local cache) │
│ base: '/marbles/'     │        │ Security Rules            │
└───────────────────────┘        └───────────────────────────┘
        ▲
GitHub Actions: build → deploy-pages; rules tests (emulator); rules deploy
```

### Data model
```
users/{uid}                      # settings document
  sleepStart: "23:00"            # local HH:mm
  sleepEnd:   "07:00"
  weekStart:  "mon" | "sun"
  theme:      "system" | "light" | "dark"   # Stage 2
  v: 1                           # schema version

users/{uid}/days/{YYYY-MM-DD}    # local calendar date; one document per day
  slots: string(48)              # [gbr.] one char per 30 minutes; '.' = not logged
  notes: { [startSlot]: string } # note for the entry starting at that slot
  sleep: { start, end }          # copy of sleep window when the day was first written
  tz: "America/Los_Angeles"      # time zone, for reference only
  reflection?: string            # Stage 2
  updatedAt: timestamp
  v: 1
```

- **Entry**: a run of consecutive same-category slots. Editing or deleting an entry rewrites those characters in `slots` and its key in `notes`.
- **Gray and sleep fill** are computed when the jar is drawn, never stored. The order of precedence is: logged slot, then sleep window (using this day's saved copy, or the current setting if the day has no document), then gray if the slot is in the past, then empty.
- **Month view**: a single query for document IDs within the month's date range, costing 31 reads or fewer.
- **Midnight crossing**: one batched write that updates both day documents.
- **Daylight saving time**: the jar always shows 24 hours. On the spring-forward day, the missing hour is drawn as "n/a". On the fall-back day, the repeated hour is ignored. This is a documented limitation.

### Security rules (sketch)
```
match /users/{uid} {
  allow read, write: if request.auth.uid == uid;   # validate settings fields
  match /days/{d} {
    allow read, delete: if request.auth.uid == uid;
    allow create, update: if request.auth.uid == uid
      && d.matches('^\\d{4}-\\d{2}-\\d{2}$')
      && request.resource.data.keys().hasOnly(['slots','notes','sleep','tz','reflection','updatedAt','v'])
      && request.resource.data.slots.matches('^[gbr.]{48}$')
      && request.resource.data.notes.size() <= 48;
  }
}
```

### Code organization
```
src/
  lib/time/        # pure functions: slot math, entry↔slots, midnight split, DST, previous-hour default (unit-tested)
  lib/jar/         # pure functions: slots + sleep + now → marble list (full or half, color)
  data/            # Firestore repo: getDay, getRange, saveEntry, deleteEntry, settings
  auth/            # AuthProvider, sign-in screens
  views/           # DayView, WeekView, MonthView, Settings, LogSheet
  components/      # Jar (SVG), MiniJar, Marble
```
Keep `lib/time` and `lib/jar` free of the framework and fully unit-tested, because they carry the highest bug risk.

---

## Stage 0: Project Setup (about 0.5 day)

| # | Task |
|---|---|
| 0.1 | Create the GitHub repo `marbles` and scaffold Vite + React + TS. Add ESLint, Prettier, and Vitest. |
| 0.2 | Create the Firebase project. Enable Auth (Google and email/password) and Firestore in production mode. |
| 0.3 | Add `<user>.github.io` to Auth's authorized domains. Restrict the API key by HTTP referrer. |
| 0.4 | Set up Firebase config as `VITE_FIREBASE_*` GitHub repository variables, plus a local `.env.local` that is gitignored. |
| 0.5 | GitHub Actions: lint, test, build, then deploy with `upload-pages-artifact` and `deploy-pages`. Set Vite `base: '/marbles/'`. |
| 0.6 | Firestore rules file plus emulator tests (`@firebase/rules-unit-testing`) in CI. Deploy the rules using a service-account secret. |

**Exit:** A "hello world" page deploys to Pages on every push, and the rules tests run in CI.

---

## Stage 1: MVP, the core loop (about 4–6 days)

Plain styling only: system fonts, basic layout, and SVG circles for marbles.

| # | Feature | Tasks | Acceptance |
|---|---|---|---|
| 1.1 | Auth (F1) | AuthProvider; popup Google sign-in; email/password sign-up, sign-in, and password reset; sign-out; route guard | A returning user goes straight to the Day view. Works on iOS Safari and Android Chrome. |
| 1.2 | Time library | `lib/time`: date key ↔ slots, previous-hour default, entry → slot ranges, midnight split, DST helpers | Unit tests cover midnight crossing, DST days, and 30-minute boundaries. |
| 1.3 | Jar library | `lib/jar`: compute 24 marbles from slots, sleep window, and current time (full or half, with precedence rules) | Unit tests cover mixed halves, sleep overrides, and future slots staying empty. |
| 1.4 | Data layer | Firestore with `persistentLocalCache` (multi-tab); `getDay`, `getRange`, `saveEntry` (batched writes), `deleteEntry`, settings read and write | Logging works offline and syncs when back online. A month load is 31 reads or fewer. |
| 1.5 | Log entry (F2) | Log sheet with 3 category buttons, start (default previous hour), duration (default 1h, 30-minute step), and note. Confirm before overwriting another entry. | Logging the last hour as Green takes 2 taps or fewer. Logging across midnight writes both days. |
| 1.6 | Day jar (F4) | SVG jar with 24 positions, bottom to top, plus the category summary line | The jar matches the data, including half marbles. Gray and sleep fill are correct. |
| 1.7 | Edit/delete/backfill (F3) | Tap a marble to open its entry for edit or delete; previous/next day buttons and a date picker; block future times | You can edit or delete any past entry and log on past dates. |
| 1.8 | Calendar (F5) | Week view (7 mini jars) and month grid; tap a jar to open that day; respect the week-start setting | Week and month views render correctly and navigate to the right day. |
| 1.9 | Settings (F6) | Sleep window, week start, sign out | Changing the sleep window affects new or unsaved days only. |
| 1.10 | Hardening | Security rules for settings; emulator tests (cross-user denied, bad slots denied); smoke test on real iPhone and Android | All rules tests pass, and the core loop works end to end on both phones. |

**MVP exit criteria:** A user can sign in, log blocks, see today's jar fill up (including gray and sleep), edit and backfill entries, and browse week and month jars, on a phone, for $0.

---

## Stage 2: Polish & Insights (about 3–4 days)

**Stage 1 status:** shipped 2026-10-18 to https://dd123zzz.github.io/marbles/ (Firebase project `marbles-life`). Real-device checks passed on iPhone and Android.

### Stage 1 carryover (do first)

| # | Item | Owner | Notes |
|---|---|---|---|
| 2.0a | Fix README categories | Agent | The intro says "Wanted, Neutral or Regret". It should say Wanted, Wasted, Unwanted. |
| 2.0b | Close resolved open questions in SPEC | Agent | Sleep is indigo `#4f46e5` and excluded from awake %. The repo is public `dd123zzz/marbles` at `/marbles/`. The custom-domain question stays open. |
| 2.0c | Edit midnight-crossing entries as one | Agent | Today an entry crossing midnight is edited as two per-day pieces. Detect a run that touches slot 47 on day D and slot 0 on D+1 with the same category, and edit and delete it as one entry. Needs `lib/entries` tests. |
| 2.0d | Keyboard access to both marble halves | Agent | A half marble exposes one focus target (the left half). Make each half its own focusable target with its own label. |
| 2.0e | Replace `window.alert` with an in-app toast | Agent | Covers write errors. Fold into 2.1's bottom-sheet work. |
| 2.0f | Check Firestore usage | User | After about a day of real use, Firebase console → Firestore → Usage should show tens of reads per day, not hundreds. |
| 2.0g | Verify API key restriction | User | Websites restriction includes `https://dd123zzz.github.io/*`, `https://marbles-life.firebaseapp.com/*`, and `http://localhost:*`. |
| 2.0h | Delete the local service-account key | User | Delete the downloaded JSON key file. It now lives only in the `FIREBASE_SERVICE_ACCOUNT` secret. |

### Features

| # | Feature | Notes |
|---|---|---|
| 2.1 | Visual design pass | Jar artwork, marble gradients, mobile layout, a bottom-sheet log form, empty states |
| 2.2 | Dark mode (P2) | CSS variables and `prefers-color-scheme`, plus a manual toggle stored in settings. Outline black marbles so they show on dark backgrounds. |
| 2.3 | Stats (P1) | Computed in the browser from documents already loaded. Day, week, and month hours and percentages, with an awake-time vs 24-hour toggle. |
| 2.4 | Reflection note (P3) | `reflection` field on the day document, up to 1,000 characters, with the limit enforced in rules |
| 2.5 | Export (P4) | CSV (with a byte-order mark and ISO times including time zone) and JSON. Choose a date range; downloaded from the browser. |
| 2.6 | PWA (P8) | `vite-plugin-pwa` with scope and start URL set to `/marbles/`, icons (192, 512, maskable, apple-touch), and a prompt-to-update flow |

**Exit:** The app looks good, installs to the home screen, and shows stats. Export works.

**Stage 2 status (2026-10-18):** all agent items (2.0a–2.0e, 2.1–2.6) are done and verified locally. Remaining: deploy, real-device checks, and user items 2.0f–2.0h.

---

## Stage 3: Delight & Engagement (about 3–4 days)

| # | Feature | Notes |
|---|---|---|
| 3.1 | Marble drop animation (P5) | Animate each new marble into its fixed position with a bounce. Respect `prefers-reduced-motion`. Mini jars stay static. |
| 3.2 | Share jar image (P6) | Draw the jar to a canvas (directly, not via an SVG-to-image step), build the PNG blob before the tap, then use `navigator.share({files})` or fall back to a download. Day and week variants. |
| 3.3 | Reminders, Tier 1 (P7) | While the app is open: a banner like "N unlogged hours" plus an optional hourly `Notification`. Best effort, since phones pause background tabs. |
| 3.4 | Reminders, Tier 2 (P7) | Download an `.ics` file with an hourly repeating event (inside waking hours) that links to the app. Works on iOS without installing. |
| 3.5 | Hour numbers on marbles | Each Day-jar marble shows its hour in 24-hour format (0–23), legible on every color in both themes. Mini jars stay unnumbered. |
| 3.6 | Per-day sleep edit | Tap the Sleep chip on the Day view to open a sheet that edits that day's `sleep` snapshot, with an "Also make this my default" checkbox. No schema change: the rules already validate `sleep`. |

---

## Stage 4: Hands-on Jar + Hardening (about 4–5 days)

**Prereq:** Stage 3 deployed 2026-10-18. **Out of scope (user, 2026-10-18):** true push reminders (P7 Tier 3); reminders stay in-app + `.ics`.

| # | Feature | Notes |
|---|---|---|
| 4.1 | Drag-to-drop marbles | Three category marbles (Wanted, Wasted, Unwanted) sit above the jar. Drag one into the jar to log the last hour (to the nearest 30 min). No sheet opens; an Undo toast replaces the confirm. Summary chips move under the jar. |
| 4.2 | Physics mode (P5 stretch) | Optional "Loose" jar style on the Day view: the marbles roll and settle like real marbles instead of sitting on the grid. Grid stays the default. Uses a small custom circle solver, lazy-loaded. |
| 4.3 | Quota hardening | **Now:** App Check (reCAPTCHA), monitored first and then enforced. **Deferred to backlog:** monthly summary docs. |
| 4.4 | Backlog | Streaks, daily goal, tag presets, year heatmap, custom domain (allows redirect sign-in), monthly summary docs. Drop-on-a-specific-hour for backfill (see 4.1). |

**User decisions (2026-10-18).** Wherever a section below says "(default)", the user's answer is the one listed here:
1. A drop **overwrites** W, with Undo. A repeat drop with a different category changes the same W.
2. **Immediate lift**; release **anywhere** once the marble is clear of home.
3. A **tap shows the hint**; Enter or Space logs.
4. The tray shows on **today only**.
5. The Loose jar holds **all past hours** (every hour that has started), **including gray unlogged ones**. Future hours are absent. *This overrides the recommendation in 4.2.*
6. Jar style is saved **per device** (localStorage), with toggles in Settings and on the jar card.
7. **Tilt only**: no shake. Off until the user taps "Enable tilt". *Overrides 4.2c.*
8. Do **App Check now** (monitor, then enforce). Monthly summary docs go to the backlog.

### 4.1 Drag-to-drop marbles

**Layout (Day view, jar card), top to bottom:**
1. **Tray:** three marbles, 52px each (above the 44px minimum touch target), each labelled Wanted, Wasted, or Unwanted.
2. **Hint line**, live: "Drag into the jar to log 13:30–14:30".
3. **Jar.**
4. **Summary chips** (moved from above the jar; the Sleep chip stays a button).
5. **Log time button** (unchanged), then the Entries list.

The tray shows **only on today's jar (default; open question 4)**. Past and future days show no tray, and the chips still sit under the jar.

**"Last hour" window.** This is the pure function `lastHourWindow(now): SlotRef[]` in `lib/time`.
- **end** is now rounded to the nearest :00 or :30. Seconds are ignored and :15/:45 round up (`floor((min + 15) / 30)`).
- The window **W** is the 2 slots ending at end, in wall-clock slots. It may span yesterday.
- Spring-forward slots (n/a) are skipped, and the function keeps walking back until it has 2 existing slots.
- Fall-back days use wall-clock time (the existing documented limitation).
- Rounding up can include the slot in progress. That is fine, because a slot is loggable once it has started, so `validateEntry` always passes.

| now (America/Los_Angeles) | end | W written | Docs |
|---|---|---|---|
| 14:00, 14:14 | 14:00 | 13:00–14:00 | today |
| 14:15, 14:44 | 14:30 | 13:30–14:30 (14:00–14:30 still in progress) | today |
| 14:45 | 15:00 | 14:00–15:00 | today |
| 23:50 | 24:00 | 23:00–24:00 | today |
| 00:00, 00:14 | 00:00 | yesterday 23:00–24:00 | yesterday only (no target in today's jar) |
| 00:20 | 00:30 | yesterday 23:30 → today 00:30 | 2 docs, one `writeDays` batch |
| 00:50 | 01:00 | 00:00–01:00 | today |
| 2027-01-01 00:20 | 00:30 | 2026-12-31 23:30 → 00:30 | 2 docs (year boundary) |
| 2026-03-08 03:10 (spring forward) | 03:00 | 01:00–02:00 (02:00–03:00 doesn't exist) | today |

**Write rule (default: overwrite + Undo).**
- Every slot in W gets the category. This is the SPEC F2 "last write wins" rule, without the confirm.
  - Logged slots are overwritten. Notes inside W are dropped, as `applyEntry` already does.
  - Sleep and unlogged slots are filled silently.
- **Repeated drops** target the same W. A different category changes it (pop animation). The same category writes nothing and shows the toast "13:30–14:30 is already Wanted".
- **Alternatives** (open question 1):
  - Fill only the unlogged slots in W.
  - Walk back to the most recent unlogged hour, so repeated drops backfill a catch-up.
- **Pure helpers in `lib/entries`:**
  - `planDrop({days, targets, category, sleep, tz, now}) → {changed, undo}` reuses `applyEntry` per contiguous run.
  - `undo` records each target slot's previous character and the notes removed from W.
  - `undoDrop(days, undo) → changed` restores only the slots that still hold the dropped category, so it is safe after later edits. It also restores the notes. A day doc created by the drop stays, as an empty doc (harmless).

**Undo toast.**
- `Toast.tsx` gains `show(message, { kind, action?: { label, onAction }, durationMs?, key? })`. The change is backward compatible.
- Action toasts last 8s. Toasts with the same `key` replace each other, so there is one drop toast at a time.
- Example: "Logged 13:30–14:30 as Wanted · **Undo**". A midnight-only window reads "…yesterday 23:00–24:00…".

**Gating and offline.**
- DayView already subscribes to date−1..date+1, so W is always covered.
- Drops use `useWriteGate(...).writable`. While syncing, the tray is `aria-disabled` and dimmed, the hint reads "Syncing…", and a release springs the marble back with no write.
- Writes are optimistic and not awaited, so they work offline via the persistent cache. A write error shows `toast.error(writeErrorMessage)`.
- `now` is taken at release (`new Date()`), not from `useNow`.

**Gesture (default; open question 2).**
- **Pointer Events with an immediate lift**, no hold delay. A press-and-hold delay would need `touch-action: none` anyway on iOS, because scrolling can't be cancelled once it has started. So "hold" means keeping the finger down while dragging.
  - `pointerdown`: primary pointer only. Call `setPointerCapture`, then ignore extra pointers.
  - `pointermove`: rAF-throttled. Write `transform: translate3d` from a ref; no React state per move.
- **Valid drop:** released while the dragged disc no longer overlaps its home, meaning the centre distance is ≥ 2r (52px).
  - Releasing anywhere in that state logs, inside or outside the jar.
  - Dragging back over home, `pointercancel`, `lostpointercapture`, Escape, or the page going hidden cancels, and the marble springs back in 150ms.
- **Tap** means under 6px of movement. It does not log: it pulses the hint "Drag into the jar…" (open question 3).
- **iOS Safari and PWA:**
  - Use `touch-action: none` on tray marbles, plus a non-passive `touchmove` `preventDefault` while dragging (React's handler is passive).
  - Add `user-select: none`, `-webkit-touch-callout: none`, and a `contextmenu` `preventDefault`.
  - Add `overscroll-behavior: contain` on the page during the drag.
  - The jar rect is measured at pointerdown; the page can't scroll mid-drag.
- **Haptics:** `navigator.vibrate?.(10)` the first time a drag becomes valid, and `(20)` on drop. This works on Android only. iOS gets no haptics; the `<input switch>` hack is not used.

**Visual feedback.**
- **Lift:** the marble scales to 1.1 with a shadow, in a `position: fixed` overlay (portal, `pointer-events: none`). A ghost (35% opacity, dashed ring) stays at home.
- **Valid:** the jar gets a category-coloured glow (`.jar-armed`).
- **Drop:** the overlay flies to the jar neck and shrinks to marble size (WAAPI, ≤180ms). The write is applied at release, and the Jar's existing `diffAnims` drop plays for the target hour(s), delayed by the fly time (new `Jar` prop `dropDelayMs`), so it reads as one marble.
- **Yesterday-only W:** the overlay flies to the "‹" previous-day button instead.
- **Reduced motion:** the overlay still follows the finger (direct manipulation). There is no fly-in, and the jar uses its existing fade fallback.

**Accessibility.**
- Tray marbles are `<button>`s labelled e.g. "Log 13:30–14:30 as Wanted".
- Enter or Space (`click` with `detail === 0`) logs immediately and focus stays put. The toast is announced via the existing live region.
- VoiceOver and TalkBack activation must be checked on devices. Fallback: the Log time sheet is unchanged.

**Tests.**
- **Unit:** the `lastHourWindow` matrix above (TZ = LA), plus `planDrop` and `undoDrop`:
  - partial overwrite, notes dropped and restored, sleep slots, same-category no-op, a 2-doc midnight drop, creating a new doc (sleep snapshot), and undo after an intervening edit.
- **Component:** tray drag with `fireEvent.pointerDown/Move/Up` (jsdom has PointerEvent; stub `setPointerCapture` and `getBoundingClientRect`):
  - a tap does not log
  - drag out and release logs
  - drag out and back home cancels
  - `pointercancel` cancels
  - Enter logs
  - nothing happens while not writable
- **DayView test:** with the memory repo, a drop calls `writeDays` with the expected docs, and Undo restores them.
- **Playwright smoke** (demo, 390px): drag with the mouse.
- **Manual device checks:** iPhone Safari and the installed PWA, Android Chrome.
  - no page scroll, magnifier, or callout during a drag
  - Android haptics
  - VoiceOver and TalkBack
  - a drop at 00:20 by setting the device clock

### 4.2 Physics mode

**Resolving the tension.** Physics breaks "position = time of day", so it is **opt-in**: jar style "Grid" (default) or "Loose".
- Meaning is kept by:
  - hour numbers on the marbles
  - pouring in chronological order, so the jar stays roughly bottom = early
  - the unchanged summary chips and Entries list
- Physics applies to the day view only. Mini jars and share images stay grid.
- The SPEC P5 "snap to slot once settled" idea is dropped.

**Engine options.**

| Option | Size (min / gz) | Fit | Verdict |
|---|---|---|---|
| Custom circle-only position-based solver (`src/lib/physics`) | ~3–5 KB / ~2 KB | 24 circles against a static polyline; O(n²) = 276 pairs is trivial. Full control over sleep and battery. Pure, so it is unit-testable in Node and deterministic. | **Chosen.** ~300 lines. Risk: stacking jitter or tunnelling, handled with substeps, a velocity clamp, and sleeping. |
| matter-js (lazy) | ~80 KB / ~25 KB | Mature, has sleeping and polygons, but is a general rigid-body engine and not tree-shakeable | **Fallback** if the custom solver fails a 0.5-day spike. Keep it behind the same `World` interface. |
| planck.js (Box2D) | ~150 KB / ~40 KB | Best stacking stability | Heavier than needed |
| Rapier 2D (wasm) | ~1.5 MB | Overkill; wasm startup cost | Rejected |

**Solver.**
- Fixed 1/120 s steps with an accumulator (max 4 steps per frame; dt capped after a resume).
- Each step: integrate with gravity, then 6–8 iterations of circle–circle and circle–segment projection.
- Material: restitution about 0.2, friction about 0.1, linear damping, and a max-speed clamp (no tunnelling).
- **Sleep:** a body sleeps after 30 frames below ε, and the world sleeps when every body does. Contact, a spawn, a tilt change, or a data change wakes it.

**Colliders.**
- Derived from the `jarLayout` constants, as a new export `JAR_COLLIDERS` with no path changes:
  - the walls and floor, inset by half the stroke width
  - each rounded corner and shoulder curve sampled into 6 segments
  - the neck walls, plus an invisible lid at the rim so a hard tilt can't eject marbles
- Capacity check: the inner width of 182 units fits 5 marbles (r = 16) per row, so all 24 marbles fill about the lower 55%.

**Which marbles exist (user decision 5):**
- **All past hours, meaning every hour that has started, including gray unlogged ones.**
  - Future hours are absent, so the jar fills up as the day goes on.
  - When a new hour starts, its marble spawns at the neck and falls.
- A half marble is one circle with a split fill. A future half (the second half of the hour in progress) renders as clear glass.
- No rotation in v1: the split stays vertical, the hour label upright, and the gloss fixed to the light.

**Rendering.**
- **SVG, not canvas.** This reuses the gradients, dark-mode CSS variables, hour text, focus rings, and the native hit-testing and a11y of `JarSvg` and `MarbleShape`.
- Each marble is wrapped in a `<g ref>` whose `transform` is written in rAF (24 attribute writes per frame). `MarbleShape` gets `cx = cy = 0` and no entrance animations, since physics is the animation.
- **Taps:** tapping a marble opens edit exactly as on the grid.
- **Keyboard:** DOM order and tab order follow hour order. Labels are unchanged, and the Entries list remains the a11y fallback.

**Lifecycle.**
- **On load:** a deterministic pre-settle runs off-screen.
  - Seed a loose hex pack in hour order, with jitter seeded from the date, then run about 120 steps synchronously. Budget: ≤ 20 ms on a mid-range phone.
  - The first paint is already settled, so there is no re-pour on every visit. Small layout differences between visits are accepted (no persisted positions).
- **Changes:**
  - A newly started hour spawns at the neck and falls live.
  - Logging, a category change, Undo, or delete recolours the existing body in place and wakes it, so it gets a small hop. A drop is the exception: see below.
  - Changing day rebuilds the world.
- **Battery:** the rAF loop runs only while the world is awake, and it pauses on `visibilitychange` hidden. CPU use at rest is zero.

**Drag-to-drop interplay.** In Loose mode a valid drop **removes the target hour's existing body** (usually gray) and **re-spawns it in the new colour** at the release point.
- The release point is converted to jar coordinates and clamped inside the glass.
- The body keeps the pointer's last velocity, so a flick throws it.
- A release outside the jar spawns at the neck.
- Undo recolours the body in place and does not re-spawn it.

**Tilt (optional item 4.2c; user decision 7: tilt only, no shake).**
- **Tilt:** `DeviceOrientationEvent` gamma and beta set the gravity vector, adjusted for `screen.orientation.angle` and throttled. A change of more than 3° wakes the world.
  - iOS needs `DeviceOrientationEvent.requestPermission()` from a tap on an "Enable tilt" button. Android needs no permission.
- Off by default. Shake is out of scope.

**Settings.**
- Jar style is stored **per device in localStorage (default; open question 6)**, so there is no settings-doc or rules change.
- Controls:
  - a `SegmentedControl` in Settings → Appearance
  - a small toggle button in the jar card corner
- **Reduced motion:** Loose shows the static pre-settled layout, with no live motion and no tilt.

**Performance budget (low-end Android; Chrome DevTools 4× CPU throttle as a proxy).**
- Physics step ≤ 1 ms per frame, and total scripting ≤ 8 ms per frame.
- 60 fps on a mid-range phone, and at least 30 fps when throttled.
- Settles to sleep within 3 s. Zero rAF while asleep.
- The physics chunk is ≤ 8 KB gz, lazy (`React.lazy`). The main bundle grows by ≤ 2 KB gz.

**Tests.**
- **Solver unit tests:**
  - settles inside the collider polygon (penetration < 0.5 units)
  - reaches world sleep within N steps
  - same seed gives same positions
  - no escape after 100 random impulses or a full 180° gravity rotation
  - energy decreases
- **Component tests:** one body per logged or sleep hour, tap calls `onSelect`, rAF stops after sleep (mocked rAF), and reduced motion renders statically.
- **Manual:** feel on iPhone and Android, tilt permission on iOS, battery (no rAF in the Performance panel at rest).

### 4.3 Quota hardening, reassessed

| Item | Decision | Why |
|---|---|---|
| Monthly summary docs (`months/{YYYY-MM}`) | **Defer to backlog** | There is one real user, and a month view is ≤ 31 reads against a 50k/day quota. Summaries would double every write (up to 4 docs at a month-boundary midnight). Rules can't cheaply check a summary against `slots`, so it would drift. Revisit only if usage grows. |
| App Check (reCAPTCHA) | **Do now (default; open question 8)** | The API key is public and the quota is shared, so this is cheap abuse protection. Tokens are cached for about 1h, so there are only a few assessments per day, well inside the free tier. |

**App Check steps for the user** (agents don't change console settings):
1. Create a reCAPTCHA key (v3, or Enterprise as the console offers) for `dd123zzz.github.io` and `localhost`.
2. Firebase console → App Check → register the web app with that key.
3. Add the GitHub repo variable `VITE_APPCHECK_SITE_KEY`.
4. Register a debug token for local dev (in `.env.local`, never committed).
5. Watch the App Check metrics for Firestore for 1–2 weeks while **unenforced**.
6. ~~Enforce for Firestore. Optionally enforce for Auth later.~~ **Cancelled 2026-10-18 (user, iOS question N2): never enforce App Check.** The free-team iPhone app ([ios/](./ios/README.md)) can't attest, so enforcing would lock it out. App Check stays monitor-only.

**Agent work:**
- `initializeAppCheck` with `ReCaptchaV3Provider` and `isTokenAutoRefreshEnabled`.
- Load it inside the Firebase dynamic import only; it must never load in demo mode.
- Skip it when the site key is unset.
- Wire the CI env var and update the README.

No rules change is needed. Enforcement is a console toggle.

### Waves (disjoint file ownership)

**Wave 0 (orchestrator, before coding):**
- Get the user's answers.
- Add `SlotRef { date; slot }` and `JarStyle = 'grid' | 'loose'` to `src/types.ts` (sign-off).
- SPEC follow-ups: F2 (drops overwrite with Undo, no confirm), §2 (Loose jar exception to "position = time"), F4 (chips under the jar).

| Wave | Agent | Owns | Delivers | Est. |
|---|---|---|---|---|
| A (parallel) | A1 Sonnet | `src/lib/time/**`, `src/lib/entries/**` | `lastHourWindow`, `planDrop`, `undoDrop`, plus the test matrix | 0.5 d |
| A | A2 Sonnet | `src/components/Toast.tsx`, `toast.css`, `Toast.test.tsx` | Action, `durationMs`, and `key` support (backward compatible) | 0.25 d |
| A | A3 Sonnet | `src/lib/physics/**` (new), `src/components/jarLayout.ts` (new exports only) | `World` (`add`, `remove`, `step`, `isAsleep`, `setGravity`, `impulse`), `presettle`, `JAR_COLLIDERS`, tests. 0.5 d spike gate, with matter-js as the fallback. | 1 d |
| A | A4 Haiku (after user steps 1–3) | `src/firebase.ts`, `.github/workflows/ci.yml` (env line), `README.md` | App Check wiring | 0.25 d |
| B (parallel, after A) | B1 Sonnet | `src/components/MarbleTray.tsx`, `tray.css`, `useMarbleDrag.ts` + tests (new); `src/views/DayView.tsx`, `day.css`, `DayView.test.tsx`; `src/components/Jar.tsx`, `jarAnim.ts` | Tray, gesture, layout move (chips under the jar), drop and Undo wiring, `dropDelayMs` | 1–1.5 d |
| B | B2 Sonnet | `src/components/PhysicsJar.tsx`, `physicsJar.css` + test (new); `src/components/JarSvg.tsx` (extract shared `JarDefs` and glass, no visual change); `src/hooks/useJarStyle.ts` (new); `src/views/SettingsView.tsx` + test | Loose jar renderer (lazy), lifecycle, sleep and visibility handling, Settings control | 1 d |
| B | B3 Sonnet (optional 4.2c) | `src/hooks/useDeviceTilt.ts` + test (new) | Tilt hook (gravity from `deviceorientation`) with iOS permission; no shake | 0.25 d |
| C | C1 Sonnet | `src/views/DayView.tsx`, `day.css`, `src/components/PhysicsJar.tsx` | Grid/Loose switch and the jar-card toggle, drop → spawn at release point with velocity, tilt wiring | 0.5 d |
| Close | Orchestrator | — | Code review (Sonnet) → fixes → Playwright smoke (both styles, light and dark, 390px) → push → device checks | 0.5 d |

Estimated cost is about 350–450 credits.

**Stage 4 exit:**
- On today's jar, dragging any category marble clear of its home and releasing logs W per the matrix in ≤ 1 gesture, with the drop animation and an Undo that restores exactly. No sheet opens. Keyboard Enter does the same.
- On a real iPhone (Safari and the installed PWA) and an Android phone, the page doesn't scroll during a drag and there is no callout. Android vibrates.
- A drop at 00:20 writes 2 docs in one batch. Drops are blocked while syncing, and work offline.
- Loose mode is off by default.
  - When on, it settles, opens edit on tap, idles with no rAF, and pauses when hidden.
  - It is static under reduced motion.
  - It meets the performance and bundle budget.
- App Check is wired, and enforced after monitoring, or explicitly deferred by the user.
- CI is green (tests, lint, format, both builds, rules). Firestore usage is unchanged (drops add no reads).

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Sign-in popup or redirect fails on Safari or an installed iOS app | Users can't sign in | Popup sign-in only; test on real devices in Stage 1; a custom domain later if needed |
| Free-tier quota is shared, so abuse or a bug can lock out everyone | Outage until the daily reset | One document per day, cached listeners, App Check (4.3); monthly summary docs deferred to backlog |
| Time zone, DST, and midnight bugs | Wrong jars | Pure tested `lib/time` module; a test matrix for DST and midnight crossing |
| Push reminders not possible on the free plan without workarounds | Feature gap | In-app + `.ics` reminders only; real push removed from scope (Stage 4) |
| The 48-character slots string limits future per-entry metadata | Painful migration later | `v` schema-version field; notes map keyed by start slot; revisit if tags are added |
| Safari clears storage for non-installed sites | Offline cache lost | Data lives in Firestore; encourage installing the PWA |
| Accidental drag-drop logs (no confirm) | Wrong or overwritten hours | A drop must leave home completely, a tap never logs, an 8s Undo restores slots and notes, and the live hint shows W before release |
| iOS Safari scroll, callout, or magnifier fights the drag | Drag feels broken on iPhone | `touch-action: none`, pointer capture, a non-passive `touchmove` `preventDefault`, no callout or selection; real-device check in Safari and the installed PWA |
| Physics loses "position = time of day" | Jar less readable | Opt-in Loose style (grid stays the default), hour labels, chronological pour, chips and Entries unchanged |
| Custom solver jitters, tunnels, or drains battery | Janky jar, battery drain | Fixed substeps, a velocity clamp, sleeping plus no rAF at rest, pause when hidden; 0.5-day spike gate with matter-js as the fallback |
| App Check blocks real users (e.g. reCAPTCHA in an iOS standalone PWA) | Lockout | Monitor unenforced for 1–2 weeks before enforcing, use a debug token for dev, and make enforcement reversible in the console |

## Definition of Done (every stage)
- Lint, unit tests, and rules tests pass in CI, and the app is deployed to Pages.
- Manually checked on a real iPhone (Safari) and an Android phone (Chrome).
- Firestore usage checked in the console. Expected reads per active user per day stay small (under about 100).
