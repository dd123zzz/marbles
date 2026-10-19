import Foundation
import Testing
@testable import MarblesCore

@Suite("Time: lastHourWindow (America/Los_Angeles)")
struct TimeLastHourTests {
    static let T = "2026-06-10"
    static let Y = "2026-06-09"
    func june(_ h: Int, _ mi: Int, _ s: Double = 0) -> Date { at(2026, 6, 10, h, mi, s) }
    func win(_ d: Date) -> [SlotRef] { lastHourWindow(now: d, in: la) }
    func refs(_ pairs: (String, Int)...) -> [SlotRef] { pairs.map { SlotRef(date: $0.0, slot: $0.1) } }

    @Test func runsInPinnedZone() {
        #expect(la.timeZone.secondsFromGMT(for: at(2026, 3, 8, 3, 10)) == -7 * 3600)
        #expect(la.timeZone.secondsFromGMT(for: at(2026, 3, 8, 1, 10)) == -8 * 3600)
    }
    @Test(arguments: [(14, 0), (14, 14)])
    func roundsDownTo1400(_ hm: (Int, Int)) {
        #expect(win(june(hm.0, hm.1)) == refs((Self.T, 26), (Self.T, 27)))
    }
    @Test(arguments: [(14, 15), (14, 29), (14, 44)])
    func roundsTo1430(_ hm: (Int, Int)) {
        #expect(win(june(hm.0, hm.1)) == refs((Self.T, 27), (Self.T, 28)))
    }
    @Test func roundsUpTo1500() { #expect(win(june(14, 45)) == refs((Self.T, 28), (Self.T, 29))) }
    @Test func ignoresSeconds() {
        #expect(win(june(14, 14, 59)) == win(june(14, 0)))
        #expect(win(june(14, 15, 0)) == win(june(14, 44, 59)))
    }
    @Test func lateEvening() { #expect(win(june(23, 50)) == refs((Self.T, 46), (Self.T, 47))) }
    @Test(arguments: [(0, 0), (0, 14)])
    func justAfterMidnight(_ hm: (Int, Int)) {
        #expect(win(june(hm.0, hm.1)) == refs((Self.Y, 46), (Self.Y, 47)))
    }
    @Test func midnightTwenty() { #expect(win(june(0, 20)) == refs((Self.Y, 47), (Self.T, 0))) }
    @Test func midnightFifty() { #expect(win(june(0, 50)) == refs((Self.T, 0), (Self.T, 1))) }
    @Test func yearBoundary() {
        #expect(win(at(2027, 1, 1, 0, 20)) == refs(("2026-12-31", 47), ("2027-01-01", 0)))
    }
    @Test func monthBoundary() {
        #expect(win(at(2026, 3, 1, 0, 0)) == refs(("2026-02-28", 46), ("2026-02-28", 47)))
    }
    @Test func springForward0310() {
        #expect(win(at(2026, 3, 8, 3, 10)) == refs(("2026-03-08", 2), ("2026-03-08", 3)))
    }
    @Test func springForward0335() {
        #expect(win(at(2026, 3, 8, 3, 35)) == refs(("2026-03-08", 3), ("2026-03-08", 6)))
    }
    @Test func dayAfterSpringForward() {
        #expect(win(at(2026, 3, 9, 3, 10)) == refs(("2026-03-09", 4), ("2026-03-09", 5)))
    }
    @Test func fallBackUsesWallClock() {
        #expect(win(at(2026, 11, 1, 2, 10)) == refs(("2026-11-01", 2), ("2026-11-01", 3)))
        #expect(win(at(2026, 11, 1, 1, 50)) == refs(("2026-11-01", 2), ("2026-11-01", 3)))
    }
    @Test func chronologicalAndDistinctEveryFiveMinutes() {
        for m in stride(from: 0, to: 24 * 60, by: 5) {
            let w = win(june(m / 60, m % 60))
            #expect(w.count == 2)
            func key(_ r: SlotRef) -> String { "\(r.date)#\(r.slot < 10 ? "0" : "")\(r.slot)" }
            #expect(key(w[0]) < key(w[1]))
        }
    }
}
