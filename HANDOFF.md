# Handoff Log

Running log, updated roughly every 100 AI credits spent (see [model_rate.md](./model_rate.md)). Credit figures are estimates from token volume.

## Decisions (beyond SPEC/PLAN)
- Sleep color: indigo `#4f46e5`. Sleep is excluded from "awake %" stats.
- No Java on the dev machine, so the Firestore emulator can't run locally. Rules tests are written and will run in CI (which has Java).
- `@firebase/rules-unit-testing@^6` (v5 needs firebase 12). Settings rule fields are optional but validated, and `v==1` is required.
- No Firebase project yet. `.env.local` holds placeholders. **Demo mode** (`VITE_DEMO=true`) swaps in fake auth and an in-memory repo so the UI can be exercised locally.
- Saves wait for a server-confirmed snapshot (not cache-only), unless offline or after a 4s grace period. This prevents overwriting real docs from a partial cache.
- Tapping a marble in the current hour clamps the default duration so it doesn't run into the future.
- Rules deploy runs in `ci.yml` only after the `check` and `rules` jobs pass, and only when `firestore.rules`/`firebase.json` change. A manual `deploy-rules.yml` (workflow_dispatch) also exists.
- Future slots render as empty, even inside the sleep window (precedence: logged > future → empty > sleep > unlogged gray).
- A slot is loggable once it has started (slot start ≤ now).
- The sleep window applies within each calendar day, wrapping (23:00–07:00 means 00:00–07:00 and 23:00–24:00 on each day).
- Stage 2 visual direction (user choice): soft and friendly (glass jar, glossy marbles, warm off-white) with a bottom tab bar.
- Local `.env.local` is now real Firebase (`VITE_DEMO=false`). For agent smoke tests, run `VITE_DEMO=true npm run dev`.
- GitHub setup is deferred until after Stage 1 (user request): the CI workflow is written but not pushed.

## Progress
| # | Update | Est. credits (cumulative) |
|---|---|--:|
| 0 | Plan + rate table, kickoff | 6 |
| 1 | Stage 0 local parts done: scaffold (Vite 8, React 19, RR 7, firebase 13, Vitest 5); `src/lib` time/jar/entries (152 tests); auth (Firebase popup + demo), repo (Firestore + in-memory demo), `firestore.rules` + rules tests (not run locally, no Java), CI and deploy workflows (not pushed). Next: Stage 1 UI (1.5–1.9). | ~98 |
| 2 | Stage 1 UI built (1.5–1.9): Day jar, 2-tap LogSheet, edit/delete, date nav, Week/Month, Settings. Code review found 3 issues, all fixed (cache-snapshot overwrite, sleep snapshot before settings load, ungated rules deploy). 186 tests; lint/typecheck/build green. Browser smoke test in demo mode passed: 2-tap log, midnight split, half marbles, notes, overwrite confirm, week/month nav, week-start toggle. | ~247 |
| 3 | Deployed: repo `dd123zzz/marbles`, Firebase project `marbles-life`. First CI run green: check, rules (34/34 rules tests), Pages deploy, rules deploy. Live at https://dd123zzz.github.io/marbles/. Real-device checks passed. Carryover moved to Stage 2; AGENTS.md added. | ~265 |
| 4 | Stage 2 wave 1: docs fixes (2.0a/b); midnight-crossing entries edit as one + day reflection (2.0c, 2.4); stats view + CSV/JSON export with `Repo.getDays` (2.3, 2.5); PWA with update prompt + icons (2.6). 247 tests green. Next: wave 2 = design pass + dark mode + keyboard halves + toast (2.1, 2.2, 2.0d, 2.0e). | ~420 |
| 5 | Stage 2 wave 2: soft visual design, bottom tab bar, bottom-sheet log form with in-sheet confirms, toasts (2.0e), keyboard targets per marble half (2.0d), dark mode with theme setting (2.2). 270 tests green. Browser smoke test passed in light and dark. Next: code review → fixes (incl. Log time button overlapping Entries on short screens, manifest colors). | ~544 |
| 6 | Stage 2 code complete locally. Review found 2 bugs (joined midnight note lost on edit; focus not restored to SVG marble openers), both fixed. Log time button moved in-flow under the jar; manifest colors match tokens. 274 tests; lint/typecheck/format/build green. Not yet pushed. | ~600 |
| 7 | Stage 3 wave A, run in parallel (user choices: 24h numbers, sleep chip sheet with "make default", share text on, notifications opt-in, auto-push once green): hour numbers on day-jar marbles + drop/pop animation with reduced-motion fallback (3.5, 3.1); per-day sleep sheet (3.6) + canvas share image for day and week with share/download fallback (3.2); unlogged banner + opt-in hourly notification + `.ics` calendar reminders (3.3, 3.4). Stats-sleep request cancelled by user (24h view already shows sleep). 359 tests; lint/format/build green. Next: review → fixes → smoke → push. | ~800 |
| 8 | Stage 3 complete and deployed 2026-10-18 (f34d6e3, CI green: check, rules, deploy, deploy-rules). Code review: no issues. Headless Playwright smoke test (demo, 390px) passed: hour numbers light/dark, drop animation, sleep sheet per-day save, unlogged banner, `.ics` (16 events, CRLF), day and week share PNGs, no console errors. Polish: Jar gets `date`, Settings hint points to per-day sleep edit. 359 tests. | ~860 |
| 9 | Post-Stage-3 asks: empty jars for unlogged past days in Week/Month/week share (b7d74c5); Settings → Delete all data with typed DELETE confirm (973152f; `deleteAllData` optional on Repo for now). Opus PM scoped Stage 4 (push reminders removed): 4.1 drag-to-drop tray + chips under the jar, 4.2 Loose physics jar (custom solver), 4.3 App Check now, monthly summaries to backlog. User answered 8 questions (overwrite + Undo; release anywhere; tap = hint; today only; Loose holds all past hours incl. gray; per-device toggle; tilt only; App Check now). 380 tests. | ~1000 |
| 11 | (Web session) Stage 4 built: drag-to-drop tray with Undo toast and chips under the jar (4.1); Loose physics jar on a custom circle solver, per-device toggle in Settings and on the jar card, tilt (touch devices only) (4.2); optional App Check wiring, unenforced and skipped until `VITE_APPCHECK_SITE_KEY` is set (4.3); Toast actions; Repo.deleteAllData required; SPEC updated. Review found one bug (a burst of 8+ new hours spawned Loose marbles outside the neck, so the world never slept), fixed with neck rows plus a re-home safety net. Smoke fixes: drop toast is dismissed when leaving Day, tilt only on coarse pointers. Headless smoke test (390px, light and dark) passed. 573 tests; lint, format and both builds green. | ~1240 |

## Stage 3 status: deployed 2026-10-18. Real-device checks pending (share sheet on iOS/Android, notification permission + firing on Android, .ics import on iPhone, animation feel).

## Stage 2 status: deployed 2026-10-18 (CI green, site/manifest/sw live). Real-device checks pending.
Needs the user: push to deploy, then check on real devices. On iPhone, add to Home Screen and test Google popup sign-in **inside the installed app**: iOS keeps separate storage per installed app and the popup can be flaky in standalone mode. Also check dark mode, the update prompt after the next deploy, a CSV export opened in Numbers or Sheets, plus carryover items 2.0f–2.0h.

## Stage 1 status: complete
Deployed and verified on real iPhone and Android devices (2026-10-18). Everything left over (README fix, SPEC questions, the midnight-edit / keyboard / toast gaps, and user checks for usage, API key and key file) moved to **PLAN.md Stage 2 → "Stage 1 carryover" (2.0a–2.0h)**. Dev rules are codified in [AGENTS.md](./AGENTS.md).
