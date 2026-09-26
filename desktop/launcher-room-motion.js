/* Directional room animation. Coordinates and stride values use front-row stage pixels. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OnePieceRoomMotion = api;
}(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const DIRECTIONS = Object.freeze(['east', 'west', 'north', 'south']);
  const WALK_SHAPE = Object.freeze({ columns: 8, rows: 4, frames: 32, cell: 128, width: 1024, height: 512, rootX: 64, rootY: 112 });
  const ACTION_SHAPE = Object.freeze({ columns: 8, rows: 4, frames: 32, cell: 128, width: 1024, height: 512, rootX: 64, rootY: 112, beatsPerAction: 4 });
  const DEPTH_SLOPES = Object.freeze([-.52, -.26, 0, .26, .52]);
  const DEPTH_WALK_SHAPE = Object.freeze({ ...WALK_SHAPE, rows: 20, frames: 160, height: 2560 });
  const SHAPE = WALK_SHAPE;
  const TURN_MS = 140;
  const ACTION_POSES = Object.freeze(['idle', 'talk_happy', 'talk_annoyed', 'surprised', 'focused_use', 'sit', 'wave', 'listen']);
  const STRIDES = Object.freeze({ luffy: 24, zoro: 24, nami: 24, usopp: 24, sanji: 24, chopper: 20, robin: 24, franky: 26, brook: 26, jinbe: 26 });
  const cache = new Map();
  const atlasResolution = new WeakMap();
  const decodeQueue = [];
  let activeDecodes = 0;
  function decodeLimited(task) {
    return new Promise((resolve, reject) => {
      decodeQueue.push({ task, resolve, reject });
      const drain = () => {
        while (activeDecodes < 2 && decodeQueue.length) {
          const next = decodeQueue.shift(); activeDecodes++;
          Promise.resolve().then(next.task).then(next.resolve, next.reject).finally(() => { activeDecodes--; drain(); });
        }
      };
      drain();
    });
  }
  const finite = (value, fallback, min, max) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
  function metadata(key, table) {
    const override = table?.characters?.[key] || {};
    const vertical = direction => direction === 'north' || direction === 'south' ? .62 : 1;
    const baseStride = finite(typeof override.stride === 'object' ? undefined : override.stride, STRIDES[key] || 24, 12, 120);
    const baseSpeed = finite(typeof override.speed === 'object' ? undefined : override.speed, 26, 10, 100);
    const stride = Object.fromEntries(DIRECTIONS.map(direction => [direction,
      finite(typeof override.stride === 'object' ? override.stride?.[direction] : undefined, baseStride * vertical(direction), 8, 120)]));
    const speed = Object.fromEntries(DIRECTIONS.map(direction => [direction,
      finite(typeof override.speed === 'object' ? override.speed?.[direction] : undefined, baseSpeed * vertical(direction), 6, 100)]));
    return { stride, speed, standingFrame: Math.trunc(finite(override.standingFrame, 0, 0, SHAPE.frames - 1)),
      root: [finite(override.root?.[0], SHAPE.rootX, 0, SHAPE.cell), finite(override.root?.[1], SHAPE.rootY, 0, SHAPE.cell)] };
  }
  function directionForDelta(dc, dr, fallback = 'south') {
    if (!dc && !dr) return DIRECTIONS.includes(fallback) ? fallback : 'south';
    return Math.abs(dc) >= Math.abs(dr) ? (dc < 0 ? 'west' : 'east') : (dr < 0 ? 'north' : 'south');
  }
  function createState(direction = 'south') {
    return { direction: DIRECTIONS.includes(direction) ? direction : 'south', pendingDirection: '', turnUntil: 0, phase: 0, distance: 0, frame: 0 };
  }
  function face(state, direction, now, ready = true) {
    if (!ready || !DIRECTIONS.includes(direction)) return false;
    if (direction === state.direction) { state.pendingDirection = ''; state.turnUntil = 0; return true; }
    if (state.pendingDirection !== direction) { state.pendingDirection = direction; state.turnUntil = now + TURN_MS; return false; }
    if (now < state.turnUntil) return false;
    state.direction = direction; state.pendingDirection = ''; state.turnUntil = 0;
    return true;
  }
  function advance(state, distance, stride, { blocked = false, ready = true } = {}) {
    if (blocked || !ready || !(distance > 0) || !(stride > 0)) return state.frame;
    state.distance += distance;
    state.phase = (state.phase + distance / stride) % 1;
    state.frame = Math.floor(state.phase * SHAPE.frames) % SHAPE.frames;
    return state.frame;
  }
  function projectedScale(y, floor) {
    return .72 + .35 * finite((y - floor.top) / (floor.bottom - floor.top), 0, 0, 1);
  }
  function actionFrame(pose, elapsedMs) {
    const index = ACTION_POSES.indexOf(pose);
    if (index < 0) return -1;
    const beatMs = pose === 'idle' || pose === 'listen' ? 320 : 180;
    const beat = Math.floor(Math.max(0, Number(elapsedMs) || 0) / beatMs) % ACTION_SHAPE.beatsPerAction;
    return index * ACTION_SHAPE.beatsPerAction + beat;
  }
  function speedAndStride(key, direction, scale, table) {
    const meta = metadata(key, table);
    const factor = finite(scale, 1.07, .72, 1.07) / 1.07;
    return { speed: meta.speed[direction] * factor, stride: meta.stride[direction] * factor };
  }
  function pathStep(dx, dy, direction, budget) {
    // North/south art encodes projected Y travel. The floor can add lateral
    // perspective travel, which must not accelerate its cycle.
    const axis = direction === 'north' || direction === 'south' ? Math.abs(dy) : Math.abs(dx);
    const travel = Math.min(axis, Math.max(0, Number(budget) || 0));
    const ratio = axis > 1e-8 ? travel / axis : 1;
    return { dx: dx * ratio, dy: dy * ratio, travel, reached: ratio >= 1 };
  }
  function atlasUrl(key, direction, kind = 'motion_v2') {
    if (!Object.hasOwn(STRIDES, key) || !DIRECTIONS.includes(direction)) return '';
    if (!['motion_v2', 'acting_v2'].includes(kind)) return '';
    return `opui://launcher/images/launcher_room/${kind}/${key}/${direction}.webp`;
  }
  function walkShape(direction) { return direction === 'north' || direction === 'south' ? DEPTH_WALK_SHAPE : WALK_SHAPE; }
  function slopeVariant(slope) {
    return DEPTH_SLOPES.reduce((best, value, index) => Math.abs(value - slope) < Math.abs(DEPTH_SLOPES[best] - slope) ? index : best, 2);
  }
  function loadAtlases(key, ImageType, kind) {
    const cacheKey = `${kind}:${key}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    const record = { atlases: {}, errors: {}, complete: false, promise: null };
    cache.set(cacheKey, record);
    record.promise = Promise.all(DIRECTIONS.map(direction => decodeLimited(async () => {
      try {
        const source = atlasUrl(key, direction, kind);
        if (!source || typeof ImageType !== 'function') throw new Error('Unknown character or image loader');
        const image = new ImageType();
        image.src = source;
        await image.decode();
        const shape = kind === 'acting_v2' ? ACTION_SHAPE : walkShape(direction);
        if (image.naturalWidth !== shape.width || image.naturalHeight !== shape.height) throw new Error(`Directional atlas must be ${shape.width} × ${shape.height}`);
        if (typeof globalThis.createImageBitmap === 'function') {
          // Original dimensions are validated above. Room actors render near
          // 96px, so 128px cells retain detail with one quarter of decoded RAM.
          const resolution = Math.min(1, 128 / shape.cell);
          const bitmap = await globalThis.createImageBitmap(image, { resizeWidth: shape.width * resolution, resizeHeight: shape.height * resolution, resizeQuality: 'high' });
          atlasResolution.set(bitmap, resolution); record.atlases[direction] = bitmap;
          image.src = '';
        } else record.atlases[direction] = image;
      } catch (error) { record.errors[direction] = String(error?.message || error); }
    }))).then(() => { record.complete = true; return record; });
    return record;
  }
  function preload(key, ImageType = globalThis.Image) { return loadAtlases(key, ImageType, 'motion_v2'); }
  function preloadActions(key, ImageType = globalThis.Image) { return loadAtlases(key, ImageType, 'acting_v2'); }
  function draw(canvas, atlas, frame, shape = WALK_SHAPE) {
    if (!canvas || !atlas) return false;
    const context = canvas.getContext('2d');
    if (!context) return false;
    const index = Math.max(0, Math.min(shape.frames - 1, Math.trunc(frame)));
    const resolution = atlasResolution.get(atlas) || 1;
    const renderCell = shape.cell * resolution;
    if (canvas.width !== renderCell) canvas.width = renderCell;
    if (canvas.height !== renderCell) canvas.height = renderCell;
    context.clearRect(0, 0, renderCell, renderCell);
    context.drawImage(atlas, index % shape.columns * shape.cell * resolution, Math.floor(index / shape.columns) * shape.cell * resolution,
      renderCell, renderCell, 0, 0, renderCell, renderCell);
    return true;
  }
  return Object.freeze({ DIRECTIONS, SHAPE, WALK_SHAPE, DEPTH_WALK_SHAPE, DEPTH_SLOPES, ACTION_SHAPE, TURN_MS, ACTION_POSES, metadata, directionForDelta, createState, face, advance, projectedScale, speedAndStride, pathStep, walkShape, slopeVariant, actionFrame, atlasUrl, preload, preloadActions, draw });
}));
