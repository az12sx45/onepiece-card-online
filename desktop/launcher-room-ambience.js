(() => {
  'use strict';

  // The original room paintings are 1600 x 900. The ship polygon below and
  // these portholes keep rain and snow in the visible sea, off the room floor
  // and the aquarium's indoor fish tank.
  const porthole = (cx, cy, diameter = 2.7) => ({
    left: cx - diameter / 2, top: cy - diameter * 16 / 9 / 2,
    width: diameter, height: diameter * 16 / 9
  });
  const PORTHOLES = Object.freeze({
    'crew-cabin': [porthole(33.65, 35.35), porthole(50.2, 37.6, 2.45), porthole(66.35, 35.35)],
    'sunny-deck': [porthole(33.7, 34.5), porthole(50.1, 38.1, 2.5), porthole(66.4, 34.5)],
    'sunny-kitchen': [porthole(33.7, 35.45), porthole(50.1, 40.1, 2.4), porthole(66.4, 35.45)],
    'sunny-library': [porthole(33.8, 32.2), porthole(50.1, 36.2, 2.4), porthole(66.4, 32.2)],
    'sunny-workshop': [porthole(36.6, 35.3), porthole(50.15, 39.15, 2.5)],
    'sunny-aquarium': [porthole(50.1, 35.4, 2.5)]
  });
  const SCENES = new Set(Object.keys(PORTHOLES));
  // Polygon of the solid ship, in coordinates of the 1600 x 900 scene art.
  // The canvas clips one continuous outside-sea mask around it. This avoids
  // rectangular joins where independently tinted panels would meet.
  const SHIP = Object.freeze({
    'crew-cabin': [[262, 215], [1338, 215], [1367, 354], [1584, 743], [1600, 900], [0, 900], [16, 743], [233, 354]],
    'sunny-deck': [[263, 192], [1337, 192], [1370, 316], [1588, 738], [1600, 900], [0, 900], [12, 738], [230, 316]],
    'sunny-kitchen': [[274, 222], [1327, 222], [1373, 343], [1588, 746], [1600, 900], [0, 900], [12, 746], [227, 343]],
    'sunny-library': [[240, 202], [1360, 202], [1384, 330], [1585, 742], [1600, 900], [0, 900], [15, 742], [216, 330]],
    'sunny-workshop': [[260, 177], [1344, 177], [1372, 326], [1587, 740], [1600, 900], [0, 900], [13, 740], [228, 326]],
    'sunny-aquarium': [[204, 0], [1396, 0], [1381, 313], [1588, 743], [1600, 900], [0, 900], [12, 743], [219, 313]]
  });
  const SEASON_NAMES = Object.freeze({ spring: '春', summer: '夏', autumn: '秋', winter: '冬' });
  const DAYPART_NAMES = Object.freeze({ dawn: '清晨', day: '白天', dusk: '黃昏', night: '夜晚' });
  const WEATHER_NAMES = Object.freeze({ clear: '晴朗', cloudy: '多雲', rain: '下雨', snow: '飄雪', storm: '雷雨' });
  let stage = null;
  let root = null;
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
  function weatherAt(date, key, season) {
    const roll = hashDay(date, key) % 100;
    if (season === 'winter') return roll < 24 ? 'snow' : roll < 46 ? 'rain' : roll < 54 ? 'storm' : roll < 74 ? 'cloudy' : 'clear';
    if (season === 'spring') return roll < 30 ? 'rain' : roll < 37 ? 'storm' : roll < 63 ? 'cloudy' : 'clear';
    if (season === 'summer') return roll < 20 ? 'rain' : roll < 34 ? 'storm' : roll < 51 ? 'cloudy' : 'clear';
    return roll < 34 ? 'rain' : roll < 44 ? 'storm' : roll < 72 ? 'cloudy' : 'clear';
  }
  function compute(date, key) {
    const safe = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
    const scene = SCENES.has(key) ? key : 'crew-cabin';
    const season = seasonAt(safe);
    return Object.freeze({ scene, season, daypart: daypartAt(safe), weather: weatherAt(safe, scene, season) });
  }
  function element(className) {
    const node = document.createElement('div');
    node.className = className;
    node.setAttribute('aria-hidden', 'true');
    return node;
  }
  function makeSeaPath(width, height) {
    const path = new Path2D();
    path.rect(0, 0, width, height);
    const points = SHIP[sceneKey];
    path.moveTo(points[0][0] / 1600 * width, points[0][1] / 900 * height);
    for (const [x, y] of points.slice(1)) path.lineTo(x / 1600 * width, y / 900 * height);
    path.closePath();
    for (const hole of PORTHOLES[sceneKey]) {
      const x = (hole.left + hole.width / 2) / 100 * width;
      const y = (hole.top + hole.height / 2) / 100 * height;
      path.moveTo(x + hole.width / 200 * width, y);
      path.ellipse(x, y, hole.width / 200 * width, hole.height / 200 * height, 0, 0, Math.PI * 2);
    }
    return path;
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
  function tintAndWeather(ctx, width, height, date, state, time) {
    const season = { spring: '#55b99617', summer: '#21b7e00e', autumn: '#b8865d22', winter: '#b8deff38' };
    const daypart = { dawn: '#e5a26755', day: '#00000000', dusk: '#ad6b676d', night: '#081f4caa' };
    const weather = { clear: '#00000000', cloudy: '#526e8c25', rain: '#344b7254', snow: '#b6d6e943', storm: '#172b4e87' };
    for (const tint of [season[state.season], daypart[state.daypart], weather[state.weather]]) {
      ctx.fillStyle = tint; ctx.fillRect(0, 0, width, height);
    }
    if (state.weather === 'clear' && state.daypart === 'night') {
      const reflected = ctx.createLinearGradient(width * .42, 0, width * .65, height * .35);
      reflected.addColorStop(0, '#d9efff00'); reflected.addColorStop(.5, '#d9efff30'); reflected.addColorStop(1, '#d9efff00');
      ctx.fillStyle = reflected; ctx.fillRect(0, 0, width, height * .38);
    }
    drawWeather(ctx, width, height, date, state.weather, time);
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
    context.save();
    context.clip(makeSeaPath(width, height), 'evenodd');
    tintAndWeather(context, width, height, qaOverride?.date || new Date(), currentState, time);
    context.restore();
    canvas.dataset.drawn = 'true';
  }
  function animate(time) {
    animationId = 0;
    if (!inView || document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        !currentState || !['rain', 'snow', 'storm'].includes(currentState.weather)) return;
    if (time - lastFrame >= 32) { drawFrame(time); lastFrame = time; }
    animationId = window.requestAnimationFrame(animate);
  }
  function manageAnimation() {
    if (animationId) { window.cancelAnimationFrame(animationId); animationId = 0; }
    if (inView && !document.hidden && !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
        currentState && ['rain', 'snow', 'storm'].includes(currentState.weather)) {
      animationId = window.requestAnimationFrame(animate);
    }
  }
  function ensureLayer() {
    if (!stage) return;
    if (root?.parentNode !== stage) {
      root = element('room-ambience');
      canvas = document.createElement('canvas');
      canvas.className = 'room-ambience-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      context = canvas.getContext('2d', { alpha: true });
      root.append(element('room-ambience-light'), canvas, element('room-ambience-lamps'), element('room-ambience-lightning'));
      stage.querySelector('#roomScene')?.after(root);
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
