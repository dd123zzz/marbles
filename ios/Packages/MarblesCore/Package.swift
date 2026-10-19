// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "MarblesCore",
    platforms: [.iOS(.v26), .macOS(.v15)],
    products: [
        .library(name: "MarblesCore", targets: ["MarblesCore"]),
    ],
    targets: [
        .target(name: "MarblesCore"),
        .testTarget(name: "MarblesCoreTests", dependencies: ["MarblesCore"]),
    ],
    swiftLanguageModes: [.v6]
)
