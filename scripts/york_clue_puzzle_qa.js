"use strict";

const path = require("path");
const puzzleApi = require(path.resolve(__dirname, "../public/js/board_york_clue_puzzle.js"));

const seedCount = Math.max(1, Number(process.argv[2]) || 1000);
const difficultyKeys = Object.keys(puzzleApi.DIFFICULTIES);
const failures = [];
const eclipseBoundaryCases = [
  { tier: 0, roll: 0.099, expected: true },
  { tier: 0, roll: 0.1, expected: false },
  { tier: 1, roll: 0.199, expected: true },
  { tier: 1, roll: 0.2, expected: false },
  { tier: 2, roll: 0.299, expected: true },
  { tier: 2, roll: 0.3, expected: false },
  { tier: 3, roll: 0.399, expected: true },
  { tier: 3, roll: 0.4, expected: false },
];
eclipseBoundaryCases.forEach(testCase => {
  const actual = puzzleApi.rollEclipseDrop(testCase.tier, testCase.roll);
  if (actual !== testCase.expected) failures.push({ ...testCase, actual, issue: "eclipse_drop_boundary" });
});
const totals = Object.fromEntries(difficultyKeys.map(key => [key, {
  puzzles: 0,
  maxNodes: 0,
  maxAnchorDepth: 0,
  maxRelationDistance: 0,
  anchorCounts: new Set(),
  broadCounts: new Set(),
  directCounts: new Set(),
  relationalCounts: new Set(),
}])) ;

for (let index = 0; index < seedCount; index += 1) {
  const layoutSeed = `qa-layout-${index}`;
  const playerId = `qa-player-${index % 23}`;
  const first = puzzleApi.createPuzzleSet(layoutSeed, playerId);
  const second = puzzleApi.createPuzzleSet(layoutSeed, playerId);

  if (index < Math.min(seedCount, 24)) {
    const variantKey = `tier3-practice-${index}`;
    const variantFirst = puzzleApi.createPuzzleSet(layoutSeed, playerId, variantKey);
    const variantRepeat = puzzleApi.createPuzzleSet(layoutSeed, playerId, variantKey);
    const variantNext = puzzleApi.createPuzzleSet(layoutSeed, playerId, `${variantKey}-next`);
    if (JSON.stringify(variantFirst) !== JSON.stringify(variantRepeat)) {
      failures.push({ index, issue: "practice_variant_unstable" });
    }
    if (variantFirst.puzzles.every((puzzle, difficultyIndex) => (
      puzzle.solution.join(",") === variantNext.puzzles[difficultyIndex].solution.join(",")
    ))) {
      failures.push({ index, issue: "practice_variant_did_not_change_question" });
    }
    variantFirst.puzzles.forEach(puzzle => {
      const validation = puzzleApi.validatePuzzle(puzzle);
      if (!validation.ok || puzzle.variantKey !== variantKey) {
        failures.push({ index, difficulty: puzzle.difficultyKey, issue: "practice_variant_validation_failed", checks: validation.checks });
      }
    });
  }

  if (!first.answersDiffer) {
    failures.push({ index, issue: "difficulty_answers_collide" });
  }

  first.puzzles.forEach((puzzle, difficultyIndex) => {
    const validation = puzzleApi.validatePuzzle(puzzle);
    const repeat = second.puzzles[difficultyIndex];
    const stable = JSON.stringify(puzzle) === JSON.stringify(repeat);
    if (!validation.ok || !stable) {
      failures.push({
        index,
        difficulty: puzzle.difficultyKey,
        issue: !stable ? "unstable_seed" : "validation_failed",
        checks: validation.checks,
      });
    }
    if ((puzzle.clues || []).some(clue => /旁邊|我的左鄰|我的右鄰|往[左右]數/.test(String(clue.text || "")))) {
      failures.push({ index, difficulty: puzzle.difficultyKey, issue: "ambiguous_relation_wording" });
    }
    const total = totals[puzzle.difficultyKey];
    total.puzzles += 1;
    total.maxNodes = Math.max(total.maxNodes, puzzle.audit.nodes);
    total.maxAnchorDepth = Math.max(total.maxAnchorDepth, puzzle.profile.maxAnchorDepth);
    total.maxRelationDistance = Math.max(total.maxRelationDistance, puzzle.profile.maxRelationDistance);
    total.anchorCounts.add(puzzle.profile.anchors);
    total.broadCounts.add(puzzle.profile.broad);
    total.directCounts.add(puzzle.profile.direct);
    total.relationalCounts.add(puzzle.profile.relational);
  });
}

const report = {
  ok: failures.length === 0,
  generatorVersion: puzzleApi.VERSION,
  seeds: seedCount,
  puzzles: seedCount * difficultyKeys.length,
  requirements: {
    stablePerSeed: failures.every(failure => failure.issue !== "unstable_seed"),
    uniqueSolutions: failures.every(failure => failure.issue !== "validation_failed"),
    differentAnswersAcrossDifficulties: failures.every(failure => failure.issue !== "difficulty_answers_collide"),
    demoStyleNearbyRelations: failures.every(failure => failure.issue !== "validation_failed"),
    difficultyMinimumRelations: failures.every(failure => failure.issue !== "validation_failed"),
    readableAnchors: failures.every(failure => failure.issue !== "validation_failed"),
    unifiedRelationWording: failures.every(failure => failure.issue !== "ambiguous_relation_wording"),
    tier3PracticeVariantStable: failures.every(failure => failure.issue !== "practice_variant_unstable"),
    tier3PracticeQuestionChanges: failures.every(failure => failure.issue !== "practice_variant_did_not_change_question"),
    tier3PracticeUniqueSolutions: failures.every(failure => failure.issue !== "practice_variant_validation_failed"),
    eclipseDropBoundaries: failures.every(failure => failure.issue !== "eclipse_drop_boundary"),
  },
  totals: Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, {
    puzzles: value.puzzles,
    maxNodes: value.maxNodes,
    maxAnchorDepth: value.maxAnchorDepth,
    maxRelationDistance: value.maxRelationDistance,
    anchorCounts: [...value.anchorCounts].sort((left, right) => left - right),
    broadCounts: [...value.broadCounts].sort((left, right) => left - right),
    directCounts: [...value.directCounts].sort((left, right) => left - right),
    relationalCounts: [...value.relationalCounts].sort((left, right) => left - right),
  }])),
  failures: failures.slice(0, 20),
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
