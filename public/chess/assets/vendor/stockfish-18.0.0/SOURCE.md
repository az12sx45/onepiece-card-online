# Stockfish.js 18.0.0 (lite single-threaded)

This directory vendors the browser WebAssembly build from:

- Project: https://github.com/nmrugg/stockfish.js
- Release: https://github.com/nmrugg/stockfish.js/releases/tag/v18.0.0
- Upstream engine: https://github.com/official-stockfish/Stockfish
- License: GNU GPL version 3 (`COPYING.txt`)

Vendored files and verified SHA-256 values:

- `stockfish-18-lite-single.js`: `2278005057F381491F1C9BB3E44C9F5920B3A00BEF9759E33CC6582769A1F1FE`
- `stockfish-18-lite-single.wasm`: `A8FBC05EC6920B56D7485826DCB02C5FFD2826BCBF751CF973046F237A9096F1`
- `COPYING.txt`: `0B383D5A63DA644F628D99C33976EA6487ED89AAA59F0B3257992DEAC1171E6B`

The files are kept unmodified and loaded in a dedicated Web Worker.
`stockfish-file-bundle-v1.js` is a generated base64 packaging of the same two
verified engine files so Chromium can start the Worker when the game is opened
directly through `file://`. Rebuild it with `qa/build-stockfish-file-bundle-v1.js`.
