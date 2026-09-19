(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BoardRemotePlayback = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Presentation only. The wire receiver decodes every version before enqueueing;
  // game state and server authority still use the existing snapshot handlers.
  function create({ apply, duration, blocked = () => false, onIdle, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout }) {
    const queue = [];
    let timer = null;
    let draining = false;
    let held = false;
    function drain() {
      if (draining || timer !== null) return;
      draining = true;
      try {
        while (queue.length && timer === null) {
          if (blocked(queue[0])) break;
          const item = queue.shift();
          const event = item.kind === "event" ? item.message.event : item.message.payload?.boardUiEvent;
          const hold = Math.max(0, Number(duration(event, item)) || 0);
          if (event) {
            // Lifetime starts at playback, not at the sender's wall clock. Never
            // mutate the immutable wire base or the payload used for its delta.
            const replayEvent = { ...event, expiresAt: Math.max(Number(event.expiresAt) || 0, now() + hold + 1000) };
            item.message = item.kind === "event"
              ? { ...item.message, event: replayEvent }
              : { ...item.message, payload: { ...item.message.payload, boardUiEvent: replayEvent } };
          }
          if (hold) {
            held = true;
            timer = setTimer(() => { timer = null; drain(); }, hold);
          }
          apply(item.kind, item.message);
        }
      } finally {
        draining = false;
      }
      if (!queue.length && timer === null && held) {
        held = false;
        onIdle?.();
      }
    }
    return {
      enqueue(kind, message) {
        const previous = queue[queue.length - 1];
        // Repeated checkpoints for the same presentation can use the newest
        // state. Never coalesce across an event or a distinct battle visual.
        const samePresentation = kind === "state" && previous?.kind === "state"
          && previous.message.payload?.boardUiEvent?.id === message.payload?.boardUiEvent?.id
          && !!previous.message.payload?.battleState === !!message.payload?.battleState
          && previous.message.payload?.battleState?.visualEvent?.id === message.payload?.battleState?.visualEvent?.id;
        if (samePresentation && Number(message.version) > Number(previous.message.version)) previous.message = message;
        else queue.push({ kind, message });
        drain();
      },
      reset() { if (timer !== null) clearTimer(timer); timer = null; queue.length = 0; held = false; },
      resume: drain,
      status: () => ({ active: timer !== null, pending: queue.length }),
    };
  }
  const BATTLE_EVENT_LIMIT = 64 * 1024;
  const BATTLE_VISUAL_LIMIT = 30 * 1024 * 1024;
  const BATTLE_PART_BYTES = 24 * 1024;
  const BATTLE_PART_LIMIT = Math.ceil(BATTLE_VISUAL_LIMIT / BATTLE_PART_BYTES);
  const BATTLE_ASSEMBLY_TIMEOUT = 30000;
  const BATTLE_BUFFER_LIMIT = 64 * 1024 * 1024;

  function battleVisualChecksum(bytes) {
    let hash = 2166136261;
    for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619);
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function isBattleVisual(event) {
    return !!event && event.channel === "battle" && event.type === "visual"
      && typeof event.id === "string" && !!event.id && event.id.length <= 2048
      && !!event.view?.battle && typeof event.view.battle === "object" && !Array.isArray(event.view.battle);
  }

  function splitBattleVisualEvent(event) {
    if (!isBattleVisual(event)) throw new Error("battle_visual_invalid_event");
    const bytes = new TextEncoder().encode(JSON.stringify(event));
    if (bytes.length > BATTLE_VISUAL_LIMIT) throw new Error("battle_visual_size_limit");
    if (bytes.length <= BATTLE_EVENT_LIMIT) return [event];
    const total = Math.ceil(bytes.length / BATTLE_PART_BYTES);
    const checksum = battleVisualChecksum(bytes);
    return Array.from({ length: total }, (_, index) => {
      const part = bytes.subarray(index * BATTLE_PART_BYTES, (index + 1) * BATTLE_PART_BYTES);
      return {
        id: `${event.id}:part:${index}`, channel: "battle", type: "visual-part",
        visualId: event.id, index, total, checksum,
        data: btoa(String.fromCharCode(...part)),
      };
    });
  }

  function createBattleVisualReceiver({ now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout, onDiscard } = {}) {
    const assemblies = new Map();
    const recent = new Map();
    let bufferedBytes = 0;
    let rejected = 0;
    let evicted = 0;
    function remove(key) {
      const entry = assemblies.get(key);
      if (!entry) return;
      if (entry.timer !== null) clearTimer(entry.timer);
      bufferedBytes -= entry.bytes;
      assemblies.delete(key);
    }
    function remember(key) {
      recent.set(key, now() + BATTLE_ASSEMBLY_TIMEOUT);
      while (recent.size > 128) recent.delete(recent.keys().next().value);
    }
    function discard(key) {
      remove(key);
      remember(key);
      const [source, visualId] = JSON.parse(key);
      onDiscard?.(visualId, source);
    }
    function expire() {
      const time = now();
      for (const [key, until] of recent) if (until <= time) recent.delete(key);
      for (const [key, entry] of assemblies) if (entry.expiresAt <= time) discard(key);
    }
    function reject(key) {
      rejected += 1;
      if (key) discard(key);
      return null;
    }
    function evictOldest(exceptKey = "") {
      const key = [...assemblies.keys()].find((candidate) => candidate !== exceptKey);
      if (!key) return false;
      discard(key);
      evicted += 1;
      return true;
    }
    return {
      receive(event, sourceClientId = "") {
        expire();
        const source = String(sourceClientId || "");
        if (source.length > 2048 || !event || typeof event !== "object") return reject("");
        if (event.channel === "battle" && event.type === "visual") {
          if (!isBattleVisual(event)) return reject("");
          const key = JSON.stringify([source, event.id]);
          if (recent.has(key)) return null;
          try {
            if (new TextEncoder().encode(JSON.stringify(event)).length > BATTLE_EVENT_LIMIT) return reject(key);
          } catch (_) { return reject(key); }
          remove(key);
          remember(key);
          return event;
        }
        if (event.channel !== "battle" || event.type !== "visual-part") return null;
        const visualId = event.visualId;
        if (typeof visualId !== "string" || !visualId || visualId.length > 2048) return reject("");
        const key = JSON.stringify([source, visualId]);
        if (recent.has(key)) return null;
        const { index, total, data, checksum } = event;
        if (!Number.isInteger(index) || !Number.isInteger(total) || total < 1 || total > BATTLE_PART_LIMIT
          || index < 0 || index >= total || event.id !== `${visualId}:part:${index}`
          || typeof checksum !== "string" || !/^[0-9a-f]{8}$/.test(checksum)
          || typeof data !== "string" || !data.length || data.length > BATTLE_PART_BYTES * 4 / 3
          || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)) return reject(key);
        let bytes;
        try {
          const binary = atob(data);
          bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        } catch (_) { return reject(key); }
        if (!bytes.length || bytes.length > BATTLE_PART_BYTES || (index < total - 1 && bytes.length !== BATTLE_PART_BYTES)) return reject(key);
        let entry = assemblies.get(key);
        if (entry && (entry.total !== total || entry.checksum !== checksum)) return reject(key);
        if (entry?.parts[index]) {
          const previous = entry.parts[index];
          if (previous.length !== bytes.length || previous.some((byte, offset) => byte !== bytes[offset])) return reject(key);
          return null;
        }
        if (!entry) {
          while (assemblies.size >= 32) evictOldest();
          entry = { total, checksum, parts: new Array(total), count: 0, bytes: 0, expiresAt: now() + BATTLE_ASSEMBLY_TIMEOUT, timer: null };
          assemblies.set(key, entry);
        }
        if (entry.bytes + bytes.length > BATTLE_VISUAL_LIMIT) return reject(key);
        while (bufferedBytes + bytes.length > BATTLE_BUFFER_LIMIT) {
          if (!evictOldest(key)) return reject(key);
        }
        entry.parts[index] = bytes;
        entry.count += 1;
        entry.bytes += bytes.length;
        bufferedBytes += bytes.length;
        entry.expiresAt = now() + BATTLE_ASSEMBLY_TIMEOUT;
        if (entry.timer !== null) clearTimer(entry.timer);
        entry.timer = setTimer(() => discard(key), BATTLE_ASSEMBLY_TIMEOUT);
        if (entry.count !== entry.total) return null;
        const complete = new Uint8Array(entry.bytes);
        let offset = 0;
        for (const part of entry.parts) { complete.set(part, offset); offset += part.length; }
        remove(key);
        if (battleVisualChecksum(complete) !== checksum) return reject(key);
        try {
          const result = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(complete));
          if (!isBattleVisual(result) || result.id !== visualId) return reject(key);
          remember(key);
          return result;
        } catch (_) { return reject(key); }
      },
      reset() {
        for (const key of [...assemblies.keys()]) discard(key);
        recent.clear();
        bufferedBytes = 0;
      },
      isPending(visualId, sourceClientId = "") { return assemblies.has(JSON.stringify([String(sourceClientId || ""), String(visualId || "")])); },
      status() { expire(); return { assemblies: assemblies.size, bufferedBytes, recent: recent.size, rejected, evicted }; },
    };
  }

  // Chunk assembly bypasses the presentation queue but reserves its first
  // arrival's position. A later checkpoint cannot overtake an unfinished visual.
  function createBattleVisualIngress({ deliver, onIdle, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout }) {
    const queue = [];
    const reservations = new Map();
    let receiving = 0;
    let draining = false;
    let waited = false;
    const receiver = createBattleVisualReceiver({
      now, setTimer, clearTimer,
      onDiscard(visualId, source) {
        const entry = reservations.get(JSON.stringify([source, visualId]));
        if (entry?.status === "waiting") entry.status = "dropped";
        drain();
      },
    });
    function drain() {
      if (receiving || draining) return;
      draining = true;
      try {
        while (queue.length && queue[0].status !== "waiting") {
          const entry = queue.shift();
          if (entry.key) reservations.delete(entry.key);
          if (entry.status !== "dropped") deliver(entry.kind, entry.message);
        }
      } finally { draining = false; }
      if (!queue.length && waited) { waited = false; onIdle?.(); }
    }
    return {
      receive(kind, message) {
        receiving += 1;
        try {
          const event = kind === "event" ? message?.event : null;
          const isPart = event?.channel === "battle" && event.type === "visual-part";
          const isVisual = event?.channel === "battle" && event.type === "visual";
          if (!isPart && !isVisual) {
            queue.push({ kind, message, status: "ready" });
            return;
          }
          const source = String(message?.sourceClientId || "");
          const visualId = isPart ? event.visualId : event.id;
          if (typeof visualId !== "string" || !visualId || visualId.length > 2048 || source.length > 2048) return;
          const key = JSON.stringify([source, visualId]);
          let entry = reservations.get(key);
          if (entry && entry.status !== "waiting") return;
          if (isPart && !entry) {
            entry = { key, kind: "event", message: { ...message }, status: "waiting" };
            reservations.set(key, entry);
            queue.push(entry);
            waited = true;
          }
          const complete = receiver.receive(event, source);
          if (entry) {
            if (complete) {
              entry.message = { ...entry.message, event: complete };
              entry.status = "ready";
            } else if (!receiver.isPending(visualId, source)) {
              entry.status = "dropped";
            }
          } else if (complete) {
            queue.push({ kind: "event", message: { ...message, event: complete }, status: "ready" });
          }
        } finally {
          receiving -= 1;
          drain();
        }
      },
      reset() {
        receiving += 1;
        try {
          queue.length = 0;
          reservations.clear();
          waited = false;
          receiver.reset();
        } finally { receiving -= 1; }
      },
      status() {
        const transport = receiver.status();
        return { pending: queue.length, waiting: queue.filter((entry) => entry.status === "waiting").length, assemblies: transport.assemblies, bufferedBytes: transport.bufferedBytes };
      },
    };
  }

  return { create, splitBattleVisualEvent, createBattleVisualReceiver, createBattleVisualIngress };
});
