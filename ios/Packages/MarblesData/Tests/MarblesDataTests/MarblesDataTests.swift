import Testing
import Foundation
import MarblesCore
@testable import MarblesData

private func doc(
    slots: String = String(repeating: ".", count: 48),
    notes: [String: String] = [:],
    start: String = "23:00", end: String = "07:00",
    tz: String = "America/Los_Angeles",
    reflection: String? = nil, v: Int = 1
) -> DayDoc {
    DayDoc(slots: slots, notes: notes, sleep: SleepWindow(start: start, end: end), tz: tz, reflection: reflection, v: v)
}

private func rejects(_ d: DayDoc, _ violation: WriteViolation) -> Bool {
    do { try WriteValidator.validate(d); return false } catch { return (error as? WriteViolation) == violation }
}

@Suite struct CodecTests {
    @Test func w1ExactKeys() throws {
        let out = try DayDocCodec.encode(doc())
        #expect(Set(out.keys) == ["slots", "notes", "sleep", "tz", "v", "updatedAt"])
        #expect(out["updatedAt"] as? ServerTimestamp == .marker)
        #expect(Set((out["sleep"] as? [String: String] ?? [:]).keys) == ["start", "end"])
        #expect(out["v"] as? Int == 1)
    }

    @Test func w6ReflectionTrimmedAndOmittedWhenEmpty() throws {
        #expect(try DayDocCodec.encode(doc(reflection: nil))["reflection"] == nil)
        #expect(try DayDocCodec.encode(doc(reflection: " \n "))["reflection"] == nil)
        #expect(try DayDocCodec.encode(doc(reflection: "  good day \n"))["reflection"] as? String == "good day")
    }

    @Test func roundTrip() throws {
        let d = doc(slots: "gbr" + String(repeating: ".", count: 45), notes: ["0": "x"], reflection: "ok")
        #expect(try DayDocCodec.decode(DayDocCodec.encode(d)) == d)
        let plain = doc()
        #expect(try DayDocCodec.decode(DayDocCodec.encode(plain)) == plain)
    }

    @Test func decodeErrors() throws {
        var raw = try DayDocCodec.encode(doc())
        raw["tz"] = nil
        #expect(throws: DayDocCodecError.missingKey("tz")) { try DayDocCodec.decode(raw) }
        raw = try DayDocCodec.encode(doc())
        raw["v"] = "1"
        #expect(throws: DayDocCodecError.wrongType("v")) { try DayDocCodec.decode(raw) }
    }
}

@Suite struct DayValidatorTests {
    @Test func validDocPasses() throws {
        try WriteValidator.validate(doc(reflection: "hello"))
        try WriteValidator.validateDay(DayDocCodec.encode(doc()), id: "2026-10-18")
    }

    @Test func w1Keys() throws {
        var raw = try DayDocCodec.encode(doc())
        raw["extra"] = 1
        #expect(throws: WriteViolation.badKeys) { try WriteValidator.validateDay(raw) }
        raw = try DayDocCodec.encode(doc())
        raw["notes"] = nil
        #expect(throws: WriteViolation.badKeys) { try WriteValidator.validateDay(raw) }
        raw = try DayDocCodec.encode(doc())
        raw["updatedAt"] = nil
        #expect(throws: WriteViolation.badUpdatedAt) { try WriteValidator.validateDay(raw) }
    }

    @Test func dateKey() throws {
        let raw = try DayDocCodec.encode(doc())
        #expect(throws: WriteViolation.badDateKey) { try WriteValidator.validateDay(raw, id: "2026-1-18") }
        #expect(throws: WriteViolation.badDateKey) { try WriteValidator.validateDay(raw, id: "2026-10-18x") }
    }

    @Test func w2Slots() {
        #expect(rejects(doc(slots: String(repeating: "g", count: 47)), .badSlots))
        #expect(rejects(doc(slots: String(repeating: "g", count: 49)), .badSlots))
        #expect(rejects(doc(slots: String(repeating: "x", count: 48)), .badSlots))
        #expect(rejects(doc(slots: String(repeating: "G", count: 48)), .badSlots))
        #expect(!rejects(doc(slots: String(repeating: "r", count: 48)), .badSlots))
    }

    @Test func w3Notes() throws {
        try WriteValidator.validate(doc(notes: ["0": String(repeating: "a", count: 200), "47": "x"]))
        #expect(rejects(doc(notes: ["0": String(repeating: "a", count: 201)]), .badNotes))
        #expect(rejects(doc(notes: ["48": "x"]), .badNotes))
        #expect(rejects(doc(notes: ["-1": "x"]), .badNotes))
        #expect(rejects(doc(notes: ["01": "x"]), .badNotes))
        #expect(rejects(doc(notes: ["a": "x"]), .badNotes))
        // 101 emoji = 202 UTF-16 units
        #expect(rejects(doc(notes: ["0": String(repeating: "😀", count: 101)]), .badNotes))
        try WriteValidator.validate(doc(notes: ["0": String(repeating: "😀", count: 100)]))
        var raw = try DayDocCodec.encode(doc())
        raw["notes"] = ["0": 5]
        #expect(throws: WriteViolation.badNotes) { try WriteValidator.validateDay(raw) }
    }

    @Test func w4SleepClocks() throws {
        try WriteValidator.validate(doc(start: "23:15", end: "06:45"))
        #expect(rejects(doc(start: "24:00"), .badSleep))
        #expect(rejects(doc(end: "07:60"), .badSleep))
        #expect(rejects(doc(start: "7:00"), .badSleep))
        #expect(rejects(doc(end: "07-00"), .badSleep))
        var raw = try DayDocCodec.encode(doc())
        raw["sleep"] = ["start": "23:00"]
        #expect(throws: WriteViolation.badSleep) { try WriteValidator.validateDay(raw) }
        raw["sleep"] = ["start": "23:00", "end": "07:00", "x": "1"]
        #expect(throws: WriteViolation.badSleep) { try WriteValidator.validateDay(raw) }
    }

    @Test func w5TimeZone() throws {
        try WriteValidator.validate(doc(tz: String(repeating: "a", count: 64)))
        #expect(rejects(doc(tz: String(repeating: "a", count: 65)), .badTimeZone))
    }

    @Test func w6Reflection() throws {
        try WriteValidator.validate(doc(reflection: String(repeating: "a", count: 1000)))
        #expect(rejects(doc(reflection: String(repeating: "a", count: 1001)), .badReflection))
        var raw = try DayDocCodec.encode(doc())
        raw["reflection"] = 3
        #expect(throws: WriteViolation.badReflection) { try WriteValidator.validateDay(raw) }
    }

    @Test func w7Version() throws {
        #expect(rejects(doc(v: 2), .badVersion))
        var raw = try DayDocCodec.encode(doc())
        raw["v"] = 1.0
        #expect(throws: WriteViolation.badVersion) { try WriteValidator.validateDay(raw) }
        raw["v"] = true
        #expect(throws: WriteViolation.badVersion) { try WriteValidator.validateDay(raw) }
    }

    @Test func w8UpdatedAtMustBeMarker() throws {
        var raw = try DayDocCodec.encode(doc())
        raw["updatedAt"] = Date()
        #expect(throws: WriteViolation.badUpdatedAt) { try WriteValidator.validateDay(raw) }
    }
}

@Suite struct SettingsValidatorTests {
    @Test func validPatches() throws {
        try WriteValidator.validateSettingsPatch(["v": 1])
        try WriteValidator.validateSettingsPatch(["sleepStart": "22:30", "sleepEnd": "06:00", "weekStart": "sun", "theme": "dark", "v": 1])
    }

    @Test func w13Keys() {
        #expect(throws: WriteViolation.badKeys) { try WriteValidator.validateSettingsPatch(["v": 1, "jarStyle": "grid"]) }
    }

    @Test func w13Version() {
        #expect(throws: WriteViolation.badVersion) { try WriteValidator.validateSettingsPatch(["theme": "dark"]) }
        #expect(throws: WriteViolation.badVersion) { try WriteValidator.validateSettingsPatch(["v": 2]) }
    }

    @Test func w13SleepTimes() {
        for bad in ["22:15", "24:00", "7:00", "07:00 ", "ab:cd"] {
            #expect(throws: WriteViolation.badSettings) { try WriteValidator.validateSettingsPatch(["sleepStart": bad, "v": 1]) }
        }
        #expect(throws: WriteViolation.badSettings) { try WriteValidator.validateSettingsPatch(["sleepEnd": 7, "v": 1]) }
    }

    @Test func w13Enums() {
        #expect(throws: WriteViolation.badSettings) { try WriteValidator.validateSettingsPatch(["weekStart": "tue", "v": 1]) }
        #expect(throws: WriteViolation.badSettings) { try WriteValidator.validateSettingsPatch(["theme": "sepia", "v": 1]) }
    }
}
