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
  const DEFAULT_FADE_MS = 2800;
  const DEFAULT_MIN_HOLD_MS = 45000;
  const BATTLE_MIN_HOLD_MS = 90000;
  const CLIMAX_MIN_HOLD_MS = 45000;
  const AUDIO_READY_TIMEOUT_MS = 12000;
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
    desiredRequest: null,
    queuedRequest: null,
    requestSerial: 0,
    transitionTimer: null,
    transitionTimerKey: "",
    transitionTimerDueAt: 0,
    holdTimer: null,
    inFlightAudio: null,
    inFlightRequest: null,
    recentlyPlayedIds: [],
    playedAtById: {},
    climaxSwitchedScopes: {},
    switchLocks: new Set(),
    audioFocus: new Map(),
    audioFocusSerial: 0,
  };

  const audioFadeTokens = new WeakMap();
  const audioLoopCleanups = new WeakMap();

  function clamp(value, min = 0, max = 1) {
    return Math.max(min, Math.min(max, Number(value || 0)));
  }

  function nowMs() {
    return Date.now();
  }

  function frameNow() {
    return global.performance?.now?.() ?? nowMs();
  }

  function nextFrame(callback) {
    if (typeof global.requestAnimationFrame === "function") return global.requestAnimationFrame(callback);
    return global.setTimeout(() => callback(frameNow()), 16);
  }

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
      enemyType: context.enemyType || "",
      isBoss: Boolean(context.isBoss),
      isForcedBattle: Boolean(context.isForcedBattle),
      isDuel: Boolean(context.isDuel),
      battlePhase: context.battlePhase || "",
      dangerLevel: Number(context.dangerLevel || 0),
      environment: context.environment || "",
      eventTags: context.eventTags || [],
      storyMood: context.storyMood || "",
      musicScope: context.musicScope || "",
      preferredBgmIds: context.preferredBgmIds || [],
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
    if (options.minHoldMs != null) return Math.max(0, Number(options.minHoldMs));
    if (context.minBgmHoldMs != null) return Math.max(0, Number(context.minBgmHoldMs));
    if (phaseGroup(context) === "battle") return BATTLE_MIN_HOLD_MS;
    return DEFAULT_MIN_HOLD_MS;
  }

  function normalizedOptions(options = {}) {
    const legacyImmediate = options.force === true;
    return {
      ...options,
      transition: options.transition || (legacyImmediate ? "immediate" : "defer"),
      transitionDelayMs: Math.max(0, Number(options.transitionDelayMs ?? options.deferMs ?? 0)),
      fadeMs: Math.max(0, Number(options.fadeMs ?? DEFAULT_FADE_MS)),
      restart: Boolean(options.restart),
      forceRetune: Boolean(options.forceRetune),
      ignoreLock: Boolean(options.ignoreLock),
    };
  }

  function makeRequest(context = {}, options = {}) {
    const normalized = normalizedOptions(options);
    return {
      serial: ++state.requestSerial,
      context: { ...context },
      options: normalized,
      key: contextKey(context),
      scopeKey: stableScopeKey(context),
      phaseGroup: phaseGroup(context),
      requestedAt: nowMs(),
    };
  }

  function sameRequestScene(a, b) {
    return Boolean(a && b && a.key === b.key && a.scopeKey === b.scopeKey);
  }

  function activeFocusRatio() {
    let ratio = 1;
    state.audioFocus.forEach((entry) => {
      ratio = Math.min(ratio, clamp(entry.volumeRatio, 0, 1));
    });
    return ratio;
  }

  function gainRatio(choice = state.currentChoice) {
    return Math.pow(10, Number(choice?.gainDb || 0) / 20);
  }

  function targetVolume(choice = state.currentChoice) {
    return clamp(state.volume * gainRatio(choice) * activeFocusRatio());
  }

  function makeAudio(choice) {
    const AudioClass = global.Audio || (typeof Audio !== "undefined" ? Audio : null);
    if (!AudioClass) throw new Error("Audio API unavailable");
    const audio = new AudioClass();
    audio.preload = "auto";
    audio.loop = false;
    audio.volume = 0;
    audio.src = srcFor(choice.filename);
    return audio;
  }

  function rememberPlayed(id, now = nowMs()) {
    state.playedAtById[id] = now;
    state.recentlyPlayedIds = [id, ...state.recentlyPlayedIds.filter((item) => item !== id)].slice(0, HISTORY_LIMIT);
  }

  function fadeAudio(audio, requestedVolume, durationMs = DEFAULT_FADE_MS) {
    if (!audio) return Promise.resolve(false);
    const token = Number(audioFadeTokens.get(audio) || 0) + 1;
    audioFadeTokens.set(audio, token);
    const from = clamp(audio.volume);
    const to = clamp(requestedVolume);
    const duration = Math.max(0, Number(durationMs || 0));
    if (!duration) {
      try { audio.volume = to; } catch (_error) {}
      return Promise.resolve(true);
    }
    const start = frameNow();
    return new Promise((resolve) => {
      const tick = (time) => {
        if (audioFadeTokens.get(audio) !== token) {
          resolve(false);
          return;
        }
        const progress = Math.min(1, (time - start) / duration);
        try { audio.volume = clamp(from + (to - from) * progress); } catch (_error) {}
        if (progress < 1) nextFrame(tick);
        else resolve(true);
      };
      nextFrame(tick);
    });
  }

  function stopAudio(audio, clearSource = true) {
    if (!audio) return;
    audioFadeTokens.set(audio, Number(audioFadeTokens.get(audio) || 0) + 1);
    const cleanupLoop = audioLoopCleanups.get(audio);
    if (cleanupLoop) cleanupLoop();
    audioLoopCleanups.delete(audio);
    try { audio.pause(); } catch (_error) {}
    if (!clearSource) return;
    try { audio.removeAttribute("src"); } catch (_error) {}
    try { audio.load(); } catch (_error) {}
  }

  function installCueLoop(audio, choice) {
    const cueIn = Math.max(0, Number(choice?.cueInSec || 0));
    const cueOut = Math.max(0, Number(choice?.cueOutSec || 0));
    const shouldLoop = choice?.shouldLoop !== false;
    if (!shouldLoop && !cueOut) return;
    let restarting = false;
    let active = true;
    const restartAtCue = async (smooth = true) => {
      if (!shouldLoop || restarting || !active) return;
      restarting = true;
      if (smooth) {
        const faded = await fadeAudio(audio, 0, 480);
        if (!faded || !active) {
          restarting = false;
          return;
        }
      }
      try { audio.currentTime = cueIn; } catch (_error) {}
      const playResult = audio.play?.();
      if (playResult?.catch) {
        try { await playResult; } catch (_error) {}
      }
      if (active) await fadeAudio(audio, targetVolume(choice), smooth ? 620 : 260);
      restarting = false;
    };
    const onTimeUpdate = () => {
      const fadeStart = Math.max(cueIn + 0.25, cueOut - 0.72);
      if (cueOut > cueIn && Number(audio.currentTime || 0) >= fadeStart) void restartAtCue(true);
    };
    const onEnded = () => void restartAtCue(false);
    audio.addEventListener?.("timeupdate", onTimeUpdate);
    audio.addEventListener?.("ended", onEnded);
    audioLoopCleanups.set(audio, () => {
      active = false;
      audio.removeEventListener?.("timeupdate", onTimeUpdate);
      audio.removeEventListener?.("ended", onEnded);
    });
  }

  function waitForMetadata(audio) {
    if (Number(audio.readyState || 0) >= 1) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let finished = false;
      const finish = (error) => {
        if (finished) return;
        finished = true;
        global.clearTimeout(timeoutId);
        audio.removeEventListener?.("loadedmetadata", onReady);
        audio.removeEventListener?.("canplay", onReady);
        audio.removeEventListener?.("error", onError);
        if (error) reject(error);
        else resolve();
      };
      const onReady = () => finish();
      const onError = () => finish(new Error("BGM audio load failed"));
      const timeoutId = global.setTimeout(() => finish(new Error("BGM audio load timeout")), AUDIO_READY_TIMEOUT_MS);
      audio.addEventListener?.("loadedmetadata", onReady);
      audio.addEventListener?.("canplay", onReady);
      audio.addEventListener?.("error", onError);
      try { audio.load?.(); } catch (_error) {}
    });
  }

  function seekToCue(audio, choice) {
    const cueIn = Math.max(0, Number(choice?.cueInSec || 0));
    if (!cueIn) return;
    const duration = Number(audio.duration || 0);
    if (Number.isFinite(duration) && duration > 0 && cueIn >= duration) return;
    try { audio.currentTime = cueIn; } catch (_error) {}
  }

  function clearTransitionTimer() {
    if (state.transitionTimer != null) global.clearTimeout(state.transitionTimer);
    state.transitionTimer = null;
    state.transitionTimerKey = "";
    state.transitionTimerDueAt = 0;
  }

  function clearHoldTimer() {
    if (state.holdTimer != null) global.clearTimeout(state.holdTimer);
    state.holdTimer = null;
  }

  function choiceForRequest(request) {
    const choose = global.chooseBgm;
    if (typeof choose !== "function") return null;
    return choose({
      ...request.context,
      forceRetune: Boolean(request.options.forceRetune || request.context.forceRetune),
      lastPlayedBgmId: state.currentChoice?.id || request.context.lastPlayedBgmId || "",
      recentlyPlayedIds: state.recentlyPlayedIds,
      playedAtById: state.playedAtById,
    });
  }

  function requestIsCurrent(request) {
    return Boolean(state.desiredRequest && (state.desiredRequest.serial === request.serial || sameRequestScene(state.desiredRequest, request)));
  }

  function commitRequestContext(request, choice, startedAt = state.currentStartedAt) {
    const activeRequest = sameRequestScene(state.desiredRequest, request) ? state.desiredRequest : request;
    state.currentChoice = choice;
    state.currentContextKey = activeRequest.key;
    state.currentScopeKey = activeRequest.scopeKey;
    state.currentPhaseGroup = activeRequest.phaseGroup;
    state.currentStartedAt = startedAt;
    if (activeRequest.phaseGroup === "battle" && isClimaxContext(activeRequest.context)) {
      state.climaxSwitchedScopes[activeRequest.scopeKey] = nowMs();
    }
    if (sameRequestScene(state.queuedRequest, activeRequest)) state.queuedRequest = null;
    if (sameRequestScene(state.pendingContext, activeRequest)) state.pendingContext = null;
  }

  async function performTransition(choice, request) {
    if (!choice || !request) return null;
    if (state.currentChoice?.id === choice.id && state.currentAudio && !request.options.restart) {
      commitRequestContext(request, state.currentChoice);
      if (state.currentAudio.paused && state.enabled && state.unlocked) {
        try { await state.currentAudio.play(); } catch (_error) { state.unlocked = false; state.pendingContext = request; }
      }
      void fadeAudio(state.currentAudio, targetVolume(state.currentChoice), request.options.fadeMs);
      return state.currentChoice;
    }

    if (state.inFlightAudio && state.inFlightRequest && !sameRequestScene(state.inFlightRequest, request)) {
      stopAudio(state.inFlightAudio);
      state.inFlightAudio = null;
      state.inFlightRequest = null;
    }

    let nextAudio;
    try {
      nextAudio = makeAudio(choice);
    } catch (_error) {
      return state.currentChoice;
    }
    state.inFlightAudio = nextAudio;
    state.inFlightRequest = request;

    try {
      await waitForMetadata(nextAudio);
      seekToCue(nextAudio, choice);
      installCueLoop(nextAudio, choice);
      await nextAudio.play();
    } catch (_error) {
      if (state.inFlightAudio === nextAudio) {
        state.inFlightAudio = null;
        state.inFlightRequest = null;
      }
      stopAudio(nextAudio);
      if (requestIsCurrent(request)) {
        state.unlocked = false;
        state.pendingContext = state.desiredRequest || request;
      }
      return state.currentChoice;
    }

    if (!requestIsCurrent(request) || !state.enabled || state.switchLocks.size && !request.options.ignoreLock) {
      if (requestIsCurrent(request) && state.switchLocks.size && !request.options.ignoreLock) {
        state.queuedRequest = state.desiredRequest || request;
      }
      stopAudio(nextAudio);
      if (state.inFlightAudio === nextAudio) {
        state.inFlightAudio = null;
        state.inFlightRequest = null;
      }
      return state.currentChoice;
    }

    const oldAudio = state.currentAudio;
    state.currentAudio = nextAudio;
    state.inFlightAudio = null;
    state.inFlightRequest = null;
    commitRequestContext(request, choice, nowMs());
    rememberPlayed(choice.id);

    const fadeMs = request.options.fadeMs;
    void fadeAudio(nextAudio, targetVolume(choice), fadeMs);
    if (oldAudio && oldAudio !== nextAudio) {
      void fadeAudio(oldAudio, 0, fadeMs).then(() => {
        if (state.currentAudio !== oldAudio) stopAudio(oldAudio);
      });
    }
    return choice;
  }

  function holdWaitMs(request, now = nowMs()) {
    if (!state.currentChoice || request.options.forceRetune || request.context.forceRetune) return 0;
    if (request.options.transition === "immediate") return 0;
    if (request.scopeKey !== state.currentScopeKey) return 0;
    const elapsed = now - Number(state.currentStartedAt || 0);
    const sameBattleScope = request.phaseGroup === "battle" && state.currentPhaseGroup === "battle";
    if (sameBattleScope) {
      if (!isClimaxContext(request.context) || state.climaxSwitchedScopes[request.scopeKey]) return -1;
      return Math.max(0, CLIMAX_MIN_HOLD_MS - elapsed);
    }
    return Math.max(0, minHoldMs(request.context, request.options) - elapsed);
  }

  function processRequest(request) {
    if (!request || !requestIsCurrent(request)) return state.currentChoice;
    if (state.switchLocks.size && !request.options.ignoreLock) {
      state.queuedRequest = request;
      return state.currentChoice;
    }
    if (!state.enabled || !state.unlocked) {
      state.pendingContext = request;
      return choiceForRequest(request) || state.currentChoice;
    }
    if (state.inFlightRequest && sameRequestScene(state.inFlightRequest, request)) {
      return choiceForRequest(request) || state.currentChoice;
    }

    const waitMs = holdWaitMs(request);
    if (waitMs !== 0) {
      state.queuedRequest = request;
      clearHoldTimer();
      if (waitMs > 0) {
        state.holdTimer = global.setTimeout(() => {
          state.holdTimer = null;
          const latest = state.queuedRequest || state.desiredRequest;
          if (latest && requestIsCurrent(latest)) processRequest(latest);
        }, waitMs + 20);
      }
      return state.currentChoice;
    }

    clearHoldTimer();
    const choice = choiceForRequest(request);
    if (!choice) return state.currentChoice;
    if (state.currentChoice?.id === choice.id && state.currentAudio && !request.options.restart) {
      commitRequestContext(request, state.currentChoice);
      void fadeAudio(state.currentAudio, targetVolume(state.currentChoice), request.options.fadeMs);
      return state.currentChoice;
    }
    void performTransition(choice, request);
    return choice;
  }

  function scheduleDelayedRequest(request) {
    const delayMs = request.options.transitionDelayMs;
    if (!state.currentChoice || !delayMs || request.options.transition === "immediate") return processRequest(request);
    state.queuedRequest = request;
    const timerKey = `${request.key}|${request.scopeKey}`;
    if (state.transitionTimer != null && state.transitionTimerKey === timerKey) return state.currentChoice;
    clearTransitionTimer();
    state.transitionTimerKey = timerKey;
    state.transitionTimerDueAt = nowMs() + delayMs;
    state.transitionTimer = global.setTimeout(() => {
      state.transitionTimer = null;
      state.transitionTimerKey = "";
      state.transitionTimerDueAt = 0;
      const latest = state.queuedRequest || state.desiredRequest;
      if (latest && requestIsCurrent(latest)) processRequest(latest);
    }, delayMs);
    return state.currentChoice;
  }

  function chooseAndPlay(context = {}, options = {}) {
    const request = makeRequest(context, options);
    state.desiredRequest = request;
    if (request.options.transition === "inherit" && state.currentChoice) {
      clearTransitionTimer();
      clearHoldTimer();
      state.queuedRequest = null;
      return state.currentChoice;
    }
    if (state.transitionTimer != null && state.transitionTimerKey !== `${request.key}|${request.scopeKey}`) clearTransitionTimer();
    if (state.switchLocks.size && !request.options.ignoreLock) {
      state.queuedRequest = request;
      return state.currentChoice || choiceForRequest(request);
    }
    if (!state.enabled || !state.unlocked) {
      state.pendingContext = request;
      return state.currentChoice || choiceForRequest(request);
    }
    return scheduleDelayedRequest(request);
  }

  function flushLatestRequest() {
    if (!state.enabled || !state.unlocked || state.switchLocks.size) return;
    const request = state.queuedRequest || state.pendingContext || (!state.currentAudio ? state.desiredRequest : null);
    if (!request) return;
    state.pendingContext = null;
    state.queuedRequest = null;
    processRequest(request);
  }

  function unlock() {
    if (state.unlocked && !state.pendingContext && !state.queuedRequest) return;
    state.unlocked = true;
    flushLatestRequest();
  }

  ["pointerdown", "keydown", "touchstart"].forEach((eventName) => {
    global.addEventListener?.(eventName, unlock, { capture: true });
  });

  async function crossfade(choice, options = {}) {
    if (!choice) return null;
    const request = state.desiredRequest || makeRequest({ phase: "manual", musicScope: `manual:${choice.id}` }, { ...options, transition: "immediate" });
    if (!state.desiredRequest) state.desiredRequest = request;
    request.options = normalizedOptions({ ...request.options, ...options, transition: "immediate" });
    return performTransition(choice, request);
  }

  async function fadeOut(durationMs = DEFAULT_FADE_MS) {
    const audio = state.currentAudio;
    if (!audio) return;
    await fadeAudio(audio, 0, durationMs);
    if (state.currentAudio === audio) {
      try { audio.pause(); } catch (_error) {}
    }
  }

  async function fadeIn(durationMs = DEFAULT_FADE_MS) {
    const audio = state.currentAudio;
    if (!audio) return;
    try {
      await audio.play();
      await fadeAudio(audio, targetVolume(state.currentChoice), durationMs);
    } catch (_error) {
      state.unlocked = false;
      state.pendingContext = state.desiredRequest;
    }
  }

  function stop(options = {}) {
    clearTransitionTimer();
    clearHoldTimer();
    const audio = state.currentAudio;
    state.currentAudio = null;
    state.currentChoice = null;
    state.currentContextKey = "";
    state.currentScopeKey = "";
    state.currentPhaseGroup = "";
    state.currentStartedAt = 0;
    if (!options.preserveRequest) {
      state.desiredRequest = null;
      state.queuedRequest = null;
      state.pendingContext = null;
    }
    if (!audio) return;
    void fadeAudio(audio, 0, Number(options.fadeMs ?? 500)).then(() => stopAudio(audio));
  }

  function setEnabled(enabled) {
    state.enabled = Boolean(enabled);
    storageSet("board_bgm_enabled", state.enabled ? "1" : "0");
    if (!state.enabled) {
      if (state.desiredRequest) state.pendingContext = state.desiredRequest;
      stop({ fadeMs: 500, preserveRequest: true });
    }
    else unlock();
  }

  function setVolume(value) {
    state.volume = clamp(value);
    storageSet("board_bgm_volume", String(state.volume));
    if (state.currentAudio) void fadeAudio(state.currentAudio, targetVolume(state.currentChoice), 180);
  }

  function releaseSwitchLock(key) {
    state.switchLocks.delete(key);
    if (!state.switchLocks.size) flushLatestRequest();
  }

  function acquireAudioFocus(reason = "media", options = {}) {
    const id = ++state.audioFocusSerial;
    const key = `audio-focus:${id}:${String(reason || "media")}`;
    const entry = {
      key,
      volumeRatio: clamp(options.volumeRatio ?? 0.1),
      fadeOutMs: Math.max(0, Number(options.fadeOutMs ?? 350)),
      fadeInMs: Math.max(0, Number(options.fadeInMs ?? 650)),
    };
    state.audioFocus.set(id, entry);
    state.switchLocks.add(key);
    if (state.currentAudio) void fadeAudio(state.currentAudio, targetVolume(state.currentChoice), entry.fadeOutMs);
    let released = false;
    return Object.freeze({
      id,
      release() {
        if (released) return;
        released = true;
        state.audioFocus.delete(id);
        state.switchLocks.delete(key);
        if (state.currentAudio) void fadeAudio(state.currentAudio, targetVolume(state.currentChoice), entry.fadeInMs);
        if (!state.switchLocks.size) flushLatestRequest();
      },
    });
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
    acquireAudioFocus,
    setBasePath(basePath) {
      state.basePath = String(basePath || DEFAULT_BASE_PATH);
    },
    lockAutoSwitch(reason = "lock") {
      const key = String(reason || "lock");
      state.switchLocks.add(key);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        releaseSwitchLock(key);
      };
    },
    unlockAutoSwitch(reason = "lock") {
      releaseSwitchLock(String(reason || "lock"));
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
        pendingContextKey: state.pendingContext?.key || "",
        desiredContextKey: state.desiredRequest?.key || "",
        switchLocks: [...state.switchLocks],
        audioFocusCount: state.audioFocus.size,
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
