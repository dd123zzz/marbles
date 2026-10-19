import Foundation

/// Port of src/lib/physics/rng.ts (xmur3 hash + mulberry32); bit-identical to the web.
public struct Mulberry32: Sendable {
    private var a: UInt32

    public init(seed: String) {
        var h: UInt32 = 1_779_033_703 ^ UInt32(truncatingIfNeeded: seed.utf16.count)
        for c in seed.utf16 {
            h = (h ^ UInt32(c)) &* 3_432_918_353
            h = (h << 13) | (h >> 19)
        }
        h = (h ^ (h >> 16)) &* 2_246_822_507
        h = (h ^ (h >> 13)) &* 3_266_489_909
        a = h ^ (h >> 16)
    }

    public mutating func next() -> Double {
        a = a &+ 0x6d2b_79f5
        var t = (a ^ (a >> 15)) &* (1 | a)
        t = (t &+ ((t ^ (t >> 7)) &* (61 | t))) ^ t
        return Double(t ^ (t >> 14)) / 4_294_967_296
    }
}

/// Port of src/lib/physics/layout.ts `seedLayout`: a deterministic loose hex pack in id order.
public func seedLayout(
    ids: [String], seed: String,
    r: Double = JarGeometry.marbleRadius,
    cx: Double = JarGeometry.width / 2,
    floor: Double = JarGeometry.height - 3,
    perRow: Int = 5, gap: Double = 1.5, jitter: Double = 0.5
) -> [String: Point] {
    var rng = Mulberry32(seed: seed)
    let pitch = 2 * r + gap
    let rowH = pitch * 3.0.squareRoot() * 0.5 + gap
    var out: [String: Point] = [:]
    var row = 0, col = 0
    for id in ids {
        let count = row % 2 == 0 ? perRow : perRow - 1
        let x = cx + (Double(col) - Double(count - 1) / 2) * pitch + (rng.next() * 2 - 1) * jitter
        let y = floor - r - 1 - Double(row) * rowH + (rng.next() * 2 - 1) * jitter
        out[id] = Point(x: x, y: y)
        col += 1
        if col >= count { col = 0; row += 1 }
    }
    return out
}

extension JarWorld {
    /// Adds `ids` in a seeded loose pack and settles them. Returns the substeps run.
    @discardableResult
    public func seedAndPresettle(ids: [String], seed: String, maxSteps: Int = 1200) -> Int {
        let layout = seedLayout(ids: ids, seed: seed)
        for id in ids {
            let p = layout[id]!
            add(id, BodyInit(x: p.x, y: p.y, r: JarGeometry.marbleRadius))
        }
        return presettle(maxSteps)
    }
}
