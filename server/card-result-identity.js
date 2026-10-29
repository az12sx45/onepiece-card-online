'use strict';
// Transport-only identity; do not add fields to the authoritative game/save state.
function stampCardResult(room, visible, now=Date.now) {
  visible.nativeCardProtocol=1; // transport capability; never written into rules/save state
  if (!visible.final) { room.cardEndedAt=null; return; }
  if (!room.cardEndedAt) room.cardEndedAt=now();
  visible.final.endedAt=room.cardEndedAt;
}
module.exports={stampCardResult};
