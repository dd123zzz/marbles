# Engineering Feedback on PRODUCT.md

Owner: Senior iOS engineer. Responds to [PRODUCT.md](./PRODUCT.md) (PM-owned, not edited here).
Related: [ARCHITECTURE.md](./ARCHITECTURE.md) · [EXPERIENCE.md](./EXPERIENCE.md) · [ROADMAP.md](./ROADMAP.md) · [SIDELOADING.md](./SIDELOADING.md)

Status: planning only. Claims about Apple or Firebase are linked, or marked **"unverified, check in spike I0"**.

## 1. Summary

The brief is buildable for $0. Five points need a decision or a correction before I1 starts:

1. **App Check enforcement (web PLAN 4.3) will lock the iOS app out.** A free Personal Team cannot use App Attest, and Firebase's DeviceCheck provider needs a private key from the paid account. Recommendation: **never enforce App Check** while the iOS client exists. This is a cross-client blocker (§3.1).
2. **Logging from a notification action** works, but not as a plain background Firestore write. It needs a server-confirmed transaction inside a few seconds of background time, plus a device-local queue as the fallback. Never write from the cache (§3.2).
3. **Password AutoFill** is degraded. Associated Domains is not available on a free team, so iOS can't tie saved passwords to the app (§3.3).
4. **"Respect the system haptics setting"**: there is no public API to read the System Haptics switch. The in-app toggle is the source of truth (§3.4).
5. **"Zero CPU at rest" vs. tilt and glass parallax**: tilt needs motion sampling while the jar is on screen. I propose a precise definition of "at rest" (§3.5).

## 2. What a free Personal Team can and cannot do (affects the brief)

Source: Apple's [Supported capabilities (iOS)](https://developer.apple.com/help/account/reference/supported-capabilities-ios) table, column "Apple Developer" (the free tier), and [About your developer account](https://developer.apple.com/help/account/basics/about-your-developer-account). The full matrix is in [ARCHITECTURE.md §12](./ARCHITECTURE.md#12-free-provisioning-capability-matrix).

| Brief item | Free team? | Consequence |
|---|---|---|
| Local notifications + action buttons | Yes (no entitlement needed) | P7 native lift is feasible |
| Push (APNs), Time Sensitive notifications | No | No server push. Notifications use the normal `.active` interruption level |
| Associated Domains | No | No universal links and no domain-bound password AutoFill or passkeys |
| Sign in with Apple, iCloud/CloudKit | No | Already excluded by C1 |
| App Attest | No | App Check can't attest the iOS app (§3.1) |
| App Groups, Keychain Sharing, Background Modes | Yes | Not needed. No extensions are planned (C5) |
| 7-day profiles, 3 apps per device, 10 App IDs per 7 days | Limits | Weekly re-sign; keep the bundle ID fixed; run UI tests on the Simulator only (a UI-test runner on a device costs an App ID and an app slot) |

## 3. Pushback and corrections

### 3.1 App Check: a cross-client blocker (affects C4)

- Web [PLAN.md 4.3](../PLAN.md) plans to **enforce** App Check (reCAPTCHA) on Firestore after 1–2 weeks of monitoring. Once enforced, every request without a valid App Check token is rejected.
- iOS options under C1:
  - **App Attest:** not available to the free tier ([capabilities table](https://developer.apple.com/help/account/reference/supported-capabilities-ios)).
  - **DeviceCheck provider:** Firebase requires a DeviceCheck private key created on the Apple developer site ([Firebase docs](https://firebase.google.com/docs/app-check/ios/devicecheck-provider)). Key creation needs the Account Holder or Admin role ([Apple](https://developer.apple.com/help/account/capabilities/create-a-devicecheck-private-key/)). Certificates, Identifiers & Profiles (where keys live) comes with Program membership ([Apple](https://developer.apple.com/help/account/basics/about-your-developer-account)). Treat it as unavailable: **unverified, check in spike I0** whether a free account can reach the Keys page at all.
  - **Custom provider:** needs a backend (Cloud Functions). Not allowed on Spark.
  - **Debug provider:** works on any device, but Firebase says never ship it in production ([docs](https://firebase.google.com/docs/app-check/ios/debug-provider)). The token comes from the `FIRAAppCheckDebugToken` env var (Xcode launches only) or is generated and stored in UserDefaults ([source](https://github.com/google/app-check/blob/main/AppCheckCore/Sources/DebugProvider/AppCheckCoreDebugProvider.swift)). Deleting the app creates a new token that must be registered again in the console, or the app is locked out.
- **Recommendation (A): keep App Check in monitor-only mode for Firestore and Auth. Do not enforce.** iOS does not link FirebaseAppCheck. The web keeps sending reCAPTCHA tokens (harmless).
  - Accepted risk: someone could use the public API key and their own account to burn the shared Spark quota. Worst case is a daily outage until the quota resets. There is no bill (Spark) and no data exposure (the rules already isolate users).
  - Cheaper mitigations: API key restrictions (web key by HTTP referrer, iOS key by bundle ID; [Firebase API keys](https://firebase.google.com/docs/projects/api-keys)). Optionally, disable new sign-ups in the Auth console once both clients are signed in (question N6). Whether that also blocks *Google* first-time sign-ins is **unverified, check in spike I0**.
- **Option B (only if the user insists):** enforce, and ship the debug provider in the iOS Release build with a per-install token registered by hand. This is fragile (lockout after a reinstall) and the token is a bearer secret on the phone. Not recommended.
- Web follow-up W3: put PLAN 4.3 step 6 ("enforce") on hold and record the decision in HANDOFF ([ROADMAP.md §8](./ROADMAP.md#8-web-side-follow-ups)).

### 3.2 Logging from a notification (P7, Q4)

What works:
- A non-foreground `UNNotificationAction` launches the app **in the background** and calls the delegate ([Apple](https://developer.apple.com/documentation/usernotifications/handling-notifications-and-notification-related-actions)). Background time is short: Apple documents about **five seconds** for backgrounding, extendable with `beginBackgroundTask` ([Apple](https://developer.apple.com/documentation/uikit/extending-your-app-s-background-execution-time)). Exact time for a notification-action launch: **unverified, check in spike I0**.

What does not work:
- **A cache write is unsafe.** The day doc is written with a full `set` (no merge), the same as the web. If the iOS cache lacks a doc the web wrote today, writing from the cache would erase the web's slots. This is exactly what the write gate prevents (AGENTS.md "never build a write from a partial cache").

Design:
1. The action runs a Firestore **transaction**: read D−1..D from the server, `planDrop`, write. It is one atomic commit, equivalent to the "one batch per action" rule. Timeout 4 s inside a `beginBackgroundTask`.
2. If it fails (offline, timeout, auth not restored), save a **pending intent** in UserDefaults (category, target slots, action time) and post a quiet local notification: "Saved on this iPhone. It syncs when you open Marbles." The intent is applied at the next launch through the normal gate, with `now` = the action time.
3. Actions use `.authenticationRequired` (Face ID or passcode before the action runs). This avoids Keychain and file-protection problems while locked, and stops anyone who picks up the phone from logging.

Corrections to the brief:
- **"Log the last hour" should mean the hour the notification names**, not `lastHourWindow(now)`. If a 14:00 reminder about 13:00–14:00 is answered at 14:50, `lastHourWindow` would log 14:00–15:00, which is wrong. Question N4.
- **We can't suppress a reminder for an hour already logged on the web.** Local notifications have no service extension hook (that is push-only). iOS cancels the pending reminder when an hour is logged on the phone, and reconciles web-logged hours at the next foreground. The copy must be neutral ("How was 13:00–14:00?"), not "still empty".
- **64 pending notifications per app.** The system keeps the soonest 64 (community-confirmed; Apple's statement is only in archived docs; **unverified, check in spike I0**). We schedule a rolling 48 h window of one-shot reminders (≤ 48), plus 1 re-sign warning. If the app isn't opened for 2 days, reminders stop, which fits "celebrate, don't nag" (question N8).

**Q4 answer:** yes, with the queued-intent design above (not "data is in the offline cache").

### 3.3 F1 password AutoFill

- Password AutoFill "recommends credentials only for your app's associated domain" ([Apple](https://developer.apple.com/documentation/security/password-autofill)). Associated Domains is paid-only.
- What remains: `textContentType(.username/.password)` and the QuickType key icon, so the user can pick a saved password by hand. No strong-password generation tied to the domain, and no passkeys.
- Google sign-in is unaffected: GoogleSignIn-iOS uses a web auth session plus the `REVERSED_CLIENT_ID` URL scheme, with no entitlement ([Firebase guide](https://firebase.google.com/docs/auth/ios/google-signin)).

### 3.4 Haptics and the system setting (fun layer #3)

- There's no public API to read Settings → Sounds & Haptics → System Haptics. Whether Core Haptics (`CHHapticEngine`) is muted by that switch is **unverified, check in spike I0** (community reports say it is not).
- Plan: small UI ticks use SwiftUI `sensoryFeedback` (system feedback, which follows the system). Collision haptics use Core Haptics and follow the **in-app Haptics toggle** (default on).

### 3.5 "Zero CPU at rest" vs. tilt and parallax (fun layer #1 and #5)

- The physics loop and rendering can truly stop. The world sleeps, the render timeline pauses, and the clock fires only at :00/:15/:30/:45.
- Tilt needs Core Motion sampling while the Day jar is visible. Proposed definition:
  - **At rest = app in the background, jar off screen, or tilt off → 0% CPU.**
  - **Tilt on and phone still → ≤ 2% CPU** (30 Hz motion sampling, rendering paused). Measure in spike I0.
- Glass parallax tied to tilt uses the same motion stream. When tilt is off, parallax is a one-shot shimmer on appear, not continuous.

### 3.6 Smaller corrections

| Brief text | Issue | Proposal |
|---|---|---|
| §5 "renders identically" | The Loose jar is random by design | "Identical" = the same `computeMarbles` output per hour (colors, halves, labels), the same Grid layout, the same stats and export bytes. Golden fixtures enforce this ([ARCHITECTURE.md §5](./ARCHITECTURE.md#5-cross-client-fidelity)). |
| P7 `.ics` | Native notifications replace it | **Dropped on iOS (user, N8).** The web keeps it. |
| P2 "manual override synced via `theme`" | Changing it on iOS also changes the web | Fine, but confirm (question N9). |
| P6 share card | Loose layout varies | The share card uses the Grid layout (like the web). "Share as you see it" is a **Could**. |
| F5 "static thumbnails" | Agreed | Thumbnails are cached per (date, slots, sleep, theme). |
| §5 cold launch < 1.0 s | Firebase init cost | Achievable with cached data. Measure in I0 and I4. |
| Fun metric | Qualitative only | Keep it qualitative. Do one check-in with the user after a week. No analytics (adding them would add data). |
| Distribution | Only the user's own devices | Friends would need their own Mac and Xcode. State this in the README. |

## 4. Answers to Q1–Q5

| # | Answer | Notes |
|---|---|---|
| Q1 Default jar style | **Loose** on iOS, if spike I0 passes its gate | Reduce Motion forces Grid. One-tap Tidy. Grid stays in Settings. The Loose jar holds every started hour, gray included (web user decision 5). |
| Q2 Minimum iOS | **iOS 26.0**, built with Xcode 27 (iOS 27 SDK) | Firebase 13 and GoogleSignIn 10 need iOS 15. Shaders and Observation need 17. Liquid Glass `glassEffect` needs 26 ([Apple](https://developer.apple.com/documentation/swiftui/view/glasseffect(_:in:))). iOS 27 runs on iPhone 11 and later ([Apple](https://support.apple.com/guide/iphone/iphone-models-compatible-with-ios-27-iphe3fa5df43/ios)), so 26 also covers A12 phones (XR/XS) at little cost; the iOS 26 device list is **unverified, check in spike I0**. No iOS 27-only API is needed. Details in [ARCHITECTURE.md §1](./ARCHITECTURE.md#1-stack-and-minimum-ios). |
| Q3 Sound default | **Off**, with an onboarding prompt. Haptics **on**. | Audio uses the `.ambient` session, so the silent switch mutes it. |
| Q4 "Saved, will sync" | **Yes**, via a queued intent, never a cache write | §3.2 |
| Q5 Weekly re-sign | **Yes**, with an expiry notification 24 h before plus an in-app banner | SideStore/AltStore are not recommended; see [SIDELOADING.md §6](./SIDELOADING.md#6-auto-refresh-tools-evaluated) |

## 5. New questions for the user

Answered; see [§6](#6-user-answers-2026-10-18).

| # | Question | Recommendation |
|---|---|---|
| N1 | Which iPhone (model, iOS version) and which Mac (model, macOS version)? Xcode 27 reportedly needs macOS Tahoe 26.6+ (**unverified, check in spike I0**). Firebase 13 needs Xcode 26.2+ ([release notes](https://firebase.google.com/support/release-notes/ios)). | Needed before I0 |
| N2 | App Check: never enforce (A) or enforce with a debug token on iOS (B)? | **A** |
| N3 | Are other free-team sideloaded apps on the phone? There's a 3-app limit. | Need at least 1 free slot |
| N4 | Notification action: log the hour named in the notification, or `lastHourWindow` at tap time? | **The named hour** |
| N5 | Require unlock (Face ID) to log from a notification on the lock screen? | **Yes** |
| N6 | Turn off new sign-ups in the Firebase Auth console as cheap abuse protection? This affects F1 sign-up on both clients. | Yes, after both clients are signed in, if I0 confirms Google sign-in still works |
| N7 | Bundle ID `io.github.dd123zzz.marbles`? Changing it later costs an App ID and a Firebase re-registration. | Yes |
| N8 | Reminders schedule 48 h ahead and stop if the app isn't opened for 2 days. OK? | Yes |
| N9 | Theme stays synced across clients (current `theme` field), or add a device-only override? | Synced (parity, no new data) |

## 6. User answers (2026-10-18)

All of N1–N9 are answered. Nothing blocks I0 except the Mac updates in the N1 row.

| # | Answer | Effect on the plan |
|---|---|---|
| N1 | **iPhone 16** on the latest iOS (27.x). **MacBook with an Apple M3, 86 GB free.** Checked 2026-10-18: **macOS 26.5.1, Xcode 26.0 (17A324)**, iOS 26.0 SDK, and `xcode-select` pointing at the Command Line Tools. | The Mac must be updated before I0. The current release is **Xcode 27.1 (27A9275, 2026-10-15, iOS 27.1 SDK), which needs macOS 26.6+** ([xcodereleases.com](https://xcodereleases.com/)). Xcode 26.0 can't install on an iOS 27 phone and is below Firebase 13's Xcode 26.2 floor. Steps are in [SIDELOADING.md §2.1](./SIDELOADING.md#21-mac-and-xcode). The iPhone 16 (A18) has a **60 Hz** display, so 120 fps isn't relevant. All performance budgets are measured on this phone. The minimum iOS stays **26.0**. |
| N2 | **A: never enforce App Check.** | iOS doesn't link FirebaseAppCheck. The web keeps its monitor-only reCAPTCHA (shipped in Stage 4). Web PLAN 4.3 step 6 ("enforce") is **cancelled** (web follow-up W3). |
| N3 | **No other free-team apps.** | Marbles has a slot; 2 slots stay spare (the spikes reuse the main bundle ID anyway). |
| N4 | **The named hour.** | As designed in §3.2 |
| N5 | **Yes, require unlock.** | Actions use `.authenticationRequired` |
| N6 | **Yes, turn off sign-ups.** | Verified caveat: the console's "Enable create (sign-up)" switch blocks only new **email/password and anonymous** accounts (error `auth/admin-restricted-operation`). **First-time Google sign-ins still create users**; blocking those needs Identity Platform blocking functions, which aren't free-tier ([Google Cloud](https://docs.cloud.google.com/identity-platform/docs/blocking-functions)). It's still worth doing as partial protection. User step in [SIDELOADING.md §2.4](./SIDELOADING.md#24-firebase-free-on-spark), after both clients are signed in. Both clients map the error to friendly copy ("New sign-ups are closed"); this is web follow-up W8, copy only. |
| N7 | **Simpler bundle ID: `com.dd123zzz.marbles`.** | Used everywhere. If Xcode reports it taken, fall back to `com.dd123zzz.marblesjar` before Firebase registration. |
| N8 | **"Push notifications, not calendar notifications"**, and yes, stop reminders if the app isn't opened. | The plan already uses **real system notifications** (banner, lock screen, sound, action buttons), not calendar events. They're *local* notifications, scheduled on the phone. True *remote* push (APNs) needs the $99 program and a server sender, both ruled out by C1 and Spark, and isn't needed for hourly reminders. **The `.ics` calendar export is dropped from iOS** (it stays on the web). The rolling 48 h window, which stops after 2 days unopened, is confirmed. |
| N9 | **Synced.** | The `theme` field in the settings doc is shared by both clients |
