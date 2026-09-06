'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const MAIN_PATH = path.join(ROOT, 'desktop', 'main.js');
const FUNCTION_NAME = 'configureGpuPreference';

function extractFunction(source, functionName) {
  const start = source.indexOf(`function ${functionName}(`);
  assert(start >= 0, `${functionName} is missing from desktop/main.js.`);
  const bodyStart = source.indexOf('{', start);
  assert(bodyStart >= 0, `${functionName} has no function body.`);

  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1] || '';
    if (lineComment) {
      if (character === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`${functionName} has an unterminated function body.`);
}

function commandLineFixture(initialSwitches = []) {
  const switches = new Set(initialSwitches);
  const appended = [];
  return {
    appended,
    hasSwitch(name) {
      return switches.has(name);
    },
    appendSwitch(name) {
      appended.push(name);
      switches.add(name);
    }
  };
}

function run() {
  const source = fs.readFileSync(MAIN_PATH, 'utf8');
  const functionSource = extractFunction(source, FUNCTION_NAME);
  const configureGpuPreference = vm.runInNewContext(`(${functionSource})`, Object.create(null), {
    filename: 'desktop/main.js#configureGpuPreference'
  });

  const software = commandLineFixture(['disable-gpu', 'force_low_power_gpu']);
  assert.equal(configureGpuPreference(software), 'software', 'disable-gpu must take precedence.');
  assert.deepEqual(software.appended, [], 'Software mode must not append another GPU preference.');

  const lowPower = commandLineFixture(['force_low_power_gpu']);
  assert.equal(configureGpuPreference(lowPower), 'low-power', 'Explicit low-power preference must be preserved.');
  assert.deepEqual(lowPower.appended, [], 'Low-power mode must not append a conflicting preference.');

  const highPerformance = commandLineFixture();
  assert.equal(configureGpuPreference(highPerformance), 'high-performance');
  assert.deepEqual(highPerformance.appended, ['force_high_performance_gpu']);
  assert.equal(configureGpuPreference(highPerformance), 'high-performance');
  assert.deepEqual(
    highPerformance.appended,
    ['force_high_performance_gpu'],
    'Repeated configuration must not append the high-performance switch twice.'
  );

  const existingHighPerformance = commandLineFixture(['force_high_performance_gpu']);
  assert.equal(configureGpuPreference(existingHighPerformance), 'high-performance');
  assert.deepEqual(existingHighPerformance.appended, [], 'An existing high-performance preference must be idempotent.');

  const invocation = 'const GPU_PREFERENCE = configureGpuPreference(app.commandLine);';
  const invocationIndex = source.indexOf(invocation);
  assert(invocationIndex >= 0, 'The GPU preference must be applied through the reviewed top-level declaration.');
  assert.equal(source.indexOf(invocation, invocationIndex + invocation.length), -1, 'GPU preference must be applied exactly once.');
  assert(source.indexOf(`function ${FUNCTION_NAME}(`) < invocationIndex, 'GPU preference function must be defined before invocation.');

  const electronRequireIndex = source.search(/require\(['"]electron['"]\)/);
  const projectRequireIndex = source.search(/require\(['"]\.\/[^'"]+['"]\)/);
  const browserWindowIndex = source.indexOf('new BrowserWindow(');
  const whenReadyIndex = source.indexOf('app.whenReady()');
  assert(electronRequireIndex >= 0 && electronRequireIndex < invocationIndex, 'Electron app must exist before GPU preference is applied.');
  assert(projectRequireIndex < 0 || invocationIndex < projectRequireIndex, 'GPU preference must run before loading project modules.');
  assert(browserWindowIndex < 0 || invocationIndex < browserWindowIndex, 'GPU preference must run before creating a BrowserWindow.');
  assert(whenReadyIndex >= 0 && invocationIndex < whenReadyIndex, 'GPU preference must run before app.whenReady().');
  assert(!source.includes('app.disableHardwareAcceleration()'), 'The launcher must preserve Electron hardware acceleration.');

  console.log(
    'DESKTOP_GPU_PREFERENCE_QA=PASS software=PASS lowPower=PASS highPerformance=PASS ' +
    'idempotent=PASS beforeProjectModules=PASS beforeBrowserWindow=PASS beforeReady=PASS hardwareAgnostic=PASS'
  );
}

try {
  run();
} catch (error) {
  console.error(`DESKTOP_GPU_PREFERENCE_QA=FAIL ${error.stack || error}`);
  process.exitCode = 1;
}
