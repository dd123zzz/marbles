import Testing
@testable import MarblesCore

@Suite struct LabelsTests {
    @Test func dateLabels() throws {
        #expect(try weekdayShort("2026-10-12") == "Mon")
        #expect(try weekdayShort("2026-10-18") == "Sun")
        #expect(try monthDay("2026-10-12") == "Oct 12")
        #expect(try monthDay("2026-01-05") == "Jan 5")
        #expect(try weekdayMonthDay("2026-10-12") == "Mon Oct 12")
        #expect(try fullDate("2026-10-12") == "Mon Oct 12, 2026")
        #expect(throws: TimeError.self) { try weekdayShort("2026-13-01") }
    }

    @Test func monthTitleAndParse() {
        #expect(monthTitle(2026, 9) == "October 2026")
        let p = parseYearMonth("2026-10")
        #expect(p?.year == 2026)
        #expect(p?.month0 == 9)
        #expect(parseYearMonth("2026-00") == nil)
        #expect(parseYearMonth("2026-13") == nil)
        #expect(parseYearMonth("2026-1") == nil)
        #expect(parseYearMonth("2026-10-01") == nil)
        #expect(parseYearMonth("abcd-10") == nil)
    }

    @Test func shiftMonthRollsOverYears() {
        #expect(shiftMonth(2026, 9, 0) == "2026-10")
        #expect(shiftMonth(2026, 11, 1) == "2027-01")
        #expect(shiftMonth(2026, 0, -1) == "2025-12")
        #expect(shiftMonth(2026, 5, -17) == "2025-01")
        #expect(shiftMonth(2026, 5, 25) == "2028-07")
    }

    @Test func weekdayLists() {
        #expect(weekdaysMonFirst.first == "Mon")
        #expect(weekdaysSunFirst.first == "Sun")
    }
}
