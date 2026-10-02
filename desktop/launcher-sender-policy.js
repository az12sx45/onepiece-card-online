'use strict';

const path = require('node:path');
const { pathToFileURL } = require('node:url');

const CONTENT_UI_URL = 'opui://launcher-ui/launcher.html';

function isTrustedLauncherUrl(senderUrl, bundledDirectory) {
  if (typeof senderUrl !== 'string' || typeof bundledDirectory !== 'string' || !path.isAbsolute(bundledDirectory)) return false;
  return senderUrl === CONTENT_UI_URL ||
    senderUrl === pathToFileURL(path.join(bundledDirectory, 'launcher.html')).href;
}

module.exports = { CONTENT_UI_URL, isTrustedLauncherUrl };
