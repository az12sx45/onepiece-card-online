'use strict';
const text=n=>String(n?.textContent||'').replace(/\s+/g,' ').trim();
exports.project=function(page){
 const {state,refs}=page,s=page.functions.currentSession(),read=k=>text(refs[k]);
 const card=n=>({value:n,rank:['A','2','3','4','5','6','7','8','9','10','J','Q','K'][n-1],image:'images/board/postgame_clue_ui/york_clue_playing_card_frame_v2.webp',portrait:page.islands?.[n-1]||''});
 const model={mode:!refs.resultOverlay.classList.contains('hidden')?'result':s?'puzzle':'difficulty',title:s?read('puzzleTitle'):'約克十三張線索牌',tier:read('currentTierLabel'),world:read('eggheadStatus'),message:read('sequenceMessage'),hint:read('seedStatus'),attempts:read('attemptBadge'),pending:state.pendingSubmit,difficulties:[],slots:[],bank:[],clues:[],buttons:{}};
 for(const key of ['exitButton','backButton','shuffleButton','unlockAllButton','resetButton','submitButton','resultClose'])model.buttons[key]={label:read(key),disabled:refs[key].disabled};
 for(const key of ['easy','normal','hard']){const d=page.api.DIFFICULTIES[key];model.difficulties.push({key,label:d.label,name:state.currentTier>=3?'三階後新題目練習':d.targetItemName,description:d.description,meta:state.currentTier>=3?'不提高掉落率，也不發放其他加成獎勵':`名刀「日蝕」獨立掉落率 ${Math.round(d.dropRate*100)}%`,disabled:state.currentTier<3&&state.currentTier>=d.targetTier,frame:`images/board/postgame_clue_puzzle_ui/york_difficulty_${key}_frame.webp`,image:`images/board/postgame_clue_puzzle_ui/york_coordinate_decoder_t${d.targetTier}.webp`});}
 if(s){model.solved=s.solved;model.slots=s.slots.map((n,i)=>({index:i,card:n?card(n):null,locked:s.lockedSlots[i],selected:!!n&&s.selectedCard===n&&s.selectedSource==='slot'}));model.bank=s.bankOrder.map(n=>({...card(n),selected:s.selectedCard===n&&s.selectedSource==='bank'}));model.clues=s.puzzle.clues.map(c=>({value:c.owner,text:c.text,selected:s.selectedCard===c.owner}));}
 model.result={title:read('resultTitle'),description:read('resultDescription'),image:refs.resultDecoder.src,tier:read('resultTier'),world:read('resultWorld'),rate:read('resultRate')};return model;
};
