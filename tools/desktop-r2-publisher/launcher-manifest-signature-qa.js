'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const initializer = require('./initialize-launcher-signing-key');
const signature = require('./launcher-manifest-signature');

function unprotectWithCurrentUserDpapi(protectedValue) {
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "[void][Reflection.Assembly]::Load('System.Security, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b03f5f7f11d50a3a')",
    '$value = [Console]::In.ReadToEnd().Trim()',
    '$protectedBytes = [Convert]::FromBase64String($value)',
    '$plainBytes = $null',
    'try {',
    '  $plainBytes = [Security.Cryptography.ProtectedData]::Unprotect($protectedBytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)',
    '  [Console]::Out.Write([Text.Encoding]::UTF8.GetString($plainBytes))',
    '} finally {',
    '  if ($null -ne $protectedBytes) { [Array]::Clear($protectedBytes, 0, $protectedBytes.Length) }',
    '  if ($null -ne $plainBytes) { [Array]::Clear($plainBytes, 0, $plainBytes.Length) }',
    '}'
  ].join('; ');
  const encodedCommand = Buffer.from(script, 'utf16le').toString('base64');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encodedCommand], {
    input: protectedValue,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1024 * 1024
  });
  if (result.error || result.status !== 0) {
    throw new Error(`DPAPI QA unprotect failed: ${result.error?.message || String(result.stderr || '').trim() || result.status}`);
  }
  return String(result.stdout || '').trim();
}

function releaseDocument() {
  return {
    schema: 1,
    channel: 'stable',
    platform: 'win32',
    arch: 'x64',
    version: '1.1.3',
    publishedAt: '2026-09-06T00:00:00.000Z',
    artifact: {
      fileName: 'ONE-PIECE-Tabletop-Launcher-1.1.3-x64.exe',
      bytes: 123456,
      sha256: 'a'.repeat(64),
      url: 'https://game-assets.rihdi.tw/desktop/launcher/releases/1.1.3/ONE-PIECE-Tabletop-Launcher-1.1.3-x64.exe'
    }
  };
}

async function main() {
  const temporaryRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'onepiece-launcher-signature-qa-'));
  let privateDer = null;
  let privateBase64 = '';
  try {
    const pair = crypto.generateKeyPairSync('ed25519');
    privateDer = pair.privateKey.export({ format: 'der', type: 'pkcs8' });
    privateBase64 = privateDer.toString('base64');
    const publicKeySpki = signature.publicKeySpkiBase64(pair.publicKey);
    const keyId = signature.computeKeyId(pair.publicKey);
    const unsigned = releaseDocument();
    const inputPath = path.join(temporaryRoot, 'launcher-release-v1.unsigned.json');
    const outputPath = path.join(temporaryRoot, 'launcher-release-v1.signed-candidate.json');
    const inputBytes = `${JSON.stringify(unsigned, null, 2)}\n`;
    await fsp.writeFile(inputPath, inputBytes, { encoding: 'utf8', flag: 'wx' });

    const signed = signature.signReleaseDocument(unsigned, {
      privateKeyPkcs8Base64: privateBase64,
      publicKeySpki,
      keyId
    });
    assert.deepEqual(Object.keys(signed.signature), ['algorithm', 'keyId', 'value']);
    assert.equal(signed.signature.algorithm, 'Ed25519');
    assert.equal(Buffer.from(signed.signature.value, 'base64').length, 64);
    assert.equal(
      signature.canonicalPayloadBytes(unsigned).toString('utf8'),
      '{"schema":1,"channel":"stable","platform":"win32","arch":"x64","version":"1.1.3","publishedAt":"2026-09-06T00:00:00.000Z","artifact":{"fileName":"ONE-PIECE-Tabletop-Launcher-1.1.3-x64.exe","bytes":123456,"sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","url":"https://game-assets.rihdi.tw/desktop/launcher/releases/1.1.3/ONE-PIECE-Tabletop-Launcher-1.1.3-x64.exe"}}'
    );

    await signature.writeCandidate(outputPath, inputPath, signed);
    assert.equal(await fsp.readFile(inputPath, 'utf8'), inputBytes, 'signing must not modify the unsigned input');
    const persisted = JSON.parse(await fsp.readFile(outputPath, 'utf8'));
    assert.deepEqual(signature.verifyReleaseDocument(persisted, { publicKeySpki, expectedKeyId: keyId }), {
      ok: true,
      keyId,
      version: '1.1.3'
    });

    const tampered = structuredClone(persisted);
    tampered.artifact.bytes += 1;
    assert.throws(
      () => signature.verifyReleaseDocument(tampered, { publicKeySpki, expectedKeyId: keyId }),
      /signature verification failed/
    );
    const damagedSignature = structuredClone(persisted);
    const damagedSignatureBytes = Buffer.from(damagedSignature.signature.value, 'base64');
    damagedSignatureBytes[0] ^= 0x01;
    damagedSignature.signature.value = damagedSignatureBytes.toString('base64');
    assert.throws(
      () => signature.verifyReleaseDocument(damagedSignature, { publicKeySpki, expectedKeyId: keyId }),
      /signature verification failed/
    );
    const otherPair = crypto.generateKeyPairSync('ed25519');
    const otherPublic = signature.publicKeySpkiBase64(otherPair.publicKey);
    assert.throws(
      () => signature.verifyReleaseDocument(persisted, { publicKeySpki: otherPublic }),
      /keyId is not trusted/
    );
    await assert.rejects(
      signature.writeCandidate(outputPath, inputPath, signed),
      /already exists/
    );
    await assert.rejects(
      signature.writeCandidate(signature.FORMAL_RELEASE_PATH, inputPath, signed),
      /refuses to overwrite/
    );

    if (process.platform === 'win32') {
      const protectedValue = initializer.protectWithCurrentUserDpapi(privateBase64);
      assert.notEqual(protectedValue, privateBase64);
      assert.equal(unprotectWithCurrentUserDpapi(protectedValue), privateBase64);
    }
    process.stdout.write(
      `LAUNCHER_MANIFEST_SIGNATURE_QA=PASS algorithm=Ed25519 keyId=${keyId} ` +
      `dpapi=${process.platform === 'win32' ? 'verified' : 'skipped-non-windows'}\n`
    );
  } finally {
    if (privateDer) privateDer.fill(0);
    privateBase64 = '';
    await fsp.rm(temporaryRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`LAUNCHER_MANIFEST_SIGNATURE_QA=FAIL ${String(error?.stack || error)}\n`);
  process.exitCode = 1;
});
