(function (root, factory) {
  "use strict";
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BoardMoveFx = api;
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";

  // Presentation only: this module never calculates damage, advances a turn, or
  // changes a battle snapshot. Every visible pixel comes from a supplied image.
  const MODES = new Set(["impact", "projectile", "sweep", "aura", "none"]);
  const MODE_ALIASES = { slash: "sweep", barrage: "impact", bloom: "impact" };
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);
  const aliasIndexes = new WeakMap();
  const safePath = (value) => typeof value === "string" && value.length < 512
    && !/^(?:[a-z]+:|\/\/)/i.test(value) && !/(?:^|[\\/])\.\.(?:[\\/]|$)/.test(value) ? value : "";

  function canonicalMoveId(catalog, value, moveName = "") {
    const moveId = String(value || "");
    if (own(catalog?.moves, moveId)) return moveId;
    const explicit = own(catalog?.aliases, moveId) ? catalog.aliases[moveId] : "";
    if (explicit && own(catalog.moves, explicit)) return explicit;
    // Black-turn enemies embed the original stable move ID after their crew ID.
    // Longest exact suffix wins: e.g. luffy_jet_pistol must not become pistol.
    if (!moveId.startsWith("final_black_turn_") || !catalog?.moves) return "";
    let ids = aliasIndexes.get(catalog.moves);
    if (!ids) {
      ids = Object.keys(catalog.moves).map((id) => ({ id, key: id.replace(/[^\w\u3400-\u9fff.-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 54) }))
        .sort((a, b) => b.key.length - a.key.length);
      aliasIndexes.set(catalog.moves, ids);
    }
    const matches = ids.filter((entry) => moveId.endsWith(`_${entry.key}`));
    const longest = matches.filter((entry) => entry.key.length === matches[0]?.key.length);
    if (longest.length === 1) return longest[0].id;
    const named = longest.filter((entry) => catalog.moves[entry.id]?.moveName === moveName);
    return named.length === 1 ? named[0].id : "";
  }

  function lookup(catalog, event) {
    const moveId = canonicalMoveId(catalog, event?.moveId || event?.id, event?.moveName || event?.name);
    if (!moveId) return null;
    const base = catalog.moves[moveId];
    const variants = Array.isArray(catalog.variants) ? catalog.variants.filter((entry) => entry.moveId === moveId)
      : Array.isArray(catalog.variants?.[moveId]) ? catalog.variants[moveId] : [];
    const name = String(event?.moveName || event?.name || "");
    const type = String(event?.moveType || event?.category || event?.type || "");
    // During selection/dice the presentation type is prepare/dice, while direct
    // engine lookups supply a move object. Both still retain the move category.
    const eventType = ["attack", "status", "heal"].includes(event?.type) ? event.type
      : ["attack", "special", "combo", "battle"].includes(type) ? "attack"
        : ["buff", "shield", "debuff", "control", "heal", "status"].includes(type) ? "status"
          : Number.isFinite(Number(event?.power)) ? (Number(event.power) > 0 ? "attack" : "status") : "";
    for (const entry of variants) {
      if (entry.when) {
        if (entry.when.moveName && entry.when.moveName !== name) continue;
        if (entry.when.eventType && entry.when.eventType !== eventType) continue;
        if (entry.when.moveType && entry.when.moveType !== type) continue;
        return { ...base, ...(entry.profile || entry.variant || entry) };
      }
      if (!entry.previous || !entry.variant) continue;
      if (entry.previous.moveName !== entry.variant.moveName && name) {
        if (entry.previous.moveName === name) return { ...base, ...entry.previous };
        if (entry.variant.moveName === name) return { ...base, ...entry.variant };
      }
      if (entry.previous.damageClass !== entry.variant.damageClass && type) {
        const status = eventType !== "attack";
        return { ...base, ...(status === (entry.previous.damageClass === "status") ? entry.previous : entry.variant) };
      }
    }
    return base;
  }

  function soundFor(catalog, event, phase = "hit") {
    const move = lookup(catalog, event);
    const key = phase === "cast" ? "castSound" : "sound";
    if (!move || !own(move, key)) return undefined;
    if (phase !== "cast" && (move.damageClass === "status" || ["status", "heal"].includes(event?.type))) return "";
    const path = safePath(move[key]);
    return /^(?:\/?audio\/)\S+\.(?:wav|mp3|ogg)(?:\?[^#]*)?$/i.test(path) ? path : "";
  }

  function resolve(catalog, event) {
    const moveId = canonicalMoveId(catalog, event?.moveId, event?.moveName || event?.name);
    if (!moveId) return null;
    const move = lookup(catalog, event);
    if (!move || !own(catalog.families, move.art)) return null;
    const family = catalog.families[move.art];
    const sheet = safePath(family?.sheet);
    if (!sheet) return null;
    const columns = clamp(Math.floor(number(family.columns, 1)), 1, 32);
    const rows = clamp(Math.floor(number(family.rows, 1)), 1, 32);
    const frames = clamp(Math.floor(number(family.frames, 1)), 1, columns * rows);
    const fps = clamp(number(family.fps, 20), 1, 60);
    return {
      ...move,
      moveId,
      familyId: String(move.art),
      sheet,
      columns,
      rows,
      frames,
      fps,
      launchFrames: clamp(Math.floor(number(move.launchFrames, number(family.launchFrames, Math.ceil(frames / 2)))), 1, frames),
      impactStart: clamp(Math.floor(number(move.impactStart, number(family.impactStart, Math.max(0, Math.floor(frames / 2) - 1)))), 0, frames - 1),
      animation: MODES.has(move.animation) ? move.animation : (MODE_ALIASES[move.animation] || "impact"),
      sound: soundFor(catalog, event),
      castSound: soundFor(catalog, event, "cast"),
      width: clamp(number(move.width, number(family.width, 340)), 32, 1200),
      scale: clamp(number(move.scale, 1), 0.2, 3),
      durationMs: clamp(number(move.durationMs, frames > 1 ? frames / fps * 1000 : 520), 80, 5000),
      anchor: Array.isArray(family.anchor) ? [clamp(number(family.anchor[0], .5), 0, 1), clamp(number(family.anchor[1], .5), 0, 1)] : [.5, .5],
    };
  }

  function create(options = {}) {
    const stage = options.stage;
    const layer = options.layer || stage;
    const document = options.document || stage?.ownerDocument || root.document;
    const catalog = () => options.catalog || root.BoardMoveFxCatalog || {};
    const raf = options.raf || ((callback) => root.requestAnimationFrame(callback));
    const cancelRaf = options.cancelRaf || ((handle) => root.cancelAnimationFrame(handle));
    const now = options.now || (() => root.performance.now());
    const makeImage = options.createImage || (() => new root.Image());
    const cache = new Map();
    const active = [];
    const cacheLimit = clamp(Math.floor(number(options.cacheLimit, 24)), 2, 64);
    const attackScale = clamp(number(options.attackScale, 1), .5, 2);
    const attackImpactHoldMs = clamp(number(options.attackImpactHoldMs, 0), 0, 500);
    let canvas = null;
    let context = null;
    let frameHandle = null;
    let destroyed = false;
    let logicalWidth = 0;
    let logicalHeight = 0;
    let dpr = 1;

    function trimCache(protectedRecord = null) {
      for (const [key, record] of cache) {
        if (cache.size <= cacheLimit) break;
        if (record === protectedRecord || (!record.ready && !record.failed) || active.some((entry) => entry.record === record)) continue;
        cache.delete(key);
        if (record.image) {
          record.image.onload = null;
          record.image.onerror = null;
          record.image.src = "";
        }
      }
    }

    function touch(sheet, record) { cache.delete(sheet); cache.set(sheet, record); return record; }

    function imageFor(profile) {
      let record = cache.get(profile.sheet);
      if (record) return touch(profile.sheet, record);
      record = { image: null, ready: false, failed: false, promise: null };
      cache.set(profile.sheet, record);
      record.promise = new Promise((done) => {
        try {
          const image = makeImage();
          record.image = image;
          image.onload = () => {
            record.ready = number(image.naturalWidth || image.width, 0) >= profile.columns
              && number(image.naturalHeight || image.height, 0) >= profile.rows;
            record.failed = !record.ready;
            trimCache(record);
            done(record.ready);
          };
          image.onerror = () => { record.failed = true; trimCache(record); done(false); };
          image.decoding = "async";
          image.src = profile.sheet;
          if (image.complete && image.naturalWidth > 0) image.onload();
        } catch (_error) {
          record.failed = true;
          done(false);
        }
      });
      return record;
    }

    function ensureCanvas() {
      if (destroyed || !stage || !document) return false;
      if (context) return true;
      canvas = document.createElement("canvas");
      canvas.className = "board-move-fx-canvas";
      canvas.setAttribute("aria-hidden", "true");
      // CSS only places the canvas. No CSS shape, gradient, glow or particle is
      // used to draw these move effects.
      Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "140" });
      context = canvas.getContext("2d", { alpha: true });
      if (!context) { canvas = null; return false; }
      layer.appendChild(canvas);
      return true;
    }

    function resize() {
      const rect = stage.getBoundingClientRect();
      logicalWidth = Math.max(1, number(stage.clientWidth, rect.width) || rect.width);
      logicalHeight = Math.max(1, number(stage.clientHeight, rect.height) || rect.height);
      dpr = clamp(number(root.devicePixelRatio, 1), 1, 2);
      const width = Math.max(1, Math.round(logicalWidth * dpr));
      const height = Math.max(1, Math.round(logicalHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      return rect;
    }

    function anchor(side, element, stageRect) {
      let resolved = element;
      if (!resolved && typeof options.resolveAnchor === "function") resolved = options.resolveAnchor(side);
      if (resolved?.getBoundingClientRect) {
        const rect = resolved.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && stageRect.width > 0 && stageRect.height > 0) {
          return {
            x: (rect.left - stageRect.left + rect.width * .5) * logicalWidth / stageRect.width,
            y: (rect.top - stageRect.top + rect.height * .38) * logicalHeight / stageRect.height,
          };
        }
      }
      return { x: logicalWidth * (side === "player" ? .26 : .74), y: logicalHeight * (side === "player" ? .42 : .38) };
    }

    function draw(entry, elapsed, stageRect) {
      const profile = entry.profile;
      const progress = clamp(elapsed / entry.duration, 0, 1);
      const target = anchor(entry.targetSide, entry.anchorElement, stageRect);
      const source = anchor(entry.actorSide, entry.actorElement, stageRect);
      const launching = entry.phase === "launch";
      const travel = launching ? 1 - Math.pow(1 - progress, 2) : 1;
      const x = source.x + (target.x - source.x) * travel;
      const y = source.y + (target.y - source.y) * travel;
      const image = entry.record.image;
      const tileWidth = (image.naturalWidth || image.width) / profile.columns;
      const tileHeight = (image.naturalHeight || image.height) / profile.rows;
      const frame = entry.frameStart + Math.min(entry.frameCount - 1, Math.floor(progress * entry.frameCount));
      const width = Math.min(profile.width, logicalWidth * .48) * profile.scale * entry.presentationScale;
      const height = width * tileHeight / tileWidth;
      const fadeIn = launching ? clamp(progress / .08, 0, 1) : 1;
      const fadeOut = clamp((1 - progress) / (launching ? .14 : .26), 0, 1);
      const pulse = profile.animation === "none" ? 1 : profile.animation === "aura"
        ? .9 + .14 * Math.sin(progress * Math.PI)
        : launching ? .78 + progress * .22 : 1;
      const flip = profile.flip !== false && entry.actorSide === "enemy" ? -1 : 1;
      const angle = profile.animation === "sweep" ? (entry.actorSide === "enemy" ? -1 : 1) * (-.18 + progress * .3) : 0;
      context.save();
      context.globalAlpha = fadeIn * fadeOut;
      context.translate(x, y);
      context.rotate(angle);
      context.scale(flip * pulse, pulse);
      context.drawImage(image, (frame % profile.columns) * tileWidth, Math.floor(frame / profile.columns) * tileHeight,
        tileWidth, tileHeight, -width * profile.anchor[0], -height * profile.anchor[1], width, height);
      context.restore();
    }

    function paint(timestamp) {
      frameHandle = null;
      if (destroyed || !context) return;
      const stageRect = resize();
      context.clearRect(0, 0, logicalWidth, logicalHeight);
      for (let index = active.length - 1; index >= 0; index -= 1) {
        if (timestamp - active[index].start >= active[index].duration) active.splice(index, 1);
      }
      active.forEach((entry) => draw(entry, Math.max(0, timestamp - entry.start), stageRect));
      trimCache();
      if (active.length) frameHandle = raf(paint);
    }

    function play(event, playOptions = {}) {
      if (destroyed || event?.miss || event?.specialFx === "lucci-rokuogan") return false;
      const profile = resolve(catalog(), event);
      if (!profile) return false;
      const phase = playOptions.phase === "launch" ? "launch" : "impact";
      if (phase === "launch" && !["projectile", "sweep"].includes(profile.animation)) return false;
      const record = imageFor(profile);
      // Loading is never allowed to delay a hit, or replay it late. Call warm at
      // prepare/dice time. A failed or cold asset lets the caller use its fallback.
      if (!record.ready || !ensureCanvas()) return false;
      const actorSide = playOptions.actorSide || event.side || "player";
      const targetSide = playOptions.targetSide || event.targetSide || (actorSide === "player" ? "enemy" : "player");
      const fullSequence = profile.animation === "aura";
      const frameStart = phase === "launch" || fullSequence ? 0 : clamp(Math.floor(number(playOptions.frameStart, profile.impactStart)), 0, profile.frames - 1);
      const frameCount = phase === "launch" ? profile.launchFrames : profile.frames - frameStart;
      const requestedDuration = number(playOptions.durationMs, phase === "launch" ? 340 : profile.durationMs);
      // The battle's contact/pose window owns playback timing. Re-applying the
      // sheet FPS to its remaining 4-5 impact frames compressed a requested
      // 700 ms hit to 200-250 ms, making the artwork flash past unreadably.
      const attack = event.type === "attack" || (!["heal", "status"].includes(event.type) && profile.damageClass !== "status");
      // Enlarge only attack artwork and hold its impact frames a little longer.
      // Launch/contact, HP, portrait poses and authoritative KO timing stay owned by the caller.
      const impactHoldMs = clamp(number(playOptions.impactHoldMs, attackImpactHoldMs), 0, 500);
      const duration = clamp(requestedDuration + (attack && phase === "impact" ? impactHoldMs : 0), 80, 5000);
      active.push({ profile, record, phase, actorSide, targetSide, duration, presentationScale: attack ? attackScale : 1, frameStart, frameCount, start: now(), anchorElement: playOptions.anchorElement, actorElement: playOptions.actorElement });
      if (active.length > 24) active.shift();
      trimCache(record);
      if (frameHandle === null) frameHandle = raf(paint);
      return true;
    }

    function clear() {
      active.length = 0;
      if (frameHandle !== null) cancelRaf(frameHandle);
      frameHandle = null;
      trimCache();
      if (context && canvas) {
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    return {
      resolve: (event) => resolve(catalog(), event),
      ready(event) {
        const profile = resolve(catalog(), event);
        const record = profile && cache.get(profile.sheet);
        if (record) touch(profile.sheet, record);
        return !destroyed && !!record?.ready && ensureCanvas();
      },
      warm(moveIds) {
        const ids = Array.isArray(moveIds) ? moveIds : [moveIds];
        return Promise.all(ids.map((entry) => {
          const profile = resolve(catalog(), typeof entry === "string" ? { moveId: entry } : entry);
          return profile && !destroyed ? imageFor(profile).promise : Promise.resolve(false);
        }));
      },
      play,
      clear,
      destroy() { clear(); destroyed = true; canvas?.remove(); canvas = null; context = null; cache.clear(); },
      status: () => ({ active: active.length, cached: cache.size, ready: [...cache.values()].filter((entry) => entry.ready).length, failed: [...cache.values()].filter((entry) => entry.failed).length, destroyed }),
    };
  }

  return { version: 1, create, resolve, lookup, soundFor, canonicalMoveId };
});
