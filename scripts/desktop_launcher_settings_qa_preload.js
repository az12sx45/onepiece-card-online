'use strict';

const { contextBridge } = require('electron');

let state = {
  authenticated: true,
  previewMode: true,
  profile: { username: 'settings-qa' },
  cacheRoot: 'D:\\ONE PIECE TABLETOP SERIES',
  freeBytes: 128 * 1024 * 1024 * 1024,
  preferences: {
    minimizeToTrayOnGameLaunch: false,
    gameDisplayMode: 'borderless'
  },
  games: {
    card: { status: 'installed', hasInstalled: true, installedVersion: 'qa' },
    board: { status: 'installed', hasInstalled: true, installedVersion: 'qa' },
    chess: { status: 'not-installed', hasInstalled: false, remoteVersion: 'assets-chess-qa', totalFiles: 1, totalBytes: 1024 }
  }
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function result() {
  return { ok: true, ...clone(state) };
}

contextBridge.exposeInMainWorld('onePieceDesktop', Object.freeze({
  getState: async () => result(),
  enterPreview: async () => result(),
  login: async () => result(),
  register: async () => result(),
  logout: async () => ({ ok: true }),
  setPreferences: async (preferences) => {
    state = {
      ...state,
      preferences: {
        ...state.preferences,
        ...(preferences || {})
      }
    };
    return { ok: true, state: clone(state) };
  },
  getLauncherUpdateState: async () => ({
    ok: true,
    state: {
      status: 'current',
      currentVersion: '1.1.5',
      availableVersion: '',
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      error: ''
    }
  }),
  checkLauncherUpdate: async () => ({ ok: true, state: { status: 'current', currentVersion: '1.1.5' } }),
  downloadLauncherUpdate: async () => ({ ok: false, error: 'QA fixture has no downloadable update.' }),
  applyLauncherUpdate: async () => ({ ok: false, error: 'QA fixture has no applicable update.' }),
  installGame: async () => ({ ok: false, error: 'Not used by settings QA.' }),
  cancelInstall: async () => ({ ok: false, error: 'Not used by settings QA.' }),
  uninstallGame: async () => ({ ok: false, error: 'Not used by settings QA.' }),
  launchGame: async () => ({ ok: false, error: 'Not used by settings QA.' }),
  chooseCacheLocation: async () => ({ ok: false, error: 'Not used by settings QA.' }),
  onState: () => () => {},
  onProgress: () => () => {},
  onLauncherUpdate: () => () => {},
  onSessionKicked: () => () => {},
  getSettingsQaState: async () => clone(state)
}));
