# Marbles for iPhone: Product Brief (PM)

Owner: PM. Engineering counterpart: Senior iOS engineer (see [ARCHITECTURE.md](./ARCHITECTURE.md), [EXPERIENCE.md](./EXPERIENCE.md), [ROADMAP.md](./ROADMAP.md), [SIDELOADING.md](./SIDELOADING.md)).
Status: **Planning only. No code is written from these docs until the user approves the roadmap.** Reconciled with [ENGINEERING_FEEDBACK.md](./ENGINEERING_FEEDBACK.md) on 2026-10-18 (see §8).

## 1. Why an iPhone app

The web app (see [../SPEC.md](../SPEC.md)) is functionally complete and stays live. It proved the core loop: log an hour, see the jar fill up. It is honest but flat. A marble jar is a physical, tactile metaphor, and the browser can only fake that: there are no real haptics on iOS Safari, physics is opt-in and limited, there is no sound, and reminders only work while a tab is open.

**The iPhone app exists to make the same data feel physical and fun.** You should *want* to open it every hour because flicking a marble into a jar feels good, not because a reminder nags you.

North-star feeling: *"It's a toy that happens to tell me the truth about my day."*

## 2. Hard constraints (non-negotiable)

| # | Constraint | Consequence |
|---|---|---|
| C1 | **$0, strictly.** No Apple Developer Program ($99/yr), no paid SDKs, assets, fonts, sounds, or services. | Distribution is a sideload via Xcode with a free Personal Team. The app must be re-signed every 7 days. There is no TestFlight, App Store, APNs push, iCloud/CloudKit, Sign in with Apple, or any other capability a free team can't provision. Every asset is original, generated, or CC0. |
| C2 | **Core data model does not change.** Same Firebase project (`marbles-life`), same Spark plan, same `firestore.rules`, same docs: `users/{uid}` settings and `users/{uid}/days/{YYYY-MM-DD}` with the 48-char `slots` string. | iOS is a second client of the same backend. The web and iOS apps must read and write each other's data with zero migration. Rules are not edited for iOS. Any device-only preference (jar style, sound, haptics) is stored locally (UserDefaults), never in Firestore. |
| C3 | **Core features do not change.** F1–F6 and P1–P8 in SPEC.md define *what* the app does. | iOS changes *how it feels*: interaction, motion, sound, haptics, rendering. The same entry rules apply: 30-minute slots, midnight split, last write wins, the precedence DST n/a > logged > future > sleep > unlogged, sleep snapshot per day, and gray/sleep computed and never stored. |
| C4 | **Web stays live as a companion.** | Both clients follow identical write semantics (`updatedAt` = server timestamp, one batch per user action, never write from a partial cache). Any web Stage 4 change that affects shared behavior (e.g. App Check enforcement) must not lock out the iOS client. |
| C5 | **iPhone only.** | No iPad-specific layout, Watch, widgets, Live Activities, or Siri/App Intents in this plan. Portrait-first. |
| C6 | **Spark quota is shared.** | iOS follows the same read budget: one range listener per screen, month ≤ 31 reads, no per-day listeners in loops. |

## 3. Feature parity contract

Every web feature ships on iOS with the same behavior. "Native lift" describes how the iOS version should feel better, not differ.

| Web feature | iOS parity | Native lift (fun / UX) |
|---|---|---|
| F1 Auth: Google + email/password, persisted session | Required | Native Google sign-in sheet; email form with keyboard flow. Password AutoFill is manual only (the QuickType key icon), because a free team has no Associated Domains. |
| F2 Log a time block (2-tap last hour, overwrite confirm) | Required | **Flick a marble into the jar** as the primary gesture (≤ 1 gesture), and the log sheet as the precise fallback |
| F3 Edit / delete / backfill, date navigation | Required | Swipe between days like turning shelves; tap a marble to "pick it up" and inspect it |
| F4 Day jar + summary | Required | Real-physics jar, glass and marble shaders, collision haptics and sound |
| F5 Week / month mini jars | Required | Week = a **shelf** of 7 jars; month = a **cabinet**. Static thumbnails (quota and battery). |
| F6 Settings: sleep window, week start, theme, sign out, delete all data | Required | Same, plus local-only Sound, Haptics, Jar style, and Motion controls |
| P1 Stats | Required | "Pour out" animation sorting marbles into category tubes, then the numbers |
| P2 Dark mode | Required | System appearance + manual override (synced via the existing `theme` field) |
| P3 Reflection | Required | **"Seal the jar"** ritual: write the reflection and the lid screws on |
| P4 CSV/JSON export | Required | Share sheet (Files, AirDrop, etc.) |
| P5 Drop animation / Loose jar | Required | Physics-first jar (see open question Q1) |
| P6 Share jar image | Required | Rendered share card through the share sheet |
| P7 Reminders (in-app + `.ics`) | Required | **Real system notifications** (banner, lock screen, sound, action buttons), scheduled locally on the phone, so no push server or paid program is needed. Neutral copy ("How was 13:00–14:00?") and Wanted / Wasted / Unwanted actions log **the hour the notification names**, after unlock. Reminders stop if the app isn't opened for 2 days. **No `.ics` on iOS** (user, N8); the web keeps it. |
| P8 Installable / offline | N/A → native | Firestore offline cache on device; works in airplane mode |
| Web Stage 4: drag-to-drop + Undo, Loose jar, tilt | Adopt the *behavior* | Native gesture + Undo toast; tilt via Core Motion |

## 4. The fun layer (what makes this worth building)

Product requirements; the engineer owns the "how" in [EXPERIENCE.md](./EXPERIENCE.md).

1. **A jar that obeys physics.** Marbles have weight, roll, clack together, and settle. Tilting the phone tilts gravity. Readability is preserved by hour numbers and a one-tap **Tidy** that snaps marbles back into hour order.
2. **Flick to log.** Three category marbles sit in a tray. Drag or flick one into the jar to log the last hour, with the same window rules as web Stage 4.1 (`lastHourWindow`) and an Undo toast instead of a confirm. The flick velocity carries into the physics.
3. **Feel it.** Core Haptics patterns scale with impact speed: a soft tick for a light touch, a heavier clack for a hard drop. The in-app Haptics toggle (default on) is the source of truth, because iOS has no public API to read the System Haptics switch.
4. **Hear it.** Glass and marble sounds, synthesized or CC0 only, layered by impact speed and marble material. They respect the silent switch (ambient audio). Off by default (open question Q3).
5. **Glass you want to touch.** Shader-based glass highlights and refraction that shift subtly with device tilt (parallax). Marbles have per-category interior swirls so categories are distinguishable by **pattern as well as color** (accessibility win).
6. **Rituals.** Seal the jar at day's end (reflection), a satisfying pour on first launch (onboarding), and the shelf/cabinet metaphor for calendar views.
7. **Celebrate, don't nag.** Small, rare moments of delight (e.g. a full day with no gray marbles) that stay within core features: no streaks, goals, or gamified scores, which are backlog items in SPEC §5.
8. **Respect the user.** Reduce Motion → static grid jar, no tilt, crossfades. VoiceOver labels identical to web (`"13:00–14:00 Wanted"`). Dynamic Type everywhere. Haptics and sound can each be turned off.

## 5. Success criteria

| Metric | Target |
|---|---|
| Log last hour | 1 gesture (flick) or 2 taps (sheet) |
| Cold launch to an interactive jar | < 1.0 s on the user's iPhone 16 with cached data |
| Jar animation | 60 fps (120 fps on ProMotion where cheap). **0% CPU at rest** (backgrounded, jar off screen, or tilt off); ≤ 2% with tilt on and the phone still. |
| Cross-client fidelity | For the same data, both clients produce the same marbles per hour (colors, halves, labels), Grid layout, stats, and CSV export bytes, enforced by golden fixtures. The Loose layout is random by design and exempt. |
| Quota | Reads per active user per day unchanged from web (well under 100) |
| Battery | No measurable drain at rest; no background work except scheduled local notifications |
| Fun (qualitative) | The user reports they *prefer* logging on iOS over the web after one week |

## 6. Non-goals

- New categories, tags, goals, streaks, social features, or any schema change.
- iPad, Watch, widgets, Live Activities, Siri/App Intents, Mac Catalyst.
- App Store or TestFlight distribution, push notifications, or anything needing the $99 program.
- Replacing the web app.

## 7. Open questions for the user

| # | Question | PM recommendation |
|---|---|---|
| Q1 | Default jar style on iOS: **Loose (physics)** or **Grid**? The web defaults to Grid. | **Loose** on iOS, with a one-tap Tidy and a Grid option in Settings. Physics is the reason the app exists. |
| Q2 | Should the minimum iOS version be the latest major (smaller, newer APIs) or one older (wider device support)? | Let engineering recommend; see ARCHITECTURE.md. |
| Q3 | Sound on by default? | **Off by default**, with a prompt during onboarding. Haptics **on**. |
| Q4 | Logging from a notification action writes to Firestore from the background. Is a short "Saved, will sync" fallback acceptable if the write can't confirm before iOS suspends the app? | Yes. The data is in the offline cache and syncs at the next launch. |
| Q5 | The 7-day re-sign cadence: is the user comfortable re-running from Xcode weekly (with an in-app expiry warning)? | Yes. This is the cost of C1. |

Engineering agreed with all five recommendations (Q2: **iOS 26.0 minimum**, built with Xcode 27). Q4 is adjusted: the fallback is a queued intent on the device, never a write from the offline cache. Engineering's new questions **N1–N9** were answered by the user on 2026-10-18; see [ENGINEERING_FEEDBACK.md §6](./ENGINEERING_FEEDBACK.md#6-user-answers-2026-10-18).

## 8. PM decisions after engineering review (2026-10-18)

| # | Topic | Decision | Effect on the brief |
|---|---|---|---|
| D1 | **App Check** | **Never enforce** App Check (user, N2 = A). Web PLAN 4.3 step 6 ("enforce") is **cancelled** (web follow-up W3). Partial extra protection: new email sign-ups are turned off (N6). | Fulfils C4: the web must not lock out iOS. Abuse risk is accepted: worst case is a daily quota outage with no bill and no data exposure. |
| D2 | **Notification logging** | Accept: an online transaction with a 4 s timeout, else a device-local queued intent applied at next open through the normal write gate. Actions require unlock. They log the named hour. | §3 P7 row updated. No cache writes ever. |
| D3 | **AutoFill** | Accept the degradation (no Associated Domains on a free team). | §3 F1 row updated. |
| D4 | **Haptics setting** | In-app toggle is the source of truth. | §4 item 3 updated. |
| D5 | **"Zero CPU at rest"** | Adopt engineering's definition. | §5 updated. |
| D6 | **Physics engine** | **Box2D v3.2** (MIT), behind a `JarWorld` protocol, gated by spike I0.6. Fallback: a Swift port of the web's own solver. SpriteKit, RealityKit, SceneKit, and Chipmunk were rejected (see [EXPERIENCE.md §1](./EXPERIENCE.md#1-physics-engine-evaluation)). | Fun layer #1 has a concrete engine and a fallback. |
| D7 | **Fidelity** | Golden fixtures exported from the web's TS functions in 4 time zones; encoded iOS docs are checked against the unchanged rules in web CI. | §5 updated. Guards C2/C3. |
| D8 | **Priorities** | Physics jar, flick-to-log, shaders, haptics, and notification actions are **Must**. Rituals (seal, onboarding pour, stats pour, shelf art, celebrate) and sound are **Should**, cuttable in I3. Alternate icons and "share as you see it" are **Could**. | Protects the schedule without losing the core fun. |
| D9 | **Budget** | ≈ 1,235 credits (range ~990–1,540) across I0–I4, ~20–25 working days. | Needs user approval ([ROADMAP.md §10](./ROADMAP.md#10-approval-checklist-for-the-user)). |
| D10 | **Target hardware** (N1) | The user's **iPhone 16** (iOS 27.x, 60 Hz) is the only test and performance device. Dev Mac: M3, which needs macOS → 26.7.1 and Xcode → 27.1 first. | §5 budgets are measured on the iPhone 16 |
| D11 | **Bundle ID** (N7) | `com.dd123zzz.marbles` | Simple; never changes after Firebase registration |
