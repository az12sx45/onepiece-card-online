"use strict";

const assert = require("node:assert/strict");
const { create, resolve, canonicalMoveId, soundFor } = require("../public/js/board_move_fx.js");
const catalog = {
  version: 1,
  families: { slash: { sheet: "images/board/battle/move_fx/slash.webp", columns: 4, rows: 2, frames: 8, fps: 20, width: 320 } },
  moves: {
    sword_move: { art: "slash", animation: "sweep", sound: "audio/board_game/move_fx/slash.wav" },
    quiet_move: { art: "slash", animation: "none" },
  },
};

function harness(options = {}) {
  const calls = [];
  const frames = new Map();
  const images = [];
  let time = 0;
  let frameId = 0;
  const context = Object.fromEntries(["setTransform", "clearRect", "save", "restore", "translate", "rotate", "scale", "drawImage"].map((name) => [name, (...args) => calls.push({ name, args })]));
  const canvas = { style: {}, width: 0, height: 0, setAttribute() {}, getContext: () => context, remove: () => calls.push({ name: "remove", args: [] }) };
  // Stage is displayed at half size; anchor coordinates must be converted back.
  const stage = { clientWidth: 1000, clientHeight: 600, getBoundingClientRect: () => ({ left: 100, top: 50, width: 500, height: 300 }), appendChild: () => calls.push({ name: "append", args: [] }) };
  const target = { getBoundingClientRect: () => ({ left: 400, top: 130, width: 100, height: 150 }) };
  const fx = create({
    catalog, stage, document: { createElement: () => canvas }, now: () => time,
    raf: (callback) => { frames.set(++frameId, callback); return frameId; },
    cancelRaf: (id) => frames.delete(id),
    createImage: () => { const image = { naturalWidth: 1024, naturalHeight: 512 }; images.push(image); return image; },
    ...options,
  });
  return {
    fx, calls, images, frames, canvas, target,
    advance(ms) { time += ms; const pending = [...frames.values()]; frames.clear(); pending.forEach((callback) => callback(time)); },
  };
}

(async () => {
  let checks = 0;
  function check(description, action) { action(); checks += 1; }
  check("exact IDs only", () => { assert.equal(resolve(catalog, { moveName: "sword_move" }), null); assert.equal(resolve(catalog, { moveId: "missing" }), null); });
  check("inherited IDs rejected", () => assert.equal(resolve(catalog, { moveId: "toString" }), null));
  check("black-turn prefix keeps longest exact move suffix", () => assert.equal(canonicalMoveId(catalog, "final_black_turn_crew_sword_move"), "sword_move"));
  check("black-turn 54-character truncation resolves without guessing collisions", () => {
    const prefix = "long_move_".repeat(6);
    const longCatalog = { ...catalog, moves: { [prefix + "a"]: { ...catalog.moves.sword_move, moveName: "A" }, [prefix + "b"]: { ...catalog.moves.sword_move, moveName: "B" } } };
    const id = `final_black_turn_crew_${prefix.slice(0, 54)}`;
    assert.equal(canonicalMoveId(longCatalog, id), "");
    assert.equal(canonicalMoveId(longCatalog, id, "B"), prefix + "b");
  });
  check("unknown basic and struggle remain unmapped", () => { assert.equal(canonicalMoveId(catalog, "unknown_basic"), ""); assert.equal(canonicalMoveId(catalog, "unknown_struggle"), ""); });
  check("explicit alias accepted", () => assert.equal(canonicalMoveId({ ...catalog, aliases: { known_basic: "sword_move" } }, "known_basic"), "sword_move"));
  check("OGG cast sound and silent support hit", () => {
    const support = { ...catalog, moves: { ...catalog.moves, support: { art: "slash", damageClass: "status", sound: "audio/old-hit.ogg", castSound: "audio/board_game/support.ogg" } } };
    assert.equal(soundFor(support, { moveId: "support" }), "");
    assert.equal(soundFor(support, { moveId: "support" }, "cast"), "audio/board_game/support.ogg");
  });
  check("equipment variant uses move name without changing its ID", () => {
    const variants = { ...catalog, variants: [{ moveId: "sword_move", previous: { moveName: "Fire kick", animation: "projectile", sound: "audio/fire.ogg" }, variant: { moveName: "Invisible kick", animation: "slash", sound: "audio/kick.ogg" } }] };
    assert.equal(resolve(variants, { moveId: "sword_move", moveName: "Invisible kick" }).animation, "sweep");
    assert.equal(soundFor(variants, { moveId: "sword_move", moveName: "Invisible kick" }), "audio/kick.ogg");
  });
  check("same-name phase variant works for engine move, prepare and dice", () => {
    const phaseCatalog = { ...catalog, moves: { phase: { art: "slash", damageClass: "status", castSound: "audio/status.ogg" } }, variants: [{ moveId: "phase", when: { moveName: "Same name", eventType: "attack" }, profile: { damageClass: "special", castSound: "audio/attack.ogg" } }] };
    for (const value of [{ id: "phase", name: "Same name", category: "special", power: 264 }, { moveId: "phase", moveName: "Same name", type: "prepare", moveType: "special" }, { moveId: "phase", moveName: "Same name", type: "dice", moveType: "special" }]) assert.equal(soundFor(phaseCatalog, value, "cast"), "audio/attack.ogg");
    assert.equal(soundFor(phaseCatalog, { moveId: "phase", moveName: "Same name", type: "dice", moveType: "control" }, "cast"), "audio/status.ogg");
    assert.equal(soundFor(phaseCatalog, { id: "phase", name: "Same name", power: 0 }, "cast"), "audio/status.ogg");
  });
  check("asset path traversal rejected", () => assert.equal(resolve({ ...catalog, families: { slash: { sheet: "../secret.png" } } }, { moveId: "sword_move" }), null));
  const h = harness();
  const event = { id: "attack-1", moveId: "sword_move", side: "player", targetSide: "enemy", damage: 42, hitDamages: [42] };
  const original = JSON.stringify(event);
  check("cold assets fail safely", () => assert.equal(h.fx.play(event), false));
  check("cold hit does not enqueue a late animation", () => assert.equal(h.fx.status().active, 0));
  const warming = h.fx.warm(["sword_move", "quiet_move", "missing"]);
  check("family loads once for several moves", () => assert.equal(h.images.length, 1));
  h.images[0].onload();
  assert.deepEqual(await warming, [true, true, false]); checks += 1;
  check("loaded image never replays missed cold hit", () => assert.equal(h.frames.size, 0));
  check("miss does not draw", () => assert.equal(h.fx.play({ ...event, miss: true }), false));
  check("Lucci cinematic stays owned by its existing player", () => assert.equal(h.fx.play({ ...event, specialFx: "lucci-rokuogan" }), false));
  check("ready impact starts", () => assert.equal(h.fx.play(event, { anchorElement: h.target, durationMs: 400 }), true));
  h.advance(0);
  check("first contact begins at visible peak frame without build-up delay", () => {
    assert.deepEqual(h.calls.findLast((call) => call.name === "drawImage").args.slice(1, 5), [768, 0, 256, 256]);
  });
  h.advance(100);
  check("impact advances through decay frames at sheet FPS", () => {
    const draw = h.calls.findLast((call) => call.name === "drawImage");
    assert.deepEqual(draw.args.slice(1, 5), [256, 256, 256, 256]);
  });
  check("scaled-stage anchor remains aligned", () => assert.deepEqual(h.calls.findLast((call) => call.name === "translate").args, [700, 274]));
  check("battle event stays immutable", () => assert.equal(JSON.stringify(event), original));
  h.advance(300);
  check("finished animation has no pending frames", () => { assert.equal(h.frames.size, 0); assert.equal(h.fx.status().active, 0); });
  check("launch frame does not require target damage", () => assert.equal(h.fx.play({ ...event, damage: 0 }, { phase: "launch", durationMs: 340 }), true));
  h.advance(100);
  check("launch progresses from actor toward target", () => { const x = h.calls.findLast((call) => call.name === "translate").args[0]; assert.ok(x > 260 && x < 740); });
  check("clear cancels scheduled frames", () => { h.fx.clear(); assert.equal(h.frames.size, 0); assert.equal(h.fx.status().active, 0); });
  check("none does not create a launch", () => assert.equal(h.fx.play({ moveId: "quiet_move" }, { phase: "launch" }), false));
  check("enemy artwork mirrors", () => {
    h.fx.play({ ...event, side: "enemy", targetSide: "player" }); h.advance(100);
    assert.ok(h.calls.findLast((call) => call.name === "scale").args[0] < 0);
  });
  check("destroy clears DOM and prohibits further playback", () => { h.fx.destroy(); assert.equal(h.frames.size, 0); assert.equal(h.fx.play(event), false); assert.equal(h.fx.status().destroyed, true); });
  const failed = harness();
  const failedWarm = failed.fx.warm("sword_move");
  failed.images[0].onerror();
  assert.deepEqual(await failedWarm, [false]); checks += 1;
  check("failed image leaves fallback available", () => { assert.equal(failed.fx.play(event), false); assert.equal(failed.fx.status().failed, 1); });
  const aura = harness({ catalog: { ...catalog, moves: { support: { art: "slash", animation: "aura", durationMs: 650 } } } });
  const auraWarm = aura.fx.warm("support"); aura.images[0].onload(); await auraWarm;
  aura.fx.play({ moveId: "support" }); aura.advance(0);
  check("support starts with its first frame", () => assert.deepEqual(aura.calls.findLast((call) => call.name === "drawImage").args.slice(1, 3), [0, 0]));
  aura.advance(500);
  check("support full sequence stays visible for authored duration", () => assert.equal(aura.fx.status().active, 1));
  aura.advance(150);
  check("support sequence cleans up after 650 ms", () => assert.equal(aura.fx.status().active, 0));
  const many = { families: {}, moves: {} };
  for (let i = 0; i < 6; i += 1) { many.families[i] = { ...catalog.families.slash, sheet: `images/${i}.webp` }; many.moves[i] = { art: String(i) }; }
  const lru = harness({ catalog: many, cacheLimit: 2 });
  for (let i = 0; i < 6; i += 1) { const warm = lru.fx.warm(String(i)); lru.images.at(-1).onload(); await warm; if (i === 0) lru.fx.play({ moveId: "0" }); }
  check("decoded image cache stays bounded", () => assert.equal(lru.fx.status().cached, 2));
  check("active sheet survives LRU eviction", () => assert.equal(lru.fx.ready({ moveId: "0" }), true));
  check("old inactive sheet is released", () => { assert.equal(lru.fx.ready({ moveId: "1" }), false); assert.equal(lru.images[1].src, ""); });
  const mounted = [];
  const layered = harness({ layer: { appendChild: (canvas) => mounted.push(canvas) } });
  const layerWarm = layered.fx.warm("sword_move"); layered.images[0].onload(); await layerWarm; layered.fx.play(event);
  check("effect canvas uses the same stacking context as damage text", () => assert.equal(mounted[0], layered.canvas));
  console.log(JSON.stringify({ ok: true, checks, scope: "exact move lookup, sprite crop, contact alignment, immutable events, loading fallback, cleanup" }));
})().catch((error) => { console.error(error); process.exitCode = 1; });
