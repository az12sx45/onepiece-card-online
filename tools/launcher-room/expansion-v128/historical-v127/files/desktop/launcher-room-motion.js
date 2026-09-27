/* Directional room animation. Coordinates and stride values use front-row stage pixels. */
(function (root, factory) {
  'use strict';
  const reserved = typeof module === 'object' && module.exports ? require('./launcher-reserved-crew.js') : root.OnePieceReservedCrew;
  const api = factory(reserved);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OnePieceRoomMotion = api;
}(typeof globalThis === 'object' ? globalThis : this, function (reserved) {
  'use strict';
  const DIRECTIONS = Object.freeze(['east', 'west', 'north', 'south']);
  const WALK_SHAPE = Object.freeze({ columns: 4, rows: 1, frames: 4, cell: 128, width: 512, height: 128, rootX: 64, rootY: 112 });
  const ACTION_SHAPE = Object.freeze({ columns: 8, rows: 1, frames: 8, cell: 128, width: 1024, height: 128, rootX: 64, rootY: 112, beatsPerAction: 1 });
  const SHAPE = WALK_SHAPE;
  // Geometry remains in 128px units. These are source pixel densities only.
  const ATLAS_RESOLUTION = Object.freeze({ motion_v4: 3, acting_v4: 2 });
  const TURN_MS = 140;
  const ACTION_POSES = Object.freeze(['idle', 'talk_happy', 'talk_annoyed', 'surprised', 'focused_use', 'sit', 'wave', 'listen']);
  const STRIDES = Object.freeze({ luffy: 24, zoro: 24, nami: 24, usopp: 24, sanji: 24, chopper: 20, robin: 24, franky: 24, brook: 24, jinbe: 24, ...Object.fromEntries((reserved?.RESERVED_KEYS || []).map(key => [key, 24])) });
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
    const vertical = direction => direction === 'north' || direction === 'south' ? .5 : 1;
    const baseStride = finite(typeof override.stride === 'object' ? undefined : override.stride, STRIDES[key] || 24, 12, 120);
    const baseSpeed = finite(typeof override.speed === 'object' ? undefined : override.speed, 26, 10, 100);
    const stride = Object.fromEntries(DIRECTIONS.map(direction => [direction,
      finite(typeof override.stride === 'object' ? override.stride?.[direction] : undefined, baseStride * vertical(direction), 8, 120)]));
    const speed = Object.fromEntries(DIRECTIONS.map(direction => [direction,
      finite(typeof override.speed === 'object' ? override.speed?.[direction] : undefined, baseSpeed * vertical(direction), 6, 100)]));
    return { stride, speed, displayScale: finite(override.displayScale, 1, .5, 1.5), standingFrame: Math.trunc(finite(override.standingFrame, 1, 0, SHAPE.frames - 1)),
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
  // Each expression is one authored, complete body, independent of elapsed time.
  function actionFrame(pose) { return ACTION_POSES.indexOf(pose); }
  function speedAndStride(key, direction, scale, table) {
    const meta = metadata(key, table);
    const factor = finite(scale, 1.07, .72, 1.07) / 1.07 * meta.displayScale;
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
  function atlasUrl(key, direction, kind = 'motion_v4') {
    if (!Object.hasOwn(STRIDES, key) || !DIRECTIONS.includes(direction)) return '';
    if (!Object.hasOwn(ATLAS_RESOLUTION, kind)) return '';
    if (key === 'robin') return `opui://launcher/images/launcher_room/robin_v2/${kind === 'acting_v4' ? 'acting' : 'walk'}/${direction}.webp`;
    if (reserved?.RESERVED_KEYS.includes(key)) return reserved.assetUrl(key, `${kind === 'acting_v4' ? 'acting' : 'walk'}/${direction}.webp`);
    return `opui://launcher/images/launcher_room/${kind}/${key}/${direction}.webp`;
  }
  function walkShape() { return WALK_SHAPE; }
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
        const shape = kind === 'acting_v4' ? ACTION_SHAPE : walkShape(direction);
        const resolution = ATLAS_RESOLUTION[kind];
        const width = shape.width * resolution, height = shape.height * resolution;
        if (image.naturalWidth !== width || image.naturalHeight !== height) throw new Error(`Directional atlas must be ${width} × ${height}`);
        if (typeof globalThis.createImageBitmap === 'function') {
          // Retain authored HD pixels; a decode must never shrink back to 128px.
          const bitmap = await globalThis.createImageBitmap(image);
          atlasResolution.set(bitmap, resolution); record.atlases[direction] = bitmap;
          image.src = '';
        } else { atlasResolution.set(image, resolution); record.atlases[direction] = image; }
      } catch (error) { record.errors[direction] = String(error?.message || error); }
    }))).then(() => { record.complete = true; return record; });
    return record;
  }
  function preload(key, ImageType = globalThis.Image) { return loadAtlases(key, ImageType, 'motion_v4'); }
  function preloadActions(key, ImageType = globalThis.Image) { return loadAtlases(key, ImageType, 'acting_v4'); }
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
    // Retain native source detail at the 1.5x display scale and on DPR 2 screens.
    // No repeated layout read or canvas reallocation is needed while walking.
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(atlas, index % shape.columns * shape.cell * resolution, Math.floor(index / shape.columns) * shape.cell * resolution,
      renderCell, renderCell, 0, 0, renderCell, renderCell);
    return true;
  }
  return Object.freeze({ DIRECTIONS, SHAPE, WALK_SHAPE, ACTION_SHAPE, ATLAS_RESOLUTION, TURN_MS, ACTION_POSES, metadata, directionForDelta, createState, face, advance, projectedScale, speedAndStride, pathStep, walkShape, actionFrame, atlasUrl, preload, preloadActions, draw });
}));
