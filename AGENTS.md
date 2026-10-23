# Marbles: Agent Guidelines

Product: [SPEC.md](./SPEC.md). Staged plan: [PLAN.md](./PLAN.md). Running log and decisions: [HANDOFF.md](./HANDOFF.md). Setup and scripts: [README.md](./README.md). iOS client: [ios/README.md](./ios/README.md).

**iOS is frozen (user, 2026-10-22).** Don't edit `ios/`, plan iOS parity, or run or fix the iOS workflow (it's manual-only) until the user explicitly asks for it.

## Working model (orchestrator)
- The main agent is the **orchestrator** (PM and tech lead). It sets scope, asks the user about ambiguity, plans, delegates, verifies, and reviews. It writes **no app code**. It owns the planning docs: `AGENTS.md`, `PLAN.md`, `SPEC.md`, `HANDOFF.md`, `model_rate.md`.
- **Model routing:**
  - **Claude Opus 5.5**: planning leads only (see "Planning phases"), plus PM support (scope, prioritization, spec questions) when needed.
  - **Claude Sonnet 5.5**: all coding with logic, state, data, or rules; code reviews; fixers; and mechanical work, because **Haiku 5.5 isn't available in this environment**.
  - **Claude Haiku 5.5** (if it becomes available): mechanical work only (scaffolding, renames, doc and typo fixes, config).
- **Subagent prompts must be self-contained.** Include:
  - the files to read, with sections or line ranges (SPEC/PLAN sections, `src/types.ts`)
  - the exact API or behavior to build
  - the paths the agent owns
  - the verification commands
  - the commit message
  - an output cap ("report concisely", 15 lines or fewer for leads)
- **Parallel agents get disjoint path ownership.** Example: one owns `src/lib/**`, another owns `src/data/**`, `src/auth/**`, rules, and CI. Each commits only its own paths (`git add <paths>` or `git commit -- <paths>`). Nobody edits `src/types.ts` (the shared contract) without the orchestrator's sign-off.

## Planning phases
1. **Ask the user first** (structured questions) about scope and behavior, so leads don't spend tokens guessing.
2. Spawn **Opus leads in parallel**, each owning one doc, typically under `docs/<stage>/`:
   - **Engineer lead** (`ENGINEERING.md`): technical design, test plan, task breakdown into waves.
   - **Designer lead** (`DESIGN.md`): visual direction, design tokens, component and motion specs.
3. Leads don't do bulk work. When they need hands (mockups, screenshots, code reading at volume), they return a self-contained request and the orchestrator spawns a Sonnet worker. Leads may run tiny checks themselves when that's cheaper than a round trip.
4. Show the user anything that needs a choice (for example, mockups).
5. Merge the leads' docs into a PLAN.md stage and SPEC.md updates, write a handoff row, and commit.

**Token discipline:** Opus calls are the expensive ones. Point leads at exact files and line ranges, prefer one Opus pass per lead per phase, and send follow-ups to Sonnet unless they need judgment. The orchestrator reads only what it needs to route work and delegates deep reading.

## Build phases
- Workers write the code, following the PLAN.md stage and its `docs/<stage>/*.md`, in waves with disjoint paths.
- **After each coding agent, the orchestrator independently re-runs** `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, and both builds, and checks `git status`.
- **Before calling a stage done:**
  1. Run a code-review subagent (Sonnet 5.5) over the stage's changes.
  2. Send high-confidence findings to a Sonnet fixer.
  3. Smoke-test the core loop in the browser in demo mode (light, dark, and reduced motion when visuals changed).

## Credits and handoffs
- Rates are in [model_rate.md](./model_rate.md) (Anthropic only, 1 credit = $0.01). Estimate each agent call's credits from token volume and keep a running total.
- **Every ~75 credits** (user, 2026-10-20), and at every phase change, append a row to the Progress table in [HANDOFF.md](./HANDOFF.md) (what was done, what's next, cumulative credits) and commit it.
- Record user decisions in the HANDOFF Decisions list as soon as they're made.

## Build and test
| Command | Purpose |
|---|---|
| `npm run dev` | Dev server at `/marbles/`. Demo mode by default. |
| `npm test` | Unit tests. Runs with `TZ=America/Los_Angeles` so DST tests are deterministic. |
| `npm run lint` / `npm run typecheck` / `npm run format:check` | Static checks (CI runs all of them) |
| `npm run build` and `VITE_DEMO=false npm run build` | Both bundle paths must compile. **Builds hang inside the agent sandbox**, so run them unsandboxed. |
| `npm run test:rules` | Firestore rules tests. Needs Java 21. **There is no Java locally**, so these run in CI only. |

- **Demo mode** (`VITE_DEMO=true`) swaps in fake auth and an in-memory repo backed by localStorage. Local `.env.local` is real Firebase, so smoke tests run `VITE_DEMO=true npm run dev`. Firebase code must never load in demo mode; keep it behind dynamic imports.
- **Dev servers:** start them with a known port (`--port 51xx --strictPort`), verify with curl, and stop them by PID before finishing. Never leave one running.

## Architecture rules
- `src/lib/{time,jar,entries}` are **pure and framework-free** (no React, no Firebase) and **fully unit-tested**. Any time, DST, midnight, or slot logic goes here with tests first.
- **Data model:** one doc per user per day, `users/{uid}/days/{YYYY-MM-DD}`, with a 48-char `slots` string `[gbr.]`, an optional 48-char `breaks` string marking entry boundaries, and notes keyed by run-start slot. Gray (unlogged) and sleep are **computed, never stored**. Details are in PLAN.md "Data model".
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
- **Every client write must be allowed by `firestore.rules`.** When the data shape changes, update the rules **and** `tests/rules/` in the same change. The frozen iOS codec (`ios/Packages/MarblesData`) mirrors the rules and will need catching up if the user resumes iOS.

## Conventions
- Shared types live in `src/types.ts`. Category chars are `g`/`b`/`r` = Wanted/Wasted/Unwanted. Colors come from the Sorbet tokens in `src/styles/tokens.css`. Sleep is periwinkle `#9aa6f4` in light mode and `#a5aef7` in dark mode.
- **Accessibility:** colors are always paired with text, marbles have `aria-label`s, and animation respects `prefers-reduced-motion`.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `style:`), ending with the trailer `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`.
- **Never commit** `.env.local` or service-account keys. Firebase web config goes in GitHub repo **variables** (`vars.VITE_FIREBASE_*`). The only secret is `FIREBASE_SERVICE_ACCOUNT`.
- **Don't push or change GitHub or Firebase settings without asking the user.** Pushing to `main` deploys to Pages, and deploys rules when they change.- **Ask the user** (structured question) about design choices, scope, or behavior ambiguity; don't guess.
