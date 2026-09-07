"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const battleHtml = read("public/chess/battle-game.html");
const loader = read("public/chess/battle-game-loader-v1.js");
const lobby = read("public/chess/pre-match-lobby.js");
const social = read("public/chess/battle-social-v1.js");
const socialCss = read("public/chess/battle-social-v1.css");
const battleCss = read("public/chess/battle-chess.css");

function zIndex(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s*\\{[^}]*z-index\\s*:\\s*(\\d+)`, "s").exec(source);
  assert.ok(match, `missing z-index for ${selector}`);
  return Number(match[1]);
}

assert.match(battleHtml, /battle-social-v1\.css\?v=invite-picker-v1-20260907/);
assert.match(battleHtml, /battle-social-v1\.js\?v=invite-picker-v1-20260907/);
assert.match(battleHtml, /battle-game-loader-v1\.js\?v=cpu-image-timeout-v1-20260907/);
assert.match(loader, /pre-match-lobby\.js\?v=invite-picker-v1-20260907/);
assert.match(lobby, /BattleSocial\?\.openInvitePicker\?\.\(\)/);
assert.match(lobby, /BattleSocial\?\.setRoomContext\?\.\(\{ roomCode:room\.roomCode \|\| "", mode:"chess", status:"playing" \}\)/);
assert.doesNotMatch(lobby, /請在好友右側按「邀」/);
assert.match(social, /function openInvitePicker\(\)/);
assert.match(social, /function closeInvitePicker\(\)/);
assert.match(social, /openInvitePicker,/);
assert.match(social, /state\.roomContext\.status !== "waiting"\) closeInvitePicker\(\)/);
assert.match(social, /LOBBY_INVITE_SEND/);
assert.match(social, /mode:\s*"chess"/);
assert.match(socialCss, /\.battle-invite-picker\s*\{/);
assert.match(socialCss, /\.friend-dock\s*\{/);

const lobbyLayer = zIndex(battleCss, ".pre-match-lobby");
const dockLayer = zIndex(socialCss, ".friend-dock");
const chatLayer = zIndex(socialCss, ".chat-tray");
const toastLayer = zIndex(socialCss, ".toast-region");
const pickerLayer = zIndex(socialCss, ".battle-invite-picker");
for (const [name, value] of Object.entries({ dockLayer, chatLayer, toastLayer, pickerLayer })) {
  assert.ok(value > lobbyLayer, `${name} (${value}) must be above lobby (${lobbyLayer})`);
}

console.log(JSON.stringify({
  ok: true,
  invitePicker: true,
  cacheBust: true,
  layers: { lobbyLayer, dockLayer, chatLayer, toastLayer, pickerLayer },
}));
