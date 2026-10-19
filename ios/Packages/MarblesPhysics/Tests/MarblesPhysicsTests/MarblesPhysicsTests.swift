import Foundation
import Testing
@testable import MarblesPhysics

private let ids = (0..<24).map { "m\($0)" }
private let r = JarGeometry.marbleRadius

private func insideJar(_ p: Point) -> Bool {
    let segs = JarGeometry.colliders
    var inside = false
    for s in segs where (s.y1 > p.y) != (s.y2 > p.y) {
        let x = s.x1 + (p.y - s.y1) / (s.y2 - s.y1) * (s.x2 - s.x1)
        if p.x < x { inside.toggle() }
    }
    return inside
}

private func distanceToWalls(_ p: Point) -> Double {
    var best = Double.infinity
    for s in JarGeometry.colliders {
        let dx = s.x2 - s.x1, dy = s.y2 - s.y1
        let t = max(0, min(1, ((p.x - s.x1) * dx + (p.y - s.y1) * dy) / (dx * dx + dy * dy)))
        best = min(best, hypot(p.x - (s.x1 + t * dx), p.y - (s.y1 + t * dy)))
    }
    return best
}

private func maxPenetration(_ world: SwiftSolverWorld) -> Double {
    let pos = world.positions()
    var worst = 0.0
    for p in pos.values {
        worst = max(worst, r - distanceToWalls(p))
    }
    let pts = Array(pos.values)
    for i in 0..<pts.count {
        for j in (i + 1)..<pts.count {
            worst = max(worst, 2 * r - hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y))
        }
    }
    return worst
}

private func settled(seed: String = "2026-10-18") -> (SwiftSolverWorld, Int) {
    let w = SwiftSolverWorld()
    let steps = w.seedAndPresettle(ids: ids, seed: seed)
    return (w, steps)
}

@Suite struct MarblesPhysicsTests {
    @Test func marblePositionMatchesWeb() {
        let p0 = JarGeometry.marblePosition(hour: 0)
        #expect(p0 == Point(x: 14 + 20, y: JarGeometry.height - 14 - 20))
        #expect(JarGeometry.width == 188)
        #expect(JarGeometry.height == 314)
    }

    @Test func mulberryMatchesKnownSequence() {
        var a = Mulberry32(seed: "x")
        #expect(abs(a.next() - 0.591182969044894) < 1e-15)
        #expect(abs(a.next() - 0.592788509093225) < 1e-15)
    }

    @Test func settlesInsideJar() {
        let (w, _) = settled()
        for (id, p) in w.positions() {
            #expect(insideJar(p), "\(id) outside the jar polygon")
        }
        let pen = maxPenetration(w)
        print("max penetration after settle: \(pen)")
        #expect(pen < 0.5)
    }

    @Test func sleepsWithinBudget() {
        let (w, steps) = settled()
        print("slept after \(steps) substeps")
        #expect(w.isAsleep)
        #expect(steps < 1200)
    }

    @Test func sameSeedIsIdentical() {
        let a = settled(seed: "seed-a").0.positions()
        let b = settled(seed: "seed-a").0.positions()
        #expect(a == b)
        let c = settled(seed: "seed-b").0.positions()
        #expect(a != c)
    }

    @Test func noEscapeUnderImpulsesAndGravityRotation() {
        let (w, _) = settled()
        var rng = Mulberry32(seed: "chaos")
        for _ in 0..<100 {
            let id = ids[Int(rng.next() * 24)]
            w.impulse(id, (rng.next() * 2 - 1) * 600, (rng.next() * 2 - 1) * 600)
            for _ in 0..<10 { w.step(1.0 / 60) }
        }
        for k in 1...36 {
            let a = Double.pi * Double(k) / 36
            w.setGravity(sin(a), cos(a))
            for _ in 0..<15 { w.step(1.0 / 60) }
        }
        for _ in 0..<600 { w.step(1.0 / 60) }
        for (id, p) in w.positions() {
            #expect(insideJar(p), "\(id) escaped to \(p)")
        }
    }

    @Test func presettleTime() {
        let clock = ContinuousClock()
        var total = Duration.zero
        var steps = 0
        for i in 0..<5 {
            let w = SwiftSolverWorld()
            let t0 = clock.now
            steps = w.seedAndPresettle(ids: ids, seed: "perf-\(i)")
            total += clock.now - t0
        }
        let ms = Double(total.components.attoseconds) / 1e15 / 5 + Double(total.components.seconds) * 200
        print("presettle: \(ms) ms avg over 5 runs, \(steps) substeps (24 marbles)")
        #expect(ms < 2000)
    }
}
