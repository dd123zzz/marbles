import Foundation

public struct FormState: Sendable, Equatable, Hashable {
    public var date: DateKey
    public var startSlot: Int
    /// In 30-minute slots.
    public var length: Int
    public var note: String
    public var category: Category?

    public init(date: DateKey, startSlot: Int, length: Int, note: String = "", category: Category? = nil) {
        self.date = date
        self.startSlot = startSlot
        self.length = length
        self.note = note
        self.category = category
    }
}

public struct SlotStart: Sendable, Equatable, Hashable {
    public var date: DateKey
    public var startSlot: Int
    public init(date: DateKey, startSlot: Int) {
        self.date = date
        self.startSlot = startSlot
    }
}

public struct SlotOption: Sendable, Equatable, Hashable {
    public var value: Int
    public var label: String
}

/// Past days default to 09:00 (slot 18). Today defaults to the previous full hour.
public func defaultStartFor(_ viewDate: DateKey, _ now: Date, in ctx: TimeContext) -> SlotStart {
    if viewDate == toDateKey(now, in: ctx) {
        let s = defaultStart(now, in: ctx)
        return SlotStart(date: s.date, startSlot: s.startSlot)
    }
    return SlotStart(date: viewDate, startSlot: 18)
}

/// Longest entry that has already started. Today it ends at the slot containing now;
/// a future date allows only 1 slot (the sheet then reports it as a future entry).
public func maxLengthFor(_ date: DateKey, _ startSlot: Int, _ now: Date, in ctx: TimeContext) -> Int {
    let today = toDateKey(now, in: ctx)
    if date < today { return slotsPerDay }
    if date > today { return 1 }
    return max(1, currentSlotInfo(now, in: ctx).slot - startSlot + 1)
}

/// 1 hour, shortened so it does not run past the current slot.
public func defaultLengthFor(_ date: DateKey, _ startSlot: Int, _ now: Date, in ctx: TimeContext) -> Int {
    max(1, min(2, maxLengthFor(date, startSlot, now, in: ctx)))
}

public func createForm(_ start: SlotStart, _ now: Date, in ctx: TimeContext) -> FormState {
    FormState(
        date: start.date,
        startSlot: start.startSlot,
        length: defaultLengthFor(start.date, start.startSlot, now, in: ctx),
        note: "",
        category: nil
    )
}

public func editForm(_ entry: Entry) -> FormState {
    FormState(
        date: entry.date,
        startSlot: entry.startSlot,
        length: entry.length,
        note: entry.note ?? "",
        category: entry.category
    )
}

/// Length in slots as H:mm, e.g. 3 gives "1:30".
public func formatDuration(_ length: Int) -> String {
    let mins = length * 30
    let m = mins % 60
    return "\(mins / 60):\(m < 10 ? "0" : "")\(m)"
}

public func durationOptions() -> [SlotOption] {
    (0..<slotsPerDay).map { SlotOption(value: $0 + 1, label: formatDuration($0 + 1)) }
}

public func startOptions() throws -> [SlotOption] {
    try (0..<slotsPerDay).map { SlotOption(value: $0, label: try slotToHHmm($0)) }
}

/// e.g. ("23:00–01:00", crossesMidnight: true)
public func describeRange(_ startSlot: Int, _ length: Int) throws -> (text: String, crossesMidnight: Bool) {
    let end = startSlot + length
    let crossesMidnight = end > slotsPerDay
    let endLabel = try slotToHHmm(crossesMidnight ? end - slotsPerDay : end)
    return ("\(try slotToHHmm(startSlot))–\(endLabel)", crossesMidnight)
}

/// JS `String.prototype.trim()` whitespace.
private let jsTrimSet: CharacterSet = {
    var set = CharacterSet.whitespacesAndNewlines
    set.insert(charactersIn: "\u{FEFF}")
    return set
}()

public func buildEntry(_ form: FormState, _ category: Category) -> Entry {
    var entry = Entry(date: form.date, startSlot: form.startSlot, length: form.length, category: category)
    let note = form.note.trimmingCharacters(in: jsTrimSet)
    if !note.isEmpty { entry.note = note }
    return entry
}

public enum SavePlan: Sendable, Equatable {
    case failure(error: String)
    case success(conflicts: Int, changed: [DateKey: DayDoc])
}

/// Validates the entry and works out the day docs to write, plus how many logged slots it overwrites.
public func planSave(
    days: DayMap,
    entry: Entry,
    original: Entry? = nil,
    now: Date,
    sleep: SleepWindow,
    tz: String,
    in ctx: TimeContext
) throws -> SavePlan {
    if let error = validateEntry(entry, now: now, in: ctx) { return .failure(error: error) }
    let conflicts = try findConflicts(days, entry, ignore: original).count
    let changed = try applyEntry(days, entry, sleep: sleep, tz: tz, replace: original)
    return .success(conflicts: conflicts, changed: changed)
}

/// Date keys whose docs an entry (and its original, when editing) can touch.
public func touchedRange(_ date: DateKey) throws -> DateRange {
    DateRange(start: date, end: try addDays(date, 1))
}

/// Time range of an entry as listed on `viewDate`. An entry that crosses midnight names the
/// other day: "Thu 23:00 – 01:00" (started the day before) or "23:00 – Fri 01:00" (continues).
public func formatEntryRange(_ entry: Entry, _ viewDate: DateKey) throws -> String {
    let end = entry.startSlot + entry.length
    if entry.date < viewDate {
        return "\(try weekdayShort(entry.date)) \(try slotToHHmm(entry.startSlot)) – \(try slotToHHmm(end - slotsPerDay))"
    }
    if end > slotsPerDay {
        return "\(try slotToHHmm(entry.startSlot)) – \(try weekdayShort(try addDays(entry.date, 1))) \(try slotToHHmm(end - slotsPerDay))"
    }
    return try formatSlotRange(entry.startSlot, entry.length)
}
