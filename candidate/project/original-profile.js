'use strict';
// Exact original profile helpers; native authenticated context supplies storage.
exports.seedFields=[{"key":"op_user_id","field":"userId","fallback":""},{"key":"op_board_user_id","field":"userId","fallback":""},{"key":"op_name","field":"name","fallback":""},{"key":"op_player_name","field":"name","fallback":""},{"key":"op_avatar","field":"avatar","fallback":""},{"key":"op_player_avatar","field":"avatar","fallback":""},{"key":"op_board_title","field":"title","fallback":""},{"key":"op_board_coins","field":"coins","fallback":"0"}];
exports.create=function(host){
const {window,localStorage,sessionStorage,URLSearchParams}=host,location=window.location;
const PORTABLE_ASSET_VERSION = "20260831-portable-prefetch-v397";
const STORAGE_KEYS = {
    boardRoom: "op_board_preview_room",
    boardLobby: "op_board_preview_lobby",
    boardClientId: "op_board_client_id",
    boardUserId: "op_board_user_id",
    deviceId: "op_device_id",
    friendDockCollapsed: "op_fdock_collapsed",
  };
const MOCK_PROFILE = {
    userId: 10001,
    name: "草帽路飛",
    avatar: 8,
    coins: 12880,
    title: "新世界啟航者",
    titleTier: 5,
    wins: 24,
    rank: "Grand Line S",
  };
function clamp(n, min, max) {
    return Math.min(max, Math.max(min, Number(n) || 0));
  }
function avatarUrlById(id) {
    const avatarId = clamp(id, 1, 2000);
    const portableAssets = new URLSearchParams(window.location.search).get("portable_assets") === "1";
    const directory = portableAssets && avatarId <= 50
      ? "images/board/mobile/avatars"
      : "images/board/avatars";
    const version = portableAssets && avatarId <= 50 ? `?v=${PORTABLE_ASSET_VERSION}` : "";
    return `${directory}/${avatarId}.webp${version}`;
  }
function readJson(key, fallback) {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }
function writeJson(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }
function readLocalValue(key, fallback = "") {
    try {
      return localStorage.getItem(key) || fallback;
    } catch {
      return fallback;
    }
  }
function writeLocalValue(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch {}
  }
function getDeviceId() {
    let deviceId = String(readLocalValue(STORAGE_KEYS.deviceId, "") || "").trim();
    if (!deviceId) {
      deviceId = `dev_${randomIdFragment()}`;
      writeLocalValue(STORAGE_KEYS.deviceId, deviceId);
    }
    return deviceId;
  }
function randomIdFragment() {
    if (window.crypto?.getRandomValues) {
      const buffer = new Uint32Array(2);
      window.crypto.getRandomValues(buffer);
      return `${buffer[0].toString(36)}${buffer[1].toString(36)}`;
    }
    return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}`;
  }
function storedLobbyProfile() {
    const lobby = readJson(STORAGE_KEYS.boardLobby, null);
    const queryRoom = new URLSearchParams(location.search).get("room") || "";
    const lobbyRoom = lobby?.roomCode || lobby?.roomId || "";
    if (queryRoom && String(lobbyRoom).toUpperCase() !== String(queryRoom).trim().toUpperCase()) return null;
    const players = Array.isArray(lobby?.players) ? lobby.players : [];
    const storedUserId = Number(readLocalValue(STORAGE_KEYS.boardUserId, ""));
    const storedClientId = String(readLocalValue(STORAGE_KEYS.boardClientId, "") || "").trim();
    return players.find((player) => player && player.isMe && Number(player.userId) > 0)
      || players.find((player) => player && Number.isFinite(storedUserId) && storedUserId > 0 && Number(player.userId) === storedUserId)
      || players.find((player) => player && storedClientId && String(player.clientId || "") === storedClientId)
      || players.find((player) => player && Number(player.userId) === Number(lobby?.hostUserId) && Number(player.userId) > 0)
      || null;
  }
function stableBoardClientId(fallback = "") {
    let clientId = String(readLocalValue(STORAGE_KEYS.boardClientId, "") || "").trim();
    const fallbackClientId = String(fallback || "").trim();
    if (fallbackClientId && !fallbackClientId.startsWith("board-cpu-") && clientId !== fallbackClientId) {
      clientId = fallbackClientId;
      writeLocalValue(STORAGE_KEYS.boardClientId, clientId);
    }
    if (!clientId) {
      clientId = `board-${randomIdFragment()}`;
      writeLocalValue(STORAGE_KEYS.boardClientId, clientId);
    }
    return clientId;
  }
function stableBoardUserId(fallback = 0) {
    const existing = Number(readLocalValue(STORAGE_KEYS.boardUserId, ""));
    const fallbackUserId = Number(fallback);
    if (Number.isFinite(fallbackUserId) && fallbackUserId > 0 && fallbackUserId !== MOCK_PROFILE.userId) {
      if (existing !== fallbackUserId) writeLocalValue(STORAGE_KEYS.boardUserId, fallbackUserId);
      return fallbackUserId;
    }
    if (Number.isFinite(existing) && existing > 0 && existing !== MOCK_PROFILE.userId) return existing;
    const generated = 700000 + Math.floor(Math.random() * 800000);
    writeLocalValue(STORAGE_KEYS.boardUserId, generated);
    return generated;
  }
function createProfile() {
    const storedPlayer = storedLobbyProfile();
    const clientId = stableBoardClientId(storedPlayer?.clientId);
    const cloudUserId = Number(readLocalValue("op_user_id", ""));
    const userId = stableBoardUserId(Number.isFinite(cloudUserId) && cloudUserId > 0 ? cloudUserId : storedPlayer?.userId);
    const secret = String(readLocalValue("op_secret", "") || readLocalValue("opSecret", "") || "").trim();
    const name = String(
      readLocalValue("op_name", "") ||
      readLocalValue("op_player_name", "") ||
      storedPlayer?.name ||
      `玩家${String(userId).slice(-4)}`
    ).trim() || `玩家${String(userId).slice(-4)}`;
    const avatar = clamp(
      readLocalValue("op_avatar", "") || readLocalValue("op_player_avatar", "") || storedPlayer?.avatar || MOCK_PROFILE.avatar,
      1,
      2000
    );
    const title = String(readLocalValue("op_board_title", "") || storedPlayer?.title || MOCK_PROFILE.title).trim() || MOCK_PROFILE.title;
    const coins = Math.max(0, Number(readLocalValue("op_board_coins", "") || storedPlayer?.coins || MOCK_PROFILE.coins) || 0);
    return {
      ...MOCK_PROFILE,
      userId,
      clientId,
      name,
      avatar,
      avatarUrl: avatarUrlById(avatar),
      title,
      coins,
      secret,
    };
  }
return {STORAGE_KEYS,clamp,avatarUrlById,readJson,writeJson,readLocalValue,writeLocalValue,getDeviceId,randomIdFragment,storedLobbyProfile,stableBoardClientId,stableBoardUserId,createProfile};
};
