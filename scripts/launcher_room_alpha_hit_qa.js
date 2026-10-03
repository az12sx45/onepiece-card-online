'use strict';
// Chromium room interaction check against the shipped character/furniture art.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fixture = require('./launcher_life_integration_qa');
const out = process.env.LAUNCHER_ROOM_ALPHA_QA_OUT || 'D:/Codex_QA/launcher-room-alpha-hit';
fs.mkdirSync(out, { recursive: true });
const checks = [];
const pass = (name, value) => { assert(value, name); checks.push(name); console.log('PASS ' + name); };

async function scan(page, predicate) {
  return page.evaluate(source => {
    const test = new Function('p', 'top', 'under', source);
    const top = document.querySelector('#roomCharacters [data-room-key="c:room-character-luffy"]');
    const under = document.querySelector('#roomObjects [data-room-key="f:room-furniture-map-table"]');
    const stage = document.getElementById('roomStage').getBoundingClientRect();
    const a = top.getBoundingClientRect(), b = under.getBoundingClientRect();
    const left = Math.max(stage.left + 2, a.left + 1), right = Math.min(stage.right - 2, a.right - 1);
    const upper = Math.max(stage.top + 2, a.top + 1), lower = Math.min(stage.bottom - 2, a.bottom - 1);
    for (let y = upper; y < lower; y += 2) for (let x = left; x < right; x += 2) {
      const p = { x, y, hit: window.__launcherRoomTest.hitAt(x, y),
        inUnder: x >= b.left && x < b.right && y >= b.top && y < b.bottom,
        native: document.elementFromPoint(x, y)?.closest?.('[data-room-key]')?.dataset.roomKey || null };
      if (test(p, top, under)) return p;
    }
    return null;
  }, predicate);
}

async function main() {
  const browser = await fixture.chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  fixture.setBrowser(browser);
  let page;
  try {
    const setup = await fixture.create({ owned:['luffy'], furniture:[{ key:'map-table', col:7, row:2 }] });
    page = setup.page;
    await page.locator('#roomStage').scrollIntoViewIfNeeded();
    const metadata = await page.evaluate(() => ({size:window.OnePieceRoomAlphaMasks?.size,
      assets:Object.keys(window.OnePieceRoomAlphaMasks?.assets || {}).length,
      character:document.querySelector('#roomCharacters [data-room-key]')?.dataset.actionSource}));
    await page.locator('#roomStage').screenshot({path:path.join(out, 'room-alpha-hit-desktop.png')});
    pass('shipped 64px alpha masks load with room', metadata.size === 64 && metadata.assets >= 700);
    const visible = await scan(page, 'return p.hit === top.dataset.roomKey && p.native === top.dataset.roomKey && [[-3,0],[3,0],[0,-3],[0,3]].every(([dx,dy])=>window.__launcherRoomTest.hitAt(p.x+dx,p.y+dy)===top.dataset.roomKey)');
    const blank = await scan(page, 'return p.native === top.dataset.roomKey && p.hit === null && !p.inUnder && [[-3,0],[3,0],[0,-3],[0,3]].every(([dx,dy])=>window.__launcherRoomTest.hitAt(p.x+dx,p.y+dy)===null)');
    pass('visible character pixel and transparent character pixel differ', !!visible && !!blank);
    await page.mouse.click(visible.x, visible.y);
    await page.waitForFunction(() => !document.getElementById('roomCompanionPanel').hidden);
    pass('clicking painted character opens interaction', await page.locator('#roomCompanionPanel').isVisible());
    await page.locator('#roomCompanionClose').click();
    await page.mouse.click(blank.x, blank.y);
    pass('transparent character area does not open interaction', await page.locator('#roomCompanionPanel').isHidden());

    // Align the furniture anchor beneath the character while retaining the
    // real renderer and CSS stacking order. The character remains visually on top.
    await page.evaluate(() => {
      const top = document.querySelector('#roomCharacters [data-room-key]');
      const under = document.querySelector('#roomObjects [data-room-key]');
      under.style.left = top.style.left; under.style.top = top.style.top;
    });
    const through = await scan(page, 'return p.native === top.dataset.roomKey && p.hit === under.dataset.roomKey && p.inUnder && [[-2,0],[2,0],[0,-2],[0,2]].every(([dx,dy])=>window.__launcherRoomTest.hitAt(p.x+dx,p.y+dy)===under.dataset.roomKey)');
    pass('transparent top character passes through to painted furniture', !!through);
    await page.mouse.click(visible.x, visible.y);
    await page.waitForFunction(() => !document.getElementById('roomCompanionPanel').hidden);
    await page.evaluate(() => document.getElementById('roomLifeCall').click());
    pass('assignment starts from actual painted character', !!(await page.evaluate(() => window.__launcherRoomTest.snapshot().assignment)));
    await page.mouse.click(through.x, through.y);
    pass('click through character selects underlying furniture station',
      (await page.evaluate(() => window.__launcherRoomTest.snapshot().assignment)) === null);

    // A raised furnishing uses the same rule: its empty corners may expose a
    // character behind it, even though its rectangular shell is on top.
    const reverse = await page.evaluate(() => {
      document.getElementById('roomObjects').style.zIndex='4';
      document.getElementById('roomCharacters').style.zIndex='3';
      const top=document.querySelector('#roomObjects [data-room-key]');
      const below=document.querySelector('#roomCharacters [data-room-key]');
      const a=top.getBoundingClientRect(),b=below.getBoundingClientRect();
      for(let y=Math.max(a.top,b.top)+3;y<Math.min(a.bottom,b.bottom)-3;y+=2)
        for(let x=Math.max(a.left,b.left)+3;x<Math.min(a.right,b.right)-3;x+=2)
          if(document.elementFromPoint(x,y)?.closest?.('[data-room-key]')===top &&
              window.__launcherRoomTest.hitAt(x,y)===below.dataset.roomKey &&
              [[-2,0],[2,0],[0,-2],[0,2]].every(([dx,dy])=>window.__launcherRoomTest.hitAt(x+dx,y+dy)===below.dataset.roomKey))return{x,y};
      return null;
    });
    pass('transparent foreground furniture passes through to painted character', !!reverse);
    await page.mouse.click(reverse.x,reverse.y);
    await page.waitForFunction(() => !document.getElementById('roomCompanionPanel').hidden);
    pass('click through furniture opens underlying character interaction', await page.locator('#roomCompanionPanel').isVisible());
    await page.locator('#roomCompanionClose').click();
    await page.evaluate(() => {
      document.getElementById('roomObjects').style.zIndex='';
      document.getElementById('roomCharacters').style.zIndex='';
    });

    await page.evaluate(() => window.LauncherRoom.openEditor());
    await page.evaluate(() => {
      const top = document.querySelector('#roomCharacters [data-room-key]');
      const under = document.querySelector('#roomObjects [data-room-key]');
      under.style.left = top.style.left; under.style.top = top.style.top;
    });
    const editThrough = await scan(page, 'return p.native === top.dataset.roomKey && p.hit === under.dataset.roomKey && p.inUnder && [[-2,0],[2,0],[0,-2],[0,2]].every(([dx,dy])=>window.__launcherRoomTest.hitAt(p.x+dx,p.y+dy)===under.dataset.roomKey)');
    pass('edit mode also resolves overlapping alpha', !!editThrough);
    await page.mouse.move(editThrough.x, editThrough.y);
    await page.mouse.down();
    pass('edit selects painted furniture under transparent actor',
      await page.locator('#roomObjects [data-room-key="f:room-furniture-map-table"]').evaluate(node => node.classList.contains('is-selected')));
    await page.mouse.move(editThrough.x + 96, editThrough.y + 8, {steps:6});
    await page.mouse.up();
    pass('dragging the alpha selected furniture moves it',
      await page.locator('#roomObjects [data-room-key="f:room-furniture-map-table"]').evaluate(node => node.style.left !== document.querySelector('#roomCharacters [data-room-key]').style.left));
    await page.locator('#roomCancel').click();

    // The current walking frame is the hit shape, not the rectangular canvas
    // and not the static portrait below it.
    const frames = await page.evaluate(() => {
      const node = document.querySelector('#roomCharacters [data-room-key="c:room-character-luffy"]');
      const canvas = node.querySelector('.room-walk-sprite');
      const atlas = window.OnePieceRoomMotion.preload('luffy').atlases.south;
      const rect = canvas.getBoundingClientRect();
      const tests = [];
      for (const frame of [0, 1, 2, 3]) {
        window.OnePieceRoomMotion.draw(canvas, atlas, frame);
        canvas.hidden = false; node.classList.add('has-directional-sprite');
        node.dataset.actionSource = 'motion_v5'; node.dataset.direction = 'south'; node.dataset.motionFrame = String(frame);
        const hits = [];
        for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
          const px = rect.left + (x + .5) / 32 * rect.width, py = rect.top + (y + .5) / 32 * rect.height;
          hits.push(window.__launcherRoomTest.hitAt(px, py) === node.dataset.roomKey);
        }
        tests.push(hits);
      }
      return tests;
    });
    pass('walking frame hit shape follows currently rendered frame', frames.some((row, index) => index > 0 && row.some((value, cell) => value !== frames[0][cell])));

    await page.evaluate(() => window.LauncherRoom.openEditor());
    const furniturePoint = await page.evaluate(() => {
      const node = document.querySelector('#roomObjects [data-room-key]'), rect = node.getBoundingClientRect();
      for (let y = rect.top + 3; y < rect.bottom - 3; y += 3) for (let x = rect.left + 3; x < rect.right - 3; x += 3)
        if (window.__launcherRoomTest.hitAt(x,y) === node.dataset.roomKey &&
            [[-3,0],[3,0],[0,-3],[0,3]].every(([dx,dy]) =>
              window.__launcherRoomTest.hitAt(x+dx,y+dy) === node.dataset.roomKey)) return {x,y};
      return null;
    });
    pass('furniture has an opaque editor selection point', !!furniturePoint);
    await page.mouse.click(furniturePoint.x, furniturePoint.y);
    const furniture = page.locator('#roomObjects [data-room-key="f:room-furniture-map-table"]');
    pass('painted furniture click selects before rotation', await furniture.evaluate(node => node.classList.contains('is-selected')));
    await furniture.locator('.room-canvas-rotate').nth(1).click();
    const rotation = await furniture.evaluate(node => ({rotation:node.dataset.rotation,
      src:node.querySelector('.room-object').currentSrc}));
    pass('in-room rotation swaps to the 1-direction image', rotation.rotation === '1' && rotation.src.endsWith('/map-table/1.webp'));
    const changed = await page.evaluate(async () => {
      const node = document.querySelector('#roomObjects [data-room-key="f:room-furniture-map-table"]');
      const image = node.querySelector('.room-object'), source1 = image.src;
      const rect = image.getBoundingClientRect(), sample = () => {
        const values = [];
        for (let y=0;y<32;y++) for (let x=0;x<32;x++) {
          const px=rect.left+(x+.5)/32*rect.width,py=rect.top+(y+.5)/32*rect.height;
          values.push(window.__launcherRoomTest.hitAt(px,py)===node.dataset.roomKey);
        }
        return values;
      };
      const one = sample();
      image.src = source1.replace('/1.webp','/0.webp'); await image.decode();
      const zero = sample();
      image.src = source1; await image.decode();
      return {different:one.some((v,i)=>v!==zero[i]),oneOpaque:one.some(Boolean),restored:image.currentSrc===source1};
    });
    pass('rotated furniture uses its own asymmetric alpha mask', changed.different && changed.oneOpaque && changed.restored);
    await page.locator('#roomCancel').click();

    await page.setViewportSize({width:390,height:844});
    await page.locator('#roomStage').scrollIntoViewIfNeeded();
    const mobile = await scan(page, 'return p.hit === top.dataset.roomKey && p.native === top.dataset.roomKey && [[-2,0],[2,0],[0,-2],[0,2]].every(([dx,dy])=>window.__launcherRoomTest.hitAt(p.x+dx,p.y+dy)===top.dataset.roomKey)');
    pass('narrow viewport preserves painted-character hit target', !!mobile);
    await page.mouse.click(mobile.x,mobile.y);
    await page.waitForFunction(() => !document.getElementById('roomCompanionPanel').hidden);
    pass('narrow viewport opens interaction only on painted art', await page.locator('#roomCompanionPanel').isVisible());
    await page.locator('#roomCompanionClose').click();
    await page.setViewportSize({width:1366,height:1050});
    await page.locator('#roomStage').scrollIntoViewIfNeeded();

    const fallback = await page.evaluate(async () => {
      const node=document.querySelector('#roomCharacters [data-room-key="c:room-character-luffy"]');
      const record=window.OnePieceLifeActions.preload('luffy','work','south');
      const primary=window.OnePieceLifeActions.url('luffy','work','south');
      const alternate=primary.replace('/life_hd_v3/','/life_hd_v2/');
      const image=new Image(); image.src=alternate; await image.decode();
      record.source=alternate;record.image=image;record.ready=true;
      const canvas=node.querySelector('.room-walk-sprite');
      window.OnePieceLifeActions.draw(canvas,'luffy','work','south',0);
      canvas.hidden=false;node.classList.add('has-directional-sprite');
      node.dataset.actionSource='life_v1';node.dataset.pose='work';node.dataset.direction='south';node.dataset.actionFrame='0';
      const rect=canvas.getBoundingClientRect(),sample=()=>{
        const hits=[];for(let y=0;y<32;y++)for(let x=0;x<32;x++){
          const px=rect.left+(x+.5)/32*rect.width,py=rect.top+(y+.5)/32*rect.height;
          hits.push(window.__launcherRoomTest.hitAt(px,py)===node.dataset.roomKey);
        }return hits;
      };
      const actual=sample();record.source=primary;const wrong=sample();record.source=alternate;
      return {actual:actual.some(Boolean),different:actual.some((v,i)=>v!==wrong[i]),source:record.source};
    });
    pass('life action fallback follows the painted v2 source', fallback.actual && fallback.different && fallback.source.includes('/life_hd_v2/'));
    pass('room produces no uncaught browser errors', setup.errors.length === 0);
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ok:true,checks,metadata}, null, 2));
    console.log(JSON.stringify({ok:true,checks:checks.length,out}));
  } finally { if (page) await page.close(); await browser.close(); }
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
