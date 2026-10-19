import Foundation

public let maxNoteLength = 200
public let maxReflectionLength = 1000
private let noteSeparator = " · "

public typealias DayMap = [DateKey: DayDoc]

public struct SlotConflict: Sendable, Equatable, Hashable {
    public var date: DateKey
    public var slot: Int
}

public func emptySlots() -> String {
    String(repeating: ".", count: slotsPerDay)
}

/// Prefix of at most `limit` UTF-16 code units that never splits a scalar.
public func truncatedUTF16(_ s: String, to limit: Int) -> String {
    if s.utf16.count <= limit { return s }
    var out = String.UnicodeScalarView()
    var used = 0
    for scalar in s.unicodeScalars {
        let n = scalar.utf16.count
        if used + n > limit { break }
        out.append(scalar)
        used += n
    }
    return String(out)
}

private func truncateNote(_ s: String) -> String { truncatedUTF16(s, to: maxNoteLength) }

private struct Run {
    var start: Int
    var length: Int
    var category: Category
}

private func runsOf(_ slots: String) -> [Run] {
    let chars = Array(slots.utf8)
    var runs: [Run] = []
    var i = 0
    let dot = UInt8(ascii: ".")
    while i < chars.count {
        let ch = chars[i]
        if ch == dot { i += 1; continue }
        var j = i + 1
        while j < chars.count && chars[j] == ch { j += 1 }
        if let cat = Category(rawValue: String(UnicodeScalar(ch))) {
            runs.append(Run(start: i, length: j - i, category: cat))
        }
        i = j
    }
    return runs
}

/// The slot character at `i`, or nil when out of range.
func slotCharAt(_ slots: String, _ i: Int) -> Character? {
    guard i >= 0 else { return nil }
    let u = slots.utf8
    guard i < u.count else { return nil }
    return Character(UnicodeScalar(u[u.index(u.startIndex, offsetBy: i)]))
}

public func entriesFromDay(_ k: DateKey, _ doc: DayDoc?) -> [Entry] {
    guard let doc else { return [] }
    return runsOf(doc.slots).map { r in
        var entry = Entry(date: k, startSlot: r.start, length: r.length, category: r.category)
        if let note = doc.notes[String(r.start)], !note.isEmpty { entry.note = note }
        return entry
    }
}

public func entryAt(_ k: DateKey, _ doc: DayDoc?, _ slot: Int) -> Entry? {
    entriesFromDay(k, doc).first { slot >= $0.startSlot && slot < $0.startSlot + $0.length }
}

private func slotId(_ date: DateKey, _ slot: Int) -> String { "\(date)#\(slot)" }

private func slotIds(_ e: Entry) throws -> Set<String> {
    var ids = Set<String>()
    for p in try splitAcrossDays(e) {
        for s in p.startSlot..<(p.startSlot + p.length) { ids.insert(slotId(p.date, s)) }
    }
    return ids
}

/// Logged slots inside e's range, ignoring slots that belong to `ignore` (the entry being edited).
public func findConflicts(_ days: DayMap, _ e: Entry, ignore: Entry? = nil) throws -> [SlotConflict] {
    let ignored = try ignore.map(slotIds) ?? []
    var conflicts: [SlotConflict] = []
    for p in try splitAcrossDays(e) {
        guard let doc = days[p.date] else { continue }
        for s in p.startSlot..<(p.startSlot + p.length) {
            if let ch = slotCharAt(doc.slots, s), ch != ".", !ignored.contains(slotId(p.date, s)) {
                conflicts.append(SlotConflict(date: p.date, slot: s))
            }
        }
    }
    return conflicts
}

private func setSlots(_ slots: String, _ start: Int, _ length: Int, _ ch: String) -> String {
    let chars = Array(slots)
    let s = min(max(start, 0), chars.count)
    let e = min(max(start + length, s), chars.count)
    return String(chars[..<s]) + String(repeating: ch, count: length) + String(chars[e...])
}

/// Keeps notes only at run starts. A note found inside a run (left over from a
/// run that was merged in) is folded into the run start's note.
private func normalizeNotes(_ doc: inout DayDoc) {
    var notes: [String: String] = [:]
    let keys = doc.notes.keys.filter { !$0.isEmpty && $0.allSatisfy { $0.isASCII && $0.isNumber } }
        .sorted { (Int($0) ?? 0) < (Int($1) ?? 0) }
    for run in runsOf(doc.slots) {
        var segments: [String] = []
        for key in keys {
            guard let slot = Int(key), let note = doc.notes[key] else { continue }
            if slot >= run.start && slot < run.start + run.length && !note.isEmpty { segments.append(note) }
        }
        if !segments.isEmpty { notes[String(run.start)] = truncateNote(segments.joined(separator: noteSeparator)) }
    }
    doc.notes = notes
}

private func dropNotesInRange(_ doc: inout DayDoc, _ start: Int, _ length: Int) {
    for key in Array(doc.notes.keys) {
        if let slot = Int(key), slot >= start && slot < start + length { doc.notes[key] = nil }
    }
}

private func clearParts(_ work: inout [DateKey: DayDoc], _ days: DayMap, _ list: [EntryPart]) {
    for p in list {
        guard var doc = work[p.date] ?? days[p.date] else { continue }
        doc.slots = setSlots(doc.slots, p.startSlot, p.length, ".")
        dropNotesInRange(&doc, p.startSlot, p.length)
        work[p.date] = doc
    }
}

private func collectChanged(_ work: [DateKey: DayDoc], _ days: DayMap) -> [DateKey: DayDoc] {
    var changed: [DateKey: DayDoc] = [:]
    for (date, var doc) in work {
        normalizeNotes(&doc)
        if days[date] != doc { changed[date] = doc }
    }
    return changed
}

/// Writes e (clearing `replace` first when editing). Returns only the changed day docs.
public func applyEntry(
    _ days: DayMap,
    _ e: Entry,
    sleep: SleepWindow,
    tz: String,
    replace: Entry? = nil
) throws -> [DateKey: DayDoc] {
    let list = try splitAcrossDays(e)
    var work: [DateKey: DayDoc] = [:]
    if let replace { clearParts(&work, days, try splitAcrossDays(replace)) }

    let note: String? = (e.note?.isEmpty == false) ? truncateNote(e.note!) : nil
    for p in list {
        var doc = work[p.date] ?? days[p.date]
            ?? DayDoc(slots: emptySlots(), notes: [:], sleep: sleep, tz: tz, v: 1)
        doc.slots = setSlots(doc.slots, p.startSlot, p.length, e.category.rawValue)
        dropNotesInRange(&doc, p.startSlot, p.length)
        if let note { doc.notes[String(p.startSlot)] = note }
        work[p.date] = doc
    }
    return collectChanged(work, days)
}

public func deleteEntry(_ days: DayMap, _ e: Entry) throws -> [DateKey: DayDoc] {
    var work: [DateKey: DayDoc] = [:]
    clearParts(&work, days, try splitAcrossDays(e))
    return collectChanged(work, days)
}

/// Error message, or nil when the entry can be saved.
public func validateEntry(_ e: Entry, now: Date, in ctx: TimeContext) -> String? {
    if !isValidDateKey(e.date) { return "Invalid date." }
    if e.startSlot < 0 || e.startSlot >= slotsPerDay { return "Invalid start time." }
    if e.length < 1 || e.length > slotsPerDay { return "Duration must be between 30 minutes and 24 hours." }
    if let note = e.note, note.utf16.count > maxNoteLength {
        return "Note must be \(maxNoteLength) characters or fewer."
    }
    if (try? isEntryInFuture(e, now, in: ctx)) ?? false { return "Entries cannot be in the future." }
    return nil
}

private func isLastDay(_ e: Entry) -> Bool { e.startSlot + e.length == slotsPerDay }

private func hasSegment(_ note: String, _ part: String) -> Bool {
    note == part || note.components(separatedBy: noteSeparator).contains(part)
}

/// Notes of a midnight-crossing entry in time order, without repeating one the other already holds.
private func joinNotes(_ first: String?, _ second: String?) -> String? {
    guard let first, !first.isEmpty else { return second }
    guard let second, !second.isEmpty else { return first }
    if hasSegment(second, first) { return second }
    if hasSegment(first, second) { return first }
    return truncateNote("\(first)\(noteSeparator)\(second)")
}

/// `tail` is an entry on `date` that ends at midnight. Returns it merged with the
/// next day's head run when they share a category and fit in one 24h entry.
private func joinWithNext(_ days: DayMap, _ date: DateKey, _ tail: Entry) throws -> Entry? {
    let next = try addDays(date, 1)
    guard let head = entriesFromDay(next, days[next]).first, head.startSlot == 0 else { return nil }
    if head.category != tail.category || tail.length + head.length > slotsPerDay { return nil }
    var joined = tail
    joined.length = tail.length + head.length
    if let note = joinNotes(tail.note, head.note), !note.isEmpty { joined.note = note } else { joined.note = nil }
    return joined
}

/// The entry on the previous day that joins into the head run `head` of `date`, if any.
private func joinedFromPrevious(_ days: DayMap, _ date: DateKey, _ head: Entry) throws -> Entry? {
    if head.startSlot != 0 { return nil }
    let prev = try addDays(date, -1)
    guard let tail = entriesFromDay(prev, days[prev]).first(where: isLastDay) else { return nil }
    guard let joined = try joinWithNext(days, prev, tail), joined.length == tail.length + head.length else { return nil }
    return joined
}

private func logical(_ days: DayMap, _ date: DateKey, _ e: Entry) throws -> Entry {
    if let joined = try joinedFromPrevious(days, date, e) { return joined }
    if isLastDay(e), let joined = try joinWithNext(days, date, e) { return joined }
    return e
}

/// The entry covering a slot, where a run ending at midnight joins the next day's
/// first run (same category, at most 48 slots together). A joined entry starts on
/// the earlier day and has both days' notes combined in time order.
public func logicalEntryAt(_ days: DayMap, _ date: DateKey, _ slot: Int) throws -> Entry? {
    guard let e = entryAt(date, days[date], slot) else { return nil }
    return try logical(days, date, e)
}

/// Entries overlapping `date` in time order, including one that started the previous day.
public func logicalEntriesForDay(_ days: DayMap, _ date: DateKey) throws -> [Entry] {
    try entriesFromDay(date, days[date]).map { try logical(days, date, $0) }
}

/// Returns the day doc with its reflection set to `text` (trimmed, at most 1000 UTF-16 units).
/// Empty text removes the field. A missing doc is created with a sleep snapshot.
public func withReflection(_ doc: DayDoc?, _ text: String, sleep: SleepWindow, tz: String) -> DayDoc {
    var next = doc ?? DayDoc(slots: emptySlots(), notes: [:], sleep: sleep, tz: tz, v: 1)
    let value = truncatedUTF16(text.trimmingCharacters(in: jsWhitespace), to: maxReflectionLength)
    next.reflection = value.isEmpty ? nil : value
    return next
}

private let jsWhitespace: CharacterSet = {
    var set = CharacterSet.whitespacesAndNewlines
    set.insert(charactersIn: "\u{FEFF}")
    return set
}()

// MARK: - Drop

public struct NoteRef: Sendable, Equatable, Hashable {
    public var date: DateKey
    public var key: String
    public var text: String
}

public struct DropSlot: Sendable, Equatable, Hashable {
    public var date: DateKey
    public var slot: Int
    public var prev: SlotChar
}

/// What a drop changed, enough for `undoDrop` to reverse it.
public struct DropUndo: Sendable, Equatable {
    public var category: Category
    /// Each written slot with the character it held before.
    public var slots: [DropSlot]
    /// Notes the drop removed or rewrote, as they were before.
    public var removedNotes: [NoteRef]
    /// Notes the drop wrote (e.g. a note folded into a merged run start).
    public var addedNotes: [NoteRef]
}

public struct DropPlan: Sendable, Equatable {
    public var changed: [DateKey: DayDoc]
    public var undo: DropUndo
    /// True when every target already holds the category, so nothing is written.
    public var noop: Bool
}

private func follows(_ prev: SlotRef, _ next: SlotRef) throws -> Bool {
    if next.date == prev.date { return next.slot == prev.slot + 1 }
    return try prev.slot == slotsPerDay - 1 && next.slot == 0 && next.date == addDays(prev.date, 1)
}

/// Groups sorted slots into runs of consecutive slots (crossing midnight), at most one day long.
private func contiguousRuns(_ sorted: [SlotRef]) throws -> [EntryPart] {
    var runs: [EntryPart] = []
    var prev: SlotRef?
    for ref in sorted {
        if let prev, var last = runs.last, last.length < slotsPerDay, try follows(prev, ref) {
            last.length += 1
            runs[runs.count - 1] = last
        } else {
            runs.append(EntryPart(date: ref.date, startSlot: ref.slot, length: 1))
        }
        prev = ref
    }
    return runs
}

private func noteKeyOrder(_ a: String, _ b: String) -> Bool {
    if let x = Int(a), let y = Int(b), x != y { return x < y }
    return a < b
}

private func diffNotes(_ before: DayMap, _ changed: [DateKey: DayDoc]) -> (removed: [NoteRef], added: [NoteRef]) {
    var removed: [NoteRef] = []
    var added: [NoteRef] = []
    for date in changed.keys.sorted() {
        guard let after = changed[date] else { continue }
        let old = before[date]?.notes ?? [:]
        for key in old.keys.sorted(by: noteKeyOrder) where after.notes[key] != old[key] {
            removed.append(NoteRef(date: date, key: key, text: old[key]!))
        }
        for key in after.notes.keys.sorted(by: noteKeyOrder) where old[key] != after.notes[key] {
            added.append(NoteRef(date: date, key: key, text: after.notes[key]!))
        }
    }
    return (removed, added)
}

/// Plans a drag-to-drop log: every target slot gets `category` (overwriting logged
/// slots and dropping their notes). Targets still in the future relative to `now`
/// are ignored. Missing day docs are created with the sleep snapshot.
public func planDrop(
    days: DayMap,
    targets: [SlotRef],
    category: Category,
    sleep: SleepWindow,
    tz: String,
    now: Date,
    in ctx: TimeContext
) throws -> DropPlan {
    var seen = Set<String>()
    let sorted = try targets
        .filter { try !isFutureSlot($0.date, $0.slot, now, in: ctx) }
        .filter { seen.insert(slotId($0.date, $0.slot)).inserted }
        .sorted { $0.date != $1.date ? $0.date < $1.date : $0.slot < $1.slot }

    var undo = DropUndo(category: category, slots: [], removedNotes: [], addedNotes: [])
    let allHold = sorted.allSatisfy { t in
        days[t.date].flatMap { slotCharAt($0.slots, t.slot) }.map { String($0) == category.rawValue } ?? false
    }
    if allHold { return DropPlan(changed: [:], undo: undo, noop: true) }

    undo.slots = sorted.map { t in
        let prev = days[t.date].flatMap { slotCharAt($0.slots, t.slot) }.flatMap { SlotChar(rawValue: String($0)) } ?? .dot
        return DropSlot(date: t.date, slot: t.slot, prev: prev)
    }

    var current = days
    var changed: [DateKey: DayDoc] = [:]
    for run in try contiguousRuns(sorted) {
        let entry = Entry(date: run.date, startSlot: run.startSlot, length: run.length, category: category)
        let next = try applyEntry(current, entry, sleep: sleep, tz: tz)
        changed.merge(next) { _, new in new }
        current.merge(next) { _, new in new }
    }
    let diff = diffNotes(days, changed)
    undo.removedNotes = diff.removed
    undo.addedNotes = diff.added
    return DropPlan(changed: changed, undo: undo, noop: false)
}

/// Reverses a drop on the current `days`. Only slots that still hold the dropped
/// category are restored, so later edits survive. Removed notes come back unless
/// their key has been written since.
public func undoDrop(_ days: DayMap, _ undo: DropUndo) -> [DateKey: DayDoc] {
    var work: [DateKey: DayDoc] = [:]
    func docFor(_ date: DateKey) -> DayDoc? {
        if let existing = work[date] { return existing }
        guard let base = days[date] else { return nil }
        work[date] = base
        return base
    }

    for s in undo.slots {
        guard var doc = docFor(s.date) else { continue }
        if let ch = slotCharAt(doc.slots, s.slot), String(ch) == undo.category.rawValue {
            doc.slots = setSlots(doc.slots, s.slot, 1, s.prev.rawValue)
            work[s.date] = doc
        }
    }
    for n in undo.addedNotes {
        guard var doc = docFor(n.date) else { continue }
        if doc.notes[n.key] == n.text {
            doc.notes[n.key] = nil
            work[n.date] = doc
        }
    }
    for n in undo.removedNotes {
        guard var doc = docFor(n.date) else { continue }
        if doc.notes[n.key] == nil {
            doc.notes[n.key] = n.text
            work[n.date] = doc
        }
    }
    return collectChanged(work, days)
}
