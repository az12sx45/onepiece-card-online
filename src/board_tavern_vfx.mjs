import { Application, Container, Graphics, Particle, ParticleContainer, Sprite, Texture, WebGLRenderer } from "pixi.js";
import { AdvancedBloomFilter, RGBSplitFilter, ShockwaveFilter } from "pixi-filters";
import { gsap } from "gsap";

const GRADES = Object.freeze({
  E: { color: 0xcbd8df, floor: 0xb6cad6, particles: [0xffffff, 0xbad5e1] },
  D: { color: 0x76dba0, floor: 0x5ecb91, particles: [0xe2ffe8, 0x70dda0] },
  C: { color: 0x70c6fa, floor: 0x4ca8ed, particles: [0xe8faff, 0x67c6ff] },
  B: { color: 0xb48aff, floor: 0x9564ec, particles: [0xf6eaff, 0xbd8dff] },
  A: { color: 0xffcf70, floor: 0xf7b94c, particles: [0xfff5d5, 0xffd479] },
  S: { color: 0xffcf70, floor: 0xf7b94c, particles: [0xffffff, 0xffc4e5, 0x9ee8ff, 0xffdc88] },
});
const PRISM = [0xff759c, 0xffbd72, 0xffeb9b, 0x8cf6c6, 0x7edaff, 0xc6a4ff];
const PARTICLE_LIMIT = { low: 45, medium: 85, high: 140 };
const PARTICLE_KINDS = ["dot", "spark", "longSpark", "star", "shard"];
const live = new Set();
const tickers = new Set();

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function blendColor(from, to, amount) {
  const t = clamp(amount, 0, 1);
  const channel = shift => Math.round(((from >> shift) & 255) * (1 - t) + ((to >> shift) & 255) * t);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

function chooseQuality(value) {
  if (Object.hasOwn(PARTICLE_LIMIT, value)) return value;
  const memory = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  return memory <= 2 || cores <= 2 ? "low" : memory >= 8 && cores >= 8 ? "high" : "medium";
}

function makeTexture(width, height, paint) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext("2d"), width, height);
  return Texture.from(canvas);
}

function radialTexture() {
  return makeTexture(128, 128, (ctx, width) => {
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.17, "rgba(255,255,255,.82)");
    gradient.addColorStop(0.48, "rgba(255,255,255,.19)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, width);
  });
}

function seamTexture() {
  return makeTexture(64, 256, (ctx, width, height) => {
    const image = ctx.createImageData(width, height);
    for (let y = 0; y < height; y++) {
      const vertical = Math.pow(Math.sin(Math.PI * y / (height - 1)), 0.55);
      for (let x = 0; x < width; x++) {
        const distance = (x - 31.5) / 32;
        const horizontal = Math.exp(-distance * distance * 8);
        const index = (y * width + x) * 4;
        image.data[index] = 255;
        image.data[index + 1] = 255;
        image.data[index + 2] = 255;
        image.data[index + 3] = Math.round(255 * vertical * horizontal);
      }
    }
    ctx.putImageData(image, 0, 0);
  });
}

function particleTextures() {
  const draw = {
    dot(ctx) {
      const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
      gradient.addColorStop(0, "#fff");
      gradient.addColorStop(0.17, "#fffffff2");
      gradient.addColorStop(1, "#ffffff00");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
    },
    spark(ctx) {
      ctx.strokeStyle = "#fff";
      ctx.lineCap = "round";
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(14, 32); ctx.lineTo(50, 32); ctx.moveTo(32, 13); ctx.lineTo(32, 51); ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(32, 32, 7, 0, Math.PI * 2); ctx.fill();
    },
    longSpark(ctx) {
      const gradient = ctx.createLinearGradient(32, 5, 32, 59);
      gradient.addColorStop(0, "#ffffff00");
      gradient.addColorStop(0.5, "#fff");
      gradient.addColorStop(1, "#ffffff00");
      ctx.fillStyle = gradient;
      ctx.beginPath(); ctx.moveTo(32, 4); ctx.lineTo(36, 32); ctx.lineTo(32, 60); ctx.lineTo(28, 32); ctx.closePath(); ctx.fill();
    },
    star(ctx) {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      for (let index = 0; index < 8; index++) {
        const angle = -Math.PI / 2 + index * Math.PI / 4;
        const radius = index % 2 ? 9 : 29;
        const x = 32 + Math.cos(angle) * radius;
        const y = 32 + Math.sin(angle) * radius;
        if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.fill();
    },
    shard(ctx) {
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.moveTo(32, 3); ctx.lineTo(49, 35); ctx.lineTo(31, 60); ctx.lineTo(21, 31); ctx.closePath(); ctx.fill();
    },
  };
  return Object.fromEntries(PARTICLE_KINDS.map(kind => [kind, makeTexture(64, 64, draw[kind])]));
}

function additiveSprite(texture, color = 0xffffff) {
  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5);
  sprite.tint = color;
  sprite.blendMode = "add";
  return sprite;
}

function create(options = {}) {
  const container = options.container;
  if (!(container instanceof HTMLElement)) throw new TypeError("Tavern VFX requires a container element");
  const grade = Object.hasOwn(GRADES, options.grade) ? options.grade : "E";
  let quality = chooseQuality(options.quality);
  const requestedIntensity = Number(options.intensity);
  const intensity = Number.isFinite(requestedIntensity) ? clamp(requestedIntensity, 0, 1.5) : 1;
  const enabledFilters = {
    bloom: options.filters?.bloom !== false,
    shockwave: options.filters?.shockwave !== false,
    rgbSplit: options.filters?.rgbSplit !== false,
  };
  let timeScale = clamp(Number(options.timeScale) || 1, 0.25, 2);
  const palette = GRADES[grade];
  const overlay = container.closest(".tavern-reveal-overlay");
  const state = { power: 0, aperture: 0.008, floor: 0, ambient: 0, rainbow: 0, prelude: 0, collapse: 0, flash: 0, impact: 0, motes: 0 };
  let app;
  let canvas;
  let observer;
  let ready = false;
  let failed = false;
  let disposed = false;
  let pendingStage = "invitation";
  let currentStage = "invitation";
  let timeline;
  let timelineTime = 0;
  let timelineStartedAt = 0;
  let particleTime = 0;
  let particleCursor = 0;
  let particleCount = 0;
  let burstTriggered = false;
  let rngState = (crypto.getRandomValues(new Uint32Array(1))[0] || 1) >>> 0;
  let geometry;
  let textures;
  let layers;
  let particles;
  let shockwave;
  let split;
  let impactFiltersOn = false;
  let impactAge = 0;

  function random() {
    rngState ^= rngState << 13;
    rngState ^= rngState >>> 17;
    rngState ^= rngState << 5;
    return (rngState >>> 0) / 4294967296;
  }

  function clearMarkers() {
    delete container.dataset.vfxReady;
    if (overlay) delete overlay.dataset.vfxReady;
  }

  function stats() {
    return { grade, stage: currentStage, quality, intensity, timeScale, particleCount,
      filters: { ...enabledFilters }, ready, failed, disposed };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    timeline?.kill();
    timeline = null;
    observer?.disconnect();
    observer = null;
    clearMarkers();
    canvas?.removeEventListener("webglcontextlost", onContextLost);
    if (app) {
      app.ticker?.stop();
      if (tickers.delete(controller)) app.ticker?.remove(tick);
      try { app.destroy(true, { children: true, texture: true, textureSource: true, context: true }); } catch (_) {}
      app = null;
    }
    canvas?.remove();
    canvas = null;
    particleCount = 0;
    live.delete(controller);
  }

  function onContextLost(event) {
    event.preventDefault();
    dispose();
  }

  function setTimeScale(value) {
    const next = clamp(Number(value) || 1, 0.25, 2);
    timelineStartedAt = performance.now() - timelineTime * 1000 / next;
    timeScale = next;
  }

  function stage(name) {
    if (disposed || failed || !["invitation", "crack", "glow", "silhouette", "reveal", "choice"].includes(name)) return;
    pendingStage = name;
    currentStage = name;
    if (ready) animateStage(name);
  }

  const controller = { stage, dispose, stats, setTimeScale };
  live.add(controller);

  function makeLayers() {
    textures = { halo: radialTexture(), seam: seamTexture(), particles: particleTextures() };
    const floor = new Container();
    const gate = new Container();
    const core = new Container();
    const moteContainers = PARTICLE_KINDS.map(kind => new ParticleContainer({
      texture: textures.particles[kind],
      dynamicProperties: { position: true, rotation: true, vertex: true, uvs: false, color: true },
    }));
    const impact = new Container();
    app.stage.addChild(floor, gate, core, ...moteContainers, impact);

    const wideFloor = new Graphics();
    const narrowFloor = new Graphics();
    const floorBloom = additiveSprite(textures.halo, palette.floor);
    floor.addChild(wideFloor, narrowFloor, floorBloom);

    const portalFill = new Graphics();
    const aura = additiveSprite(textures.halo, palette.color);
    const innerLeft = additiveSprite(textures.seam, palette.color);
    const innerRight = additiveSprite(textures.seam, palette.color);
    const shafts = Array.from({ length: quality === "low" ? 5 : 9 }, (_, index) => {
      const sprite = additiveSprite(textures.seam, palette.color);
      sprite.alpha = 0;
      gate.addChild(sprite);
      return sprite;
    });
    const prism = PRISM.map(color => {
      const sprite = additiveSprite(textures.halo, color);
      sprite.alpha = 0;
      gate.addChild(sprite);
      return sprite;
    });
    gate.addChild(portalFill, aura, innerLeft, innerRight, ...prism);

    const halo = additiveSprite(textures.halo);
    const seam = additiveSprite(textures.seam);
    const whiteFlash = additiveSprite(textures.halo);
    core.addChild(halo, seam, whiteFlash);
    if (enabledFilters.bloom) core.filters = [new AdvancedBloomFilter({ threshold: 0.1, bloomScale: quality === "high" ? 1.65 : quality === "medium" ? 1.25 : 0.65, brightness: 1.08, blur: quality === "high" ? 5 : quality === "medium" ? 4 : 2, quality: quality === "high" ? 5 : quality === "medium" ? 3 : 1 })];
    const impactRing = new Graphics();
    impact.addChild(impactRing);
    shockwave = new ShockwaveFilter({ center: { x: 0.5, y: 0.72 }, speed: 750, amplitude: 13, wavelength: 72, brightness: 1.05, radius: -1 });
    split = new RGBSplitFilter({ red: { x: -2, y: 0 }, green: { x: 0, y: 0 }, blue: { x: 2, y: 0 } });

    particles = Array.from({ length: PARTICLE_LIMIT[quality] }, (_, index) => {
      const kind = PARTICLE_KINDS[index % PARTICLE_KINDS.length];
      const visual = new Particle({ texture: textures.particles[kind], anchorX: 0.5, anchorY: 0.5, alpha: 0 });
      moteContainers[index % PARTICLE_KINDS.length].addParticle(visual);
      return { kind, visual, age: 0, life: 0, vx: 0, vy: 0, gravity: 0, spin: 0, size: 0, alpha: 0 };
    });
    layers = { floor, gate, core, wideFloor, narrowFloor, floorBloom, portalFill, aura, innerLeft, innerRight, shafts, prism, halo, seam, whiteFlash, impactRing };
    resize();
    render();
  }

  function resize() {
    if (!app || !layers) return;
    const width = Math.max(1, container.clientWidth || 960);
    const height = Math.max(1, container.clientHeight || 640);
    app.renderer.resize(width, height);
    const portalWidth = width * 0.311;
    const portalHeight = height * 0.637;
    geometry = { width, height, center: width * 0.5, portalTop: height * 0.09, portalBottom: height * 0.727, portalWidth, portalHeight };
    const { center, portalBottom } = geometry;
    layers.wideFloor.clear()
      .poly([center - portalWidth * 0.1, portalBottom, center + portalWidth * 0.1, portalBottom, center + width * 0.4, height, center - width * 0.4, height]).fill({ color: 0xffffff, alpha: 0.18 })
      .poly([center - portalWidth * 0.08, portalBottom, center + portalWidth * 0.08, portalBottom, center + width * 0.31, height, center - width * 0.31, height]).fill({ color: 0xffffff, alpha: 0.24 });
    layers.narrowFloor.clear().poly([center - portalWidth * 0.035, portalBottom, center + portalWidth * 0.035, portalBottom, center + width * 0.16, height, center - width * 0.16, height]).fill({ color: 0xffffff, alpha: 0.3 });
    layers.floorBloom.position.set(center, portalBottom + (height - portalBottom) * 0.55);
    layers.floorBloom.width = width * 1.05;
    layers.floorBloom.height = height * 0.42;
    layers.portalFill.clear().rect(-portalWidth * 0.48, geometry.portalTop, portalWidth * 0.96, portalHeight).fill({ color: 0xffffff });
    layers.portalFill.position.x = center;
    layers.aura.position.set(center, geometry.portalTop + portalHeight * 0.54);
    layers.aura.width = portalWidth * 1.25;
    layers.aura.height = portalHeight * 1.48;
    layers.halo.position.set(center, geometry.portalTop + portalHeight * 0.54);
    layers.halo.width = portalWidth * 0.52;
    layers.halo.height = portalHeight * 1.12;
    layers.seam.position.set(center, geometry.portalTop + portalHeight * 0.51);
    layers.seam.height = portalHeight * 1.08;
    layers.whiteFlash.position.set(center, geometry.portalTop + portalHeight * 0.62);
    layers.whiteFlash.width = portalWidth * 1.15;
    layers.whiteFlash.height = portalHeight * 1.22;
    layers.prism.forEach((sprite, index) => {
      const side = index < 3 ? -1 : 1;
      sprite.position.set(center, geometry.portalTop + portalHeight * (0.27 + (index % 3) * 0.22));
      sprite.width = portalWidth * 0.15;
      sprite.height = portalHeight * 0.56;
      sprite.rotation = side * (0.04 + (index % 3) * 0.07);
    });
    render();
  }

  function animateStage(name) {
    timeline?.kill();
    timelineTime = 0;
    timelineStartedAt = performance.now();
    if (name === "glow") burstTriggered = false;
    timeline = gsap.timeline({ paused: true, defaults: { ease: "power2.out" } });
    if (name === "invitation") {
      timeline.to(state, { power: 0, aperture: 0.008, floor: 0, ambient: 0, rainbow: 0, prelude: 0, collapse: 0, flash: 0, impact: 0, motes: 0, duration: 0.18 });
    } else if (name === "crack" && grade === "S") {
      timeline.to(state, { power: 0.3, aperture: 0.025, floor: 0.1, ambient: 0.15, prelude: 0, motes: 0.12, duration: 0.16 })
        .to(state, { power: 0.48, aperture: 0.035, floor: 0.17, ambient: 0.22, prelude: 1, motes: 0.22, duration: 0.34 })
        .to(state, { power: 0.58, aperture: 0.039, floor: 0.2, ambient: 0.27, prelude: 2, motes: 0.3, duration: 0.34 })
        .to(state, { power: 0.72, aperture: 0.052, floor: 0.3, ambient: 0.34, prelude: 3, motes: 0.42, duration: 0.38 });
    } else if (name === "crack") {
      timeline.to(state, { power: 0.52, aperture: 0.042, floor: 0.22, ambient: 0.21, motes: 0.38, duration: 0.52 })
        .to(state, { power: 0.67, floor: 0.27, duration: 0.72, ease: "sine.inOut" });
    } else if (name === "glow" && grade === "S") {
      timeline.to(state, { power: 0.84, aperture: 0.09, floor: 0.46, ambient: 0.48, motes: 0.58, duration: 0.35 })
        .to(state, { power: 0.035, aperture: 0.02, floor: 0.02, ambient: 0.02, collapse: 1, motes: 0, duration: 0.34, ease: "power3.in" })
        .to(state, { power: 0.035, flash: 0, duration: 0.14 })
        .to(state, { power: 1.22, aperture: 0.19, floor: 1, ambient: 0.9, rainbow: 1, collapse: 0, flash: 1, impact: 1, motes: 1.55, duration: 0.12, ease: "power4.out" })
        .to(state, { flash: 0, impact: 0, power: 0.94, floor: 0.78, ambient: 0.7, motes: 1.05, duration: 0.36, ease: "power2.out" })
        .to(state, { power: 0.78, floor: 0.64, ambient: 0.58, motes: 0.8, duration: 0.63, ease: "sine.out" });
    } else if (name === "glow") {
      timeline.to(state, { power: 0.91, aperture: 0.16, floor: 0.68, ambient: 0.66, motes: 0.86, duration: 0.78, ease: "power2.inOut" });
    } else if (name === "silhouette") {
      timeline.to(state, { power: 0.83, aperture: 0.75, floor: grade === "S" ? 0.78 : 0.68, ambient: 0.65, motes: grade === "S" ? 1.06 : 0.86, impact: 0, flash: 0, duration: 0.82 });
    } else if (name === "reveal") {
      timeline.to(state, { power: 0.36, aperture: 0.84, floor: 0.4, ambient: 0.31, motes: 0.48, impact: 0, flash: 0, duration: 0.9 });
    } else if (name === "choice") {
      timeline.to(state, { power: 0.13, aperture: 0.9, floor: 0.16, ambient: 0.16, motes: 0.15, impact: 0, flash: 0, duration: 0.65 });
    }
    render();
  }

  function render() {
    if (!layers || !geometry) return;
    const { width, height, center, portalTop, portalBottom, portalWidth, portalHeight } = geometry;
    const gain = intensity;
    const aperture = clamp(state.aperture, 0, 1);
    const gapWidth = portalWidth * aperture;
    const rainbow = grade === "S" ? state.rainbow : 0;
    const sPrelude = grade === "S" ? state.prelude : 0;
    const preludeStops = [0xffffff, 0x9edaff, 0xbc9bff, 0xffcf70];
    const preludeIndex = Math.min(2, Math.floor(sPrelude));
    const sColor = blendColor(preludeStops[preludeIndex], preludeStops[preludeIndex + 1], sPrelude - preludeIndex);
    const tint = grade === "S" ? blendColor(sColor, 0xeef5ff, rainbow) : palette.color;
    const floorGain = grade === "S" && rainbow > 0.5 ? 0.34 : 1;
    layers.wideFloor.alpha = clamp(state.floor * 0.17 * gain * floorGain, 0, 0.28);
    layers.wideFloor.tint = tint;
    layers.narrowFloor.alpha = clamp(state.floor * 0.18 * gain * floorGain, 0, 0.36);
    layers.floorBloom.alpha = clamp(state.floor * 0.48 * gain * floorGain, 0, 0.8);
    layers.floorBloom.tint = tint;
    layers.portalFill.alpha = clamp(state.power * 0.18 * gain, 0, 0.3);
    layers.portalFill.tint = tint;
    layers.portalFill.scale.x = Math.max(0.03, aperture);
    layers.aura.tint = tint;
    layers.aura.alpha = clamp(state.ambient * 0.52 * gain, 0, 0.65);
    layers.innerLeft.tint = tint;
    layers.innerRight.tint = tint;
    layers.innerLeft.position.set(center - gapWidth * 0.51, portalTop + portalHeight * 0.5);
    layers.innerRight.position.set(center + gapWidth * 0.51, portalTop + portalHeight * 0.5);
    layers.innerLeft.width = layers.innerRight.width = Math.max(4, portalWidth * 0.09);
    layers.innerLeft.height = layers.innerRight.height = portalHeight * 1.01;
    layers.innerLeft.alpha = layers.innerRight.alpha = clamp(state.power * 0.52 * gain, 0, 0.78);
    layers.halo.width = portalWidth * (0.07 + aperture * 0.46);
    layers.halo.tint = blendColor(0xffffff, tint, grade === "S" && rainbow > 0.5 ? 0.18 : 0.62);
    layers.halo.alpha = clamp(state.power * 0.4 * gain, 0, 0.58);
    layers.seam.width = Math.max(4, portalWidth * (0.012 + aperture * 0.23));
    layers.seam.alpha = clamp(state.power * 1.08 * gain, 0, 1);
    layers.whiteFlash.alpha = clamp(state.flash * 0.34 * gain, 0, 0.42);
    layers.prism.forEach((sprite, index) => {
      const side = index < 3 ? -1 : 1;
      sprite.position.x = center + side * gapWidth * (0.15 + (index % 3) * 0.13);
      sprite.alpha = clamp(rainbow * state.ambient * 0.68 * gain, 0, 0.66);
    });
    layers.shafts.forEach((sprite, index) => {
      const side = index % 2 ? 1 : -1;
      const offset = Math.ceil(index / 2);
      sprite.position.set(center + side * (gapWidth * 0.5 + offset * portalWidth * 0.05), portalBottom - portalHeight * (0.13 + (index % 3) * 0.17));
      sprite.width = Math.max(7, portalWidth * (0.018 + state.ambient * 0.028));
      sprite.height = portalHeight * (0.38 + (index % 4) * 0.11);
      sprite.rotation = side * (0.08 + offset * 0.08);
      sprite.tint = grade === "S" && rainbow > 0.5 ? PRISM[index % PRISM.length] : palette.color;
      sprite.alpha = clamp(state.ambient * (0.06 + (index % 3) * 0.025) * gain, 0, 0.17);
    });
    if (grade === "S" && state.impact > 0.02) {
      const radius = (1 - state.impact) * width * 0.54 + portalWidth * 0.07;
      layers.impactRing.clear().ellipse(center, portalBottom, radius, radius * 0.25).stroke({ color: 0xf1f5ff, width: Math.max(1, height * 0.003 * state.impact), alpha: state.impact * 0.2 });
      if (!impactFiltersOn && quality !== "low") {
        const gateBounds = layers.gate.getBounds();
        shockwave.center = { x: center - gateBounds.x, y: portalBottom - gateBounds.y };
        const activeFilters = [enabledFilters.shockwave && shockwave, enabledFilters.rgbSplit && split].filter(Boolean);
        if (activeFilters.length) {
          layers.gate.filters = activeFilters;
          impactFiltersOn = true;
        }
      }
      shockwave.time = impactAge;
      split.redX = -2.5 * state.impact;
      split.blueX = 2.5 * state.impact;
    } else {
      layers.impactRing.clear();
      if (impactFiltersOn) {
        layers.gate.filters = [];
        impactFiltersOn = false;
      }
      impactAge = 0;
    }
  }

  function spawnParticle(burst = false) {
    if (!particles || !geometry) return;
    const kind = burst ? ["spark", "longSpark", "star", "shard"][Math.floor(random() * 4)] : PARTICLE_KINDS[Math.floor(random() * PARTICLE_KINDS.length)];
    let entry;
    for (let attempt = 0; attempt < particles.length; attempt++) {
      const index = (particleCursor + attempt) % particles.length;
      if (particles[index].kind === kind && particles[index].age >= particles[index].life) {
        entry = particles[index];
        particleCursor = (index + 1) % particles.length;
        break;
      }
    }
    if (!entry) return;
    const { center, portalBottom, portalWidth, portalHeight } = geometry;
    const spread = portalWidth * (0.05 + state.aperture * 0.7);
    entry.age = 0;
    entry.life = (entry.kind === "shard" ? 0.58 : 0.9) + random() * 1.05;
    entry.vx = (random() - 0.5) * (entry.kind === "dot" ? 30 : burst ? 510 : 115);
    entry.vy = -(entry.kind === "dot" ? 15 : 44) - random() * (burst ? 270 : 95);
    entry.gravity = entry.kind === "shard" ? 190 : entry.kind === "star" ? 35 : 0;
    entry.spin = (random() - 0.5) * (entry.kind === "shard" ? 12 : 4);
    entry.size = (entry.kind === "dot" ? 3 : entry.kind === "longSpark" ? 15 : 8) + random() * (grade === "S" ? 10 : 5);
    entry.alpha = 0.17 + random() * 0.48;
    entry.visual.x = center + (random() - 0.5) * spread;
    entry.visual.y = portalBottom - random() * portalHeight * 0.88;
    entry.visual.scaleX = entry.size / 64;
    entry.visual.scaleY = entry.kind === "longSpark" ? entry.size / 37 : entry.size / 64;
    const colors = grade === "S" && state.rainbow < 0.5 ? GRADES.A.particles : palette.particles;
    entry.visual.tint = colors[Math.floor(random() * colors.length)];
    entry.visual.alpha = 0;
    particleCount++;
  }

  function updateParticles(delta) {
    if (!particles) return;
    if (intensity === 0) return;
    particleTime += delta * (8 + 38 * state.motes) * (quality === "low" ? 0.55 : quality === "high" ? 1.35 : 1);
    while (particleTime >= 1 && particleCount < particles.length) {
      spawnParticle();
      particleTime--;
    }
    if (particleTime > 2) particleTime = 2;
    for (const entry of particles) {
      if (entry.age >= entry.life) continue;
      entry.age += delta;
      if (entry.age >= entry.life) {
        entry.visual.alpha = 0;
        particleCount--;
        continue;
      }
      const progress = entry.age / entry.life;
      entry.vy += entry.gravity * delta;
      entry.visual.x += entry.vx * delta;
      entry.visual.y += entry.vy * delta;
      if (state.collapse > 0) {
        const pull = Math.min(1, delta * state.collapse * 4.8);
        entry.visual.x += (geometry.center - entry.visual.x) * pull;
        entry.visual.y += (geometry.portalTop + geometry.portalHeight * 0.55 - entry.visual.y) * pull;
      }
      entry.visual.alpha = entry.alpha * Math.sin(Math.PI * progress) * clamp(state.power + 0.15, 0, 1) * intensity;
      entry.visual.rotation += delta * entry.spin;
    }
  }

  function tick(ticker) {
    if (disposed || !ready) return;
    const delta = clamp(ticker.deltaMS / 1000, 0, 0.05) * timeScale;
    if (timeline && timelineTime < timeline.duration()) {
      timelineTime = Math.min(timeline.duration(), (performance.now() - timelineStartedAt) / 1000 * timeScale);
      timeline.time(timelineTime, false);
    }
    if (state.impact > 0.02) impactAge += delta;
    const burstNow = grade === "S" && currentStage === "glow" && timelineTime >= 0.83 && !burstTriggered;
    if (burstNow) {
      burstTriggered = true;
      impactAge = 0;
      for (let index = 0; index < Math.floor(PARTICLE_LIMIT[quality] * 0.36); index++) spawnParticle(true);
    }
    updateParticles(delta);
    const impact = state.impact;
    const flash = state.flash;
    if (burstNow) {
      state.impact = Math.max(impact, 0.68);
      state.flash = Math.max(flash, 0.26);
    }
    render();
    state.impact = impact;
    state.flash = flash;
  }

  async function init() {
    try {
      const probe = document.createElement("canvas");
      const gl = probe.getContext("webgl2", { alpha: true, antialias: false });
      if (!gl) throw new Error("WebGL2 unavailable");
      if (!Object.hasOwn(PARTICLE_LIMIT, options.quality)) {
        const rendererInfo = gl.getExtension("WEBGL_debug_renderer_info");
        const rendererName = gl.getParameter(rendererInfo?.UNMASKED_RENDERER_WEBGL || gl.RENDERER);
        if (window.innerWidth <= 600 || container.clientWidth > window.innerWidth * 1.5 ||
            /SwiftShader|llvmpipe|software|softpipe|Microsoft Basic/i.test(rendererName)) quality = "low";
      }
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      app = new Application();
      await app.init({
        preference: "webgl",
        width: Math.max(1, container.clientWidth || 960),
        height: Math.max(1, container.clientHeight || 640),
        backgroundAlpha: 0,
        antialias: false,
        resolution: Math.min(window.devicePixelRatio || 1, quality === "low" ? 1 : 1.5),
        autoDensity: true,
        autoStart: false,
        sharedTicker: false,
      });
      if (disposed) { app.destroy(true, true); app = null; return; }
      if (!(app.renderer instanceof WebGLRenderer)) throw new Error("WebGL renderer unavailable");
      canvas = app.canvas;
      canvas.addEventListener("webglcontextlost", onContextLost);
      canvas.dataset.tavernVfx = "";
      canvas.className = "tavern-reveal-vfx-canvas";
      Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", display: "block", pointerEvents: "none" });
      container.append(canvas);
      makeLayers();
      observer = new ResizeObserver(resize);
      observer.observe(container);
      ready = true;
      container.dataset.vfxReady = "1";
      if (overlay) overlay.dataset.vfxReady = "1";
      animateStage(pendingStage);
      if (pendingStage !== "invitation") {
        timelineTime = Math.min(0.12, timeline.duration());
        timelineStartedAt = performance.now() - timelineTime * 1000 / timeScale;
        timeline.time(timelineTime, false);
        render();
      }
      app.ticker.add(tick);
      app.ticker.start();
      tickers.add(controller);
    } catch (_) {
      if (disposed) return;
      failed = true;
      clearMarkers();
      try { app?.destroy(true, true); } catch (_) {}
      app = null;
      canvas?.remove();
      canvas = null;
      particleCount = 0;
    }
  }

  void init();
  return controller;
}

function diagnostics() {
  return {
    liveControllerCount: live.size,
    liveTickerCount: tickers.size,
    particleCount: [...live].reduce((sum, controller) => sum + controller.stats().particleCount, 0),
  };
}

window.BoardTavernVfx = Object.freeze({ version: "1", create, diagnostics, grades: Object.keys(GRADES) });
