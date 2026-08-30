(function (global) {
  let parentManager = null;
  try {
    parentManager = global.parent && global.parent !== global ? global.parent.BgmManager : null;
  } catch (_error) {
    parentManager = null;
  }
  if (parentManager) {
    global.BgmManager = parentManager;
    return;
  }

  const DEFAULT_BASE_PATH = "audio/board_game/bgm_new/";
  const DEFAULT_FADE_MS = 1200;
  const DEFAULT_MIN_HOLD_MS = 25000;
  const BATTLE_MIN_HOLD_MS = 60000;
  const CLIMAX_MIN_HOLD_MS = 45000;
  const HISTORY_LIMIT = 8;

  function storageGet(key, fallback) {
    try {
      const value = global.localStorage?.getItem(key);
      return value == null ? fallback : value;
    } catch (_error) {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      global.localStorage?.setItem(key, value);
    } catch (_error) {
      // Audio preferences are optional.
    }
  }

  const state = {
    basePath: DEFAULT_BASE_PATH,
    enabled: storageGet("board_bgm_enabled", "1") !== "0",
    unlocked: false,
    volume: Math.max(0, Math.min(1, Number(storageGet("board_bgm_volume", "0.34")))),
    currentAudio: null,
    currentChoice: null,
    currentContextKey: "",
    currentScopeKey: "",
    currentPhaseGroup: "",
    currentStartedAt: 0,
    pendingContext: null,
    recentlyPlayedIds: [],
    playedAtById: {},
    climaxSwitchedScopes: {},
    switchLocks: new Set(),
    fadeToken: 0,
  };

  function encodeFilePath(filename) {
    return String(filename || "").split("/").map((part) => encodeURIComponent(part)).join("/");
  }

  function srcFor(filename) {
    return `${state.basePath}${encodeFilePath(filename)}`;
  }

  function contextKey(context = {}) {
    return JSON.stringify({
      phase: context.phase || "",
      sceneType: context.sceneType || "",
      locationType: context.locationType || "",
      islandType: context.islandType || "",
      character: context.character || "",
      enemyType: context.enemyType || "",
      isBoss: Boolean(context.isBoss),
      isForcedBattle: Boolean(context.isForcedBattle),
      isDuel: Boolean(context.isDuel),
      battlePhase: context.battlePhase || "",
      dangerLevel: Number(context.dangerLevel || 0),
      environment: context.environment || "",
      eventTags: context.eventTags || [],
      storyMood: context.storyMood || "",
    });
  }

  function phaseGroup(context = {}) {
    const phase = String(context.phase || "");
    if (phase.startsWith("battle_")) return "battle";
    if (phase === "danger" || phase === "escape") return "danger";
    return phase || String(context.sceneType || "map");
  }

  function stableScopeKey(context = {}) {
    if (context.musicScope) return String(context.musicScope);
    const group = phaseGroup(context);
    if (group === "battle") {
      return `battle:${context.battleId || context.locationId || context.islandId || context.enemyType || "current"}`;
    }
    if (group === "map") return `map:${context.locationType || ""}:${context.environment || ""}`;
    return `${group}:${context.locationType || ""}:${context.islandType || ""}:${context.environment || ""}`;
  }

  function isClimaxContext(context = {}) {
    return context.phase === "battle_climax" || context.battlePhase === "climax";
  }

  function minHoldMs(context = {}, options = {}) {
    if (options.minHoldMs != null) return Number(options.minHoldMs);
    if (context.minBgmHoldMs != null) return Number(context.minBgmHoldMs);
    if (phaseGroup(context) === "battle") return BATTLE_MIN_HOLD_MS;
    return DEFAULT_MIN_HOLD_MS;
  }

  function shouldHoldCurrent(context = {}, options = {}, now = Date.now()) {
    if (!state.currentChoice) return false;
    if (state.switchLocks.size && !options.force) return true;
    const nextScope = stableScopeKey(context);
    if (nextScope !== state.currentScopeKey) return false;
    if (options.forceRetune || context.forceRetune) return false;
    const elapsed = now - Number(state.currentStartedAt || 0);
    const sameBattleScope = phaseGroup(context) === "battle" && state.currentPhaseGroup === "battle";
    const canClimaxSwitch = sameBattleScope
      && isClimaxContext(context)
      && !state.climaxSwitchedScopes[nextScope]
      && elapsed >= CLIMAX_MIN_HOLD_MS;
    if (canClimaxSwitch) return false;
    if (elapsed < minHoldMs(context, options)) return true;
    return sameBattleScope;
  }

  function makeAudio(choice) {
    const audio = new Audio();
    audio.src = srcFor(choice.filename);
    audio.loop = choice.shouldLoop !== false;
    audio.preload = "auto";
    audio.volume = 0;
    return audio;
  }

  function rememberPlayed(id, now = Date.now()) {
    state.playedAtById[id] = now;
    state.recentlyPlayedIds = [id, ...state.recentlyPlayedIds.filter((item) => item !== id)].slice(0, HISTORY_LIMIT);
  }

  function fadeAudio(audio, targetVolume, durationMs = DEFAULT_FADE_MS, token = state.fadeToken) {
    if (!audio) return Promise.resolve();
    const clampVolume = (value) => Math.max(0, Math.min(1, Number(value || 0)));
    const from = clampVolume(audio.volume);
    const to = Math.max(0, Math.min(1, Number(targetVolume || 0)));
    const duration = Math.max(0, Number(durationMs || 0));
    if (!duration) {
      audio.volume = to;
      return Promise.resolve();
    }
    const start = performance.now();
    return new Promise((resolve) => {
      function tick(now) {
        if (token !== state.fadeToken) {
          resolve();
          return;
        }
        const progress = Math.min(1, (now - start) / duration);
        audio.volume = clampVolume(from + (to - from) * progress);
        if (progress < 1) requestAnimationFrame(tick);
        else resolve();
      }
      requestAnimationFrame(tick);
    });
  }

  function unlock() {
    state.unlocked = true;
    if (state.enabled && state.pendingContext) {
      const pending = state.pendingContext;
      state.pendingContext = null;
      chooseAndPlay(pending.context, pending.options);
    }
  }

  ["pointerdown", "keydown", "touchstart"].forEach((eventName) => {
    global.addEventListener(eventName, unlock, { once: true, capture: true });
  });

  async function crossfade(choice, options = {}) {
    if (!choice) return null;
    const fadeMs = Number(options.fadeMs ?? DEFAULT_FADE_MS);
    if (state.currentChoice?.id === choice.id && state.currentAudio && !options.restart) {
      if (state.currentAudio.paused && state.enabled && state.unlocked) {
        try {
          await state.currentAudio.play();
        } catch (_error) {
          state.unlocked = false;
        }
      }
      return choice;
    }

    const oldAudio = state.currentAudio;
    const nextAudio = makeAudio(choice);
    state.fadeToken += 1;
    const token = state.fadeToken;
    state.currentAudio = nextAudio;
    state.currentChoice = choice;

    try {
      await nextAudio.play();
    } catch (_error) {
      state.unlocked = false;
      state.pendingContext = state.pendingContext || null;
      return choice;
    }

    rememberPlayed(choice.id);
    await Promise.all([
      fadeAudio(nextAudio, state.volume, fadeMs, token),
      fadeAudio(oldAudio, 0, fadeMs, token),
    ]);
    if (oldAudio && oldAudio !== nextAudio) {
      oldAudio.pause();
      oldAudio.removeAttribute("src");
      try { oldAudio.load(); } catch (_error) {}
    }
    return choice;
  }

  function chooseAndPlay(context = {}, options = {}) {
    const now = Date.now();
    const key = contextKey(context);
    const nextScopeKey = stableScopeKey(context);
    const nextPhaseGroup = phaseGroup(context);
    if (!options.force && shouldHoldCurrent(context, options, now)) {
      state.currentContextKey = key;
      return state.currentChoice;
    }
    if (!options.force && key === state.currentContextKey && state.currentChoice) return state.currentChoice;
    state.currentContextKey = key;

    const choose = global.chooseBgm;
    if (typeof choose !== "function") return null;
    const enrichedContext = {
      ...context,
      force: Boolean(options.force || context.force),
      lastPlayedBgmId: state.currentChoice?.id || context.lastPlayedBgmId || "",
      recentlyPlayedIds: state.recentlyPlayedIds,
      playedAtById: state.playedAtById,
    };
    const choice = choose(enrichedContext);
    if (!choice) return null;
    if (state.currentChoice?.id !== choice.id || state.currentScopeKey !== nextScopeKey || options.restart) {
      state.currentStartedAt = now;
    }
    state.currentScopeKey = nextScopeKey;
    state.currentPhaseGroup = nextPhaseGroup;
    if (nextPhaseGroup === "battle" && isClimaxContext(context)) {
      state.climaxSwitchedScopes[nextScopeKey] = now;
    }

    if (!state.enabled) return choice;
    if (!state.unlocked) {
      state.pendingContext = { context, options };
      return choice;
    }
    void crossfade(choice, options);
    return choice;
  }

  async function fadeOut(durationMs = DEFAULT_FADE_MS) {
    if (!state.currentAudio) return;
    state.fadeToken += 1;
    const token = state.fadeToken;
    const audio = state.currentAudio;
    await fadeAudio(audio, 0, durationMs, token);
    if (state.currentAudio === audio) audio.pause();
  }

  async function fadeIn(durationMs = DEFAULT_FADE_MS) {
    if (!state.currentAudio) return;
    state.fadeToken += 1;
    const token = state.fadeToken;
    try {
      await state.currentAudio.play();
      await fadeAudio(state.currentAudio, state.volume, durationMs, token);
    } catch (_error) {
      state.unlocked = false;
    }
  }

  function stop(options = {}) {
    const durationMs = Number(options.fadeMs ?? 500);
    void fadeOut(durationMs);
    state.currentChoice = null;
    state.currentContextKey = "";
    state.currentScopeKey = "";
    state.currentPhaseGroup = "";
  }

  function setEnabled(enabled) {
    state.enabled = Boolean(enabled);
    storageSet("board_bgm_enabled", state.enabled ? "1" : "0");
    if (!state.enabled) stop({ fadeMs: 500 });
    else unlock();
  }

  function setVolume(value) {
    state.volume = Math.max(0, Math.min(1, Number(value)));
    storageSet("board_bgm_volume", String(state.volume));
    if (state.currentAudio) state.currentAudio.volume = state.volume;
  }

  global.BgmManager = Object.freeze({
    chooseAndPlay,
    playForContext: chooseAndPlay,
    crossfade,
    fadeOut,
    fadeIn,
    stop,
    setEnabled,
    setVolume,
    setBasePath(basePath) {
      state.basePath = String(basePath || DEFAULT_BASE_PATH);
    },
    lockAutoSwitch(reason = "lock") {
      const key = String(reason || "lock");
      state.switchLocks.add(key);
      return () => {
        state.switchLocks.delete(key);
      };
    },
    unlockAutoSwitch(reason = "lock") {
      state.switchLocks.delete(String(reason || "lock"));
    },
    status() {
      return {
        enabled: state.enabled,
        unlocked: state.unlocked,
        volume: state.volume,
        currentChoice: state.currentChoice,
        currentContextKey: state.currentContextKey,
        currentScopeKey: state.currentScopeKey,
        currentPhaseGroup: state.currentPhaseGroup,
        currentStartedAt: state.currentStartedAt,
        switchLocks: [...state.switchLocks],
        recentlyPlayedIds: state.recentlyPlayedIds.slice(),
        playedAtById: { ...state.playedAtById },
      };
    },
  });

  global.boardBgmContext = (context, options) => global.BgmManager.chooseAndPlay(context, options);
  global.boardBgmStop = () => global.BgmManager.stop({ fadeMs: 800 });
  global.boardBgmMute = () => global.BgmManager.setEnabled(false);
  global.boardBgmUnmute = () => global.BgmManager.setEnabled(true);
})(typeof window !== "undefined" ? window : globalThis);
