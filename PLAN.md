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

---

## Stage 3: Delight & Engagement (about 3–4 days)

| # | Feature | Notes |
|---|---|---|
| 3.1 | Marble drop animation (P5) | Animate each new marble into its fixed position with a bounce. Respect `prefers-reduced-motion`. Mini jars stay static. |
| 3.2 | Share jar image (P6) | Draw the jar to a canvas (directly, not via an SVG-to-image step), build the PNG blob before the tap, then use `navigator.share({files})` or fall back to a download. Day and week variants. |
| 3.3 | Reminders, Tier 1 (P7) | While the app is open: a banner like "N unlogged hours" plus an optional hourly `Notification`. Best effort, since phones pause background tabs. |
| 3.4 | Reminders, Tier 2 (P7) | Download an `.ics` file with an hourly repeating event (inside waking hours) that links to the app. Works on iOS without installing. |

---

## Stage 4: Stretch / Infrastructure (optional)

| # | Feature | Notes |
|---|---|---|
| 4.1 | True push reminders (P7, Tier 3) | FCM Web Push. Store device tokens on the user document. A free scheduled sender (a **Cloudflare Workers cron**, preferred, or a GitHub Actions cron, which can be late or skipped and is disabled after 60 days without repo activity) reads tokens and last-logged times and sends via the FCM v1 API. Handle per-user time zones, quiet hours, and skip-if-logged. Merge the push code into the PWA's service worker; don't add a second worker. iOS needs 16.4+ and the app installed to the home screen. |
| 4.2 | Physics jar | Lazy-loaded `matter-js`, day view only. Model half marbles as convex polygons, then snap each marble to its slot once it settles. |
| 4.3 | Quota hardening | Monthly summary documents (`months/{YYYY-MM}`) so a month view costs 1 read; turn on App Check (reCAPTCHA) |
| 4.4 | Backlog | Streaks, daily goal, tag presets, year heatmap, custom domain (allows redirect sign-in) |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Sign-in popup or redirect fails on Safari or an installed iOS app | Users can't sign in | Popup sign-in only; test on real devices in Stage 1; a custom domain later if needed |
| Free-tier quota is shared, so abuse or a bug can lock out everyone | Outage until the daily reset | One document per day, cached listeners, App Check, monthly summary docs |
| Time zone, DST, and midnight bugs | Wrong jars | Pure tested `lib/time` module; a test matrix for DST and midnight crossing |
| Push reminders not possible on the free plan without workarounds | Feature gap | Tiered reminders; real push isolated in Stage 4 |
| The 48-character slots string limits future per-entry metadata | Painful migration later | `v` schema-version field; notes map keyed by start slot; revisit if tags are added |
| Safari clears storage for non-installed sites | Offline cache lost | Data lives in Firestore; encourage installing the PWA |

## Definition of Done (every stage)
- Lint, unit tests, and rules tests pass in CI, and the app is deployed to Pages.
- Manually checked on a real iPhone (Safari) and an Android phone (Chrome).
- Firestore usage checked in the console. Expected reads per active user per day stay small (under about 100).
