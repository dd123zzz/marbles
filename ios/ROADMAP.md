# Marbles for iPhone: Roadmap

Owner: Senior iOS engineer (orchestrator). Style follows the web [PLAN.md](../PLAN.md); working model follows [AGENTS.md](../AGENTS.md); rates come from [model_rate.md](../model_rate.md).
Inputs: [PRODUCT.md](./PRODUCT.md) · [ENGINEERING_FEEDBACK.md](./ENGINEERING_FEEDBACK.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [EXPERIENCE.md](./EXPERIENCE.md) · [SIDELOADING.md](./SIDELOADING.md)

**Status: planning only. No code until the user approves this roadmap. N1–N9 are answered ([ENGINEERING_FEEDBACK §6](./ENGINEERING_FEEDBACK.md#6-user-answers-2026-10-18)).**

## 1. Overview

| Stage | Name | Goal | Est. days | Est. credits |
|---|---|---|--:|--:|
| I0 | Setup and spikes | One-time setup; scaffold; golden fixtures; 3 go/no-go spikes (Firebase on device, physics, notifications) | 2–3 | 155 |
| I1 | Core parity | Every web feature (F1–F6, P1–P4, P6, P7) on iOS with a Grid jar and the same write semantics | 6–8 | 413 |
| I2 | Physics and fun | Box2D Loose jar, flick-to-log + Undo, shaders, haptics, audio, tilt | 5–6 | 300 |
| I3 | Rituals and polish | Seal the jar, onboarding pour, stats pour, shelf/cabinet, celebrate, share polish | 4–5 | 198 |
| I4 | Hardening | Performance, battery, accessibility, DST/time zone, cross-client and quota verification | 3 | 157 |
| — | Web-side follow-ups (W2, W4, W8) | No data-model change | — | 12 |
| | **Total** | | **20–25** | **≈1,235** (range ~990–1,540) |

**How credits are estimated** (1 credit = $0.01):
- Sonnet 5.5: 10 per 1M cached input, 200 per 1M fresh input, 1000 per 1M output. A **large** task (≈2M cached + 50K fresh + 25K out) ≈ 20 + 10 + 25 = **55**. Medium ≈ 25–35. Small ≈ 15.
- Haiku 5.5 (≤100K context): 1 / 10 / 50 per 1M. A scaffold task ≈ 1–3.
- "Close" rows cover the orchestrator, the code review (Sonnet), and fixes (Sonnet).
- Swift and Xcode builds cost more turns than the web stack, so the range is −20% / +25%.
- Following AGENTS.md, append to HANDOFF every ~100 credits (an iOS section).

**Working rules (from AGENTS.md, adapted):**
- The orchestrator plans, delegates, verifies, and reviews; it writes no app code.
- **Sonnet 5.5** for logic, state, data, physics, and shaders. **Haiku 5.5** for scaffolding, config, copy, and docs. **Opus 5.5** for PM questions only.
- Parallel agents get **disjoint path ownership** and commit only their paths (`git add <paths>`).
- `ios/Packages/MarblesCore/Sources/MarblesCore/Types.swift` (the contract) and `ios/Marbles.xcodeproj` change only with orchestrator sign-off.
- Each agent prompt contains:
  - files to read
  - the exact API or behavior
  - owned paths
  - verification commands
  - a Conventional Commit message with the Copilot co-author trailer
  - "report concisely"
- After every agent, the orchestrator re-runs the checks:
  - `swift test --package-path ios/Packages/<Pkg>`
  - `xcodebuild -project ios/Marbles.xcodeproj -scheme Marbles-Demo -destination 'platform=iOS Simulator,name=iPhone 16' test`
  - `swift format lint --recursive ios`
  - `git status`
- Before closing a stage: code-review subagent → fixes → demo smoke test on the Simulator → real-iPhone checks (DoD §7).
- **Never edit `firestore.rules` for iOS.** Don't push or change Firebase/GitHub settings without the user.

## 2. Stage I0: Setup and spikes

| # | Owner | Owns | Task | Acceptance | Credits |
|---|---|---|---|---|--:|
| I0.1 | **User** | — | One-time setup per [SIDELOADING.md §2](./SIDELOADING.md#2-one-time-setup). **First update the Mac: macOS 26.5.1 → Tahoe 26.7.1, then Xcode 26.0 → 27.1, `xcode-select`, and the iOS 27.1 platform.** Then: Apple ID in Xcode (Personal Team), Developer Mode on the iPhone 16, register `com.dd123zzz.marbles` in Firebase, download the plist, restrict the iOS API key. Turn off sign-ups only after both clients are signed in (N6). | `xcodebuild -version` shows 27.1; a blank app runs on the phone; plist received | 0 |
| I0.2 | Haiku | `ios/Marbles.xcodeproj`, `ios/App/**` (skeleton), `ios/Packages/*/Package.swift` + empty targets, `ios/.gitignore`, `ios/.swift-format` | Scaffold: app target (iOS 26.0), schemes `Marbles` and `Marbles-Demo`, 4 local packages, synchronized folders, SPM deps (Firebase 13 Auth+Firestore, GoogleSignIn 10, Box2D v3.2.0). Gitignore `Config/GoogleService-Info.plist`. | Builds on the Simulator; `swift test` runs (0 tests) | 3 |
| I0.3 | Haiku | `.github/workflows/ios.yml` (new) | CI on `macos-latest`: `swift test` for MarblesCore and MarblesPhysics; simulator `build-for-testing` of `Marbles-Demo` (no plist needed) | Green on a branch; Xcode 27 availability noted | 2 |
| I0.4 | Sonnet | `scripts/golden/**` (new), `ios/Fixtures/golden/**`, root `package.json` script line only | **W1:** golden fixture exporter (Vitest, 4 zones) per [ARCHITECTURE §5](./ARCHITECTURE.md#5-cross-client-fidelity), plus the geometry fixture. CI staleness check. | Fixtures generated; `npm test` green; no `src/**` change | 25 |
| I0.5 | Sonnet | `ios/Spikes/FirebaseSpike/**` (deleted at I1 start) | **Spike A, Firebase on device:** Google + email sign-in on a free team; Keychain session after a re-sign; a day doc written from iOS is accepted by the rules (`serverTimestamp`, `v:1`) and renders on the live web; `fromCache` metadata; launch time and installed size | Written report with numbers; go/no-go | 30 |
| I0.6 | Sonnet | `ios/Packages/MarblesPhysics/Spike/**`, `ios/Spikes/PhysicsSpike/**` | **Spike B, physics:** Box2D + Canvas jar, 48 marbles, flicks, tilt, hit events → haptic; the gate table in [EXPERIENCE §1](./EXPERIENCE.md#1-physics-engine-evaluation); CPU at rest with tilt on | Gate table filled in; engine chosen (Box2D or the Swift-port fallback) | 45 |
| I0.7 | Sonnet | `ios/Spikes/NotifySpike/**` | **Spike C, notifications:** rolling one-shot reminders; check the 64 limit with `pendingNotificationRequests`; `.authenticationRequired` actions; background-launch time; the transaction write (online, airplane, locked); read `embedded.mobileprovision` `ExpirationDate` | Measured background time; transaction success rate; fallback path works | 25 |
| Close | Orchestrator + review | `HANDOFF.md` (iOS section), these docs | Record decisions; clear every "unverified, check in spike I0" marker | Every I0 marker resolved or re-planned | 25 |

**I0 exit:**
- The 3 spikes have go/no-go results.
- The minimum iOS (26.0), engine, App Check stance (N2), and bundle ID are confirmed.
- Golden fixtures exist.
- Spikes are deleted, not merged.

**Status (2026-10-18 sprint, Xcode 26.0, host-only):** I0.3 CI workflow and I0.4 golden fixtures done. Ahead of plan, the I1 MarblesCore port and the MarblesPhysics Swift-solver fallback landed with host tests (153 + 10). I0.2 is partial (packages, `.gitignore`, `.swift-format`; no Xcode project or app target). I0.1 and I0.5–I0.7 (device, Firebase, Box2D and notification spikes) are blocked until the Mac has Xcode ≥ 26.2 / 27.1. See HANDOFF row 12.

## 3. Stage I1: Core parity

**Wave 0 (orchestrator):** sign off `Types.swift` (mirror of `src/types.ts` + `SlotRef`, `JarStyle`, `defaultSettings`). Confirm the fixtures are current.

| Wave | Agent | Owns | Delivers | Acceptance | Credits |
|---|---|---|---|---|--:|
| A | A1 Sonnet | `MarblesCore/Sources/MarblesCore/{Time,Jar,Stats,Labels}/**` + matching tests | Port of `lib/time` (incl. `lastHourWindow`), `lib/jar`, `lib/stats`, `dateLabels` with `TimeContext` | All `time/lastHour/jar/stats` golden cases pass in 4 zones | 45 |
| A | A2 Sonnet | `ios/Packages/MarblesData/**`, `ios/Fixtures/encoded/**` | `Repo`, `FirestoreRepo`, `MemoryRepo`, `WriteGate` (W-11, W-12), `AuthService` (Google + email + reset), `DayDocCodec` (W-1…W-8), `friendlyAuthError`, `deleteAllData` (W-14) | Codec tests for every write-checklist row; encoded fixtures written; MemoryRepo contract tests mirror `memoryRepo.test.ts` | 55 |
| A | A3 Haiku | `MarblesUI/Sources/MarblesUI/Tokens/**` | Light/dark color tokens from `tokens.css`, spacing, radii, type ramp | Previews in both themes | 3 |
| B | B1 Sonnet | `MarblesCore/Sources/MarblesCore/{Entries,Export,Forms,Reminders}/**` + tests | `lib/entries` (incl. `planDrop`/`undoDrop`, logical entries, reflection), `lib/export`, `logSheetLogic`, `sleepLogic`, `reminderHours` (no `buildReminderIcs`: no `.ics` on iOS) | All `entries/export/forms/reminders` golden cases pass; CSV byte-identical | 55 |
| B | B2 Sonnet | `ios/App/Shell/**`, `ios/App/Features/{Auth,Settings}/**` | App entry, tabs (Day / Week / Month / Stats / Settings), `AppEnvironment`, demo mode, `ToastCenter`, sign-in screens, Settings (synced fields, device prefs, delete all data, theme) | Demo scheme runs with no Firebase calls; sign-in works on device | 45 |
| C | C1 Sonnet | `ios/App/Features/Day/**`, `MarblesUI/Sources/MarblesUI/{Marble,GridJar}/**` | Day view: Grid jar with hour labels and halves, chips, Entries list, 2-tap log sheet with overwrite confirm, edit/delete (logical), per-day sleep sheet, plain reflection, date nav + basic paging | F2/F3/F4 parity checklist; VoiceOver labels per half | 60 |
| C | C2 Sonnet | `ios/App/Features/{Week,Month,Stats,Export,Share}/**`, `MarblesUI/Sources/MarblesUI/MiniJar/**` | Week (7) and month (≤ 31 reads) static mini jars, stats numbers + toggle, export through the share sheet, share PNG (day/week) | Stats match the web for a fixture month; export bytes match | 45 |
| C | C3 Sonnet | `ios/App/Features/Reminders/**`, `ios/App/Services/{Notifications,Provisioning}/**` | Rolling 48 h reminders, cancel-when-logged, `LOG_HOUR` actions with the transaction + `PendingIntentQueue`, expiry warning (local notifications only; no `.ics`) | Device test: action logs while online; airplane mode queues and applies on next open | 40 |
| Close | Orchestrator + review + fixes | — | Review, fixes, demo smoke test, DoD | — | 65 |

**I1 exit:**
- On the user's iPhone: sign in (Google and email), log the last hour in 2 taps, midnight split (2 docs, 1 batch), edit/delete/backfill, week/month navigation, stats, export, share image, reflection, per-day sleep, delete all data, dark mode, and a notification action.
- Cross-client check passes (DoD §7).
- `firestore.rules` is unchanged.

## 4. Stage I2: Physics and fun

| Wave | Agent | Owns | Delivers | Acceptance | Credits |
|---|---|---|---|---|--:|
| A | A1 Sonnet | `ios/Packages/MarblesPhysics/**` | `JarWorld`, `Box2DWorld` (units, material, sleep, hit events, mouse joint), colliders from the geometry fixture, seeded pre-settle (`mulberry32` + `seedLayout` port); `SwiftSolverWorld` only if the I0.6 gate failed | Tests: settles inside the glass (< 0.5 units), sleeps ≤ 3 s, same seed → same positions, no escape after 100 impulses + a 180° gravity turn, energy decreases | 50 |
| A | A2 Sonnet | `MarblesUI/Sources/MarblesUI/{Shaders,Sprites}/**`, `ios/App/Resources/Shaders/**` | Marble fill shader (7 patterns, rotation, upright split and label), glass refraction and specular, gradient fallback | Snapshot previews light/dark; GPU ≤ 6 ms with 48 marbles | 45 |
| A | A3 Sonnet | `ios/App/Services/Feedback/**` | `FeedbackEngine`: Core Haptics mapping and rate limits ([EXPERIENCE §10](./EXPERIENCE.md#10-haptics-and-audio)), synthesized audio on the `.ambient` session, prefs | Unit tests for mapping and rate limits; sound off by default | 35 |
| B | B1 Sonnet | `MarblesUI/Sources/MarblesUI/LooseJar/**`, `ios/App/Services/Motion/**`, `ios/App/Features/Day/Jar/**` | Loose jar (Canvas + paused `TimelineView`), lifecycle (spawn, recolor, rebuild), Tidy/Loosen, tilt, tap-to-inspect, grab-and-toss, a11y children | Zero frames at rest; VoiceOver order by hour | 55 |
| B | B2 Sonnet | `ios/App/Features/Day/Tray/**`, `ios/App/Shell/Toast/**` | Tray + flick gesture, `lastHourWindow`/`planDrop`, Undo toast (`undoDrop`), velocity carry-over, Grid fly-in, yesterday-only window, sync gate | Unit and UI tests: a tap doesn't log, valid release logs, back-home cancels, not writable → spring back, Undo restores exactly | 40 |
| C | C1 Sonnet | `ios/App/Features/Day/DayView.swift`, `DayScreenModel.swift` | Integrate the Loose/Grid switch, tray → physics spawn at the release point, jar-card toggle, Reduce Motion → Grid | Demo smoke test of both styles | 15 |
| Close | Orchestrator + review + fixes | — | Review, fixes, device feel session with the user | — | 60 |

**I2 exit:**
- On today's jar, a flick logs the window per the PLAN 4.1 matrix in 1 gesture, with Undo, haptics, and an optional sound.
- A drop at 00:20 writes 2 docs in 1 batch. Drops are blocked while syncing and work offline.
- Loose is the default and meets EXPERIENCE §14 budgets. Reduce Motion gives a static Grid.

## 5. Stage I3: Rituals and polish

All rows run in parallel; ownership is disjoint.

| # | Agent | Owns | Delivers | Priority | Credits |
|---|---|---|---|---|--:|
| I3.1 | Sonnet | `ios/App/Features/Reflection/**` | Seal-the-jar ritual, lid state from `reflection`, unseal | Should | 25 |
| I3.2 | Sonnet | `ios/App/Features/Onboarding/**` | Onboarding pour, sound/reminder/tilt prompts, skip | Should | 25 |
| I3.3 | Sonnet | `ios/App/Features/Stats/Pour/**` | Stats pour-out (≤ 744 bodies, degrades to 1 marble = 4 h) | Should | 40 |
| I3.4 | Sonnet | `ios/App/Features/{Week,Month}/**`, `ios/App/Features/Day/Paging/**` | Shelf/cabinet art, zoom transitions, lids on thumbnails, paging polish | Should | 35 |
| I3.5 | Sonnet | `ios/App/Features/Share/**`, `ios/App/Features/Day/Celebrate/**`, `ios/App/Resources/AppIcons/**` | Share card polish, Clean-jar celebrate, alternate icons drawn in code | Should / Could | 20 |
| I3.6 | Haiku | `ios/App/Resources/Localizable.xcstrings` | Copy pass; labels match the web strings | Must | 3 |
| Close | Orchestrator + review + fixes | — | — | — | 50 |

**I3 exit:** Should items are shipped or explicitly cut by the user. Every ritual has a Reduce Motion variant.

## 6. Stage I4: Hardening

Rows H1–H3 run **one after another**, because they touch shared app paths.

| # | Agent | Owns | Delivers | Credits |
|---|---|---|---|--:|
| H1 | Sonnet | `ios/App/**` (fix-only) | Instruments pass: launch, fps, CPU at rest, memory, energy; fixes to meet EXPERIENCE §14 | 30 |
| H2 | Sonnet | `ios/App/**`, `MarblesUI/**` (fix-only) | Accessibility audit: VoiceOver, Dynamic Type AX5, Reduce Motion, Increase Contrast, Differentiate Without Color | 30 |
| H3 | Sonnet | `ios/Packages/*/Tests/**`, `ios/AppTests/**` | DST, midnight, and time zone-change app tests; fixture refresh; pending-intent edge cases | 20 |
| H4 | Haiku | `ios/README.md` (add a "Build and run" section), `ios/SIDELOADING.md` (updates) | Run instructions and the re-sign runbook validated | 2 |
| Close | Review 25 + fixes 25 + orchestrator 25 | — | Whole-codebase review (Sonnet) | 75 |

**I4 exit:**
- The DoD passes on device.
- A 7-day soak on the user's phone includes 1 re-sign, with data and session kept.
- The user reports a preference for iOS logging (PRODUCT §5).

## 7. Definition of Done (every stage)

1. **Automated:**
   - `swift test` is green for every package. Golden fixtures pass in all 4 zones.
   - Demo-scheme simulator tests are green. `swift format lint` is clean. `ios.yml` CI is green.
   - Web CI is green, including the W2 rules test on the encoded docs.
2. **Rules untouched:** `git diff firestore.rules` is empty. Every iOS write matches the [write checklist](./ARCHITECTURE.md#6-data-layer-and-write-semantics).
3. **Real iPhone** (free-team install), for the stage's features:
   - the core loop
   - airplane-mode logging that syncs later
   - a notification action (unlocked and locked)
   - VoiceOver spot check, Reduce Motion, dark mode
   - Instruments shows no CPU at rest
4. **Cross-client check against the live web** (https://dd123zzz.github.io/marbles/):
   - Log on iOS → web Day/Week/Month show the same marbles, labels, and stats.
   - Log on the web → iOS matches.
   - A midnight-crossing entry, a reflection, and a per-day sleep edit made on one client are correct on the other.
   - CSV exported from both clients for the same range is byte-identical.
5. **Quota:** after a day of use, Firebase console → Firestore → Usage shows < 100 reads per active user per day, with writes as expected.
6. Code review done; high-confidence findings fixed; HANDOFF updated.

## 8. Web-side follow-ups

None of these change the data model or `firestore.rules`.

| # | Item | When | Credits |
|---|---|---|--:|
| W1 | Golden fixture exporter + staleness check (`scripts/golden/**`) | I0.4 | (in I0) |
| W2 | Rules test that loads `ios/Fixtures/encoded/*.json` and asserts allow (`tests/rules/` only; runs in CI) | I1 | 10 |
| W3 | **App Check: never enforce (user, N2).** PLAN 4.3 step 6 ("enforce") is cancelled; recorded in HANDOFF Decisions and PLAN 4.3. | Done (planning) | 0 (orchestrator) |
| W4 | Docs: SPEC §5 "Native mobile apps" → point to `ios/`; README mentions the iOS companion | I1 | 1 |
| W5 | Keep `jarLayout.ts` the single source of geometry (exported via the W1 fixture) | Ongoing | 0 |
| W6 | Optional: the web gate could also wait for server-confirmed settings (iOS W-12). It's a behavior hardening only. | Backlog | — |
| W7 | Optional: if the Swift-port physics fallback is used, export `src/lib/physics` traces as fixtures | I2, if needed | — |
| W8 | Web `authErrors.ts`: map `auth/admin-restricted-operation` to "New sign-ups are closed." (N6). Copy only, no behavior change. Haiku. | Before the user turns sign-ups off | 1 |

## 9. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| App Check enforced on the web | iOS locked out | W3: don't enforce. Option B runbook in ENGINEERING_FEEDBACK §3.1 |
| Box2D spike fails (interop, feel, perf) | Loose jar delayed | Swift-port fallback behind `JarWorld`; scripted pours |
| 7-day expiry missed | App won't open | Notification 24 h before, banner, About row; data is safe in Firestore; the web is the fallback ([SIDELOADING §3](./SIDELOADING.md#3-weekly-re-sign-ritual)) |
| Notification-action write can't finish | Hour not logged | Transaction + 4 s timeout → queued intent; never a cache write |
| Partial cache overwrites web data | Data loss | Full-doc writes only behind W-11/W-12; codec + gate tests |
| JS/Swift divergence (DST, UTF-16, JSON order) | Different jars on each client | Golden fixtures in 4 zones; encoded-doc rules test |
| Free-team limits (3 apps, 10 App IDs/week) | Can't install | Fixed bundle ID; simulator-only UI tests; spikes reuse the main app ID where possible |
| Xcode 27 / macOS / CI image mismatch | Can't build | This Mac is on macOS 26.5.1 + Xcode 26.0; update to 26.7.1 + Xcode 27.1 in I0.1 ([SIDELOADING §2.1](./SIDELOADING.md#21-mac-and-xcode)). CI pinned to an available Xcode. |
| Battery drain (physics, motion, audio) | Bad reviews from the one user | Sleep, paused timeline, motion only when visible, audio auto-stop; H1 measurements |
| Canvas jar hurts VoiceOver | Accessibility regression | `accessibilityChildren` in hour order; the Entries list; H2 audit |
| Shared Spark quota with two clients | Daily outage | One listener per screen; 30-min re-listen rule; quota check in DoD |
| Fun scope creep | Schedule slip | Must/Should/Could; I3 is cuttable; no new data |
| Haptics ignore the System Haptics switch | Annoyance | In-app toggle (default on); verify in I0 |

## 10. Approval checklist for the user

- [ ] Approve the stages and the ≈1,235-credit budget.
- [x] Answer N1–N9 ([ENGINEERING_FEEDBACK §6](./ENGINEERING_FEEDBACK.md#6-user-answers-2026-10-18)).
- [ ] Complete I0.1 setup ([SIDELOADING §2](./SIDELOADING.md#2-one-time-setup)).
