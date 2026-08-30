(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BoardYorkCluePuzzle = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "york-coordinate-v3-demo-relations";
  const CARD_COUNT = 13;
  const CARDS = Object.freeze(Array.from({ length: CARD_COUNT }, (_, index) => index + 1));
  const DIFFICULTIES = Object.freeze({
    easy: Object.freeze({
      key: "easy",
      label: "簡單",
      targetTier: 1,
      targetItemId: "york_coordinate_decoder_t1",
      targetItemName: "約克座標解碼器・一階",
      dropRate: 0.2,
      weakenLimit: 4,
      minimumRelational: 4,
      minimumAnchors: 1,
      description: "以附近牌的精確方向與距離為主，適合先熟悉排牌方法。",
    }),
    normal: Object.freeze({
      key: "normal",
      label: "普通",
      targetTier: 2,
      targetItemId: "york_coordinate_decoder_t2",
      targetItemName: "約克座標解碼器・二階",
      dropRate: 0.3,
      weakenLimit: 8,
      minimumRelational: 7,
      minimumAnchors: 1,
      description: "部分線索只說相鄰或左右，需要交叉比對。",
    }),
    hard: Object.freeze({
      key: "hard",
      label: "困難",
      targetTier: 3,
      targetItemId: "york_coordinate_decoder_t3",
      targetItemName: "約克座標解碼器・三階",
      dropRate: 0.4,
      weakenLimit: 13,
      minimumRelational: 9,
      minimumAnchors: 0,
      description: "盡量改成左右、相鄰、間隔與位置關係，仍保證唯一解。",
    }),
  });

  function hashSeed(text) {
    let hash = 2166136261 >>> 0;
    const source = String(text || "");
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function createRng(seedText) {
    let state = hashSeed(seedText) || 0x9e3779b9;
    return function nextRandom() {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffled(values, rng) {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const target = Math.floor(rng() * (index + 1));
      [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
  }

  function rotate(values, amount) {
    const offset = ((amount % values.length) + values.length) % values.length;
    return values.slice(offset).concat(values.slice(0, offset));
  }

  function arraysEqual(left, right) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => value === right[index]);
  }

  function normalizeDifficulty(value) {
    const key = String(value || "easy").toLowerCase();
    return DIFFICULTIES[key] || DIFFICULTIES.easy;
  }

  function normalizeVariantKey(value) {
    return String(value || "").trim().slice(0, 160);
  }

  function composeSeed(layoutSeed, playerId, difficultyKey, variantKey = "") {
    const difficulty = normalizeDifficulty(difficultyKey);
    const variant = normalizeVariantKey(variantKey);
    return `${String(layoutSeed || "layout")}:${String(playerId || "player")}:${difficulty.key}:${VERSION}${variant ? `:variant:${variant}` : ""}`;
  }

  function createSolution(layoutSeed, playerId, difficultyKey, variantKey = "") {
    const difficulty = normalizeDifficulty(difficultyKey);
    const variant = normalizeVariantKey(variantKey);
    const baseSeed = `${String(layoutSeed || "layout")}:${String(playerId || "player")}:${VERSION}:solution-base${variant ? `:variant:${variant}` : ""}`;
    const baseOrder = shuffled(CARDS, createRng(baseSeed));
    if (difficulty.key === "normal") return rotate(baseOrder, 1);
    if (difficulty.key === "hard") return rotate(baseOrder, 2);
    return baseOrder;
  }

  function relationSatisfied(clue, positions) {
    const ownerPosition = positions[clue.owner];
    const targetPosition = clue.target ? positions[clue.target] : null;
    if (!Number.isInteger(ownerPosition)) return false;
    if (clue.type === "at") return ownerPosition === clue.position;
    if (clue.type === "atEnd") return ownerPosition === 0 || ownerPosition === CARD_COUNT - 1;
    if (clue.type === "positionParity") return (ownerPosition + 1) % 2 === clue.parity;
    if (!Number.isInteger(targetPosition)) return false;
    if (clue.type === "offset") return ownerPosition === targetPosition + clue.delta;
    if (clue.type === "gap") return Math.abs(ownerPosition - targetPosition) === clue.distance;
    if (clue.type === "adjacent") return Math.abs(ownerPosition - targetPosition) === 1;
    if (clue.type === "before") return ownerPosition < targetPosition;
    if (clue.type === "after") return ownerPosition > targetPosition;
    return false;
  }

  function orderSatisfies(order, clues) {
    if (!Array.isArray(order) || order.length !== CARD_COUNT) return false;
    const positions = {};
    order.forEach((card, index) => {
      positions[card] = index;
    });
    return clues.every(clue => relationSatisfied(clue, positions));
  }

  function freePositionExists(used, predicate) {
    for (let position = 0; position < CARD_COUNT; position += 1) {
      if (!used[position] && predicate(position)) return true;
    }
    return false;
  }

  function partialAssignmentIsValid(assigned, used, clues) {
    for (const clue of clues) {
      const ownerPosition = assigned[clue.owner];
      const targetPosition = clue.target ? assigned[clue.target] : null;
      const ownerAssigned = Number.isInteger(ownerPosition);
      const targetAssigned = Number.isInteger(targetPosition);

      if (clue.type === "at") {
        if (ownerAssigned && ownerPosition !== clue.position) return false;
        if (!ownerAssigned && used[clue.position]) return false;
        continue;
      }
      if (clue.type === "atEnd") {
        if (ownerAssigned && ownerPosition !== 0 && ownerPosition !== CARD_COUNT - 1) return false;
        if (!ownerAssigned && used[0] && used[CARD_COUNT - 1]) return false;
        continue;
      }
      if (clue.type === "positionParity") {
        if (ownerAssigned && (ownerPosition + 1) % 2 !== clue.parity) return false;
        if (!ownerAssigned && !freePositionExists(used, position => (position + 1) % 2 === clue.parity)) return false;
        continue;
      }
      if (ownerAssigned && targetAssigned) {
        if (!relationSatisfied(clue, { [clue.owner]: ownerPosition, [clue.target]: targetPosition })) return false;
        continue;
      }
      if (clue.type === "offset") {
        if (ownerAssigned && !targetAssigned) {
          const required = ownerPosition - clue.delta;
          if (required < 0 || required >= CARD_COUNT || used[required]) return false;
        } else if (!ownerAssigned && targetAssigned) {
          const required = targetPosition + clue.delta;
          if (required < 0 || required >= CARD_COUNT || used[required]) return false;
        }
        continue;
      }

      const compatible = (ownerCandidate, targetCandidate) => {
        if (clue.type === "gap") return Math.abs(ownerCandidate - targetCandidate) === clue.distance;
        if (clue.type === "adjacent") return Math.abs(ownerCandidate - targetCandidate) === 1;
        if (clue.type === "before") return ownerCandidate < targetCandidate;
        if (clue.type === "after") return ownerCandidate > targetCandidate;
        return true;
      };

      if (ownerAssigned && !targetAssigned) {
        if (!freePositionExists(used, position => compatible(ownerPosition, position))) return false;
      } else if (!ownerAssigned && targetAssigned) {
        if (!freePositionExists(used, position => compatible(position, targetPosition))) return false;
      }
    }
    return true;
  }

  function possiblePositionsForCard(card, assigned, used, clues) {
    const candidates = [];
    for (let position = 0; position < CARD_COUNT; position += 1) {
      if (used[position]) continue;
      assigned[card] = position;
      if (partialAssignmentIsValid(assigned, used, clues)) candidates.push(position);
      assigned[card] = null;
    }
    return candidates;
  }

  function countSolutions(clues, limit = 2, nodeLimit = 120000) {
    const assigned = Array(CARD_COUNT + 1).fill(null);
    const used = Array(CARD_COUNT).fill(false);
    let count = 0;
    let firstSolution = null;
    let nodes = 0;

    function search(depth) {
      if (count >= limit || nodes >= nodeLimit) return;
      nodes += 1;
      if (depth === CARD_COUNT) {
        count += 1;
        if (!firstSolution) {
          firstSolution = Array.from({ length: CARD_COUNT }, (_, position) => {
            for (let card = 1; card <= CARD_COUNT; card += 1) {
              if (assigned[card] === position) return card;
            }
            return 0;
          });
        }
        return;
      }

      let nextCard = 0;
      let nextCandidates = null;
      for (let card = 1; card <= CARD_COUNT; card += 1) {
        if (Number.isInteger(assigned[card])) continue;
        const candidates = possiblePositionsForCard(card, assigned, used, clues);
        if (!candidates.length) return;
        if (!nextCandidates || candidates.length < nextCandidates.length) {
          nextCard = card;
          nextCandidates = candidates;
          if (candidates.length === 1) break;
        }
      }

      for (const position of nextCandidates || []) {
        assigned[nextCard] = position;
        used[position] = true;
        if (partialAssignmentIsValid(assigned, used, clues)) search(depth + 1);
        used[position] = false;
        assigned[nextCard] = null;
        if (count >= limit || nodes >= nodeLimit) return;
      }
    }

    search(0);
    return {
      count: nodes >= nodeLimit && count < limit ? limit : count,
      firstSolution,
      nodes,
      exhausted: nodes >= nodeLimit,
    };
  }

  function strongCluesForSolution(solution, rng) {
    const rootPosition = Math.floor(rng() * CARD_COUNT);
    const connected = new Map([[rootPosition, 0]]);
    const clues = new Map();
    const rootCard = solution[rootPosition];
    clues.set(rootCard, { type: "at", owner: rootCard, position: rootPosition, anchorDepth: 0 });

    while (connected.size < CARD_COUNT) {
      const pairs = [];
      for (let position = 0; position < CARD_COUNT; position += 1) {
        if (connected.has(position)) continue;
        for (const [parentPosition, parentDepth] of connected.entries()) {
          const distance = Math.abs(position - parentPosition);
          if (distance <= 4) pairs.push({ position, parentPosition, parentDepth, distance });
        }
      }
      pairs.sort((left, right) => left.distance - right.distance);
      const shortest = pairs[0]?.distance || 1;
      const preferred = pairs.filter(pair => pair.distance <= Math.min(4, shortest + 1));
      const pair = preferred[Math.floor(rng() * preferred.length)];
      const owner = solution[pair.position];
      const target = solution[pair.parentPosition];
      const anchorDepth = Number(pair.parentDepth || 0) + 1;
      clues.set(owner, {
        type: "offset",
        owner,
        target,
        delta: pair.position - pair.parentPosition,
        anchorDepth,
      });
      connected.set(pair.position, anchorDepth);
    }

    return Array.from({ length: CARD_COUNT }, (_, index) => clues.get(index + 1));
  }

  function weakenedVariants(clue, difficulty) {
    if (clue.type === "at") {
      if (difficulty.key !== "hard") return [];
      const variants = [];
      if (clue.position === 0 || clue.position === CARD_COUNT - 1) {
        variants.push({ type: "atEnd", owner: clue.owner, anchorDepth: clue.anchorDepth });
      }
      variants.push({ type: "positionParity", owner: clue.owner, parity: (clue.position + 1) % 2, anchorDepth: clue.anchorDepth });
      return variants.reverse();
    }
    if (clue.type !== "offset") return [];
    const distance = Math.abs(clue.delta);
    const structural = distance === 1
      ? { type: "adjacent", owner: clue.owner, target: clue.target, anchorDepth: clue.anchorDepth }
      : { type: "gap", owner: clue.owner, target: clue.target, distance, anchorDepth: clue.anchorDepth };
    const broad = {
      type: clue.delta < 0 ? "before" : "after",
      owner: clue.owner,
      target: clue.target,
      anchorDepth: clue.anchorDepth,
    };
    const variants = [structural];
    if (difficulty.key !== "easy") variants.push(broad);
    return difficulty.key === "hard" ? variants.reverse() : variants;
  }

  function clueText(clue, rng) {
    if (clue.type === "at") {
      const choices = [
        `我是整列由左數第 ${clue.position + 1} 張。`,
        `把我放在第 ${clue.position + 1} 格，這是座標錨點。`,
      ];
      return choices[Math.floor(rng() * choices.length)];
    }
    if (clue.type === "atEnd") return "我位於整列的其中一端。";
    if (clue.type === "positionParity") return `我的位置是${clue.parity ? "奇數" : "偶數"}格。`;
    if (clue.type === "adjacent") {
      rng();
      return `我和 ${clue.target} 號牌緊鄰，但線索沒有說左右。`;
    }
    if (clue.type === "gap") {
      const between = clue.distance - 1;
      return between === 1
        ? `我和 ${clue.target} 號牌之間剛好隔一張牌。`
        : `我和 ${clue.target} 號牌相距 ${clue.distance} 格，中間隔 ${between} 張。`;
    }
    if (clue.type === "before") return `我位於 ${clue.target} 號牌左邊，但不一定相鄰。`;
    if (clue.type === "after") return `我位於 ${clue.target} 號牌右邊，但不一定相鄰。`;
    if (clue.type === "offset") {
      const distance = Math.abs(clue.delta);
      const direction = clue.delta > 0 ? "右" : "左";
      if (distance === 1) {
        rng();
        return `我緊鄰在 ${clue.target} 號牌的${direction}側。`;
      }
      const between = distance - 1;
      rng();
      return `我在 ${clue.target} 號牌${direction}邊，中間隔 ${between} 張牌。`;
    }
    return "這張線索仍在解碼。";
  }

  function clueProfile(clues) {
    const directTypes = new Set(["at", "offset"]);
    const broadTypes = new Set(["atEnd", "positionParity", "before", "after"]);
    return {
      anchors: clues.filter(clue => clue.type === "at").length,
      direct: clues.filter(clue => directTypes.has(clue.type)).length,
      relational: clues.filter(clue => !directTypes.has(clue.type)).length,
      broad: clues.filter(clue => broadTypes.has(clue.type)).length,
      maxRelationDistance: clues.reduce((maximum, clue) => Math.max(maximum, Math.abs(Number(clue.delta || clue.distance || 0))), 0),
      maxAnchorDepth: clues.reduce((maximum, clue) => Math.max(maximum, Number(clue.anchorDepth) || 0), 0),
    };
  }

  function createPuzzle(layoutSeed, playerId, difficultyKey, variantKey = "") {
    const difficulty = normalizeDifficulty(difficultyKey);
    const variant = normalizeVariantKey(variantKey);
    const seed = composeSeed(layoutSeed, playerId, difficulty.key, variant);
    const solution = createSolution(layoutSeed, playerId, difficulty.key, variant);
    let best = null;

    for (let attempt = 0; attempt < 18; attempt += 1) {
      const clueRng = createRng(`${seed}:clues:attempt:${attempt}`);
      let clues = strongCluesForSolution(solution, clueRng);
      let weakenedCount = 0;
      const weakenOrder = shuffled(CARDS, clueRng);

      for (const owner of weakenOrder) {
        if (weakenedCount >= difficulty.weakenLimit) break;
        const clueIndex = clues.findIndex(clue => clue.owner === owner);
        for (const variant of weakenedVariants(clues[clueIndex], difficulty)) {
          const candidateClues = clues.map((clue, index) => index === clueIndex ? variant : clue);
          const candidateAudit = countSolutions(candidateClues, 2);
          if (candidateAudit.count === 1 && arraysEqual(candidateAudit.firstSolution || [], solution)) {
            clues = candidateClues;
            weakenedCount += 1;
            break;
          }
        }
      }

      const audit = countSolutions(clues, 2);
      const profile = clueProfile(clues);
      const candidate = { clues, audit, profile, weakenedCount, clueRng };
      const score = weakenedCount * 100 + profile.broad * (difficulty.key === "hard" ? 10 : 1);
      if (!best || score > best.score) best = { ...candidate, score };
      if (
        audit.count === 1
        && arraysEqual(audit.firstSolution || [], solution)
        && weakenedCount >= difficulty.minimumRelational
        && profile.anchors >= difficulty.minimumAnchors
      ) {
        best = { ...candidate, score };
        break;
      }
    }

    let clues = best?.clues || strongCluesForSolution(solution, createRng(`${seed}:fallback`));
    let audit = best?.audit || countSolutions(clues, 2);
    const clueRng = best?.clueRng || createRng(`${seed}:fallback:text`);
    if (audit.count !== 1 || !arraysEqual(audit.firstSolution || [], solution)) {
      clues = strongCluesForSolution(solution, createRng(`${seed}:strong-fallback`));
      audit = countSolutions(clues, 2);
    }
    clues = clues
      .map(clue => ({ ...clue, text: clueText(clue, clueRng) }))
      .sort((left, right) => left.owner - right.owner);
    const initialRng = createRng(`${seed}:initial-order`);
    let initialOrder = shuffled(CARDS, initialRng);
    if (arraysEqual(initialOrder, solution)) {
      [initialOrder[0], initialOrder[1]] = [initialOrder[1], initialOrder[0]];
    }

    return {
      version: VERSION,
      seed,
      layoutSeed: String(layoutSeed || "layout"),
      playerId: String(playerId || "player"),
      variantKey: variant,
      difficultyKey: difficulty.key,
      targetTier: difficulty.targetTier,
      targetItemId: difficulty.targetItemId,
      targetItemName: difficulty.targetItemName,
      dropRate: difficulty.dropRate,
      solution,
      clues,
      initialOrder,
      audit,
      profile: clueProfile(clues),
    };
  }

  function validatePuzzle(puzzle) {
    const difficulty = normalizeDifficulty(puzzle && puzzle.difficultyKey);
    const owners = new Set((puzzle && puzzle.clues || []).map(clue => clue.owner));
    const profile = clueProfile(puzzle && puzzle.clues || []);
    const checks = {
      cardCount: Array.isArray(puzzle && puzzle.solution) && puzzle.solution.length === CARD_COUNT,
      clueCount: Array.isArray(puzzle && puzzle.clues) && puzzle.clues.length === CARD_COUNT,
      uniqueOwners: owners.size === CARD_COUNT,
      solutionMatchesClues: orderSatisfies(puzzle && puzzle.solution || [], puzzle && puzzle.clues || []),
      uniqueSolution: Boolean(puzzle && puzzle.audit && puzzle.audit.count === 1 && !puzzle.audit.exhausted),
      auditedAnswerMatches: Boolean(puzzle && puzzle.audit && arraysEqual(puzzle.audit.firstSolution, puzzle.solution)),
      minimumRelationalCount: profile.relational >= difficulty.minimumRelational,
      minimumAnchorCount: profile.anchors >= difficulty.minimumAnchors,
      localRelationDistance: profile.maxRelationDistance <= 4,
      initialOrderScrambled: !arraysEqual(puzzle && puzzle.initialOrder || [], puzzle && puzzle.solution || []),
    };
    return {
      ok: Object.values(checks).every(Boolean),
      checks,
      profile,
    };
  }

  function createPuzzleSet(layoutSeed, playerId, variantKey = "") {
    const puzzles = Object.keys(DIFFICULTIES).map(key => createPuzzle(layoutSeed, playerId, key, variantKey));
    const signatures = new Set(puzzles.map(puzzle => puzzle.solution.join(",")));
    return {
      puzzles,
      answersDiffer: signatures.size === puzzles.length,
    };
  }

  function eclipseDropRateForTier(tier) {
    const normalized = Math.max(0, Math.min(3, Math.floor(Number(tier) || 0)));
    return [0.1, 0.2, 0.3, 0.4][normalized];
  }

  function rollEclipseDrop(tier, randomValue) {
    const rate = eclipseDropRateForTier(tier);
    const parsed = Number(randomValue);
    if (!Number.isFinite(parsed)) return false;
    const roll = Math.max(0, Math.min(1, parsed));
    return rate > 0 && roll < rate;
  }

  return Object.freeze({
    VERSION,
    CARD_COUNT,
    CARDS,
    DIFFICULTIES,
    arraysEqual,
    composeSeed,
    countSolutions,
    createPuzzle,
    createPuzzleSet,
    clueProfile,
    eclipseDropRateForTier,
    orderSatisfies,
    rollEclipseDrop,
    validatePuzzle,
  });
});
