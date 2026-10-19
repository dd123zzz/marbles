import Foundation
import Testing
@testable import MarblesCore

private let ctx = TimeContext.fixed("America/Los_Angeles")
private let sleepW = SleepWindow(start: "23:00", end: "07:00")
private let noSleep = SleepWindow(start: "00:00", end: "00:00")
private let day = "2026-06-10"

private func la(_ y: Int, _ m: Int, _ d: Int, _ h: Int = 0, _ min: Int = 0) -> Date {
    ctx.calendar.date(from: DateComponents(year: y, month: m, day: d, hour: h, minute: min))!
}

private func make(_ set: [Int: Character]) -> String {
    var a = [Character](repeating: ".", count: 48)
    for (i, c) in set { a[i] = c }
    return String(a)
}

private func fill(_ from: Int, _ to: Int, _ c: Character) -> [Int: Character] {
    Dictionary(uniqueKeysWithValues: (from..<to).map { ($0, c) })
}

private let evening = la(2026, 6, 10, 23, 59)
private let nextDay = la(2026, 6, 11, 12, 0)

private func marbles(_ slots: String?, _ sleep: SleepWindow = sleepW, _ now: Date = nextDay, date: String = day) throws -> [Marble] {
    try computeMarbles(date: date, slots: slots, sleep: sleep, now: now, in: ctx)
}

private func expectHalves(_ m: Marble, _ l: MarbleColor, _ r: MarbleColor) {
    #expect(m.left == l)
    #expect(m.right == r)
}

@Suite struct ComputeMarblesTests {
    @Test func returns24MarblesIndexedByHour() throws {
        let m = try marbles(nil)
        #expect(m.count == 24)
        #expect(m.map(\.hour) == Array(0..<24))
    }

    @Test func fullyLoggedHour() throws {
        let m = try marbles(make(fill(26, 28, "g")))
        #expect(m[13] == Marble(hour: 13, left: .g, right: .g, full: true, label: "13:00–14:00 Wanted"))
    }

    @Test func mixedHalves() throws {
        let m = try marbles(make([26: "g"]))
        #expect(m[13] == Marble(hour: 13, left: .g, right: .unlogged, full: false, label: "13:00–13:30 Wanted, 13:30–14:00 Unlogged"))
    }

    @Test func twoLoggedCategories() throws {
        let m = try marbles(make([20: "b", 21: "r"]))
        expectHalves(m[10], .b, .r)
        #expect(!m[10].full)
        #expect(m[10].label == "10:00–10:30 Wasted, 10:30–11:00 Unwanted")
    }

    @Test func rightHalfOnly() throws {
        let m = try marbles(make([21: "r"]))
        expectHalves(m[10], .unlogged, .r)
    }

    @Test func hour23LabelEndsAt24() throws {
        let m = try marbles(make(fill(46, 48, "b")))
        #expect(m[23].label == "23:00–24:00 Wasted")
    }

    @Test func sleepFillsUnloggedWrappingMidnight() throws {
        let m = try marbles(nil)
        for h in 0..<7 { expectHalves(m[h], .sleep, .sleep); #expect(m[h].full) }
        for h in 7..<23 { expectHalves(m[h], .unlogged, .unlogged) }
        expectHalves(m[23], .sleep, .sleep)
        #expect(m[3].label == "03:00–04:00 Sleep")
    }

    @Test func loggedBeatsSleep() throws {
        let m = try marbles(make([2: "g", 3: "b"]))
        expectHalves(m[1], .g, .b)
        expectHalves(m[0], .sleep, .sleep)
    }

    @Test func sleepBoundaryIsAwake() throws {
        let m = try marbles(nil, SleepWindow(start: "23:00", end: "07:30"))
        expectHalves(m[7], .sleep, .unlogged)
    }

    @Test func startEqualsEndDisablesSleep() throws {
        let m = try marbles(nil, noSleep)
        #expect(m.allSatisfy { $0.left == .unlogged && $0.right == .unlogged })
    }

    @Test func futureSlotsAreEmptyEvenInSleep() throws {
        let m = try marbles(nil, sleepW, la(2026, 6, 10, 14, 20))
        expectHalves(m[23], .empty, .empty)
        #expect(m[23].full)
        #expect(m[23].label == "23:00–24:00 Not yet")
        expectHalves(m[16], .empty, .empty)
        expectHalves(m[0], .sleep, .sleep)
    }

    @Test func wholeFutureDayIsEmpty() throws {
        let m = try marbles(nil, sleepW, la(2026, 6, 10, 14, 20), date: "2026-06-11")
        #expect(m.allSatisfy { $0.left == .empty && $0.right == .empty })
    }

    @Test func currentPartlyElapsedSlotIsUnlogged() throws {
        let m = try marbles(nil, sleepW, la(2026, 6, 10, 14, 20))
        expectHalves(m[14], .unlogged, .empty)
        #expect(!m[14].full)
        #expect(m[14].label == "14:00–14:30 Unlogged, 14:30–15:00 Not yet")
    }

    @Test func onSlotBoundaryStartedSlotIsUnlogged() throws {
        let m = try marbles(nil, sleepW, la(2026, 6, 10, 14, 30))
        expectHalves(m[14], .unlogged, .unlogged)
        #expect(m[15].left == .empty)
    }

    @Test func currentSlotInSleepWindowIsSleep() throws {
        let m = try marbles(nil, sleepW, la(2026, 6, 10, 3, 10))
        expectHalves(m[3], .sleep, .empty)
    }

    @Test func loggedWinsOverEmpty() throws {
        let m = try marbles(make([40: "g"]), sleepW, la(2026, 6, 10, 14, 20))
        expectHalves(m[20], .g, .empty)
    }

    @Test func toleratesShortSlotsString() throws {
        let m = try marbles("gg", noSleep)
        expectHalves(m[0], .g, .g)
        #expect(m[1].left == .unlogged)
    }

    @Suite struct DST {
        let now = la(2026, 3, 9, 12, 0)

        @Test func springForwardHour2IsNA() throws {
            let m = try marbles(nil, sleepW, now, date: "2026-03-08")
            #expect(m[2] == Marble(hour: 2, left: .na, right: .na, full: true, label: "02:00–03:00 Not applicable (DST)"))
            #expect(m.filter { $0.left == .na || $0.right == .na }.count == 1)
            #expect(m[1].left == .sleep)
            #expect(m[3].left == .sleep)
        }

        @Test func naBeatsLoggedAndSleep() throws {
            let m = try marbles(make([4: "g", 5: "g"]), sleepW, now, date: "2026-03-08")
            expectHalves(m[2], .na, .na)
        }

        @Test func naBeatsFuture() throws {
            let m = try marbles(nil, sleepW, la(2026, 3, 8, 1, 0), date: "2026-03-08")
            expectHalves(m[2], .na, .na)
            #expect(m[3].left == .empty)
        }

        @Test func fallBackHasNoNA() throws {
            let m = try marbles(nil, sleepW, la(2026, 11, 2, 12, 0), date: "2026-11-01")
            #expect(!m.contains { $0.left == .na || $0.right == .na })
            expectHalves(m[1], .sleep, .sleep)
        }

        @Test func naNotCountedInSummary() throws {
            let m = try marbles(nil, noSleep, now, date: "2026-03-08")
            #expect(summarize(m).unlogged == 23)
        }
    }
}

@Suite struct SummaryTests {
    private func marble(_ l: MarbleColor, _ r: MarbleColor) -> Marble {
        Marble(hour: 0, left: l, right: r, full: l == r, label: "")
    }

    @Test func countsHalfHourPerHalf() {
        let sum = summarize([
            marble(.g, .g), marble(.g, .b), marble(.r, .sleep), marble(.unlogged, .empty), marble(.na, .na),
        ])
        #expect(sum == Summary(g: 1.5, b: 0.5, r: 0.5, sleep: 0.5, unlogged: 0.5))
    }

    @Test func emptyInputIsZero() {
        #expect(summarize([]) == Summary())
    }

    @Test func fullDayAdds24() throws {
        let m = try marbles(make(fill(14, 26, "g").merging(fill(26, 31, "b")) { a, _ in a }.merging(fill(31, 33, "r")) { a, _ in a }))
        let s = summarize(m)
        #expect(s.g == 6)
        #expect(s.b == 2.5)
        #expect(s.r == 1)
        #expect(s.sleep == 8)
        #expect(s.unlogged == 6.5)
        #expect(s.g + s.b + s.r + s.sleep + s.unlogged == 24)
    }

    @Test func formatsAllFive() {
        #expect(formatSummary(Summary(g: 6, b: 2.5, r: 1, sleep: 8, unlogged: 3.5)) == "G 6h · B 2.5h · R 1h · Sleep 8h · Unlogged 3.5h")
        #expect(formatSummary(Summary()) == "G 0h · B 0h · R 0h · Sleep 0h · Unlogged 0h")
    }

    @Test func endToEndExample() throws {
        let slots = make(fill(26, 38, "g").merging(fill(38, 43, "b")) { a, _ in a }.merging(fill(43, 45, "r")) { a, _ in a })
        let m = try marbles(slots, sleepW, evening)
        #expect(formatSummary(summarize(m)) == "G 6h · B 2.5h · R 1h · Sleep 8h · Unlogged 6.5h")
    }
}

@Suite struct JarConstantsTests {
    @Test func colors() {
        let expected: [MarbleColor: String] = [
            .g: "#16a34a", .b: "#111827", .r: "#dc2626", .sleep: "#4f46e5",
            .unlogged: "#9ca3af", .empty: "transparent", .na: "#e5e7eb",
        ]
        for c in MarbleColor.allCases { #expect(marbleColorHex(c) == expected[c]) }
    }

    @Test func labels() {
        #expect(categoryLabel(.g) == "Wanted")
        #expect(categoryLabel(.b) == "Wasted")
        #expect(categoryLabel(.r) == "Unwanted")
        #expect(categoryLabel(.sleep) == "Sleep")
        #expect(categoryLabel(.unlogged) == "Unlogged")
        #expect(categoryLabel(.empty) == "Not yet")
        #expect(categoryLabel(.na).contains("Not applicable"))
    }
}

@Suite struct LoggedSlotsTests {
    @Test func hasLoggedSlotsFalseCases() {
        #expect(!hasLoggedSlots(nil))
        #expect(!hasLoggedSlots(""))
        #expect(!hasLoggedSlots(String(repeating: ".", count: 48)))
    }

    @Test func hasLoggedSlotsTrueCases() {
        for c: Character in ["g", "b", "r"] { #expect(hasLoggedSlots(make([47: c]))) }
        #expect(hasLoggedSlots(make([0: "g"])))
    }

    @Test func isEmptyPastDayOnlyBeforeToday() {
        let blank = String(repeating: ".", count: 48)
        #expect(isEmptyPastDay("2026-10-13", "2026-10-14", nil))
        #expect(isEmptyPastDay("2026-10-13", "2026-10-14", blank))
        #expect(!isEmptyPastDay("2026-10-13", "2026-10-14", make([5: "b"])))
        #expect(!isEmptyPastDay("2026-10-14", "2026-10-14", blank))
        #expect(!isEmptyPastDay("2026-10-15", "2026-10-14", nil))
    }
}
