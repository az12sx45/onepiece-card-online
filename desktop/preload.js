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
  installGame: (gameId) => ipcRenderer.invoke('launcher:install-game', gameId),
  cancelInstall: (gameId) => ipcRenderer.invoke('launcher:cancel-install', gameId),
  launchGame: (gameId) => ipcRenderer.invoke('launcher:launch-game', gameId),
  chooseCacheLocation: () => ipcRenderer.invoke('launcher:choose-cache-location'),
  onState: (callback) => subscribe('launcher:state', callback),
  onProgress: (callback) => subscribe('launcher:progress', callback),
  onSessionKicked: (callback) => subscribe('launcher:session-kicked', callback)
}));
