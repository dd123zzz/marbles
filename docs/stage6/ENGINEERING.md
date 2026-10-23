# Stage 6 engineering plan: Purposeful category, Wanted renamed Productive

Planning only. Owner: Opus lead. Inputs: SPEC §2–5, PLAN data model + code org, `src/types.ts`, `firestore.rules`, `src/lib/{jar,entries,stats,export,time}`, `src/data/firestoreRepo.ts`, `tokens.css`, CI workflows.

**Scope (user decisions, final).** New user-logged category **Purposeful** (time chosen deliberately, split off from Wanted). **Wanted → "Productive"** everywhere in UI, labels, export values, and aria-labels; data char stays `g`, no migration. Order everywhere: **Purposeful, Productive, Unwanted, Wasted** (`p g r b`). Purposeful gets its own Stats row and both percentages. Color: sky blue (candidates in §5; the user picks).

## 1. Slot char: `p`

`p` is free. Slot alphabet today is `[gbr.]`; `breaks` uses `[.|]` in a separate field; `MarbleColor` non-category values are words (`sleep`, `unlogged`, `empty`, `na`), so there's no collision. New: `Category = 'p' | 'g' | 'b' | 'r'`, slots `[pgbr.]`.

## 2. Backward compatibility (old PWA clients)

**Verdict: safe with no `v` bump, no new field, and no forced update. The only hard requirement is that rules allowing `p` are live before any client can write `p`.**

What an old client does with a day doc that contains `p` (verified in code):
- **No read-side sanitizer.** `firestoreRepo` returns `slots` verbatim. `computeMarbles.colorOf` (`src/lib/jar`) maps an unknown char to the fallthrough: `empty` / `sleep` / `unlogged`. So `p` *looks* gray or sleep on old clients, but the string in memory still holds `p`.
- **Writes preserve `p`.** All writes go through `applyEntry` / `deleteEntry` / `drop` / `undoDrop`. These copy the cached doc and use `setSlots(slots, start, len, ch)`, which rewrites only the edited range. The batch `set` therefore writes back every other `p` unchanged. There is no silent erasure.
- **`entriesOf`** treats any non-`.` char as a run, so an old client lists a `p` entry with label `undefined` and no dot color (cosmetic). Editing it and saving with category `p` fails `validateEntry` ("Invalid category."), so there is no write.
- **Overlap and drop:** `findConflicts` and `nextDropWindow` treat any non-`.` as logged, so the catch-up drop never auto-targets `p`. The overwrite confirm still fires for `p`.
- **Residual risk (user-driven, acceptable):** an old client shows `p` hours as gray. The user may re-log them, or a last-hour-fallback drop may overwrite them. Old stats undercount, reminders count `p` as unlogged, and old export emits a blank category. All of this ends when the PWA updates (`registerType: 'prompt'` already shows the update banner).
- **Rules + old client:** once rules allow `p`, an old client writing a doc that still contains `p` passes. Under the *old* rules (`^[gbr.]{48}$`), **any** write to such a doc is rejected. That covers a new client writing `p` and an old client editing another hour on that day.
- `v` stays `1`. A bump would need rules to accept both versions and buys nothing, because old clients already round-trip `p`.

**Rollout order (required).** In `ci.yml`, `deploy` (Pages) and `deploy-rules` both `needs: [check, rules]` and run **in parallel**. One push would race. So:
1. **Push A (rules only):** `firestore.rules` + `tests/rules/**`. CI runs the rules tests, then deploys the rules. Pages redeploys an identical app, which is harmless. Confirm the `deploy-rules` job is green. (Alternative: run the manual `deploy-rules.yml` workflow from the branch before merging.)
2. **Push B (client):** everything else. It may go in the same PR as long as A was merged and deployed first.
3. **Never revert the rules** after B ships. If B is rolled back, docs containing `p` become unwritable for everyone.
4. Demo mode (`memoryRepo`, localStorage) has no rules, so nothing to do there.
5. The iOS app (if anyone has it installed) behaves like an old client: its Swift `Jar` falls through to gray in the same way. It is covered by the same reasoning.

## 3. Rules + rules tests (Wave 0)

- `firestore.rules`: `d.slots.matches('^[pgbr.]{48}$')`. Nothing else changes.
- `tests/rules/firestore.rules.test.ts`, add:
  - allow: slots of all `p` (`'p'.repeat(48)`)
  - allow: mixed `'pgbr'.repeat(12)`
  - allow: `p` with a `breaks` mask (`|` inside a `p` run)
  - deny: `'P'` uppercase, `'x'`, and 47- or 49-char strings that contain `p`
  - keep the existing `'gbr.'.repeat(12)` allow case
- Rules tests run in CI only (no local Java). Locally, run `npm run lint` and `npm run typecheck` on the test file.
- PLAN.md data model / rules sketch `[gbr.]` → `[pgbr.]` (orchestrator edits docs).

## 4. Touch points by file

Single source of order: add `CATEGORIES: readonly Category[] = ['p','g','r','b']` and `isCategory(ch)` in `src/lib/jar/index.ts`. Every hard-coded `['g','b','r']` list and every `=== 'g' || 'b' || 'r'` check switches to these.

**Wave 1: types + pure libs**
- `src/types.ts` *(orchestrator sign-off)*: `Category` adds `'p'`. Update doc comments `[gbr.]` → `[pgbr.]` and the label example "Wanted" → "Productive".
- `src/lib/jar/index.ts`:
  - `CATEGORY_LABEL`: `p: 'Purposeful'`, `g: 'Productive'`
  - `MARBLE_COLORS.p` (share PNG, light hex)
  - `colorOf` uses `isCategory`
  - `hasLoggedSlots` regex `/[pgbr]/`
  - `summarize` init adds `p: 0`
  - export `CATEGORIES` and `isCategory`
- `src/lib/entries/index.ts`: `validateEntry` uses `isCategory`. Everything else is char-generic; verify `normalizeBreaks` and `entriesOf` with `p`.
- `src/lib/stats/index.ts`:
  - `StatsHours`, `awakePct`, and `dayPct` add `p`
  - awake = `p+g+b+r+unlogged`
- `src/lib/export/index.ts`:
  - `ExportRow.category` becomes `'purposeful' | 'productive' | 'unwanted' | 'wasted'`
  - `CATEGORY_NAME`: `p: 'purposeful'`, `g: 'productive'`
  - The CSV header is unchanged. Category is a value column, not a column per category.
  - Renaming the `wanted` value is a breaking change for anyone scripting on the export. That's acceptable: it's a single-user app and the user asked for the rename in exports. Note it in release notes.
- `src/lib/time/dropWindow.ts`: **no change**. The anchor test is `slots[i] !== '.'`. Add one test: a `p` slot anchors the window.
- Tests: `jar.test.ts` (labels, `p` color, `hasLoggedSlots('p')`, summarize), `entries.test.ts`/`logical.test.ts`/`breaks.test.ts`/`drop.test.ts` (one `p` case each: run, join across midnight, break inside a `p` run, drop + undo restoring `p`), `stats.test.ts` (p row, awake denominator), `export.test.ts` (`wanted`→`productive`, add `purposeful`, row order unaffected).

**Wave 2A: components, styles, share**
- `src/styles/tokens.css`:
  - `--marble-p`, `-p-hi`, `-p-lo` (light + dark)
  - `--cat-p: var(--marble-p)`
  - Ink stays `--cat-ink` / `--marble-ink` (dark ink, see §5)
- `src/styles/base.css`: `.dot-p`. `src/components/sheet.css`: `.category-p`. `src/views/stats.css`: `.stats-bar-p`. `src/views/day.css`: `.jar-armed-p`. (2A owns all CSS, including the views CSS.)
- `src/components/MarbleTray.tsx`: use `CATEGORIES`, so the tray shows 4 marbles. At 390px: 4×52px + 3×28px gap = 292px, which fits; the captions "Purposeful"/"Productive" (~70px at caption size) may overlap. If they do, reduce the gap to 20px or set `.tray-item { width: 72px }`, and verify at 360px too. `tray.css` wobble: add an `nth-child(4)` delay.
- `src/components/SummaryChips.tsx`: `KEYS = [...CATEGORIES, 'sleep', 'unlogged']`. Chips already show **full labels** ("Productive 3h"); there are no letter chips in code, so no short labels are needed. SPEC P1's "G/B/R" text becomes words.
- `src/components/marbleUtils.ts`: `GLOSSY` adds `p`. `src/components/jarAnim.ts`: `isLogged` uses `isCategory`.
- `src/share/drawJar.ts`: day and week stat rows go from 3 across (`inner/3`) to 4 across; `Summary` init adds `p`; legend order. `drawJar.test.ts`: legend expects `Purposeful`, `Productive`.
- `src/auth/SignInView.tsx`: decorative dots; optionally add `dot-p`.
- Tests: `MarbleTray.test.tsx` (`Log … as Productive`, 4 names), `Jar.test.tsx`/`PhysicsJar.test.tsx` (aria-labels "Wanted" → "Productive"), `shareImage.test.tsx` if names are asserted.

**Wave 2B: views, reminders, data**
- `src/views/LogSheet.tsx`: `CATEGORIES` from lib → 4 buttons in order `p g r b`. There are no keyboard shortcuts today, so nothing to remap. Check that the button row wraps or fits at 390px (a 2×2 grid is fine).
- `src/views/StatsView.tsx`:
  - `RowKey` adds `p`
  - rows awake `['p','g','r','b','unlogged']`, day `['p','g','r','b','sleep','unlogged','notYet']`
  - key map adds `p: 'p'`
- `src/views/DayView.tsx`: char-generic via `CATEGORY_LABEL` and `dot-${category}`. Check the drop toast text.
- `src/reminders/*`: char-generic (uses `summarize().unlogged`). Add one test proving a `p` slot isn't unlogged.
- `src/data/memoryRepo.ts`: no change. Add a test seeding a `p` doc that round-trips.
- Tests: `DayView.test.tsx` ("logs the previous hour as Wanted" → Productive), `StatsExportViews.test.tsx` (`/Wanted/` → `/Productive/`, add a Purposeful row), `logSheetLogic.test.ts` (one `p` buildEntry).

**Orchestrator (docs):** SPEC §2 table (Purposeful row, Productive rename, sky blue), §4 P1 text, §5 "beyond the 3" → 4. PLAN data model `[pgbr.]`. HANDOFF decision: `p` char, export value rename, rules-first rollout.

## 5. Sky-blue candidates (computed; WCAG 2.x luminance, CIEDE2000, Machado 2009 full-severity CVD)

Light jar bg `--bg #fff8f3`, dark `--bg #1d1a2b`. ΔE columns are normal / deuteranopia / protanopia / tritanopia. Under 10 is close, under 5 is risky.

| | Light / dark base | `-hi` / `-lo` (light) | L* | Y (light) | vs bg light / dark | ink `#1f1d2b` light / dark | ΔE vs Sleep | ΔE vs Productive |
|---|---|---|--:|--:|--:|--:|---|---|
| **A "Clear sky"** | `#7cc4ef` / `#86cbf2` | `#e2f4fd` / `#3f93c4` | 76.1 | 0.500 | 1.82 / 9.59 | 8.67 / 9.33 | 15.3 / 5.5 / 7.8 / 11.8 | 30.9 / 29.3 / 31.9 / 7.9 |
| **B "Cyan sky" (recommended)** | `#78cdea` / `#82d3ee` | `#e0f6fc` / `#3a9cbf` | 78.2 | 0.536 | 1.70 / 10.12 | 9.24 / 9.85 | 20.2 / 8.3 / 11.2 / 13.6 | 26.2 / 26.7 / 28.4 / 6.5 |
| **C "Pale sky"** | `#84d2ec` / `#8cd6f0` | `#e6f6fe` / `#45a6c4` | 80.2 | 0.571 | 1.61 / 10.52 | 9.78 / 10.24 | 20.3 / 10.0 / 12.7 / 13.6 | 25.1 / 25.4 / 27.2 / 5.2 |

Dark `-hi` / `-lo`: use the light pair, with `-lo` lifted ~5% (B: `#e2f7fd` / `#3f98b8`), matching how `g` and `sleep` differ between themes.

- **Ink:** dark ink `#1f1d2b` passes AA (≥ 8.6:1) on all three, in both themes. White ink fails (~1.8:1), so Purposeful uses the default `--cat-ink` / `--marble-ink` with the light halo, not the Wasted white-ink path.
- **Fill vs bg:** every option is 1.6–1.8:1 on the light bg. That's in line with Productive (1.41) and Sleep (2.19). It's OK because marbles carry the glass stroke and are always paired with text (aria-labels, chips, captions). Dark theme is 9.6–10.5:1.
- **Trade-off:**
  - A is the user's anchor but weakest vs Sleep under deuteranopia (5.5).
  - C separates best from Sleep but is closest to Productive under tritanopia (5.2) and in lightness.
  - **B** leans cyan (away from periwinkle). It gets ΔE 20 vs Sleep in normal vision and ≥ 8 for red-green CVD, while keeping tritan distance to mint at 6.5. Comparable pairs already ship: Unwanted vs Productive is 15.5 under deuteranopia.
- **Lightness order (L\*, light):** Unlogged 91.5 > Productive 85.0 > **Purposeful 78.2 (B)** > Sleep 69.9 ≈ Unwanted 65.9 > Wasted 46.4. Purposeful slots in between Productive and Sleep, so all three candidates keep the Sorbet ladder.
- `MARBLE_COLORS.p` (share PNG, light only) = the chosen light base.

## 6. Build waves (Sonnet 5.5 workers; disjoint paths)

All workers run `npm test && npm run lint && npm run typecheck && npm run format:check && npm run build && VITE_DEMO=false npm run build`, commit only their own paths (`git add <paths>`), and end the commit with `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`. The orchestrator re-runs the same commands and `git status` after each worker.

| Wave | Owner paths | Work | Commit |
|---|---|---|---|
| 0 (alone; **push first, with user OK**) | `firestore.rules`, `tests/rules/**` | §3 | `feat(rules): allow Purposeful slot char p` |
| 1 (alone; **`src/types.ts` needs orchestrator sign-off** before the worker starts, so put the exact diff in the prompt) | `src/types.ts`, `src/lib/**` | §4 Wave 1 + tests | `feat: add Purposeful category and rename Wanted to Productive in core libs` |
| 2A (parallel) | `src/components/**`, `src/styles/**`, `src/share/**`, `src/views/*.css`, `src/auth/SignInView.tsx` | §4 Wave 2A, chosen color | `feat(ui): Purposeful marble, tokens, tray and share image` |
| 2B (parallel) | `src/views/*.tsx`, `src/views/*.ts`, `src/reminders/**`, `src/data/**` | §4 Wave 2B | `feat(ui): Purposeful in log sheet, stats, and day view` |
| 3 | review: read-only. Fixer: union of the flagged paths. | `code-review` subagent (Sonnet) over the stage diff, then a Sonnet fixer for high-confidence findings. Then a browser smoke in demo mode at 390px, light + dark: log Purposeful via the sheet, drag from the tray, Stats rows and %, export CSV values, share PNG. | `fix: stage 6 review findings` |

Wave 1 must merge before 2A/2B, since TS won't compile without `'p'` in `Category`. Wave 1 alone is a green build: the new `Record<Category,…>` entries in `lib` are filled in by Wave 1, while views only read through `CATEGORIES` and `CATEGORY_LABEL`. Type errors that surface in components or views (for example a `Summary` literal in `drawJar`) are fixed by 2A/2B. The Wave 1 worker may add a minimal `p: 0` in those literals **only if** the build fails, and must report it. **iOS CI:** `ios.yml` runs `npm run golden` + `git diff --exit-code ios/Fixtures/golden` on `src/lib/**` changes. The `jar.*.json` goldens contain "Wanted" labels, so Wave 1 turns the iOS workflow red until iOS is ported (see Q2). It doesn't gate Pages.

## 7. Credit estimate (1 credit = $0.01)

| Item | Est. credits |
|---|--:|
| Wave 0 rules (small) | 8 |
| Wave 1 types + libs + tests | 45 |
| Wave 2A components/styles/share | 40 |
| Wave 2B views/reminders/data | 35 |
| Code review (Sonnet) | 20 |
| Fixer (Sonnet) | 15 |
| Browser smoke (demo, 2 themes) | 15 |
| Orchestrator verification + doc edits | 25 |
| **Total** | **~205** |

## 8. Open questions for the user

1. **Color:** A `#7cc4ef`, B `#78cdea` (recommended), or C `#84d2ec`? (A visual swatch strip next to mint and periwinkle is worth showing before choosing.)
2. **iOS CI:** accept a red iOS workflow until the iOS port happens (recommended, since it doesn't gate Pages), or regenerate goldens + patch the Swift labels now (~40 credits)?
3. **Push order:** OK to push the rules-only commit (Wave 0) to `main` first, which deploys rules, then push the client a few minutes later?
4. **Old clients:** is the existing "update available" banner enough, or do you want a one-time auto-reload on the next launch (not needed for data safety)?

## 9. Deferred iOS port needs

- `MarblesCore` `Category` enum + `p`; `Jar.swift` color fallthrough, labels (`Productive`, `Purposeful`), and order `p g r b`.
- Stats (p row, awake denominator), export value names, and the 4-button log sheet and 4-marble tray.
- Asset/color tokens for the chosen sky blue (light/dark, hi/lo); share image with a 4-across stats row.
- `MarblesData` tests decoding `[pgbr.]`; regenerate `ios/Fixtures/golden` (`npm run golden`) and add `p` golden cases in `scripts/golden/**`.
- Until shipped, iOS is an "old client": safe per §2 (it round-trips `p` and shows it as gray), as long as its writers also use range-only slot rewrites. Verify this in `MarblesData` before release.
