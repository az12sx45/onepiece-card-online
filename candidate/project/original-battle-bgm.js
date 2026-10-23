'use strict';
exports.hold=function(window){
function battleHostBgmManager() {
    const candidates = [];
    try {
      if (window.parent && window.parent !== window) candidates.push(window.parent);
    } catch (_error) {}
    try {
      if (window.opener && !window.opener.closed) candidates.push(window.opener);
    } catch (_error) {}
    candidates.push(window);
    for (const candidate of candidates) {
      try {
        if (candidate?.BgmManager) return candidate.BgmManager;
      } catch (_error) {
        // Cross-origin or closing windows cannot provide the shared BGM manager.
      }
    }
    return null;
  }
function holdBgmForLucciRokuogan() {
    const manager = battleHostBgmManager();
    if (!manager) return null;
    let previousStatus = {};
    try {
      previousStatus = typeof manager.status === "function" ? manager.status() : {};
    } catch (_error) {}
    const shouldResume = previousStatus.enabled !== false && !!previousStatus.currentChoice;
    let unlockAutoSwitch = null;
    try {
      unlockAutoSwitch = manager.lockAutoSwitch?.("lucci-rokuogan");
      const fadePromise = manager.fadeOut?.(0);
      if (fadePromise?.catch) fadePromise.catch(() => {});
    } catch (_error) {
      // Missing or blocked BGM controls fall back to the visual and voice channels.
    }
    let restored = false;
    return {
      restore() {
        if (restored) return;
        restored = true;
        try {
          unlockAutoSwitch?.();
        } catch (_error) {}
        let latestStatus = {};
        try {
          latestStatus = typeof manager.status === "function" ? manager.status() : {};
        } catch (_error) {}
        if (!shouldResume || latestStatus.enabled === false) return;
        try {
          const fadePromise = manager.fadeIn?.(520);
          if (fadePromise?.catch) fadePromise.catch(() => {});
        } catch (_error) {
          // BGM restoration is optional and must not block the next battle action.
        }
      },
    };
  }
return holdBgmForLucciRokuogan();
};
