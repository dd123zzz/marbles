// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "MarblesData",
    platforms: [.iOS(.v26), .macOS(.v15)],
    products: [
        .library(name: "MarblesData", targets: ["MarblesData"]),
    ],
    dependencies: [
        .package(path: "../MarblesCore"),
    ],
    targets: [
        .target(name: "MarblesData", dependencies: [.product(name: "MarblesCore", package: "MarblesCore")]),
        .testTarget(name: "MarblesDataTests", dependencies: ["MarblesData"]),
    ],
    swiftLanguageModes: [.v6]
)
