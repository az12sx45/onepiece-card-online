(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports
    ? require("./board_state_wire") : root.BoardStateWire);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BoardStateReceiver = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (wire) {
  "use strict";

  function create({ roomCode, requestFull, onMessage }) {
    let base = null;
    let recovering = false;
    const counts = { fullFrames: 0, deltaFrames: 0, recoveries: 0 };
    function reset() {
      base = null;
      recovering = false;
    }
    function receive(message = {}) {
      // This receiver is bound to one room; delayed old-room messages are ignored.
      if (message.roomCode !== roomCode) return;
      let text;
      let payload = message.payload;
      try {
        if (message.encoding) {
          if (recovering) return;
          if (message.encoding !== wire.codec || !base || base.version !== message.baseVersion
            || !Number.isSafeInteger(message.version) || message.version <= base.version) {
            throw new Error("board_wire_base_mismatch");
          }
          text = wire.decode(base.text, message.patch);
          payload = JSON.parse(text);
          if (!payload?.gameState) throw new Error("board_wire_invalid_payload");
          counts.deltaFrames++;
        } else {
          if (!payload) return;
          text = JSON.stringify(payload);
          counts.fullFrames++;
          recovering = false;
        }
        // Keep immutable JSON before gameplay normalization or deferred animation
        // can mutate/skip a received snapshot. Gameplay version guards stay intact.
        base = text.length <= wire.MAX_TEXT_SIZE ? { text, version: message.version } : null;
      } catch (_) {
        base = null;
        if (!recovering) {
          recovering = true;
          counts.recoveries++;
          requestFull();
        }
        return;
      }
      onMessage({ ...message, payload });
    }
    return { receive, reset, status: () => ({ ...counts, recovering }) };
  }
  return { create };
});
