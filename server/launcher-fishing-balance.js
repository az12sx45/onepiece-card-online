'use strict';
const FISH_RARITY_BY_ID = Object.freeze({
  'balloon-catfish':'common','glistening-saury':'common','smile-jellyfish':'common',
  'butterflyfish':'common','lovely-angel':'common','claw-shrimp':'common',
  'cutie-piranha':'common','maple-salmon':'common','lava-flounder':'common',
  'adventure-fish':'uncommon','cola-sunfish':'uncommon','pumpkin-octopus':'uncommon',
  'electric-catfish':'uncommon','demon-bonito':'uncommon','ice-fish':'uncommon',
  'striped-clam':'uncommon','guiding-anglerfish':'uncommon',
  'panda-shark':'rare','reef-shark':'rare','elephant-tuna':'rare',
  'treasure-pearl-clam':'rare','beat-alligator':'rare','aurora-sunfish':'rare',
  'great-terigius':'rare',
  'burning-dragon':'legendary','golden-whale':'legendary',
  'largemouth-bass':'common','warmouth':'common',
  'congo-bichir':'uncommon','dolphinfish':'uncommon','lionfish':'uncommon',
  'paddlefish':'rare','alligator-gar':'rare','dusky-grouper':'rare',
  'goliath-grouper':'legendary','white-marlin':'legendary'
});
const TIERS=Object.freeze({common:{level:1,hp:100,pull:1,rod:0},uncommon:{level:2,hp:280,pull:1.8,rod:1},rare:{level:3,hp:720,pull:3,rod:2},legendary:{level:4,hp:1800,pull:4.8,rod:3}});
const RODS=Object.freeze([{reel:2,flick:3,burst:8,special:35,counter:1},{reel:6,flick:8,burst:24,special:105,counter:1.6},{reel:17,flick:21,burst:65,special:275,counter:2.65},{reel:45,flick:52,burst:170,special:720,counter:4.4}]);
module.exports={FISH_RARITY_BY_ID,TIERS,RODS};
