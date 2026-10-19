// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "MarblesPhysics",
    platforms: [.iOS(.v26), .macOS(.v15)],
    products: [
        .library(name: "MarblesPhysics", targets: ["MarblesPhysics"]),
    ],
    targets: [
        .target(name: "MarblesPhysics"),
        .testTarget(name: "MarblesPhysicsTests", dependencies: ["MarblesPhysics"]),
    ]
)
