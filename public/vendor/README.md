# Browser runtime dependencies

These pinned browser builds replace unversioned third-party CDN requests in the
Card, Board, and Chess entry flows. They are ordinary public runtime files for
the browser build and are also included in the desktop game's verified local
package.

- React 18.3.1 (`react.development.js`)
- ReactDOM 18.3.1 (`react-dom.development.js`)
- Babel Standalone 7.24.7 (`babel.min.js`)
- Socket.IO client 4.8.1 (`socket.io.min.js`)
- Tailwind CSS 3.4.17 is compiled into
  `public/css/card-entry-tailwind-v1.min.css`; its license is retained here.

The corresponding upstream license texts are stored in `licenses/`.
