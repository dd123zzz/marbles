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
- GitHub setup is deferred until after Stage 1 (user request): the CI workflow is written but not pushed.

## Progress
| # | Update | Est. credits (cumulative) |
|---|---|--:|
| 0 | Plan + rate table, kickoff | 6 |
| 1 | Stage 0 local parts done: scaffold (Vite 8, React 19, RR 7, firebase 13, Vitest 5); `src/lib` time/jar/entries (152 tests); auth (Firebase popup + demo), repo (Firestore + in-memory demo), `firestore.rules` + rules tests (not run locally, no Java), CI and deploy workflows (not pushed). Next: Stage 1 UI (1.5–1.9). | ~98 |
| 2 | Stage 1 UI built (1.5–1.9): Day jar, 2-tap LogSheet, edit/delete, date nav, Week/Month, Settings. Code review found 3 issues, all fixed (cache-snapshot overwrite, sleep snapshot before settings load, ungated rules deploy). 186 tests; lint/typecheck/build green. Browser smoke test in demo mode passed: 2-tap log, midnight split, half marbles, notes, overwrite confirm, week/month nav, week-start toggle. | ~247 |

## Stage 1 status: code complete locally. Remaining items need you
These can't be done without your accounts, devices, or Java:
1. **Firebase (0.2–0.3):** create the project; enable Google and Email/Password auth and Firestore (production mode); add `<user>.github.io` to authorized domains; restrict the API key by HTTP referrer. Put the real config in `.env.local` with `VITE_DEMO=false` to test locally.
2. **GitHub (0.1, 0.4–0.6):** create repo `marbles`, `git remote add origin … && git push -u origin main`. Set repo variables `VITE_FIREBASE_*`, secret `FIREBASE_SERVICE_ACCOUNT`, and Pages source = GitHub Actions.
3. **Rules tests (1.10):** these have never run, because there's no Java here. The first CI run will execute them. Alternatively, `brew install openjdk` and run `npm run test:rules`.
4. **Real devices (1.1, 1.10):** smoke test Google popup sign-in and the core loop on iPhone Safari and Android Chrome.

## Known gaps / Stage 2 candidates
- An entry crossing midnight is edited as two separate per-day pieces.
- A half marble has one keyboard target. The entries list is the accessible path to the other half.
- Write errors use `window.alert`, not a toast.
- Plain styling only, per the Stage 1 brief.
