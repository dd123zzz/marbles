public struct Point: Equatable, Sendable {
    public var x: Double
    public var y: Double
    public init(x: Double, y: Double) {
        self.x = x
        self.y = y
    }
}

public struct BodyInit: Sendable {
    public var x: Double
    public var y: Double
    public var vx: Double
    public var vy: Double
    public var r: Double
    public init(x: Double, y: Double, vx: Double = 0, vy: Double = 0, r: Double) {
        self.x = x
        self.y = y
        self.vx = vx
        self.vy = vy
        self.r = r
    }
}

/// A 2D marble world inside the jar. Units are jar viewBox units; y grows downwards.
public protocol JarWorld: AnyObject {
    func add(_ id: String, _ body: BodyInit)
    func remove(_ id: String)
    /// Advances by `dt` seconds using fixed substeps.
    func step(_ dt: Double)
    /// Runs up to `maxSteps` fixed substeps, stopping early once asleep. Returns the number run.
    @discardableResult func presettle(_ maxSteps: Int) -> Int
    /// Direction is normalised and scaled by the world's gravity magnitude.
    func setGravity(_ gx: Double, _ gy: Double)
    /// Adds a velocity change to one body and wakes it.
    func impulse(_ id: String, _ vx: Double, _ vy: Double)
    func positions() -> [String: Point]
    var isAsleep: Bool { get }
}
