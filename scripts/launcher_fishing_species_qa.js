'use strict';

// The 20 identifiers below correspond to fish_prm.bin's 20 entries in the
// supplied Unlimited Adventure (J) disc. `big`, `bigkazan` and `shadow` are
// object assets, not extra species in that catalogue. No disc data is loaded
// by the live game or this test.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const M=require('../server/launcher-minigames');
const L=require('../server/launcher-life');
const UA_IDS=Object.freeze([
  'adventure-fish','lovely-angel','guiding-anglerfish','striped-clam',
  'burning-dragon','electric-catfish','elephant-tuna','great-terigius',
  'claw-shrimp','lava-flounder','ice-fish','treasure-pearl-clam',
  'aurora-sunfish','pumpkin-octopus','demon-bonito','panda-shark',
  'cutie-piranha','maple-salmon','beat-alligator','golden-whale'
]);
const LEGACY_IDS=Object.freeze([
  'balloon-catfish','glistening-saury','smile-jellyfish','butterflyfish',
  'cola-sunfish','reef-shark'
]);
const FISHING_MASTER_IDS=Object.freeze([
  'largemouth-bass','warmouth','congo-bichir','paddlefish','alligator-gar',
  'dolphinfish','lionfish','dusky-grouper','goliath-grouper','white-marlin'
]);
const checks=[];
function check(name,actual,expected){assert.deepEqual(actual,expected,name);checks.push(name);}
const catalogue=new Map(M.FISH_SPECIES.map(fish=>[fish.id,fish]));
check('all catalogue ids unique',catalogue.size,M.FISH_SPECIES.length);
check('20 Unlimited Adventure, 6 retained and 10 new guest species',catalogue.size,36);
check('all 20 Unlimited Adventure fish present',UA_IDS.every(id=>catalogue.has(id)),true);
check('all 6 other prior fish ids retained',LEGACY_IDS.every(id=>catalogue.has(id)),true);
check('all 10 supplied Fishing Master XAPK species added',
  FISHING_MASTER_IDS.every(id=>catalogue.has(id)),true);
check('every fish has a usable display and source name',
  M.FISH_SPECIES.every(fish=>fish.label.length>0&&fish.sourceName.length>0),true);
check('every fish has exactly one launcher rarity grade',
  [...catalogue.keys()].sort(),Object.keys(M.FISH_RARITY_BY_ID).sort());
check('rarity grades use the four published labels',
  [...new Set(Object.values(M.FISH_RARITY_BY_ID))].sort(),
  ['common','legendary','rare','uncommon']);
check('all fish have a defined fight difficulty',
  M.FISH_SPECIES.every(fish=>Number.isInteger(M.FISHING_V3_DIFFICULTY[fish.id])&&
    M.FISHING_V3_DIFFICULTY[fish.id]>=0&&M.FISHING_V3_DIFFICULTY[fish.id]<=3),true);
check('new habitat ids exactly added',M.FISHING_SPOTS,
  ['shore','reef','deep','freshwater','magma','rainbow']);

const reachable=new Set();
const shellIds=new Set(['striped-clam','treasure-pearl-clam']);
const shellHabitats=new Set(['shore/worm','reef/worm','rainbow/shrimp']);
for(const spotId of M.FISHING_SPOTS){
  for(const baitId of M.FISHING_BAITS){
    for(const zone of Object.keys(M.FISHING_CAST_ZONES)){
      const pool=M.fishingPoolFor(spotId,baitId,zone);
      check(`${spotId}/${baitId}/${zone} has weighted fish`,
        Array.isArray(pool)&&pool.length>0&&pool.every(([id,weight])=>
          catalogue.has(id)&&Number.isSafeInteger(weight)&&weight>0),true);
      const total=pool.reduce((sum,[,weight])=>sum+weight,0);
      const shell=pool.reduce((sum,[id,weight])=>sum+(shellIds.has(id)?weight:0),0);
      check(`${spotId}/${baitId}/${zone} shell chance follows habitat and stays at most 15%`,
        shellHabitats.has(`${spotId}/${baitId}`)?shell>0&&shell/total<=.15:shell===0,true);
      for(const [id] of pool)reachable.add(id);
      const session=M.create('fishing','room-character-luffy',1,
        new Date('2026-10-02T00:00:00.000Z'),false,'supply',4,baitId,spotId,2);
      const result=M.answer(session,{roundId:session.challenge.id,
        counterMoves:['cast'],castZone:zone},new Date('2026-10-02T00:00:00.100Z'));
      check(`${spotId}/${baitId}/${zone} cast accepted`,result.error,undefined);
      check(`${spotId}/${baitId}/${zone} catch is in its pool`,
        pool.some(([id])=>id===session.catchSpeciesId),true);
      check(`${spotId}/${baitId}/${zone} equipped rod pinned`,session.challenge.rodLevel,2);
    }
  }
}
check('every catalogue fish has a positive catch route',
  [...catalogue.keys()].filter(id=>!reachable.has(id)),[]);
const guestRoutes={
  'largemouth-bass':['freshwater','worm','near','largemouthbass'],
  warmouth:['freshwater','worm','near','warmouth'],
  'congo-bichir':['freshwater','shrimp','mid','congobichir'],
  paddlefish:['freshwater','shrimp','far','paddlefish'],
  'alligator-gar':['freshwater','lure','far','alligatorgar'],
  dolphinfish:['shore','lure','far','dolphinfish_rare_b01'],
  lionfish:['reef','shrimp','mid','lionfish_elite_b01'],
  'dusky-grouper':['reef','lure','far','duskygrouper_rare'],
  'goliath-grouper':['deep','shrimp','far','goliathgrouper'],
  'white-marlin':['deep','lure','far','whitemarlin_monster_b01']
};
for(const [id,[spot,bait,zone,bundleName]] of Object.entries(guestRoutes)){
  check(`${id} preserves XAPK bundle-name provenance`,catalogue.get(id)?.sourceName,bundleName);
  check(`${id} is catchable at its authored spot, bait and distance`,
    M.fishingPoolFor(spot,bait,zone).some(([species,weight])=>species===id&&weight>0),true);
  check(`${id} is absent from unrelated water`,
    M.FISHING_SPOTS.filter(other=>other!==spot).some(other=>
      M.FISHING_BAITS.some(item=>Object.keys(M.FISHING_CAST_ZONES).some(distance=>
        M.fishingPoolFor(other,item,distance).some(([species])=>species===id)))),false);
}
check('magma contains exactly its two source fish',
  [...new Set(Object.values(M.FISHING_V3_POOLS.magma).flatMap(pool=>pool.map(([id])=>id)))].sort(),
  ['burning-dragon','lava-flounder']);
for(const [spot,bait,id] of [['deep','shrimp','golden-whale'],
  ['deep','lure','golden-whale'],['magma','worm','burning-dragon'],
  ['magma','shrimp','burning-dragon'],['magma','lure','burning-dragon']]){
  const chance=zone=>{const pool=M.fishingPoolFor(spot,bait,zone);
    return pool.filter(([species])=>species===id).reduce((sum,[,weight])=>sum+weight,0)/
      pool.reduce((sum,[,weight])=>sum+weight,0);};
  check(`${spot}/${bait} legendary chance rises at far range without dominating`,
    chance('mid')<chance('far')&&chance('far')<.1,true);
}
check('rainbow water can produce Aurora Sunfish',
  Object.values(M.FISHING_V3_POOLS.rainbow).some(pool=>pool.some(([id])=>id==='aurora-sunfish')),true);
check('freshwater can produce Ice Fish',
  Object.values(M.FISHING_V3_POOLS.freshwater).some(pool=>pool.some(([id])=>id==='ice-fish')),true);
for(const invalid of ['big','bigkazan','shadow'])check(`${invalid} is not a catch species`,catalogue.has(invalid),false);

const now=new Date('2026-10-02T00:00:00.000Z');
const savedFish=M.FISH_SPECIES.map((fish,index)=>({id:crypto.randomUUID(),
  speciesId:fish.id,caughtAt:now.toISOString(),inAquarium:index<6}));
const normalized=L.normalizeState({fishCollection:savedFish,revision:7},[],[],now);
check('old and new fish survive save normalization',
  normalized.fishCollection.map(fish=>fish.speciesId),savedFish.map(fish=>fish.speciesId));
check('existing six-fish aquarium setting survives normalization',
  normalized.fishCollection.filter(fish=>fish.inAquarium).length,6);
check('invalid fish id is excluded from persisted collection',
  L.normalizeState({fishCollection:[{id:crypto.randomUUID(),speciesId:'shadow',caughtAt:now.toISOString()}]},[],[],now)
    .fishCollection.length,0);
console.log(`launcher_fishing_species_qa: ${checks.length}/${checks.length} PASS; `+
  `${UA_IDS.length} Unlimited Adventure and ${FISHING_MASTER_IDS.length} guest species, `+
  `${catalogue.size} total catchable fish`);
