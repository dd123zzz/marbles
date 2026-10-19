import Foundation

public struct DateRange: Sendable, Equatable, Hashable {
    public var start: DateKey
    public var end: DateKey
    public init(start: DateKey, end: DateKey) {
        self.start = start
        self.end = end
    }
}

public enum ExportCategory: String, Sendable, Equatable, Hashable {
    case wanted, wasted, unwanted
}

public struct ExportRow: Sendable, Equatable, Hashable {
    public var date: DateKey
    public var start: String
    public var end: String
    public var durationMinutes: Int
    public var category: ExportCategory
    public var note: String
}

public struct ExportMeta: Sendable, Equatable, Hashable {
    public var exportedAt: String
    public var timezone: String
    public init(exportedAt: String, timezone: String) {
        self.exportedAt = exportedAt
        self.timezone = timezone
    }
}

public let csvHeader = "date,start,end,duration_minutes,category,note"

private func pad(_ n: Int, _ width: Int = 2) -> String {
    let s = String(n)
    return s.count >= width ? s : String(repeating: "0", count: width - s.count) + s
}

/// ISO 8601 with the local UTC offset in effect at that instant (DST-aware).
public func isoWithOffset(_ d: Date, in ctx: TimeContext) -> String {
    let p = localParts(d, in: ctx)
    let off = ctx.timeZone.secondsFromGMT(for: d) / 60
    let sign = off < 0 ? "-" : "+"
    let abs = Swift.abs(off)
    return "\(pad(p.year, 4))-\(pad(p.month))-\(pad(p.day))T\(pad(p.hour)):\(pad(p.minute)):\(pad(p.second))"
        + "\(sign)\(pad(abs / 60)):\(pad(abs % 60))"
}

private func datesIn(_ days: DayMap, _ range: DateRange) -> [DateKey] {
    days.keys.filter { $0 >= range.start && $0 <= range.end }.sorted()
}

private func categoryName(_ c: Category) -> ExportCategory {
    switch c {
    case .g: .wanted
    case .b: .wasted
    case .r: .unwanted
    }
}

/// One row per entry run per day, ordered by date then start. A midnight-crossing
/// entry appears as two rows: one ending at 24:00 (next day 00:00) and one starting at 00:00.
public func exportRows(_ days: DayMap, _ range: DateRange, in ctx: TimeContext) throws -> [ExportRow] {
    var rows: [ExportRow] = []
    for date in datesIn(days, range) {
        for e in entriesFromDay(date, days[date]) {
            rows.append(ExportRow(
                date: date,
                start: isoWithOffset(try slotStartDate(date, e.startSlot, in: ctx), in: ctx),
                end: isoWithOffset(try slotStartDate(date, e.startSlot + e.length, in: ctx), in: ctx),
                durationMinutes: e.length * 30,
                category: categoryName(e.category),
                note: e.note ?? ""
            ))
        }
    }
    return rows
}

/// RFC 4180 field quoting.
public func csvField(_ v: String) -> String {
    let needsQuotes = v.unicodeScalars.contains { $0 == "\"" || $0 == "," || $0 == "\r" || $0 == "\n" }
    return needsQuotes ? "\"" + v.replacingOccurrences(of: "\"", with: "\"\"") + "\"" : v
}

public func csvField(_ v: Int) -> String { String(v) }

/// UTF-8 text with a leading BOM so spreadsheets detect the encoding.
public func toCsv(_ days: DayMap, _ range: DateRange, in ctx: TimeContext) throws -> String {
    let lines = try exportRows(days, range, in: ctx).map { r in
        [csvField(r.date), csvField(r.start), csvField(r.end), csvField(r.durationMinutes),
         csvField(r.category.rawValue), csvField(r.note)].joined(separator: ",")
    }
    return "\u{FEFF}" + ([csvHeader] + lines).joined(separator: "\r\n") + "\r\n"
}

// MARK: - JSON (mirrors JSON.stringify(value, null, 2) so web and iOS exports are byte-identical)

private func jsonString(_ s: String) -> String {
    var out = "\""
    for u in s.unicodeScalars {
        switch u {
        case "\"": out += "\\\""
        case "\\": out += "\\\\"
        case "\u{08}": out += "\\b"
        case "\u{0C}": out += "\\f"
        case "\n": out += "\\n"
        case "\r": out += "\\r"
        case "\t": out += "\\t"
        default:
            if u.value < 0x20 {
                out += "\\u" + String(format: "%04x", u.value)
            } else {
                out.unicodeScalars.append(u)
            }
        }
    }
    return out + "\""
}

private indirect enum JSONValue {
    case string(String)
    case number(Int)
    case object([(String, JSONValue)])
    case array([JSONValue])

    func render(_ depth: Int = 0) -> String {
        let pad = String(repeating: "  ", count: depth + 1)
        let close = String(repeating: "  ", count: depth)
        switch self {
        case .string(let s): return jsonString(s)
        case .number(let n): return String(n)
        case .object(let members):
            if members.isEmpty { return "{}" }
            let body = members.map { "\(pad)\(jsonString($0.0)): \($0.1.render(depth + 1))" }
            return "{\n" + body.joined(separator: ",\n") + "\n\(close)}"
        case .array(let items):
            if items.isEmpty { return "[]" }
            let body = items.map { pad + $0.render(depth + 1) }
            return "[\n" + body.joined(separator: ",\n") + "\n\(close)]"
        }
    }
}

/// JS object key order: canonical integer keys ascending, then the rest.
private func jsKeyOrder(_ keys: [String]) -> [String] {
    func isIndex(_ k: String) -> Bool { k == "0" || (!k.hasPrefix("0") && !k.isEmpty && k.allSatisfy { $0.isASCII && $0.isNumber }) }
    let ints = keys.filter(isIndex).sorted { (Int($0) ?? 0) < (Int($1) ?? 0) }
    let rest = keys.filter { !isIndex($0) }.sorted()
    return ints + rest
}

private func rowJSON(_ r: ExportRow) -> JSONValue {
    .object([
        ("date", .string(r.date)), ("start", .string(r.start)), ("end", .string(r.end)),
        ("duration_minutes", .number(r.durationMinutes)), ("category", .string(r.category.rawValue)),
        ("note", .string(r.note)),
    ])
}

public func toJson(_ days: DayMap, _ range: DateRange, meta: ExportMeta, in ctx: TimeContext) throws -> String {
    let dayValues: [JSONValue] = datesIn(days, range).map { date in
        let d = days[date]!
        var members: [(String, JSONValue)] = [
            ("date", .string(date)),
            ("slots", .string(d.slots)),
            ("notes", .object(jsKeyOrder(Array(d.notes.keys)).map { ($0, .string(d.notes[$0]!)) })),
            ("sleep", .object([("start", .string(d.sleep.start)), ("end", .string(d.sleep.end))])),
            ("tz", .string(d.tz)),
        ]
        if let r = d.reflection { members.append(("reflection", .string(r))) }
        return .object(members)
    }
    let out = JSONValue.object([
        ("exportedAt", .string(meta.exportedAt)),
        ("timezone", .string(meta.timezone)),
        ("range", .object([("start", .string(range.start)), ("end", .string(range.end))])),
        ("days", .array(dayValues)),
        ("entries", .array(try exportRows(days, range, in: ctx).map(rowJSON))),
    ])
    return out.render()
}

public enum ExportFormat: String, Sendable { case csv, json }

public func exportFilename(_ range: DateRange, _ format: ExportFormat) -> String {
    "marbles-\(range.start)_\(range.end).\(format.rawValue)"
}

/// Number of days with data and entries that fall in range.
public func exportCounts(_ days: DayMap, _ range: DateRange, in ctx: TimeContext) throws -> (days: Int, entries: Int) {
    (datesIn(days, range).count, try exportRows(days, range, in: ctx).count)
}
