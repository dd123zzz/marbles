import Foundation
import Testing
@testable import MarblesCore

private let ctx = TimeContext.fixed("America/Los_Angeles")
private let sleepW = SleepWindow(start: "23:00", end: "07:00")
private func la(_ y: Int, _ m: Int, _ d: Int, _ h: Int = 0, _ min: Int = 0) -> Date {
    ctx.calendar.date(from: DateComponents(year: y, month: m, day: d, hour: h, minute: min))!
}

private let later = la(2026, 6, 12, 12, 0)

private func doc(_ slots: String, _ sleep: SleepWindow = sleepW) -> DayDoc {
    DayDoc(slots: slots, notes: [:], sleep: sleep, tz: "x")
}

private func slotsWith(_ set: [Int: Character]) -> String {
    String((0..<48).map { set[$0] ?? "." })
}

private func range(_ from: Int, _ to: Int, _ c: Character) -> [Int: Character] {
    Dictionary(uniqueKeysWithValues: (from..<to).map { ($0, c) })
}

private func near(_ a: Double, _ b: Double) -> Bool { abs(a - b) < 1e-9 }

@Suite struct StatsTests {
    @Test func singlePastDay() throws {
        let slots = slotsWith(range(16, 20, "g").merging(range(20, 22, "b")) { a, _ in a }.merging(range(22, 23, "r")) { a, _ in a })
        let s = try computeStats(dates: ["2026-06-10"], days: ["2026-06-10": doc(slots)], settingsSleep: sleepW, now: later, in: ctx)
        #expect(s.hours == StatsHours(g: 2, b: 1, r: 0.5, sleep: 8, unlogged: 12.5, notYet: 0, na: 0))
        #expect(near(s.awakePct.g, 2.0 / 16 * 100))
        #expect(near(s.awakePct.g + s.awakePct.b + s.awakePct.r + s.awakePct.unlogged, 100))
        let d = s.dayPct
        #expect(near(d.g + d.b + d.r + d.sleep + d.unlogged + d.notYet, 100))
        #expect(near(d.sleep, 8.0 / 24 * 100))
    }

    @Test func usesDocSleepSnapshotFallingBackToSettings() throws {
        let s = try computeStats(
            dates: ["2026-06-10", "2026-06-11"],
            days: ["2026-06-10": doc(slotsWith([:]), SleepWindow(start: "00:00", end: "00:00"))],
            settingsSleep: sleepW, now: later, in: ctx)
        #expect(s.hours.sleep == 8)
        #expect(s.hours.unlogged == 24 + 16)
    }

    @Test func futureTimeIsNotYet() throws {
        let s = try computeStats(dates: ["2026-06-10", "2026-06-11"], days: [:], settingsSleep: sleepW, now: la(2026, 6, 10, 12, 0), in: ctx)
        #expect(s.hours.sleep == 7)
        #expect(s.hours.unlogged == 5.5)
        #expect(s.hours.notYet == 11.5 + 24)
        #expect(s.awakePct.unlogged == 100)
        #expect(near(s.dayPct.notYet, 35.5 / 48 * 100))
    }

    @Test func guardsDivideByZero() throws {
        let s = try computeStats(dates: [], days: [:], settingsSleep: sleepW, now: later, in: ctx)
        #expect(s.awakePct == AwakePct(g: 0, b: 0, r: 0, unlogged: 0))
        #expect(s.dayPct == DayPct(g: 0, b: 0, r: 0, sleep: 0, unlogged: 0, notYet: 0))

        let allSleep = try computeStats(dates: ["2026-06-10"], days: [:], settingsSleep: SleepWindow(start: "00:00", end: "24:00"), now: later, in: ctx)
        #expect(allSleep.hours.sleep == 24)
        #expect(allSleep.awakePct.g == 0)
    }

    @Test func excludesNonexistentDSTHoursFromDenominator() throws {
        let s = try computeStats(dates: ["2026-03-08"], days: [:], settingsSleep: SleepWindow(start: "00:00", end: "00:00"), now: la(2026, 3, 10, 12, 0), in: ctx)
        #expect(s.hours.na == 1)
        #expect(s.hours.unlogged == 23)
        #expect(near(s.dayPct.unlogged, 100))
    }

    @Test func matchesJarTotals() throws {
        let slots = slotsWith(range(0, 48, "g"))
        let s = try computeStats(dates: ["2026-06-08", "2026-06-09"], days: ["2026-06-08": doc(slots)], settingsSleep: sleepW, now: later, in: ctx)
        #expect(s.hours.g == 24)
        #expect(s.hours.sleep == 8)
        #expect(s.hours.unlogged == 16)
    }

    @Test func roundPctToOneDecimal() {
        #expect(roundPct(33.3333) == 33.3)
        #expect(roundPct(66.66667) == 66.7)
        #expect(roundPct(0) == 0)
    }
}
