'use strict';
// Exact source controller; bounded data controls are rendered by Godot.
exports.install=function(window,document,scheduler){
const location=window.location,performance=scheduler.performance;
const {setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame,cancelAnimationFrame}=scheduler;
/* Phone-only Judicial reveal. The source Board settles RNG/coins/EXP/bonus
 * before this module runs. No game state, reward id, storage or command writes. */
(() => {
  'use strict';
  const enabled = () => document.documentElement?.dataset.platform === 'android';
  const labels = { heal:'急救', pp:'彈藥', attack:'總攻', defense:'鐵壁', speed:'突擊', shield:'屏障', revive:'救援', burst:'霸氣' };
  const iconKeys = new Set([...Object.keys(labels), 'unknown']);
  const fallback = Object.keys(labels).map(id => ({ id, label:labels[id], iconKey:id }));
  let waiting = null, presentation = null;
  const owned = fn => window.TabletopBoardPhoneLayout?.withOwnedDOM ? window.TabletopBoardPhoneLayout.withOwnedDOM(fn) : fn();
  const icon = entry => {
    const img = document.createElement('img'), key = iconKeys.has(entry?.iconKey || entry?.id) ? entry.iconKey || entry.id : 'unknown';
    img.src = `images/board/judicial_raid_ui/reward_icons/${key}.webp`;
    img.alt = entry?.label || labels[key] || '突破補給'; img.draggable = false;
    return img;
  };
  const sameSource = (session, source) => {
    try { return !!source && session.options.sourceWindow() === source && source.location.origin === location.origin; }
    catch (_) { return false; }
  };
  function live(session) {
    try { return session.options.isCurrent() && session.options.canControl(); } catch (_) { return false; }
  }
  function releaseWait(result) {
    const active = waiting;
    if (!active) return;
    waiting = null; clearInterval(active.watchdog); clearTimeout(active.attachTimeout);
    try { active.options.sourceWindow()?.TabletopJudicialReward?.dismiss(active.eventId); } catch (_) {}
    active.resolve(result);
  }
  function wait(event, options) {
    if (!enabled() || event?.type !== 'raid-phase-reward' || !event.id || !options.canControl()) return null;
    releaseWait(true);
    return new Promise(resolve => {
      const active = waiting = { eventId:String(event.id), options, resolve, attached:false };
      // A missing/failed phone child must still fall back to the PC wait.
      active.attachTimeout = setTimeout(() => { if (waiting === active && !active.attached) releaseWait(false); }, 5000);
      // This exists only while an interactive reveal owns a pending source wait.
      // It never refreshes DOM or game data; it releases stale/closed viewers.
      active.watchdog = setInterval(() => {
        let source;
        try { source = options.sourceWindow(); } catch (_) {}
        if (!live(active) || !source || source.closed || document.hidden) releaseWait(true);
        else if (active.attached) {
          try {
            if (!source.TabletopJudicialReward?.isPresent(active.eventId)) releaseWait(true);
          } catch (_) { releaseWait(true); }
        }
      }, 750);
    });
  }
  function connect(eventId, source) {
    const active = waiting;
    if (!active || active.eventId !== eventId || !sameSource(active, source) || !live(active)) return false;
    active.attached = true; clearTimeout(active.attachTimeout); return true;
  }
  function complete(eventId, source) {
    const active = waiting;
    if (!active || active.eventId !== eventId || !active.attached || !sameSource(active, source) || !live(active)) return false;
    releaseWait(true); return true;
  }
  function host() {
    try {
      if (window.parent !== window && window.parent.TabletopJudicialReward) return window.parent.TabletopJudicialReward;
      if (window.opener && !window.opener.closed && window.opener.TabletopJudicialReward) return window.opener.TabletopJudicialReward;
    } catch (_) {}
    return null;
  }
  function closePresentation() {
    const active = presentation;
    if (!active) return;
    presentation = null;
    cancelAnimationFrame(active.frame); active.timers.forEach(clearTimeout);
    owned(() => {
      active.root.classList.remove('show', 'settled');
      active.root.removeAttribute('data-phone-reward');
      active.root.removeAttribute('data-phone-reward-phase');
      active.root.removeAttribute('aria-modal');
      active.root.removeAttribute('role'); active.root.removeAttribute('aria-label');
    });
  }
  function present(event, options) {
    if (!enabled() || event?.type !== 'raid-phase-reward' || !event.id) return false;
    const root = document.getElementById('raidPhaseFx'), authority = host();
    // The same-origin Board wait is required for indefinite manual interaction.
    if (!root || !authority) return false;
    if (presentation?.eventId === String(event.id)) return true;
    closePresentation();
    const bonus = event.bonus || event.reward?.bonus || {};
    const segments = (bonus.segments || event.segments || fallback).filter(entry => entry && typeof entry.id === 'string');
    if (!segments.length) return false;
    let target = segments.findIndex(entry => entry.id === bonus.id);
    if (target < 0) target = Math.max(0, Math.min(segments.length - 1, Number(bonus.index) || 0));
    const chosen = bonus.id ? bonus : segments[target];
    const wheel = document.getElementById('raidRewardWheel'), shell = wheel?.closest('.raid-wheel-shell');
    if (!wheel || !shell) return false;
    const label = document.getElementById('raidRewardLabel'), description = document.getElementById('raidRewardDescription');
    const rewardIcon = document.getElementById('raidRewardIcon'), scene = document.getElementById('raidRewardScene');
    const text = root.querySelector('.raid-reward-text');
    const active = presentation = { root, wheel, eventId:String(event.id), options, authority, phase:'idle', frame:0, timers:[], position:0,
      velocity:0, direction:-1, pointer:null, attached:false, spectator:!options.canControl(), target, segments, chosen, row:72, finished:false };
    let panel = root.querySelector('.phone-raid-reel-panel'), hint = root.querySelector('.phone-raid-swipe-hint');
    let controls = root.querySelector('.phone-raid-controls'), skip, primary;
    owned(() => {
      root.dataset.phoneReward = 'manual'; root.dataset.phoneRewardPhase = 'idle'; root.classList.add('show'); root.classList.remove('settled');
      root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', '司法島突破補給');
      document.getElementById('raidClearText').textContent = event.finalVictory ? '司法島全數突破' : '突破成功';
      document.getElementById('raidDefeatedName').textContent = `${event.defeatedName || '敵人'} 擊破`;
      document.getElementById('raidNextEnemyName').textContent = event.finalVictory ? '通關獎勵結算後回到海圖' : event.nextEnemyName ? `下一戰：${event.nextEnemyName}` : '準備下一戰';
      if (!panel) { panel = document.createElement('div'); panel.className = 'phone-raid-reel-panel'; shell.before(panel); panel.append(shell); }
      if (!hint) { hint = document.createElement('div'); hint.className = 'phone-raid-swipe-hint'; panel.append(hint); }
      let copy = root.querySelector('.phone-raid-copy');
      if (!copy) { copy = document.createElement('div'); copy.className = 'phone-raid-copy'; text.append(copy); copy.append(description, scene); }
      text.prepend(rewardIcon);
      if (!controls) {
        controls = document.createElement('div'); controls.className = 'phone-raid-controls';
        controls.innerHTML = '<button type="button" data-phone-reward-skip>略過動畫</button><button type="button" data-phone-reward-primary>轉動補給</button>';
        root.append(controls);
      }
      skip = controls.querySelector('[data-phone-reward-skip]'); primary = controls.querySelector('[data-phone-reward-primary]');
      skip.disabled = false; primary.disabled = false; primary.textContent = '轉動補給';
      primary.setAttribute('data-phone-art-button', 'primary'); skip.setAttribute('data-phone-art-button', 'secondary');
      hint.innerHTML = '<span aria-hidden="true">↕</span> 上下滑動轉輪';
      label.textContent = '滑動揭曉補給'; description.textContent = '拖動轉輪，放開後會依滑動方向慢慢停下。';
      rewardIcon.replaceChildren(icon({id:'unknown',label:'尚未揭曉'})); scene.replaceChildren();
      const fragment = document.createDocumentFragment();
      for (let cycle = 0; cycle < 3; cycle++) for (const entry of segments) {
        const row = document.createElement('div'); row.className = 'raid-slot-item'; row.dataset.rewardId = entry.id;
        const image = document.createElement('span'); image.className = 'raid-slot-icon'; image.append(icon(entry));
        const name = document.createElement('span'); name.className = 'raid-slot-label'; name.textContent = labels[entry.id] || entry.label || '補給';
        row.append(image, name); fragment.append(row);
      }
      wheel.replaceChildren(fragment); shell.tabIndex = 0; shell.setAttribute('role', 'button'); shell.setAttribute('aria-label', '上下滑動轉動補給輪盤，或按轉動補給');
      shell.setAttribute('aria-disabled', String(active.spectator));
    });
    const mod = (a, b) => ((a % b) + b) % b;
    function update() {
      if (presentation !== active) return;
      const period = active.row * segments.length;
      wheel.style.transform = `translateY(${(shell.clientHeight - active.row) / 2 - period + mod(active.position, period)}px)`;
    }
    function phase(value) { active.phase = value; root.dataset.phoneRewardPhase = value; }
    function reveal() {
      if (presentation !== active) return;
      cancelAnimationFrame(active.frame); active.frame = 0; active.pointer = null;
      active.position = -target * active.row; update(); phase('result');
      owned(() => {
        root.classList.add('settled'); label.textContent = chosen.label || '補給完成';
        description.textContent = chosen.appliedText ? `${chosen.description || '獲得突破補給。'}（${chosen.appliedText}）` : chosen.description || '獲得突破補給。';
        rewardIcon.replaceChildren(icon(chosen));
        const art = window.BoardAdventureArt?.resolve(chosen.visual);
        if (art) scene.innerHTML = window.BoardAdventureArt.artMarkup(chosen.visual);
        for (const row of wheel.children) row.classList.toggle('is-winning', row.dataset.rewardId === segments[target].id);
        hint.textContent = '突破補給已揭曉'; primary.textContent = '繼續'; primary.disabled = active.spectator; skip.disabled = true;
      });
    }
    function coast(velocity) {
      if (presentation !== active) return;
      cancelAnimationFrame(active.frame);
      const releaseVelocity = Math.max(-3.8, Math.min(3.8, velocity));
      if (Math.abs(releaseVelocity) > .04) active.direction = Math.sign(releaseVelocity);
      const period = active.row * segments.length, start = active.position;
      const remainder = mod(-target * active.row - start, period);
      let distance = active.direction > 0 ? remainder : mod(-remainder, period);
      const speed = Math.max(.35, Math.abs(releaseVelocity));
      distance += Math.max(0, Math.ceil((speed * 500 - distance) / period)) * period;
      const duration = Math.max(600, 2 * distance / speed);
      const slope = Math.min(2, Math.abs(releaseVelocity) * duration / Math.max(1, distance));
      const started = performance.now();
      phase('coasting'); primary.disabled = true; primary.textContent = '轉動中'; hint.textContent = '正在減速…';
      // One continuous curve lands on the already-settled source reward.
      // A quick release (slope=2) decelerates linearly from the exact release
      // speed to zero; there is no second landing phase that speeds up again.
      function frame(now) {
        if (presentation !== active || active.phase !== 'coasting') return;
        const p = Math.min(1, (now - started) / duration);
        const progress = (-2 * p ** 3 + 3 * p ** 2) + (p ** 3 - 2 * p ** 2 + p) * slope;
        active.position = start + active.direction * distance * progress;
        active.velocity = active.direction * distance / duration * ((-6 * p * p + 6 * p) + (3 * p * p - 4 * p + 1) * slope);
        update();
        if (p === 1) reveal(); else active.frame = requestAnimationFrame(frame);
      }
      active.velocity = releaseVelocity;
      active.frame = requestAnimationFrame(frame);
    }
    function usable() { return presentation === active && active.attached && !active.finished && !active.spectator && options.canControl(); }
    shell.onpointerdown = e => {
      if (!usable() || active.phase === 'result' || active.pointer !== null || e.button > 0) return;
      e.preventDefault(); e.stopPropagation(); cancelAnimationFrame(active.frame);
      active.pointer = e.pointerId; active.lastY = e.clientY; active.startY = e.clientY; active.lastTime = performance.now(); active.velocity = 0; active.moved = false;
      phase('dragging'); shell.setPointerCapture(e.pointerId); hint.textContent = '放開後慢慢停下';
    };
    shell.onpointermove = e => {
      if (active.pointer !== e.pointerId || active.phase !== 'dragging') return;
      if (!usable()) { active.pointer = null; return; }
      e.preventDefault(); e.stopPropagation();
      const now = performance.now(), dy = e.clientY - active.lastY, dt = Math.max(1, now - active.lastTime);
      active.position += dy; active.lastY = e.clientY; active.lastTime = now;
      if (Math.abs(e.clientY - active.startY) >= 6) active.moved = true;
      if (Math.abs(dy) > .1) { active.direction = Math.sign(dy); active.velocity = active.velocity * .3 + dy / dt * .7; }
      update();
    };
    function release(e) {
      if (active.pointer !== e.pointerId) return;
      e.preventDefault(); e.stopPropagation(); active.pointer = null;
      if (shell.hasPointerCapture(e.pointerId)) shell.releasePointerCapture(e.pointerId);
      if (!active.moved) { phase('idle'); primary.disabled = false; primary.textContent = '轉動補給'; hint.innerHTML = '<span aria-hidden="true">↕</span> 上下滑動轉輪'; return; }
      const idle = performance.now() - active.lastTime;
      coast(e.type === 'pointercancel' || idle > 100 ? 0 : active.velocity);
    }
    shell.onpointerup = release; shell.onpointercancel = release;
    shell.onlostpointercapture = e => { if (active.pointer === e.pointerId) { active.pointer = null; coast(0); } };
    shell.onkeydown = e => { if (!usable() || active.phase === 'result') return; if (['ArrowDown','ArrowUp',' ','Enter'].includes(e.key)) { e.preventDefault(); coast(e.key === 'ArrowDown' ? 2 : -2); } };
    skip.onclick = () => { if (usable()) reveal(); };
    primary.onclick = () => {
      if (!usable()) return;
      if (active.phase !== 'result') { coast(-2.1); return; }
      if (authority.complete(active.eventId, window)) { active.finished = true; closePresentation(); }
    };
    update();
    if (active.spectator) {
      hint.textContent = '觀看補給揭曉'; primary.disabled = skip.disabled = true;
      coast(-2.1); active.timers.push(setTimeout(closePresentation, Math.max(11000, Number(event.duration) || 11000)));
    } else {
      primary.disabled = skip.disabled = true;
      const attach = () => {
        if (presentation !== active || active.attached) return;
        if (authority.connect(active.eventId, window)) { active.attached = true; primary.disabled = skip.disabled = false; }
      };
      attach(); for (const delay of [0,100,500,1500,3500]) active.timers.push(setTimeout(attach, delay));
      active.timers.push(setTimeout(() => {
        if (presentation !== active || active.attached) return;
        active.spectator = true; hint.textContent = '觀看補給揭曉'; coast(-2.1);
        active.timers.push(setTimeout(closePresentation, 6000));
      }, 4500));
    }
    return true;
  }
  function abort() {
    const root = document.getElementById('raidPhaseFx');
    closePresentation(); releaseWait(false);
    if (!root) return;
    owned(() => {
      const panel = root.querySelector('.phone-raid-reel-panel'), shell = root.querySelector('.raid-wheel-shell');
      if (panel && shell) { panel.before(shell); panel.remove(); }
      const copy = root.querySelector('.phone-raid-copy');
      if (copy) { copy.before(...copy.childNodes); copy.remove(); }
      if (shell) {
        const center = document.getElementById('raidRewardIcon'); if (center) shell.append(center);
        shell.removeAttribute('tabindex'); shell.removeAttribute('role'); shell.removeAttribute('aria-label'); shell.removeAttribute('aria-disabled');
        for (const name of ['onpointerdown','onpointermove','onpointerup','onpointercancel','onlostpointercapture','onkeydown']) shell[name] = null;
      }
      root.querySelector('.phone-raid-controls')?.remove();
    });
  }
  function abandon() {
    const active = presentation;
    if (active?.attached) active.authority.complete(active.eventId, window);
    closePresentation(); releaseWait(true);
  }
  window.addEventListener('pagehide', abandon);
  document.addEventListener('visibilitychange', () => { if (document.hidden) abandon(); });
  window.addEventListener('resize', () => {
    const active = presentation;
    if (!active) return;
    const shell = active.wheel.closest('.raid-wheel-shell'), period = active.row * active.segments.length;
    active.wheel.style.transform = `translateY(${(shell.clientHeight - active.row) / 2 - period + ((active.position % period) + period) % period}px)`;
  });
  window.TabletopJudicialReward = Object.freeze({ wait, connect, complete, present, abort,
    dismiss:eventId => { if (presentation?.eventId === eventId) closePresentation(); },
    isPresent:eventId => presentation?.eventId === eventId,
    snapshot:() => ({ waiting:waiting ? {eventId:waiting.eventId,attached:waiting.attached} : null,
      presentation:presentation ? {eventId:presentation.eventId,phase:presentation.phase,position:presentation.position,velocity:presentation.velocity,
        direction:presentation.direction,attached:presentation.attached,spectator:presentation.spectator,target:presentation.chosen.id} : null }) });
})();

return window.TabletopJudicialReward;
};
