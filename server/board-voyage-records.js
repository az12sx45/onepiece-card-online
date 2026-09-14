"use strict";

// Versioned save envelopes. Gameplay state stays opaque: never merge two worlds.
const crypto = require("crypto");
const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
const validPayload = (payload) => Boolean(payload?.gameState?.boardData && Array.isArray(payload.gameState.players));
const memberKey = (value) => `user-${Number(value?.userId ?? value?.id)}`;
const newId = () => `V${crypto.randomBytes(12).toString("hex").toUpperCase()}`;
const nameOf = (value, fallback = "我的航海錄") => String(value || fallback).trim().slice(0, 60) || fallback;

function progress(payload, record = {}){
  const game = payload?.gameState || {};
  return {
    round: Math.max(1, Number(game.round || 1)),
    cycle: game.postgameWorld?.unlocked === true ? 2 : 1,
    saveKind: String(record.saveKind || "manual"),
    savedAt: String(record.savedAt || payload?.serverSavedAt || payload?.savedAt || ""),
    hasBattle: Boolean(payload?.battleState),
  };
}

function membersFromRoom(room, payload){
  return (room?.players || []).filter((player) => Number(player.userId) > 0 && !player.isCPU && !player.isProxyCPU).map((player) => {
    const seatIndex = payload.gameState.players.findIndex((entry) => Number(entry.userId ?? entry.id) === Number(player.userId));
    return { key:memberKey(player), userId:Number(player.userId), name:nameOf(player.name, "玩家"), avatar:Number(player.avatar || 1), title:String(player.title || "航海士"), seatIndex, joinedAt:Date.now() };
  }).filter((member) => member.seatIndex >= 0);
}

function context(campaign, mode){
  return { schemaVersion:2, campaignId:campaign.campaignId, revision:Number(campaign.revision || 0), mode:mode || (campaign.members.length > 1 ? "gather" : "solo"), roomName:campaign.roomName, memberUserIds:campaign.members.map((member) => Number(member.userId)), parentCampaignId:campaign.parentCampaignId || "" };
}

function create({ payload, members, name, parentCampaignId = "", sourceRevision = 0, saveKind = "manual", campaignId = newId() }){
  if(!validPayload(payload) || !members?.length) throw new Error("invalid_payload");
  const now = Date.now();
  const campaign = { schemaVersion:2, campaignId, revision:1, roomName:nameOf(name), createdAt:now, updatedAt:now, members:clone(members), payload:clone(payload), backups:[], manualSave:null, parentCampaignId, sourceRevision:Number(sourceRevision || 0), saveKind, savedAt:new Date(now).toISOString() };
  campaign.payload.campaignContext = context(campaign);
  campaign.payload.schemaVersion = 2;
  campaign.payload.savedAt = campaign.savedAt;
  const checkpoint = { revision:1, savedAt:campaign.savedAt, saveKind, payload:clone(campaign.payload) };
  if(saveKind === "auto") campaign.backups = [checkpoint];
  else campaign.manualSave = checkpoint;
  return campaign;
}

function save(campaign, payload, { name, saveKind = "manual", mode } = {}){
  if(Number(campaign.schemaVersion) !== 2) throw new Error("legacy_copy_required");
  if(!validPayload(payload)) throw new Error("invalid_payload");
  const next = clone(campaign);
  next.revision = Number(campaign.revision || 0) + 1;
  next.updatedAt = Date.now();
  next.savedAt = new Date(next.updatedAt).toISOString();
  next.saveKind = saveKind === "auto" ? "auto" : "manual";
  if(name) next.roomName = nameOf(name);
  next.payload = clone(payload);
  next.payload.schemaVersion = 2;
  next.payload.savedAt = next.savedAt;
  next.payload.campaignContext = context(next, mode);
  const checkpoint = { revision:next.revision, savedAt:next.savedAt, saveKind:next.saveKind, payload:clone(next.payload) };
  if(next.saveKind === "auto") next.backups = [checkpoint, ...(next.backups || [])].slice(0, 5);
  else next.manualSave = checkpoint;
  return next;
}

function checkpoint(campaign, revision){
  return [...(campaign.backups || []), ...(campaign.manualSave ? [campaign.manualSave] : [])].find((entry) => Number(entry.revision) === Number(revision)) || null;
}

function copy(campaign, identity, { backupRevision, legacyBranch = false, name } = {}){
  const member = campaign.members.find((entry) => Number(entry.userId) === Number(identity.userId));
  if(!member) throw new Error("not_campaign_member");
  let source = Number(campaign.schemaVersion) === 2 ? campaign.payload : campaign.basePayload;
  if(legacyBranch) source = campaign.branchRecords?.[member.key]?.payload;
  if(backupRevision != null){
    const backup = checkpoint(campaign, backupRevision);
    if(!backup) throw new Error("backup_not_found");
    source = backup.payload;
  }
  if(!validPayload(source)) throw new Error("campaign_missing_save");
  // Human-to-human negotiations cannot become a single-owner CPU world in place.
  // Leave the original snapshot intact so its original members can finish them.
  if(source.gameState.activeTrade || source.gameState.activeSpar || source.battleState?.isSparBattle) throw new Error("copy_flow_busy");
  const payload = clone(source);
  // Preserve every original character and world event; change only control ownership.
  payload.gameState.players.forEach((player) => {
    const owner = Number(player.userId ?? player.id) === Number(identity.userId);
    if(Number(player.userId ?? player.id) > 0){
      player.isCPU = !owner; player.isCpu = false; player.cpu = false;
      player.isProxyCPU = !owner; player.proxyOwnerUserId = owner ? 0 : Number(player.userId ?? player.id);
    }
  });
  return create({ payload, members:[{ ...member, seatIndex:payload.gameState.players.findIndex((player) => Number(player.userId ?? player.id) === Number(identity.userId)) }], name:name || `${campaign.roomName || "航海錄"}・個人副本`, parentCampaignId:campaign.campaignId, sourceRevision:backupRevision ?? campaign.revision ?? 0 });
}

module.exports = { clone, validPayload, newId, nameOf, progress, membersFromRoom, context, create, save, checkpoint, copy };
