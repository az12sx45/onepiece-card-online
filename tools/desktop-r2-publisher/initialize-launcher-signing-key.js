'use strict';

const crypto = require('node:crypto');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  ALGORITHM,
  computeKeyId,
  importPublicKey,
  publicKeySpkiBase64
} = require('./launcher-manifest-signature');

const STORE_FILE_NAME = 'launcher-signing-key.json';

function fail(message) {
  throw new Error(message);
}

function keyStorePath(env = process.env) {
  const localAppData = String(env.LOCALAPPDATA || '').trim();
  if (process.platform !== 'win32') fail('Launcher production signing-key initialization is supported only on Windows.');
  if (!localAppData || !path.win32.isAbsolute(localAppData)) fail('LOCALAPPDATA is unavailable or invalid.');
  return path.join(localAppData, 'ONEPIECE-Tabletop', 'publisher', STORE_FILE_NAME);
}

function protectWithCurrentUserDpapi(privateKeyPkcs8Base64) {
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "[void][Reflection.Assembly]::Load('System.Security, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b03f5f7f11d50a3a')",
    '$value = [Console]::In.ReadToEnd().Trim()',
    "if ([string]::IsNullOrWhiteSpace($value)) { throw 'Private key input is empty.' }",
    '$plainBytes = [Text.Encoding]::UTF8.GetBytes($value)',
    '$protectedBytes = $null',
    'try {',
    '  $protectedBytes = [Security.Cryptography.ProtectedData]::Protect($plainBytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)',
    '  [Console]::Out.Write([Convert]::ToBase64String($protectedBytes))',
    '} finally {',
    '  if ($null -ne $plainBytes) { [Array]::Clear($plainBytes, 0, $plainBytes.Length) }',
    '  if ($null -ne $protectedBytes) { [Array]::Clear($protectedBytes, 0, $protectedBytes.Length) }',
    '}'
  ].join('; ');
  const encodedCommand = Buffer.from(script, 'utf16le').toString('base64');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encodedCommand], {
    input: privateKeyPkcs8Base64,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1024 * 1024
  });
  if (result.error) fail(`Windows DPAPI protection could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`Windows DPAPI protection failed: ${String(result.stderr || '').trim() || `exit ${result.status}`}`);
  const protectedValue = String(result.stdout || '').trim();
  if (
    !protectedValue || protectedValue === privateKeyPkcs8Base64 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(protectedValue) || Buffer.from(protectedValue, 'base64').toString('base64') !== protectedValue
  ) {
    fail('Windows DPAPI returned an invalid protected private key.');
  }
  return protectedValue;
}

function validateStoredDocument(document) {
  if (!document || typeof document !== 'object' || Array.isArray(document)) fail('Existing launcher signing-key document is invalid.');
  const keys = Object.keys(document).sort();
  const expected = ['algorithm', 'createdAt', 'keyId', 'privateKeyPkcs8Protected', 'provider', 'publicKeySpkiBase64', 'schema'].sort();
  if (JSON.stringify(keys) !== JSON.stringify(expected)) fail('Existing launcher signing-key document has unexpected fields.');
  if (document.schema !== 1 || document.provider !== 'windows-dpapi' || document.algorithm !== ALGORITHM) {
    fail('Existing launcher signing-key document has an unsupported schema.');
  }
  const publicKey = importPublicKey(document.publicKeySpkiBase64);
  const expectedKeyId = computeKeyId(publicKey);
  if (document.keyId !== expectedKeyId) fail('Existing launcher signing keyId does not match its public key.');
  if (
    typeof document.privateKeyPkcs8Protected !== 'string' ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(document.privateKeyPkcs8Protected) ||
    Buffer.from(document.privateKeyPkcs8Protected, 'base64').toString('base64') !== document.privateKeyPkcs8Protected
  ) {
    fail('Existing launcher signing-key document has no valid DPAPI ciphertext.');
  }
  if (typeof document.createdAt !== 'string' || !Number.isFinite(Date.parse(document.createdAt))) {
    fail('Existing launcher signing-key document has an invalid createdAt value.');
  }
  return document;
}

async function readExisting(filePath) {
  try {
    const info = await fsp.lstat(filePath);
    if (!info.isFile() || info.isSymbolicLink() || info.size < 10 || info.size > 64 * 1024) {
      fail('Existing launcher signing-key path is not a safe regular file.');
    }
    return validateStoredDocument(JSON.parse(await fsp.readFile(filePath, 'utf8')));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    if (error instanceof SyntaxError) fail(`Existing launcher signing-key JSON is invalid: ${error.message}`);
    throw error;
  }
}

async function createKeyStore(filePath) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const privateDer = privateKey.export({ format: 'der', type: 'pkcs8' });
  const publicSpki = publicKeySpkiBase64(publicKey);
  const keyId = computeKeyId(publicKey);
  let privateBase64 = privateDer.toString('base64');
  let protectedValue;
  try {
    protectedValue = protectWithCurrentUserDpapi(privateBase64);
  } finally {
    privateDer.fill(0);
    privateBase64 = '';
  }
  const document = {
    schema: 1,
    provider: 'windows-dpapi',
    algorithm: ALGORITHM,
    keyId,
    publicKeySpkiBase64: publicSpki,
    privateKeyPkcs8Protected: protectedValue,
    createdAt: new Date().toISOString()
  };
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, `${JSON.stringify(document, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600
  });
  const persisted = validateStoredDocument(JSON.parse(await fsp.readFile(filePath, 'utf8')));
  return persisted;
}

function parseArguments(argv) {
  const options = { json: false, help: false };
  for (const argument of argv) {
    if (argument === '--json') options.json = true;
    else if (argument === '--help' || argument === '-h') options.help = true;
    else fail(`Unknown argument: ${argument}`);
  }
  return options;
}

function publicResult(status, filePath, document) {
  return {
    ok: true,
    status,
    algorithm: document.algorithm,
    keyId: document.keyId,
    publicKeySpkiBase64: document.publicKeySpkiBase64,
    keyStorePath: filePath,
    createdAt: document.createdAt
  };
}

async function main(argv = process.argv.slice(2), env = process.env) {
  const options = parseArguments(argv);
  if (options.help) {
    process.stdout.write('Usage: node initialize-launcher-signing-key.js [--json]\n');
    process.stdout.write('Creates one Ed25519 key in the current Windows user DPAPI store, or reports the existing public key.\n');
    return { ok: true, help: true };
  }
  const filePath = keyStorePath(env);
  const existing = await readExisting(filePath);
  const document = existing || await createKeyStore(filePath);
  const result = publicResult(existing ? 'existing' : 'created', filePath, document);
  if (options.json) process.stdout.write(`${JSON.stringify(result)}\n`);
  else {
    process.stdout.write(
      `LAUNCHER_SIGNING_KEY_INIT=PASS status=${result.status} algorithm=${result.algorithm} ` +
      `keyId=${result.keyId} publicKeySpkiBase64=${result.publicKeySpkiBase64} path=${result.keyStorePath}\n`
    );
  }
  return result;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`LAUNCHER_SIGNING_KEY_INIT=FAIL ${String(error?.message || error)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  STORE_FILE_NAME,
  createKeyStore,
  keyStorePath,
  main,
  protectWithCurrentUserDpapi,
  readExisting,
  validateStoredDocument
};
