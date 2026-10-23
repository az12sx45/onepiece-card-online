# Development record

2026-10-23: Owner authorized public independent iOS branch. Added sealed v038 platform candidate and SHA-pinned, public-standard-runner Mac CI. Windows preparation: 22 checks and 12 media checks passed; Apple SDK compilation and device testing pending. No production updater or gameplay rules changed.

First Mac run 39917269336: setup passed, native compile stopped because godot-cpp requires api_version. Added exact 4.7 API selection and a RefCounted-only binding profile; errors now print bounded diagnostics. Rebuild pending.

Second run 39917775324: API generation passed; minimized profile omitted OS used by upstream print_string.cpp. Include OS in bridge bindings; rebuild pending.

Third run 39918233260: dependency compilation passed; Clang rejected Objective-C __block variables captured by C++ lambdas. Replaced with synchronous by-reference C++ captures in display, player start and player state; rebuild pending.

Fourth run 39918534370: bridge source compiled, link failed on CoreMedia/CoreGraphics symbols. Link both frameworks explicitly, align deployment target with iOS 16, and name the output dylib explicitly for XCFramework packaging. Rebuild pending.

Fifth run 39918995265: native bridge, XCFramework, import and Godot iOS export passed. Xcode 16.4 could not link newer Metal/CoreAnimation symbols in the official Godot template. Use standard macos-26 (Xcode 26), check SDK >=26 before work, and verify native symbols inside Godot-converted frameworks as well as dylibs. Import/export have expected iOS-only bridge warnings on Mac plus upstream generated resource-module warnings, but no script parse errors. Device runtime remains untested.

Run 39919875803 / build commit 35816e8 succeeded on standard macos-26. Download digest matched. Local IPA reader verified 1946 PCK records, 174 original JS files, 1304 physical API files and both frameworks. Checker normalized relative PCK paths after its first diagnostic mismatch; the IPA was unchanged. Signed=false, iPhoneTested=false. Verification report and standalone reader added outside the sealed candidate; no rebuild needed.
