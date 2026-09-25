'use strict';

const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  if (typeof callback !== 'function') return () => {};
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('onePieceDesktop', Object.freeze({
  getState: () => ipcRenderer.invoke('launcher:get-state'),
  enterPreview: () => ipcRenderer.invoke('launcher:enter-preview'),
  login: (credentials) => ipcRenderer.invoke('launcher:login', credentials),
  register: (credentials) => ipcRenderer.invoke('launcher:register', credentials),
  logout: () => ipcRenderer.invoke('launcher:logout'),
  setDisplayName: (name) => ipcRenderer.invoke('launcher:set-display-name', name),
  getLauncherProfile: (userId = 0) => ipcRenderer.invoke('launcher:get-profile', userId),
  saveLauncherCard: (card) => ipcRenderer.invoke('launcher:card-set', card),
  getLauncherShop: (options) => ipcRenderer.invoke('launcher:get-shop', options),
  buyLauncherItem: (itemId) => ipcRenderer.invoke('launcher:buy-item', itemId),
  equipLauncherItem: (itemId) => ipcRenderer.invoke('launcher:equip-item', itemId),
  getLauncherComments: (userId = 0, beforeId = 0) => ipcRenderer.invoke('launcher:comments-get', userId, beforeId),
  postLauncherComment: (userId, body) => ipcRenderer.invoke('launcher:comment-post', userId, body),
  deleteLauncherComment: (messageId) => ipcRenderer.invoke('launcher:comment-delete', messageId),
  saveLauncherDecorationPlacement: (slot, placement) => ipcRenderer.invoke('launcher:decoration-placement-set', slot, placement),
  saveLauncherRoom: (room) => ipcRenderer.invoke('launcher:room-set', room),
  getLauncherCharacter: (itemId) => ipcRenderer.invoke('launcher:character-get', itemId),
  interactLauncherCharacter: (itemId, action) => ipcRenderer.invoke('launcher:character-interact', itemId, action),
  startLauncherCharacterWork: (itemId) => ipcRenderer.invoke('launcher:character-work-start', itemId),
  claimLauncherCharacterWork: (itemId) => ipcRenderer.invoke('launcher:character-work-claim', itemId),
  socialRequest: (action, payload) => ipcRenderer.invoke('launcher:social-request', action, payload),
  getSocialState: () => ipcRenderer.invoke('launcher:get-social-state'),
  onSocialState: (callback) => subscribe('launcher:social-state', callback),
  setPreferences: (preferences) => ipcRenderer.invoke('launcher:set-preferences', preferences),
  getLauncherUpdateState: () => ipcRenderer.invoke('launcher:get-update-state'),
  checkLauncherUpdate: () => ipcRenderer.invoke('launcher:check-update'),
  downloadLauncherUpdate: () => ipcRenderer.invoke('launcher:download-update'),
  applyLauncherUpdate: () => ipcRenderer.invoke('launcher:apply-update'),
  installGame: (gameId) => ipcRenderer.invoke('launcher:install-game', gameId),
  cancelInstall: (gameId) => ipcRenderer.invoke('launcher:cancel-install', gameId),
  uninstallGame: (gameId) => ipcRenderer.invoke('launcher:uninstall-game', gameId),
  launchGame: (gameId) => ipcRenderer.invoke('launcher:launch-game', gameId),
  chooseCacheLocation: () => ipcRenderer.invoke('launcher:choose-cache-location'),
  onState: (callback) => subscribe('launcher:state', callback),
  onProgress: (callback) => subscribe('launcher:progress', callback),
  onLauncherUpdate: (callback) => subscribe('launcher:update-state', callback),
  onSessionKicked: (callback) => subscribe('launcher:session-kicked', callback)
}));
