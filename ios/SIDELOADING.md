# Marbles for iPhone: $0 Sideloading and Ops Playbook

Owner: Senior iOS engineer. Related: [ARCHITECTURE.md](./ARCHITECTURE.md) · [ROADMAP.md](./ROADMAP.md) (task I0.1) · [ENGINEERING_FEEDBACK.md](./ENGINEERING_FEEDBACK.md) (Q5).
Distribution is a free Personal Team in Xcode only. No Apple Developer Program, TestFlight, or App Store (PRODUCT C1).

## 1. Limits of a free Personal Team

Source: Apple, [About your developer account](https://developer.apple.com/help/account/basics/about-your-developer-account), unless noted.

| Limit | Value | What it means for Marbles |
|---|---|---|
| Provisioning profile lifetime | **7 days** | Re-sign weekly (§3) |
| Apps per device | **3** | Marbles uses 1 slot. No other free-team apps are installed (user, N3). |
| App IDs | **10, which expire after 7 days** | Keep **one** fixed bundle ID. UI tests run on the Simulator only (a device UI-test runner is another app). |
| Devices | **3**, expiring after 7 days | The user's iPhone |
| Capabilities | Free column of [Supported capabilities](https://developer.apple.com/help/account/reference/supported-capabilities-ios) | No push, Associated Domains, App Attest, iCloud, or Sign in with Apple ([ARCHITECTURE §12](./ARCHITECTURE.md#12-free-provisioning-capability-matrix)) |
| Developer Mode | Required on the iPhone ([Apple](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device)) | One-time toggle and restart |
| Who can install | Only devices you plug into your Mac | Friends need their own Mac and Xcode |

## 2. One-time setup

Owner: the user (task I0.1). About 45 minutes. Agents don't change Firebase or Apple settings.

### 2.1 Mac and Xcode
Checked on this Mac (2026-10-18): Apple M3, **macOS 26.5.1**, **Xcode 26.0** (17A324), `xcode-select` pointing at `/Library/Developer/CommandLineTools`, and 86 GB free. The iPhone 16 runs iOS 27.x, so the Mac needs these updates first:

1. **Update macOS to Tahoe 26.7.1:** System Settings → General → Software Update, or `sudo softwareupdate -i "macOS Tahoe 26.7.1-25G241" -R`. This requires a restart and is about 3.9 GB. Xcode 27.1 needs **macOS 26.6+** ([xcodereleases.com](https://xcodereleases.com/)). Staying on Tahoe is lower risk than the macOS 27.0.1 major upgrade that's also offered. Either works.
2. **Update Xcode to 27.1** (27A9275, released 2026-10-15, iOS 27.1 SDK) from the Mac App Store. It's free; budget about 15 GB plus the iOS platform download. Xcode 26.0 can't deploy to an iOS 27 phone and is below Firebase 13's Xcode 26.2 floor ([release notes](https://firebase.google.com/support/release-notes/ios)).
3. **Point the command-line tools at Xcode:** `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`, then `xcodebuild -runFirstLaunch`. Verify with `xcodebuild -version`, which should show Xcode 27.1.
4. **Install the iOS 27.1 platform and simulator:** Xcode → Settings → Components, or `xcodebuild -downloadPlatform iOS`. The old iOS 17.x/18.6 simulator runtimes can be deleted to reclaim space.
5. Xcode → Settings → Accounts → **+** → Apple Account. Xcode shows "*Your Name* (Personal Team)".

### 2.2 iPhone
1. Connect with a cable and tap **Trust This Computer**.
2. Settings → Privacy & Security → **Developer Mode** → on → Restart → confirm ([Apple](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device)). The switch appears only after the device has been paired with Xcode.
3. After the first install, trust the developer certificate if iOS asks: Settings → General → VPN & Device Management → *your Apple ID* → Trust. The exact menu path on iOS 26/27 is **unverified, check in spike I0**.
4. Optional: in Xcode's device window, enable "Connect via network" so later re-signs work over Wi-Fi (**unverified, check in spike I0**).

### 2.3 Bundle ID
- Use **`com.dd123zzz.marbles`** (user, N7: "keep it simple"). It must be unique across all Apple teams; Xcode reports a clash immediately. If it's taken, use `com.dd123zzz.marblesjar` **before** registering in Firebase.
- **Never change it.** A change costs an App ID (10 per week), means a new Firebase app registration, a new plist, a new API-key restriction, and a fresh install (local data and session lost; Firestore data is safe).

### 2.4 Firebase (free on Spark)
1. Firebase console → project `marbles-life` → Project settings → **Add app → iOS**. Enter the bundle ID from 2.3. App nickname: "Marbles iOS". No App Store ID.
2. Authentication → Sign-in method: Google and Email/Password are already enabled for the web. Re-download the plist **after** confirming Google is on, so it contains `CLIENT_ID` and `REVERSED_CLIENT_ID` ([Firebase](https://firebase.google.com/docs/auth/ios/google-signin)).
3. Download **`GoogleService-Info.plist`** to `ios/Config/GoogleService-Info.plist`.
4. **App Check:** register nothing for iOS, and **never enforce** it (user, N2; web follow-up W3). The web's monitor-only reCAPTCHA stays as it is.
5. **Turn off new sign-ups** (user, N6), but only **after** you are signed in on both the web and the iPhone: Authentication → Settings → User actions → uncheck **Enable create (sign-up)**.
   - This blocks only new **email/password** (and anonymous) accounts. **First-time Google sign-ins still create users**; blocking those needs paid Identity Platform functions.
   - Existing accounts are unaffected.
   - Reversible at any time.

### 2.5 `GoogleService-Info.plist` handling
- It is **not secret-grade.** Firebase API keys identify the project; access is controlled by Security Rules ([Firebase API keys](https://firebase.google.com/docs/projects/api-keys)). The same values already ship inside the public web bundle.
- **Still keep it out of git**: the repo is public, and it saves key-rotation churn. Planned `ios/.gitignore` entry (created in I0.2): `Config/GoogleService-Info.plist`.
- CI builds the **Demo** scheme, which needs no plist.
- To back it up, re-download it from the Firebase console at any time.

### 2.6 Restrict the iOS API key
Google Cloud console → APIs & Services → Credentials → "iOS key (auto created by Firebase)":
- **Application restrictions:** iOS apps → add `com.dd123zzz.marbles`.
- **API restrictions:** leave the Firebase-managed allowlist ([Firebase API keys](https://firebase.google.com/docs/projects/api-keys)).
- Keep the web key's HTTP-referrer restriction as it is (PLAN 2.0g).
- Caveat: the bundle-ID restriction is header-based and only raises the bar. Real protection is the rules.

## 3. Weekly re-sign ritual

Baseline: **re-run from Xcode**. About 2 minutes, once a week, at a fixed time (suggestion: Sunday evening).

1. Connect the iPhone (cable, or Wi-Fi if 2.2.4 works) and unlock it.
2. Open `ios/Marbles.xcodeproj`, choose the **Marbles** scheme and your iPhone.
3. **Product → Run (⌘R).** Xcode renews the profile and installs over the existing app.
4. Check: open Marbles → Settings → About shows "Re-sign by" 7 days ahead. The jar shows today with no sign-in prompt.

Notes:
- **Don't delete the app first.** Installing over it keeps the data container and Keychain (§5).
- **If the deadline passes,** the app won't open. Nothing is lost: run step 3 again. Meanwhile, log on the web (same data).
- If you use multiple Macs, use the same Apple ID on each so the Personal Team (and the Keychain access group) stays the same.

## 4. In-app expiry warning

**How it works:**
- Development builds embed `embedded.mobileprovision` in the app bundle (Apple [TN3125](https://developer.apple.com/documentation/technotes/tn3125-inside-code-signing-provisioning-profiles)). It is a CMS-signed plist with an `ExpirationDate`.
- At launch, `ProvisioningService` reads the file, extracts the XML plist between `<?xml` and `</plist>`, and parses `ExpirationDate`. No signature check is needed (we read only, and trust the file in our own bundle).
- Reading it at runtime on iOS 26/27 is **unverified, check in spike I0** (task I0.7).
- **If the file is missing** (Simulator, or a future distribution change), hide every expiry UI.

**Behavior:**

| When | Behavior |
|---|---|
| Every launch and foreground | Store the expiry date. Reschedule one local notification `resign-warning` for **expiry − 24 h** (1 of the 64 pending slots). |
| Expiry − 24 h | Notification: "Marbles needs a re-sign by Sat 21:10. Connect your iPhone and press Run in Xcode." |
| < 48 h left | A thin banner on the Day view: "Re-sign by Sat 21:10", dismissible for 12 h |
| Always | Settings → About: "Re-sign by Sat Oct 24, 21:10" |
| After a re-sign | The date moves; the banner and pending warning are replaced |

The warning never touches Firestore (device-only, no data-model change).

## 5. What survives what

| Event | App data container (UserDefaults, Firestore cache, pending intents) | Keychain (Firebase Auth session) | Firestore data |
|---|---|---|---|
| Weekly re-sign (Run over the existing app, same Apple ID and bundle ID) | Kept | Kept | Kept |
| Profile expired, then Run again | Kept (**unverified, check in spike I0**) | Kept (**unverified, check in spike I0**) | Kept |
| App deleted, then reinstalled | **Lost**: prefs, cache, and unsent pending intents | May persist or be removed (**unverified, check in spike I0**); the app tolerates both | Kept (server) |
| Different Apple ID / Personal Team | New app identity: container lost | New access group: sign in again | Kept |
| Bundle ID changed | New app: everything local lost | Sign in again | Kept |

Rules that follow:
- **Never delete the app to "fix" something** while offline writes or pending intents are unsent.
- Sync first: open the app online and wait for the tray to stop showing "Syncing…".

## 6. Auto-refresh tools evaluated

| Option | How it works | Setup | Reliability | Security | Verdict |
|---|---|---|---|---|---|
| **Xcode re-run** (baseline) | You press Run weekly | None beyond §2 | High | Apple ID stays in Xcode | **Recommended** |
| **AltStore Classic** ([FAQ](https://faq.altstore.io/altstore-classic/your-altstore)) | AltServer on the Mac re-signs over Wi-Fi in the background | AltServer on the Mac (plus a Mail plug-in, per guides); same Wi-Fi; AltStore uses 1 of 3 app slots | Medium: needs the Mac awake on the same network | Apple ID credentials go to AltServer | Not recommended |
| **SideStore** ([FAQ](https://docs.sidestore.io/docs/faq)) | On-device re-sign using a pairing file and the LocalDevVPN loopback VPN; computer needed once | Pairing file, VPN app, an anisette server; SideStore uses 1 of 3 slots; also limited to 10 App IDs per week | Medium: anisette-server downtime is a known login failure | Apple ID password used by a third-party app and an anisette server (risk of account lock); use a secondary Apple ID | Not recommended for now |
| Paid program ($99) | 1-year profiles, TestFlight | — | High | — | Violates C1 |

Extra risks specific to Marbles with AltStore or SideStore:
- These tools sign IPAs, not Xcode projects. A free team can't do a normal "Archive → Export" for distribution, so we would hand-pack an IPA (**unverified, check in spike I0**).
- They reportedly **append a suffix to the bundle ID** ([SideStore issue #233](https://github.com/SideStore/SideStore/issues/233)). A changed bundle ID breaks the Firebase app registration, the iOS API-key restriction, and Keychain continuity. Re-registering for the suffixed ID is possible but means duplicate setup.
- Revisit only if the weekly Xcode run turns out to be a real burden.

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "Unable to install: maximum number of apps for free development profiles" | 3-app limit | Delete another free-team app (not Marbles) |
| "Maximum App ID limit reached" | 10 App IDs per 7 days | Wait for the oldest to expire; don't change the bundle ID |
| "Failed to register bundle identifier" | ID already taken by another team | Pick a new ID before Firebase setup only |
| App icon opens, then closes immediately, or "no longer available" | Profile expired | Run from Xcode (§3) |
| "Untrusted Developer" | Certificate not trusted | Settings → General → VPN & Device Management → Trust |
| Xcode: "Developer Mode disabled" | Toggle off or never set | §2.2 step 2 |
| Google sign-in sheet errors with "invalid client" | Plist downloaded before Google was enabled, or the URL scheme is missing | Re-download the plist; check that `REVERSED_CLIENT_ID` is in URL Types |
| Firestore `PERMISSION_DENIED` | A write shape mismatch (a bug), or App Check got enforced | Check the [write checklist](./ARCHITECTURE.md#6-data-layer-and-write-semantics); check the App Check console (must be unenforced) |
| `API key not valid` / blocked | iOS key restriction has the wrong bundle ID | Fix the restriction (§2.6) |
| Reminders stopped | App not opened for 2 days (rolling 48 h window), or permission revoked | Open the app; check Settings → Notifications |
| Signed out after a reinstall | Keychain cleared | Sign in again; data is in Firestore |
| "New sign-ups are closed" (`admin-restricted-operation`) on email sign-up | Sign-ups turned off (§2.4 step 5) | Use an existing account, or re-enable the switch temporarily |
| Xcode: "iOS 27.x is not installed" / the device shows as unsupported | Xcode older than the phone's iOS | Update Xcode (§2.1), then install the iOS platform |
| "Saved on this iPhone" didn't sync | A pending intent waits for the gate | Open the app online and wait for "Syncing…" to clear |
