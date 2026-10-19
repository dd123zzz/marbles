import Foundation

private let weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
private let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
private let monthsLong = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]

public let weekdaysMonFirst = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
public let weekdaysSunFirst = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

private func parts(_ k: DateKey) throws -> (y: Int, m: Int, d: Int) {
    guard let p = validDateKeyParts(k) else { throw TimeError("Invalid date key: \(k)") }
    return p
}

/// "Mon"
public func weekdayShort(_ k: DateKey) throws -> String {
    let p = try parts(k)
    return weekdays[weekday(fromDays: daysFromCivil(p.y, p.m, p.d))]
}

/// "Oct 12"
public func monthDay(_ k: DateKey) throws -> String {
    let p = try parts(k)
    return "\(months[p.m - 1]) \(p.d)"
}

/// "Mon Oct 12"
public func weekdayMonthDay(_ k: DateKey) throws -> String {
    "\(try weekdayShort(k)) \(try monthDay(k))"
}

/// "Mon Oct 12, 2026"
public func fullDate(_ k: DateKey) throws -> String {
    "\(try weekdayMonthDay(k)), \(try parts(k).y)"
}

/// "October 2026"
public func monthTitle(_ year: Int, _ month0: Int) -> String {
    "\(monthsLong[month0]) \(year)"
}

/// Parses "YYYY-MM"; nil when malformed.
public func parseYearMonth(_ ym: String) -> (year: Int, month0: Int)? {
    let b = Array(ym.utf8)
    guard b.count == 7, b[4] == 45 else { return nil }
    let digits = [0, 1, 2, 3, 5, 6]
    guard digits.allSatisfy({ b[$0] >= 48 && b[$0] <= 57 }) else { return nil }
    let year = Int(b[0] - 48) * 1000 + Int(b[1] - 48) * 100 + Int(b[2] - 48) * 10 + Int(b[3] - 48)
    let month = Int(b[5] - 48) * 10 + Int(b[6] - 48)
    guard (1...12).contains(month) else { return nil }
    return (year, month - 1)
}

/// "2026-10" for the month `offset` months from (year, month0).
public func shiftMonth(_ year: Int, _ month0: Int, _ offset: Int) -> String {
    let total = year * 12 + month0 + offset
    let y = floorDiv(total, 12)
    let m = total - y * 12 + 1
    let ys = String(y)
    return "\(String(repeating: "0", count: max(0, 4 - ys.count)))\(ys)-\(m < 10 ? "0" : "")\(m)"
}
