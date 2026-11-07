'use strict';

const assert = require('node:assert/strict');

// Expose the internal reward function only in a disposable local test browser.
// The server still serves its original bytes, and all other contexts see them.
async function installCrewLevelUpQaRoute(context, baseUrl) {
  const { hostname, origin, protocol } = new URL(baseUrl);
  assert.ok(['http:', 'https:'].includes(protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(hostname), 'Level-up QA route requires a local test server');
  const marker = '  window.__BOARD_GAME_DEBUG__ = {';
  const fixtureHook = '__BOARD_LEVEL_UP_QA_GRANT_EXP__';
  await context.route(url => url.origin === origin && url.pathname === '/js/board_game.js', async route => {
    assert.equal(route.request().method(), 'GET');
    const response = await route.fetch({ maxRedirects: 0 });
    assert.equal(response.status(), 200, 'Expected the local Board program');
    const source = await response.text();
    assert.equal(source.split(marker).length, 2, 'Expected a unique injection anchor');
    assert.ok(!source.includes(fixtureHook) && !source.includes('crewLevelUpQa'), 'Test hook leaked into the unmodified Board program');
    assert.match(source, /\bfunction grantExpToLivingCrew\(/);
    const body = source.replace(marker, `  window.${fixtureHook} = grantExpToLivingCrew;\n${marker}`);
    await route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body });
  });
}

module.exports = { installCrewLevelUpQaRoute };
