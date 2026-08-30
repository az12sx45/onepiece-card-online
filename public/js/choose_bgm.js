(function (global) {
  const PHASE_ALIASES = Object.freeze({
    battle: ["battle_intro", "battle_loop"],
    battle_start: ["battle_intro"],
    battle_normal: ["battle_loop"],
    climax: ["battle_climax"],
    island: ["map", "event"],
    sea: ["map"],
    harbor: ["town", "map"],
    store: ["shop"],
    hospital: ["town", "event"],
    tavern: ["town", "event"],
  });

  function list(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean).map((item) => String(item).trim()).filter(Boolean);
    return String(value).split(/[,\s]+/).map((item) => item.trim()).filter(Boolean);
  }

  function unique(items) {
    return [...new Set(items.filter(Boolean))];
  }

  function lowerTags(items) {
    return unique(list(items).map((item) => item.toLowerCase()));
  }

  function expandPhases(context) {
    const phases = lowerTags(context.phase);
    if (!phases.length && context.battlePhase) {
      phases.push(`battle_${String(context.battlePhase).toLowerCase()}`);
    }
    if (!phases.length) phases.push("map");
    const expanded = [];
    phases.forEach((phase) => {
      expanded.push(phase);
      if (PHASE_ALIASES[phase]) expanded.push(...PHASE_ALIASES[phase]);
    });
    if (context.battlePhase === "climax") expanded.push("battle_climax");
    if (context.isForcedBattle) expanded.push("battle_intro", "battle_loop");
    if (context.isBoss && String(context.phase || "").startsWith("battle")) expanded.push("battle_climax");
    return unique(expanded);
  }

  function phaseMatches(meta, phases) {
    const metaPhases = lowerTags(meta.phase);
    return phases.some((phase) => metaPhases.includes(phase));
  }

  function desiredIntensity(context) {
    const phase = String(context.phase || "");
    const battlePhase = String(context.battlePhase || "");
    let desired = 2;
    if (phase.includes("battle")) desired = 3;
    if (phase === "danger" || context.dangerLevel >= 3) desired = Math.max(desired, 3);
    if (context.isForcedBattle || context.dangerLevel >= 4) desired = Math.max(desired, 4);
    if (context.isBoss || battlePhase === "climax" || context.dangerLevel >= 5) desired = 5;
    if (phase === "shop" || phase === "town") desired = Math.min(desired, 2);
    if (phase === "victory") desired = Math.min(Math.max(desired, 2), 4);
    return Math.max(1, Math.min(5, desired));
  }

  function isCounterattackContext(context, eventTags) {
    return Boolean(
      context.isCounterattack ||
      context.playerIsCounterattacking ||
      context.counterattack ||
      context.momentum === "counterattack" ||
      eventTags.includes("counterattack") ||
      eventTags.includes("comeback")
    );
  }

  function buildTagProfile(context) {
    const eventTags = lowerTags(context.eventTags);
    const tags = [
      ...lowerTags(context.sceneType),
      ...lowerTags(context.locationType),
      ...lowerTags(context.islandType),
      ...lowerTags(context.enemyType),
      ...lowerTags(context.environment),
      ...eventTags,
    ];
    const moodTags = lowerTags(context.storyMood);

    const battlePhase = String(context.battlePhase || "").toLowerCase();
    if (battlePhase) tags.push(battlePhase, `battle_${battlePhase}`);
    if (context.isBoss) tags.push("boss", "boss_appear", "boss_pressure", "threat", "danger");
    if (context.isDuel) tags.push("duel", "one_vs_one", "serious_battle");
    if (context.isForcedBattle) tags.push("forced_battle", "no_escape", "serious_fight");
    if (Number(context.dangerLevel || 0) >= 3) tags.push("danger", "threat", "trouble");
    if (Number(context.dangerLevel || 0) >= 4) tags.push("crisis", "urgent", "dangerous");
    if (Number(context.playerHpRate) < 0.3 && battlePhase === "climax") {
      tags.push("low_hp", "desperate", "comeback", "determination");
      moodTags.push("intense", "hopeful");
    }
    if (Number(context.enemyHpRate) < 0.35 && isCounterattackContext(context, eventTags)) {
      tags.push("counterattack", "heroic", "climax", "decisive_fight");
      moodTags.push("heroic", "powerful");
    }

    return {
      sceneTags: unique(tags.map((item) => String(item).toLowerCase())),
      moodTags: unique(moodTags.map((item) => String(item).toLowerCase())),
      characterTags: lowerTags(context.character),
      environmentTags: lowerTags(context.environment),
    };
  }

  function cooldownAllows(meta, context, now) {
    if (!meta.avoidOveruse) return true;
    const playedAtById = context.playedAtById || context.playHistory || {};
    const lastPlayedAt = Number(playedAtById[meta.id] || 0);
    return !lastPlayedAt || now - lastPlayedAt >= Number(meta.cooldownMs || 0);
  }

  function scoreOne(meta, context, phases, profile, now) {
    const metaScene = lowerTags(meta.sceneTags);
    const metaMood = lowerTags(meta.moodTags);
    const metaCharacters = lowerTags(meta.characterTags);
    const metaEnv = lowerTags(meta.environmentTags);
    const matchedTags = [];
    const scoreParts = [];
    let score = 0;

    const phaseMatchCount = phases.filter((phase) => lowerTags(meta.phase).includes(phase)).length;
    if (phaseMatchCount) {
      score += 35 + Math.min(12, (phaseMatchCount - 1) * 4);
      scoreParts.push(`階段符合 +${35 + Math.min(12, (phaseMatchCount - 1) * 4)}`);
    }

    const sceneMatches = profile.sceneTags.filter((tag) => metaScene.includes(tag));
    if (sceneMatches.length) {
      const value = sceneMatches.length * 8;
      score += value;
      matchedTags.push(...sceneMatches);
      scoreParts.push(`場景標籤 ${sceneMatches.join(", ")} +${value}`);
    }

    const moodMatches = profile.moodTags.filter((tag) => metaMood.includes(tag) || metaScene.includes(tag));
    if (moodMatches.length) {
      const value = moodMatches.length * 6;
      score += value;
      matchedTags.push(...moodMatches);
      scoreParts.push(`情緒標籤 ${moodMatches.join(", ")} +${value}`);
    }

    const characterMatches = profile.characterTags.filter((tag) => metaCharacters.includes(tag) || metaScene.includes(tag));
    if (characterMatches.length) {
      const value = Math.min(16, characterMatches.length * 12);
      score += value;
      matchedTags.push(...characterMatches);
      scoreParts.push(`角色符合 ${characterMatches.join(", ")} +${value}`);
    }

    const envMatches = profile.environmentTags.filter((tag) => metaEnv.includes(tag) || metaScene.includes(tag));
    if (envMatches.length) {
      const value = envMatches.length * 9;
      score += value;
      matchedTags.push(...envMatches);
      scoreParts.push(`環境符合 ${envMatches.join(", ")} +${value}`);
    }

    const targetIntensity = desiredIntensity(context);
    const intensityValue = Math.max(-8, 8 - Math.abs(Number(meta.intensity || 1) - targetIntensity) * 3);
    score += intensityValue;
    scoreParts.push(`強度貼近 ${targetIntensity}：${intensityValue >= 0 ? "+" : ""}${intensityValue}`);

    const priorityValue = Number(meta.priority || 50) / 10;
    score += priorityValue;
    scoreParts.push(`優先級 +${priorityValue.toFixed(1)}`);

    const recentlyPlayedIds = lowerTags(context.recentlyPlayedIds);
    if (recentlyPlayedIds.includes(String(meta.id).toLowerCase())) {
      const penalty = meta.avoidOveruse ? -30 : -14;
      score += penalty;
      scoreParts.push(`最近播過 ${penalty}`);
    }
    if (meta.avoidOveruse) {
      score -= 6;
      scoreParts.push("避免過度使用 -6");
    }
    if (!cooldownAllows(meta, context, now)) {
      score = -Infinity;
      scoreParts.push("冷卻中，排除");
    }

    return {
      meta,
      score,
      matchedTags: unique(matchedTags),
      reasonParts: scoreParts,
    };
  }

  function chooseBgm(context = {}) {
    const metadata = context.metadata || global.BGM_METADATA || [];
    const now = Number(context.now || Date.now());
    const force = Boolean(context.force);
    const phases = expandPhases(context);
    const allowIntensityFive = Boolean(context.isBoss || context.battlePhase === "climax" || phases.includes("battle_climax"));
    const lastPlayedBgmId = String(context.lastPlayedBgmId || "").toLowerCase();
    const profile = buildTagProfile(context);

    let candidates = metadata.filter((meta) => phaseMatches(meta, phases));
    if (!candidates.length) candidates = metadata.slice();
    candidates = candidates.filter((meta) => allowIntensityFive || Number(meta.intensity || 1) < 5);

    const filtered = candidates.filter((meta) => force || String(meta.id).toLowerCase() !== lastPlayedBgmId);
    const scored = (filtered.length ? filtered : candidates).map((meta) => scoreOne(meta, context, phases, profile, now));
    const viable = scored.filter((item) => Number.isFinite(item.score));
    const pool = viable.length ? viable : scored;
    pool.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if ((b.meta.priority || 0) !== (a.meta.priority || 0)) return (b.meta.priority || 0) - (a.meta.priority || 0);
      return String(a.meta.id).localeCompare(String(b.meta.id));
    });

    const best = pool[0];
    if (!best) return null;
    const reason = best.reasonParts.join("；");
    return {
      id: best.meta.id,
      filename: best.meta.filename,
      title: best.meta.title,
      reason: filtered.length ? reason : `${reason}；候選只剩上一首，建議維持目前播放`,
      matchedTags: best.matchedTags,
      intensity: best.meta.intensity,
      shouldLoop: Boolean(best.meta.loop),
      sourceContext: best.meta.sourceContext,
      score: Math.round(best.score * 100) / 100,
    };
  }

  global.chooseBgm = chooseBgm;
  global.BgmChooser = Object.freeze({
    chooseBgm,
    buildTagProfile,
    desiredIntensity,
    expandPhases,
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = global.BgmChooser;
  }
})(typeof window !== "undefined" ? window : globalThis);
