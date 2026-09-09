"use strict";

const wire = require("../public/js/board_state_wire");

// Transport-only baselines never replace room.gamePayload or enter saved games.
// Socket.IO preserves order within a connection; every new join resets the base.
function createBoardStateSender() {
  const peers = new WeakMap();

  function reset(socket, encoding) {
    peers.set(socket, { enabled: encoding === wire.codec, base: null });
  }

  function send(socket, message, options = {}) {
    const peer = peers.get(socket);
    if (!peer?.enabled) {
      socket.emit("BOARD_GAME_STATE", message);
      return;
    }
    const text = options.text ?? JSON.stringify(message.payload);
    let packet = message;
    const base = peer.base;
    if (!options.full && base && base.roomCode === message.roomCode && base.version < message.version) {
      try {
        const cache = options.patches;
        let patch;
        if (cache?.has(base.text)) patch = cache.get(base.text);
        else {
          patch = wire.encode(base.text, text);
          cache?.set(base.text, patch);
        }
        if (patch) {
          const { payload, ...metadata } = message;
          packet = { ...metadata, encoding: wire.codec, baseVersion: base.version, patch };
          if (Buffer.byteLength(JSON.stringify(packet)) > Buffer.byteLength(JSON.stringify(message)) * 0.8) {
            packet = message;
          }
        }
      } catch (_) {
        // Oversized or unsuitable snapshots keep the established full transport.
      }
    }
    socket.emit("BOARD_GAME_STATE", packet);
    peer.base = text.length <= wire.MAX_TEXT_SIZE
      ? { roomCode: message.roomCode, version: message.version, text }
      : null;
  }

  function broadcast(io, sourceSocket, message) {
    const ids = io.sockets.adapter.rooms.get(`board:${message.roomCode}`);
    if (!ids) return;
    let text;
    const patches = new Map();
    for (const id of ids) {
      if (id === sourceSocket.id) continue;
      const target = io.sockets.sockets.get(id);
      if (!target) continue;
      if (peers.get(target)?.enabled && text === undefined) text = JSON.stringify(message.payload);
      send(target, message, { text, patches });
    }
  }

  return { reset, send, broadcast };
}

module.exports = { createBoardStateSender };
