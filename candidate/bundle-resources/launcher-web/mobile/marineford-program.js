'use strict';

// Installed only by the verified native program view at document start.
(function installMarinefordProgram(payload) {
  const origin = 'https://onepiece-card-online.onrender.com';
  if (location.origin !== origin || location.pathname !== '/marineford/index.html') return;
  const imagePaths = new Set(payload.images);
  const media = payload.media || {};
  const originalFetch = window.fetch.bind(window);
  const imageSource = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  const originalSetAttribute = Element.prototype.setAttribute;
  Object.defineProperty(window, '__PO_MARINEFORD_LOCAL_PROGRAM__', { value: true });
  Object.defineProperty(window, '__PO_MARINEFORD_LOCAL_MEDIA__', { value: true });

  function localMedia(value) {
    try {
      const url = new URL(String(value), document.baseURI);
      const path = url.pathname.slice(1);
      if (url.origin === origin && imagePaths.has(path)) {
        return 'poasset://marineford/' + path;
      }
      if (url.origin === origin && Object.hasOwn(media, path)) return media[path].url;
      if (url.origin === origin && /^marineford\/(art|audio|video|videos|fonts)\//.test(path)) {
        return 'poasset://marineford/' + path;
      }
    } catch (_) {}
    return value;
  }

  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    ...imageSource,
    set(value) { imageSource.set.call(this, localMedia(value)); }
  });
  for (const [prototype, property] of [[HTMLMediaElement.prototype, 'src'],
    [HTMLSourceElement.prototype, 'src'], [HTMLVideoElement.prototype, 'poster']]) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, property);
    Object.defineProperty(prototype, property, {
      ...descriptor, set(value) { descriptor.set.call(this, localMedia(value)); }
    });
  }
  window.Audio = new Proxy(window.Audio, {
    construct(target, args, newTarget) {
      if (args.length) args[0] = localMedia(args[0]);
      return Reflect.construct(target, args, newTarget);
    }
  });
  window.FontFace = new Proxy(window.FontFace, {
    construct(target, args, newTarget) {
      if (typeof args[1] === 'string') args[1] = args[1].replace(/url\(\s*(['"]?)(.*?)\1\s*\)/g,
        (_, quote, url) => `url("${localMedia(url)}")`);
      return Reflect.construct(target, args, newTarget);
    }
  });
  Element.prototype.setAttribute = function setAttribute(name, value) {
    const property = String(name).toLowerCase();
    const mapped = property === 'src' && (this instanceof HTMLImageElement ||
      this instanceof HTMLMediaElement || this instanceof HTMLSourceElement) ||
      property === 'poster' && this instanceof HTMLVideoElement;
    return originalSetAttribute.call(this, name,
      mapped ? localMedia(value) : value);
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
      if (url.origin === origin && /^marineford\/(art|audio|video|videos|fonts)\//.test(url.pathname.slice(1))) {
        const entry = media[url.pathname.slice(1)];
        if (!entry || !['GET', 'HEAD'].includes(method)) return Promise.resolve(new Response('', { status: 404 }));
        const signal = options?.signal || (input instanceof Request ? input.signal : null);
        if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
        const binary = atob(entry.url.slice(entry.url.indexOf(',') + 1));
        const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
        const headers = { 'Content-Type': entry.mime, 'Content-Length': String(bytes.length), 'Accept-Ranges': 'bytes' };
        const range = new Headers(options?.headers || (input instanceof Request ? input.headers : undefined)).get('Range');
        let body = bytes, status = 200;
        if (range) {
          const parts = /^bytes=(\d*)-(\d*)$/.exec(range);
          let start = parts?.[1] ? Number(parts[1]) : 0;
          let end = parts?.[2] ? Number(parts[2]) : bytes.length - 1;
          if (parts && !parts[1] && parts[2]) { start = Math.max(0, bytes.length - end); end = bytes.length - 1; }
          if (!parts || !parts[1] && !parts[2] || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
            start < 0 || start >= bytes.length || end < start) {
            return Promise.resolve(new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${bytes.length}` } }));
          }
          end = Math.min(end, bytes.length - 1);body = bytes.slice(start, end + 1);status = 206;
          headers['Content-Range'] = `bytes ${start}-${end}/${bytes.length}`;
          headers['Content-Length'] = String(body.length);
        }
        return Promise.resolve(new Response(method === 'HEAD' ? null : body, { status, headers }));
      }
    } catch (_) {}
    return originalFetch(input, options);
  };
})(__PO_NATIVE_PROGRAM_DATA__);
