import Foundation

public struct JarCollider: Equatable, Sendable {
    public var x1: Double, y1: Double, x2: Double, y2: Double
    public init(x1: Double, y1: Double, x2: Double, y2: Double) {
        self.x1 = x1; self.y1 = y1; self.x2 = x2; self.y2 = y2
    }
}

/// 1:1 port of src/components/jarLayout.ts (geometry, colliders, marblePosition).
public enum JarGeometry {
    static let cols = 4
    static let rows = 6
    static let cell = 40.0
    static let pad = 14.0
    static let headroom = 46.0

    public static let marbleRadius = 16.0
    public static let width = Double(cols) * cell + 2 * pad
    public static let height = Double(rows) * cell + 2 * pad + headroom
    public static let cellSize = cell

    static let wall = 3.0
    static let neck = 13.0
    static let corner = 24.0
    static let lipY = 3.0
    static let lipH = 14.0
    static let neckBottom = 28.0
    static let bodyTop = 62.0

    static let glassStroke = 2.5
    static let curveSegments = 6

    /// Hour 0 is the bottom-left; the jar fills left to right, then upwards.
    public static func marblePosition(hour: Int) -> Point {
        let col = hour % cols
        let row = hour / cols
        return Point(
            x: pad + Double(col) * cell + cell / 2,
            y: height - pad - Double(row) * cell - cell / 2)
    }

    /// Closed loop; edge (dx, dy) has its interior on the side of the normal (dy, -dx).
    public static let colliders: [JarCollider] = buildColliders()

    private static func buildColliders() -> [JarCollider] {
        var pts: [(Double, Double)] = []
        func push(_ x: Double, _ y: Double) {
            if let last = pts.last, abs(last.0 - x) <= 1e-9, abs(last.1 - y) <= 1e-9 { return }
            pts.append((x, y))
        }
        func cubic(_ p0: (Double, Double), _ p1: (Double, Double), _ p2: (Double, Double), _ p3: (Double, Double)) {
            for i in 1...curveSegments {
                let t = Double(i) / Double(curveSegments)
                let u = 1 - t
                push(
                    u * u * u * p0.0 + 3 * u * u * t * p1.0 + 3 * u * t * t * p2.0 + t * t * t * p3.0,
                    u * u * u * p0.1 + 3 * u * u * t * p1.1 + 3 * u * t * t * p2.1 + t * t * t * p3.1)
            }
        }
        func arc(_ cx: Double, _ cy: Double, _ from: Double, _ to: Double) {
            for i in 1...curveSegments {
                let a = from + (to - from) * Double(i) / Double(curveSegments)
                push(cx + corner * cos(a), cy + corner * sin(a))
            }
        }

        let lidY = lipY + lipH
        let floorY = height - wall
        let cornerY = floorY - corner
        push(neck, lidY)
        push(neck, neckBottom)
        cubic((neck, neckBottom), (neck, neckBottom + 18), (wall, bodyTop - 22), (wall, bodyTop))
        push(wall, cornerY)
        arc(wall + corner, cornerY, Double.pi, Double.pi / 2)
        push(width - wall - corner, floorY)
        arc(width - wall - corner, cornerY, Double.pi / 2, 0)
        push(width - wall, bodyTop)
        cubic(
            (width - wall, bodyTop), (width - wall, bodyTop - 22),
            (width - neck, neckBottom + 18), (width - neck, neckBottom))
        push(width - neck, lidY)

        let n = pts.count
        let normals: [(Double, Double)] = (0..<n).map { k in
            let p = pts[k], q = pts[(k + 1) % n]
            let dx = q.0 - p.0, dy = q.1 - p.1
            let len = hypot(dx, dy)
            return (dy / len, -dx / len)
        }
        let half = glassStroke / 2
        let inset: [(Double, Double)] = (0..<n).map { k in
            let p = pts[k]
            let a = normals[(k + n - 1) % n], b = normals[k]
            let s = 1 + a.0 * b.0 + a.1 * b.1
            return (p.0 + half * (a.0 + b.0) / s, p.1 + half * (a.1 + b.1) / s)
        }
        return (0..<n).map { k in
            let p = inset[k], q = inset[(k + 1) % n]
            return JarCollider(x1: p.0, y1: p.1, x2: q.0, y2: q.1)
        }
    }
}
