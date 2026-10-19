# Marbles for iPhone: Architecture

Owner: Senior iOS engineer. Requirements: [PRODUCT.md](./PRODUCT.md). Pushback: [ENGINEERING_FEEDBACK.md](./ENGINEERING_FEEDBACK.md). UX: [EXPERIENCE.md](./EXPERIENCE.md). Plan: [ROADMAP.md](./ROADMAP.md). Ops: [SIDELOADING.md](./SIDELOADING.md).
Web references: [SPEC.md](../SPEC.md), [PLAN.md](../PLAN.md), [AGENTS.md](../AGENTS.md), [`src/types.ts`](../src/types.ts), [`firestore.rules`](../firestore.rules).

Status: planning only. Anything not verified is marked **"unverified, check in spike I0"**.

## 1. Stack and minimum iOS

| Layer | Choice | Why |
|---|---|---|
| Language | Swift 6 language mode, strict concurrency | Data-race safety; the app is mostly `@MainActor` |
| UI | SwiftUI (UIKit only where needed: share sheet host, `UIAccessibilityElement` fallbacks) | Shaders, Observation, `sensoryFeedback`, zoom transitions |
| State | Observation (`@Observable`), iOS 17+ ([Apple](https://developer.apple.com/documentation/observation)) | Fine-grained updates, no Combine |
| Physics | **Box2D v3.2** (MIT, C17, official `Package.swift`) behind a `JarWorld` protocol. Fallback: a Swift port of the web solver ([`src/lib/physics/world.ts`](../src/lib/physics/world.ts)) | See [EXPERIENCE.md §1](./EXPERIENCE.md#1-physics-engine-evaluation) |
| Rendering | SwiftUI `Canvas` inside a pausable `TimelineView`, with Metal `[[stitchable]]` shaders (`GraphicsContext.Shading.shader`, `layerEffect`, iOS 17+ [Apple](https://developer.apple.com/documentation/swiftui/view/layereffect(_:maxsampleoffset:isenabled:))) | 24–48 bodies are cheap. A Metal `MTKView` renderer is the spike fallback. |
| Backend | Firebase Apple SDK **13.x** via SPM: FirebaseAuth and FirebaseFirestore only ([release notes](https://firebase.google.com/support/release-notes/ios)) | Same project `marbles-life`, Spark plan |
| Google sign-in | GoogleSignIn-iOS **10.x** (iOS 15+, [Package.swift](https://github.com/google/GoogleSignIn-iOS/blob/main/Package.swift)) | Native sheet, no entitlement |
| Tests | Swift Testing for packages ([Apple](https://developer.apple.com/documentation/testing)); XCTest UI tests on the **Simulator only** | `swift test` runs on the Mac, so it costs no App ID |
| Lint and format | `swift format` (bundled with the toolchain) | $0, no extra dependency |
| CI | GitHub Actions macOS runner. Free for public repos ([GitHub](https://docs.github.com/en/billing/concepts/product-billing/github-actions)). | Xcode 27 image availability: **unverified, check in spike I0** |

**Minimum iOS: 26.0. Build with Xcode 27.1 (27A9275, iOS 27.1 SDK; needs macOS 26.6+, [xcodereleases.com](https://xcodereleases.com/)).** Test device: the user's **iPhone 16** (A18, 60 Hz display) on iOS 27.x. Dev Mac: Apple M3, which needs the macOS and Xcode updates in [SIDELOADING.md §2.1](./SIDELOADING.md#21-mac-and-xcode). Bundle ID: **`com.dd123zzz.marbles`**. Reasoning (answers PRODUCT Q2):
- Current releases: iOS 27 and Xcode 27 shipped in September 2026 ([iOS 27](https://en.wikipedia.org/wiki/IOS_27), [Xcode 27 notes](https://developer.apple.com/documentation/xcode-release-notes/xcode-27-release-notes)).
- Floors from dependencies: Firebase 13 → iOS 15. GoogleSignIn 10 → iOS 15. Box2D → iOS 13.
- Floors from APIs: shaders and `@Observable` → 17. `MeshGradient` and scroll-geometry APIs → 18 ([Apple](https://developer.apple.com/documentation/swiftui/meshgradient)). Liquid Glass `glassEffect` → **26** ([Apple](https://developer.apple.com/documentation/swiftui/view/glasseffect(_:in:))). We want 26 for the glass-themed chrome.
- Device reach: iOS 27 runs on iPhone 11 and later ([Apple](https://support.apple.com/guide/iphone/iphone-models-compatible-with-ios-27-iphe3fa5df43/ios)). iOS 26 also adds the A12 phones (XR/XS); this list is **unverified, check in spike I0**. "One older major" costs nothing, because no iOS 27-only API is needed.
- Engines we avoid: SceneKit is deprecated as of iOS 26 ([Apple](https://developer.apple.com/documentation/scenekit)). SpriteKit is not deprecated, but we don't use it as the engine (see EXPERIENCE §1). RealityKit is too heavy for a 2D jar.

## 2. Project layout

All iOS code lives under `ios/`. The Xcode project uses synchronized (buildable) folders, so agents add files without editing `project.pbxproj`. After I0, only the orchestrator edits the project file.

```
ios/
  *.md                          planning docs (PRODUCT.md is PM-owned)
  Marbles.xcodeproj             app target "Marbles"; schemes Marbles (Release/Debug) and Marbles-Demo
  App/
    Shell/                      @main app, root tabs, routing, AppEnvironment (DI), Toast
    Features/{Auth,Day,Week,Month,Stats,Settings,Reflection,Onboarding,Export,Share,Reminders}/
    Services/{Notifications,Provisioning,Feedback,Motion,Network}/
    Resources/                  asset catalog (generated art only), Localizable.xcstrings, Metal sources
  Packages/
    MarblesCore/                pure Swift + Foundation. No UIKit, SwiftUI, or Firebase.
    MarblesData/                Repo protocol, FirestoreRepo, MemoryRepo, WriteGate, AuthService, codecs
    MarblesPhysics/             JarWorld protocol, Box2DWorld, SwiftSolverWorld (fallback), colliders
    MarblesUI/                  tokens, marble sprites/shaders, GridJar, LooseJar, MiniJar
  Fixtures/
    golden/                     generated by the web exporter (read-only for iOS agents)
    encoded/                    day/settings docs encoded by Swift (checked by web rules tests)
  Config/GoogleService-Info.plist   gitignored (see SIDELOADING.md)
  AppTests/, AppUITests/        simulator only
```

Dependency direction: `App → MarblesUI → MarblesPhysics`, `App → MarblesData → MarblesCore`, `MarblesUI → MarblesCore`. MarblesCore depends on nothing. The shared contract is `MarblesCore/Types.swift` (the equivalent of `src/types.ts`). Like the web rule, agents need orchestrator sign-off to edit it.

## 3. Port map (TypeScript → MarblesCore)

The names and behavior match the web. Every function takes a `TimeContext` (a `Calendar` plus `TimeZone`), so tests can pin the zone instead of reading `TimeZone.current`.

| Web source (+ tests) | Swift (MarblesCore) |
|---|---|
| `types.ts` | `Category` (`g/b/r`), `SlotChar`, `DateKey` (validated, `Comparable`), `HHmm`, `SleepWindow`, `DayDoc`, `Settings` (+ `defaultSettings`: 23:00–07:00, mon, system, v 1), `Entry`, `Marble`, `MarbleColor`, `SlotRef`, `JarStyle`, `slotsPerDay = 48` |
| `lib/time/dates.ts`, `calendar.ts` | `DateKey(validating:)`, `toDateKey`, `addDays`, `weekRange`, `monthRange`, `monthGrid` |
| `lib/time/slots.ts` | `slotToHHmm`, `hhmmToSlot`, `formatSlotRange`, `slotStartDate`, `currentSlotInfo`, `defaultStart`, `splitAcrossDays`, `isFutureSlot`, `isSlotPast`, `isEntryInFuture`, `nonexistentSlots`, `isInSleepWindow` |
| `lib/time/lastHour.ts` | `lastHourWindow(now:) -> [SlotRef]` (the PLAN 4.1 matrix) |
| `lib/jar` | `computeMarbles`, `summarize`, `formatSummary`, `hasLoggedSlots`, `isEmptyPastDay`, `categoryLabel` |
| `lib/entries` | `entriesFromDay`, `entryAt`, `findConflicts`, `applyEntry`, `deleteEntry`, `validateEntry`, `logicalEntryAt`, `logicalEntriesForDay`, `withReflection`, `planDrop`, `undoDrop` (`DropPlan`, `DropUndo`) |
| `lib/stats` | `computeStats`, `roundPct` |
| `lib/export` | `exportRows`, `csvField`, `toCsv`, `toJson`, `isoWithOffset`, `exportFilename`, `exportCounts` |
| `lib/dateLabels.ts` | Fixed English labels ("Mon Oct 12"), **not** locale formatting, to match the web |
| `views/logSheetLogic.ts`, `sleepLogic.ts` | `Forms`: `defaultStartFor`, `maxLengthFor`, `defaultLengthFor`, `planSave`, `formatEntryRange`, `describeRange`, `sleepHours`, `withSleep` |
| `reminders/unlogged.ts`, `notify.ts`, `ics.ts` | `sleepFor`, `unloggedHours`, `formatUnlogged`, `reminderHours` (`buildReminderIcs` is not ported; no `.ics` on iOS) |
| `auth/authErrors.ts` | `friendlyAuthError` (mapped from Firebase iOS error codes, same copy) |
| `components/jarLayout.ts` | `JarGeometry`: 188×314 jar units, `marblePosition(hour)`, `marbleRadius = 16`, `cellSize = 40`, `jarColliders`. Values come from the geometry fixture. |
| `lib/physics/*` | Only the fallback port (`SwiftSolverWorld`, `seedLayout`, `mulberry32`) |

## 4. State management

- **`AppEnvironment`**, injected through SwiftUI `Environment`: `repo: Repo`, `auth: AuthService`, `clock: Clock`, `time: TimeContext`, `feedback: FeedbackEngine`, `notifications: ReminderScheduler`, `prefs: DevicePrefs`.
- **Stores** are `@MainActor @Observable` classes and the only owners of listeners:
  - `SessionStore`: auth state.
  - `SettingsStore`: one settings listener per session.
  - `DaysStore(range:)`: one range listener per screen. Exposes `days`, `fromCache`, `loading`, `error`.
  - `WriteGate`: combines a days store, the settings store, and `NetworkMonitor` (`NWPathMonitor`) into `writable` and `reason` (Syncing / Loading settings).
  - `ToastCenter`: keyed toasts with an optional action. 8 s, or 15 s while VoiceOver is running.
  - `PendingIntentQueue`: notification-action fallback (§9).
- **Views never touch Firestore.** They call stores. Stores call `MarblesCore` planners (`planSave`, `planDrop`, …), then `repo.writeDays`.
- **`Clock`** publishes `now` at the next :00/:15/:30/:45 boundary (the hint text changes at :15/:45 and marbles at :00/:30). It also fires on `significantTimeChangeNotification` and time zone changes. There is no per-second timer.
- **`DevicePrefs`** (UserDefaults, device-only, never Firestore): `jarStyle` (`loose` default), `tilt` (on), `sound` (off), `haptics` (on), `remindersEnabled` (off), `onboardingDone`, `lastCelebratedDate`, `pendingIntents`.

## 5. Cross-client fidelity

Goal: the web and iOS produce identical outputs for identical inputs. "Identical" means the same `computeMarbles`, entries, stats, export bytes (CSV), parsed JSON, and Grid layout. The Loose layout is allowed to differ.

**Golden fixtures** (web follow-up W1, task I0.4):
- A web script runs under Vitest (`scripts/golden/export.test.ts`). For each zone `America/Los_Angeles`, `Australia/Lord_Howe` (a 30-minute DST shift), `Asia/Kolkata` (+5:30, no DST), and `UTC`, it runs the real TS functions over an input matrix and writes `ios/Fixtures/golden/<module>.<zone>.json` as `{input, output}` cases.
- CI fails if the fixtures are stale (regenerate and run `git diff --exit-code`).

| Fixture | Cases (minimum) |
|---|---|
| `time` | slot↔HH:mm, `splitAcrossDays` (1–48 slots, crossing midnight and the year end), `nonexistentSlots` for every 2026–2027 DST day, `isInSleepWindow` (wrapping, start = end) |
| `lastHour` | The full PLAN 4.1 matrix (14:00…00:20, 2027-01-01 00:20, 2026-03-08 03:10), plus a Lord Howe spring-forward |
| `jar` | Precedence n/a > logged > future(empty) > sleep > unlogged; half marbles; labels like `"13:00–14:00 Wanted"`; split labels; summaries |
| `entries` | apply/replace/delete, note folding and truncation, joined midnight entries, `planDrop`/`undoDrop` (partial overwrite, notes dropped and restored, same-category no-op, 2-doc midnight drop, new doc with sleep snapshot, undo after an intervening edit) |
| `stats`, `export` | Week/month stats, CSV bytes (BOM, CRLF, RFC 4180 quoting), JSON (compared after parsing) |
| `geometry` | `JAR_COLLIDERS`, `marblePosition(0…23)`, the jar paths |
| `forms`, `reminders` | `planSave` conflicts, `maxLengthFor`, `reminderHours` for several sleep windows |

**Known JS vs. Swift traps (each gets a fixture):**
- **Time normalization.** JS `new Date(y,m,d,h,min)` moves a skipped wall time forward and picks the earlier offset for a repeated one. `Calendar.date(from:)` may differ. `nonexistentSlots` and `slotStartDate` must reproduce the JS results (**unverified, check in spike I0**).
- **String length.** JS `slice` counts UTF-16 units. Swift counts graphemes. Truncate notes (200) and reflections (1000) by `utf16.count`, never splitting a scalar. The rare 199-unit result is a documented divergence.
- **Equality.** `sameDoc` uses `JSON.stringify`, which is key-order sensitive. Swift uses `Equatable`. The only effect is an occasional skipped no-op write; it's benign.
- **JSON key order.** JS orders integer-like keys numerically. JSON export is compared semantically; CSV byte for byte.
- **Rounding.** `roundPct` uses `Math.round` (half up). Swift uses `.toNearestOrAwayFromZero`, which is equal for non-negative values. `toFixed(1)` only ever sees multiples of 0.5, so it is exact.

**Encoded-doc check** (web follow-up W2): Swift tests write the encoded DayDoc and Settings maps to `ios/Fixtures/encoded/`. A web rules test (`tests/rules/`, CI only, because there's no local Java) loads them, adds `serverTimestamp()`, and asserts they are **allowed**. Rules are never edited.

## 6. Data layer and write semantics

The `Repo` protocol mirrors [`src/data/repo.ts`](../src/data/repo.ts): `subscribeSettings`, `saveSettings(patch)`, `subscribeDays(start,end)` → `(days, SnapshotMeta(fromCache))`, `getDays`, `writeDays([DateKey: DayDoc])`, `deleteAllData`. Implementations: `FirestoreRepo`, and `MemoryRepo` (the demo scheme, previews, tests; persisted to a file in the app container).

**Write checklist.** Every item is a test in `MarblesData` and a review gate. The rules must pass unchanged.

| # | Rule | Source |
|---|---|---|
| W-1 | A day doc write is a **full `setData` (no merge)** with exactly `slots, notes, sleep{start,end}, tz, v` + `updatedAt`, and `reflection` only when non-empty. Never `null`, never extra keys. | rules `hasOnly`/`hasAll`; `firestoreRepo.writeDays` |
| W-2 | `slots` matches `^[gbr.]{48}$`. Asserted before encoding; a failure aborts the write and shows a toast. | rules |
| W-3 | `notes`: string→string, keys are run-start slot indices `"0"…"47"`, ≤ 48 entries, each ≤ 200 UTF-16 units | rules + `MAX_NOTE_LENGTH` |
| W-4 | `sleep.start/end` are `HH:mm` (`validClock`). iOS only produces :00/:30. | rules |
| W-5 | `tz = TimeZone.current.identifier`, ≤ 64 chars | rules |
| W-6 | `reflection` is trimmed, ≤ 1000 UTF-16 units, and the key is omitted when empty. Whether the rules' `size()` counts the same units is **unverified, check in spike I0**. | rules |
| W-7 | `v: 1` as an integer | rules `v == 1` |
| W-8 | `updatedAt = FieldValue.serverTimestamp()`, never a client date | rules `updatedAt == request.time` |
| W-9 | **One `WriteBatch` per user action** (a midnight entry writes 2 docs). The only exception is a notification action, which uses one **transaction** (§9). | AGENTS.md |
| W-10 | **Optimistic:** never `await` a commit before updating the UI. Latency compensation drives the snapshot. On error, show "Could not save your changes: …". | AGENTS.md |
| W-11 | **Gate:** build a write only when the range snapshot is server-confirmed (`!isFromCache`), **or** `NWPathMonitor` reports offline, **or** 4 s have passed since the store subscribed. Never from a partial cache. | `useWriteGate.ts` |
| W-12 | **Block all writes until settings have loaded.** iOS is stricter than the web: settings must also be server-confirmed, offline, or past the 4 s grace, because the day's sleep snapshot is permanent. | AGENTS.md |
| W-13 | Settings: `setData(merge: true)` with only changed keys + `v: 1`. Keys ⊆ `sleepStart, sleepEnd, weekStart, theme`. Sleep values are `HH:00`/`HH:30` (`validTime`). Device-only prefs never go here. | rules `validSettings` |
| W-14 | Delete all data: online only. Typed `DELETE`. `getDocuments(source: .server)`, delete batches of ≤ 450, then delete the settings doc. | `firestoreRepo.deleteAllData` |
| W-15 | Edits of midnight-joined entries go through `logicalEntryAt` (edited as one, written as one batch) | PLAN 2.0c |
| W-16 | Demo mode never calls `FirebaseApp.configure()` | AGENTS.md |

**Listeners:** days use `includeMetadataChanges: true` (to track `fromCache`). Settings use the same, for W-12. Day = D−1..D+1 (3 docs), Week = 7, Month and month Stats ≤ 31. Export is a one-shot `getDocuments`. There are no per-day listeners in loops.

## 7. Auth

- **Email/password** (sign-up, sign-in, reset) through FirebaseAuth. Fields use `textContentType(.username/.newPassword/.password)`. Domain-bound AutoFill is unavailable (no Associated Domains on a free team; see [ENGINEERING_FEEDBACK §3.3](./ENGINEERING_FEEDBACK.md#33-f1-password-autofill)).
- **Google:** `GIDSignIn.signIn(withPresenting:)`, then `GoogleAuthProvider.credential(idToken, accessToken)`, then `Auth.signIn(with:)`. It needs the `REVERSED_CLIENT_ID` URL scheme and `CLIENT_ID` from `GoogleService-Info.plist` ([Firebase](https://firebase.google.com/docs/auth/ios/google-signin)). No entitlement is needed. The web's "popup only" rule does not apply to native.
- **Session:** Firebase Auth keeps it in the Keychain (default access group = Personal Team ID + bundle ID). Re-signing with the same Apple ID and bundle ID keeps it. Whether it survives deleting the app is **unverified, check in spike I0**; the app must just ask the user to sign in again. Sign-out calls `Auth.signOut()` and `GIDSignIn.signOut()`.
- No Sign in with Apple (paid only).
- **Sign-ups closed (user, N6):** once the console switch is off, email sign-up returns `admin-restricted-operation`. `friendlyAuthError` maps it to "New sign-ups are closed." (web follow-up W8 adds the same copy on the web). Google first-time sign-in still works; that's the documented gap.

## 8. App Check decision

**Decided (user, N2 = A): do not use App Check on iOS, and never enforce App Check for Firestore or Auth, project-wide.** A free team has no attestation provider (App Attest is paid-only, and DeviceCheck needs a paid-account key), and the debug provider is not for production. Full analysis, risk, and Option B are in [ENGINEERING_FEEDBACK §3.1](./ENGINEERING_FEEDBACK.md#31-app-check-a-cross-client-blocker-affects-c4). If the user later chooses B: FirebaseAppCheck plus `AppCheckDebugProviderFactory` in every build, and register the token from the Xcode console after each fresh install ([Firebase](https://firebase.google.com/docs/app-check/ios/debug-provider)).

## 9. Notifications (P7)

**Local system notifications, not calendar events and not remote push** (user, N8). They look and behave exactly like push notifications: a banner, the lock screen, Notification Center, sound, long-press action buttons. But they're scheduled on the phone by `UNUserNotificationCenter`, so they need no server, no APNs, and no paid entitlement. Remote push (APNs) would need the $99 program plus a server sender (Cloud Functions aren't on Spark), and hourly reminders don't need it. No `.ics` on iOS.

- **Permission:** opt-in from Settings → Reminders or onboarding. `.alert, .sound`. The interruption level is `.active` (Time Sensitive is paid-only).
- **Schedule:** `reminderHours(sleep)` (ported from `ics.ts`; only this helper, not the `.ics` builder) gives the awake hours. iOS schedules **one-shot** `UNCalendarNotificationTrigger`s for the next 48 h (≤ 48 requests). The id is `hour-<YYYY-MM-DD>-<HH>`. The window is rebuilt on foreground, after every write, after a sleep-setting change, and in the action handler. **If the app isn't opened, the window isn't refilled, so reminders stop within 48 h (user, N8).** Budget: ≤ 48 reminders + 1 re-sign warning, under the 64 limit (the limit is **unverified, check in spike I0**).
- **Cancel when logged:** after any iOS write, remove pending reminders whose hour is fully logged. On foreground, reconcile against the snapshot (this catches hours logged on the web).
- **Content:** title "Log your last hour", body "How was 13:00–14:00?". Category `LOG_HOUR` with actions **Wanted / Wasted / Unwanted** (`.authenticationRequired`, not `.foreground`). `userInfo = {date, startSlot}`. Tapping the notification opens Today.
- **Action handler** (background launch): `beginBackgroundTask`. Make sure Firebase is configured and the auth user is restored. `runTransaction`: read the target day(s) from the server, `planDrop(targets: the named 2 slots, now: actionTime)`, set the changed docs. 4 s timeout. On failure, queue `PendingIntent{category, targets, actionTime}` and post "Saved on this iPhone. It syncs when you open Marbles." At the next foreground, once the gate opens, intents apply in order with the normal batch. The transaction path is spike I0.7.
- **Re-sign warning:** see [SIDELOADING.md §4](./SIDELOADING.md#4-in-app-expiry-warning).

## 10. Share and export

- **Share image (P6):** `ImageRenderer` of `ShareCardView` (always the Grid layout, light card background `#faf7f2`, 1080 px wide). Day and week variants, with the same content as `drawJar.ts` (`DAY_IMAGE` 360×700 pt, `WEEK_IMAGE` 420×650 pt at scale 3). Shared through `ShareLink` with a `Transferable` PNG, rendered before the tap.
- **Export (P4):** a date range, then `toCsv`/`toJson` from MarblesCore. The file goes to the app's own temporary directory and is shared through the share sheet (Files, AirDrop). Filename `marbles-<start>_<end>.csv|json`.
- **`.ics`:** not on iOS (user, N8). Local notifications replace it. The web keeps its `.ics` reminders.

## 11. Offline, quota, timezone and DST

**Offline:**
- The Firestore persistent cache is on (`PersistentCacheSettings`, 100 MB).
- Logging works offline (the gate opens when offline). Delete-all needs a connection.
- At cold launch the Day jar renders from the cache (Grid or presettled Loose) while the gate shows "Syncing…" on the tray.

**Quota (Spark: 50k reads/day, 20k writes/day, shared).** A re-attached listener costs a full re-read only after 30+ minutes disconnected ([Firestore pricing](https://firebase.google.com/docs/firestore/pricing)).

| Action | Reads | Writes |
|---|--:|--:|
| Open Day | ≤ 3 | 0 |
| Page to another day | ≤ 3 (cached neighbors cost less) | 0 |
| Week shelf / month cabinet / month stats | 7 / ≤ 31 / ≤ 31 | 0 |
| Log, drop, edit, undo | 0 | 1–2 docs |
| Notification action (transaction) | 1–2 | 1–2 |
| Export a range | N days | 0 |
| **Typical day** (16 logs, 10 opens, 2 calendar views) | **< 100** | **< 40** |

**Timezone and DST** (same rules as the web, documented limitation):
- Date keys are local calendar days in the device's current zone. `tz` is stored for reference only.
- On the spring-forward day the missing slots are `na`. On the fall-back day the repeated hour is ignored (wall clock).
- The sleep window applies inside each calendar day and wraps.
- On `NSSystemTimeZoneDidChange` and on significant time changes: rebuild stores, recompute marbles, reschedule reminders.
- Tests pin `TimeContext` per fixture zone. The app uses `.autoupdatingCurrent`.

## 12. Free-provisioning capability matrix

Sources:
- [AC]: Apple, [Supported capabilities (iOS)](https://developer.apple.com/help/account/reference/supported-capabilities-ios), "Apple Developer" column.
- [AD]: Apple, [About your developer account](https://developer.apple.com/help/account/basics/about-your-developer-account).

| Feature | Free team? | Plan |
|---|---|---|
| Local notifications, actionable categories | Yes, no entitlement ([Apple](https://developer.apple.com/documentation/usernotifications/declaring-your-actionable-notification-types)) | Used (§9) |
| Push / APNs (remote) | No [AC] | Not used. Local notifications give the same on-screen experience (§9). |
| Time Sensitive / Communication notifications | No [AC] | `.active` level |
| Background Modes | Yes [AC] | Not used (battery goal). The notification-action launch needs no mode. |
| iCloud (CloudKit, documents, KVS) | No [AC] | Firestore only |
| App Groups | Yes [AC] | Not needed (no extensions) |
| Keychain Sharing | Yes [AC] | Not needed; the default group is used |
| Data Protection | Yes [AC] | Default class |
| Sign in with Apple | No [AC] | Excluded |
| Associated Domains | No [AC] | No universal links or domain AutoFill |
| AutoFill credential provider | No [AC] | Not relevant |
| App Attest | No [AC] | No App Check (§8) |
| DeviceCheck key for App Check | Needs Keys in CI&P (paid) [AD]; **unverified, check in spike I0** | Not used |
| Siri / App Intents, Game Center, Wallet, HealthKit | Siri, Game Center, Wallet: No. HealthKit: Yes [AC] | Out of scope (C5) |
| Alternate app icons | Yes, no entitlement ([Apple](https://developer.apple.com/documentation/uikit/uiapplication/setalternateiconname(_:completionhandler:))) | Could ([EXPERIENCE §12](./EXPERIENCE.md#12-more-fun-ideas)) |
| Core Haptics, Core Motion, AVAudioEngine, Metal | Yes, no entitlement | Used. Device motion needs no permission prompt (**unverified, check in spike I0**). |
| Widgets, Live Activities, Watch | Possible via extensions (extra App IDs) | Out of scope (C5) |
| TestFlight / App Store | No | Xcode sideload ([SIDELOADING.md](./SIDELOADING.md)) |
| Limits | 10 App IDs per 7 days; 3 devices; 3 apps per device; 7-day profiles [AD]. Developer Mode required ([Apple](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device)). | Fixed bundle ID; simulator-only UI tests |

## 13. Dependencies

Everything costs $0. Licenses are permissive.

| Name | Version | License | Why |
|---|---|---|---|
| [firebase-ios-sdk](https://github.com/firebase/firebase-ios-sdk) (FirebaseAuth, FirebaseFirestore) | 13.x | Apache-2.0 | Same backend as the web |
| Firebase transitive deps (gRPC, abseil, BoringSSL, leveldb, nanopb, GoogleUtilities, Promises) | pinned by Firebase | Apache-2.0 / BSD / ISC / zlib (**unverified, check in spike I0** via `Package.resolved`) | Firestore |
| [GoogleSignIn-iOS](https://github.com/google/GoogleSignIn-iOS) | 10.x | Apache-2.0 | Google sign-in |
| AppAuth-iOS, GTMAppAuth, GTMSessionFetcher, AppCheckCore (transitive) | pinned by GoogleSignIn | Apache-2.0 | GoogleSignIn deps |
| [Box2D](https://github.com/erincatto/box2d) | v3.2.0 | MIT | Physics (CCD, sleep islands, hit events with `approachSpeed`, rolling resistance, determinism) |
| Apple frameworks: SwiftUI, Observation, Metal, Core Haptics, Core Motion, AVFAudio, UserNotifications, Network, Swift Testing, XCTest | iOS 26 SDK+ | Apple SDK | Platform |

No CocoaPods (Firebase 13 dropped it). No paid SDKs, fonts (SF Pro/Rounded are system fonts), sounds (synthesized at runtime), or images (drawn in code or generated).

**Size and launch:** Firestore's gRPC stack is heavy. Budget ≤ 40 MB installed and cold launch < 1.0 s on the iPhone 16 with cached data. Measure in I0.5 (**unverified, check in spike I0**).
