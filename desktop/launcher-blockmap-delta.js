'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const zlib = require('node:zlib');

const MAX_BLOCKMAP_BYTES = 2 * 1024 * 1024;
const MAX_BLOCKMAP_JSON_BYTES = 16 * 1024 * 1024;
const MAX_BLOCKS = 250_000;
const MAX_RANGES = 512;
const MAX_RANGE_BYTES = 2 * 1024 * 1024;
const CHECKSUM_PATTERN = /^[A-Za-z0-9+/]{24}$/;

function deltaError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function parseBlockmap(bytes, expectedSize) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 2 || bytes.length > MAX_BLOCKMAP_BYTES) {
    throw deltaError('invalid_blockmap', '區塊圖大小不正確。');
  }
  let data;
  try {
    data = JSON.parse(zlib.gunzipSync(bytes, { maxOutputLength: MAX_BLOCKMAP_JSON_BYTES }).toString('utf8'));
  } catch {
    throw deltaError('invalid_blockmap', '區塊圖格式不正確。');
  }
  if (data?.version !== '2' || !Array.isArray(data.files) || data.files.length !== 1) {
    throw deltaError('invalid_blockmap', '不支援此區塊圖版本。');
  }
  const file = data.files[0];
  if (file?.name !== 'file' || file.offset !== 0 || !Array.isArray(file.sizes) ||
      !Array.isArray(file.checksums) || !file.sizes.length || file.sizes.length !== file.checksums.length ||
      file.sizes.length > MAX_BLOCKS) {
    throw deltaError('invalid_blockmap', '區塊圖檔案資訊不正確。');
  }
  let offset = 0;
  const blocks = file.sizes.map((size, index) => {
    const checksum = file.checksums[index];
    if (!Number.isSafeInteger(size) || size < 1 || size > 64 * 1024 ||
        typeof checksum !== 'string' || !CHECKSUM_PATTERN.test(checksum) ||
        Buffer.from(checksum, 'base64').length !== 18) {
      throw deltaError('invalid_blockmap', '區塊圖含無效區塊。');
    }
    const block = { offset, size, checksum };
    offset += size;
    if (!Number.isSafeInteger(offset) || offset > expectedSize) throw deltaError('invalid_blockmap', '區塊圖長度超出安裝檔。');
    return block;
  });
  if (offset !== expectedSize) throw deltaError('invalid_blockmap', '區塊圖長度與安裝檔不一致。');
  return blocks;
}

function planBlocks(oldBlocks, newBlocks) {
  const available = new Map();
  for (const block of oldBlocks) {
    const key = `${block.size}:${block.checksum}`;
    if (!available.has(key)) available.set(key, block.offset);
  }
  const operations = newBlocks.map((block) => ({
    ...block,
    oldOffset: available.get(`${block.size}:${block.checksum}`) ?? null
  }));
  const ranges = [];
  let downloadBytes = 0;
  for (const operation of operations) {
    if (operation.oldOffset !== null) continue;
    downloadBytes += operation.size;
    const last = ranges.at(-1);
    if (last && last.end === operation.offset && last.end - last.start + operation.size <= MAX_RANGE_BYTES) {
      last.end += operation.size;
    } else {
      ranges.push({ start: operation.offset, end: operation.offset + operation.size });
    }
  }
  return { operations, ranges, downloadBytes };
}

async function* chunks(response) {
  if (response?.body && typeof response.body[Symbol.asyncIterator] === 'function') {
    for await (const chunk of response.body) yield Buffer.from(chunk);
  } else if (response?.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader();
    try {
      while (true) {
        const item = await reader.read();
        if (item.done) break;
        yield Buffer.from(item.value);
      }
    } finally {
      reader.releaseLock?.();
    }
  } else {
    throw deltaError('invalid_response', '差分伺服器沒有回傳可讀取的內容。');
  }
}

function header(response, name) {
  return String(response?.headers?.get?.(name) || '').trim();
}

async function fetchBlockmap(fetchImpl, url, signal) {
  const response = await fetchImpl(url.href, {
    cache: 'no-store', redirect: 'error',
    headers: { Accept: 'application/octet-stream', 'Accept-Encoding': 'identity' }, signal
  });
  if (response?.status !== 200 || response.ok === false || (response.url && response.url !== url.href)) {
    throw deltaError('blockmap_http', '區塊圖無法取得。');
  }
  const length = header(response, 'content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BLOCKMAP_BYTES)) {
    throw deltaError('invalid_blockmap', '區塊圖超過大小限制。');
  }
  if (header(response, 'content-encoding') && header(response, 'content-encoding').toLowerCase() !== 'identity') {
    throw deltaError('invalid_blockmap', '區塊圖使用不支援的傳輸編碼。');
  }
  const parts = [];
  let size = 0;
  for await (const chunk of chunks(response)) {
    size += chunk.length;
    if (size > MAX_BLOCKMAP_BYTES) throw deltaError('invalid_blockmap', '區塊圖超過大小限制。');
    parts.push(chunk);
  }
  if (length && size !== Number(length)) throw deltaError('invalid_blockmap', '區塊圖下載長度不符。');
  return Buffer.concat(parts, size);
}

function sidecarUrls(artifactUrl, oldVersion) {
  const match = /^(.*\/releases\/)[^/]+\/ONE-PIECE-Tabletop-Launcher-[^/]+-x64\.exe$/.exec(artifactUrl.pathname);
  if (!match) return null;
  const oldFileName = `ONE-PIECE-Tabletop-Launcher-${oldVersion}-x64.exe`;
  return {
    oldFileName,
    old: new URL(`${match[1]}${oldVersion}/${oldFileName}.blockmap`, artifactUrl.origin),
    next: new URL(`${artifactUrl.pathname}.blockmap`, artifactUrl.origin)
  };
}

async function findOldInstaller(downloadRoot, version, fileName) {
  const entries = await fsp.readdir(downloadRoot, { withFileTypes: true }).catch(() => []);
  const expression = new RegExp(`^${version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-[a-f0-9]{16}$`);
  for (const entry of entries) {
    if (!entry.isDirectory() || !expression.test(entry.name)) continue;
    const candidate = path.join(downloadRoot, entry.name, fileName);
    const stat = await fsp.lstat(candidate).catch(() => null);
    if (stat?.isFile() && !stat.isSymbolicLink()) return { path: candidate, bytes: stat.size };
  }
  return null;
}

async function writeAt(handle, bytes, position) {
  let offset = 0;
  while (offset < bytes.length) {
    const result = await handle.write(bytes, offset, bytes.length - offset, position + offset);
    if (!result.bytesWritten) throw deltaError('write_failed', '無法寫入差分更新暫存檔。');
    offset += result.bytesWritten;
  }
}

async function copyAt(source, target, sourceOffset, targetOffset, size) {
  const bytes = Buffer.allocUnsafe(size);
  let read = 0;
  while (read < size) {
    const result = await source.read(bytes, read, size - read, sourceOffset + read);
    if (!result.bytesRead) throw deltaError('old_installer_changed', '舊安裝檔在差分重建時改變。');
    read += result.bytesRead;
  }
  await writeAt(target, bytes, targetOffset);
}

async function fetchRange(fetchImpl, url, range, totalSize, target, signal, onBytes) {
  const end = range.end - 1;
  const response = await fetchImpl(url.href, {
    cache: 'no-store', redirect: 'error',
    headers: { Accept: 'application/octet-stream', 'Accept-Encoding': 'identity', Range: `bytes=${range.start}-${end}` },
    signal
  });
  if (response?.status !== 206 || response.ok === false || (response.url && response.url !== url.href)) {
    throw deltaError('range_http', '伺服器未提供精確的差分區塊。');
  }
  const expected = range.end - range.start;
  if (header(response, 'content-range') !== `bytes ${range.start}-${end}/${totalSize}`) {
    throw deltaError('range_mismatch', '差分區塊範圍不正確。');
  }
  const length = header(response, 'content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) !== expected)) throw deltaError('range_mismatch', '差分區塊長度不正確。');
  if (header(response, 'content-encoding') && header(response, 'content-encoding').toLowerCase() !== 'identity') {
    throw deltaError('range_mismatch', '差分區塊使用不支援的傳輸編碼。');
  }
  let received = 0;
  for await (const chunk of chunks(response)) {
    received += chunk.length;
    if (received > expected) throw deltaError('range_mismatch', '差分區塊超過預期長度。');
    await writeAt(target, chunk, range.start + received - chunk.length);
    onBytes(chunk.length);
  }
  if (received !== expected) throw deltaError('range_mismatch', '差分區塊長度不足。');
}

async function rebuildInstaller({ artifactUrl, currentVersion, downloadRoot, partPath, expectedSize, fetchImpl, signal, onProgress }) {
  const urls = sidecarUrls(artifactUrl, currentVersion);
  if (!urls) return null;
  const previous = await findOldInstaller(downloadRoot, currentVersion, urls.oldFileName);
  if (!previous) return null;
  const [oldCompressed, nextCompressed] = await Promise.all([
    fetchBlockmap(fetchImpl, urls.old, signal),
    fetchBlockmap(fetchImpl, urls.next, signal)
  ]);
  const oldBlocks = parseBlockmap(oldCompressed, previous.bytes);
  const nextBlocks = parseBlockmap(nextCompressed, expectedSize);
  const plan = planBlocks(oldBlocks, nextBlocks);
  if (plan.downloadBytes >= expectedSize * 0.7 || plan.ranges.length > MAX_RANGES) return null;
  let oldHandle;
  let targetHandle;
  let downloaded = 0;
  try {
    oldHandle = await fsp.open(previous.path, 'r');
    targetHandle = await fsp.open(partPath, 'wx');
    await targetHandle.truncate(expectedSize);
    onProgress(0, plan.downloadBytes);
    for (const operation of plan.operations) {
      if (signal.aborted) throw deltaError('aborted', '差分更新已取消。');
      if (operation.oldOffset !== null) {
        await copyAt(oldHandle, targetHandle, operation.oldOffset, operation.offset, operation.size);
      }
    }
    for (const range of plan.ranges) {
      if (signal.aborted) throw deltaError('aborted', '差分更新已取消。');
      await fetchRange(fetchImpl, artifactUrl, range, expectedSize, targetHandle, signal, (size) => {
        downloaded += size;
        onProgress(downloaded, plan.downloadBytes);
      });
    }
    await targetHandle.sync();
    return { downloadedBytes: downloaded, totalBytes: plan.downloadBytes, reusedBytes: expectedSize - downloaded };
  } finally {
    await oldHandle?.close().catch(() => {});
    await targetHandle?.close().catch(() => {});
  }
}

module.exports = { findOldInstaller, parseBlockmap, planBlocks, rebuildInstaller, sidecarUrls };
