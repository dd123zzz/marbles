# Marbles for iPhone: Handoff

Last updated: 2026-10-18 23:58 PT. Read this first when resuming iOS work. The project-wide running log stays in [../HANDOFF.md](../HANDOFF.md) (rows 10, 12, 13 are iOS).

## 1. Where things stand

| Area | State |
|---|---|
| Planning | **Approved** by the user (budget included). Docs: [README](./README.md) · [PRODUCT](./PRODUCT.md) · [ENGINEERING_FEEDBACK](./ENGINEERING_FEEDBACK.md) (N1–N9 answered in §6) · [ARCHITECTURE](./ARCHITECTURE.md) · [EXPERIENCE](./EXPERIENCE.md) · [ROADMAP](./ROADMAP.md) · [SIDELOADING](./SIDELOADING.md) |
| Code | **Host-testable Swift packages only.** No Xcode project, app target, UI, Firebase, or device build yet. |
| Tests | MarblesCore **158**, MarblesPhysics **10**, MarblesData **19**, all green with Xcode 26.0. Web: 573 tests, lint and format green. |
| Cross-client fidelity | Golden fixtures from the real TS code in 4 zones. 0 hard mismatches. See §4 for the known divergence. |
| Git | Local `main` is **17 commits ahead of `origin/main`. Not pushed.** Range `c792451..7229c38`. |
| Mac | Apple M3, **macOS 26.5.1, Xcode 26.0 (Swift 6.2)**, 86 GB free. `xcode-select` still points at the Command Line Tools. **The user will update at the end** (to macOS Tahoe 26.7.1 + Xcode 27.1). |
| Phone | iPhone 16 on iOS 27.x. Xcode 26.0 **cannot** deploy to it. |
| Credits | ≈ 1,530 cumulative (planning ≈ 230; sprint 1 ≈ 230; sprint 2 ≈ 60; plus the earlier web stages). The iOS build budget is ≈ 1,235, approved. |

## 2. What landed (sprints 1–2, 2026-10-18)

| Path | Contents | Roadmap item |
|---|---|---|
| `ios/Packages/MarblesCore` | `Types.swift` (the contract, mirroring `src/types.ts`, plus `TimeContext`), `Time/` (incl. `lastHourWindow`, JS-identical DST wall-time normalization), `Jar/`, `Stats/`, `Labels/`, `Entries/` (incl. `planDrop`/`undoDrop`, logical midnight entries, UTF-16 truncation), `Export/` (CSV byte-exact, a hand-rolled JSON emitter matching `JSON.stringify(_, null, 2)`), `Forms/` (log-sheet logic, `sleepHours`, `withSleep`) | I1 wave A1 + B1 (ahead of plan) |
| `ios/Packages/MarblesPhysics` | `JarWorld` protocol, `SwiftSolverWorld` (a faithful port of `src/lib/physics`), `JarGeometry` (188×314, colliders, `marblePosition`), `Mulberry32` + `seedLayout`. Presettle ≈ 88 ms on the Mac, sleep after ~68 substeps, max penetration 0.075, deterministic, no escapes. **Box2D is not attempted yet.** | I2 A1 fallback path, part of I0.6 |
| `ios/Packages/MarblesData` | `DayDocCodec` (encode/decode; `ServerTimestamp.marker` stands in for `updatedAt`), `WriteValidator` mirroring `validDay`/`validSettings`. No Firebase dependency yet. | I1 A2, partial |
| `scripts/golden/**`, `ios/Fixtures/golden/**` | `npm run golden` writes 21 JSON files (time, jar, entries, stats, export × 4 zones, plus geometry) and is deterministic | I0.4 / web W1 |
| `ios/.gitignore`, `ios/.swift-format`, `.github/workflows/ios.yml` | CI: `swift test` for all 3 packages on `macos-latest`, plus a golden staleness job on Ubuntu (it triggers on `src/lib/**` and `scripts/golden/**` too) | I0.2 partial, I0.3 |
| `.prettierignore` | Ignores `ios/Fixtures/golden` and `.build` (without this, the web `format:check` failed) | — |
| `PLAN.md` 4.3, root `HANDOFF.md` Decisions | **App Check is never enforced** (user N2); the step-6 enforce is cancelled | web W3 |

Not touched: `src/**`, `firestore.rules`, Firebase or GitHub settings.

## 3. How to verify (copy-paste)

```sh
cd /Users/danieldai/repos/marbles
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer   # until xcode-select is fixed
for p in MarblesCore MarblesPhysics MarblesData; do
  swift test --package-path ios/Packages/$p --scratch-path ios/.build/$p
done
rm -rf ios/.build
npm test && npm run lint && npm run format:check
npm run golden && git diff --exit-code ios/Fixtures/golden   # fixtures must be stable
```

Environment gotchas learned this session:
- **`/tmp` writes are blocked for agents.** Use `--scratch-path ios/.build/<name>` (gitignored) and delete it afterwards.
- **Parallel agents on one package:** give each its own scratch path, or the SwiftPM `.build` lock serializes them.
- **`Category` clashes with Foundation's `Category`.** Write `MarblesCore.Category` wherever Foundation is imported (tests already do).
- The packages use `swift-tools-version: 6.2` with platforms `.iOS(.v26)` and `.macOS(.v15)`.

## 4. Known issues (open, ordered by priority)

| # | Issue | Where | Suggested fix | Needs new Xcode? |
|---|---|---|---|---|
| K1 | **`undoDrop` parity gap.** When an undo is a no-op for a touched day, the web returns that day's doc and Swift returns `[:]`. 10 fixture cases per zone. The test counts them as "known divergence", so it does **not** fail. | `MarblesCore/Entries/Entries.swift` (`collectChanged`, `normalizeNotes`/`sameDoc` path) | Match the TS `collectChanged`/`sameDoc` semantics, then turn the divergence allowance into a hard assertion | No |
| K2 | **12 `planDrop` fixture cases per zone are skipped.** The generator drops `targets` (`undefined` is dropped by `JSON.stringify`). | `scripts/golden/data.golden.ts` | Serialize `targets` explicitly, regenerate, and remove the skip | No |
| K3 | **`WriteValidator` accepts an empty `reflection`.** W-6 says to omit the key when it's empty. | `MarblesData/WriteValidator.swift` | Reject `reflection == ""` | No |
| K4 | **The codec's trim strips U+0085**; JS `trim()` keeps it | `MarblesData/DayDocCodec.swift` | Use the JS whitespace set (MarblesCore already has one in Entries) | No |
| K5 | **The entries unit tests are a condensed port.** `drop.test.ts` (232 lines) and the logical tests are only partly ported. The golden fixtures cover much of it. | `MarblesCoreTests/EntriesExportFormsTests.swift` | Port the remaining TS cases | No |
| K6 | **CI `macos-latest` may not have Swift 6.2.** Unverified, never run (not pushed). | `.github/workflows/ios.yml` | Pin a runner image or select an Xcode version, and confirm on the first push | No |
| K7 | Note-key check (`"0"…"47"`) is **stricter than the rules** (the rules don't check keys) | MarblesData | Intended (W-3). Keep it. | — |

## 5. Blocked until the Mac is updated

The user said they will update at the end. Steps are in [SIDELOADING.md §2.1](./SIDELOADING.md#21-mac-and-xcode):
1. macOS 26.5.1 → **Tahoe 26.7.1** (`sudo softwareupdate -i "macOS Tahoe 26.7.1-25G241" -R`).
2. Xcode 26.0 → **27.1** (Mac App Store).
3. `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer && xcodebuild -runFirstLaunch`.
4. Install the iOS 27.1 platform (Xcode → Settings → Components).
5. The rest of the one-time setup: Personal Team, Developer Mode on the iPhone 16, register **`com.dd123zzz.marbles`** in Firebase, the plist to `ios/Config/` (gitignored), restrict the iOS API key.

Unblocked by that:
- I0.2 Xcode project + app target.
- I0.5 Firebase spike (Firebase 13 needs Xcode ≥ 26.2).
- I0.6 Box2D + device physics spike.
- I0.7 notifications spike.
- The Simulator CI build.
- Every device check.

## 6. Next steps

**A. Doable now, on Xcode 26.0 (one parallel wave, disjoint paths):**

| Agent | Owns | Task |
|---|---|---|
| Sonnet | `MarblesCore/Sources/MarblesCore/Entries/**` + `GoldenEntriesExportTests.swift` | K1, then make the golden test strict |
| Sonnet | `scripts/golden/**`, `ios/Fixtures/golden/**` | K2; regenerate; confirm `npm test` |
| Sonnet | `ios/Packages/MarblesData/**` | K3, K4; then the `Repo` protocol + `MemoryRepo` + `WriteGate` (W-11/W-12) as pure Swift, porting `memoryRepo.test.ts` and `useWriteGate.ts` |
| Sonnet | `ios/Packages/MarblesPhysics/**` | Try Box2D v3.2.0 via SPM behind `JarWorld` (≤ 0.5 day gate); keep `SwiftSolverWorld` as the fallback |
| Sonnet | `MarblesCoreTests/Entries*Tests.swift` (new files only) | K5: port the remaining TS entries/drop/logical tests |
| Opus lead | — | Review against TS, integrate, run all suites, update this file + HANDOFF row |

**B. Right after the Mac update (follow [ROADMAP.md](./ROADMAP.md) I0 → I1):**
1. I0.2: Haiku scaffolds `ios/Marbles.xcodeproj` (synchronized folders; schemes `Marbles` and `Marbles-Demo`; SPM: the 3 local packages, Firebase 13 Auth+Firestore, GoogleSignIn 10).
2. I0.5 / I0.6 / I0.7 spikes in parallel (Firebase on device, physics feel and haptics, notification actions + `embedded.mobileprovision` expiry).
3. Close I0: clear every "unverified, check in spike I0" marker in the docs.
4. I1 waves B–C: app shell + auth/settings, Day view (Grid), week/month/stats/export/share, reminders. Then I2 (Loose jar, flick-to-log, shaders, haptics), I3 (rituals), I4 (hardening).

**C. Before pushing** (pushing `main` deploys the web to Pages):
- Ask the user first (AGENTS.md).
- The push includes web-visible changes: `package.json` (`golden` script), `.prettierignore`, the new `ios.yml` workflow, and docs. No `src/**` change, so the deployed web app is functionally identical.
- Watch the first `ios.yml` run for K6.

## 7. Decisions to keep (don't reopen)

$0 strictly (free Personal Team, weekly re-sign) · iPhone only · web stays live · **no data-model or rules change** · App Check never enforced · minimum iOS 26.0 · test device iPhone 16 (60 Hz) · bundle ID `com.dd123zzz.marbles` · reminders are **local system notifications** (no `.ics`, no remote push), they log **the named hour**, need unlock, and stop after 2 days unopened · theme synced via settings · sign-ups turned off after both clients are signed in (blocks email sign-ups only; Google first-time sign-in still creates users) · Loose jar by default (Grid under Reduce Motion) · sound off by default, haptics on. Full table in [PRODUCT.md §8](./PRODUCT.md#8-pm-decisions-after-engineering-review-2026-10-18) and [ENGINEERING_FEEDBACK.md §6](./ENGINEERING_FEEDBACK.md#6-user-answers-2026-10-18).

## 8. Working model that worked

- **PM/orchestrator** (main agent): plans and delegates; writes docs, not app code.
- **Opus 5.5 lead**: reviews while the coders work, then takes over at the deadline to integrate, fix, update the logs, and commit.
- **Sonnet 5.5** for logic; **Haiku 5.5** for config.
- Every agent has disjoint path ownership, a hard wall-clock stop, its own scratch path, commits only its own paths (retrying on `index.lock`), and never pushes.
- Prompts are self-contained and list: files to read, owned paths, verify command, commit message + Co-authored-by trailer, "report concisely".
- The contract (`Types.swift`) is created first by one agent; the others poll for it and code against it.
