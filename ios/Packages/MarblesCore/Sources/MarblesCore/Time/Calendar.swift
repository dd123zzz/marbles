import Foundation

/// The 7 date keys of the week containing k.
public func weekRange(_ k: DateKey, _ weekStart: WeekStart) throws -> [DateKey] {
    guard let p = validDateKeyParts(k) else { throw TimeError("Invalid date key: \(k)") }
    let dow = weekday(fromDays: daysFromCivil(p.y, p.m, p.d))
    let offset = weekStart == .mon ? (dow + 6) % 7 : dow
    let first = try addDays(k, -offset)
    return try (0..<7).map { try addDays(first, $0) }
}

public func monthRange(_ year: Int, _ month0: Int) -> (start: DateKey, end: DateKey) {
    let s = civilFromDays(daysFromCivil(year, month0 + 1, 1))
    let e = civilFromDays(daysFromCivil(year, month0 + 2, 1) - 1)
    return (makeDateKey(s.y, s.m, s.d), makeDateKey(e.y, e.m, e.d))
}

/// Rows of 7 cells; days outside the month are nil.
public func monthGrid(_ year: Int, _ month0: Int, _ weekStart: WeekStart) -> [[DateKey?]] {
    let firstDays = daysFromCivil(year, month0 + 1, 1)
    let daysInMonth = daysFromCivil(year, month0 + 2, 1) - firstDays
    let dow = weekday(fromDays: firstDays)
    let lead = weekStart == .mon ? (dow + 6) % 7 : dow
    var cells: [DateKey?] = Array(repeating: nil, count: lead)
    for i in 0..<daysInMonth {
        let c = civilFromDays(firstDays + i)
        cells.append(makeDateKey(c.y, c.m, c.d))
    }
    while cells.count % 7 != 0 { cells.append(nil) }
    return stride(from: 0, to: cells.count, by: 7).map { Array(cells[$0..<$0 + 7]) }
}
