/* Independently implemented from the supplied requirements, 2026-09-06.
   Visual-only Pointer Events controller; no game, storage, or network access. */
(function cardFinishModule(global) {
  'use strict';

  const MAX_SURFACES = 4;
  const POINTER_PROPERTIES = [
    '--finish-pitch', '--finish-yaw', '--finish-light-x', '--finish-light-y',
    '--finish-band-angle', '--finish-film-x', '--finish-film-y'
  ];
  const OBSERVED_ATTRIBUTES = [
    'class', 'style', 'hidden', 'aria-hidden', 'disabled',
    'data-card-finish', 'data-finish-context', 'src', 'srcset', 'sizes'
  ];

  function finishFromSource(source, baseURI) {
    if (typeof source !== 'string' || !source.trim()) return 'plain';
    try {
      const path = new URL(source, baseURI).pathname;
      return /^\/images\/(?:cards|cards_lux)\/enh\/[0-9]+\.webp$/i.test(path) ? 'foil' : 'plain';
    } catch (_) {
      return 'plain';
    }
  }

  function selectFinish(context, requested, imageSource, baseURI) {
    if (context === 'choice') return finishFromSource(imageSource, baseURI);
    return requested === 'foil' ? 'foil' : 'plain';
  }

  function mapPointer(clientX, clientY, bounds, context) {
    const clamp = (value) => Math.min(1, Math.max(0, value));
    const x = Number.isFinite(clientX) && bounds.width > 0 ? clamp((clientX - bounds.left) / bounds.width) : .5;
    const y = Number.isFinite(clientY) && bounds.height > 0 ? clamp((clientY - bounds.top) / bounds.height) : .5;
    const horizontal = 2 * x - 1;
    const vertical = 2 * y - 1;
    const distance = Math.hypot(horizontal, vertical);
    const angle = (context === 'choice' ? 8 : 12) * Math.sin(Math.min(distance, 1) * Math.PI / 2);
    const gain = distance > 0 ? angle / distance : 0;
    return {
      pitch: -vertical * gain,
      yaw: horizontal * gain,
      lightX: 24 + 52 * x,
      lightY: 18 + 64 * y,
      bandAngle: 117 + 22 * horizontal - 10 * vertical,
      filmX: 35 + 30 * x,
      filmY: 65 - 30 * y
    };
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = { finishFromSource, selectFinish, mapPointer };
  }
  if (!global.document) return;

  const document = global.document;
  const surfaces = new Map();
  const finePointer = global.matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotion = global.matchMedia('(prefers-reduced-motion: reduce)');
  let stopped = false;
  let listening = false;

  function hasMotionInput() {
    return finePointer.matches && !reducedMotion.matches;
  }

  function setAttribute(element, name, value) {
    if (element.getAttribute(name) !== value) element.setAttribute(name, value);
  }

  function isVisible(root) {
    if (!root.isConnected || !root.getClientRects().length) return false;
    for (let element = root; element; element = element.parentElement) {
      if (element.hidden || element.getAttribute('aria-hidden') === 'true') return false;
      const style = global.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.opacity === '0') return false;
    }
    return true;
  }

  function createSurface(root) {
    let face = null;
    let picture = null;
    let ancestors = [];
    let available = false;
    let scheduledFrame = 0;
    let lastPoint = null;
    let disposed = false;

    function isFrozen() {
      return !!root.closest('button:disabled, .card-frozen') ||
        !!(face && face.classList.contains('card-frozen')) ||
        !!(picture && picture.classList.contains('card-frozen'));
    }

    function reset() {
      if (scheduledFrame) global.cancelAnimationFrame(scheduledFrame);
      scheduledFrame = 0;
      lastPoint = null;
      root.removeAttribute('data-finish-engaged');
      if (face) POINTER_PROPERTIES.forEach((name) => face.style.removeProperty(name));
    }

    function sync() {
      if (disposed) return;
      const nextFace = root.querySelector('.card-finish-face');
      const nextPicture = nextFace && nextFace.querySelector('img');
      const nextAncestors = [];
      for (let element = root; element; element = element.parentElement) nextAncestors.push(element);
      // Keep the former attachment points while detached so re-insertion can
      // be noticed without adding a document-wide subtree observer.
      if (!root.isConnected) ancestors.forEach((element) => { if (!nextAncestors.includes(element)) nextAncestors.push(element); });
      const needsObserver = nextFace !== face || nextPicture !== picture ||
        nextAncestors.length !== ancestors.length || nextAncestors.some((element, index) => element !== ancestors[index]);

      if (nextFace !== face || nextPicture !== picture) {
        reset();
        if (picture) picture.removeEventListener('load', onImageLoad);
        face = nextFace;
        picture = nextPicture;
        if (picture) picture.addEventListener('load', onImageLoad);
      }
      ancestors = nextAncestors;

      const context = root.getAttribute('data-finish-context');
      const finish = selectFinish(context, root.getAttribute('data-card-finish'), picture && picture.getAttribute('src'), document.baseURI);
      if (root.getAttribute('data-finish-surface') !== finish) reset();
      setAttribute(root, 'data-finish-surface', finish);
      const isStatic = !hasMotionInput();
      setAttribute(root, 'data-finish-static', isStatic ? 'true' : 'false');
      available = !!face && !!picture && isVisible(root) && !isFrozen();
      setAttribute(root, 'data-finish-locked', available ? 'false' : 'true');
      if (!available || isStatic || document.hidden) reset();

      if (needsObserver) {
        mutationObserver.disconnect();
        ancestors.forEach((element) => mutationObserver.observe(element, { attributes: true, attributeFilter: OBSERVED_ATTRIBUTES, childList: true }));
        if (face && face !== root) mutationObserver.observe(face, { attributes: true, attributeFilter: ['class', 'hidden', 'aria-hidden'], childList: true });
        if (picture) mutationObserver.observe(picture, { attributes: true, attributeFilter: OBSERVED_ATTRIBUTES });
      }
    }

    function onImageLoad() {
      reset();
      sync();
    }

    const mutationObserver = new global.MutationObserver((records) => {
      const relevant = records.some((record) => {
        if (record.type === 'attributes' || record.target === root || record.target === face) return true;
        const changedNodes = [...(record.addedNodes || []), ...(record.removedNodes || [])];
        return changedNodes.some((node) => node === root || (typeof node.contains === 'function' && node.contains(root)));
      });
      if (!relevant) return;
      if (records.some((record) => record.target === picture && ['src', 'srcset', 'sizes'].includes(record.attributeName))) reset();
      sync();
    });

    function renderPoint() {
      scheduledFrame = 0;
      if (!lastPoint || !available || !hasMotionInput() || document.hidden) {
        reset();
        return;
      }
      // The stationary root supplies geometry; only its child face is transformed.
      const bounds = root.getBoundingClientRect();
      if (!(bounds.width > 0 && bounds.height > 0) || isFrozen()) {
        reset();
        return;
      }
      const point = mapPointer(lastPoint.x, lastPoint.y, bounds, root.getAttribute('data-finish-context'));
      const values = [
        `${point.pitch}deg`, `${point.yaw}deg`,
        `${point.lightX.toFixed(2)}%`, `${point.lightY.toFixed(2)}%`,
        `${point.bandAngle.toFixed(2)}deg`, `${point.filmX.toFixed(2)}%`, `${point.filmY.toFixed(2)}%`
      ];
      POINTER_PROPERTIES.forEach((name, index) => face.style.setProperty(name, values[index]));
      setAttribute(root, 'data-finish-engaged', 'true');
      // No self-scheduling loop: the next frame requires a new pointer event.
    }

    function onPointer(event) {
      if (event.pointerType !== 'mouse' || !hasMotionInput() || document.hidden || !available) {
        reset();
        return;
      }
      lastPoint = { x: event.clientX, y: event.clientY };
      if (!scheduledFrame) scheduledFrame = global.requestAnimationFrame(renderPoint);
    }

    const pointerOptions = { passive: true };
    root.addEventListener('pointerenter', onPointer, pointerOptions);
    root.addEventListener('pointermove', onPointer, pointerOptions);
    root.addEventListener('pointerleave', reset, pointerOptions);
    root.addEventListener('pointercancel', reset, pointerOptions);
    const resizeObserver = typeof global.ResizeObserver === 'function' ? new global.ResizeObserver(() => { reset(); sync(); }) : null;
    const intersectionObserver = typeof global.IntersectionObserver === 'function' ? new global.IntersectionObserver((entries) => {
      if (entries.some((entry) => !entry.isIntersecting)) reset();
      sync();
    }) : null;
    if (resizeObserver) resizeObserver.observe(root);
    if (intersectionObserver) intersectionObserver.observe(root);
    sync();

    return {
      sync,
      reset,
      destroy() {
        disposed = true;
        reset();
        mutationObserver.disconnect();
        if (resizeObserver) resizeObserver.disconnect();
        if (intersectionObserver) intersectionObserver.disconnect();
        if (picture) picture.removeEventListener('load', onImageLoad);
        root.removeEventListener('pointerenter', onPointer, pointerOptions);
        root.removeEventListener('pointermove', onPointer, pointerOptions);
        root.removeEventListener('pointerleave', reset, pointerOptions);
        root.removeEventListener('pointercancel', reset, pointerOptions);
        ['data-finish-surface', 'data-finish-static', 'data-finish-locked'].forEach((name) => root.removeAttribute(name));
      }
    };
  }

  function resetAll() {
    surfaces.forEach((surface) => surface.reset());
  }

  function syncAll() {
    surfaces.forEach((surface) => { surface.reset(); surface.sync(); });
  }

  function listen() {
    if (listening) return;
    listening = true;
    global.addEventListener('blur', resetAll);
    global.addEventListener('scroll', resetAll, { capture: true, passive: true });
    global.addEventListener('resize', syncAll, { passive: true });
    document.addEventListener('visibilitychange', syncAll);
    finePointer.addEventListener('change', syncAll);
    reducedMotion.addEventListener('change', syncAll);
  }

  function refresh() {
    if (stopped) return 0;
    surfaces.forEach((surface, root) => {
      if (!root.isConnected) { surface.destroy(); surfaces.delete(root); }
    });
    // Discovery is limited to initial load or explicit refresh, never pointer frames.
    const candidates = document.querySelectorAll('[data-card-finish]');
    for (const root of candidates) {
      if (surfaces.has(root)) surfaces.get(root).sync();
      else if (surfaces.size < MAX_SURFACES) surfaces.set(root, createSurface(root));
    }
    if (surfaces.size) listen();
    return surfaces.size;
  }

  function destroy() {
    stopped = true;
    surfaces.forEach((surface) => surface.destroy());
    surfaces.clear();
    global.removeEventListener('blur', resetAll);
    global.removeEventListener('scroll', resetAll, true);
    global.removeEventListener('resize', syncAll);
    document.removeEventListener('visibilitychange', syncAll);
    document.removeEventListener('DOMContentLoaded', refresh);
    finePointer.removeEventListener('change', syncAll);
    reducedMotion.removeEventListener('change', syncAll);
    listening = false;
  }

  global.CardFinishV1 = Object.freeze({ refresh, destroy });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh, { once: true });
  else refresh();
})(typeof window === 'object' ? window : globalThis);
