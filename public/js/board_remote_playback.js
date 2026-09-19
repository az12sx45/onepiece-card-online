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
  return { create };
});
