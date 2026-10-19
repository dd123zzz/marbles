import Foundation

/// Hours slept in the window (wraps past midnight); 0 when start equals end.
public func sleepHours(_ w: SleepWindow) throws -> Double {
    let s = try hhmmToSlot(w.start)
    let e = try hhmmToSlot(w.end)
    return Double((e - s + slotsPerDay) % slotsPerDay) / 2
}

/// The day doc with a new sleep window; a missing doc is created empty.
public func withSleep(_ doc: DayDoc?, _ sleep: SleepWindow, fallback: SleepWindow, tz: String) -> DayDoc {
    var next = doc ?? DayDoc(slots: emptySlots(), notes: [:], sleep: fallback, tz: tz, v: 1)
    next.sleep = sleep
    return next
}
