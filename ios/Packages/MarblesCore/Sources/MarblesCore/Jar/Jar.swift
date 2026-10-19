import Foundation

public func categoryLabel(_ color: MarbleColor) -> String {
    switch color {
    case .g: "Wanted"
    case .b: "Wasted"
    case .r: "Unwanted"
    case .sleep: "Sleep"
    case .unlogged: "Unlogged"
    case .empty: "Not yet"
    case .na: "Not applicable (DST)"
    }
}

public func marbleColorHex(_ color: MarbleColor) -> String {
    switch color {
    case .g: "#16a34a"
    case .b: "#111827"
    case .r: "#dc2626"
    case .sleep: "#4f46e5"
    case .unlogged: "#9ca3af"
    case .empty: "transparent"
    case .na: "#e5e7eb"
    }
}

/// 24 marbles, index = hour (hour 0 first). Each is split into two 30-minute halves.
/// Precedence: DST n/a > logged > future (empty) > sleep > unlogged.
public func computeMarbles(
    date: DateKey,
    slots: String?,
    sleep: SleepWindow,
    now: Date,
    in ctx: TimeContext
) throws -> [Marble] {
    let missing = try nonexistentSlots(date, in: ctx)
    let chars = Array((slots ?? "").unicodeScalars)

    func colorOf(_ slot: Int) throws -> MarbleColor {
        if missing.contains(slot) { return .na }
        if slot < chars.count {
            switch chars[slot] {
            case "g": return .g
            case "b": return .b
            case "r": return .r
            default: break
            }
        }
        if try isFutureSlot(date, slot, now, in: ctx) { return .empty }
        if try isInSleepWindow(slot, sleep) { return .sleep }
        return .unlogged
    }

    return try (0..<(slotsPerDay / 2)).map { hour in
        let left = try colorOf(hour * 2)
        let right = try colorOf(hour * 2 + 1)
        let start = try slotToHHmm(hour * 2)
        let mid = try slotToHHmm(hour * 2 + 1)
        let end = try slotToHHmm(hour * 2 + 2)
        let label =
            left == right
            ? "\(start)–\(end) \(categoryLabel(left))"
            : "\(start)–\(mid) \(categoryLabel(left)), \(mid)–\(end) \(categoryLabel(right))"
        return Marble(hour: hour, left: left, right: right, full: left == right, label: label)
    }
}

/// True when any slot is logged (g/b/r); a missing doc or all-'.' slots is not.
public func hasLoggedSlots(_ slots: String?) -> Bool {
    guard let slots else { return false }
    return slots.unicodeScalars.contains { $0 == "g" || $0 == "b" || $0 == "r" }
}

/// A day before `today` (both YYYY-MM-DD) with nothing logged; shown as an empty jar.
public func isEmptyPastDay(_ date: DateKey, _ today: DateKey, _ slots: String? = nil) -> Bool {
    date < today && !hasLoggedSlots(slots)
}

public struct Summary: Sendable, Equatable, Hashable {
    public var g: Double
    public var b: Double
    public var r: Double
    public var sleep: Double
    public var unlogged: Double

    public init(g: Double = 0, b: Double = 0, r: Double = 0, sleep: Double = 0, unlogged: Double = 0) {
        self.g = g
        self.b = b
        self.r = r
        self.sleep = sleep
        self.unlogged = unlogged
    }
}

/// Hours per category; each half marble counts 0.5. Empty and n/a halves are not counted.
public func summarize(_ marbles: [Marble]) -> Summary {
    var sum = Summary()
    for m in marbles {
        for c in [m.left, m.right] {
            switch c {
            case .g: sum.g += 0.5
            case .b: sum.b += 0.5
            case .r: sum.r += 0.5
            case .sleep: sum.sleep += 0.5
            case .unlogged: sum.unlogged += 0.5
            case .empty, .na: break
            }
        }
    }
    return sum
}

private func hours(_ n: Double) -> String {
    n == n.rounded() ? "\(Int(n))h" : "\(String(format: "%.1f", n))h"
}

public func formatSummary(_ sum: Summary) -> String {
    [
        "G \(hours(sum.g))",
        "B \(hours(sum.b))",
        "R \(hours(sum.r))",
        "Sleep \(hours(sum.sleep))",
        "Unlogged \(hours(sum.unlogged))",
    ].joined(separator: " · ")
}
