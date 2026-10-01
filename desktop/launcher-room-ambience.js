(() => {
  'use strict';

  // The six 1600 x 900 ship paintings have real transparent sea/porthole cutouts.
  // Moving water and weather are drawn beneath the ship, never across furniture,
  // crew or the aquarium's own indoor water.
  const SCENES = new Set(['crew-cabin', 'sunny-deck', 'sunny-kitchen',
    'sunny-library', 'sunny-workshop', 'sunny-aquarium']);
  const SEASON_NAMES = Object.freeze({ spring: '春', summer: '夏', autumn: '秋', winter: '冬' });
  const DAYPART_NAMES = Object.freeze({ dawn: '清晨', day: '白天', dusk: '黃昏', night: '夜晚' });
  const WEATHER_NAMES = Object.freeze({ clear: '晴朗', cloudy: '多雲', rain: '下雨', snow: '飄雪', storm: '雷雨' });
  let stage = null;
  let root = null;
  let seaLayer = null;
  let badge = null;
  let canvas = null;
  let context = null;
  let observer = null;
  let inView = false;
  let animationId = 0;
  let lastFrame = -Infinity;
  let particles = [];
  let particleKey = '';
  let currentState = null;
  let sceneKey = 'crew-cabin';
  let qaOverride = null;
  const oceanArt = new Map();

  function seasonAt(date) {
    const month = date.getMonth() + 1;
    return month <= 2 || month === 12 ? 'winter' : month <= 5 ? 'spring' : month <= 8 ? 'summer' : 'autumn';
  }
  function daypartAt(date) {
    const hour = date.getHours() + date.getMinutes() / 60;
    return hour < 5 || hour >= 20 ? 'night' : hour < 7 ? 'dawn' : hour < 17 ? 'day' : 'dusk';
  }
  function hashDay(date, key) {
    const stamp = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${key}`;
    let hash = 2166136261;
    for (const letter of stamp) hash = Math.imul(hash ^ letter.charCodeAt(0), 16777619);
    return hash >>> 0;
  }
  function weatherAt(date, season) {
    // Every room looks out onto the same Thousand Sunny weather on a given day.
    const roll = hashDay(date, 'thousand-sunny') % 100;
    if (season === 'winter') return roll < 24 ? 'snow' : roll < 46 ? 'rain' : roll < 54 ? 'storm' : roll < 74 ? 'cloudy' : 'clear';
    if (season === 'spring') return roll < 30 ? 'rain' : roll < 37 ? 'storm' : roll < 63 ? 'cloudy' : 'clear';
    if (season === 'summer') return roll < 20 ? 'rain' : roll < 34 ? 'storm' : roll < 51 ? 'cloudy' : 'clear';
    return roll < 34 ? 'rain' : roll < 44 ? 'storm' : roll < 72 ? 'cloudy' : 'clear';
  }
  function compute(date, key) {
    const safe = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
    const scene = SCENES.has(key) ? key : 'crew-cabin';
    const season = seasonAt(safe);
    return Object.freeze({ scene, season, daypart: daypartAt(safe), weather: weatherAt(safe, season) });
  }
  function element(className) {
    const node = document.createElement('div');
    node.className = className;
    node.setAttribute('aria-hidden', 'true');
    return node;
  }
  function seaColors(state) {
    let base = {
      dawn: ['#d68768', '#437c94', '#155779', '#ffd8a3'],
      day: ['#4ac5e1', '#159fc3', '#086d9c', '#defcff'],
      dusk: ['#b85e68', '#425f91', '#162c63', '#ffd199'],
      night: ['#142e5c', '#0d386b', '#091e46', '#c2dfff']
    }[state.daypart];
    if (state.daypart !== 'day') return base;
    if (state.weather === 'storm') return ['#3b5570', '#1d4e6c', '#0c2b4c', '#c1d9e9'];
    if (state.weather === 'rain') return ['#67889b', '#3a7290', '#1b4d72', '#d2e5ef'];
    if (state.weather === 'snow') return ['#b9d6e7', '#78acc8', '#3e719c', '#fff9e9'];
    if (state.weather === 'cloudy') return ['#91b7c9', '#4d95af', '#21658f', '#e4f4f6'];
    if (state.daypart === 'day') {
      base = {
        spring: ['#72d7dd', '#24acb5', '#127b89', '#f2ffff'],
        summer: base,
        autumn: ['#78c5d3', '#268cae', '#145b87', '#ffe4b1'],
        winter: ['#a7d4e7', '#5a9fbd', '#28688f', '#f2faff']
      }[state.season];
    }
    return base;
  }
  function oceanTexture(state) {
    const key = state.weather === 'storm' || state.weather === 'rain' ? 'storm' : state.daypart;
    if (!oceanArt.has(key)) {
      const image = new Image();
      const qaRoot = window.__ONE_PIECE_ROOM_QA__ === true &&
        typeof window.__ROOM_OCEAN_QA_ROOT__ === 'string' ? window.__ROOM_OCEAN_QA_ROOT__ : null;
      image.src = (qaRoot || 'opui://launcher/images/launcher_room/sea/') + 'ocean-' + key + '.webp';
      image.onload = () => { if (currentState) drawFrame(); };
      oceanArt.set(key, image);
    }
    const image = oceanArt.get(key);
    return image.complete && image.naturalWidth ? image : null;
  }
  function drawSea(ctx, width, height, state, time) {
    const [upper, middle, lower, sparkle] = seaColors(state);
    const water = ctx.createLinearGradient(0, 0, 0, height);
    water.addColorStop(0, upper);
    water.addColorStop(.42, middle);
    water.addColorStop(1, lower);
    ctx.fillStyle = water;
    ctx.fillRect(0, 0, width, height);
    const seconds = time / 1000;
    const texture = oceanTexture(state);
    if (texture) {
      const marginX = width * .035, marginY = height * .035;
      const wind = state.weather === 'storm' ? 1.4 : .65;
      const driftX = Math.sin(seconds * .18 * wind) * marginX * .55;
      const driftY = Math.cos(seconds * .12 * wind) * marginY * .48;
      ctx.save();
      const weatherFilter = state.weather === 'snow' ? 'saturate(.7) brightness(.87)' :
        state.weather === 'cloudy' ? 'saturate(.82) brightness(.9)' :
        state.season === 'winter' ? 'saturate(.82)' : '';
      const timeFilter = state.daypart === 'night' ? 'brightness(.48) saturate(.78)' :
        state.daypart === 'dusk' ? 'brightness(.74) sepia(.1)' :
        state.daypart === 'dawn' ? 'brightness(.81) sepia(.08)' : '';
      ctx.filter = [weatherFilter, timeFilter].filter(Boolean).join(' ');
      ctx.drawImage(texture, -marginX + driftX, -marginY + driftY,
        width + marginX * 2, height + marginY * 2);
      // A second softly shifted sample moves the small glints at another rate.
      ctx.globalAlpha = state.daypart === 'night' ? .035 : .045;
      ctx.globalCompositeOperation = 'screen';
      ctx.drawImage(texture, -marginX - driftX * .47, -marginY + driftY * .3,
        width + marginX * 2, height + marginY * 2);
      ctx.restore();
      return;
    }
    // Palette remains useful during the first frame before local texture loads.
    ctx.strokeStyle = sparkle;
    ctx.globalAlpha = .15;
    for (let row = 0; row < 12; row++) {
      const y = height * (.06 + row * .082);
      ctx.beginPath();
      for (let x = 0; x <= width; x += 12) {
        const yy = y + Math.sin(x * .022 + seconds * .38 + row) * 2.8;
        if (!x) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (state.daypart === 'dusk' || state.daypart === 'dawn' || state.daypart === 'night') {
      const glow = ctx.createRadialGradient(width * .51, height * .08, 2, width * .51, height * .08, width * .5);
      glow.addColorStop(0, state.daypart === 'night' ? '#e0eaff33' : '#ffd9ab77');
      glow.addColorStop(1, '#ffffff00');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
    }
  }
  function refreshParticles(date, weather) {
    const key = `${hashDay(date, sceneKey)}:${weather}`;
    if (particleKey === key) return;
    particleKey = key;
    let seed = hashDay(date, sceneKey) || 1;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; };
    const count = weather === 'storm' ? 350 : weather === 'rain' ? 230 : weather === 'snow' ? 185 : 0;
    particles = Array.from({ length: count }, () => ({
      x: random(), y: random(), speed: random(), drift: random(), size: random(), alpha: random()
    }));
  }
  function drawWeather(ctx, width, height, date, weather, time) {
    if (weather !== 'rain' && weather !== 'storm' && weather !== 'snow') return;
    refreshParticles(date, weather);
    const seconds = time / 1000;
    if (weather === 'snow') {
      for (const flake of particles) {
        const x = ((flake.x * width + seconds * (6 + flake.drift * 16)) % (width + 30)) - 15;
        const y = ((flake.y * height + seconds * (14 + flake.speed * 28)) % (height + 20)) - 10;
        ctx.beginPath();
        ctx.arc(x, y, .7 + flake.size * 1.45, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(246,251,255,${(.34 + flake.alpha * .57).toFixed(3)})`;
        ctx.fill();
      }
      return;
    }
    const storm = weather === 'storm';
    for (const drop of particles) {
      const x = ((drop.x * width - seconds * (18 + drop.drift * 18)) % (width + 28) + width + 28) % (width + 28) - 14;
      const y = ((drop.y * height + seconds * (190 + drop.speed * (storm ? 210 : 140))) % (height + 32)) - 16;
      const length = (storm ? 8 : 5) + drop.size * (storm ? 10 : 7);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - length * .2, y + length);
      ctx.strokeStyle = `rgba(221,242,255,${(.12 + drop.alpha * (storm ? .37 : .27)).toFixed(3)})`;
      ctx.lineWidth = .65 + drop.size * .55;
      ctx.stroke();
    }
  }
  function drawFrame(time = performance.now()) {
    if (!canvas || !stage || !currentState) return;
    const bounds = stage.getBoundingClientRect();
    const width = Math.round(bounds.width), height = Math.round(bounds.height);
    if (!width || !height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const pixelWidth = Math.round(width * dpr), pixelHeight = Math.round(height * dpr);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth; canvas.height = pixelHeight;
    }
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    drawSea(context, width, height, currentState, time);
    drawWeather(context, width, height, qaOverride?.date || new Date(), currentState.weather, time);
    canvas.dataset.drawn = 'true';
    canvas.dataset.oceanReady = oceanTexture(currentState) ? 'true' : 'false';
  }
  function animate(time) {
    animationId = 0;
    if (!inView || document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        !currentState) return;
    if (time - lastFrame >= 42) { drawFrame(time); lastFrame = time; }
    animationId = window.requestAnimationFrame(animate);
  }
  function manageAnimation() {
    if (animationId) { window.cancelAnimationFrame(animationId); animationId = 0; }
    if (inView && !document.hidden && !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
        currentState) {
      animationId = window.requestAnimationFrame(animate);
    }
  }
  function ensureLayer() {
    if (!stage) return;
    if (root?.parentNode !== stage) {
      seaLayer?.remove();
      badge?.remove();
      root = element('room-ambience');
      seaLayer = element('room-ambience-sea');
      canvas = document.createElement('canvas');
      canvas.className = 'room-ambience-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      context = canvas.getContext('2d', { alpha: false });
      seaLayer.append(canvas, element('room-ambience-lightning'));
      const scene = stage.querySelector('#roomScene');
      scene?.before(seaLayer);
      scene?.after(root);
      const aquariumWindow = element('room-aquarium-scene-window');
      aquariumWindow.dataset.aquariumTank = 'scene';
      root.append(element('room-ambience-light'), element('room-ambience-lamps'), aquariumWindow);
      badge = document.createElement('span');
      badge.className = 'room-ambience-badge';
      badge.title = '航路天氣演出依本機日期與時間變化';
      // On narrow screens the 480px room canvas scrolls inside a smaller
      // viewport. Anchor the label to the visible shell beside scene arrows.
      (stage.closest('.room-stage-shell') || stage).append(badge);
      observer?.disconnect();
      if (window.IntersectionObserver) {
        observer = new IntersectionObserver(entries => { inView = !!entries[0]?.isIntersecting; manageAnimation(); }, { threshold: .01 });
        observer.observe(stage);
      } else inView = true;
    }
  }
  function update() {
    if (!stage) return null;
    const date = qaOverride?.date || new Date();
    const state = compute(date, sceneKey);
    const weather = qaOverride?.weather || state.weather;
    stage.dataset.roomSeason = state.season;
    stage.dataset.roomDaypart = state.daypart;
    stage.dataset.roomWeather = weather;
    stage.dataset.roomScene = state.scene;
    if (badge) badge.textContent = `${SEASON_NAMES[state.season]} · ${DAYPART_NAMES[state.daypart]} · ${WEATHER_NAMES[weather]}`;
    currentState = Object.freeze({ ...state, weather });
    drawFrame(); manageAnimation();
    return currentState;
  }
  function setScene({ stage: nextStage, sceneKey: nextKey, sceneId } = {}) {
    if (!(nextStage instanceof HTMLElement)) return null;
    const key = String(nextKey || sceneId || '').replace(/^room-scene-/, '');
    const canonical = SCENES.has(key) ? key : 'crew-cabin';
    const changed = stage !== nextStage || sceneKey !== canonical;
    stage = nextStage;
    sceneKey = canonical;
    ensureLayer();
    if (changed) particleKey = '';
    return update();
  }
  function setQaOverride(override) {
    if (window.__ONE_PIECE_ROOM_QA__ !== true) return false;
    if (override == null) { qaOverride = null; update(); return true; }
    const date = override.date instanceof Date ? override.date : new Date(override.date);
    if (Number.isNaN(date.getTime())) return false;
    const weather = override.weather == null ? null : String(override.weather);
    if (weather && !Object.hasOwn(WEATHER_NAMES, weather)) return false;
    qaOverride = { date, weather };
    update();
    return true;
  }
  window.OnePieceRoomAmbience = Object.freeze({ compute, setScene, setQaOverride });
  window.setInterval(() => { if (!document.hidden) update(); }, 60_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) update(); });
})();
