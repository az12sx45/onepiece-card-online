'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const DESKTOP_ROOT = path.join(ROOT, 'desktop');
const REPORT_ARGUMENT = '--electron-report';

function waitForRenderer(webContents, expression, timeoutMs = 15_000) {
  return webContents.executeJavaScript(`new Promise((resolve, reject) => {
    const deadline = Date.now() + ${timeoutMs};
    const check = () => {
      try {
        if (${expression}) return resolve(true);
      } catch (_) {}
      if (Date.now() >= deadline) return reject(new Error('Timed out waiting for renderer state.'));
      setTimeout(check, 40);
    };
    check();
  })`, true);
}

async function runElectron(reportPath) {
  const { app, BrowserWindow } = require('electron');
  let exitCode = 1;
  try {
    await app.whenReady();
    const { AuthService } = require(path.join(DESKTOP_ROOT, 'auth-service.js'));
    const preferenceRoot = path.join(path.dirname(reportPath), 'preference-state');
    const preferenceService = new AuthService({ origin: 'https://onepiece-card-online.onrender.com', userDataPath: preferenceRoot });
    await preferenceService.load();
    const defaultPreferences = preferenceService.getPreferences();
    await preferenceService.setPreferences({ gameDisplayMode: 'fullscreen' });
    await preferenceService.setPreferences({ minimizeToTrayOnGameLaunch: true });
    let invalidRejected = false;
    try {
      await preferenceService.setPreferences({ gameDisplayMode: 'maximized' });
    } catch {
      invalidRejected = true;
    }
    preferenceService.close();
    const reloadedPreferenceService = new AuthService({ origin: 'https://onepiece-card-online.onrender.com', userDataPath: preferenceRoot });
    await reloadedPreferenceService.load();
    const persistedPreferences = reloadedPreferenceService.getPreferences();
    reloadedPreferenceService.close();
    const preferencePersistence = {
      defaultPreferences,
      persistedPreferences,
      invalidRejected,
      ok: defaultPreferences.gameDisplayMode === 'borderless' &&
        defaultPreferences.minimizeToTrayOnGameLaunch === false &&
        persistedPreferences.gameDisplayMode === 'fullscreen' &&
        persistedPreferences.minimizeToTrayOnGameLaunch === true &&
        invalidRejected
    };
    const window = new BrowserWindow({
      width: 1024,
      height: 768,
      show: false,
      backgroundColor: '#061520',
      webPreferences: {
        preload: path.join(__dirname, 'desktop_launcher_settings_qa_preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        webSecurity: true
      }
    });
    await window.loadFile(path.join(DESKTOP_ROOT, 'launcher.html'));
    await waitForRenderer(window.webContents, "document.body.dataset.stage === 'app' && document.querySelectorAll('.game-rail-item').length === 3");

    const report = await window.webContents.executeJavaScript(`(async () => {
      const settingsButton = document.querySelector('#settingsButton');
      settingsButton.click();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const dialog = document.querySelector('#settingsDialog');
      const radios = [...document.querySelectorAll('input[name="gameDisplayMode"]')];
      const updateCard = document.querySelector('#launcherUpdateCard');
      const updateAction = document.querySelector('#launcherUpdateAction');
      const dialogRect = dialog.getBoundingClientRect();
      const initial = {
        viewport: { width: innerWidth, height: innerHeight },
        dialogOpen: dialog.open,
        radioCount: radios.length,
        radioValues: radios.map((radio) => radio.value),
        checkedCount: radios.filter((radio) => radio.checked).length,
        checkedValue: radios.find((radio) => radio.checked)?.value || '',
        updateCardPresent: Boolean(updateCard),
        updateActionPresent: Boolean(updateAction),
        updateActionText: updateAction?.textContent?.trim() || '',
        dialogInsideViewport: dialogRect.left >= -0.5 && dialogRect.right <= innerWidth + 0.5,
        dialogHorizontalOverflow: dialog.scrollWidth > dialog.clientWidth + 1,
        documentHorizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1
      };

      const updateStateChecks = [];
      const captureUpdateState = (expectedStatus, expectedAction, progressVisible = false) => {
        updateStateChecks.push({
          expectedStatus,
          expectedAction,
          status: updateCard.dataset.status,
          action: updateAction.textContent.trim(),
          disabled: updateAction.disabled,
          progressVisible: !document.querySelector('#launcherUpdateProgress').hidden,
          ariaProgress: document.querySelector('#launcherUpdateProgress').getAttribute('aria-valuenow')
        });
      };
      mergeLauncherUpdateState({ status: 'available', currentVersion: '1.1.3', availableVersion: '1.1.4', totalBytes: 4096 });
      captureUpdateState('available', '下載更新');
      mergeLauncherUpdateState({ status: 'downloading', availableVersion: '1.1.4', progress: 37, downloadedBytes: 1516, totalBytes: 4096 });
      captureUpdateState('downloading', '下載中 37%', true);
      mergeLauncherUpdateState({ status: 'ready', availableVersion: '1.1.4', progress: 100, downloadedBytes: 4096, totalBytes: 4096 });
      captureUpdateState('ready', '安裝並重新啟動');
      mergeLauncherUpdateState({ status: 'applying', availableVersion: '1.1.4' });
      captureUpdateState('applying', '正在重新啟動…');
      const updateStateFlow = {
        checks: updateStateChecks,
        ok: updateStateChecks.every((check) =>
          check.status === check.expectedStatus &&
          check.action === check.expectedAction &&
          check.progressVisible === (check.expectedStatus === 'downloading') &&
          (check.expectedStatus !== 'downloading' || (check.disabled && check.ariaProgress === '37')) &&
          (check.expectedStatus !== 'applying' || check.disabled)
        )
      };
      mergeLauncherUpdateState({ status: 'current', currentVersion: '1.1.3', availableVersion: '', progress: 0, downloadedBytes: 0, totalBytes: 0 });

      document.querySelector('#gameDisplayFullscreen').click();
      document.querySelector('#settingsSave').click();
      const saveDeadline = Date.now() + 5000;
      while (dialog.open && Date.now() < saveDeadline) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      const savedState = await window.onePieceDesktop.getSettingsQaState();

      settingsButton.click();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const reopenedRadios = [...document.querySelectorAll('input[name="gameDisplayMode"]')];
      const reopened = {
        dialogOpen: dialog.open,
        checkedCount: reopenedRadios.filter((radio) => radio.checked).length,
        checkedValue: reopenedRadios.find((radio) => radio.checked)?.value || '',
        storedValue: savedState.preferences?.gameDisplayMode || ''
      };

      const ok = initial.dialogOpen &&
        initial.radioCount === 2 &&
        initial.radioValues.includes('borderless') &&
        initial.radioValues.includes('fullscreen') &&
        initial.checkedCount === 1 &&
        initial.checkedValue === 'borderless' &&
        initial.updateCardPresent &&
        initial.updateActionPresent &&
        initial.updateActionText.length > 0 &&
        updateStateFlow.ok &&
        initial.dialogInsideViewport &&
        !initial.dialogHorizontalOverflow &&
        !initial.documentHorizontalOverflow &&
        reopened.dialogOpen &&
        reopened.checkedCount === 1 &&
        reopened.checkedValue === 'fullscreen' &&
        reopened.storedValue === 'fullscreen';
      return { ok, initial, updateStateFlow, reopened };
    })()`, true);

    report.windowBounds = window.getBounds();
    report.preferencePersistence = preferencePersistence;
    report.ok = report.ok && preferencePersistence.ok && report.windowBounds.width === 1024 && report.windowBounds.height === 768;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    exitCode = report.ok ? 0 : 1;
    window.destroy();
  } catch (error) {
    fs.writeFileSync(reportPath, `${JSON.stringify({ ok: false, error: error.stack || String(error) }, null, 2)}\n`, 'utf8');
  } finally {
    app.exit(exitCode);
    process.exit(exitCode);
  }
}

function runNode() {
  const mainSource = fs.readFileSync(path.join(DESKTOP_ROOT, 'main.js'), 'utf8');
  for (const fragment of [
    "gameDisplayMode === 'fullscreen'",
    'fullscreen: shouldUseFullscreen',
    "titleBarStyle: 'hidden'",
    "color: '#071b27'",
    "input.key !== 'F11'",
    'window.setFullScreen(!window.isFullScreen())'
  ]) {
    if (!mainSource.includes(fragment)) throw new Error(`Game window display contract is missing: ${fragment}`);
  }
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'onepiece-launcher-settings-qa-'));
  const reportPath = path.join(fixtureRoot, 'report.json');
  const electronExecutable = require(path.join(DESKTOP_ROOT, 'node_modules', 'electron'));
  const child = spawnSync(electronExecutable, [__filename, REPORT_ARGUMENT, reportPath], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 60_000,
    windowsHide: true,
    env: {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true'
    }
  });
  let report = null;
  try {
    report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  } catch (_) {
    report = { ok: false, error: 'Electron settings QA did not create a readable report.' };
  }
  fs.rmSync(fixtureRoot, { recursive: true, force: true });

  if (child.status !== 0 || report.ok !== true) {
    throw new Error(`Electron settings QA failed: ${JSON.stringify({
      status: child.status,
      signal: child.signal,
      spawnError: child.error?.message || '',
      stderr: child.stderr,
      report
    })}`);
  }
  console.log(`DESKTOP_LAUNCHER_SETTINGS_QA=PASS window=${report.windowBounds.width}x${report.windowBounds.height} viewport=${report.initial.viewport.width}x${report.initial.viewport.height} radios=${report.initial.radioCount} selected=${report.initial.checkedValue} windowContract=PASS updateAction=${JSON.stringify(report.initial.updateActionText)} updateFlow=PASS overflow=none saved=${report.reopened.storedValue} reopened=${report.reopened.checkedValue} persisted=${report.preferencePersistence.persistedPreferences.gameDisplayMode} invalidRejected=${report.preferencePersistence.invalidRejected}`);
}

const reportIndex = process.argv.indexOf(REPORT_ARGUMENT);
if (process.versions.electron && reportIndex >= 0) {
  runElectron(path.resolve(process.argv[reportIndex + 1] || 'desktop-launcher-settings-report.json'));
} else {
  try {
    runNode();
  } catch (error) {
    console.error(`DESKTOP_LAUNCHER_SETTINGS_QA=FAIL ${error.stack || error}`);
    process.exitCode = 1;
  }
}
