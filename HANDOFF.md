# Handoff Log

Running log, updated roughly every 100 AI credits spent (see [model_rate.md](./model_rate.md)). Credit figures are estimates from token volume.

## Decisions (beyond SPEC/PLAN)
- Sleep color: indigo `#4f46e5`. Sleep is excluded from "awake %" stats.
- No Java on the dev machine, so the Firestore emulator can't run locally. Rules tests are written and will run in CI (which has Java).
- No Firebase project yet. `.env.local` holds placeholders. **Demo mode** (`VITE_DEMO=true`) swaps in fake auth and an in-memory repo so the UI can be exercised locally.
- Future slots render as empty, even inside the sleep window (precedence: logged > future → empty > sleep > unlogged gray).
- A slot is loggable once it has started (slot start ≤ now).
- The sleep window applies within each calendar day, wrapping (23:00–07:00 means 00:00–07:00 and 23:00–24:00 on each day).
- GitHub setup is deferred until after Stage 1 (user request): the CI workflow is written but not pushed.

## Progress
| # | Update | Est. credits (cumulative) |
|---|---|--:|
| 0 | Plan + rate table, kickoff | 6 |
