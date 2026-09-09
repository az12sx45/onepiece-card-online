(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BoardStateWire = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  // This is a transport codec only. Offsets address UTF-16 code units in the
  // previous JSON text; the decoded text remains the complete save payload.
  const MAX_TEXT_SIZE = 30 * 1024 * 1024;
  const MAX_CHUNKS = 8192;
  const BLOCK_SIZE = 256;
  const MAX_CANDIDATES = 4;
  const HASH_BASE = 257;
  let hashPower = 1;
  for (let i = 1; i < BLOCK_SIZE; i += 1) hashPower = Math.imul(hashPower, HASH_BASE);

  function validText(text) {
    return typeof text === "string" && text.length <= MAX_TEXT_SIZE;
  }

  function utf8ByteLength(text) {
    let bytes = 0;
    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i);
      if (code < 0x80) bytes += 1;
      else if (code < 0x800) bytes += 2;
      else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length
        && text.charCodeAt(i + 1) >= 0xdc00 && text.charCodeAt(i + 1) <= 0xdfff) {
        bytes += 4;
        i += 1;
      } else bytes += 3;
    }
    return bytes;
  }

  // Two independent 32-bit accumulators detect accidental corruption and a
  // mismatched base. This checksum is not an authentication mechanism.
  function checksum(text) {
    let first = 0x811c9dc5;
    let second = 0x9e3779b9;
    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i);
      first = Math.imul(first ^ code, 16777619);
      second = Math.imul(second ^ code, 2246822519);
    }
    return (first >>> 0).toString(16).padStart(8, "0")
      + (second >>> 0).toString(16).padStart(8, "0");
  }

  function blockHash(text, offset) {
    let hash = 0;
    for (let i = 0; i < BLOCK_SIZE; i += 1) {
      hash = (Math.imul(hash, HASH_BASE) + text.charCodeAt(offset + i)) | 0;
    }
    return hash;
  }

  function finishPatch(nextText, chunks) {
    if (chunks.length > MAX_CHUNKS) return null;
    const patch = { length: nextText.length, checksum: checksum(nextText), chunks };
    // Compare actual UTF-8 JSON sizes, including escaping of literal chunks.
    // The caller also accounts for its event envelope before sending a patch.
    if (utf8ByteLength(JSON.stringify(patch)) > utf8ByteLength(nextText) * 0.8) return null;
    return patch;
  }

  function encode(baseText, nextText) {
    if (!validText(baseText) || !validText(nextText)) throw new Error("board_wire_text_limit");
    if (utf8ByteLength(baseText) > MAX_TEXT_SIZE || utf8ByteLength(nextText) > MAX_TEXT_SIZE) {
      throw new Error("board_wire_text_limit");
    }
    if (!baseText || nextText.length < BLOCK_SIZE) return null;
    if (baseText === nextText) return finishPatch(nextText, [[0, nextText.length]]);
    const index = new Map();
    for (let offset = 0; offset + BLOCK_SIZE <= baseText.length; offset += BLOCK_SIZE) {
      const hash = blockHash(baseText, offset);
      const positions = index.get(hash);
      if (!positions) index.set(hash, [offset]);
      else if (positions.length < MAX_CANDIDATES) positions.push(offset);
    }
    if (!index.size) return null;

    const chunks = [];
    let cursor = 0;
    let literalStart = 0;
    let hash = blockHash(nextText, cursor);
    // Cap candidate verification work even for deliberately colliding input.
    let remainingWork = 8 * (baseText.length + nextText.length + BLOCK_SIZE);
    while (cursor + BLOCK_SIZE <= nextText.length) {
      const candidates = index.get(hash);
      let bestOffset = -1;
      let bestLength = 0;
      if (candidates) {
        const block = nextText.slice(cursor, cursor + BLOCK_SIZE);
        for (const offset of candidates) {
          remainingWork -= BLOCK_SIZE;
          if (remainingWork < 0) return null;
          if (baseText.slice(offset, offset + BLOCK_SIZE) !== block) continue;
          let length = BLOCK_SIZE;
          while (offset + length < baseText.length && cursor + length < nextText.length
            && baseText.charCodeAt(offset + length) === nextText.charCodeAt(cursor + length)) {
            length += 1;
            remainingWork -= 1;
            if (remainingWork < 0) return null;
          }
          if (length > bestLength) {
            bestOffset = offset;
            bestLength = length;
          }
        }
      }
      if (bestOffset >= 0) {
        let copyStart = cursor;
        // Recover the unaligned beginning following an insertion or deletion.
        while (copyStart > literalStart && bestOffset > 0
          && nextText.charCodeAt(copyStart - 1) === baseText.charCodeAt(bestOffset - 1)) {
          copyStart -= 1;
          bestOffset -= 1;
          bestLength += 1;
        }
        if (copyStart > literalStart) chunks.push(nextText.slice(literalStart, copyStart));
        const previous = chunks[chunks.length - 1];
        if (Array.isArray(previous) && previous[0] + previous[1] === bestOffset) previous[1] += bestLength;
        else chunks.push([bestOffset, bestLength]);
        if (chunks.length > MAX_CHUNKS) return null;
        cursor = copyStart + bestLength;
        literalStart = cursor;
        if (cursor + BLOCK_SIZE <= nextText.length) hash = blockHash(nextText, cursor);
      } else {
        if (cursor + BLOCK_SIZE < nextText.length) {
          hash = (Math.imul((hash - Math.imul(nextText.charCodeAt(cursor), hashPower)) | 0, HASH_BASE)
            + nextText.charCodeAt(cursor + BLOCK_SIZE)) | 0;
        }
        cursor += 1;
      }
    }
    if (literalStart < nextText.length) chunks.push(nextText.slice(literalStart));
    return finishPatch(nextText, chunks);
  }

  function decode(baseText, patch) {
    if (!validText(baseText) || utf8ByteLength(baseText) > MAX_TEXT_SIZE) throw new Error("board_wire_text_limit");
    if (!patch || typeof patch !== "object" || Array.isArray(patch)
      || !Number.isSafeInteger(patch.length) || patch.length < 0 || patch.length > MAX_TEXT_SIZE
      || typeof patch.checksum !== "string" || !/^[a-f0-9]{16}$/.test(patch.checksum)
      || !Array.isArray(patch.chunks) || patch.chunks.length > MAX_CHUNKS) {
      throw new Error("board_wire_invalid_patch");
    }
    // Validate all ranges and total length before allocating expanded strings.
    let length = 0;
    for (const chunk of patch.chunks) {
      if (typeof chunk === "string") length += chunk.length;
      else {
        if (!Array.isArray(chunk) || chunk.length !== 2
          || !Number.isSafeInteger(chunk[0]) || !Number.isSafeInteger(chunk[1])
          || chunk[0] < 0 || chunk[1] <= 0 || chunk[0] > baseText.length
          || chunk[1] > baseText.length - chunk[0]) throw new Error("board_wire_invalid_copy");
        length += chunk[1];
      }
      if (length > patch.length) throw new Error("board_wire_length_mismatch");
    }
    if (length !== patch.length) throw new Error("board_wire_length_mismatch");
    const text = patch.chunks.map((chunk) => typeof chunk === "string"
      ? chunk : baseText.slice(chunk[0], chunk[0] + chunk[1])).join("");
    if (utf8ByteLength(text) > MAX_TEXT_SIZE) throw new Error("board_wire_text_limit");
    if (checksum(text) !== patch.checksum) throw new Error("board_wire_checksum_mismatch");
    return text;
  }

  return Object.freeze({ codec: "board-copy-v1", MAX_TEXT_SIZE, MAX_CHUNKS, encode, decode });
});
