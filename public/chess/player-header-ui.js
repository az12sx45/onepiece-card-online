(() => {
  "use strict";

  const STORAGE_KEY = "battle-chess-player-profiles-v1";
  const DEFAULT_PROFILES = {
    local: {
      name: "玩家船長",
      rank: "新世界 III",
      record: "戰績 0勝・0敗",
      avatarUrl: "",
    },
    opponent: {
      name: "對手船長",
      rank: "新世界 III",
      record: "戰績 0勝・0敗",
      avatarUrl: "",
    },
  };
  const FACTIONS = {
    "straw-hat-pirates": "草帽海賊團",
    "onigashima-alliance": "鬼島聯軍",
  };

  const nodes = Object.fromEntries(
    ["local", "opponent"].map((side) => [
      side,
      {
        card: document.querySelector(`#player-card-${side}`),
        avatar: document.querySelector(`#player-${side}-avatar`),
        avatarFallback: document.querySelector(`#player-${side}-avatar-fallback`),
        name: document.querySelector(`#player-${side}-name`),
        rank: document.querySelector(`#player-${side}-rank`),
        record: document.querySelector(`#player-${side}-record`),
        speed: document.querySelector(`#player-${side}-speed`),
        faction: document.querySelector(`#player-${side}-faction`),
      },
    ])
  );

  if (!nodes.local.card || !nodes.opponent.card) return;

  const cloneDefaults = () => JSON.parse(JSON.stringify(DEFAULT_PROFILES));
  let profiles = cloneDefaults();

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && typeof saved === "object") {
      for (const side of ["local", "opponent"]) {
        profiles[side] = { ...profiles[side], ...(saved[side] || {}) };
      }
    }
  } catch {
    profiles = cloneDefaults();
  }

  const renderAvatar = (side) => {
    const node = nodes[side];
    const url = String(profiles[side].avatarUrl || "").trim();
    node.avatar.hidden = !url;
    node.avatarFallback.hidden = !!url;
    if (url) node.avatar.src = url;
    else node.avatar.removeAttribute("src");
  };

  const renderProfile = (side) => {
    const profile = profiles[side];
    nodes[side].name.textContent = profile.name;
    nodes[side].rank.textContent = profile.rank;
    nodes[side].record.textContent = profile.record;
    renderAvatar(side);
  };

  const persistProfiles = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    } catch {
      // The offline game remains usable when localStorage is unavailable.
    }
  };

  const setProfile = (side, patch) => {
    if (!nodes[side] || !patch || typeof patch !== "object") return false;
    profiles[side] = { ...profiles[side], ...patch };
    persistProfiles();
    renderProfile(side);
    return true;
  };

  for (const side of ["local", "opponent"]) {
    nodes[side].avatar.addEventListener("error", () => {
      nodes[side].avatar.hidden = true;
      nodes[side].avatarFallback.hidden = false;
    });
    renderProfile(side);
  }

  let lastStateSignature = "";
  const speedStats = {
    w: { totalMs: 0, moves: 0, currentMs: 0 },
    b: { totalMs: 0, moves: 0, currentMs: 0 },
  };
  let timingReady = false;
  let lastTick = performance.now();
  let lastHistoryLength = 0;
  let lastTimedColor = "w";
  let lastCanTime = false;
  let lastSetupSignature = "";
  let timingStarted = false;

  const formatAverage = (color) => {
    const stat = speedStats[color];
    if (!stat.moves) return "— 秒／步";
    const seconds = stat.totalMs / stat.moves / 1000;
    return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)} 秒／步`;
  };

  const renderMoveSpeeds = (state) => {
    const localColor = state?.setupColor || "w";
    const opponentColor = localColor === "w" ? "b" : "w";
    nodes.local.speed.textContent = formatAverage(localColor);
    nodes.opponent.speed.textContent = formatAverage(opponentColor);
  };

  const resetMoveSpeeds = (state, now) => {
    for (const color of ["w", "b"]) {
      speedStats[color].totalMs = 0;
      speedStats[color].moves = 0;
      speedStats[color].currentMs = 0;
    }
    timingReady = true;
    lastTick = now;
    lastHistoryLength = state.history?.length || 0;
    timingStarted = lastHistoryLength > 0;
    lastTimedColor = state.turn || "w";
    lastCanTime = timingStarted && !!state.ready && !state.locked && !state.gameOver;
    lastSetupSignature = `${state.setupFaction}|${state.setupColor}`;
    renderMoveSpeeds(state);
  };

  const updateMoveSpeeds = (state, now) => {
    const historyLength = state.history?.length || 0;
    const setupSignature = `${state.setupFaction}|${state.setupColor}`;
    if (
      !timingReady ||
      setupSignature !== lastSetupSignature ||
      historyLength < lastHistoryLength
    ) {
      resetMoveSpeeds(state, now);
      return;
    }

    const elapsed = Math.min(1000, Math.max(0, now - lastTick));
    if (timingStarted && lastCanTime && speedStats[lastTimedColor]) {
      speedStats[lastTimedColor].currentMs += elapsed;
    }

    if (historyLength > lastHistoryLength) {
      if (!timingStarted && lastHistoryLength === 0) {
        // The opening wait and White's first move are intentionally excluded.
        // Timing begins with Black's first turn after White completes move one.
        timingStarted = true;
        speedStats.w.currentMs = 0;
        speedStats.b.currentMs = 0;
        renderMoveSpeeds(state);
      } else {
        const movedColor = state.turn === "w" ? "b" : "w";
        const stat = speedStats[movedColor];
        stat.totalMs += stat.currentMs;
        stat.moves += 1;
        stat.currentMs = 0;
        renderMoveSpeeds(state);
      }
    }

    lastTick = now;
    lastHistoryLength = historyLength;
    lastTimedColor = state.turn || lastTimedColor;
    lastCanTime = timingStarted && !!state.ready && !state.locked && !state.gameOver;
  };

  const renderBattleState = (state) => {
    if (!state) return;
    const hostFaction = state.setupFaction || "straw-hat-pirates";
    const factionsByColor = window.__BATTLE_CHESS_FACTIONS_BY_COLOR__ || {};
    const whiteFaction = factionsByColor.w || hostFaction;
    const blackFaction = factionsByColor.b || (hostFaction === "straw-hat-pirates" ? "onigashima-alliance" : "straw-hat-pirates");
    const assignedColor = String(document.body.dataset.chessAssignedColor || "");
    const localColor = assignedColor === "w" || assignedColor === "b" ? assignedColor : (state.setupColor || "w");
    const opponentColor = localColor === "w" ? "b" : "w";
    const sideState = {
      local: { faction: localColor === "w" ? whiteFaction : blackFaction, color: localColor },
      opponent: { faction: opponentColor === "w" ? whiteFaction : blackFaction, color: opponentColor },
    };

    for (const side of ["local", "opponent"]) {
      const current = sideState[side];
      const colorLabel = current.color === "w" ? "白方" : "黑方";
      nodes[side].card.dataset.faction = current.faction;
      nodes[side].card.dataset.color = current.color;
      nodes[side].card.classList.toggle("is-turn", state.turn === current.color);
      nodes[side].faction.textContent = `${FACTIONS[current.faction] || current.faction}・${colorLabel}`;
    }
  };

  const pollBattleState = () => {
    const state = window.__BATTLE_CHESS__?.getState?.();
    if (state) {
      const now = performance.now();
      updateMoveSpeeds(state, now);
      const signature = [
        state.setupFaction,
        state.setupColor,
        state.turn,
        state.gameOver,
      ].join("|");
      if (signature !== lastStateSignature) {
        lastStateSignature = signature;
        renderBattleState(state);
      }
    }
    window.setTimeout(pollBattleState, 200);
  };

  window.__BATTLE_PLAYER_UI__ = {
    setProfile,
    getProfiles: () => JSON.parse(JSON.stringify(profiles)),
    resetProfiles: () => {
      profiles = cloneDefaults();
      persistProfiles();
      renderProfile("local");
      renderProfile("opponent");
    },
  };

  pollBattleState();
})();
