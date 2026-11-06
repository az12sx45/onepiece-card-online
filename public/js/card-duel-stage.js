/* Shared Card duel collision. Public geometry never inspects hidden hands. */
(() => {
  'use strict';
  const arenas = ['marineford', 'onigashima', 'dressrosa'];
  function hash(value) {
    let valueHash = 2166136261;
    for (const char of String(value)) valueHash = Math.imul(valueHash ^ char.charCodeAt(0), 16777619);
    return valueHash >>> 0;
  }
  function selection(duelId) {
    const seed = hash(duelId);
    return {arenaKey:arenas[seed % arenas.length]};
  }
  const absoluteUrl = relative => new URL(relative, document.baseURI).href;
  function mount() {
    const api = window.CardPhonePresentation;
    if (!api || api.duelSceneVersion >= 5) return;
    api.duelSceneVersion = 5;
    api.duelStageVersion = 2;
    api.duelStageDuration = 4200;
    api.duelStageArenaFor = duelId => selection(duelId).arenaKey;
    api.duelStageAssetsFor = duelId => {
      const {arenaKey} = selection(duelId);
      return [
        absoluteUrl(`images/card-duel/arena-${arenaKey}-v1.webp`),
        absoluteUrl('images/cards/back.webp')
      ];
    };
    api.playDuelScene = function ({scene, from, to, d, bounds, anchor, handAnchor, animate, later, make, name, card, validCard}) {
      if (!scene || !d || from === to || !Number.isInteger(from) || !Number.isInteger(to)) return;
      const {arenaKey} = selection(d.duelId ?? `${from}:${to}:${d.winnerId ?? 'draw'}`);
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
        const ko = make('strong', 'cduel-ko', 'KO');
        slot.dataset.player = String(id);
        slot.dataset.side = side;
        image.src = 'images/cards/back.webp';
        image.alt = name(id) + ' 的卡背';
        image.draggable = false;
        ko.setAttribute('aria-hidden', 'true');
        holder.append(image, ko);
        slot.append(holder, publicIdentity(id));
        arena.append(slot);
        const item = {id, side, slot, holder, image, ko, origin:handAnchor(anchor(id, bounds))};
        // No number node is created for observers. Only authenticated private data is read.
        const privateNumber = participant && d.privateCards && Object.prototype.hasOwnProperty.call(d.privateCards, id) ? d.privateCards[id] : null;
        if (validCard(privateNumber)) {
          numberBadge(item, privateNumber, 'private');
          image.alt = `${name(id)} 的卡背，${privateNumber} 號，僅對決雙方可見`;
        }
        return item;
      });
      const loser = hasWinner ? slots.find(slot => slot.id !== d.winnerId) : null;
      const flash = make('i', 'cduel-impact');
      flash.setAttribute('aria-hidden', 'true');
      arena.append(flash);
      function perform(node, frames, duration, delay = 0) {
        // One shared animation entry point preserves the owner's reduced-motion policy.
        animate(node, frames, duration, delay);
      }
      function pulse() {
        if (reduced) return;
        perform(flash, [{opacity:0, transform:'translate(-50%,-50%) scale(.45)'}, {opacity:.6, transform:'translate(-50%,-50%) scale(1)', offset:.2}, {opacity:0, transform:'translate(-50%,-50%) scale(1.4)'}], 280);
      }
      function clash() {
        arena.dataset.phase = 'exchange';
        versus.hidden = true;
        const rects = slots.map(slot => slot.holder.getBoundingClientRect());
        const middle = (rects[0].left + rects[0].width / 2 + rects[1].left + rects[1].width / 2) / 2;
        const arenaRect = arena.getBoundingClientRect();
        flash.style.left = (middle - arenaRect.left) + 'px';
        flash.style.top = ((rects[0].top + rects[0].height / 2 + rects[1].top + rects[1].height / 2) / 2 - arenaRect.top) + 'px';
        const poses = slots.map((slot, index) => {
          const sign = index ? -1 : 1, rect = rects[index];
          // Original collision geometry: travel to the shared centre, make
          // contact, hold the impact, recoil, then return to the own side.
          const dx = middle - (rect.left + rect.width / 2) - sign * rect.width * .22;
          const dy = index ? -7 : 7;
          return {slot,
            windup:`translate(${-sign * 14}px,${-dy}px) rotate(${-sign * 8}deg)`,
            contact:`translate(${dx}px,${dy}px) rotate(${sign * 13}deg)`,
            held:`translate(${dx}px,${dy}px) rotate(${sign * 8}deg)`,
            recoil:`translate(${-sign * 10}px,0) rotate(${-sign * 6}deg)`};
        });
        // Separate short segments keep contact and its flash aligned even
        // though the shared tracked helper uses an ease-out timing curve.
        for (const pose of poses) perform(pose.slot.holder, [{transform:'translate(0,0) rotate(0deg)'}, {transform:pose.windup}], 140);
        later(() => {
          for (const pose of poses) perform(pose.slot.holder, [{transform:pose.windup}, {transform:pose.contact}], 204);
        }, 140);
        later(() => {
          pulse();
          for (const pose of poses) perform(pose.slot.holder, [{transform:pose.contact}, {transform:pose.held}], 96);
        }, 344);
        later(() => {
          for (const pose of poses) perform(pose.slot.holder, [{transform:pose.held}, {transform:pose.recoil, offset:.65}, {transform:'translate(0,0) rotate(0deg)'}], 360);
        }, 440);
      }
      perform(arena, [{opacity:0}, {opacity:1}], 320);
      for (const slot of slots) {
        const rect = slot.image.getBoundingClientRect();
        const a = slot.origin;
        if (a) perform(slot.holder, [{opacity:0, transform:`translate(${a.x - rect.left - rect.width / 2}px,${a.y - rect.top - rect.height / 2}px) scale(.25)`}, {opacity:1, transform:'translate(0,0) scale(1)'}], 600);
      }
      later(clash, 800);
      later(() => {
        arena.dataset.phase = 'finish';
        if (loser && validCard(d.loserCardId)) perform(loser.image, [{transform:'rotateY(0deg)'}, {transform:'rotateY(90deg)'}], 180);
      }, 1620);
      later(() => {
        arena.dataset.phase = 'reveal';
        if (!loser || !validCard(d.loserCardId)) return;
        loser.image.src = card(d.loserCardId);
        loser.image.alt = `${name(loser.id)} 公開的敗方 ${d.loserCardId} 號手牌`;
        loser.image.dataset.revealed = 'public-loser';
        loser.slot.dataset.revealed = 'public-loser';
        numberBadge(loser, d.loserCardId, 'public');
        perform(loser.image, [{transform:'rotateY(-90deg)'}, {transform:'rotateY(0deg)'}], 180);
      }, 1800);
      later(() => {
        if (!loser) return;
        const sign = loser.side === 'left' ? -1 : 1;
        loser.slot.dataset.outcome = 'lost';
        loser.ko.style.opacity = '1';
        loser.image.style.filter = 'grayscale(1) brightness(.75)';
        perform(loser.holder, [{transform:'translate(0,0) rotate(0deg)'}, {transform:`translate(${sign * 6}px,3px) rotate(${sign * 5}deg)`}], 240);
        perform(loser.ko, [{opacity:0, transform:'translate(-50%,-50%) rotate(-10deg) scale(1.3)'}, {opacity:1, transform:'translate(-50%,-50%) rotate(-10deg) scale(1)'}], 220);
      }, 2100);
      later(() => {
        arena.dataset.phase = 'result';
        verdict.textContent = hasWinner ? `${name(d.winnerId)} 勝出` : '平手';
        verdict.hidden = false;
        for (const slot of slots) slot.slot.dataset.outcome = hasWinner ? slot === loser ? 'lost' : 'won' : 'draw';
        perform(verdict, [{opacity:0, transform:'translateY(6px)'}, {opacity:1, transform:'translateY(0)'}], 240);
      }, 2100);
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
          if (target) perform(slot.holder, [{opacity:1, transform:'translate(0,0) scale(1)'}, {opacity:0, transform:`translate(${target.x - rect.left - rect.width / 2}px,${target.y - rect.top - rect.height / 2}px) scale(.2)`}], 700);
          else perform(slot.holder, [{opacity:1}, {opacity:0}], 700);
        }
        perform(arena, [{opacity:1}, {opacity:0}], 700);
      }, 3200);
      later(() => arena.remove(), 4100);
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
