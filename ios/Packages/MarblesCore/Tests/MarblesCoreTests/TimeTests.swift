import Foundation
import Testing
@testable import MarblesCore

let la = TimeContext.fixed("America/Los_Angeles")

/// Equivalent of JS `new Date(y, m-1, d, h, min, s)` in America/Los_Angeles.
func at(_ y: Int, _ mo: Int, _ d: Int, _ h: Int = 0, _ mi: Int = 0, _ s: Double = 0, ctx: TimeContext = la) -> Date {
    wallDate(year: y, month: mo, day: d, hour: h, minute: mi, in: ctx).addingTimeInterval(s)
}

func ints(_ x: Int...) -> [Int] { x }

func part(_ date: String, _ start: Int, _ len: Int) -> EntryPart { EntryPart(date: date, startSlot: start, length: len) }

@Suite("Time: date keys")
struct TimeDateKeyTests {
    @Test func formatsLocalDates() {
        #expect(toDateKey(at(2026, 1, 5, 23, 59), in: la) == "2026-01-05")
        #expect(toDateKey(at(2026, 12, 31, 0, 0), in: la) == "2026-12-31")
    }
    @Test func parsesToLocalMidnight() throws {
        let d = try parseDateKey("2026-06-10", in: la)
        let c = la.calendar.dateComponents([.year, .month, .day, .hour, .minute], from: d)
        #expect(ints(c.year!, c.month!, c.day!, c.hour!, c.minute!) == [2026, 6, 10, 0, 0])
    }
    @Test func parsesMidnightOnDstDay() throws {
        let d = try parseDateKey("2026-03-08", in: la)
        let c = la.calendar.dateComponents([.day, .hour], from: d)
        #expect(c.day == 8 && c.hour == 0)
    }
    @Test func throwsOnInvalidKeys() {
        #expect(throws: TimeError.self) { try parseDateKey("2026-02-30", in: la) }
        #expect(throws: TimeError.self) { try parseDateKey("nope", in: la) }
    }
    @Test func validatesKeys() {
        #expect(isValidDateKey("2026-02-28"))
        #expect(isValidDateKey("2028-02-29"))
        #expect(!isValidDateKey("2026-02-29"))
        #expect(!isValidDateKey("2026-13-01"))
        #expect(!isValidDateKey("2026-00-10"))
        #expect(!isValidDateKey("2026-1-10"))
        #expect(!isValidDateKey(""))
        #expect(!isValidDateKey("2026-01-10T00:00"))
        #expect(!isValidDateKey("٢٠٢٦-01-10"))
    }
    @Test func addsDays() throws {
        #expect(try addDays("2026-01-31", 1) == "2026-02-01")
        #expect(try addDays("2026-12-31", 1) == "2027-01-01")
        #expect(try addDays("2027-01-01", -1) == "2026-12-31")
        #expect(try addDays("2028-02-28", 1) == "2028-02-29")
        #expect(try addDays("2026-03-07", 1) == "2026-03-08")
        #expect(try addDays("2026-03-08", 1) == "2026-03-09")
        #expect(try addDays("2026-11-01", 1) == "2026-11-02")
        #expect(try addDays("2026-11-02", -1) == "2026-11-01")
        #expect(try addDays("2026-05-10", 0) == "2026-05-10")
        #expect(try addDays("2026-01-01", 365) == "2027-01-01")
    }
    @Test func comparesKeys() {
        #expect(compareDateKeys("2026-01-01", "2026-01-02") == -1)
        #expect(compareDateKeys("2026-01-02", "2026-01-01") == 1)
        #expect(compareDateKeys("2026-01-01", "2026-01-01") == 0)
    }
}

@Suite("Time: slot conversion")
struct TimeSlotConversionTests {
    @Test func slotToHHmmValues() throws {
        #expect(try slotToHHmm(0) == "00:00")
        #expect(try slotToHHmm(1) == "00:30")
        #expect(try slotToHHmm(26) == "13:00")
        #expect(try slotToHHmm(47) == "23:30")
        #expect(try slotToHHmm(48) == "24:00")
    }
    @Test func slotToHHmmRejectsOutOfRange() {
        #expect(throws: TimeError.self) { try slotToHHmm(-1) }
        #expect(throws: TimeError.self) { try slotToHHmm(49) }
    }
    @Test func hhmmToSlotBoundaries() throws {
        #expect(try hhmmToSlot("00:00") == 0)
        #expect(try hhmmToSlot("00:30") == 1)
        #expect(try hhmmToSlot("23:30") == 47)
        #expect(try hhmmToSlot("24:00") == 48)
        #expect(try hhmmToSlot("07:00") == 14)
        #expect(try hhmmToSlot("7:00") == 14)
    }
    @Test func hhmmToSlotFloors() throws {
        #expect(try hhmmToSlot("13:29") == 26)
        #expect(try hhmmToSlot("13:31") == 27)
        #expect(try hhmmToSlot("13:59") == 27)
    }
    @Test func hhmmToSlotRejectsGarbage() {
        for bad in ["25:00", "24:30", "12:60", "abc", "", "1:2", "123:00", "12:00:00", "-1:00"] {
            #expect(throws: TimeError.self) { try hhmmToSlot(bad) }
        }
    }
    @Test func roundTripsEverySlot() throws {
        for s in 0...48 { #expect(try hhmmToSlot(slotToHHmm(s)) == s) }
    }
    @Test func formatsSlotRange() throws {
        #expect(try formatSlotRange(26, 3) == "13:00–14:30")
        #expect(try formatSlotRange(46, 2) == "23:00–24:00")
        #expect(try formatSlotRange(0, 48) == "00:00–24:00")
    }
}

@Suite("Time: slotStartDate / currentSlotInfo")
struct TimeSlotDateTests {
    @Test func buildsLocalWallClockDates() throws {
        let d = try slotStartDate("2026-06-10", 27, in: la)
        let p = localParts(d, in: la)
        #expect(ints(p.day, p.hour, p.minute) == [10, 13, 30])
    }
    @Test func slot48IsNextMidnight() throws {
        let d = try slotStartDate("2026-12-31", 48, in: la)
        #expect(toDateKey(d, in: la) == "2027-01-01")
        #expect(localParts(d, in: la).hour == 0)
    }
    @Test func currentSlotInfoReturnsContainingSlot() {
        func info(_ d: Date) -> String { let i = currentSlotInfo(d, in: la); return "\(i.date)#\(i.slot)" }
        #expect(info(at(2026, 6, 10, 14, 20)) == "2026-06-10#28")
        #expect(info(at(2026, 6, 10, 14, 30)) == "2026-06-10#29")
        #expect(info(at(2026, 6, 10, 14, 29, 59)) == "2026-06-10#28")
        #expect(info(at(2026, 6, 10, 0, 0)) == "2026-06-10#0")
        #expect(info(at(2026, 6, 10, 23, 59)) == "2026-06-10#47")
    }
}

@Suite("Time: defaultStart")
struct TimeDefaultStartTests {
    func ds(_ d: Date) -> String { let r = defaultStart(d, in: la); return "\(r.date)#\(r.startSlot)" }
    @Test func previousFullHour() { #expect(ds(at(2026, 6, 10, 14, 20)) == "2026-06-10#26") }
    @Test func onTheHourGoesBack() { #expect(ds(at(2026, 6, 10, 14, 0)) == "2026-06-10#26") }
    @Test func justBeforeNextHour() { #expect(ds(at(2026, 6, 10, 14, 59, 59)) == "2026-06-10#26") }
    @Test func afterMidnightGivesPreviousDay() {
        #expect(ds(at(2026, 6, 10, 0, 20)) == "2026-06-09#46")
        #expect(ds(at(2026, 6, 10, 0, 0)) == "2026-06-09#46")
    }
    @Test func atOne() { #expect(ds(at(2026, 6, 10, 1, 0)) == "2026-06-10#0") }
    @Test func crossesYear() { #expect(ds(at(2027, 1, 1, 0, 5)) == "2026-12-31#46") }
}

@Suite("Time: splitAcrossDays")
struct TimeSplitTests {
    @Test func keepsSameDayWhole() throws {
        #expect(try splitAcrossDays(part("2026-06-10", 26, 3)) == [part("2026-06-10", 26, 3)])
    }
    @Test func endingAtMidnightDoesNotSpill() throws {
        #expect(try splitAcrossDays(part("2026-06-10", 46, 2)) == [part("2026-06-10", 46, 2)])
    }
    @Test func splitsAcrossTwoDays() throws {
        #expect(try splitAcrossDays(part("2026-06-10", 46, 4)) == [part("2026-06-10", 46, 2), part("2026-06-11", 0, 2)])
    }
    @Test func splits24hFromNoon() throws {
        #expect(try splitAcrossDays(part("2026-06-10", 24, 48)) == [part("2026-06-10", 24, 24), part("2026-06-11", 0, 24)])
    }
    @Test func fullDayIsOnePart() throws {
        #expect(try splitAcrossDays(part("2026-06-10", 0, 48)) == [part("2026-06-10", 0, 48)])
    }
    @Test func spans24hFrom2330AcrossYear() throws {
        #expect(try splitAcrossDays(part("2026-12-31", 47, 48)) == [part("2026-12-31", 47, 1), part("2027-01-01", 0, 47)])
    }
    @Test func totalLengthPreserved() throws {
        for start in 0..<48 {
            for len in [1, 2, 17, 48] {
                let total = try splitAcrossDays(part("2026-06-10", start, len)).reduce(0) { $0 + $1.length }
                #expect(total == len)
            }
        }
    }
    @Test func throwsOnInvalidInput() {
        for p in [part("2026-06-10", 0, 0), part("2026-06-10", 0, 49), part("2026-06-10", -1, 2),
                  part("2026-06-10", 48, 1), part("2026-02-30", 0, 1)] {
            #expect(throws: TimeError.self) { try splitAcrossDays(p) }
        }
    }
    @Test func acceptsEntry() throws {
        let e = Entry(date: "2026-06-10", startSlot: 46, length: 4, category: .g)
        #expect(try splitAcrossDays(e).count == 2)
    }
}

@Suite("Time: future / past slots")
struct TimeFuturePastTests {
    let now = at(2026, 6, 10, 14, 20)

    @Test func beganSlotIsNotFuture() throws {
        #expect(try !isFutureSlot("2026-06-10", 28, now, in: la))
        #expect(try !isFutureSlot("2026-06-10", 27, now, in: la))
    }
    @Test func nextSlotIsFuture() throws { #expect(try isFutureSlot("2026-06-10", 29, now, in: la)) }
    @Test func slotStartingNowIsNotFuture() throws {
        #expect(try !isFutureSlot("2026-06-10", 28, at(2026, 6, 10, 14, 0), in: la))
        #expect(try isFutureSlot("2026-06-10", 29, at(2026, 6, 10, 14, 29, 59.999), in: la))
        #expect(try !isFutureSlot("2026-06-10", 29, at(2026, 6, 10, 14, 30), in: la))
    }
    @Test func otherDays() throws {
        #expect(try isFutureSlot("2026-06-11", 0, now, in: la))
        #expect(try !isFutureSlot("2026-06-09", 47, now, in: la))
    }
    @Test func slotPastNeedsFullElapse() throws {
        #expect(try isSlotPast("2026-06-10", 27, now, in: la))
        #expect(try !isSlotPast("2026-06-10", 28, now, in: la))
        #expect(try isSlotPast("2026-06-10", 28, at(2026, 6, 10, 14, 30), in: la))
        #expect(try isSlotPast("2026-06-09", 47, at(2026, 6, 10, 0, 0), in: la))
        #expect(try !isSlotPast("2026-06-09", 47, at(2026, 6, 9, 23, 59), in: la))
    }
    @Test func entryInFuture() throws {
        #expect(try !isEntryInFuture(part("2026-06-10", 26, 2), now, in: la))
        #expect(try !isEntryInFuture(part("2026-06-10", 26, 3), now, in: la))
        #expect(try isEntryInFuture(part("2026-06-10", 26, 4), now, in: la))
        #expect(try isEntryInFuture(part("2026-06-10", 29, 1), now, in: la))
        #expect(try isEntryInFuture(part("2026-06-11", 0, 1), now, in: la))
    }
    @Test func entryInFutureChecksAfterMidnight() throws {
        let late = at(2026, 6, 11, 0, 20)
        #expect(try isEntryInFuture(part("2026-06-10", 46, 4), late, in: la))
        #expect(try !isEntryInFuture(part("2026-06-10", 46, 3), late, in: la))
        #expect(try !isEntryInFuture(part("2026-06-10", 46, 4), at(2026, 6, 11, 0, 30), in: la))
    }
}

@Suite("Time: DST")
struct TimeDstTests {
    @Test func springForwardNonexistent() throws {
        #expect(try nonexistentSlots("2026-03-08", in: la) == [4, 5])
    }
    @Test func fallBackHasNone() throws {
        #expect(try nonexistentSlots("2026-11-01", in: la).isEmpty)
    }
    @Test func ordinaryDaysHaveNone() throws {
        for k in ["2026-06-10", "2026-03-07", "2026-03-09"] {
            #expect(try nonexistentSlots(k, in: la).isEmpty)
        }
    }
    @Test func everyDstDayOf2026And2027() throws {
        // US: 2026-03-08, 2026-11-01, 2027-03-14, 2027-11-07
        #expect(try nonexistentSlots("2027-03-14", in: la) == [4, 5])
        #expect(try nonexistentSlots("2027-11-07", in: la).isEmpty)
    }
    @Test func wallClockAfterSpringForward() throws {
        let d = try slotStartDate("2026-03-08", 6, in: la)
        let p = localParts(d, in: la)
        #expect(ints(p.hour, p.minute) == [3, 0])
        let end = try slotStartDate("2026-03-08", 48, in: la)
        #expect(toDateKey(end, in: la) == "2026-03-09")
        #expect(localParts(end, in: la).hour == 0)
    }
    @Test func skippedWallTimeMovesForwardLikeJS() throws {
        // JS: new Date(2026, 2, 8, 2, 30) is 03:30 PDT
        let d = try slotStartDate("2026-03-08", 5, in: la)
        let p = localParts(d, in: la)
        #expect(ints(p.hour, p.minute) == [3, 30])
        #expect(d == Date(timeIntervalSince1970: 1_772_965_800)) // 2026-03-08T10:30:00Z
    }
    @Test func repeatedWallTimePicksEarlierLikeJS() throws {
        // 01:30 on 2026-11-01 happens twice; JS picks the first (PDT, 08:30Z)
        let d = try slotStartDate("2026-11-01", 3, in: la)
        #expect(d == Date(timeIntervalSince1970: 1_793_521_800)) // 2026-11-01T08:30:00Z
    }
    @Test func wallClockOnFallBack() throws {
        let d = try slotStartDate("2026-11-01", 6, in: la)
        let p = localParts(d, in: la)
        #expect(ints(p.hour, p.minute) == [3, 0])
        #expect(try toDateKey(slotStartDate("2026-11-01", 48, in: la), in: la) == "2026-11-02")
    }
    @Test func lordHoweThirtyMinuteShift() throws {
        let lh = TimeContext.fixed("Australia/Lord_Howe")
        // 2026-10-04 02:00 -> 02:30 (spring forward 30 min): slots 4 (02:00..02:29) don't exist
        #expect(try nonexistentSlots("2026-10-04", in: lh) == [4])
        #expect(try nonexistentSlots("2026-04-05", in: lh).isEmpty)
    }
    @Test func kolkataHasNoDst() throws {
        let k = TimeContext.fixed("Asia/Kolkata")
        let d = try slotStartDate("2026-06-10", 27, in: k)
        let p = localParts(d, in: k)
        #expect(ints(p.hour, p.minute) == [13, 30])
        #expect(d == Date(timeIntervalSince1970: 1_781_078_400)) // 2026-06-10T08:00:00Z
    }
}

@Suite("Time: sleep window")
struct TimeSleepTests {
    let night = SleepWindow(start: "23:00", end: "07:00")
    @Test func wrapsPastMidnight() throws {
        for s in 0..<14 { #expect(try isInSleepWindow(s, night)) }
        for s in 14..<46 { #expect(try !isInSleepWindow(s, night)) }
        for s in 46..<48 { #expect(try isInSleepWindow(s, night)) }
    }
    @Test func sameDayWindow() throws {
        let nap = SleepWindow(start: "13:00", end: "14:30")
        let r = try [25, 26, 27, 28, 29, 30].map { try isInSleepWindow($0, nap) }
        #expect(r == [false, true, true, true, false, false])
    }
    @Test func startEqualsEndMeansNoSleep() throws {
        for s in 0..<48 { #expect(try !isInSleepWindow(s, SleepWindow(start: "00:00", end: "00:00"))) }
        #expect(try !isInSleepWindow(10, SleepWindow(start: "22:00", end: "22:00")))
    }
    @Test func midnightEdges() throws {
        #expect(try isInSleepWindow(47, SleepWindow(start: "22:00", end: "24:00")))
        #expect(try isInSleepWindow(0, SleepWindow(start: "00:00", end: "06:00")))
        #expect(try !isInSleepWindow(12, SleepWindow(start: "00:00", end: "06:00")))
    }
    @Test func offBoundaryFloors() throws {
        #expect(try isInSleepWindow(46, SleepWindow(start: "23:15", end: "07:10")))
        #expect(try !isInSleepWindow(14, SleepWindow(start: "23:15", end: "07:10")))
    }
}

@Suite("Time: weekRange")
struct TimeWeekRangeTests {
    @Test func mondayStart() throws {
        #expect(try weekRange("2026-06-10", .mon) == ["2026-06-08", "2026-06-09", "2026-06-10", "2026-06-11", "2026-06-12", "2026-06-13", "2026-06-14"])
    }
    @Test func sundayStart() throws {
        let w = try weekRange("2026-06-10", .sun)
        #expect(w[0] == "2026-06-07" && w[6] == "2026-06-13")
    }
    @Test func sunday() throws {
        #expect(try weekRange("2026-06-14", .mon)[0] == "2026-06-08")
        #expect(try weekRange("2026-06-14", .sun)[0] == "2026-06-14")
    }
    @Test func monday() throws {
        #expect(try weekRange("2026-06-08", .mon)[0] == "2026-06-08")
        #expect(try weekRange("2026-06-08", .sun)[0] == "2026-06-07")
    }
    @Test func crossesMonth() throws {
        #expect(try weekRange("2026-03-01", .mon) == ["2026-02-23", "2026-02-24", "2026-02-25", "2026-02-26", "2026-02-27", "2026-02-28", "2026-03-01"])
    }
    @Test func crossesYear() throws {
        #expect(try weekRange("2026-12-31", .mon) == ["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03"])
        #expect(try weekRange("2027-01-01", .sun)[0] == "2026-12-27")
    }
    @Test func spansDstDays() throws {
        #expect(try weekRange("2026-03-08", .sun).count == 7)
        #expect(try weekRange("2026-03-08", .sun)[0] == "2026-03-08")
        #expect(try weekRange("2026-11-01", .mon) == ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"])
    }
}

@Suite("Time: month helpers")
struct TimeMonthTests {
    @Test func monthRanges() {
        #expect(monthRange(2026, 5) == (start: "2026-06-01", end: "2026-06-30"))
        #expect(monthRange(2028, 1) == (start: "2028-02-01", end: "2028-02-29"))
        #expect(monthRange(2026, 1) == (start: "2026-02-01", end: "2026-02-28"))
        #expect(monthRange(2026, 11) == (start: "2026-12-01", end: "2026-12-31"))
    }
    @Test func monthRangeOverflowNormalizes() {
        #expect(monthRange(2026, 12) == (start: "2027-01-01", end: "2027-01-31"))
        #expect(monthRange(2026, -1) == (start: "2025-12-01", end: "2025-12-31"))
    }
    @Test func gridMondayStart() {
        let g = monthGrid(2026, 5, .mon)
        #expect(g.allSatisfy { $0.count == 7 })
        #expect(g.count == 5)
        #expect(g[0][0] == "2026-06-01")
        #expect(g[4] == ["2026-06-29", "2026-06-30", nil, nil, nil, nil, nil])
    }
    @Test func gridSundayStart() {
        let g = monthGrid(2026, 5, .sun)
        #expect(g[0] == [nil, "2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05", "2026-06-06"])
        #expect(g.count == 5)
    }
    @Test func containsEveryDayOnceInOrder() {
        for ws in [WeekStart.mon, .sun] {
            for m in 0..<12 {
                let flat = monthGrid(2026, m, ws).flatMap { $0 }.compactMap { $0 }
                let r = monthRange(2026, m)
                #expect(flat.first == r.start)
                #expect(flat.last == r.end)
                #expect(Set(flat).count == flat.count)
                #expect(flat == flat.sorted())
            }
        }
    }
}
