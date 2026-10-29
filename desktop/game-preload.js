'use strict';

const { ipcRenderer } = require('electron');

try {
  const payload = ipcRenderer.sendSync('game:get-bootstrap') || {};
  const clearKeys = Array.isArray(payload.clearKeys) ? payload.clearKeys : [];
  for (const key of clearKeys) {
    if (typeof key === 'string') window.localStorage.removeItem(key);
  }
  const keys = payload.keys && typeof payload.keys === 'object' ? payload.keys : {};
  for (const [key, value] of Object.entries(keys)) {
    if (typeof key === 'string' && typeof value === 'string') window.localStorage.setItem(key, value);
  }
  window.localStorage.setItem('op_desktop_launcher', '1');
  if (typeof payload.cardMatchReturn?.room === 'string' && Number.isFinite(payload.cardMatchReturn.until)) {
    window.sessionStorage.setItem('op_resume_block_room', payload.cardMatchReturn.room);
    window.sessionStorage.setItem('op_resume_block_until', String(payload.cardMatchReturn.until));
    window.sessionStorage.removeItem('op_pending_join_room');
    window.sessionStorage.removeItem('op_pending_join_via');
  }
} catch {
  // The hosted page falls back to its normal login flow if bootstrap is unavailable.
}
