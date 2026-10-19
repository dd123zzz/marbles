import Foundation
import MarblesCore

/// Placeholder for `updatedAt`; the Firestore layer swaps it for `FieldValue.serverTimestamp()` (W-8).
public enum ServerTimestamp: Sendable, Equatable {
    case marker
}

public enum DayDocCodecError: Error, Equatable {
    case missingKey(String)
    case wrongType(String)
}

public enum DayDocCodec {
    /// Full-document payload for a day write (W-1). `reflection` is trimmed and omitted when empty (W-6).
    public static func encode(_ doc: DayDoc) throws -> [String: Any] {
        var out: [String: Any] = [
            "slots": doc.slots,
            "notes": doc.notes,
            "sleep": ["start": doc.sleep.start, "end": doc.sleep.end],
            "tz": doc.tz,
            "v": doc.v,
            "updatedAt": ServerTimestamp.marker,
        ]
        if let reflection = doc.reflection?.trimmingCharacters(in: .whitespacesAndNewlines), !reflection.isEmpty {
            out["reflection"] = reflection
        }
        return out
    }

    public static func decode(_ data: [String: Any]) throws -> DayDoc {
        func req<T>(_ key: String, _ type: T.Type) throws -> T {
            guard let raw = data[key] else { throw DayDocCodecError.missingKey(key) }
            guard let value = raw as? T else { throw DayDocCodecError.wrongType(key) }
            return value
        }
        let sleep = try req("sleep", [String: Any].self)
        guard let start = sleep["start"] else { throw DayDocCodecError.missingKey("sleep.start") }
        guard let end = sleep["end"] else { throw DayDocCodecError.missingKey("sleep.end") }
        guard let startS = start as? String else { throw DayDocCodecError.wrongType("sleep.start") }
        guard let endS = end as? String else { throw DayDocCodecError.wrongType("sleep.end") }
        var reflection: String?
        if let raw = data["reflection"] {
            guard let s = raw as? String else { throw DayDocCodecError.wrongType("reflection") }
            reflection = s
        }
        return DayDoc(
            slots: try req("slots", String.self),
            notes: try req("notes", [String: String].self),
            sleep: SleepWindow(start: startS, end: endS),
            tz: try req("tz", String.self),
            reflection: reflection,
            v: try req("v", Int.self)
        )
    }
}
