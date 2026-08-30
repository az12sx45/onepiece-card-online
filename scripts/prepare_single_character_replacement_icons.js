const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const SETS = [
  {
    source: "public/images/board/training_ui/stat_icons/incoming/training_stat_icons_sprite_imagegen_source_v1.png",
    outputDir: "public/images/board/training_ui/stat_icons",
    columns: 3,
    rows: 2,
    outputs: [
      ["hp.webp", 0, 0],
      ["atk.webp", 1, 0],
      ["def.webp", 2, 0],
      ["satk.webp", 0, 1],
      ["sdef.webp", 1, 1],
      ["spd.webp", 2, 1],
    ],
  },
  {
    source: "public/images/board/ship_info_ui/upgrade_icons/incoming/ship_upgrade_icons_sprite_imagegen_source_v1.png",
    outputDir: "public/images/board/ship_info_ui/upgrade_icons",
    columns: 3,
    rows: 2,
    outputs: [
      ["sail.webp", 0, 0],
      ["rudder.webp", 1, 0],
      ["watchtower.webp", 2, 0],
      ["kitchen.webp", 0, 1],
      ["training.webp", 1, 1],
    ],
  },
  {
    source: "public/images/board/judicial_raid_ui/reward_icons/incoming/judicial_reward_icons_sprite_imagegen_source_v1.png",
    outputDir: "public/images/board/judicial_raid_ui/reward_icons",
    columns: 3,
    rows: 3,
    outputs: [
      ["heal.webp", 0, 0],
      ["pp.webp", 1, 0],
      ["attack.webp", 2, 0],
      ["defense.webp", 0, 1],
      ["speed.webp", 1, 1],
      ["shield.webp", 2, 1],
      ["revive.webp", 0, 2],
      ["burst.webp", 1, 2],
      ["unknown.webp", 2, 2],
    ],
  },
  {
    source: "public/images/board/impel_down_ui/event_icons/incoming/impel_event_icons_sprite_imagegen_source_v1.png",
    outputDir: "public/images/board/impel_down_ui/event_icons",
    columns: 3,
    rows: 2,
    outputs: [
      ["patrol.webp", 0, 0],
      ["key.webp", 1, 0],
      ["magellan.webp", 2, 0],
      ["ivankov.webp", 0, 1],
      ["hidden.webp", 1, 1],
    ],
  },
  {
    source: "public/images/board/attribute_icons/incoming/attribute_icons_sprite_imagegen_source_v1.png",
    outputDir: "public/images/board/attribute_icons",
    columns: 2,
    rows: 2,
    outputs: [
      ["force.webp", 0, 0],
      ["speed.webp", 1, 0],
      ["technique.webp", 0, 1],
      ["neutral.webp", 1, 1],
    ],
  },
];

function isConnectedBackdropPixel(data, index) {
  if (data[index + 3] === 0) return true;
  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];
  const high = Math.max(red, green, blue);
  const low = Math.min(red, green, blue);
  return low >= 30 && high - low <= 18;
}

async function removeConnectedBackdrop(sourcePath) {
  const source = sharp(sourcePath).ensureAlpha();
  const metadata = await source.metadata();
  const { data, info } = await source.raw().toBuffer({ resolveWithObject: true });
  const pixelCount = info.width * info.height;
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let head = 0;
  let tail = 0;

  function addPixel(x, y) {
    if (x < 0 || y < 0 || x >= info.width || y >= info.height) return;
    const pixelIndex = y * info.width + x;
    if (visited[pixelIndex]) return;
    const dataIndex = pixelIndex * 4;
    if (!isConnectedBackdropPixel(data, dataIndex)) return;
    visited[pixelIndex] = 1;
    queue[tail] = pixelIndex;
    tail += 1;
  }

  for (let x = 0; x < info.width; x += 1) {
    addPixel(x, 0);
    addPixel(x, info.height - 1);
  }
  for (let y = 0; y < info.height; y += 1) {
    addPixel(0, y);
    addPixel(info.width - 1, y);
  }

  while (head < tail) {
    const pixelIndex = queue[head];
    head += 1;
    const x = pixelIndex % info.width;
    const y = Math.floor(pixelIndex / info.width);
    data[pixelIndex * 4 + 3] = 0;
    addPixel(x - 1, y);
    addPixel(x + 1, y);
    addPixel(x, y - 1);
    addPixel(x, y + 1);
  }

  return { data, info, metadata, removedBackdropPixels: tail };
}

function meaningfulAlphaBounds(data, info, threshold = 48) {
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * 4 + 3];
      if (alpha < threshold) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) return null;
  return { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1 };
}

async function normalizeIconCell(cell) {
  const { data, info } = await cell.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bounds = meaningfulAlphaBounds(data, info);
  if (!bounds) {
    return sharp({ create: { width: 256, height: 256, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .png()
      .toBuffer();
  }

  // Image-generation sprite cells do not guarantee that the visible artwork is
  // centred inside each grid cell. Crop around meaningful alpha, retain the glow,
  // then place every design on the same 256px transparent optical canvas.
  const padding = Math.max(8, Math.round(Math.max(bounds.width, bounds.height) * 0.06));
  const left = Math.max(0, bounds.left - padding);
  const top = Math.max(0, bounds.top - padding);
  const right = Math.min(info.width - 1, bounds.right + padding);
  const bottom = Math.min(info.height - 1, bounds.bottom + padding);
  const cropWidth = right - left + 1;
  const cropHeight = bottom - top + 1;
  const resized = await sharp(data, { raw: info })
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .resize(220, 220, { fit: "inside", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer({ resolveWithObject: true });
  const resizedRaw = await sharp(resized.data).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const resizedBounds = meaningfulAlphaBounds(resizedRaw.data, resizedRaw.info) || {
    left: 0,
    top: 0,
    right: resized.info.width - 1,
    bottom: resized.info.height - 1,
  };
  const outputLeft = Math.round(127.5 - ((resizedBounds.left + resizedBounds.right) / 2));
  const outputTop = Math.round(127.5 - ((resizedBounds.top + resizedBounds.bottom) / 2));
  return sharp({ create: { width: 256, height: 256, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: resized.data, left: outputLeft, top: outputTop }])
    .png()
    .toBuffer();
}

async function processSet(config) {
  const sourcePath = path.join(ROOT, config.source);
  const outputDir = path.join(ROOT, config.outputDir);
  if (!fs.existsSync(sourcePath)) throw new Error(`Missing source image: ${sourcePath}`);
  fs.mkdirSync(outputDir, { recursive: true });

  const transparent = await removeConnectedBackdrop(sourcePath);
  const { data, info } = transparent;
  if (info.width % config.columns !== 0 || info.height % config.rows !== 0) {
    throw new Error(`Cannot divide ${info.width}x${info.height} into ${config.columns}x${config.rows}: ${sourcePath}`);
  }
  const cellWidth = info.width / config.columns;
  const cellHeight = info.height / config.rows;
  const sheet = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });

  for (const [filename, column, row] of config.outputs) {
    const normalized = await normalizeIconCell(sheet
      .clone()
      .extract({ left: column * cellWidth, top: row * cellHeight, width: cellWidth, height: cellHeight }));
    await sharp(normalized)
      .webp({ lossless: true, effort: 6 })
      .toFile(path.join(outputDir, filename));
  }

  return {
    source: sourcePath,
    sourceSize: `${info.width}x${info.height}`,
    removedBackdropPixels: transparent.removedBackdropPixels,
    outputs: config.outputs.map(([filename]) => path.join(outputDir, filename)),
  };
}

async function main() {
  const results = [];
  for (const config of SETS) results.push(await processSet(config));
  const judicialUnknown = path.join(ROOT, "public/images/board/judicial_raid_ui/reward_icons/unknown.webp");
  const impelUnknown = path.join(ROOT, "public/images/board/impel_down_ui/event_icons/unknown.webp");
  await fs.promises.copyFile(judicialUnknown, impelUnknown);
  console.log(JSON.stringify({ ok: true, sets: results }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
