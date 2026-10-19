import Foundation

/// Faithful port of src/lib/physics/world.ts: position-based circle solver with sleeping.
/// Deterministic reference implementation and fallback for any other engine.
public final class SwiftSolverWorld: JarWorld {
    public struct Options: Sendable {
        public var g = 1400.0
        public var restitution = 0.2
        public var friction = 0.1
        public var damping = 0.4
        public var maxSpeed = 1000.0
        public var iterations = 8
        public var substep = 1.0 / 120.0
        public var maxSubsteps = 4
        public var sleepSpeed = 6.0
        public var sleepFrames = 30
        public var gx = 0.0
        public var gy = 1.0
        public init() {}
    }

    private final class Body {
        let id: String
        var x = 0.0, y = 0.0, vx = 0.0, vy = 0.0
        var r: Double
        var w = 1.0
        var px = 0.0, py = 0.0
        var asleep = false
        var calm = 0
        var ok = false
        init(id: String, r: Double) { self.id = id; self.r = r }
    }

    private struct Contact {
        let a: Body
        let b: Body?
        let nx: Double, ny: Double, vn: Double
    }

    private struct Seg {
        let ax, ay, bx, by, ux, uy, nx, ny, len, minX, maxX, minY, maxY: Double
    }

    private static let wakeAngleCos = cos(3 * Double.pi / 180)
    private static let maxFrameDt = 0.05

    private let g: Double, restitution: Double, mu: Double, damping: Double, maxSpeed: Double
    private let iterations: Int, h: Double, maxSubsteps: Int, sleepSpeed: Double, sleepFrames: Int
    private let bounceSpeed: Double, wakeSpeed: Double
    private let segs: [Seg]

    private var gdx = 0.0, gdy = 1.0
    private var wakeDx = 0.0, wakeDy = 1.0
    private var bodies: [Body] = []
    private var byId: [String: Body] = [:]
    private var contacts: [Contact] = []
    private var acc = 0.0

    public init(segments: [JarCollider] = JarGeometry.colliders, options o: Options = Options()) {
        g = o.g; restitution = o.restitution; mu = o.friction; damping = o.damping
        maxSpeed = o.maxSpeed; iterations = o.iterations; h = o.substep
        maxSubsteps = o.maxSubsteps; sleepSpeed = o.sleepSpeed; sleepFrames = o.sleepFrames
        bounceSpeed = 6 * o.g * o.substep
        wakeSpeed = 3 * o.g * o.substep
        segs = segments.map { s in
            let dx = s.x2 - s.x1, dy = s.y2 - s.y1
            let len = hypot(dx, dy)
            return Seg(
                ax: s.x1, ay: s.y1, bx: s.x2, by: s.y2,
                ux: dx / len, uy: dy / len, nx: dy / len, ny: -dx / len, len: len,
                minX: min(s.x1, s.x2), maxX: max(s.x1, s.x2),
                minY: min(s.y1, s.y2), maxY: max(s.y1, s.y2))
        }
        let l = hypot(o.gx, o.gy)
        if l > 1e-9 { gdx = o.gx / l; gdy = o.gy / l }
        wakeDx = gdx; wakeDy = gdy
    }

    public var count: Int { bodies.count }
    public var isAsleep: Bool { bodies.allSatisfy { $0.asleep } }

    private func wakeBody(_ b: Body) { b.asleep = false; b.calm = 0 }

    public func wake() {
        for b in bodies { wakeBody(b) }
        acc = 0
    }

    public func add(_ id: String, _ i: BodyInit) {
        let existing = byId[id]
        let b = existing ?? Body(id: id, r: i.r)
        b.x = i.x; b.px = i.x
        b.y = i.y; b.py = i.y
        b.vx = i.vx; b.vy = i.vy
        b.r = i.r
        b.w = 1 / (i.r * i.r)
        wakeBody(b)
        if existing == nil {
            bodies.append(b)
            byId[id] = b
        }
    }

    public func remove(_ id: String) {
        guard let b = byId.removeValue(forKey: id) else { return }
        bodies.removeAll { $0 === b }
        wake()
    }

    public func step(_ dt: Double) {
        if !(dt > 0) || isAsleep { return }
        acc += min(dt, Self.maxFrameDt)
        var n = 0
        while acc >= h - 1e-9 && n < maxSubsteps {
            substep()
            acc -= h
            n += 1
            if isAsleep { acc = 0; return }
        }
        if acc > h { acc = h }
    }

    @discardableResult
    public func presettle(_ maxSteps: Int) -> Int {
        var done = 0
        while done < maxSteps && !isAsleep {
            substep()
            done += 1
        }
        return done
    }

    public func positions() -> [String: Point] {
        var m: [String: Point] = [:]
        m.reserveCapacity(bodies.count)
        for b in bodies { m[b.id] = Point(x: b.x, y: b.y) }
        return m
    }

    public func setGravity(_ gx: Double, _ gy: Double) {
        let l = hypot(gx, gy)
        if l < 1e-9 { return }
        gdx = gx / l
        gdy = gy / l
        if gdx * wakeDx + gdy * wakeDy < Self.wakeAngleCos {
            wakeDx = gdx
            wakeDy = gdy
            wake()
        }
    }

    public func impulse(_ id: String, _ vx: Double, _ vy: Double) {
        guard let b = byId[id] else { return }
        b.vx += vx
        b.vy += vy
        wakeBody(b)
    }

    /// Kinetic + potential energy (mass = r²), for diagnostics and tests.
    public func energy() -> Double {
        var e = 0.0
        for b in bodies {
            let m = b.r * b.r
            e += 0.5 * m * (b.vx * b.vx + b.vy * b.vy) - m * g * (gdx * b.x + gdy * b.y)
        }
        return e
    }

    private func solvePair(_ a: Body, _ b: Body, _ first: Bool) {
        let dx = a.px - b.px, dy = a.py - b.py
        let rr = a.r + b.r
        let d2 = dx * dx + dy * dy
        if d2 >= rr * rr { return }
        let d = d2.squareRoot()
        let nx = d > 1e-9 ? dx / d : 1
        let ny = d > 1e-9 ? dy / d : 0
        if first {
            let vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny
            if vn < -wakeSpeed {
                if a.asleep { wakeBody(a) }
                if b.asleep { wakeBody(b) }
            }
            contacts.append(Contact(a: a, b: b, nx: nx, ny: ny, vn: vn))
        }
        let wa = a.asleep ? 0 : a.w
        let wb = b.asleep ? 0 : b.w
        let ws = wa + wb
        if ws == 0 { return }
        let pen = rr - d
        a.px += nx * pen * wa / ws
        a.py += ny * pen * wa / ws
        b.px -= nx * pen * wb / ws
        b.py -= ny * pen * wb / ws
        let rx = a.px - a.x - (b.px - b.x)
        let ry = a.py - a.y - (b.py - b.y)
        let dot = rx * nx + ry * ny
        let tx = rx - dot * nx, ty = ry - dot * ny
        let tl = hypot(tx, ty)
        if tl > 1e-12 {
            let k = min(1, mu * pen / tl)
            a.px -= tx * k * wa / ws
            a.py -= ty * k * wa / ws
            b.px += tx * k * wb / ws
            b.py += ty * k * wb / ws
        }
    }

    private func solveSegment(_ b: Body, _ s: Seg, _ first: Bool) {
        let r = b.r
        if b.px < s.minX - r || b.px > s.maxX + r || b.py < s.minY - r || b.py > s.maxY + r { return }
        let ox = b.px - s.ax, oy = b.py - s.ay
        let along = ox * s.ux + oy * s.uy
        let nx: Double, ny: Double, pen: Double
        if along >= 0 && along <= s.len {
            let dist = ox * s.nx + oy * s.ny
            if dist >= r || dist < -r { return }
            nx = s.nx; ny = s.ny
            pen = r - dist
        } else {
            let ex = along < 0 ? s.ax : s.bx
            let ey = along < 0 ? s.ay : s.by
            let dx = b.px - ex, dy = b.py - ey
            let d2 = dx * dx + dy * dy
            if d2 >= r * r { return }
            let d = d2.squareRoot()
            if d > 1e-9 { nx = dx / d; ny = dy / d } else { nx = s.nx; ny = s.ny }
            pen = r - d
        }
        if first { contacts.append(Contact(a: b, b: nil, nx: nx, ny: ny, vn: b.vx * nx + b.vy * ny)) }
        b.px += nx * pen
        b.py += ny * pen
        let rx = b.px - b.x, ry = b.py - b.y
        let dot = rx * nx + ry * ny
        let tx = rx - dot * nx, ty = ry - dot * ny
        let tl = hypot(tx, ty)
        if tl > 1e-12 {
            let k = min(1, mu * pen / tl)
            b.px -= tx * k
            b.py -= ty * k
        }
    }

    private func substep() {
        let ax = gdx * g * h, ay = gdy * g * h
        let damp = max(0, 1 - damping * h)
        for b in bodies {
            if b.asleep { b.px = b.x; b.py = b.y; continue }
            b.vx = (b.vx + ax) * damp
            b.vy = (b.vy + ay) * damp
            let sp = hypot(b.vx, b.vy)
            if sp > maxSpeed {
                b.vx *= maxSpeed / sp
                b.vy *= maxSpeed / sp
            }
            b.px = b.x + b.vx * h
            b.py = b.y + b.vy * h
        }

        contacts.removeAll(keepingCapacity: true)
        let n = bodies.count
        for it in 0..<iterations {
            let first = it == 0
            for i in 0..<n {
                let a = bodies[i]
                var j = i + 1
                while j < n {
                    let b = bodies[j]
                    j += 1
                    if a.asleep && b.asleep { continue }
                    solvePair(a, b, first)
                }
            }
            for b in bodies where !b.asleep {
                for s in segs { solveSegment(b, s, first) }
            }
        }

        for b in bodies where !b.asleep {
            b.vx = (b.px - b.x) / h
            b.vy = (b.py - b.y) / h
            b.x = b.px
            b.y = b.py
        }

        for c in contacts {
            if c.vn >= -bounceSpeed { continue }
            let a = c.a, b = c.b
            let wa = a.asleep ? 0 : a.w
            let wb = (b != nil && !b!.asleep) ? b!.w : 0
            let ws = wa + wb
            if ws == 0 { continue }
            let cur = b != nil
                ? (a.vx - b!.vx) * c.nx + (a.vy - b!.vy) * c.ny
                : a.vx * c.nx + a.vy * c.ny
            let dv = -restitution * c.vn - cur
            if dv <= 0 { continue }
            a.vx += c.nx * dv * wa / ws
            a.vy += c.ny * dv * wa / ws
            if let b, wb > 0 {
                b.vx -= c.nx * dv * wb / ws
                b.vy -= c.ny * dv * wb / ws
            }
        }

        let eps2 = sleepSpeed * sleepSpeed
        for b in bodies where !b.asleep {
            b.calm = b.vx * b.vx + b.vy * b.vy < eps2 ? b.calm + 1 : 0
            b.ok = b.calm >= sleepFrames
        }
        var changed = true
        while changed {
            changed = false
            for c in contacts {
                guard let b = c.b else { continue }
                let a = c.a
                if a.asleep || b.asleep || a.ok == b.ok { continue }
                a.ok = false
                b.ok = false
                changed = true
            }
        }
        for b in bodies where !b.asleep && b.ok {
            b.asleep = true
            b.vx = 0
            b.vy = 0
        }
    }
}
