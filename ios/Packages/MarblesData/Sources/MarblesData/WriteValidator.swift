import Foundation
import MarblesCore

public enum WriteViolation: Error, Equatable, Sendable {
    case badKeys
    case badSlots
    case badNotes
    case badSleep
    case badTimeZone
    case badReflection
    case badVersion
    case badUpdatedAt
    case badDateKey
    case badSettings
}

/// Mirrors `validDay` / `validSettings` in firestore.rules.
public enum WriteValidator {
    public static let dayKeys: Set<String> = ["slots", "notes", "sleep", "tz", "reflection", "updatedAt", "v"]
    public static let requiredDayKeys: Set<String> = ["slots", "notes", "sleep", "tz", "v"]
    public static let settingsKeys: Set<String> = ["sleepStart", "sleepEnd", "weekStart", "theme", "v"]
    public static let maxNoteLength = 200
    public static let maxReflectionLength = 1000

    public static func validate(_ doc: DayDoc) throws {
        try validateDay(DayDocCodec.encode(doc))
    }

    /// Validates an encoded day payload (including the `updatedAt` marker).
    public static func validateDay(_ d: [String: Any], id: DateKey? = nil) throws {
        if let id, !isDateKey(id) { throw WriteViolation.badDateKey }
        let keys = Set(d.keys)
        guard keys.isSubset(of: dayKeys), requiredDayKeys.isSubset(of: keys) else { throw WriteViolation.badKeys }
        guard let slots = d["slots"] as? String, isSlots(slots) else { throw WriteViolation.badSlots }
        guard let notes = d["notes"] as? [String: Any], notes.count <= slotsPerDay else { throw WriteViolation.badNotes }
        for (k, v) in notes {
            guard let n = Int(k), (0..<slotsPerDay).contains(n), String(n) == k,
                  let s = v as? String, s.utf16.count <= maxNoteLength else { throw WriteViolation.badNotes }
        }
        guard let sleep = d["sleep"] as? [String: Any], Set(sleep.keys) == ["start", "end"],
              let start = sleep["start"] as? String, isClock(start),
              let end = sleep["end"] as? String, isClock(end) else { throw WriteViolation.badSleep }
        guard let tz = d["tz"] as? String, tz.utf16.count <= 64 else { throw WriteViolation.badTimeZone }
        if let r = d["reflection"] {
            guard let s = r as? String, s.utf16.count <= maxReflectionLength else { throw WriteViolation.badReflection }
        }
        guard let u = d["updatedAt"] as? ServerTimestamp, u == .marker else { throw WriteViolation.badUpdatedAt }
        guard isInt(d["v"], 1) else { throw WriteViolation.badVersion }
    }

    /// Validates a settings merge patch; any subset of the settings keys, plus `v`.
    public static func validateSettingsPatch(_ d: [String: Any]) throws {
        guard Set(d.keys).isSubset(of: settingsKeys) else { throw WriteViolation.badKeys }
        guard isInt(d["v"], 1) else { throw WriteViolation.badVersion }
        for key in ["sleepStart", "sleepEnd"] where d[key] != nil {
            guard let s = d[key] as? String, isTime(s) else { throw WriteViolation.badSettings }
        }
        if d["weekStart"] != nil {
            guard let s = d["weekStart"] as? String, WeekStart(rawValue: s) != nil else { throw WriteViolation.badSettings }
        }
        if d["theme"] != nil {
            guard let s = d["theme"] as? String, ThemePref(rawValue: s) != nil else { throw WriteViolation.badSettings }
        }
    }

    // MARK: - Primitives

    static func isInt(_ value: Any?, _ expected: Int) -> Bool {
        guard let value else { return false }
        if value is Bool || value is Double || value is Float { return false }
        return (value as? Int) == expected
    }

    static func isSlots(_ s: String) -> Bool {
        let u = Array(s.utf8)
        return u.count == slotsPerDay && u.allSatisfy { $0 == 0x67 || $0 == 0x62 || $0 == 0x72 || $0 == 0x2E }
    }

    static func isDateKey(_ s: String) -> Bool {
        let u = Array(s.utf8)
        guard u.count == 10 else { return false }
        return u.enumerated().allSatisfy { i, c in
            (i == 4 || i == 7) ? c == 0x2D : (0x30...0x39).contains(c)
        }
    }

    private static func clock(_ s: String) -> (h: Int, m: Int)? {
        let u = Array(s.utf8)
        guard u.count == 5, u[2] == 0x3A else { return nil }
        let digits = [0, 1, 3, 4].map { u[$0] }
        guard digits.allSatisfy({ (0x30...0x39).contains($0) }) else { return nil }
        let h = Int(u[0] - 0x30) * 10 + Int(u[1] - 0x30)
        let m = Int(u[3] - 0x30) * 10 + Int(u[4] - 0x30)
        guard h <= 23, m <= 59 else { return nil }
        return (h, m)
    }

    /// `validClock`: HH:mm
    public static func isClock(_ s: String) -> Bool { clock(s) != nil }

    /// `validTime`: HH:00 or HH:30
    public static func isTime(_ s: String) -> Bool {
        guard let c = clock(s) else { return false }
        return c.m == 0 || c.m == 30
    }
}
