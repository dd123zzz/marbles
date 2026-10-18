# Marbles — Product Spec & Scope

## 1. Vision
A mobile-first web app where every hour of your day becomes a colored marble in a jar. At a glance you can see how much of your day, week, or month went to things you wanted to do versus wasted or unwanted time.

**Constraints:** $0 hosting. The frontend runs on GitHub Pages and the backend is Firebase on the Spark (free) plan, using only Auth and Firestore. There is no server code and no Cloud Functions.

## 2. Core Concepts

| Term | Definition |
|---|---|
| **Marble** | 1 hour of time. A **half marble** (a half circle) is 30 minutes, the smallest unit. |
| **Jar** | One local calendar day, holding a fixed **24 marble slots** (one per hour). |
| **Slot** | A 30-minute unit. Each day has 48 slots, and each hour position in the jar is two slots. |
| **Entry** | A block of time the user logs: start time, duration, category, and an optional note. |

### Marble categories

| Category | Color | Source |
|---|---|---|
| **Wanted** | 🟢 Green | User-logged: time spent on something I wanted to do |
| **Wasted** | ⚫ Black | User-logged: wasted time |
| **Unwanted** | 🔴 Red | User-logged: something I did not want to do |
| **Sleep** | 🔵 Blue / indigo | Auto-filled: the user's sleep window, unless an entry overrides it |
| **Unlogged** | ⚪ Gray | Auto-filled: past time that has no entry and isn't sleep |
| *(future)* | Empty | Time later today that hasn't happened yet stays empty |

### Marble rendering rule
For each hour position:
- If both 30-minute halves have the same category, draw one full marble.
- If they differ, draw two half-circle marbles side by side (left half = :00–:30, right half = :30–:60).

Marbles stack chronologically: 00:00 at the bottom of the jar, 23:00 at the top. Each marble's position always means a time of day, so the jar is readable rather than random.

## 3. Core User Loop (MVP)

### F1. Authentication
- Sign in with **Google** or **email/password**, including sign-up and password reset.
- Use popup sign-in, not redirect (redirect breaks on Safari and GitHub Pages).
- The session persists on the device, so returning users skip login.
- Sign-out is available in Settings.

### F2. Log a time block
- **Fields:**
  - **Category:** Green, Black, or Red. Required. Shown as three big buttons.
  - **Start time:** defaults to the previous full hour (e.g., at 14:20 the default is 13:00). Uses a 30-minute step.
  - **Duration:** defaults to 1 hour. Uses a 30-minute step, minimum 30 minutes, maximum 24 hours.
  - **Note:** optional free text, up to 200 characters.
- **Midnight:** an entry that crosses midnight is split across both days automatically.
- **Overlaps:** logging over already-logged slots asks the user to confirm, then overwrites them (the last write wins). Sleep and unlogged slots are overwritten silently.
- **Target:** the default "log last hour" flow takes 2 taps or fewer.

### F3. Edit, delete & backfill
- Tap a marble to see its entry (time range, category, note), then edit or delete it.
- A date navigator (previous/next day and a date picker) lets you view and log any past day.
- Logging future time is blocked for today and later.

### F4. Day jar view (home)
- Shows today's jar with 24 positions, filled using the rendering rule above.
- Shows a summary line with hours per category (e.g., `G 6h · B 2.5h · R 1h · Sleep 8h · Unlogged 3.5h`).

### F5. Calendar views
- **Week view:** 7 mini jars with day labels. The week start (Mon or Sun) is a user setting.
- **Month view:** a grid of mini jars.
- Tapping any mini jar opens that day's jar.
- Mini jars use the same rendering rule as the day jar, drawn as static images.

### F6. Settings
- **Sleep window:** start and end time, default 23:00–07:00.
- **Week start:** Monday or Sunday.
- **Account:** email, sign out.
- Changing the sleep window does not rewrite past days (each day keeps a snapshot of its sleep window).

## 4. Post-MVP Features (chosen by the user)

| ID | Feature | Notes |
|---|---|---|
| P1 | **Stats** | Hours and percentage per category for the day, week, and month. Two percentage views: "of awake time" (G/B/R/Unlogged) and "of 24 hours". |
| P2 | **Dark mode** | Follows the system setting, with a manual toggle. Black marbles get an outline or glow so they stay visible. |
| P3 | **End-of-day reflection** | One free-text note per day (up to 1,000 characters), shown under the day jar. |
| P4 | **CSV/JSON export** | Exports all data or a date range. Generated in the browser. |
| P5 | **Marble drop animation** | New marbles drop into their slot with a bounce. Respects the device's reduced-motion setting. Optional real physics on the day view only (stretch). |
| P6 | **Share jar image** | Saves the day or week jar as a PNG and opens the phone's share sheet, with a download fallback. |
| P7 | **Hourly reminders** | Tiered: an in-app banner and browser notification while the app is open, then a calendar `.ics` reminder, then real push notifications (stretch; needs a free external scheduler). |
| P8 | **Installable app (PWA)** | Can be installed to the home screen. Needed for iOS push and gives offline-first behavior. |

## 5. Out of Scope (for now)
- Social features, multiple users per jar, teams.
- Custom categories beyond the 3 user-logged colors.
- Native mobile apps.
- Year heatmap, streaks, daily goals, and tag presets (backlog candidates).

## 6. Non-Functional Requirements
- **Cost:** stays inside the Firebase Spark quotas (50k reads and 20k writes per day, shared by the whole project). A month view should cost 31 reads or fewer.
- **Privacy:** each user can only read and write their own data. This is enforced by Firestore security rules.
- **Offline:** Firestore's local cache is on, so logging works offline and syncs when the device reconnects.
- **Performance:** first load under 3 seconds on a mid-range phone over 4G. Logging feels instant (the UI updates before the server confirms).
- **Accessibility:** colors are paired with text and labels, marbles have accessible labels, and animation respects reduced-motion settings.

## 7. Decisions Log

| Decision | Choice | Why |
|---|---|---|
| Frontend | React + Vite + TypeScript | Most Firebase and library examples; works well for a solo developer and AI-assisted coding. |
| Routing | Hash router | GitHub Pages has no fallback routing for single-page apps, so deep links would 404. |
| Auth | Google + email/password, popup sign-in | Redirect sign-in breaks with storage partitioning on GitHub Pages. |
| Data model | One document per user per day, holding a 48-slot string | Cheap reads, easy validation in security rules, and overlaps are impossible by design. |
| Gray and sleep fill | Computed in the browser, not stored | No extra writes; rendering stays consistent. |
| Jar size | 24 marbles, sleep in its own color | User decision. |
| Physics | Fixed slot positions plus a drop animation (physics is a stretch goal) | Each position means a time of day, so random physics would scramble the meaning. |
| Push reminders | Staged, with real push as a stretch goal | The free plan has no server-side sender. |

## 8. Open Questions
1. The exact sleep color, and whether sleep counts toward "awake %" stats. The proposal is that it does not.
2. GitHub repo name and visibility. This affects the URL path (`/marbles/`) and GitHub Actions minutes if push reminders use an Actions cron.
3. Whether a custom domain is wanted later. It would allow redirect-based sign-in and nicer URLs.
