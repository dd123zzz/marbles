import Foundation

private func pad2(_ n: Int) -> String { n < 10 ? "0\(n)" : "\(n)" }

/// Slot 0...48 to "HH:mm"; 48 is "24:00".
public func slotToHHmm(_ slot: Int) throws -> HHmm {
    guard slot >= 0, slot <= slotsPerDay else { throw TimeError("Invalid slot: \(slot)") }
    let mins = slot * 30
    return "\(pad2(mins / 60)):\(pad2(mins % 60))"
}

/// "HH:mm" to slot index, flooring to the 30-minute boundary. "24:00" is 48.
public func hhmmToSlot(_ t: HHmm) throws -> Int {
    let parts = t.split(separator: ":", omittingEmptySubsequences: false)
    func isDigits(_ s: Substring, _ counts: ClosedRange<Int>) -> Bool {
        counts.contains(s.utf8.count) && s.utf8.allSatisfy { $0 >= 48 && $0 <= 57 }
    }
    guard parts.count == 2, isDigits(parts[0], 1...2), isDigits(parts[1], 2...2),
          let h = Int(parts[0]), let min = Int(parts[1])
    else { throw TimeError("Invalid time: \(t)") }
    if min > 59 || h > 24 || (h == 24 && min != 0) { throw TimeError("Invalid time: \(t)") }
    return h * 2 + min / 30
}

/// e.g. "13:00–14:30"
public func formatSlotRange(_ start: Int, _ length: Int) throws -> String {
    "\(try slotToHHmm(start))–\(try slotToHHmm(start + length))"
}

/// Local wall-clock start of a slot. Slot 48 is the next day's midnight.
public func slotStartDate(_ k: DateKey, _ slot: Int, in ctx: TimeContext) throws -> Date {
    guard let p = validDateKeyParts(k) else { throw TimeError("Invalid date key: \(k)") }
    return wallDate(year: p.y, month: p.m, day: p.d, hour: 0, minute: slot * 30, in: ctx)
}

public func currentSlotInfo(_ now: Date, in ctx: TimeContext) -> (date: DateKey, slot: Int) {
    let p = localParts(now, in: ctx)
    return (makeDateKey(p.year, p.month, p.day), (p.hour * 60 + p.minute) / 30)
}

/// The previous full hour: 14:20 and 14:00 both give 13:00; 00:20 gives 23:00 the day before.
public func defaultStart(_ now: Date, in ctx: TimeContext) -> (date: DateKey, startSlot: Int) {
    let p = localParts(now, in: ctx)
    let today = makeDateKey(p.year, p.month, p.day)
    if p.hour == 0 {
        let c = civilFromDays(daysFromCivil(p.year, p.month, p.day) - 1)
        return (makeDateKey(c.y, c.m, c.d), 46)
    }
    return (today, (p.hour - 1) * 2)
}

public struct EntryPart: Sendable, Equatable, Hashable {
    public var date: DateKey
    public var startSlot: Int
    public var length: Int
    public init(date: DateKey, startSlot: Int, length: Int) {
        self.date = date
        self.startSlot = startSlot
        self.length = length
    }
}

/// Splits an entry that runs past midnight into one part per calendar day.
public func splitAcrossDays(_ e: EntryPart) throws -> [EntryPart] {
    guard isValidDateKey(e.date) else { throw TimeError("Invalid date: \(e.date)") }
    guard e.startSlot >= 0, e.startSlot < slotsPerDay else { throw TimeError("Invalid start slot: \(e.startSlot)") }
    guard e.length >= 1, e.length <= slotsPerDay else { throw TimeError("Invalid length: \(e.length)") }
    var parts: [EntryPart] = []
    var date = e.date
    var start = e.startSlot
    var remaining = e.length
    while remaining > 0 {
        let len = min(remaining, slotsPerDay - start)
        parts.append(EntryPart(date: date, startSlot: start, length: len))
        remaining -= len
        date = try addDays(date, 1)
        start = 0
    }
    return parts
}

public func splitAcrossDays(_ e: Entry) throws -> [EntryPart] {
    try splitAcrossDays(EntryPart(date: e.date, startSlot: e.startSlot, length: e.length))
}

/// True if the slot starts after now. A slot that has already begun is not future.
public func isFutureSlot(_ k: DateKey, _ slot: Int, _ now: Date, in ctx: TimeContext) throws -> Bool {
    try slotStartDate(k, slot, in: ctx).timeIntervalSince1970 > now.timeIntervalSince1970
}

/// True if the slot has fully elapsed (its end is at or before now).
public func isSlotPast(_ k: DateKey, _ slot: Int, _ now: Date, in ctx: TimeContext) throws -> Bool {
    try slotStartDate(k, slot + 1, in: ctx).timeIntervalSince1970 <= now.timeIntervalSince1970
}

/// True if any slot of the entry, including those after midnight, is in the future.
public func isEntryInFuture(_ e: EntryPart, _ now: Date, in ctx: TimeContext) throws -> Bool {
    try splitAcrossDays(e).contains { try isFutureSlot($0.date, $0.startSlot + $0.length - 1, now, in: ctx) }
}

public func isEntryInFuture(_ e: Entry, _ now: Date, in ctx: TimeContext) throws -> Bool {
    try isEntryInFuture(EntryPart(date: e.date, startSlot: e.startSlot, length: e.length), now, in: ctx)
}

/// Slots whose local wall-clock time does not exist on that day (spring-forward).
/// On fall-back days the repeated hour is ignored.
public func nonexistentSlots(_ k: DateKey, in ctx: TimeContext) throws -> Set<Int> {
    guard let p = validDateKeyParts(k) else { throw TimeError("Invalid date key: \(k)") }
    var result = Set<Int>()
    for slot in 0..<slotsPerDay {
        let h = slot / 2
        let min = (slot % 2) * 30
        let t = wallDate(year: p.y, month: p.m, day: p.d, hour: h, minute: min, in: ctx)
        let lp = localParts(t, in: ctx)
        if lp.hour != h || lp.minute != min { result.insert(slot) }
    }
    return result
}

/// The sleep window applies within each calendar day and wraps past midnight.
public func isInSleepWindow(_ slot: Int, _ sleep: SleepWindow) throws -> Bool {
    let s = try hhmmToSlot(sleep.start)
    let e = try hhmmToSlot(sleep.end)
    if s == e { return false }
    return s < e ? (slot >= s && slot < e) : (slot >= s || slot < e)
}
