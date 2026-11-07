'use strict';

module.exports = function createPolicy(cards, byId) {
 const rank = card => byId[card].rank;
 const boost = player => player.morale > 0 ? 2 : 0;
 const forgetEvents = new Set(['draw', 'play', 'defeat', 'return']);
 const visibleTo = (event, id) => event.to === 'all' || Array.isArray(event.to) && event.to.includes(id);

 function observe(memory, view, id, events) {
  const knowledge = memory || new Map();
  const remember = (player, card) => {
   if (player === id || !byId[card]) return;
   if (!knowledge.has(player)) knowledge.set(player, {cards: new Set(), misses: new Set()});
   knowledge.get(player).cards.add(card);
  };
  for (const event of events) {
   if (!visibleTo(event, id)) continue;
   if (forgetEvents.has(event.type)) knowledge.delete(event.player);
   if (event.type === 'battle-private') {
    for (const entry of event.cards) remember(entry.player, entry.card);
   }
   if (event.type === 'guess-result' && !event.hit && event.player !== id) {
    if (!knowledge.has(event.player)) knowledge.set(event.player, {cards: new Set(), misses: new Set()});
    knowledge.get(event.player).misses.add(event.digit);
   }
  }
  const pending = view.pending;
  if (pending?.owner === id && pending.type === 'read') {
   for (const card of pending.cards) remember(pending.target, card);
  }
  return knowledge;
 }

 function cpuAction(view, id, rng = Math.random, knowledge = new Map()) {
  if (view.phase !== 'playing') return null;
  const own = view.players[id], pending = view.pending;
  const unavailable = new Set([...own.hand, ...view.players.flatMap(player => player.played)]);
  const known = player => [...(knowledge.get(player.id)?.cards || [])]
   .filter(card => !unavailable.has(card)).slice(0, player.hand.length);
  const observed = new Set(view.players.filter(player => player.id !== id).flatMap(known));

  function candidates(player) {
   const certain = known(player), misses = knowledge.get(player.id)?.misses;
   const remaining = cards.filter(card => card.team === player.team && !unavailable.has(card.id) && !observed.has(card.id) && !misses?.has(card.rank));
   return {certain, remaining, unknown: Math.max(0, player.hand.length - certain.length)};
  }
  function hitChance(player, digit) {
   const {certain, remaining, unknown} = candidates(player);
   if (certain.some(card => rank(card) === digit)) return 1;
   if (!unknown || !remaining.length) return 0;
   const misses = remaining.filter(card => card.rank !== digit).length;
   let miss = 1;
   for (let i = 0; i < Math.min(unknown, remaining.length); i++) miss *= Math.max(0, misses - i) / (remaining.length - i);
   return 1 - miss;
  }
  function fightScore(card, attacker, target, opponentChooses = false) {
   const {certain, remaining, unknown} = candidates(target);
   const value = rank(card) + boost(attacker);
   const score = opposing => {
    const difference = value - rank(opposing) - boost(target);
    if (difference > 0) return view.hp[target.team] === 1 ? 4 : 1;
    if (difference < 0) return view.hp[attacker.team] === 1 ? -4 : -1;
    return boost(target) > boost(attacker) ? .12 : -.08;
   };
   const outcomes = certain.map(score);
   const unknownScore = remaining.length ? remaining.reduce((sum, c) => sum + score(c.id), 0) / remaining.length : 0;
   for (let i = 0; i < unknown; i++) outcomes.push(unknownScore);
   if (!outcomes.length) return -1;
   return opponentChooses ? Math.min(...outcomes) : outcomes.reduce((sum, n) => sum + n, 0) / outcomes.length;
  }
  function best(options, score) {
   let high = -Infinity, ties = [];
   for (const option of options) {
    const value = score(option);
    if (value > high + 1e-9) { high = value; ties = [option]; }
    else if (Math.abs(value - high) <= 1e-9) ties.push(option);
   }
   return ties[Math.floor(rng() * ties.length)];
  }
  const opponents = view.players.filter(player => player.team !== own.team);
  const digits = own.team === 'navy' ? [1,2,3,4,5,6] : [1,2,3,4,5,6,7];
  const guessValue = (digit, targets) => targets.reduce((sum, target) => sum + hitChance(target, digit), 0);
  const keepValue = card => rank(card) + (byId[card].justice ? 4 : 0);
  function effectValue(card, hand) {
   const {rank: n, justice, amount} = byId[card];
   if (n === 1) {
    return 4 * Math.max(...digits.map(digit => own.team === 'navy' && !justice
     ? Math.max(...opponents.map(target => hitChance(target, digit))) : guessValue(digit, opponents)));
   }
   if (n === 3) {
    const chances = opponents.map(target => Math.max(...hand.map(held => fightScore(held, own, target))));
    return 3 * Math.max(0, ...chances);
   }
   if (n === 4) return own.morale ? 1 : 1.6 + (amount || 1) * .25;
   if (n === 5) return own.team === 'navy' && view.deckCounts.navy ? 2.2 : 1;
   return 1.2;
  }

  if (!pending) {
   if (id !== view.turn) return null;
   if (view.step === 'draw') return {type: 'DRAW'};
   const playable = own.hand.filter(card => card && rank(card) !== 7);
   if (!playable.length) return null;
   const card = best(playable, played => {
    const rest = own.hand.filter(held => held !== played);
    return effectValue(played, rest) - .48 * rank(played);
   });
   return {type: 'PLAY', card};
  }
  if (pending.owner !== id) return null;
  const choose = fields => ({type: 'CHOOSE', ...fields});
  const targets = (pending.targets || []).map(target => view.players[target]);
  switch (pending.type) {
   case 'read': case 'review': return choose({done: true});
   case 'guess': return choose({digit: best(pending.digits, digit => guessValue(digit, targets))});
   case 'target-guess': return choose({target: best(targets, player => Math.max(...digits.map(digit => hitChance(player, digit)))).id});
   case 'threshold': return choose({target: best(targets, player => digits.filter(digit => pending.high ? digit >= 3 : digit <= 3).reduce((sum, digit) => sum + hitChance(player, digit), 0)).id});
   case 'fight-target': {
    const score = target => Math.max(...own.hand.map(card => fightScore(card, own, target)));
    const target = best(targets, score);
    return target && score(target) > -.18 ? choose({target: target.id}) : choose({skip: true});
   }
   case 'fight-ally': return choose({target: best(targets, player => player.id === id
    ? Math.max(...own.hand.map(card => fightScore(card, own, opponents[0]))) : (boost(player) ? .15 : -.15)).id});
   case 'peek-reader': return choose({target: best(targets, player => player.id === id ? 0 : boost(player)).id});
   case 'morale-target': return choose({target: best(targets, player => -player.morale + (player.id === id ? .1 : 0)).id});
   case 'battle-card': return choose({card: best(pending.cards, rank)});
   case 'defeat-choice': return choose({card: best(pending.cards, card => -keepValue(card))});
   case 'copy': return choose({card: best(pending.cards, card => effectValue(card, own.hand))});
   case 'return': return choose({cards: pending.cards.slice().sort((a,b) => keepValue(a) - keepValue(b)).slice(0,pending.count)});
   case 'order': return choose({cards: pending.cards.slice().sort((a,b) => rank(b) - rank(a))});
   // A private shuffle hides the slot mapping even when the CPU knows a card's identity.
   case 'peek-slot': case 'battle-slot': return choose({slot: Math.floor(rng() * pending.slots)});
   case 'arrange': return choose({cards: shuffle(pending.cards.slice(), rng)});
   default: return null;
  }
 }
 function shuffle(items, rng) {
  for (let i = items.length - 1; i > 0; i--) {
   const j = Math.floor(rng() * (i + 1));
   [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
 }
 return {cpuAction, observe};
};
