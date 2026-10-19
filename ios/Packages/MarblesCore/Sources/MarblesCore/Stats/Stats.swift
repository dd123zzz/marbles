import Foundation

public struct StatsHours: Sendable, Equatable, Hashable {
    public var g = 0.0
    public var b = 0.0
    public var r = 0.0
    public var sleep = 0.0
    public var unlogged = 0.0
    public var notYet = 0.0
    public var na = 0.0

    public init(g: Double = 0, b: Double = 0, r: Double = 0, sleep: Double = 0, unlogged: Double = 0, notYet: Double = 0, na: Double = 0) {
        self.g = g
        self.b = b
        self.r = r
        self.sleep = sleep
        self.unlogged = unlogged
        self.notYet = notYet
        self.na = na
    }
}

public struct AwakePct: Sendable, Equatable, Hashable {
    public var g: Double
    public var b: Double
    public var r: Double
    public var unlogged: Double
}

public struct DayPct: Sendable, Equatable, Hashable {
    public var g: Double
    public var b: Double
    public var r: Double
    public var sleep: Double
    public var unlogged: Double
    public var notYet: Double
}

public struct Stats: Sendable, Equatable, Hashable {
    public var hours: StatsHours
    /// Share of awake time (g + b + r + unlogged; sleep excluded), 0...100
    public var awakePct: AwakePct
    /// Share of all 24-hour days in range minus DST-nonexistent hours, 0...100
    public var dayPct: DayPct
}

private func pct(_ part: Double, _ whole: Double) -> Double {
    whole > 0 ? (part / whole) * 100 : 0
}

/// Percentages are exact here; round with `roundPct` for display only.
public func computeStats(
    dates: [DateKey],
    days: [DateKey: DayDoc],
    settingsSleep: SleepWindow,
    now: Date,
    in ctx: TimeContext
) throws -> Stats {
    var hours = StatsHours()
    for date in dates {
        let doc = days[date]
        let marbles = try computeMarbles(
            date: date,
            slots: doc?.slots,
            sleep: doc?.sleep ?? settingsSleep,
            now: now,
            in: ctx
        )
        for m in marbles {
            for c in [m.left, m.right] {
                switch c {
                case .empty: hours.notYet += 0.5
                case .g: hours.g += 0.5
                case .b: hours.b += 0.5
                case .r: hours.r += 0.5
                case .sleep: hours.sleep += 0.5
                case .unlogged: hours.unlogged += 0.5
                case .na: hours.na += 0.5
                }
            }
        }
    }

    let awake = hours.g + hours.b + hours.r + hours.unlogged
    let total = Double(dates.count * 24) - hours.na
    return Stats(
        hours: hours,
        awakePct: AwakePct(
            g: pct(hours.g, awake),
            b: pct(hours.b, awake),
            r: pct(hours.r, awake),
            unlogged: pct(hours.unlogged, awake)
        ),
        dayPct: DayPct(
            g: pct(hours.g, total),
            b: pct(hours.b, total),
            r: pct(hours.r, total),
            sleep: pct(hours.sleep, total),
            unlogged: pct(hours.unlogged, total),
            notYet: pct(hours.notYet, total)
        )
    )
}

/// Rounds to 1 decimal, for display.
public func roundPct(_ n: Double) -> Double {
    (n * 10).rounded(.toNearestOrAwayFromZero) / 10
}
