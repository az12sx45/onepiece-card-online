'use strict';

// Installed only by the verified native program view at document start.
(function installMarinefordProgram(payload) {
  const origin = 'https://onepiece-card-online.onrender.com';
  if (location.origin !== origin || location.pathname !== '/marineford/index.html') return;
  const imagePaths = new Set(payload.images);
  const originalFetch = window.fetch.bind(window);
  const imageSource = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  const originalSetAttribute = Element.prototype.setAttribute;
  Object.defineProperty(window, '__PO_MARINEFORD_LOCAL_PROGRAM__', { value: true });
  Object.defineProperty(window, '__PO_MARINEFORD_LOCAL_MEDIA__', { value: true });

  function localImage(value) {
    try {
      const url = new URL(String(value), document.baseURI);
      const path = url.pathname.slice(1);
      if (url.origin === origin && imagePaths.has(path)) {
        return 'poasset://marineford/' + path;
      }
    } catch (_) {}
    return value;
  }

  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    ...imageSource,
    set(value) { imageSource.set.call(this, localImage(value)); }
  });
  Element.prototype.setAttribute = function setAttribute(name, value) {
    return originalSetAttribute.call(this, name,
      this instanceof HTMLImageElement && String(name).toLowerCase() === 'src' ? localImage(value) : value);
  };

  window.fetch = function fetch(input, options) {
    try {
      const url = new URL(input instanceof Request ? input.url : String(input), document.baseURI);
      const method = String(options?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
      if (url.origin === origin && url.pathname === '/marineford/cards.json' && method === 'GET') {
        const response = new Response(payload.cards, {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
        });
        return Promise.resolve(response);
      }
    } catch (_) {}
    return originalFetch(input, options);
  };
})(__PO_NATIVE_PROGRAM_DATA__);
