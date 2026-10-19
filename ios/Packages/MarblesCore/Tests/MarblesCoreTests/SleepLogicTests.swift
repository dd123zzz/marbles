import Foundation
import Testing
@testable import MarblesCore

struct SleepLogicTests {
    @Test func sleepHoursWrapsPastMidnight() throws {
        #expect(try sleepHours(SleepWindow(start: "23:00", end: "07:00")) == 8)
        #expect(try sleepHours(SleepWindow(start: "22:30", end: "06:00")) == 7.5)
        #expect(try sleepHours(SleepWindow(start: "01:00", end: "09:00")) == 8)
        #expect(try sleepHours(SleepWindow(start: "07:00", end: "07:00")) == 0)
    }

    @Test func withSleepKeepsSlotsAndCreatesMissingDoc() {
        let night = SleepWindow(start: "22:00", end: "06:00")
        let fallback = SleepWindow(start: "23:00", end: "07:00")
        let created = withSleep(nil, night, fallback: fallback, tz: "UTC")
        #expect(created.slots == emptySlots() && created.sleep == night && created.tz == "UTC")
        let doc = DayDoc(slots: "g" + String(repeating: ".", count: 47), notes: ["0": "x"], sleep: fallback, tz: "UTC")
        let next = withSleep(doc, night, fallback: fallback, tz: "Asia/Kolkata")
        #expect(next.slots == doc.slots && next.notes == doc.notes && next.tz == "UTC" && next.sleep == night)
    }
}
