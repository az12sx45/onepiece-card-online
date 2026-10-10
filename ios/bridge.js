'use strict';
// Reuse desktop validation and social contracts; native code owns secrets and files.
(() => {
  const listeners = new Map();
  const emit = (name, value) => { for (const fn of listeners.get(name) || []) fn(value); };
  const subscribe = (name, fn) => {
    if (typeof fn !== 'function') return () => {};
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name).add(fn);
    return () => listeners.get(name).delete(fn);
  };
  const native = (method, args = []) => window.webkit.messageHandlers.launcher.postMessage({ method, args });
  window.__iosEvent = emit;
  class MobileAuth extends window.IOSModules.auth.AuthService {
    async load() {
      const value = await native('loadSession');
      if (value.state) this.state = { ...this.state, ...value.state };
      this.secretMemory = value.secret || '';
      this.state.cacheRoot = 'iPhone App 儲存空間';
      return this.state;
    }
    encryptSecret() { return null; }
    async save() {
      const result = await native('saveSession', [{ state: this.state, secret: this.secretMemory }]);
      if (!result.ok) throw new Error('無法安全保存登入狀態');
    }
    async clearAccount() {
      this.secretMemory = '';
      this.state.account = null;
      this.emit('social-event', 'reset');
      await this.save();
      this.socket?.disconnect();
      this.socket = null;
    }
  }
  const auth = new MobileAuth({ origin: 'https://onepiece-card-online.onrender.com', userDataPath: '/ios' });
  const social = new window.IOSModules.social.SocialService(auth);
  let stateRevision = 0;
  let authenticated = false;
  let restoringSession = true;
  const ready = (async () => {
    await auth.load();
    const restored = await auth.restore();
    authenticated = restored.ok === true;
    restoringSession = false;
    if (authenticated) await social.start();
  })();
  async function getState() {
    await ready;
    return { ...await native('getAssetsState'), stateRevision: ++stateRevision, authenticated,
      restoringSession, previewMode: false, profile: authenticated ? auth.accountSummary() : null,
      preferences: auth.getPreferences() };
  }
  async function publish() { emit('state', await getState()); }
  subscribe('assets', publish);
  social.on('state', value => emit('social', value));
  auth.on('kicked', value => { authenticated = false; emit('kicked', value); publish(); });
  async function authenticate(mode, credentials) {
    await ready;
    let result;
    try { result = await auth.authenticate(mode, credentials); }
    catch (error) {
      const code = String(error?.message || 'offline');
      return { ok: false, error: ['offline', 'timeout'].includes(code) ? code : 'offline' };
    }
    if (result.ok) { authenticated = true; await social.start(); await publish(); }
    return { ...result, ...(result.ok ? { state: await getState() } : {}) };
  }
  const api = {
    getState,
    enterPreview: async () => ({ ok: false, error: '正式帳號測試版不提供略過登入' }),
    login: value => authenticate('login', value),
    register: value => authenticate('register', value),
    logout: async () => { await ready; await auth.clearAccount(); authenticated = false; await publish(); return { ok: true, state: await getState() }; },
    getSocialState: async () => { await ready; return { ok: true, state: social.snapshot() }; },
    socialRequest: async (...args) => { await ready; return social.request(...args); },
    setPreferences: async value => { await ready; await auth.setPreferences(value); await publish(); return { ok: true, state: await getState() }; },
    chooseCacheLocation: async () => ({ ok: false, error: 'iOS 使用 App 專屬儲存空間，無法選擇 Windows 磁碟路徑' }),
    launchGame: async id => { await ready; if (!authenticated) return { ok: false, error: 'not authenticated' }; return native('launchGame', [id, auth.getGameBootstrap()]); },
    onState: fn => subscribe('state', fn), onProgress: fn => subscribe('progress', fn),
    onSocialState: fn => subscribe('social', fn), onSessionKicked: fn => subscribe('kicked', fn),
    onLauncherUpdate: fn => subscribe('update', fn), onLauncherContentUpdate: fn => subscribe('content', fn)
  };
  for (const method of ['setDisplayName','getLauncherProfile','saveLauncherCard','getLauncherShop',
    'getLauncherAnnouncements','markLauncherAnnouncementsRead','buyLauncherItem','equipLauncherItem',
    'saveLauncherBgmPlaylist','getLauncherComments','postLauncherComment','deleteLauncherComment',
    'saveLauncherDecorationPlacement','saveLauncherRoom','getLauncherLife','commandLauncherLife',
    'getLauncherCharacter','interactLauncherCharacter','startLauncherCharacterWork','claimLauncherCharacterWork']) {
    api[method] = async (...args) => {
      await ready;
      if (!authenticated) return { ok: false, error: 'not authenticated' };
      const result = await auth[method](...args);
      if (result.ok && ['setDisplayName','buyLauncherItem','equipLauncherItem','claimLauncherCharacterWork'].includes(method)) await publish();
      return result;
    };
  }
  for (const method of ['installGame','cancelInstall','uninstallGame']) api[method] = async id => {
    await ready;
    if (!authenticated) return { ok: false, error: 'not authenticated' };
    const result = await native(method, [id]); await publish(); return result;
  };
  for (const method of ['getLauncherUpdateState','checkLauncherUpdate','downloadLauncherUpdate','applyLauncherUpdate',
    'getLauncherContentUpdateState','checkLauncherContentUpdate','applyLauncherContentUpdate']) {
    api[method] = () => native(method);
  }
  window.onePieceDesktop = Object.freeze(api);
  ready.then(publish).catch(error => { restoringSession = false; console.error('iOS 啟動失敗', error.message); });
})();
