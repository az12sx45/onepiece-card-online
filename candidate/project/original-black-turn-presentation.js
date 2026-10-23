'use strict';
// Exact original black-turn controller, projected to a native presentation packet.
exports.prepare=function(event,geometry,portraits={}){
const PLACEHOLDER_BATTLE_PORTRAIT = "images/board/battle/portraits/placeholder/normal.webp";
let latestView=null,now=0,status='',statusAt=0,castImage='',enemyImage='';const tasks=[],timeline=[];
function element(rect){const properties={},classes=new Set();return {properties,classes,textContent:'',offsetWidth:1,getBoundingClientRect(){return rect;},style:{setProperty(k,v){properties[k]=v;},removeProperty(k){delete properties[k];}},classList:{add(...values){for(const v of values)classes.add(v);},remove(...values){for(const v of values)classes.delete(v);}}};}
const refs={stage:element(geometry.stage),playerCard:element(geometry.player),enemyCard:element(geometry.enemy),blackTurnCastFx:element(),blackTurnCastText:element(),blackTurnDemonCastName:element()};
const window={innerWidth:geometry.stage.width,innerHeight:geometry.stage.height};
const clearBlackTurnFx=()=>{tasks.length=0;},scheduleBlackTurnFx=(callback,delay)=>tasks.push({callback,at:delay,order:tasks.length}),setBlackTurnCastImage=src=>castImage=src,setBlackTurnEnemyImage=()=>enemyImage=portraits.enemy||PLACEHOLDER_BATTLE_PORTRAIT,showStatus=value=>{status=value;statusAt=now;};
function blackTurnPortraitUrl(event = {}, preferredKeys = null) {
    const combatant = event.targetCombatant || event.targetSnapshot || event.target || {};
    const portraits = combatant?.battlePortraits || {};
    const keys = Array.isArray(preferredKeys) && preferredKeys.length
      ? preferredKeys
      : ["dizzy", "hit", "hurt", "weak", "angry", "normal", "idle", "portrait"];
    const foundKey = keys.find((key) => portraits[key]);
    return (!preferredKeys && event.targetPortrait) || (foundKey ? portraits[foundKey] : "") || event.targetPortrait || PLACEHOLDER_BATTLE_PORTRAIT;
  }
function positionBlackTurnCastFx() {
    if (!refs.blackTurnCastFx) return;
    const stageRect = refs.stage?.getBoundingClientRect?.() || {
      left: 0,
      top: 0,
      width: window.innerWidth || 1280,
      height: window.innerHeight || 720,
    };
    const playerRect = refs.playerCard?.getBoundingClientRect?.() || refs.playerPortraitWrap?.getBoundingClientRect?.() || null;
    const enemyRect = refs.enemyCard?.getBoundingClientRect?.() || refs.enemyPortraitWrap?.getBoundingClientRect?.() || null;
    const startX = playerRect ? (playerRect.left + playerRect.width * 0.5 - stageRect.left) : stageRect.width * 0.26;
    const startY = playerRect ? (playerRect.top + playerRect.height * 0.5 - stageRect.top) : stageRect.height * 0.44;
    const endX = enemyRect ? (enemyRect.left + enemyRect.width * 0.5 - stageRect.left) : stageRect.width * 0.74;
    const endY = enemyRect ? (enemyRect.top + enemyRect.height * 0.5 - stageRect.top) : stageRect.height * 0.44;
    const cardWidth = Math.round(Math.max(160, playerRect?.width || enemyRect?.width || stageRect.width * 0.22));
    const cardHeight = Math.round(Math.max(160, playerRect?.height || enemyRect?.height || cardWidth));
    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.max(1, Math.sqrt((dx * dx) + (dy * dy)));
    const unitX = dx / length;
    const unitY = dy / length;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const clearDistance = Math.max(88, Math.min(cardWidth, cardHeight) * 0.58);
    const startExitX = startX + unitX * clearDistance;
    const startExitY = startY + unitY * clearDistance;
    const endEntryX = endX - unitX * clearDistance;
    const endEntryY = endY - unitY * clearDistance;
    const moveStartAt = 12;
    const moveEndAt = 35;
    const moveProgress = (percent) => Math.max(0, Math.min(1, (percent - moveStartAt) / (moveEndAt - moveStartAt)));
    const move30 = moveProgress(30);
    const move30X = startX + dx * move30;
    const move30Y = startY + dy * move30;
    refs.blackTurnCastFx.style.setProperty("--black-turn-start-x", `${Math.round(startX)}px`);
    refs.blackTurnCastFx.style.setProperty("--black-turn-start-y", `${Math.round(startY)}px`);
    refs.blackTurnCastFx.style.setProperty("--black-turn-start-exit-x", `${Math.round(startExitX)}px`);
    refs.blackTurnCastFx.style.setProperty("--black-turn-start-exit-y", `${Math.round(startExitY)}px`);
    refs.blackTurnCastFx.style.setProperty("--black-turn-end-x", `${Math.round(endX)}px`);
    refs.blackTurnCastFx.style.setProperty("--black-turn-end-y", `${Math.round(endY)}px`);
    refs.blackTurnCastFx.style.setProperty("--black-turn-end-entry-x", `${Math.round(endEntryX)}px`);
    refs.blackTurnCastFx.style.setProperty("--black-turn-end-entry-y", `${Math.round(endEntryY)}px`);
    refs.blackTurnCastFx.style.setProperty("--black-turn-move-30-x", `${Math.round(move30X)}px`);
    refs.blackTurnCastFx.style.setProperty("--black-turn-move-30-y", `${Math.round(move30Y)}px`);
    refs.blackTurnCastFx.style.setProperty("--black-turn-line-x", `${Math.round(startX)}px`);
    refs.blackTurnCastFx.style.setProperty("--black-turn-line-y", `${Math.round(startY)}px`);
    refs.blackTurnCastFx.style.setProperty("--black-turn-line-width", `${Math.round(length)}px`);
    refs.blackTurnCastFx.style.setProperty("--black-turn-line-angle", `${angle.toFixed(2)}deg`);
    refs.blackTurnCastFx.style.setProperty("--black-turn-card-w", `${cardWidth}px`);
    refs.blackTurnCastFx.style.setProperty("--black-turn-card-h", `${cardHeight}px`);
  }
function playBlackTurnCastFx(event, view = latestView) {
    if (!event) return;
    clearBlackTurnFx();
    const duration = Math.max(8400, Number(event.duration || 8400));
    const targetName = event.targetName || event.targetCombatant?.name || "一名夥伴";
    const title = event.title || event.moveName || "Domi Reversi・黑轉支配";
    if (refs.blackTurnCastText) refs.blackTurnCastText.textContent = `${title}：${targetName}`;
    if (refs.blackTurnDemonCastName) refs.blackTurnDemonCastName.textContent = `黑轉・${targetName}`;
    refs.blackTurnCastFx?.style.setProperty("--black-turn-duration", `${duration}ms`);
    refs.stage?.style.setProperty("--black-turn-duration", `${duration}ms`);
    setBlackTurnCastImage(blackTurnPortraitUrl(event));
    setBlackTurnEnemyImage();
    positionBlackTurnCastFx();
    refs.blackTurnCastFx?.classList.remove("show", "swap-front", "demonized");
    refs.stage?.classList.remove("black-turn-front");
    void refs.blackTurnCastFx?.offsetWidth;
    refs.stage?.classList.add("black-turn-casting");
    refs.blackTurnCastFx?.classList.add("show");
    refs.playerCard?.classList.add("black-turn-donor");
    refs.enemyCard?.classList.add("black-turn-receiver");
    showStatus(`黑霧從 ${targetName} 身後抽出影子。`);
    scheduleBlackTurnFx(() => {
      showStatus(`${targetName} 被拖到伊姆身後。`);
    }, Math.round(duration * 0.24));
    scheduleBlackTurnFx(() => {
      showStatus(`${targetName} 抵達伊姆後方，開始翻轉。`);
    }, Math.round(duration * 0.74));
    scheduleBlackTurnFx(() => {
      refs.stage?.classList.add("black-turn-front");
      refs.blackTurnCastFx?.classList.add("swap-front");
    }, Math.round(duration * 0.8));
    scheduleBlackTurnFx(() => {
      setBlackTurnCastImage(blackTurnPortraitUrl(event, ["angry", "attack", "morale", "normal", "idle", "portrait"]));
      refs.blackTurnCastFx?.classList.add("demonized");
      showStatus(`黑轉框架展開，${targetName} 被支配。`);
    }, Math.round(duration * 0.8));
    scheduleBlackTurnFx(() => {
      showStatus(`伊姆退後，${targetName} 的黑轉支配完成。`);
    }, Math.round(duration * 0.9));
    scheduleBlackTurnFx(() => {
      refs.blackTurnCastFx?.classList.remove("show", "swap-front", "demonized");
      refs.playerCard?.classList.remove("black-turn-donor");
      refs.stage?.classList.remove("black-turn-casting", "black-turn-front");
      refs.stage?.style.removeProperty("--black-turn-duration");
    }, duration + 120);
  }
const snapshot=()=>({at:now,status,statusAt,castImage,enemyImage,cast:[...refs.blackTurnCastFx.classes],stage:[...refs.stage.classes],player:[...refs.playerCard.classes],enemy:[...refs.enemyCard.classes]});
playBlackTurnCastFx(event);const variables={...refs.blackTurnCastFx.properties};timeline.push(snapshot());for(const task of tasks.sort((a,b)=>a.at-b.at||a.order-b.order)){now=task.at;task.callback();timeline.push(snapshot());}
return {variables,timeline,duration:parseFloat(variables['--black-turn-duration']),endAt:now,title:refs.blackTurnCastText.textContent,name:refs.blackTurnDemonCastName.textContent,images:[...new Set(timeline.flatMap(x=>[x.castImage,x.enemyImage]))]};
};
