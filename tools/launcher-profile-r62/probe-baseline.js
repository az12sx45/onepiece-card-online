'use strict';
const { spec, hash, blob, get, write, writeExact, origin, preservedGames } = require('./common');
(async () => {
  const files = {};
  for (const name of ['launcher-content-v1.json', 'catalog-v3.json']) {
    const expected = blob(spec.baseline, 'public/desktop/' + name);
    const served = await get(origin + '/desktop/' + name);
    if (hash(served) !== hash(expected)) throw Error('Public baseline moved: ' + name);
    writeExact('baseline-' + name, expected);
    files[name] = { sha256: hash(served), bytes: served.length };
  }
  const games = preservedGames();
  write('baseline-report.json', { status: 'PASS', verifiedAt: new Date().toISOString(), baseline: spec.baseline, publicFiles: files, gameProgramsPreserved: games.files.length });
  console.log(JSON.stringify({ status: 'PASS', baseline: spec.baseline, publicFiles: files, gameProgramsPreserved: games.files.length }));
})().catch(e => { console.error(e.message); process.exitCode = 1; });
