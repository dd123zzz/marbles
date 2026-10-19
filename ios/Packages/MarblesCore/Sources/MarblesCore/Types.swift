import Foundation

public typealias DateKey = String
public typealias HHmm = String

public enum Category: String, Sendable, Equatable, Hashable, Codable, CaseIterable {
    case g, b, r
}

public enum SlotChar: String, Sendable, Equatable, Hashable, Codable, CaseIterable {
    case g, b, r
    case dot = "."
}

public struct SleepWindow: Sendable, Equatable, Hashable, Codable {
    public var start: HHmm
    public var end: HHmm
    public init(start: HHmm, end: HHmm) {
        self.start = start
        self.end = end
    }
}

public struct DayDoc: Sendable, Equatable, Hashable, Codable {
    public var slots: String
    public var notes: [String: String]
    public var sleep: SleepWindow
    public var tz: String
    public var reflection: String?
    public var v: Int
    public init(slots: String, notes: [String: String] = [:], sleep: SleepWindow, tz: String, reflection: String? = nil, v: Int = 1) {
        self.slots = slots
        self.notes = notes
        self.sleep = sleep
        self.tz = tz
        self.reflection = reflection
        self.v = v
    }
}

public enum WeekStart: String, Sendable, Equatable, Hashable, Codable, CaseIterable {
    case mon, sun
}

public enum ThemePref: String, Sendable, Equatable, Hashable, Codable, CaseIterable {
    case system, light, dark
}

public struct Settings: Sendable, Equatable, Hashable, Codable {
    public var sleepStart: HHmm
    public var sleepEnd: HHmm
    public var weekStart: WeekStart
    public var theme: ThemePref
    public var v: Int
    public init(sleepStart: HHmm = "23:00", sleepEnd: HHmm = "07:00", weekStart: WeekStart = .mon, theme: ThemePref = .system, v: Int = 1) {
        self.sleepStart = sleepStart
        self.sleepEnd = sleepEnd
        self.weekStart = weekStart
        self.theme = theme
        self.v = v
    }
}

public let defaultSettings = Settings(sleepStart: "23:00", sleepEnd: "07:00", weekStart: .mon, theme: .system, v: 1)

public struct Entry: Sendable, Equatable, Hashable, Codable {
    public var date: DateKey
    public var startSlot: Int
    public var length: Int
    public var category: Category
    public var note: String?
    public init(date: DateKey, startSlot: Int, length: Int, category: Category, note: String? = nil) {
        self.date = date
        self.startSlot = startSlot
        self.length = length
        self.category = category
        self.note = note
    }
}

public enum MarbleColor: String, Sendable, Equatable, Hashable, Codable, CaseIterable {
    case g, b, r, sleep, unlogged, empty, na
}

public struct Marble: Sendable, Equatable, Hashable, Codable {
    public var hour: Int
    public var left: MarbleColor
    public var right: MarbleColor
    public var full: Bool
    public var label: String
    public init(hour: Int, left: MarbleColor, right: MarbleColor, full: Bool, label: String) {
        self.hour = hour
        self.left = left
        self.right = right
        self.full = full
        self.label = label
    }
}

public let slotsPerDay = 48

public struct SlotRef: Sendable, Equatable, Hashable, Codable {
    public var date: DateKey
    public var slot: Int
    public init(date: DateKey, slot: Int) {
        self.date = date
        self.slot = slot
    }
}

public enum JarStyle: String, Sendable, Equatable, Hashable, Codable, CaseIterable {
    case grid, loose
}

public struct TimeContext: Sendable {
    public var calendar: Calendar
    public var timeZone: TimeZone

    public init(timeZone: TimeZone) {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        cal.locale = Locale(identifier: "en_US_POSIX")
        self.calendar = cal
        self.timeZone = timeZone
    }

    public static func fixed(_ id: String) -> TimeContext {
        TimeContext(timeZone: TimeZone(identifier: id) ?? TimeZone(identifier: "UTC")!)
    }

    public static var current: TimeContext {
        TimeContext(timeZone: TimeZone.current)
    }
}
