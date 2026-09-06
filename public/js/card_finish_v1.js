/* Independently implemented from the supplied requirements, 2026-09-06.
   Visual-only card presentation controller; no game, storage, or socket access. */
(function cardFinishModule(global) {
  'use strict';

  const MAX_SURFACES = 4;
  const MAX_DEPTH_LOADS = 2;
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

  function depthFromSource(source, baseURI) {
    if (typeof source !== 'string' || !source.trim()) return null;
    try {
      const base = new URL(baseURI);
      const url = new URL(source, base);
      if (!/^https?:$/.test(url.protocol) || url.origin !== base.origin) return null;
      const match = /^\/images\/(cards|cards_lux)\/(enh\/)?([0-9]|1[0-9])\.webp$/.exec(url.pathname);
      if (!match) return null;
      const enhanced = !!match[2];
      const variant = match[1] === 'cards_lux' ? (enhanced ? 'lux-enh' : 'lux') : (enhanced ? 'enh' : 'normal');
      const key = `${variant}/${match[3]}`;
      // Keep desktop depth media under the launcher's existing images/* cache boundary.
      const prefix = `/images/card-depth/v1/${key}/`;
      return { key, enhanced, background: `${prefix}background.webp`, subject: `${prefix}subject.webp`, foreground: `${prefix}foreground.webp` };
    } catch (_) {
      return null;
    }
  }

  function mapDepthPointer(clientX, clientY, bounds, enhanced) {
    const axis = (value, start, size) => Number.isFinite(value) && size > 0 ? 2 * Math.min(1, Math.max(0, (value - start) / size)) - 1 : 0;
    const width = Number.isFinite(bounds.width) && bounds.width > 0 ? bounds.width : 0;
    // Both axes scale with card width, so small choice cards remain restrained.
    return {
      x: axis(clientX, bounds.left, bounds.width) * width * (enhanced ? .01 : .008),
      y: axis(clientY, bounds.top, bounds.height) * width * (enhanced ? .006 : .0048)
    };
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
    module.exports = { finishFromSource, selectFinish, mapPointer, depthFromSource, mapDepthPointer };
  }
  if (!global.document) return;

  const document = global.document;
  const surfaces = new Map();
  const finePointer = global.matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotion = global.matchMedia('(prefers-reduced-motion: reduce)');
  const connection = global.navigator && global.navigator.connection;
  let stopped = false;
  let listening = false;
  let activeReset = null;
  let activeDepthLoads = 0;
  const depthLoadQueue = [];

  function pumpDepthLoads() {
    while (activeDepthLoads < MAX_DEPTH_LOADS && depthLoadQueue.length) {
      const task = depthLoadQueue.shift();
      if (task.cancelled) continue;
      activeDepthLoads += 1;
      Promise.resolve().then(() => task.cancelled ? null : task.run()).catch(() => {}).finally(() => {
        activeDepthLoads -= 1;
        pumpDepthLoads();
      });
    }
  }

  function enqueueDepthLoad(run, priority) {
    const task = { cancelled: false, run };
    if (priority) depthLoadQueue.unshift(task);
    else depthLoadQueue.push(task);
    pumpDepthLoads();
    return task;
  }

  function hasMotionInput() {
    return finePointer.matches && !reducedMotion.matches;
  }

  function hasDepthInput() {
    return hasMotionInput() && !(connection && connection.saveData) && !!(global.CSS &&
      typeof global.CSS.supports === 'function' && (global.CSS.supports('mask-image', 'url("mask.webp")') ||
      global.CSS.supports('-webkit-mask-image', 'url("mask.webp")')));
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
    let depth = null;
    let depthGeneration = 0;
    let attemptedSource = null;
    let idleHandle = null;
    let idleKind = '';
    let loadTask = null;
    let inViewport = typeof global.IntersectionObserver !== 'function';

    function sourceStamp() {
      return picture ? ['src', 'srcset', 'sizes'].map((name) => picture.getAttribute(name) || '').join('\n') : '';
    }

    function cancelIdleLoad() {
      if (idleHandle === null) return;
      if (idleKind === 'idle' && typeof global.cancelIdleCallback === 'function') global.cancelIdleCallback(idleHandle);
      else global.clearTimeout(idleHandle);
      idleHandle = null;
      idleKind = '';
    }

    function cancelQueuedLoad() {
      if (loadTask) loadTask.cancelled = true;
      loadTask = null;
    }

    function releaseDepth() {
      depthGeneration += 1;
      root.removeAttribute('data-finish-depth');
      if (depth) {
        depth.container.remove();
        // Keep no decoded image cache: a visible card owns 3 assets and 1 source clone.
        depth.images.forEach((image) => image.removeAttribute('src'));
        depth = null;
      }
    }

    function invalidateDepth() {
      cancelIdleLoad();
      cancelQueuedLoad();
      attemptedSource = null;
      releaseDepth();
    }

    function depthMayDisplay(stamp) {
      return !disposed && available && inViewport && hasDepthInput() &&
        !document.hidden && isVisible(root) && !isFrozen() && stamp === sourceStamp() &&
        !!picture && picture.complete && picture.naturalWidth > 0;
    }

    function moveSubject(bounds) {
      if (!depth) return;
      if (!lastPoint) {
        depth.container.style.removeProperty('--finish-depth-x');
        depth.container.style.removeProperty('--finish-depth-y');
        return;
      }
      const point = mapDepthPointer(lastPoint.x, lastPoint.y, bounds, depth.spec.enhanced);
      depth.container.style.setProperty('--finish-depth-x', `${point.x.toFixed(3)}px`);
      depth.container.style.setProperty('--finish-depth-y', `${point.y.toFixed(3)}px`);
    }

    function beginDepthLoad(stamp) {
      if (depth && depth.stamp !== stamp) releaseDepth();
      if (attemptedSource === stamp || !depthMayDisplay(stamp)) return Promise.resolve();
      attemptedSource = stamp;
      // The source image remains first and authoritative, including its load lifecycle.
      // Responsive sources are not present in the four hooks; an unknown one falls back.
      if (picture.getAttribute('srcset')) return Promise.resolve();
      const spec = depthFromSource(picture.getAttribute('src'), document.baseURI);
      if (!spec) return Promise.resolve();
      const originalSource = new URL(picture.getAttribute('src'), document.baseURI).href;
      if (picture.currentSrc && picture.currentSrc !== originalSource) return Promise.resolve();
      const container = document.createElement('span');
      container.setAttribute('class', 'card-finish-depth');
      container.setAttribute('aria-hidden', 'true');
      const images = ['background', 'subject', 'foreground'].map((role) => {
        const image = document.createElement('img');
        image.setAttribute('class', `card-finish-depth-${role}`);
        image.setAttribute('alt', '');
        image.setAttribute('draggable', 'false');
        image.setAttribute('decoding', 'async');
        // foreground.webp is an alpha mask; it is never a visible color layer.
        if (role !== 'foreground') container.append(image);
        return image;
      });
      const generation = ++depthGeneration;
      depth = { container, images, spec, stamp };
      moveSubject(root.getBoundingClientRect());
      // No partial composite is attached. A missing layer or failed decode retains the original.
      return Promise.all(images.map((image, index) => {
        image.setAttribute('src', spec[['background', 'subject', 'foreground'][index]]);
        return typeof image.decode === 'function' ? image.decode() : Promise.reject(new Error('Image decode unavailable'));
      })).then(async () => {
        if (generation !== depthGeneration) return;
        const dimensionsMatch = images.every((image) => image.naturalWidth > 0 && image.naturalHeight > 0 &&
          image.naturalWidth === images[0].naturalWidth && image.naturalHeight === images[0].naturalHeight &&
          Math.abs(image.naturalWidth / image.naturalHeight - 2 / 3) < .001);
        if (!dimensionsMatch || !depthMayDisplay(stamp)) { releaseDepth(); return; }
        const foreground = document.createElement('img');
        foreground.setAttribute('class', 'card-finish-depth-foreground');
        foreground.setAttribute('alt', '');
        foreground.setAttribute('draggable', 'false');
        foreground.setAttribute('decoding', 'async');
        foreground.style.setProperty('mask-image', `url("${spec.foreground}")`);
        foreground.style.setProperty('-webkit-mask-image', `url("${spec.foreground}")`);
        images.push(foreground);
        foreground.setAttribute('src', originalSource);
        await foreground.decode();
        if (generation !== depthGeneration) return;
        if (!depthMayDisplay(stamp) || foreground.naturalWidth !== picture.naturalWidth ||
          foreground.naturalHeight !== picture.naturalHeight ||
          (picture.currentSrc && picture.currentSrc !== originalSource)) { releaseDepth(); return; }
        container.append(foreground);
        moveSubject(root.getBoundingClientRect());
        face.append(container);
        setAttribute(root, 'data-finish-depth', 'ready');
      }).catch(() => {
        if (generation === depthGeneration) releaseDepth();
      });
    }

    function queueDepth(priority) {
      const stamp = sourceStamp();
      if (!depthMayDisplay(stamp) || attemptedSource === stamp || loadTask || (depth && depth.stamp === stamp)) return;
      cancelIdleLoad();
      const task = enqueueDepthLoad(() => beginDepthLoad(stamp), priority);
      loadTask = task;
      const originalRun = task.run;
      task.run = () => Promise.resolve(originalRun()).finally(() => { if (loadTask === task) loadTask = null; });
    }

    function scheduleDepth() {
      const stamp = sourceStamp();
      if (idleHandle !== null || loadTask || attemptedSource === stamp || (depth && depth.stamp === stamp) || !depthMayDisplay(stamp)) return;
      const run = () => {
        idleHandle = null;
        idleKind = '';
        queueDepth(false);
      };
      if (typeof global.requestIdleCallback === 'function') {
        idleKind = 'idle';
        idleHandle = global.requestIdleCallback(run, { timeout: 300 });
      } else {
        idleKind = 'timer';
        idleHandle = global.setTimeout(run, 80);
      }
    }

    function isFrozen() {
      return !!root.closest('button:disabled, .card-frozen') ||
        !!(face && face.classList.contains('card-frozen')) ||
        !!(picture && picture.classList.contains('card-frozen'));
    }

    function clearPointer() {
      if (scheduledFrame) global.cancelAnimationFrame(scheduledFrame);
      scheduledFrame = 0;
      lastPoint = null;
      if (activeReset === clearPointer) activeReset = null;
      root.removeAttribute('data-finish-engaged');
      if (face) POINTER_PROPERTIES.forEach((name) => face.style.removeProperty(name));
      if (depth) moveSubject(root.getBoundingClientRect());
    }

    function reset() {
      clearPointer();
      invalidateDepth();
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
      if (!available || !inViewport || isStatic || document.hidden || !hasDepthInput()) reset();
      else scheduleDepth();

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
        clearPointer();
        return;
      }
      // The stationary root supplies geometry; only its child face is transformed.
      const bounds = root.getBoundingClientRect();
      if (!(bounds.width > 0 && bounds.height > 0) || isFrozen()) {
        clearPointer();
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
      queueDepth(true);
      moveSubject(bounds);
      // No self-scheduling loop: the next frame requires a new pointer event.
    }

    function onPointer(event) {
      if (event.pointerType !== 'mouse' || !hasMotionInput() || document.hidden || !available || isFrozen()) {
        clearPointer();
        return;
      }
      if (activeReset && activeReset !== clearPointer) activeReset();
      activeReset = clearPointer;
      lastPoint = { x: event.clientX, y: event.clientY };
      if (!scheduledFrame) scheduledFrame = global.requestAnimationFrame(renderPoint);
    }

    const pointerOptions = { passive: true };
    root.addEventListener('pointerenter', onPointer, pointerOptions);
    root.addEventListener('pointermove', onPointer, pointerOptions);
    root.addEventListener('pointerleave', clearPointer, pointerOptions);
    root.addEventListener('pointercancel', clearPointer, pointerOptions);
    const resizeObserver = typeof global.ResizeObserver === 'function' ? new global.ResizeObserver(() => { clearPointer(); sync(); }) : null;
    const intersectionObserver = typeof global.IntersectionObserver === 'function' ? new global.IntersectionObserver((entries) => {
      const entry = entries.find((candidate) => candidate.target === root) || entries[0];
      inViewport = !!(entry && entry.isIntersecting && entry.intersectionRatio > 0);
      if (!inViewport) reset();
      sync();
    }, { root: null, rootMargin: '0px', threshold: .01 }) : null;
    if (resizeObserver) resizeObserver.observe(root);
    if (intersectionObserver) intersectionObserver.observe(root);
    sync();

    return {
      sync,
      reset,
      clearPointer,
      destroy() {
        disposed = true;
        reset();
        mutationObserver.disconnect();
        if (resizeObserver) resizeObserver.disconnect();
        if (intersectionObserver) intersectionObserver.disconnect();
        if (picture) picture.removeEventListener('load', onImageLoad);
        root.removeEventListener('pointerenter', onPointer, pointerOptions);
        root.removeEventListener('pointermove', onPointer, pointerOptions);
        root.removeEventListener('pointerleave', clearPointer, pointerOptions);
        root.removeEventListener('pointercancel', clearPointer, pointerOptions);
        ['data-finish-surface', 'data-finish-static', 'data-finish-locked'].forEach((name) => root.removeAttribute(name));
      }
    };
  }

  function clearPointers() {
    surfaces.forEach((surface) => surface.clearPointer());
  }

  function syncAll() {
    surfaces.forEach((surface) => { surface.clearPointer(); surface.sync(); });
  }

  function listen() {
    if (listening) return;
    listening = true;
    global.addEventListener('blur', clearPointers);
    global.addEventListener('scroll', clearPointers, { capture: true, passive: true });
    global.addEventListener('resize', syncAll, { passive: true });
    document.addEventListener('visibilitychange', syncAll);
    finePointer.addEventListener('change', syncAll);
    reducedMotion.addEventListener('change', syncAll);
    if (connection && typeof connection.addEventListener === 'function') connection.addEventListener('change', syncAll);
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
    global.removeEventListener('blur', clearPointers);
    global.removeEventListener('scroll', clearPointers, true);
    global.removeEventListener('resize', syncAll);
    document.removeEventListener('visibilitychange', syncAll);
    document.removeEventListener('DOMContentLoaded', refresh);
    finePointer.removeEventListener('change', syncAll);
    reducedMotion.removeEventListener('change', syncAll);
    if (connection && typeof connection.removeEventListener === 'function') connection.removeEventListener('change', syncAll);
    listening = false;
  }

  global.CardFinishV1 = Object.freeze({ refresh, destroy });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh, { once: true });
  else refresh();
})(typeof window === 'object' ? window : globalThis);
