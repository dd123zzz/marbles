import Foundation

public struct TimeError: Error, Sendable, Equatable, CustomStringConvertible {
    public let message: String
    public init(_ message: String) { self.message = message }
    public var description: String { message }
}

// MARK: - Civil calendar arithmetic (proleptic Gregorian, timezone independent)

/// Days since 1970-01-01 for a civil date. Month may be any integer (normalized like JS Date).
func daysFromCivil(_ y: Int, _ m1: Int, _ d: Int) -> Int {
    // normalize month (1-based) into year
    let m0 = m1 - 1
    var year = y + Int((Double(m0) / 12.0).rounded(.down))
    let month = ((m0 % 12) + 12) % 12 + 1
    if month <= 2 { year -= 1 }
    let era = (year >= 0 ? year : year - 399) / 400
    let yoe = year - era * 400
    let mp = (month + 9) % 12
    let doy = (153 * mp + 2) / 5 + 1 - 1
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
    return era * 146097 + doe - 719468 + (d - 1)
}

func civilFromDays(_ z0: Int) -> (y: Int, m: Int, d: Int) {
    let z = z0 + 719468
    let era = (z >= 0 ? z : z - 146096) / 146097
    let doe = z - era * 146097
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365
    let y = yoe + era * 400
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
    let mp = (5 * doy + 2) / 153
    let d = doy - (153 * mp + 2) / 5 + 1
    let m = mp < 10 ? mp + 3 : mp - 9
    return (m <= 2 ? y + 1 : y, m, d)
}

/// 0 = Sunday, like JS getDay().
func weekday(fromDays days: Int) -> Int {
    (((days + 4) % 7) + 7) % 7
}

func floorDiv(_ a: Int, _ b: Int) -> Int {
    let q = a / b
    return (a % b != 0 && (a < 0) != (b < 0)) ? q - 1 : q
}

struct LocalParts {
    var year: Int
    var month: Int
    var day: Int
    var hour: Int
    var minute: Int
    var second: Int
    var weekday: Int
}

func localParts(_ date: Date, in ctx: TimeContext) -> LocalParts {
    let t = Int(date.timeIntervalSince1970.rounded(.down))
    let local = t + ctx.timeZone.secondsFromGMT(for: date)
    let days = floorDiv(local, 86400)
    let secs = local - days * 86400
    let c = civilFromDays(days)
    return LocalParts(
        year: c.y, month: c.m, day: c.d,
        hour: secs / 3600, minute: (secs % 3600) / 60, second: secs % 60,
        weekday: weekday(fromDays: days))
}

/// Mirrors JS `new Date(y, m, d, h, min)`: fields overflow, a skipped wall time moves forward
/// (the pre-transition offset is used) and a repeated wall time resolves to the earlier instant.
func wallDate(year: Int, month: Int, day: Int, hour: Int = 0, minute: Int = 0, in ctx: TimeContext) -> Date {
    let wall = daysFromCivil(year, month, day) * 86400 + hour * 3600 + minute * 60
    let tz = ctx.timeZone
    func offset(_ t: Int) -> Int { tz.secondsFromGMT(for: Date(timeIntervalSince1970: TimeInterval(t))) }
    let before = offset(wall - 86400)
    let after = offset(wall + 86400)
    let t1 = wall - before
    let t2 = wall - after
    let ok1 = offset(t1) == before
    let ok2 = offset(t2) == after
    let t: Int
    if ok1 && ok2 { t = min(t1, t2) }
    else if ok1 { t = t1 }
    else if ok2 { t = t2 }
    else { t = t1 }
    return Date(timeIntervalSince1970: TimeInterval(t))
}

// MARK: - Date keys

private func pad(_ n: Int, _ width: Int = 2) -> String {
    let s = String(n)
    return s.count >= width ? s : String(repeating: "0", count: width - s.count) + s
}

func makeDateKey(_ y: Int, _ m: Int, _ d: Int) -> DateKey {
    "\(pad(y, 4))-\(pad(m))-\(pad(d))"
}

/// Parses `YYYY-MM-DD` (ASCII digits only) without validating the calendar date.
func parseDateKeyParts(_ k: String) -> (y: Int, m: Int, d: Int)? {
    let b = Array(k.utf8)
    guard b.count == 10, b[4] == 45, b[7] == 45 else { return nil }
    func num(_ r: Range<Int>) -> Int? {
        var v = 0
        for i in r {
            guard b[i] >= 48, b[i] <= 57 else { return nil }
            v = v * 10 + Int(b[i] - 48)
        }
        return v
    }
    guard let y = num(0..<4), let m = num(5..<7), let d = num(8..<10) else { return nil }
    return (y, m, d)
}

func validDateKeyParts(_ k: String) -> (y: Int, m: Int, d: Int)? {
    guard let p = parseDateKeyParts(k), (1...12).contains(p.m), p.d >= 1 else { return nil }
    let c = civilFromDays(daysFromCivil(p.y, p.m, p.d))
    return (c.y == p.y && c.m == p.m && c.d == p.d) ? p : nil
}

public func toDateKey(_ d: Date, in ctx: TimeContext) -> DateKey {
    let p = localParts(d, in: ctx)
    return makeDateKey(p.year, p.month, p.day)
}

public func isValidDateKey(_ k: String) -> Bool {
    validDateKeyParts(k) != nil
}

/// Local midnight of the given date key. Throws on an invalid key.
public func parseDateKey(_ k: DateKey, in ctx: TimeContext) throws -> Date {
    guard let p = validDateKeyParts(k) else { throw TimeError("Invalid date key: \(k)") }
    return wallDate(year: p.y, month: p.m, day: p.d, in: ctx)
}

public func addDays(_ k: DateKey, _ n: Int) throws -> DateKey {
    guard let p = validDateKeyParts(k) else { throw TimeError("Invalid date key: \(k)") }
    let c = civilFromDays(daysFromCivil(p.y, p.m, p.d) + n)
    return makeDateKey(c.y, c.m, c.d)
}

public func compareDateKeys(_ a: DateKey, _ b: DateKey) -> Int {
    a < b ? -1 : (a > b ? 1 : 0)
}
