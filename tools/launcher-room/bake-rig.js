'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dependencies = require('./rig-dependencies');
const { chromium } = dependencies.playwright();
async function main() {
  const file = path.resolve(process.argv[2]), kind = process.argv[3] || 'walk', out = path.resolve(process.argv[4] || path.join(__dirname, 'rig-build'));
  if (!['walk', 'actions'].includes(kind)) throw Error('Usage: node bake-rig.js spec.json walk|actions out-directory');
  const spec = JSON.parse(fs.readFileSync(file, 'utf8')), images = {}, sourceHashes = {};
  for (const [key, relative] of Object.entries(spec.images)) {
    const bytes = fs.readFileSync(path.resolve(path.dirname(file), relative));
    images[key] = 'data:image/png;base64,' + bytes.toString('base64'); sourceHashes[key] = crypto.createHash('sha256').update(bytes).digest('hex');
  }
  const browser = await chromium.launch(dependencies.launchOptions(chromium));
  try {
    const page = await browser.newPage(); await page.addScriptTag({ path: path.join(__dirname, 'rig-engine.js') });
    const result = await page.evaluate(async ({ spec, images, kind }) => {
      const loaded = {};
      for (const [key, url] of Object.entries(images)) { const image = new Image(); image.src = url; await image.decode(); loaded[key] = image; }
      const slopes = kind === 'walk' && ['north', 'south'].includes(spec.direction) ? [-.52, -.26, 0, .26, .52] : [0];
      const rigs = slopes.map(floorSlope => RoomRigBuilder.create(spec, loaded, { floorSlope })), gate = rigs[0].validateActions();
      if (kind === 'actions' && !gate.ok) throw Error('Cannot bake action atlas: ' + gate.missing.join(', '));
      const count = 32, columns = 8, rows = 4 * slopes.length, cell = spec.output.cell;
      const atlas = document.createElement('canvas'), strip = document.createElement('canvas'), preview = document.createElement('canvas');
      atlas.width = columns * cell; atlas.height = rows * cell; strip.width = count * 96; strip.height = slopes.length * 96; preview.width = columns * 96; preview.height = rows * 96;
      const a = atlas.getContext('2d'), s = strip.getContext('2d'), p = preview.getContext('2d');
      for (const [context, canvas] of [[s, strip], [p, preview]]) { context.fillStyle = '#253440'; context.fillRect(0, 0, canvas.width, canvas.height); }
      const variants = [], actionFrames = {}; let edgeAlpha = 0, maxWorldSupportDrift = 0, maxReach = 0, maxLift = 0;
      for (const [variant, rig] of rigs.entries()) {
        const frames = [];
        for (let i = 0; i < count; i++) {
          const frame = document.createElement('canvas'); frame.width = frame.height = cell;
          const action = kind === 'actions' ? gate.order[Math.floor(i / 4)] : null, actionBeat = kind === 'actions' ? [0, .5, 1, .5][i % 4] : 0;
          const context = frame.getContext('2d'), pose = rig.draw(context, { time: kind === 'walk' ? i / count * rig.cycle : 0, action, actionBeat });
          const rgba = context.getImageData(0, 0, cell, cell).data; let bbox = [cell, cell, -1, -1];
          for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) if (rgba[(y * cell + x) * 4 + 3] > 32) {
            bbox = [Math.min(bbox[0], x), Math.min(bbox[1], y), Math.max(bbox[2], x), Math.max(bbox[3], y)];
            if (x === 0 || y === 0 || x === cell - 1 || y === cell - 1) edgeAlpha++;
          }
          const row = Math.floor(i / columns) + variant * 4;
          a.drawImage(frame, i % columns * cell, row * cell); s.drawImage(frame, i * 96, variant * 96, 96, 96); p.drawImage(frame, i % columns * 96, row * 96, 96, 96);
          if (action) (actionFrames[action] || (actionFrames[action] = new Set())).add(frame.toDataURL());
          frames.push({ index: i, phase: i / count, action, actionBeat, bbox, pose });
        }
        variants.push({ slope: slopes[variant], startFrame: variant * 32, framesData: frames });
        for (let i = 0; i < 1200; i++) {
          const t = i / 1200 * rig.cycle, pose = rig.pose(t);
          for (const side of ['near', 'far']) {
            const x = rig.foot(t, side), y = rig.foot(t + 1e-6, side);
            if (x.stance && y.stance && Math.abs(x.phase - y.phase) < .1) maxWorldSupportDrift = Math.max(maxWorldSupportDrift, Math.hypot(x.world[0] - y.world[0], x.world[1] - y.world[1]) * rig.stageScale);
            maxReach = Math.max(maxReach, pose[side].reachError * rig.stageScale); maxLift = Math.max(maxLift, x.lift * rig.stageScale);
          }
        }
      }
      const center = variants.find(value => value.slope === 0);
      return { atlas: atlas.toDataURL('image/png').split(',')[1], strip: strip.toDataURL('image/png').split(',')[1], preview: preview.toDataURL('image/png').split(',')[1], report: {
        character: spec.character, direction: spec.direction, kind, frames: count, totalCells: count * slopes.length, columns, rows, cell, assetPixels: [atlas.width, atlas.height], root: spec.output.root,
        gaitMode: spec.gait.mode || (['north', 'south'].includes(spec.direction) ? 'depth' : 'side'), gaitMetricsOnly: kind === 'actions', stageWidth: spec.output.stageWidth,
        stride: spec.gait.stride, speed: spec.gait.speed, edgeAlpha, maxWorldSupportDrift, maxReach, maxLift, maxHeldFrameRootTravel: spec.gait.stride / count,
        sourceImages: spec.images, distinctActionFrames: Object.fromEntries(Object.entries(actionFrames).map(([key, value]) => [key, value.size])), visualAcceptance: false,
        framesData: center.framesData, slopeVariants: variants
      } };
    }, { spec, images, kind });
    fs.mkdirSync(out, { recursive: true }); const prefix = `${spec.character}-${spec.direction}-${kind}`;
    for (const [key, suffix] of [['atlas', '.png'], ['strip', '-strip.png'], ['preview', '-preview.png']]) fs.writeFileSync(path.join(out, prefix + suffix), Buffer.from(result[key], 'base64'));
    result.report.sourceHashes = sourceHashes; fs.writeFileSync(path.join(out, prefix + '-report.json'), JSON.stringify(result.report, null, 2));
    if (result.report.edgeAlpha) throw Error(`Atlas frame boundary contains ${result.report.edgeAlpha} actor pixels; inspect padding, export is not approved`);
    const manifestFile = path.join(out, 'motion-manifest.json'), manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : { schema: 'one-piece-room-motion/2', buildStatus: 'DRAFT', characters: {} };
    manifest.shape = { walk: { columns: 8, rows: 4, frames: 32, cell: spec.output.cell, root: spec.output.root, depth: { rows: 20, totalCells: 160, slopeVariants: [-.52, -.26, 0, .26, .52] } }, actions: { columns: 8, rows: 4, frames: 32, actionCount: 8, beatsPerAction: 4, cell: spec.output.cell, root: spec.output.root } };
    const character = manifest.characters[spec.character] || (manifest.characters[spec.character] = { stride: {}, speed: {}, root: spec.output.root, standingFrame: 0, directions: {} });
    character.stride[spec.direction] = spec.gait.stride; character.speed[spec.direction] = spec.gait.speed;
    character.directions[spec.direction] = { ...(character.directions[spec.direction] || {}), [kind]: prefix + '.png' };
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
    console.log(JSON.stringify({ output: out, ...result.report, framesData: undefined, slopeVariants: result.report.slopeVariants.map(({ slope, startFrame }) => ({ slope, startFrame })) }));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
