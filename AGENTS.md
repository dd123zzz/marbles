# Marbles: Agent Guidelines

Product: [SPEC.md](./SPEC.md). Staged plan: [PLAN.md](./PLAN.md). Running log and decisions: [HANDOFF.md](./HANDOFF.md). Setup and scripts: [README.md](./README.md).

## Working model (orchestrator)
- The main agent acts as **senior engineer / tech lead**. It plans, delegates, verifies, and reviews. It does **not** write app code itself. It may edit planning docs (`PLAN.md`, `SPEC.md`, `HANDOFF.md`, `AGENTS.md`, `model_rate.md`).
- **Coding goes to subagents:**
  - **Claude Sonnet 5.5** for anything with logic, state, data, or rules.
  - **Claude Haiku 5.5** for mechanical work: scaffolding, renames, doc and typo fixes, config.
  - **Claude Opus 5.5** for PM support only (scope, prioritization, spec questions), and only when needed.
- **Subagent prompts must be self-contained.** Include:
  - the files to read (SPEC/PLAN sections, `src/types.ts`)
  - the exact API or behavior to build
  - the paths the agent owns
  - the verification commands
  - the commit message
  - "report concisely"
- **Parallel agents get disjoint path ownership.** Example: one owns `src/lib/**`, another owns `src/data/**`, `src/auth/**`, rules, and CI. Each commits only its own paths (`git add <paths>`). Nobody edits `src/types.ts` (the shared contract) without the orchestrator's sign-off.
- **After each coding agent, the orchestrator independently re-runs** `npm test`, `npm run lint`, and `npm run build`, and checks `git status`.
- **Before calling a stage done:**
  1. Run a `code-review` subagent (Sonnet 5.5) over the stage's changes.
  2. Send high-confidence findings to a Sonnet fixer.
  3. Smoke-test the core loop in the browser in demo mode.

## Credits and handoffs
- Rates are in [model_rate.md](./model_rate.md) (Anthropic only, 1 credit = $0.01). Estimate each agent call's credits from token volume and keep a running total.
- **Every ~100 credits**, append a row to the Progress table in [HANDOFF.md](./HANDOFF.md) (what was done, what's next, cumulative credits) and commit it. Record new decisions in its Decisions list.

## Build and test
| Command | Purpose |
|---|---|
| `npm run dev` | Dev server at `/marbles/`. Demo mode by default. |
| `npm test` | Unit tests. Runs with `TZ=America/Los_Angeles` so DST tests are deterministic. |
| `npm run lint` / `npm run typecheck` / `npm run format:check` | Static checks (CI runs all of them) |
| `npm run build` and `VITE_DEMO=false npm run build` | Both bundle paths must compile |
| `npm run test:rules` | Firestore rules tests. Needs Java 21. **There is no Java locally**, so these run in CI only. |

- **Demo mode** (`VITE_DEMO=true` in `.env.local`) swaps in fake auth and an in-memory repo backed by localStorage. Firebase code must never load in demo mode; keep it behind dynamic imports.
- **Dev servers:** start them with a known port (`--port 51xx --strictPort`), verify with curl, and stop them by PID before finishing. Never leave one running.

## Architecture rules
- `src/lib/{time,jar,entries}` are **pure and framework-free** (no React, no Firebase) and **fully unit-tested**. Any time, DST, midnight, or slot logic goes here with tests first.
- **Data model:** one doc per user per day, `users/{uid}/days/{YYYY-MM-DD}`, with a 48-char `slots` string `[gbr.]` and notes keyed by run-start slot. Gray (unlogged) and sleep are **computed, never stored**. Details are in PLAN.md "Data model".
- **Marble precedence:** DST n/a > logged > future (empty) > sleep > unlogged.
- **Data access goes through the `Repo` interface** (`src/data/repo.ts`), with Firestore and memory implementations. Views use `useDays` and `useSettings`, not Firestore directly.
- **Writes:**
  - One `writeDays` batch per user action (an entry crossing midnight writes 2 docs).
  - Don't await writes before updating the UI (optimistic, works offline).
  - **Only write when snapshots are server-confirmed** (`!fromCache`), or the device is offline, or the 4s grace period has passed. Never build a write from a partial cache.
  - Block new-day writes until settings have loaded, because the sleep snapshot is permanent.
- **Quota (Spark plan):** one range subscription per view (month ≤ 31 reads). No per-day listeners in loops. No Cloud Functions or paid services.
- **Auth:** popup sign-in only, never redirect.
- **Routing:** HashRouter only. Vite `base: '/marbles/'`.
- **Every client write must be allowed by `firestore.rules`.** When the data shape changes, update the rules **and** `tests/rules/` in the same change.

## Conventions
- Shared types live in `src/types.ts`. Category chars are `g`/`b`/`r` = Wanted/Wasted/Unwanted. Sleep color is indigo `#4f46e5`.
- **Accessibility:** colors are always paired with text, marbles have `aria-label`s, and animation respects `prefers-reduced-motion`.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`), ending with the trailer `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`.
- **Never commit** `.env.local` or service-account keys. Firebase web config goes in GitHub repo **variables** (`vars.VITE_FIREBASE_*`). The only secret is `FIREBASE_SERVICE_ACCOUNT`.
- **Don't push or change GitHub or Firebase settings without asking the user.** Pushing to `main` deploys to Pages, and deploys rules when they change.
- **Ask the user** (structured question) about design choices, scope, or behavior ambiguity; don't guess.
