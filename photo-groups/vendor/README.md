# Wedding guestbook browser dependencies

`pdf-lib.min.js` is the unmodified browser distribution of **pdf-lib 1.17.1**, licensed under MIT. Its copyright and permission notice are preserved in `pdf-lib.LICENSE.md`.

- Upstream: https://github.com/Hopding/pdf-lib
- API documentation: https://pdf-lib.js.org/docs/api/classes/pdfdocument
- Distribution: `dist/pdf-lib.min.js` from the Codex bundled `pdf-lib@1.17.1` package, copied without modification.
- Size: 525,099 bytes.
- SHA-256: `0f9a5cad07941f0826586c94e089d89b918c46e5c17cf2d5a3c6f666e3bc694f`.

The wedding control page loads this local copy. Exporting never loads a third-party CDN or sends guest data to an external PDF service. It does not add a server package or change the game project dependencies.

`pdf-lib.dependencies.LICENSES.txt` additionally preserves bundled-package notices for pdf-lib, `@pdf-lib/standard-fonts`, `@pdf-lib/upng`, pako, and tslib from the workspace runtime. These notices supplement, rather than replace, the upstream pdf-lib MIT license.
