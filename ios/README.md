# Marbles for iPhone: Planning Docs

A native iPhone client for Marbles that makes the same data feel physical and fun: a real-physics jar, flick-to-log, haptics, sound, glass shaders, and rituals. It shares the web app's Firebase project, data model, rules, and features unchanged, and it costs $0 (free Xcode Personal Team sideload).

**Status (2026-10-18): planning only. There is no iOS code yet. N1–N9 are answered. Coding starts once the user approves [ROADMAP.md](./ROADMAP.md) and the Mac is updated (macOS 26.7.1 + Xcode 27.1).**

## Reading order

| # | Doc | Owner | What it answers |
|---|---|---|---|
| 1 | [PRODUCT.md](./PRODUCT.md) | PM | Why, the constraints (C1–C6), the parity contract, the fun layer, success criteria, and the PM decisions after review (§8) |
| 2 | [ENGINEERING_FEEDBACK.md](./ENGINEERING_FEEDBACK.md) | iOS engineer | Pushback on the brief, the free-team realities, answers to Q1–Q5, and new questions N1–N9 |
| 3 | [EXPERIENCE.md](./EXPERIENCE.md) | iOS engineer | Physics engine choice, the jar rendering, interaction specs, haptics, audio, motion timing, accessibility, and performance budgets |
| 4 | [ARCHITECTURE.md](./ARCHITECTURE.md) | iOS engineer | Stack (iOS 26+, SwiftUI, Box2D, Firebase 13), modules, the TS→Swift port map, golden fixtures, the write checklist, notifications, and the free-capability matrix |
| 5 | [ROADMAP.md](./ROADMAP.md) | iOS engineer | Stages I0–I4, waves with path ownership, credits (≈1,235), the DoD, web follow-ups, and risks |
| 6 | [SIDELOADING.md](./SIDELOADING.md) | iOS engineer | One-time setup, the weekly re-sign ritual, the expiry warning, what survives a reinstall, and troubleshooting |

## Key decisions at a glance

- **$0 strictly.** Free Personal Team, re-signed weekly from Xcode. No App Store, TestFlight, push, or paid SDKs.
- **iPhone only.** iOS 26.0 minimum.
- **No data-model change.** Same Firestore docs and `firestore.rules`. Device-only prefs live in UserDefaults.
- **Web stays live.** App Check is never enforced, so iOS isn't locked out.
- **Reminders are real system notifications**, scheduled on the phone (no push server, no `.ics`), with Wanted / Wasted / Unwanted buttons. Bundle ID `com.dd123zzz.marbles`; test device iPhone 16.
- **Physics: Box2D v3.2 (MIT)**, behind a spike gate, with a Swift port of the web solver as the fallback. **Loose** jar by default, with one-tap Tidy; Grid under Reduce Motion.
- **Fun Musts:** flick-to-log with Undo, impact-scaled Core Haptics, per-category marble swirl shaders, tilt-to-roll, tap to pick up and inspect, and logging from a notification.
- **Fun Shoulds:** seal-the-jar reflection ritual, onboarding pour, stats pour-out, week shelf / month cabinet, Clean-jar celebrate, synthesized sound (off by default).

## Waiting on the user

1. Approve the roadmap and budget ([ROADMAP.md §10](./ROADMAP.md#10-approval-checklist-for-the-user)).
2. Update the Mac: macOS 26.5.1 → Tahoe 26.7.1, Xcode 26.0 → 27.1, then `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` ([SIDELOADING.md §2.1](./SIDELOADING.md#21-mac-and-xcode)).
3. Do the rest of the one-time setup ([SIDELOADING.md §2](./SIDELOADING.md#2-one-time-setup)).
