(function(){
  'use strict';
  const scenes=[
    ['啟航大廳','menu','becoming_pirate_king','冒險的起點'],
    ['海上航行','map','to_the_ocean','迎風駛向偉大航道'],
    ['抵達港口','map','landing_at_town','新的島嶼、新的旅程'],
    ['冬島','map','grand_line_cold_island','雪國與寒冷海域'],
    ['夏島','map','grand_line_hot_island','熱帶島嶼'],
    ['商店','shop','oden_store','補給與採買'],
    ['酒館','town','sanjis_feast','船員與宴會'],
    ['醫院','town','chopper','治療與休息'],
    ['研究與解謎','event','miss_allsunday','探索未知的秘密'],
    ['水之七島','town','village_harbor','造船之都'],
    ['海格寶藏','event','gold_uunan','沉船與黃金'],
    ['危險海域','danger','usopp_danger','陷阱與突發狀況'],
    ['推進城','danger','stealth_night_shadow','深牢探索'],
    ['監獄警報','escape','one_hour_evacuation','追兵與倒數'],
    ['普通戰鬥','battle_intro','fight_continues','迎戰敵人'],
    ['船員切磋','battle_intro','duel','正面對決'],
    ['Boss 決戰','battle_intro','shinkenshoubu','強敵現身'],
    ['頂上戰爭','battle_intro','cant_escape_fight','大戰一觸即發'],
    ['最後一戰','battle_climax','cant_lose','絕不放棄'],
    ['勝利','victory','we_did_it','航海成果'],
    ['戰敗休整','story','mother_sea','重整旗鼓'],
    ['夥伴與劇情','story','reliable_friend','一同前行'],
  ];
  const list=document.getElementById('sceneList');
  scenes.forEach(([label,phase,id,description],index)=>{
    const button=document.createElement('button');button.type='button';button.className='scene';button.dataset.sceneIndex=String(index);button.dataset.boardSfx='select';button.setAttribute('aria-pressed','false');
    const name=document.createElement('strong');name.textContent=label;const copy=document.createElement('span');copy.textContent=description;button.append(name,copy);
    button.addEventListener('click',()=>{
      list.querySelectorAll('button').forEach(node=>node.setAttribute('aria-pressed',String(node===button)));
      document.getElementById('sceneLabel').textContent=label;
      window.BgmManager.chooseAndPlay({phase,sceneType:'audio_preview',musicScope:'audio-preview:'+id,preferredBgmIds:[id]}, {transition:'immediate',fadeMs:1400});
      update();
    });list.append(button);
  });
  const cues=[['tap','按鈕'],['select','選擇'],['confirm','確認'],['cancel','返回'],['draw','翻牌'],['reward','寶藏'],['heal','治療'],['danger','警告'],['victory','勝利'],['defeat','失敗']];
  cues.forEach(([kind,label])=>{const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.boardSfx=kind;document.getElementById('sfxList').append(button);});
  const toggle=document.getElementById('musicToggle');toggle.addEventListener('click',()=>{window.BgmManager.setEnabled(!window.BgmManager.status().enabled);update();});
  function update(){const s=window.BgmManager.status();document.getElementById('trackTitle').textContent=s.currentChoice?.title||'點選場景開始試聽';document.getElementById('playbackHint').textContent=!s.enabled?'音樂已暫停，可按「繼續音樂」或開啟聲音設定。':s.playing?'正在播放・場景之間會平滑淡入淡出。':'首次播放請點選場景；音樂載入後會自動開始。';toggle.textContent=s.enabled?'暫停音樂':'繼續音樂';}
  const timer=window.setInterval(update,500);window.addEventListener('pagehide',()=>window.clearInterval(timer),{once:true});update();
})();
