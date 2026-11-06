/* Shared Card duel stage. Public geometry and cosmetic moves never inspect hands. */
(() => {
  'use strict';
  const arenas = ['marineford', 'onigashima', 'dressrosa'];
  const moves = ['fire-fist', 'ice-sphere', 'triple-slash', 'thunderbolt', 'magma-fist', 'sandstorm', 'dark-vortex', 'quake-ring', 'paw-cannon', 'light-beam', 'meteor', 'dragon-breath', 'phoenix-flame', 'poison-dragon', 'rubber-barrage', 'flame-kick', 'water-dragon', 'mochi-drill', 'string-cage', 'thunder-orb'];
  function hash(value) {
    let valueHash = 2166136261;
    for (const char of String(value)) valueHash = Math.imul(valueHash ^ char.charCodeAt(0), 16777619);
    return valueHash >>> 0;
  }
  function selection(duelId) {
    const seed = hash(duelId);
    return {
      arenaKey:arenas[seed % arenas.length],
      leftMove:moves[(seed >>> 3) % moves.length],
      rightMove:moves[((seed >>> 3) + 7 + (seed % 12)) % moves.length]
    };
  }
  const absoluteUrl = relative => new URL(relative, document.baseURI).href;
  const finisherUrls = new Map();
  const emptyEffect = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  function finisherUrl(id) {
    if (finisherUrls.has(id)) return finisherUrls.get(id);
    // Existing desktop/native styles carry these textures inline. They are not
    // separate logical files in the Card media manifest.
    const probe = document.createElement('i');
    probe.className = 'duel-finisher-art';
    probe.dataset.finisher = id;
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:fixed;width:0;height:0;visibility:hidden;pointer-events:none;';
    document.body.append(probe);
    const computed = getComputedStyle(probe);
    const value = computed.getPropertyValue('--duel-finisher-art').trim() || computed.backgroundImage;
    const match = value.match(/^url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)$/);
    probe.remove();
    const url = (match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim();
    if (!/^data:image\//i.test(url)) return emptyEffect;
    finisherUrls.set(id, url);
    return url;
  }
  function mount() {
    const api = window.CardPhonePresentation;
    if (!api || api.duelSceneVersion >= 4) return;
    api.duelSceneVersion = 4;
    api.duelStageVersion = 1;
    api.duelStageDuration = 9200;
    api.duelStageArenaFor = duelId => selection(duelId).arenaKey;
    api.duelStageAssetsFor = duelId => {
      const {arenaKey, leftMove, rightMove} = selection(duelId);
      return [
        absoluteUrl(`images/card-duel/arena-${arenaKey}-v1.webp`),
        finisherUrl(leftMove),
        finisherUrl(rightMove),
        absoluteUrl('images/cards/back.webp')
      ];
    };
    api.playDuelScene = function ({scene, from, to, d, bounds, anchor, handAnchor, animate, later, make, name, card, validCard}) {
      if (!scene || !d || from === to || !Number.isInteger(from) || !Number.isInteger(to)) return;
      const {arenaKey, leftMove, rightMove} = selection(d.duelId ?? `${from}:${to}:${d.winnerId ?? 'draw'}`);
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const viewer = typeof me === 'object' && me ? me.playerId : api.viewerPlayerId?.();
      const participant = viewer === from || viewer === to;
      const hasWinner = d.winnerId === from || d.winnerId === to;
      const arena = make('section', 'card-duel-stage');
      const floor = make('div', 'cduel-floor');
      const versus = make('strong', 'cduel-versus', 'VS');
      const verdict = make('div', 'cduel-verdict');
      arena.dataset.arena = arenaKey;
      arena.dataset.phase = 'entry';
      arena.setAttribute('aria-label', `${name(from)} 與 ${name(to)} 對決`);
      arena.style.setProperty('--cduel-background', `url("${absoluteUrl(`images/card-duel/arena-${arenaKey}-v1.webp`)}")`);
      verdict.hidden = true;
      verdict.setAttribute('role', 'status');
      verdict.setAttribute('aria-live', 'polite');
      arena.append(floor, versus, verdict);
      scene.append(arena);
      // The current hand must not remain as a second copy beneath its duel card.
      if (participant) {
        for (const node of [api.ownHandElement?.(), document.getElementById('imgHand'), document.getElementById('imgDrawn')]) {
          if (node) api.maskHandArt?.(node);
        }
      }
      function numberBadge(slot, value, visibility) {
        if (!validCard(value)) return;
        let badge = slot.holder.querySelector('.cduel-number');
        if (!badge) {
          badge = make('strong', 'cduel-number');
          slot.holder.append(badge);
        }
        badge.textContent = String(value);
        badge.dataset.visibility = visibility;
        badge.setAttribute('aria-label', visibility === 'private' ? `僅對決雙方可見：${value} 號` : `公開敗方手牌：${value} 號`);
      }
      function publicIdentity(id) {
        const identity = make('div', 'cduel-identity');
        const portrait = make('span', 'cduel-avatar', name(id).slice(0, 1));
        portrait.setAttribute('aria-hidden', 'true');
        const row = api.playerVisualElement?.(id) || document.getElementById('players')?.children[id];
        const source = row?.querySelector('img.rounded-full');
        const sourceUrl = api.duelAvatarUrl?.(id) || source?.getAttribute('src');
        if (sourceUrl) {
          const image = make('img', 'cduel-portrait');
          image.alt = '';
          image.src = sourceUrl;
          image.addEventListener('error', () => image.remove(), {once:true});
          portrait.append(image);
        }
        identity.append(portrait, make('strong', 'cduel-name', name(id)));
        return identity;
      }
      const slots = [from, to].map((id, index) => {
        const side = index ? 'right' : 'left';
        const slot = make('div', 'cduel-slot');
        const holder = make('div', 'cduel-card-wrap');
        const image = make('img', 'cduel-card');
        const charge = make('img', 'cduel-charge');
        const crack = make('span', 'cduel-crack');
        const ko = make('strong', 'cduel-ko', 'KO');
        slot.dataset.player = String(id);
        slot.dataset.side = side;
        image.src = 'images/cards/back.webp';
        image.alt = name(id) + ' 的卡背';
        image.draggable = false;
        charge.alt = '';
        charge.draggable = false;
        charge.src = finisherUrl(index ? rightMove : leftMove);
        charge.setAttribute('aria-hidden', 'true');
        crack.setAttribute('aria-hidden', 'true');
        ko.setAttribute('aria-hidden', 'true');
        holder.append(image, charge, crack, ko);
        slot.append(holder, publicIdentity(id));
        arena.append(slot);
        const item = {id, side, slot, holder, image, charge, crack, ko, origin:handAnchor(anchor(id, bounds))};
        // No number node is created for observers. Only authenticated private data is read.
        const privateNumber = participant && d.privateCards && Object.prototype.hasOwnProperty.call(d.privateCards, id) ? d.privateCards[id] : null;
        if (validCard(privateNumber)) {
          numberBadge(item, privateNumber, 'private');
          image.alt = `${name(id)} 的卡背，${privateNumber} 號，僅對決雙方可見`;
        }
        return item;
      });
      const loser = hasWinner ? slots.find(slot => slot.id !== d.winnerId) : null;
      const shots = slots.map((slot, index) => {
        const shot = make('img', 'cduel-shot');
        shot.dataset.side = slot.side;
        shot.src = finisherUrl(index ? rightMove : leftMove);
        shot.alt = '';
        shot.draggable = false;
        shot.setAttribute('aria-hidden', 'true');
        arena.append(shot);
        return shot;
      });
      const flash = make('i', 'cduel-impact');
      flash.setAttribute('aria-hidden', 'true');
      arena.append(flash);
      function perform(node, frames, duration, delay = 0) {
        // One shared animation entry point preserves the owner's reduced-motion policy.
        animate(node, frames, duration, delay);
      }
      function pulse(strong) {
        if (reduced) return;
        perform(flash, [{opacity:0, transform:'translate(-50%,-50%) scale(.45)'}, {opacity:strong ? .85 : .6, transform:'translate(-50%,-50%) scale(1)', offset:.25}, {opacity:0, transform:'translate(-50%,-50%) scale(1.4)'}], strong ? 420 : 300);
      }
      function recoil(slot, strong = false) {
        const sign = slot.side === 'left' ? -1 : 1;
        const distance = strong ? 9 : 5;
        perform(slot.holder, [{transform:'translate(0,0) rotate(0deg)'}, {transform:`translate(${sign * distance}px,3px) rotate(${sign * 3}deg)`, offset:.3}, {transform:'translate(0,0) rotate(0deg)'}], 380);
      }
      function attack(index, strong = false) {
        const slot = slots[index];
        const sign = index ? -1 : 1;
        const travel = Math.min(arena.clientWidth * (strong ? .11 : .075), 115);
        const mirror = index ? 'scaleX(-1) ' : '';
        perform(slot.holder, [{transform:'translate(0,0) rotate(0deg)'}, {transform:`translate(${sign * travel}px,-8px) rotate(${sign * 4}deg)`, offset:.4}, {transform:'translate(0,0) rotate(0deg)'}], 680);
        perform(slot.charge, [{opacity:0, transform:'scale(.7)'}, {opacity:.9, transform:'scale(1)', offset:.4}, {opacity:0, transform:'scale(1.15)'}], 620);
        perform(shots[index], [{opacity:0, transform:mirror + 'translateX(0) scale(.65)'}, {opacity:.95, transform:mirror + `translateX(${arena.clientWidth * .08}px) scale(.95)`, offset:.4}, {opacity:0, transform:mirror + `translateX(${arena.clientWidth * .26}px) scale(1.05)`}], 660);
      }
      perform(arena, [{opacity:0}, {opacity:1}], 320);
      for (const slot of slots) {
        const rect = slot.image.getBoundingClientRect();
        const a = slot.origin;
        if (a) perform(slot.holder, [{opacity:0, transform:`translate(${a.x - rect.left - rect.width / 2}px,${a.y - rect.top - rect.height / 2}px) scale(.25)`}, {opacity:1, transform:'translate(0,0) scale(1)'}], 900);
      }
      later(() => {
        arena.dataset.phase = 'charge';
        for (const slot of slots) perform(slot.charge, [{opacity:0, transform:'scale(.65)'}, {opacity:.5, transform:'scale(.95)', offset:.6}, {opacity:0, transform:'scale(1.05)'}], 740);
      }, 550);
      later(() => { arena.dataset.phase = 'exchange'; versus.hidden = true; attack(0); }, 1300);
      later(() => { pulse(false); recoil(slots[1]); }, 1730);
      later(() => { attack(1); }, 2250);
      later(() => { pulse(false); recoil(slots[0]); }, 2680);
      later(() => { attack(0); attack(1); }, 3200);
      later(() => { pulse(true); recoil(slots[0]); recoil(slots[1]); }, 3630);
      later(() => {
        arena.dataset.phase = 'finish';
        if (hasWinner) attack(d.winnerId === from ? 0 : 1, true);
      }, 4300);
      later(() => {
        pulse(true);
        if (loser && validCard(d.loserCardId)) perform(loser.image, [{transform:'rotateY(0deg)'}, {transform:'rotateY(90deg)'}], 180);
        else { recoil(slots[0], true); recoil(slots[1], true); }
      }, 4640);
      later(() => {
        arena.dataset.phase = 'reveal';
        if (!loser || !validCard(d.loserCardId)) return;
        loser.image.src = card(d.loserCardId);
        loser.image.alt = `${name(loser.id)} 公開的敗方 ${d.loserCardId} 號手牌`;
        loser.image.dataset.revealed = 'public-loser';
        loser.slot.dataset.revealed = 'public-loser';
        numberBadge(loser, d.loserCardId, 'public');
        perform(loser.image, [{transform:'rotateY(-90deg)'}, {transform:'rotateY(0deg)'}], 180);
      }, 4820);
      later(() => {
        if (!loser) return;
        const sign = loser.side === 'left' ? -1 : 1;
        loser.slot.dataset.outcome = 'lost';
        loser.crack.style.opacity = '.8';
        loser.ko.style.opacity = '1';
        loser.image.style.filter = 'grayscale(1) brightness(.75)';
        perform(loser.holder, [{transform:'translate(0,0) rotate(0deg)'}, {transform:`translate(${sign * 6}px,3px) rotate(${sign * 5}deg)`}], 650);
        perform(loser.ko, [{opacity:0, transform:'translate(-50%,-50%) rotate(-10deg) scale(1.7)'}, {opacity:1, transform:'translate(-50%,-50%) rotate(-10deg) scale(1)'}], 420);
      }, 5100);
      later(() => {
        arena.dataset.phase = 'result';
        verdict.textContent = hasWinner ? `${name(d.winnerId)} 勝出` : '平手';
        verdict.hidden = false;
        for (const slot of slots) slot.slot.dataset.outcome = hasWinner ? slot === loser ? 'lost' : 'won' : 'draw';
        perform(verdict, [{opacity:0, transform:'translateY(6px)'}, {opacity:1, transform:'translateY(0)'}], 240);
      }, 6200);
      later(() => {
        arena.dataset.phase = 'return';
        verdict.hidden = true;
        for (const slot of slots) {
          const rect = slot.holder.getBoundingClientRect();
          const discard = slot === loser ? document.querySelector('.phone-discard-stack')?.getBoundingClientRect() : null;
          const target = discard ? {x:discard.left + discard.width / 2, y:discard.top + discard.height / 2} : slot.origin;
          // A surviving hand always returns face down; only the already-public loser may retain its face.
          if (slot !== loser) slot.image.src = 'images/cards/back.webp';
          slot.holder.querySelector('.cduel-number')?.remove();
          slot.ko.style.opacity = '0';
          if (target) perform(slot.holder, [{opacity:1, transform:'translate(0,0) scale(1)'}, {opacity:0, transform:`translate(${target.x - rect.left - rect.width / 2}px,${target.y - rect.top - rect.height / 2}px) scale(.2)`}], 950);
          else perform(slot.holder, [{opacity:1}, {opacity:0}], 950);
        }
        perform(arena, [{opacity:1}, {opacity:0}], 1000);
      }, 8000);
      later(() => arena.remove(), 9100);
    };
  }
  let bootTimer = null, attempts = 0;
  function boot() {
    clearTimeout(bootTimer);
    mount();
    if (window.CardPhonePresentation?.duelStageVersion) return;
    if (++attempts < 200) bootTimer = setTimeout(boot, 50);
  }
  document.addEventListener('DOMContentLoaded', boot, {once:true});
  document.addEventListener('card:interface-ready', boot);
  boot();
})();
