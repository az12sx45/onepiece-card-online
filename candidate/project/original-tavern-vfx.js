'use strict';
// Generated source math/controller; native scene adapter owns rendering.
const {gsap}=require('./vendor/gsap');
// Every timeline is paused and advanced by Godot's frame clock. Disable the
// library's redundant background ticker, not the original time()/ease math.
gsap.ticker.sleep();gsap.ticker.wake=()=>{};
const {Container,Graphics,Particle,ParticleContainer,Sprite,AdvancedBloomFilter,RGBSplitFilter,ShockwaveFilter,snapshot}=require('./native-tavern-vfx-model');
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
function additiveSprite(texture, color = 0xffffff) {
  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5);
  sprite.tint = color;
  sprite.blendMode = "add";
  return sprite;
}
const readVfxVector=function readVfxVector(state,layers,particles){
 const values=Object.keys(state).filter(key=>key!=='_gsap').sort().map(key=>state[key]);
 const visual=node=>values.push(node.x,node.y,node.scale.x,node.scale.y,node.rotation,node.alpha,node.tint);
 for(const node of Object.values(layers)){if(Array.isArray(node))node.forEach(visual);else visual(node);}
 for(const node of [layers.gate,layers.core]){const box=node.getBounds();values.push(box.x,box.y,box.width,box.height);}
 for(const entry of particles)values.push(entry.age,entry.life,entry.vx,entry.vy,entry.gravity,entry.spin,entry.size,entry.alpha,entry.visual.x,entry.visual.y,entry.visual.scaleX,entry.visual.scaleY,entry.visual.rotation,entry.visual.alpha,entry.visual.tint);
 return values.map(value=>{if(!Number.isFinite(value))throw Error('Non-numeric original VFX property');return Math.round(value*1e6)/1e6;});
};
exports.create=function(host,options={}){
 const performance={now:host.now};const container=host.container,overlay=host.overlay;
 const grade=Object.hasOwn(GRADES,options.grade)?options.grade:'E';const quality=options.quality||'medium';
 if(!Object.hasOwn(PARTICLE_LIMIT,quality))throw Error('Unknown native VFX quality');
 const intensity=Number.isFinite(Number(options.intensity))?clamp(Number(options.intensity),0,1.5):1;
 const enabledFilters={bloom:options.filters?.bloom!==false,shockwave:options.filters?.shockwave!==false,rgbSplit:options.filters?.rgbSplit!==false};
 let timeScale=clamp(Number(options.timeScale)||1,.25,2);const palette=GRADES[grade];
 const state={power:0,aperture:.008,floor:0,ambient:0,rainbow:0,prelude:0,collapse:0,flash:0,impact:0,motes:0};
 let app={stage:new Container(),renderer:{resize(){}},ticker:{stop(){},remove(){}},destroy(){this.stage.children=[];}};
 let canvas=null,observer=null,ready=false,failed=false,disposed=false,pendingStage='invitation',currentStage='invitation',timeline,timelineTime=0,timelineStartedAt=0,particleTime=0,particleCursor=0,particleCount=0,burstTriggered=false;
 let rngState=(host.entropy()||1)>>>0;let geometry,textures,layers,particles,shockwave,split,impactFiltersOn=false,impactAge=0;
 const radialTexture=()=>({key:'halo',width:128,height:128}),seamTexture=()=>({key:'seam',width:64,height:256});
 const particleTextures=()=>Object.fromEntries(PARTICLE_KINDS.map(key=>[key,{key,width:64,height:64}]));
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
 const controller={stage,dispose,stats,setTimeScale};live.add(controller);makeLayers();ready=true;container.dataset.vfxReady='1';if(overlay)overlay.dataset.vfxReady='1';animateStage(pendingStage);gsap.ticker.sleep();
 return {stage(name){stage(name);gsap.ticker.sleep();},dispose(){dispose();gsap.ticker.sleep();},stats,setTimeScale,
  resize(width,height){container.clientWidth=width;container.clientHeight=height;resize();},
  tick(deltaMS){tick({deltaMS});gsap.ticker.sleep();},
  testVector:()=>readVfxVector(state,layers,particles),
  frame(){return {nodes:snapshot(app.stage,[layers.core.id,layers.gate.id]),state:Object.fromEntries(Object.entries(state).filter(([key])=>key!=='_gsap')),stats:stats(),geometry:{...geometry}};}};
};
