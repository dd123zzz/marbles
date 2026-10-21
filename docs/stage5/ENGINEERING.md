# Stage 5 engineering plan: catch-up drops (A) and one line per entry (B)

Planning only. Owner: Opus lead. Inputs: SPEC F2–F4, PLAN data model + 4.1, `src/lib/{time,entries,export}`, `DayView.tsx`, `firestore.rules`, iOS `MarblesCore`/`MarblesData`, `scripts/golden`.

## 1. Feature A: where a drop starts

### Pure function
`src/lib/time/dropWindow.ts` (new; exported from `src/lib/time/index.ts`):

```ts
export interface DropWindow { targets: SlotRef[]; kind: 'gap' | 'lastHour' }
export function nextDropWindow(args: {
  slots: string | undefined; // today's DayDoc.slots (undefined = no doc)
  sleep: SleepWindow;        // today's doc.sleep ?? settings sleep (same rule the jar uses)
  now: Date;
}): DropWindow;
```

It takes today's `slots` string, not `days`, because the lookback is today-only. That keeps it in `lib/time` with no `DayDoc` dependency, and it can be built in parallel with Feature B (which owns `lib/entries`).

### Algorithm (today = `toDateKey(now)`)
1. `E` = the rounded end used by `lastHourWindow`: `floor((h*60 + min + 15) / 30)`. Slots `< E` are eligible.
2. `na` = `nonexistentSlots(today)`.
3. A slot `i` is **covered** if it is logged (`slots[i] !== '.'`), **or** it is a **morning-sleep** slot. Morning sleep means the sleep window with `s < e` (the whole window), or, when the window wraps (`s > e`), slots `< e` only. **Evening sleep (slots `>= s` of a wrapping window) is not covered.** See the edge cases below.
4. `anchor` = the largest covered `i` in `0..47`, skipping `na` slots (they are never an anchor). If there is none, `anchor = -1`, so the gap starts at 00:00.
5. `G = anchor + 1`. Walk forward from `G`, skip `na` slots, and collect up to 2 slots with index `< E`.
6. If at least 1 slot was collected, return `{targets, kind: 'gap'}`. Otherwise return `{targets: lastHourWindow(now), kind: 'lastHour'}`, which is today's overwrite + Undo behaviour, including the yesterday-spanning windows.

Gap slots are by construction unlogged and not morning sleep, so a `gap` window never overwrites anything and is never a no-op.

### Edge cases (recommended answers)
| Case | Answer |
|---|---|
| Gap starts in the current/future slot, so 1h would run past now | **Cap at `E`** (the same rounding the user already sees). If only 1 slot fits, log 30 minutes. If 0 fit, fall back to `lastHour`. |
| Gap shorter than 1h before the next covered slot | Can't happen below `E`: the anchor is the *latest* covered slot, so `[G, E)` is all uncovered. Only the `E` cap shortens a window. |
| Evening sleep has started (e.g. 23:40, sleep 23:00) | Evening sleep counts as **unlogged**, so the catch-up continues through it (21–22, 22–23, 23:00–23:30, then fallback). If evening sleep counted as logged, a 21:00–23:00 gap could never be caught up once 23:00 passed. "Gap starts after sleep ends" applies to morning sleep. |
| `now` inside tonight's sleep window | Same as above. The user is awake and dropping, so filling sleep silently matches F2. |
| Nothing logged, still inside morning sleep (06:10, wake 07:00) | Anchor = last sleep slot, `G >= E`, so fall back to `lastHour` (05:00–06:00, overwriting sleep). Same as today. |
| Repeat drop after Undo | Undo restores the gap, so the next drop targets the same window again. No state needed. |
| Different-category repeat drop | **Advance** to the next gap. Recolor happens only once caught up (fallback, as today). Undo is the way to fix a mistaken drop. *Open question 1.* |
| DST spring-forward (2026-03-08) | `na` slots (02:00–03:00) are skipped, neither anchor nor target. A window can span 01:30 + 03:00. |
| DST fall-back | Wall clock, same as `lastHourWindow` (documented limitation). |
| 00:00–00:14 | `E = 0`, nothing eligible today, so `lastHour` gives yesterday 23:00–24:00 (as today). |
| 00:15–00:44 | `E = 1`. If slot 0 is uncovered (no morning sleep, nothing logged), log **today 00:00–00:30 only**: today-only lookback, no yesterday catch-up. If covered (usual sleep), fall back to yesterday 23:30 → 00:30. |
| Logged in-progress slot (sheet logged 14:00–14:30 at 14:10) | It is the anchor, `G = 29 >= E = 28`, so fallback. Earlier gaps are not revisited (the rule is "after the latest logged"). |

### Test matrix (TZ America/Los_Angeles, sleep 23:00–07:00 unless noted)
| now | today's slots | targets | kind |
|---|---|---|---|
| 10:10 | g 07:00–09:00 | 09:00–10:00 | gap |
| 10:12 | g 07:00–10:00 (after the drop above) | 09:00–10:00 | lastHour (same cat = noop toast; other cat = recolor) |
| 14:44 | g ..13:00 | 13:00–14:00 | gap |
| 14:44 | g ..14:00 | 14:00–14:30 (1 slot, capped at E=29) | gap |
| 14:44 | g ..14:30 | 13:30–14:30 | lastHour |
| 09:20 | none (no doc) | 07:00–08:00 | gap |
| 06:10 | none | 05:00–06:00 | lastHour |
| 03:10, sleep 22:00–22:00 (none) | none | 00:00–01:00 | gap |
| 03:10, sleep 01:00–08:00 (non-wrapping) | none | 02:00–03:00 | lastHour (anchor = slot 15, covered slots after now still anchor) |
| 00:10 | any | yesterday 23:00–24:00 | lastHour |
| 00:20, no sleep | none | today 00:00–00:30 | gap |
| 00:20 | none | yesterday 23:30 → 00:30 (2 docs) | lastHour |
| 23:40 | g ..21:00 | 21:00–22:00, then 22–23, then 23:00–23:30, then 22:30–23:30 | gap ×3, lastHour |
| 2026-03-08 03:10, no sleep | g ..01:30 | 01:30–02:00 (02:00–03:00 n/a, E=6) | gap |
| 2026-03-08 04:10, no sleep | g ..01:30 | 01:30–02:00 + 03:00–03:30 | gap |
| 15:00 after Undo of a 13–14 gap drop | g ..13:00 | 13:00–14:00 again | gap |
### Wiring (DayView, owned by the Wave 2 worker)
- `todaySleep = days[today]?.sleep ?? settings sleep`, `win = nextDropWindow({slots: days[today]?.slots, sleep: todaySleep, now})`.
- **Tray label:** `windowLabel(win.targets, today)` replaces `lastHourWindow(now)` (L148). Same format ("Drag into the jar to log 13:00–14:00"). Button aria-labels follow automatically through `rangeLabel`.
- **`handleDrop`:** `targets = nextDropWindow({... now: at}).targets` at release (L173). The rest is unchanged: the date-range guard, `planDrop`, noop toast (reachable only for `lastHour`), Undo, `yesterdayOnly` fly-to, Loose `dropAt` per hour (a 1-slot window drops one marble for that hour).
- Gating is unchanged: `writable` already requires server-confirmed snapshots and loaded settings. `nextDropWindow` must never run on a partial cache, and the existing gate guarantees that.
- The Log time sheet default (`defaultStartFor`) is untouched.

## 2. Feature B: one line per entry

### New field
`DayDoc.breaks?: string`. It is a 48-char mask over `[.|]`. `'|'` at `i` means "an entry starts at slot `i`" where the runs alone wouldn't show it. The field is **omitted when the mask has no `'|'`**, so legacy docs and most writes are byte-identical to today.

Why a mask and not a sorted list of start slots: rules can validate a string fully with one `matches('^[.|]{48}$')`. A list can only be checked for type and size (rules can't iterate elements), so junk like `[99, "x"]` would pass. Size is ≤ 48 bytes, and only on days that need it. It also mirrors `slots`, so iOS validation is one regex.

### Invariants and sanitizing
`normalizeBreaks(slots, breaks?) => string | undefined` (pure, in `lib/entries`) keeps `'|'` at `i` only when `slots[i] !== '.'` and (`i === 0` **or** `slots[i-1] === slots[i]`). It returns `undefined` if nothing remains.
- At `i > 0`, a break between different categories is redundant, so it is dropped.
- At `i === 0`, the break means "**do not join** yesterday's tail at midnight". It is kept whenever slot 0 is logged, because the doc can't see yesterday.
- It is applied **on write** (in `collectChanged`, before `normalizeNotes`) and **on read** (in `entriesFromDay`). Read-side sanitizing tolerates junk and stale masks.
- **Older cached PWA:** `toDayDoc` passes unknown fields through, and `cloneDoc` spreads them, so an old client keeps `breaks` unchanged while rewriting `slots`. Read-side sanitizing drops breaks that became invalid. The residual case is a break that is still valid by position, e.g. the old client re-logs 13–15 g over two g lines and two lines remain. This is accepted and documented, and the window closes once the service worker updates.
- **Current iOS app:** `DayDocCodec.encode` writes a full doc without `breaks`, so any iOS write to that day merges its lines back into runs. This is safe and degrades to legacy. It gets fixed in the iOS parity work (§2 iOS).

### Entry segmentation
- `runsOf(slots)` becomes `entriesOf(slots, breaks)`: runs of the same category, also split at each normalized `'|'`.
- `entriesFromDay`, `entryAt`, and `normalizeNotes` all use it. Notes are keyed by **entry start** (the run start is the legacy special case). A note found inside an entry folds into its start, as today.

### Writes
- **`applyEntry(e)`**: after writing slots per part:
  1. set `'|'` at `e`'s first part start;
  2. clear breaks inside every part, including the second day's slot 0 for a midnight-crossing entry;
  3. set `'|'` at the slot after the last part's end, if it is `< 48` (normalization removes it when it isn't meaningful);
  4. if `e` ends exactly at 24:00 and `days[date+1]` exists with slot 0 logged, also set `'|'` at its slot 0 and include that doc in `changed` (still one `writeDays` batch).
- `replace` (edit) clears first, as today.
- **`deleteEntry`**: clears slots; normalization drops breaks that became meaningless.
- **`findConflicts`**: now treats an adjacent same-category entry as a separate entry. Extending 13–14 into a separately logged 14–15 asks to confirm, which is the correct F2 behaviour.

### Midnight joins (`logicalEntryAt`, `logicalEntriesForDay`)
The tail of `date` (ends at 48) joins the head of `date+1` (starts at 0) only if the categories match, the lengths sum to ≤ 48, **and** `date+1` has no `'|'` at slot 0. Only cross-midnight writes produce that, plus legacy docs with no field, which join exactly as today.

### Drops (`planDrop`, `undoDrop`)
- `planDrop` still calls `applyEntry` per contiguous run, so each drop is its own entry. The noop rule is unchanged: if every target already holds the category, nothing is written and the boundaries are not touched.
- `DropUndo` gains `breaks: Array<SlotRef & { prev: '.' | '|'; next: '.' | '|' }>`. It records every mask char that differs between `days` and `changed` (built like `diffNotes`, including the next-day slot-0 case).
- `undoDrop` restores `prev` where the current char still equals `next`, then `collectChanged` normalizes. The existing "only slots still holding the category" rule stays.

### Other consumers
- **Export:** CSV and JSON `entries` rows come from `entriesFromDay`, so they become one row per entry automatically. JSON `days[]` gains optional `breaks` when present (`ExportDay` type).
- **Stats, jar, MiniJar, summary:** they read `slots` only, so they are unaffected. The jar shows no boundaries, per the user's decision.
- **Repos:** Firestore `writeDays` already `set`s the whole doc via `stripUndefined`, and `toDayDoc` passes the field through. No code change; the memory repo (`structuredClone`) also needs none. Add one memory-repo round-trip test.
- `src/types.ts`: add `breaks?: string` to `DayDoc`. **Needs orchestrator sign-off** (shared contract).

### Rules + rules tests
In `validDay`: add `'breaks'` to `hasOnly`, plus `&& (!('breaks' in d) || (d.breaks is string && d.breaks.matches('^[.|]{48}$')))`. The field is optional so old clients keep passing.

New cases for `tests/rules/firestore.rules.test.ts`:
- accept a valid mask;
- accept a doc without the field;
- reject a 47- or 49-char mask, a mask with other chars (`g`), a non-string, and a list.

Rules tests run in CI only (no Java locally).

### iOS parity (follow-up; see build note on golden CI)
- MarblesCore `Types.swift` (`DayDoc.breaks`), `Entries.swift` (entriesOf, normalizeBreaks, applyEntry, joins, DropUndo, undoDrop), `Time/` (new `nextDropWindow`), `Export.swift` (`ExportDay.breaks`).
- MarblesData `DayDocCodec` (encode/decode optional `breaks`), `WriteValidator` (`dayKeys` + regex).
- `scripts/golden/{data,time}.golden.ts`: add cases for breaks, joins, drop undo, and `nextDropWindow`.

## 3. A and B together
- Each `gap` drop is a separate `applyEntry`, so it writes `'|'` at its start. Catch-up drops 13–14 g and 14–15 g show as **two lines**, each with its own edit/delete/note.
- A `lastHour` fallback across two such lines with another category splits them as expected, e.g. g 13:00–13:30, b 13:30–14:30, g 14:30–15:00.
- Undo of a gap drop restores slots, notes and breaks, so the neighbour line is unchanged.
- A 00:20 fallback spanning midnight is one crossing entry and stays one joined line.

## 4. Build breakdown

**Golden CI constraint (important).** `.github/workflows/ios.yml` runs on any `src/lib/**` or `src/types.ts` change. It runs `npm run golden` and then `git diff --exit-code ios/Fixtures/golden`. Changing `applyEntry` output (every slot-0 entry now carries `breaks`) changes existing fixtures. Committing regenerated fixtures without the Swift port makes `swift test` red; not committing them makes the golden job red. Either way the iOS workflow goes red until the iOS port lands. Options: run Wave 3 in this stage (recommended), or accept a red iOS workflow (it doesn't gate the Pages deploy). *Open question 3.*

| Wave | Worker / model | Owns (commit only these) | Work | Commit |
|---|---|---|---|---|
| 1 | A-lib / Sonnet 5.5 | `src/lib/time/dropWindow.ts`, `src/lib/time/dropWindow.test.ts`, `src/lib/time/index.ts` | Tests first (matrix §1), then `nextDropWindow` | `feat(time): nextDropWindow catch-up drop target` |
| 1 | B-lib / Sonnet 5.5 | `src/types.ts` (signed off), `src/lib/entries/**`, `src/lib/export/**` | Tests first: normalizeBreaks, entriesOf, applyEntry marks (adjacent, slot 0, crossing, next-day slot 0), delete, joins, notes, planDrop/undoDrop breaks, export rows. Then implement. | `feat(entries): store entry boundaries so each log is its own line` |
| 1 | Rules / Haiku 5.5 | `firestore.rules`, `tests/rules/**` | Rule + 6 cases above | `feat(rules): allow optional breaks mask on day docs` |
| 2 | Wire / Sonnet 5.5 | `src/views/DayView.tsx`, `src/views/DayView.test.tsx`, `src/data/memoryRepo.test.ts` | Label + `handleDrop` use `nextDropWindow`. DayView tests: catch-up drop writes the gap; two drops give two Entries lines; Undo restores breaks; fallback when caught up. | `feat(day): drops catch up from the last logged slot` |
| 3 | iOS / Sonnet 5.5 | `ios/**`, `scripts/golden/**`, `ios/Fixtures/golden/**` | Port §2 iOS list + `nextDropWindow`, add golden cases, `npm run golden`, `swift test` if Xcode exists locally (else CI) | `feat(ios): entry boundaries and catch-up drop parity` |

After each worker the orchestrator runs `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build`, `VITE_DEMO=false npm run build`, and `git status`. Rules tests and `swift test` run in CI. Then the `code-review` subagent (Sonnet), the fixer, and a demo smoke test: drop, drop, check two lines, Undo, drop again, then check the tray hint after catching up.

**Pastel redesign overlap.** The designer track will touch `src/components/MarbleTray.tsx`, `tray.css`, `jar.css`, `layout.css`, `SummaryChips.tsx`, `Toast`/`toast.css`, and the Entries list markup in `DayView.tsx` (around L350). Stage 5 code touches **only `DayView.tsx` lines ~145–180** (logic, no markup) plus `DayView.test.tsx`. Waves 1 and 3 have no overlap with the designer. Sequence Wave 2 before or after the designer's DayView edits, not concurrently, or let the designer avoid L140–220. MarbleTray needs no change (it already takes `rangeLabel`).

**Credit estimate** (1 credit = $0.01):

| Task | In / out tokens | Credits |
|---|---|---|
| A-lib Sonnet | 150k / 15k | ~70 |
| B-lib Sonnet | 450k / 45k | ~200 |
| Rules Haiku | 60k / 5k | ~10 |
| Wire Sonnet | 250k / 20k | ~105 |
| Code review + fixer Sonnet | 300k / 25k | ~130 |
| iOS port Sonnet (Wave 3) | 500k / 50k | ~225 |
| **Total** | | **~740 with Wave 3; ~515 without** |

Add ~50 for orchestrator verification and the browser smoke test.

## 5. SPEC / PLAN text changes for the PM
- **SPEC F2 drag-to-drop:** replace "logs the last hour, rounded…" with: a drop logs 1 hour starting at the first unlogged slot after today's latest logged or morning-sleep slot (capped at now, rounded to :00/:30; 30 min if only that fits). When there is no gap, it logs the last hour as before, with overwrite + Undo. Replace "A repeat drop with a different category changes the same block" with "Repeat drops catch up hour by hour; once caught up, a different category changes the last hour."
- **SPEC F3:** "Each log or drop is its own entry in the Entries list, even when next to an entry of the same category. Days logged before Stage 5 show merged runs."
- **SPEC export:** rows are one per entry (not per run).
- **PLAN data model:** add `breaks?: string(48) [.|]  # entry starts inside same-category runs; omitted when empty`. Redefine **Entry** as a run split at breaks. Add the midnight join rule (no join when the next day has `'|'` at 0).
- **PLAN rules sketch:** add `breaks` to `hasOnly` plus the regex.
- **PLAN 4.1:** add a pointer to Stage 5 for the new drop window. The tray hint shows `nextDropWindow`.

## 6. Open questions for the user

**Answered (user, 2026-10-20):** 1 advance; 2 log 30 minutes; 3 **defer iOS**: the iOS workflow is expected to go red after Stage 5 until a follow-up iOS port, so skip the iOS wave; 4 evening sleep that has started counts as unlogged. Local Swift tests are blocked until the user accepts the Xcode license (`sudo xcodebuild -license`); the Command Line Tools toolchain lacks the `Testing` module.

1. **Different-category repeat drop:** advance to the next gap (recommended; Undo fixes mistakes), or recolor the block just dropped?
2. **30-minute gap at the edge** (e.g. 14:44 with 14:00–14:30 open): log just 30 minutes (recommended), or log the last full hour, overwriting the previous half hour?
3. **iOS parity in this stage:** port now so iOS CI stays green (recommended, ~225 credits), or defer and accept a red iOS workflow until then?
4. **Evening sleep:** treat already-started evening sleep as unlogged so late catch-ups can fill it (recommended), or as logged (no catch-up once bedtime passes)?
