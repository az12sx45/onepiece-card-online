'use strict';
const rules=require('./native-card-original-results');
const copy=x=>JSON.parse(JSON.stringify(x));
function summarize(final){
  const count=final.playerCount||Object.keys(final.playersMeta||{}).length||final.ranking.length;
  return final.ranking.map((row,i)=>{const score=final.scoreboard?.[row.id]||{},title=rules.getTitleInfoForRow(score,count);return {...row,place:i+1,score,title:title.label.trim(),titleTier:title.tier,bounty:title.bounty};});
}
function patch(profile,final,viewer,room,unlocked=[]){
  if(!Number.isFinite(final.endedAt)||final.endedAt<=0)throw Error('伺服器尚未提供穩定結算識別，請先更新伺服器');
  const rows=summarize(final),me=rows.find(r=>r.id===viewer);if(!me)throw Error('結算玩家身分不符');
  const stats=copy(profile.stats||{}),base=rules.defaultClient(),client={...base,...(stats.client||{})};
  for(const key of ['_appliedMatchKeys','deluxeUnlocked','recent','bountyPosters'])if(!Array.isArray(client[key]))client[key]=[];
  const key=room+'|'+(final.seasonNo||1)+'|'+final.endedAt,applied=client._appliedMatchKeys||[];
  if(applied.includes('native:'+key))return {alreadyApplied:true,rows,rank:client.rank,key,rankMeta:client.recent.find(x=>x.matchKey==='native:'+key)?.rankMeta||{}};
  const before=rules.ensureRank(copy(client.rank)),total=rows.reduce((n,r)=>n+(Number(r.coins)||0),0);
  const after=before.tier===0?rules.applyPlacement(copy(before),rows.length,me.coins,total):rules.applyRankedDelta(copy(before),rows.length,me.coins,total);
  client.rank=after;client.player={...(client.player||{}),name:profile.name,avatar:profile.avatar};
  const totals=client.totals||{};client.totals={...totals,games:(Number(totals.games)||0)+1,wins:(Number(totals.wins)||0)+(me.place===1?1:0),coins:(Number(totals.coins)||0)+(Number(me.score.coinScore)||0)};
  client._appliedMatchKeys=['native:'+key,...applied].slice(0,200);
  const fresh=unlocked.filter(n=>Number.isInteger(n)&&n>=0&&n<20&&!client.deluxeUnlocked.includes(n));
  client.deluxeUnlocked=[...new Set([...client.deluxeUnlocked,...fresh])];
  const rankMeta=rules.captureRankUiMeta(before,after);
  client.recent=[{matchKey:'native:'+key,ts:final.endedAt,place:me.place,coinsGain:Number(me.score.coinScore)||0,unlocked:fresh,rankMeta},...(client.recent||[])].slice(0,10);
  client.titles={...base.titles,...client.titles};client.titles.owned=rules.upsertOwnedTitle(client.titles.owned,me.title,me.titleTier);
  if(!client.titles.equipped||client.titles.equipped===me.title){client.titles.equipped=me.title;client.titles.equippedTier=Math.max(client.titles.equippedTier||1,me.titleTier);}
  return {rows,key,rank:after,rankMeta,patch:{name:profile.name,avatar:String(profile.avatar),stats:{...stats,client}}};
}
function poster(final,viewer,room){const row=summarize(final).find(r=>r.id===viewer);if(!row)throw Error('結算玩家身分不符');const avatar=Number(row.avatar??final.playersMeta?.[viewer]?.avatar);return {key:room+'|'+(final.seasonNo||1)+'|'+viewer+'|'+final.endedAt,ts:final.endedAt,title:row.name+'｜懸賞令',name:row.name,bounty:Math.floor(row.bounty).toLocaleString('en-US'),avatarId:Number.isFinite(avatar)?avatar:(viewer%8)+1};}
function request(socket,event,payload){return new Promise((resolve,reject)=>socket.timeout(6500).emit(event,payload,(error,response)=>{if(error||!response?.ok)reject(Error('雲端結算尚未確認，請重試'));else resolve(response);}));}
exports.create=({socket,secret,notify})=>{
  let active=false;
  return {async save(final,viewer,room,unlocked){
    if(active)return null;active=true;
    try{
      const response=await request(socket,'PROFILE_GET',{secret}),value=patch(response.profile,final,viewer,room,unlocked);
      if(!value.alreadyApplied)await request(socket,'PROFILE_UPDATE',{secret,patch:value.patch});
      const players=value.rows.map(r=>({seatId:r.id,userId:r.id===viewer?Number(response.profile.user_id)||0:Number(final.playersMeta?.[r.id]?.userId)||0,name:r.name,avatar:String(r.avatar??''),place:r.place,coins:r.coins}));
      try{
        await request(socket,'MATCH_HISTORY_WRITE',{matchKey:value.key,endedAt:final.endedAt,players});
        const match=String(value.rankMeta?.deltaText||'').match(/^([+\-]?\d+)\s*RP/i),userId=Number(response.profile.user_id)||0;
        if(match&&userId)await request(socket,'MATCH_HISTORY_RP_PATCH',{matchKey:value.key,userId,deltaRP:Number(match[1])});
      }catch(e){notify('段位與獎勵已儲存；對局紀錄暫時無法同步');}
      return {...value,rankName:rules.RANK_TIER_NAME[value.rank?.tier]||'',patch:undefined,saved:true};
    }catch(e){notify(String(e.message));return {saved:false,error:String(e.message)};}finally{active=false;}
  },async savePoster(final,viewer,room){
    const response=await request(socket,'PROFILE_GET',{secret}),profile=response.profile,stats=copy(profile.stats||{}),client={...rules.defaultClient(),...stats.client},meta=poster(final,viewer,room);
    client.bountyPosters=[meta,...(Array.isArray(client.bountyPosters)?client.bountyPosters:[]).filter(x=>x.key!==meta.key)].slice(0,4);
    await request(socket,'PROFILE_UPDATE',{secret,patch:{name:profile.name,avatar:String(profile.avatar),stats:{...stats,client}}});return meta;
  }};
};
exports.patch=patch;exports.summarize=summarize;exports.poster=poster;
