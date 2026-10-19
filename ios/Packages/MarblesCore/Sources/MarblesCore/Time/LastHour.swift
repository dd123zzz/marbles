import Foundation

private let windowSlots = 2

/// The two wall-clock slots ending at `now` rounded to the nearest :00/:30
/// (:15 and :45 round up; seconds are ignored), in chronological order. The
/// window may start yesterday. Spring-forward slots that do not exist are
/// skipped and the walk continues back until two real slots are found.
public func lastHourWindow(now: Date, in ctx: TimeContext) -> [SlotRef] {
    let p = localParts(now, in: ctx)
    let endIndex = (p.hour * 60 + p.minute + 15) / 30
    var dayNumber = daysFromCivil(p.year, p.month, p.day)
    var slot = endIndex - 1
    var missing: [Int: Set<Int>] = [:]
    var result: [SlotRef] = []
    while result.count < windowSlots {
        if slot < 0 {
            dayNumber -= 1
            slot = slotsPerDay - 1
        }
        let c = civilFromDays(dayNumber)
        let key = makeDateKey(c.y, c.m, c.d)
        let skip: Set<Int>
        if let s = missing[dayNumber] {
            skip = s
        } else {
            let s = (try? nonexistentSlots(key, in: ctx)) ?? []
            missing[dayNumber] = s
            skip = s
        }
        if !skip.contains(slot) { result.insert(SlotRef(date: key, slot: slot), at: 0) }
        slot -= 1
    }
    return result
}
