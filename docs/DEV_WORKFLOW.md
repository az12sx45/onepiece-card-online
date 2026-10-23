# Development record

2026-10-23: Owner authorized public independent iOS branch. Added sealed v038 platform candidate and SHA-pinned, public-standard-runner Mac CI. Windows preparation: 22 checks and 12 media checks passed; Apple SDK compilation and device testing pending. No production updater or gameplay rules changed.

First Mac run 39917269336: setup passed, native compile stopped because godot-cpp requires api_version. Added exact 4.7 API selection and a RefCounted-only binding profile; errors now print bounded diagnostics. Rebuild pending.
