(function (global) {
  "use strict";
  if (global.BoardAudio) return;

  const CUES = new Set(["tap", "select", "confirm", "cancel", "draw", "reward", "heal", "danger", "victory", "defeat"]);
  const installed = new WeakMap();
  const CONTROL_SELECTOR = 'button,[role="button"],a[href],summary,input[type="button"],input[type="submit"],input[type="reset"],input[type="checkbox"],input[type="radio"],[data-board-sfx]';
  const clamp = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : fallback;
  const read = (key, fallback) => { try { return global.localStorage.getItem(key) ?? fallback; } catch (_) { return fallback; } };
  const save = (key, value) => { try { global.localStorage.setItem(key, String(value)); } catch (_) {} };
  let parentAudio = null;
  try {
    let ancestor = global.parent;
    while (ancestor && ancestor !== global) {
      if (ancestor.BoardAudio) { parentAudio = ancestor.BoardAudio; break; }
      if (ancestor.parent === ancestor) break;
      ancestor = ancestor.parent;
    }
  } catch (_) {}

  function cueFor(control) {
    const explicit = control.closest("[data-board-sfx]")?.getAttribute("data-board-sfx");
    if (explicit === "off") return null;
    if (CUES.has(explicit)) return explicit;
    const name = `${control.id || ""} ${control.getAttribute("aria-label") || ""} ${control.textContent || control.value || ""}`;
    if (/cancel|close|back|取消|關閉|返回|稍後/i.test(name)) return "cancel";
    if (/confirm|accept|start|join|確定|確認|開始|加入|出航|準備/i.test(name)) return "confirm";
    if (control.matches('input[type="checkbox"],input[type="radio"],[role="tab"],[aria-pressed]')) return "select";
    return "tap";
  }

  function installDocument(doc) {
    if (!doc || installed.has(doc)) return;
    const api = parentAudio || global.BoardAudio;
    let repeatingKey = false;
    const unlock = (event) => {
      if (event.type === "keydown" && ["Enter", " "].includes(event.key)) repeatingKey = Boolean(event.repeat);
      if (!event.isTrusted || event.repeat || (event.type === "pointerdown" && event.button !== 0)) return;
      if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
      api.unlock();
    };
    const click = (event) => {
      if (!event.isTrusted || event.repeat || event.button > 0 || (event.detail === 0 && repeatingKey)) return;
      const control = event.target?.closest?.(CONTROL_SELECTOR);
      if (!control || control.matches(":disabled") || control.closest('[inert],[aria-disabled="true"],[data-board-sfx="off"]')) return;
      api.unlock();
      const cue = cueFor(control);
      if (cue) api.playCue(cue);
    };
    doc.addEventListener("pointerdown", unlock, { capture: true, passive: true });
    doc.addEventListener("keydown", unlock, true);
    doc.addEventListener("click", click, true);
    const keyup = () => { repeatingKey = false; };
    doc.addEventListener("keyup", keyup, true);
    const cleanup = () => {
      doc.removeEventListener("pointerdown", unlock, true);
      doc.removeEventListener("keydown", unlock, true);
      doc.removeEventListener("click", click, true);
      doc.removeEventListener("keyup", keyup, true);
      installed.delete(doc);
    };
    installed.set(doc, cleanup);
    doc.defaultView?.addEventListener("pagehide", (event) => { if (!event.persisted) cleanup(); }, { once: true });
  }

  // Embedded battles use their top-level page's one mixer and preferences.
  if (parentAudio) {
    global.BoardAudio = parentAudio;
    installDocument(global.document);
    return;
  }

  const state = {
    enabled: read("board_sfx_enabled", "1") !== "0",
    volume: clamp(read("board_sfx_volume", "0.65"), 0.65),
    context: null,
    master: null,
    unlocked: false,
    voices: new Set(),
    buffers: new Map(),
    assetBuffers: new Map(),
    requestedAssets: new Set(),
    lastCue: new Map(),
    lastStart: -Infinity,
    lastPriority: 0,
    controls: null,
  };

  const ASSETS = {
    tap: "button01a.mp3", select: "select03.mp3", confirm: "button02a.mp3", cancel: "button04a.mp3",
    draw: "button03a.mp3", reward: "coin01.mp3", heal: "powerup01.mp3", danger: "powerdown02.mp3",
    victory: "powerup01.mp3", defeat: "powerdown02.mp3",
  };

  function preloadAssets() {
    if (typeof global.fetch !== "function" || !state.context) return;
    const context = state.context;
    for (const filename of new Set(Object.values(ASSETS))) {
      if (state.requestedAssets.has(filename)) continue;
      state.requestedAssets.add(filename);
      const controller = typeof global.AbortController === "function" ? new global.AbortController() : null;
      const timeout = global.setTimeout(() => controller?.abort(), 5000);
      const url = new URL(`audio/board_game/sfx/game01/game01/${filename}`, global.document.baseURI).href;
      void global.fetch(url, { cache: "force-cache", signal: controller?.signal })
        .then((response) => { if (!response.ok) throw new Error("Audio unavailable"); return response.arrayBuffer(); })
        .then((bytes) => { if (bytes.byteLength > 2000000) throw new Error("Audio too large"); return context.decodeAudioData(bytes); })
        .then((buffer) => {
          if (buffer.duration > 2 || state.context !== context) return;
          let peak = 0;
          for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
            for (const sample of buffer.getChannelData(channel)) peak = Math.max(peak, Math.abs(sample));
          }
          if (!peak) return;
          for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
            const samples = buffer.getChannelData(channel);
            for (let i = 0; i < samples.length; i += 1) samples[i] *= 0.65 / peak;
          }
          state.assetBuffers.set(filename, buffer);
        })
        .catch(() => {})
        .finally(() => global.clearTimeout(timeout));
    }
  }

  // Original, short deck-wood / mallet / brass-bell motifs. No gameplay RNG.
  const SCORE = {
    tap: { duration: 0.10, notes: [[0, 175, 0.08, "wood", 0.85]] },
    select: { duration: 0.19, notes: [[0, 392, 0.13, "mallet", 0.75], [0.045, 523.25, 0.13, "mallet", 0.5]] },
    confirm: { duration: 0.30, notes: [[0, 392, 0.20, "mallet", 0.65], [0.07, 523.25, 0.21, "mallet", 0.75]] },
    cancel: { duration: 0.19, notes: [[0, 293.66, 0.10, "wood", 0.65], [0.055, 196, 0.12, "wood", 0.55]] },
    draw: { duration: 0.46, notes: [[0, 196, 0.09, "wood", 0.5], [0.08, 261.63, 0.10, "wood", 0.6], [0.17, 392, 0.23, "bell", 0.6]] },
    reward: { duration: 0.67, notes: [[0, 523.25, 0.42, "bell", 0.65], [0.07, 659.25, 0.42, "bell", 0.55], [0.14, 783.99, 0.47, "bell", 0.65]] },
    heal: { duration: 0.70, notes: [[0, 392, 0.40, "mallet", 0.5], [0.12, 523.25, 0.45, "mallet", 0.55], [0.23, 659.25, 0.43, "bell", 0.4]] },
    danger: { duration: 0.43, notes: [[0, 146.83, 0.18, "wood", 0.8], [0.16, 155.56, 0.23, "wood", 0.65]] },
    victory: { duration: 0.94, notes: [[0, 261.63, 0.22, "mallet", 0.65], [0.12, 329.63, 0.22, "mallet", 0.6], [0.24, 392, 0.23, "bell", 0.65], [0.40, 523.25, 0.49, "bell", 0.75]] },
    defeat: { duration: 0.67, notes: [[0, 261.63, 0.24, "mallet", 0.55], [0.16, 196, 0.27, "wood", 0.55], [0.32, 130.81, 0.30, "wood", 0.6]] },
  };

  function bufferFor(kind) {
    if (state.assetBuffers.has(ASSETS[kind])) return state.assetBuffers.get(ASSETS[kind]);
    if (state.buffers.has(kind)) return state.buffers.get(kind);
    const score = SCORE[kind];
    const rate = state.context.sampleRate;
    const buffer = state.context.createBuffer(1, Math.ceil(score.duration * rate), rate);
    const samples = buffer.getChannelData(0);
    for (const [offset, frequency, duration, timbre, amplitude] of score.notes) {
      const start = Math.floor(offset * rate);
      const count = Math.min(Math.ceil(duration * rate), samples.length - start);
      for (let i = 0; i < count; i += 1) {
        const time = i / rate;
        const progress = i / count;
        const phase = 2 * Math.PI * frequency * time;
        const attack = Math.min(1, time / 0.003);
        const release = Math.min(1, (1 - progress) / 0.12);
        const envelope = attack * release * Math.exp(-progress * (timbre === "wood" ? 8 : 4));
        let tone = Math.sin(phase);
        if (timbre === "wood") tone += 0.5 * Math.sin(phase * 2.73) * Math.exp(-time * 65) + 0.24 * Math.sin(phase * 5.18) * Math.exp(-time * 90);
        if (timbre === "mallet") tone += 0.28 * Math.sin(phase * 3) * Math.exp(-time * 16);
        if (timbre === "bell") tone += 0.38 * Math.sin(phase * 2.76) * Math.exp(-time * 8) + 0.17 * Math.sin(phase * 4.07) * Math.exp(-time * 12);
        samples[start + i] += tone * envelope * amplitude;
      }
    }
    let peak = 0;
    for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
    const scale = peak ? 0.65 / peak : 1;
    for (let i = 0; i < samples.length; i += 1) samples[i] *= scale;
    state.buffers.set(kind, buffer);
    return buffer;
  }

  function ensureContext() {
    if (state.context && state.context.state !== "closed") return state.context;
    const AudioContextClass = global.AudioContext || global.webkitAudioContext;
    if (!AudioContextClass) return null;
    try {
      state.context = new AudioContextClass();
      state.master = state.context.createGain();
      // Four simultaneous normalized voices peak below 0.84, even at 100%.
      state.master.gain.value = state.enabled ? state.volume * 0.32 : 0;
      state.master.connect(state.context.destination);
      state.buffers.clear();
      state.assetBuffers.clear();
      state.requestedAssets.clear();
      return state.context;
    } catch (_) { return null; }
  }

  function unlock() {
    try { global.BgmManager?.unlock?.(); } catch (_) {}
    if (!state.enabled || !state.volume) return;
    const context = ensureContext();
    if (!context) return;
    state.unlocked = true;
    if (context.state === "suspended") {
      try { Promise.resolve(context.resume()).catch(() => { state.unlocked = false; }); } catch (_) { state.unlocked = false; }
    }
    preloadAssets();
  }

  function stopVoices() {
    state.voices.forEach((source) => { try { source.stop(); } catch (_) {} });
    state.voices.clear();
  }

  function playCue(kind = "tap", options = {}) {
    if (!CUES.has(kind) || !state.enabled || !state.volume || !state.unlocked || !state.context || state.context.state === "closed") return false;
    const now = global.performance?.now?.() ?? Date.now();
    const priority = ["draw", "reward", "heal", "danger", "victory", "defeat"].includes(kind) ? 2 : 1;
    if (now - (state.lastCue.get(kind) ?? -Infinity) < 80 || (now - state.lastStart < 45 && priority <= state.lastPriority)) return false;
    if (state.voices.size >= 4) {
      if (priority < 2) return false;
      const oldest = state.voices.values().next().value;
      try { oldest.stop(); } catch (_) {}
      state.voices.delete(oldest);
    }
    try {
      const source = state.context.createBufferSource();
      source.buffer = bufferFor(kind);
      source.connect(state.master);
      source.onended = () => { state.voices.delete(source); try { source.disconnect(); } catch (_) {} };
      state.voices.add(source);
      source.start();
      state.lastCue.set(kind, now);
      state.lastStart = now;
      state.lastPriority = priority;
      return true;
    } catch (_) { return false; }
  }

  function setEnabled(enabled) {
    state.enabled = Boolean(enabled);
    save("board_sfx_enabled", state.enabled ? "1" : "0");
    if (!state.enabled) stopVoices();
    if (state.master) state.master.gain.value = state.enabled ? state.volume * 0.32 : 0;
    if (state.enabled) unlock();
    refreshControls();
  }

  function setVolume(volume) {
    state.volume = clamp(volume, state.volume);
    save("board_sfx_volume", state.volume);
    if (state.master) state.master.gain.setTargetAtTime(state.enabled ? state.volume * 0.32 : 0, state.context.currentTime, 0.02);
    if (!state.volume) stopVoices();
    refreshControls();
  }

  function bgmStatus() {
    try { return global.BgmManager?.status?.() || { enabled: read("board_bgm_enabled", "1") !== "0", volume: clamp(read("board_bgm_volume", "0.34"), 0.34) }; }
    catch (_) { return { enabled: false, volume: 0 }; }
  }

  function refreshControls() {
    const controls = state.controls;
    if (!controls) return;
    const bgm = bgmStatus();
    controls.bgmEnabled.checked = Boolean(bgm.enabled);
    controls.bgmVolume.value = String(Math.round(clamp(bgm.volume) * 100));
    controls.bgmValue.value = `${controls.bgmVolume.value}%`;
    controls.sfxEnabled.checked = state.enabled;
    controls.sfxVolume.value = String(Math.round(state.volume * 100));
    controls.sfxValue.value = `${controls.sfxVolume.value}%`;
    controls.trigger.setAttribute("data-muted", !bgm.enabled && !state.enabled ? "true" : "false");
  }

  function mountControls(target) {
    if (!global.document?.body) return null;
    if (state.controls) return state.controls.host;
    const doc = global.document;
    const mount = typeof target === "string" ? doc.querySelector(target) : target || doc.querySelector("[data-board-audio-controls]");
    const host = doc.createElement("div");
    host.className = `board-audio${mount ? " board-audio--inline" : " board-audio--floating"}`;
    host.innerHTML = '<button type="button" class="board-audio__trigger" aria-label="聲音設定" aria-expanded="false" aria-controls="board-audio-panel" aria-haspopup="dialog" data-board-sfx="select"><span aria-hidden="true">♫</span><span>聲音</span></button>' +
      '<section id="board-audio-panel" class="board-audio__panel" role="dialog" aria-label="航海聲音設定" popover="auto" hidden>' +
      '<div class="board-audio__heading"><div><small>VOYAGE SOUND</small><h2>航海聲音</h2></div><button type="button" class="board-audio__close" aria-label="關閉聲音設定" data-board-sfx="cancel">×</button></div>' +
      '<div class="board-audio__row"><label class="board-audio__switch"><input class="board-audio__bgm-enabled" type="checkbox"><span>背景音樂</span></label><output class="board-audio__bgm-value" for="board-audio-bgm-volume"></output></div>' +
      '<input id="board-audio-bgm-volume" class="board-audio__range board-audio__bgm-volume" type="range" min="0" max="100" step="1" aria-label="背景音樂音量">' +
      '<div class="board-audio__row"><label class="board-audio__switch"><input class="board-audio__sfx-enabled" type="checkbox"><span>操作音效</span></label><output class="board-audio__sfx-value" for="board-audio-sfx-volume"></output></div>' +
      '<input id="board-audio-sfx-volume" class="board-audio__range board-audio__sfx-volume" type="range" min="0" max="100" step="1" aria-label="操作音效音量">' +
      '<div class="board-audio__footer"><span>設定會保留在此裝置</span><button type="button" class="board-audio__sample" data-board-sfx="reward">試聽音效</button></div></section>';
    (mount || doc.body).appendChild(host);
    const find = (suffix) => host.querySelector(`.board-audio__${suffix}`);
    const trigger = find("trigger");
    const panel = find("panel");
    const controls = { host, trigger, panel, bgmEnabled: find("bgm-enabled"), bgmVolume: find("bgm-volume"), bgmValue: find("bgm-value"), sfxEnabled: find("sfx-enabled"), sfxVolume: find("sfx-volume"), sfxValue: find("sfx-value"), open: false };
    state.controls = controls;
    function position() {
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(320, global.innerWidth - 24);
      const height = panel.offsetHeight || 286;
      panel.style.width = `${width}px`;
      panel.style.left = `${Math.max(12, Math.min(rect.right - width, global.innerWidth - width - 12))}px`;
      const below = rect.bottom + 8;
      panel.style.top = `${Math.max(12, below + height < global.innerHeight - 12 ? below : rect.top - height - 8)}px`;
    }
    function close(restoreFocus = false) {
      if (!controls.open) return;
      controls.open = false;
      trigger.setAttribute("aria-expanded", "false");
      try { panel.hidePopover?.(); } catch (_) {}
      panel.hidden = true;
      if (restoreFocus) trigger.focus({ preventScroll: true });
    }
    trigger.addEventListener("click", () => {
      if (controls.open) { close(true); return; }
      refreshControls();
      controls.open = true;
      panel.hidden = false;
      try { panel.showPopover?.(); } catch (_) {}
      trigger.setAttribute("aria-expanded", "true");
      position();
      controls.bgmEnabled.focus({ preventScroll: true });
    });
    find("close").addEventListener("click", () => close(true));
    panel.addEventListener("toggle", (event) => { if (event.newState === "closed" && controls.open) close(false); });
    doc.addEventListener("pointerdown", (event) => { if (controls.open && !host.contains(event.target)) close(false); }, true);
    doc.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && controls.open) { event.preventDefault(); event.stopPropagation(); close(true); }
    }, true);
    global.addEventListener("resize", () => { if (controls.open) position(); }, { passive: true });
    controls.bgmEnabled.addEventListener("change", () => { global.BgmManager?.setEnabled?.(controls.bgmEnabled.checked); refreshControls(); });
    controls.bgmVolume.addEventListener("input", () => { global.BgmManager?.setVolume?.(Number(controls.bgmVolume.value) / 100); refreshControls(); });
    controls.sfxEnabled.addEventListener("change", () => setEnabled(controls.sfxEnabled.checked));
    controls.sfxVolume.addEventListener("input", () => setVolume(Number(controls.sfxVolume.value) / 100));
    controls.sfxVolume.addEventListener("change", (event) => { if (event.isTrusted) { unlock(); playCue("select"); } });
    refreshControls();
    return host;
  }

  global.BoardAudio = Object.freeze({
    playCue, unlock, setEnabled, setVolume, mountControls, installDocument,
    status: () => ({ enabled: state.enabled, volume: state.volume, unlocked: state.unlocked, available: Boolean(global.AudioContext || global.webkitAudioContext), activeVoices: state.voices.size, cachedCues: state.buffers.size, loadedAssets: state.assetBuffers.size }),
  });
  installDocument(global.document);
  const autoMount = () => { if (global.BOARD_AUDIO_AUTO_MOUNT !== false) mountControls(); };
  if (global.document?.readyState === "loading") global.document.addEventListener("DOMContentLoaded", autoMount, { once: true });
  else autoMount();
  global.addEventListener("pagehide", () => {
    stopVoices();
    state.unlocked = false;
    try { if (state.context?.state === "running") Promise.resolve(state.context.suspend()).catch(() => {}); } catch (_) {}
  });
})(typeof window !== "undefined" ? window : globalThis);
