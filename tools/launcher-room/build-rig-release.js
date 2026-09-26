'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const CHARACTERS = ['luffy', 'zoro', 'nami', 'usopp', 'sanji', 'chopper', 'robin', 'franky', 'brook', 'jinbe'];
const DIRECTIONS = ['east', 'west', 'north', 'south'];
const MANIFEST = 'docs/LAUNCHER_ROOM_MOTION_ART_20260926.json';
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); };
const relative = (root, file) => path.relative(root, file).split(path.sep).join('/');
function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw Error(`${path.basename(command)} failed: ${result.error?.message || result.stderr || result.stdout}`);
  return result.stdout.trim();
}
function copy(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (path.resolve(source) !== path.resolve(destination)) fs.copyFileSync(source, destination);
  if (sha(source) !== sha(destination)) throw Error(`Copy digest mismatch: ${source}`);
}
function main() {
  const args = process.argv.slice(2), options = {};
  for (let i = 0; i < args.length; i++) {
    if (['--plan', '--root'].includes(args[i])) options[args[i].slice(2)] = args[++i];
    else if (['--require-complete', '--require-reviewed', '--reuse-bakes'].includes(args[i])) options[args[i].slice(2)] = true;
    else throw Error('Usage: node build-rig-release.js --plan selected.json [--root DIRECTORY] [--require-complete] [--require-reviewed]');
  }
  if (!options.plan) throw Error('--plan is required');
  const planPath = path.resolve(options.plan), plan = read(planPath), root = path.resolve(options.root || path.join(__dirname, '../..'));
  if (plan.schema !== 'one-piece-room-rig-plan/1' || plan.version !== '1.1.13' || !Array.isArray(plan.entries) || !plan.entries.length) throw Error('Unsupported or empty selection plan');
  const identities = new Set();
  for (const entry of plan.entries) {
    const id = `${entry.character}-${entry.direction}`;
    if (!CHARACTERS.includes(entry.character) || !DIRECTIONS.includes(entry.direction) || identities.has(id)) throw Error(`Invalid or duplicate selection: ${id}`);
    identities.add(id);
    for (const key of ['spec', 'source', 'receipt']) if (!entry[key] || !fs.statSync(path.resolve(path.dirname(planPath), entry[key]), { throwIfNoEntry: false })?.isFile()) throw Error(`Missing ${key} for ${id}`);
  }
  const manifestPath = path.join(root, MANIFEST), previous = fs.existsSync(manifestPath) ? read(manifestPath) : null;
  if (previous && previous.schema !== 'one-piece-room-rig-art/1') throw Error('Refusing to overwrite an unrelated historical art manifest');
  const items = new Map((previous?.items || []).map(item => [item.asset, item]));
  const toolHashes = Object.fromEntries(['rig-engine.js', 'bake-rig.js', 'encode-rig-atlas.py', 'build-rig-release.js'].map(name => [name, sha(path.join(__dirname, name))]));
  const toolsDir = path.join(root, 'tools/launcher-room');
  for (const name of ['rig-engine.js', 'bake-rig.js', 'rig-dependencies.js', 'encode-rig-atlas.py', 'build-rig-release.js', 'build-room-art.js', 'build-rig-portraits.py', 'record-rig-review.js', 'suggest-rig.py', 'validate-rig-manifest.js', 'README-rig.md']) copy(path.join(__dirname, name), path.join(toolsDir, name));
  for (const entry of plan.entries) {
    const id = `${entry.character}-${entry.direction}`, originalSpec = path.resolve(path.dirname(planPath), entry.spec);
    const spec = read(originalSpec);
    if (spec.character !== entry.character || spec.direction !== entry.direction || !spec.images.sheet) throw Error(`Spec/source identity differs: ${id}`);
    if (JSON.stringify(spec.output.root) !== '[128,224]' || spec.output.cell !== 256 || spec.output.stageWidth !== 96) throw Error(`Unsupported output root/scale contract: ${id}`);
    const specPath = path.join(toolsDir, `rig-specs/${id}.json`), receiptPath = path.join(toolsDir, `motion-receipts/${id}.json`), sourceImages = {};
    for (const [name, imagePath] of Object.entries(spec.images)) {
      if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(name)) throw Error(`Unsafe image key: ${name}`);
      const selected = entry.sources?.[name], source = selected?.source ? path.resolve(path.dirname(planPath), selected.source) : name === 'sheet' ? path.resolve(path.dirname(planPath), entry.source) : path.resolve(path.dirname(originalSpec), imagePath);
      if (sha(path.resolve(path.dirname(originalSpec), imagePath)) !== sha(source)) throw Error(`Selected source differs from spec image: ${id}/${name}`);
      const foundReceipt = ['-provenance.json', '-source-canon-status.json'].map(suffix => source.replace(/\.png$/i, suffix)).find(value => fs.existsSync(value));
      const originalReceipt = selected?.receipt ? path.resolve(path.dirname(planPath), selected.receipt) : name === 'sheet' ? path.resolve(path.dirname(planPath), entry.receipt) : foundReceipt;
      if (!originalReceipt) throw Error(`Missing GPT receipt for ${id}/${name}; specify entry.sources.${name}.receipt`);
      const suffix = name === 'sheet' ? id : `${id}-${name}`, sourcePath = path.join(toolsDir, `motion-source-png/${suffix}.png`);
      const provenancePath = path.join(toolsDir, `motion-receipts/${suffix}-gpt.json`), rawTarget = path.join(toolsDir, `motion-receipts/${suffix}-gpt-original.json`);
      copy(source, sourcePath); const provenance = read(originalReceipt); let rawReceipt;
      if (typeof provenance.prompt !== 'string' || !provenance.prompt.trim()) throw Error(`GPT provenance needs the actual prompt: ${id}/${name}`);
      if (/\.txt$/i.test(provenance.prompt.trim()) && !provenance.prompt.includes('\n')) {
        const promptPath = path.resolve(path.dirname(originalReceipt), provenance.prompt); copy(originalReceipt, rawTarget);
        provenance.promptFile = provenance.prompt; provenance.prompt = fs.readFileSync(promptPath, 'utf8');
        provenance.originalReceipt = path.basename(rawTarget); provenance.originalReceiptSha256 = sha(rawTarget); write(provenancePath, provenance);
        rawReceipt = { path: relative(root, rawTarget), sha256: sha(rawTarget) };
      } else {
        copy(originalReceipt, provenancePath);
        if (provenance.originalReceipt) {
          const rawSource = [path.join(path.dirname(originalReceipt), path.basename(rawTarget)), path.resolve(path.dirname(originalReceipt), provenance.originalReceipt)].find(value => fs.existsSync(value));
          if (!rawSource || sha(rawSource) !== provenance.originalReceiptSha256) throw Error(`Original GPT receipt digest differs: ${id}/${name}`);
          copy(rawSource, rawTarget); rawReceipt = { path: relative(root, rawTarget), sha256: sha(rawTarget) };
        }
      }
      sourceImages[name] = { sourcePng: relative(root, sourcePath), sourceSha256: sha(sourcePath), provenance: relative(root, provenancePath), provenanceSha256: sha(provenancePath), rawReceipt };
      spec.images[name] = `../motion-source-png/${suffix}.png`;
    }
    write(specPath, spec);
    const sourceHashes = Object.fromEntries(Object.entries(sourceImages).map(([name, source]) => [name, source.sourceSha256]));
    if (entry.review?.status === 'reviewed') {
      const reviewedSources = entry.review.sourceHashes || { sheet: entry.review.sourceSha256 };
      if (JSON.stringify(Object.entries(reviewedSources).sort()) !== JSON.stringify(Object.entries(sourceHashes).sort()) || entry.review.specSha256 !== sha(originalSpec) || entry.review.rendererSha256 !== toolHashes['rig-engine.js'] || entry.review.bakerSha256 !== toolHashes['bake-rig.js']) throw Error(`Review is not bound to the selected sources, spec and renderer: ${id}`);
    }
    const review = { status: 'pending', ...entry.review, sourceSha256: sourceImages.sheet.sourceSha256, sourceHashes, originalSpecSha256: sha(originalSpec), rigSpecSha256: sha(specPath), rendererSha256: toolHashes['rig-engine.js'], bakerSha256: toolHashes['bake-rig.js'], evidence: [] };
    if (!['pending', 'reviewed'].includes(review.status)) throw Error(`Unknown review status: ${id}`);
    for (const [index, value] of (entry.review?.evidence || []).entries()) {
      const evidencePath = path.resolve(path.dirname(planPath), typeof value === 'string' ? value : value.path);
      const target = path.join(toolsDir, `motion-reviews/${id}-${index}${path.extname(evidencePath)}`);
      copy(evidencePath, target); review.evidence.push({ path: relative(root, target), sha256: sha(target) });
    }
    if (review.status === 'reviewed' && (!review.reviewer || !review.notes || !review.evidence.length)) throw Error(`Reviewed art needs named reviewer, notes and actual evidence: ${id}`);
    write(receiptPath, { schema: 'one-piece-room-rig-receipt/1', character: entry.character, direction: entry.direction, ...sourceImages.sheet, sourceImages, originalSpecSha256: sha(originalSpec), rigSpec: relative(root, specPath), rigSpecSha256: sha(specPath), selectedPlanSha256: sha(planPath), review });
    const bakeDir = path.join(toolsDir, `rig-build/${id}`);
    const directionItems = [];
    for (const [kind, bakeKind] of [['motion', 'walk'], ['acting', 'actions']]) {
      const prefix = `${entry.character}-${entry.direction}-${bakeKind}`, reportPath = path.join(bakeDir, `${prefix}-report.json`), renderPng = path.join(bakeDir, prefix + '.png');
      const asset = `public/images/launcher_room/${kind}_v2/${entry.character}/${entry.direction}.webp`, assetPath = path.join(root, asset);
      const prior = items.get(asset);
      const sameSources = prior && JSON.stringify(Object.entries(prior.sourceImages).map(([name, source]) => [name, source.sourceSha256]).sort()) === JSON.stringify(Object.entries(sourceHashes).sort());
      const reuse = options['reuse-bakes'] && sameSources && prior?.rigSpecSha256 === sha(specPath) && prior.rendererHashes['rig-engine.js'] === toolHashes['rig-engine.js'] && prior.rendererHashes['bake-rig.js'] === toolHashes['bake-rig.js'] && fs.existsSync(renderPng) && fs.existsSync(reportPath) && sha(reportPath) === prior.bakeReportSha256 && (!prior.sourceRenderSha256 || sha(renderPng) === prior.sourceRenderSha256);
      if (!reuse) run(process.execPath, [path.join(__dirname, 'bake-rig.js'), specPath, bakeKind, bakeDir]);
      const report = read(reportPath);
      const encoding = JSON.parse(run(process.env.LAUNCHER_ROOM_PYTHON || 'python', [path.join(__dirname, 'encode-rig-atlas.py'), renderPng, assetPath, '--cell', '128']));
      const center = report.slopeVariants.findIndex(variant => variant.slope === 0);
      items.set(asset, { key: entry.character, direction: entry.direction, kind, asset, assetBytes: encoding.bytes, assetSha256: encoding.sha256,
        assetPixels: encoding.assetPixels, anchor: encoding.anchor, scale: spec.output.canonicalScale * .5,
        output: { ...spec.output, cell: 128, root: encoding.anchor, canonicalScale: spec.output.canonicalScale * .5 }, renderOutput: spec.output,
        construction: 'GPT authored 12-piece kit; once-calibrated mesh/IK; 32 build-time rendered frames',
        sourcePng: sourceImages.sheet.sourcePng, sourceSha256: sourceImages.sheet.sourceSha256, sourceImages, rigSpec: relative(root, specPath), rigSpecSha256: sha(specPath),
        receipt: relative(root, receiptPath), receiptSha256: sha(receiptPath), bakeReport: relative(root, reportPath), bakeReportSha256: sha(reportPath),
        strideStagePixels: spec.gait.stride, speedStagePixels: spec.gait.speed, frames: report.framesData.map(frame => ({ index: frame.index, phase: frame.phase, action: frame.action, actionBeat: frame.actionBeat, bounds: encoding.frameBounds[center * 32 + frame.index], renderBounds: frame.bbox })),
        slopeVariants: report.slopeVariants.map((variant, vi) => ({ slope: variant.slope, startFrame: variant.startFrame, frames: variant.framesData.map(frame => ({ index: frame.index, bounds: encoding.frameBounds[vi * 32 + frame.index], renderBounds: frame.bbox })) })),
        sourceRenderPng: relative(root, renderPng), sourceRenderSha256: sha(renderPng),
        rendererHashes: toolHashes, encoding: { cleaning: encoding.cleaning, losslessRoundTrip: encoding.losslessRoundTrip, resize: encoding.resize }, review, visualAcceptance: false });
      directionItems.push(items.get(asset));
    }
    const assetHashes = Object.fromEntries(directionItems.map(item => [item.kind, item.assetSha256]));
    if (review.status === 'reviewed' && JSON.stringify(entry.review.assetHashes) !== JSON.stringify(assetHashes)) throw Error(`Reviewed atlas pixels changed: ${id}`);
    review.assetHashes = assetHashes;
    const receipt = read(receiptPath); receipt.review = review; write(receiptPath, receipt);
    for (const item of directionItems) item.receiptSha256 = sha(receiptPath);
    console.log(`Baked ${id}: walk32 + actions32; review=${review.status}`);
  }
  const ordered = [...items.values()].sort((a, b) => a.asset.localeCompare(b.asset));
  const complete = ordered.length === 80, reviewed = complete && ordered.every(item => item.review?.status === 'reviewed');
  const manifest = { schema: 'one-piece-room-rig-art/1', version: '1.1.13', canonicalCharactersOnly: true, construction: 'GPT bitmap parts animated by build-time mesh and IK', generatedAt: new Date().toISOString(), buildStatus: complete ? 'COMPLETE_CANDIDATE' : 'PARTIAL_CANDIDATE', expectedAssets: 80, expectedDirections: 40, allSelectedArtReviewed: reviewed, visualAcceptance: false, items: ordered };
  write(manifestPath, manifest);
  const data = { schema: 'one-piece-room-motion/2', shape: { walk: { columns: 8, rows: 4, frames: 32, cell: 128, root: [64, 112], depth: { rows: 20, totalCells: 160, slopeVariants: [-.52, -.26, 0, .26, .52] } }, actions: { columns: 8, rows: 4, frames: 32, actionCount: 8, beatsPerAction: 4, cell: 128, root: [64, 112] } }, characters: {} };
  for (const item of ordered.filter(item => item.kind === 'motion')) {
    const value = data.characters[item.key] || (data.characters[item.key] = { stride: {}, speed: {}, root: item.anchor, standingFrame: 0 });
    value.stride[item.direction] = item.strideStagePixels; value.speed[item.direction] = item.speedStagePixels;
  }
  const dataPath = path.join(root, 'desktop/launcher-room-motion-data.js');
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  fs.writeFileSync(dataPath, `/* Generated by tools/launcher-room/build-rig-release.js; stage pixels at 96px. */\n(function(root){'use strict';const data=${JSON.stringify(data, null, 2)};if(typeof module==='object'&&module.exports)module.exports=data;else root.OnePieceRoomMotionManifest=data;})(typeof globalThis==='object'?globalThis:this);\n`);
  const portablePath = value => path.relative(toolsDir, path.join(root, value)).split(path.sep).join('/');
  const portableEntries = ordered.filter(item => item.kind === 'motion').map(item => {
    const receipt = read(path.join(root, item.receipt));
    const sources = item.sourceImages || { sheet: { sourcePng: item.sourcePng, sourceSha256: item.sourceSha256, provenance: receipt.provenance } };
    return { character: item.key, direction: item.direction, spec: portablePath(item.rigSpec), source: portablePath(item.sourcePng), receipt: portablePath(sources.sheet.provenance),
      sources: Object.fromEntries(Object.entries(sources).map(([name, source]) => [name, { source: portablePath(source.sourcePng), receipt: portablePath(source.provenance) }])),
      review: { ...item.review, sourceSha256: item.sourceSha256, sourceHashes: Object.fromEntries(Object.entries(sources).map(([name, source]) => [name, source.sourceSha256])), specSha256: item.rigSpecSha256,
        evidence: item.review.evidence.map(value => portablePath(value.path)) } };
  });
  write(path.join(toolsDir, 'rig-selection.json'), { schema: plan.schema, version: plan.version, entries: portableEntries });
  if (options['require-complete'] && !complete) throw Error(`Candidate is partial: ${ordered.length}/80 atlases`);
  if (options['require-reviewed'] && !reviewed) throw Error('Candidate lacks explicit review evidence for every selected direction');
  console.log(JSON.stringify({ buildStatus: manifest.buildStatus, assets: ordered.length, manifest: manifestPath, allSelectedArtReviewed: reviewed, visualAcceptance: false }));
}
try { main(); } catch (error) { console.error(error.stack || error); process.exitCode = 1; }
