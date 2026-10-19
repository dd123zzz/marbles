import Foundation
import Testing
@testable import MarblesCore

private typealias Cat = MarblesCore.Category
private let ctx = TimeContext.fixed("America/Los_Angeles")
private let sleep = SleepWindow(start: "23:00", end: "07:00")
private let tz = "America/Los_Angeles"
private let d1 = "2026-06-10"
private let d2 = "2026-06-11"

private func slotsOf(_ set: [Int: Character]) -> String {
    var a = Array(emptySlots())
    for (i, c) in set { a[i] = c }
    return String(a)
}
private func run(_ from: Int, _ to: Int, _ c: Character) -> [Int: Character] {
    Dictionary(uniqueKeysWithValues: (from..<to).map { ($0, c) })
}
private func doc(_ set: [Int: Character] = [:], _ notes: [String: String] = [:]) -> DayDoc {
    DayDoc(slots: slotsOf(set), notes: notes, sleep: SleepWindow(start: "22:00", end: "06:00"), tz: "UTC", v: 1)
}
private func e(_ date: String, _ start: Int, _ length: Int, _ cat: Cat = .g, _ note: String? = nil) -> Entry {
    Entry(date: date, startSlot: start, length: length, category: cat, note: note)
}
private func local(_ y: Int, _ m: Int, _ d: Int, _ h: Int, _ mi: Int) -> Date {
    ctx.calendar.date(from: DateComponents(year: y, month: m, day: d, hour: h, minute: mi))!
}

@Suite struct EntriesTests {
    @Test func entriesFromDayFindsRunsWithNotes() {
        let d = doc(run(26, 29, "g").merging(run(29, 31, "b")) { a, _ in a }.merging(run(33, 34, "r")) { a, _ in a },
                    ["26": "deep work", "33": "oops", "30": ""])
        #expect(entriesFromDay(d1, d) == [e(d1, 26, 3, .g, "deep work"), e(d1, 29, 2, .b), e(d1, 33, 1, .r, "oops")])
        #expect(entriesFromDay(d1, nil).isEmpty)
        #expect(entriesFromDay(d1, doc(run(0, 48, "g"))) == [e(d1, 0, 48, .g)])
    }

    @Test func entryAtReturnsContainingRun() {
        let d = doc(run(10, 14, "b"), ["10": "n"])
        #expect(entryAt(d1, d, 13) == e(d1, 10, 4, .b, "n"))
        #expect(entryAt(d1, d, 14) == nil)
        #expect(entryAt(d1, nil, 9) == nil)
    }

    @Test func findConflictsAcrossMidnightAndIgnore() throws {
        let days = [d1: doc(run(26, 28, "g").merging([47: "b"]) { a, _ in a }), d2: doc(run(0, 2, "r"))]
        #expect(try findConflicts(days, e(d1, 46, 4)) == [
            SlotConflict(date: d1, slot: 47), SlotConflict(date: d2, slot: 0), SlotConflict(date: d2, slot: 1),
        ])
        #expect(try findConflicts(days, e(d1, 26, 4), ignore: e(d1, 26, 2)).isEmpty)
        #expect(try findConflicts(days, e(d1, 26, 22), ignore: e(d1, 26, 2)) == [SlotConflict(date: d1, slot: 47)])
        #expect(throws: (any Error).self) { try findConflicts(days, e(d1, 0, 0)) }
    }

    @Test func applyCreatesDocAndSplitsAcrossMidnight() throws {
        let out = try applyEntry([:], e(d1, 46, 4, .b, "late"), sleep: sleep, tz: tz)
        #expect(Set(out.keys) == [d1, d2])
        #expect(out[d1]?.slots == slotsOf(run(46, 48, "b")))
        #expect(out[d2]?.slots == slotsOf(run(0, 2, "b")))
        #expect(out[d1]?.notes == ["46": "late"])
        #expect(out[d2]?.notes == ["0": "late"])
        #expect(out[d1]?.sleep == sleep)
        #expect(out[d1]?.tz == tz)
    }

    @Test func existingDocsKeepSnapshotAndReflection() throws {
        var existing = doc([0: "g"])
        existing.reflection = "hello"
        let out = try applyEntry([d1: existing], e(d1, 46, 4, .b), sleep: sleep, tz: tz)
        #expect(out[d1]?.tz == "UTC")
        #expect(out[d1]?.reflection == "hello")
        #expect(out[d2]?.tz == tz)
    }

    @Test func truncatesNotesByUTF16WithoutSplittingScalars() throws {
        let long = String(repeating: "x", count: 250)
        #expect(try applyEntry([:], e(d1, 0, 1, .g, long), sleep: sleep, tz: tz)[d1]?.notes["0"]?.utf16.count == 200)
        let emoji = String(repeating: "x", count: 199) + "😀"
        let cut = try applyEntry([:], e(d1, 0, 1, .g, emoji), sleep: sleep, tz: tz)[d1]?.notes["0"]
        #expect(cut == String(repeating: "x", count: 199))
        #expect(try applyEntry([:], e(d1, 0, 1, .g, ""), sleep: sleep, tz: tz)[d1]?.notes == [:])
        #expect(throws: (any Error).self) { try applyEntry([:], e(d1, 48, 1), sleep: sleep, tz: tz) }
    }

    @Test func mergingFoldsNotesIntoRunStart() throws {
        let days = [d1: doc(run(28, 30, "g"), ["28": "later"])]
        let out = try applyEntry(days, e(d1, 26, 2, .g), sleep: sleep, tz: tz)
        #expect(out[d1]?.slots == slotsOf(run(26, 30, "g")))
        #expect(out[d1]?.notes == ["26": "later"])
    }

    @Test func replaceMovesAnEntry() throws {
        let days = [d1: doc(run(10, 12, "g"), ["10": "a"])]
        let out = try applyEntry(days, e(d1, 20, 2, .g, "a"), sleep: sleep, tz: tz, replace: e(d1, 10, 2, .g, "a"))
        #expect(out[d1]?.slots == slotsOf(run(20, 22, "g")))
        #expect(out[d1]?.notes == ["20": "a"])
    }

    @Test func deleteClearsSlotsAndNotes() throws {
        let days = [d1: doc(run(10, 12, "g"), ["10": "a"])]
        let out = try deleteEntry(days, e(d1, 10, 2, .g))
        #expect(out[d1]?.slots == emptySlots())
        #expect(out[d1]?.notes == [:])
        #expect(try deleteEntry([:], e(d1, 10, 2)).isEmpty)
    }

    @Test func validateEntryMessages() {
        let now = local(2026, 6, 10, 14, 20)
        #expect(validateEntry(e("2026-13-01", 0, 1), now: now, in: ctx) == "Invalid date.")
        #expect(validateEntry(e(d1, 48, 1), now: now, in: ctx) == "Invalid start time.")
        #expect(validateEntry(e(d1, 0, 0), now: now, in: ctx) == "Duration must be between 30 minutes and 24 hours.")
        #expect(validateEntry(e(d1, 0, 1, .g, String(repeating: "x", count: 201)), now: now, in: ctx)
            == "Note must be 200 characters or fewer.")
        #expect(validateEntry(e(d1, 40, 1), now: now, in: ctx) == "Entries cannot be in the future.")
        #expect(validateEntry(e(d1, 10, 2), now: now, in: ctx) == nil)
    }

    @Test func logicalEntriesJoinAcrossMidnight() throws {
        let days = [d1: doc(run(46, 48, "g"), ["46": "a"]), d2: doc(run(0, 2, "g"), ["0": "b"])]
        let joined = e(d1, 46, 4, .g, "a · b")
        #expect(try logicalEntryAt(days, d1, 47) == joined)
        #expect(try logicalEntryAt(days, d2, 0) == joined)
        #expect(try logicalEntriesForDay(days, d2) == [joined])
        let other = [d1: doc(run(46, 48, "g")), d2: doc(run(0, 2, "b"))]
        #expect(try logicalEntryAt(other, d2, 0) == e(d2, 0, 2, .b))
        #expect(try logicalEntryAt(days, d1, 5) == nil)
    }

    @Test func withReflectionTrimsAndTruncates() {
        #expect(withReflection(nil, "  hi  ", sleep: sleep, tz: tz).reflection == "hi")
        var d = withReflection(nil, "x", sleep: sleep, tz: tz)
        d = withReflection(d, "   ", sleep: sleep, tz: tz)
        #expect(d.reflection == nil)
        let long = withReflection(nil, String(repeating: "y", count: 1200), sleep: sleep, tz: tz)
        #expect(long.reflection?.utf16.count == 1000)
        #expect(withReflection(nil, "a", sleep: sleep, tz: tz).slots == emptySlots())
    }
}

@Suite struct DropTests {
    let now = local(2026, 6, 10, 14, 20)
    fileprivate func drop(_ days: DayMap, _ slots: [Int], _ c: Cat) throws -> DropPlan {
        try planDrop(days: days, targets: slots.map { SlotRef(date: d1, slot: $0) }, category: c,
                     sleep: sleep, tz: tz, now: now, in: ctx)
    }

    @Test func createsMissingDoc() throws {
        let plan = try drop([:], [27, 28], .g)
        #expect(!plan.noop)
        #expect(plan.changed[d1]?.slots == slotsOf(run(27, 29, "g")))
        #expect(plan.changed[d1]?.sleep == sleep)
    }

    @Test func noopWhenAlreadyHeld() throws {
        let plan = try drop([d1: doc(run(27, 29, "g"))], [27, 28], .g)
        #expect(plan.noop && plan.changed.isEmpty)
    }

    @Test func overwritesAndUndoes() throws {
        let days = [d1: doc(run(25, 28, "b").merging(run(28, 30, "r")) { a, _ in a }, ["25": "keep", "28": "gone"])]
        let plan = try drop(days, [27, 28], .g)
        #expect(plan.changed[d1]?.slots == slotsOf(run(25, 27, "b").merging(run(27, 29, "g")) { a, _ in a }.merging([29: "r"]) { a, _ in a }))
        #expect(plan.undo.slots == [DropSlot(date: d1, slot: 27, prev: .b), DropSlot(date: d1, slot: 28, prev: .r)])
        let merged = days.merging(plan.changed) { _, n in n }
        let restored = undoDrop(merged, plan.undo)
        #expect(restored[d1]?.slots == days[d1]?.slots)
        #expect(restored[d1]?.notes["28"] == "gone")
    }

    @Test func ignoresFutureSlots() throws {
        let plan = try drop([:], [28, 29, 40], .g)
        #expect(plan.changed[d1]?.slots == slotsOf([28: "g"]))
    }
}

@Suite struct ExportTests {
    let range = DateRange(start: "2026-01-01", end: "2026-12-31")

    @Test func csvHasBOMHeaderAndRows() throws {
        let csv = try toCsv([:], range, in: ctx)
        #expect(csv.unicodeScalars.first?.value == 0xFEFF)
        #expect(String(csv.dropFirst()) == "date,start,end,duration_minutes,category,note\r\n")

        let d = doc([45: "g", 46: "g", 47: "b"], ["45": "late work"])
        let lines = try toCsv(["2026-10-15": d], range, in: ctx).dropFirst().components(separatedBy: "\r\n")
        #expect(lines == [
            "date,start,end,duration_minutes,category,note",
            "2026-10-15,2026-10-15T22:30:00-07:00,2026-10-15T23:30:00-07:00,60,wanted,late work",
            "2026-10-15,2026-10-15T23:30:00-07:00,2026-10-16T00:00:00-07:00,30,wasted,",
            "",
        ])
    }

    @Test func dstOffsets() throws {
        let spring = try exportRows(["2026-03-08": doc([2: "g", 6: "b", 47: "r"])], range, in: ctx)
        #expect(spring[0].start == "2026-03-08T01:00:00-08:00")
        #expect(spring[0].end == "2026-03-08T01:30:00-08:00")
        #expect(spring[1].start == "2026-03-08T03:00:00-07:00")
        #expect(spring[2].end == "2026-03-09T00:00:00-07:00")
        let fall = try exportRows(["2026-11-01": doc([0: "g", 1: "g", 4: "b", 47: "r"])], range, in: ctx)
        #expect(fall[0].start == "2026-11-01T00:00:00-07:00")
        #expect(fall[0].end == "2026-11-01T01:00:00-07:00")
        #expect(fall[1].start == "2026-11-01T02:00:00-08:00")
        #expect(fall[2].end == "2026-11-02T00:00:00-08:00")
    }

    @Test func csvQuoting() throws {
        #expect(csvField("plain") == "plain")
        #expect(csvField("a,b") == "\"a,b\"")
        #expect(csvField("say \"hi\"") == "\"say \"\"hi\"\"\"")
        #expect(csvField("line1\nline2") == "\"line1\nline2\"")
        let csv = try toCsv(["2026-06-01": doc([20: "g"], ["20": "a, \"b\"\nc"])], range, in: ctx)
        #expect(csv.contains(",wanted,\"a, \"\"b\"\"\nc\"\r\n"))
    }

    @Test func ordersAndFiltersByRange() throws {
        let days = ["2026-06-03": doc([0: "g"]), "2026-06-01": doc([10: "b"]), "2026-06-02": doc([0: "r"]), "2026-07-01": doc([0: "g"])]
        let rows = try exportRows(days, DateRange(start: "2026-06-01", end: "2026-06-03"), in: ctx)
        #expect(rows.map(\.date) == ["2026-06-01", "2026-06-02", "2026-06-03"])
        let within = try exportRows(["2026-06-01": doc([30: "g", 2: "b", 10: "r"])], range, in: ctx)
        #expect(within.map(\.category) == [.wasted, .unwanted, .wanted])
    }

    @Test func jsonShape() throws {
        var d = doc([20: "g"], ["20": "hi"])
        d.reflection = "good day"
        let text = try toJson(["2026-06-01": d, "2026-06-02": doc()], range,
                              meta: ExportMeta(exportedAt: "2026-10-18T20:00:00-07:00", timezone: tz), in: ctx)
        #expect(text.contains("\n  \"exportedAt\""))
        let obj = try #require(try JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any])
        let days = try #require(obj["days"] as? [[String: Any]])
        #expect(days.count == 2)
        #expect(days[0]["reflection"] as? String == "good day")
        #expect(days[1]["reflection"] == nil)
        let entries = try #require(obj["entries"] as? [[String: Any]])
        #expect(entries.count == 1)
        #expect(entries[0]["duration_minutes"] as? Int == 30)
        #expect(entries[0]["start"] as? String == "2026-06-01T10:00:00-07:00")
    }

    @Test func filenameAndCounts() throws {
        #expect(exportFilename(DateRange(start: "2026-01-01", end: "2026-01-31"), .csv) == "marbles-2026-01-01_2026-01-31.csv")
        let c = try exportCounts(["2026-06-01": doc([0: "g", 5: "b"]), "2026-06-02": doc()], range, in: ctx)
        #expect(c.days == 2 && c.entries == 2)
    }
}

@Suite struct FormsTests {
    let now = local(2026, 6, 10, 14, 20)

    @Test func defaultsAndLengths() {
        #expect(defaultStartFor("2026-06-09", now, in: ctx) == SlotStart(date: "2026-06-09", startSlot: 18))
        #expect(maxLengthFor("2026-06-09", 10, now, in: ctx) == 48)
        #expect(maxLengthFor("2026-06-11", 10, now, in: ctx) == 1)
        #expect(maxLengthFor(d1, 26, now, in: ctx) == 3)
        #expect(defaultLengthFor(d1, 28, now, in: ctx) == 1)
        #expect(defaultLengthFor(d1, 10, now, in: ctx) == 2)
    }

    @Test func labelsAndRanges() throws {
        #expect(formatDuration(3) == "1:30")
        #expect(durationOptions().count == 48)
        #expect(try startOptions()[1].label == "00:30")
        let r = try describeRange(46, 4)
        #expect(r.text == "23:00–01:00" && r.crossesMidnight)
        #expect(try formatEntryRange(e("2026-06-10", 46, 4), "2026-06-11") == "Wed 23:00 – 01:00")
        #expect(try formatEntryRange(e("2026-06-10", 46, 4), "2026-06-10") == "23:00 – Thu 01:00")
    }

    @Test func buildAndPlanSave() throws {
        var form = editForm(e(d1, 10, 2, .b, "x"))
        form.note = "  hello  "
        #expect(buildEntry(form, .g).note == "hello")
        form.note = "   "
        #expect(buildEntry(form, .g).note == nil)

        let plan = try planSave(days: [d1: doc(run(10, 12, "b"))], entry: e(d1, 10, 2, .g), now: now, sleep: sleep, tz: tz, in: ctx)
        guard case .success(let conflicts, let changed) = plan else { Issue.record("expected success"); return }
        #expect(conflicts == 2 && changed[d1]?.slots == slotsOf(run(10, 12, "g")))
        let bad = try planSave(days: [:], entry: e(d1, 40, 1), now: now, sleep: sleep, tz: tz, in: ctx)
        #expect(bad == .failure(error: "Entries cannot be in the future."))
        #expect(try touchedRange(d1) == DateRange(start: d1, end: d2))
    }
}
