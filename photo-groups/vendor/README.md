# Wedding guestbook browser dependencies

`pdf-lib.min.js` is the unmodified browser distribution of **pdf-lib 1.17.1**, licensed under MIT. Its copyright and permission notice are preserved in `pdf-lib.LICENSE.md`.

- Upstream: https://github.com/Hopding/pdf-lib
- API documentation: https://pdf-lib.js.org/docs/api/classes/pdfdocument
- Distribution: `dist/pdf-lib.min.js` from the Codex bundled `pdf-lib@1.17.1` package, copied without modification.
- Size: 525,099 bytes.
- SHA-256: `0f9a5cad07941f0826586c94e089d89b918c46e5c17cf2d5a3c6f666e3bc694f`.

The wedding control page loads this local copy. Exporting never loads a third-party CDN or sends guest data to an external PDF service. It does not add a server package or change the game project dependencies.

`pdf-lib.dependencies.LICENSES.txt` additionally preserves bundled-package notices for pdf-lib, `@pdf-lib/standard-fonts`, `@pdf-lib/upng`, pako, and tslib from the workspace runtime. These notices supplement, rather than replace, the upstream pdf-lib MIT license.

## Print PDF color conversion

`lcms/lcms.js` and `lcms/lcms.wasm` are the unmodified browser distribution of **lcms-wasm 1.0.5**, wrapping **LittleCMS 2.16**. Both projects use MIT licenses. The original wrapper, Emscripten runtime, and musl notices are also preserved in `lcms/`; exact sources, npm integrity, and file hashes are recorded in `lcms/SOURCE.txt` and `lcms/manifest.json`. These local files are loaded only when print export needs ICC conversion; they require no CDN, npm runtime installation, or image-processing backend.

`icc/Coated_Fogra39L_VIGC_300.icc` is the unmodified 8,652,444-byte profile from the [official ICC Profile Registry](https://registry.color.org/profile-registry/Coated_Fogra39L_VIGC_300). Its separate X-Rite/VIGC permission allows use, embedding, exchange, and sharing, while alteration or sale requires VIGC's written permission. The original permission and provenance are preserved in `icc/Coated_Fogra39L_VIGC_300.LICENSE.txt`. This is a generic FOGRA39 coated-paper, 300% total-ink condition; acceptance and the actual press/paper match require confirmation by the print provider.

The verified path uses a built-in sRGB input profile and the VIGC CMYK output profile, relative colorimetric intent plus black-point compensation. Pack canvas RGBA into RGB3 strips before `cmsDoTransform` and release profiles/transforms after use. A synthetic browser proof converted all 2,315 × 3,142 pixels; its eight color patches matched native Pillow/LittleCMS output byte-for-byte. This verifies ICC conversion, not a physical press proof or PDF/X certification.
