const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(
  ROOT,
  "public/images/board/move_learn_ui/move_type_icons/incoming/move_type_icons_sprite_imagegen_source_v2_no_frame.png",
);
const OUTPUT_DIR = path.join(ROOT, "public/images/board/move_learn_ui/move_type_icons");
const OUTPUTS = [
  ["physical_attack.webp", 0, 0],
  ["special_attack.webp", 1, 0],
  ["buff.webp", 2, 0],
  ["debuff.webp", 0, 1],
  ["heal.webp", 1, 1],
  ["shield.webp", 2, 1],
  ["control.webp", 0, 2],
  ["status.webp", 1, 2],
];

function isConnectedBackdropPixel(data, index) {
  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];
  const high = Math.max(red, green, blue);
  const low = Math.min(red, green, blue);
  return low >= 30 && high - low <= 18;
}

async function main() {
  if (!fs.existsSync(SOURCE)) throw new Error(`Missing source image: ${SOURCE}`);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const source = sharp(SOURCE).ensureAlpha();
  const metadata = await source.metadata();
  if (metadata.width !== metadata.height || metadata.width % 3 !== 0) {
    throw new Error(`Expected an equally divided square 3x3 sheet, got ${metadata.width}x${metadata.height}`);
  }
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

  const cellSize = info.width / 3;
  const transparentSheet = sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  });
  for (const [filename, column, row] of OUTPUTS) {
    await transparentSheet
      .clone()
      .extract({ left: column * cellSize, top: row * cellSize, width: cellSize, height: cellSize })
      .resize(256, 256, { fit: "fill", kernel: sharp.kernel.lanczos3 })
      .webp({ lossless: true, effort: 6 })
      .toFile(path.join(OUTPUT_DIR, filename));
  }

  console.log(JSON.stringify({
    ok: true,
    source: SOURCE,
    sourceSize: `${info.width}x${info.height}`,
    removedBackdropPixels: tail,
    outputs: OUTPUTS.map(([filename]) => path.join(OUTPUT_DIR, filename)),
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
