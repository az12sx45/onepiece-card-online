'use strict';
// Exact source presentation functions; only DOM effects become timed data.
exports.prepare=function(event){
let now=0,oarsPurificationFxTimers=[];const tasks=[],actions=[];
const mark=(kind,data={})=>actions.push({at:now,kind,...data});
const element=()=>({offsetWidth:1,textContent:'',innerHTML:'',classList:{add(){},remove(){}},remove(){mark('clear')},appendChild(layer){mark('layer',{html:layer.innerHTML})}});
const refs={stage:element(),enemyCard:element(),status:element(),cutInFx:element()};
const document={createElement:element,querySelector:()=>({remove(){mark('clear')}})};
const setTimeout=(fn,delay)=>{const task={fn,at:now+delay,cancelled:false};tasks.push(task);return task},clearTimeout=t=>{if(t)t.cancelled=true};
const restartAnimation=()=>mark('cutin',{text:refs.cutInFx.textContent}),playPortraitAction=(side,pose,duration)=>mark('pose',{side,pose,duration}),playStageShake=()=>mark('shake'),spawnBattleDamageNumber=p=>mark('damage',{amount:p.amount,critical:p.critical,side:p.targetSide}),setPortraitState=(side,pose)=>mark('state',{side,pose});
function clearOarsPurificationFx() {
    oarsPurificationFxTimers.forEach((timer) => clearTimeout(timer));
    oarsPurificationFxTimers = [];
    document.querySelector(".oars-purification-fx")?.remove();
  }
function scheduleOarsPurificationFx(callback, delay) {
    const timer = setTimeout(callback, delay);
    oarsPurificationFxTimers.push(timer);
    return timer;
  }
function playOarsPurificationFx(event) {
    if (!event || !refs.stage) return;
    clearOarsPurificationFx();
    const layer = document.createElement("div");
    layer.className = "oars-purification-fx";
    layer.innerHTML = `<div class="oars-purification-flash"></div><img src="images/board/battle/postgame_mechanics/oars/oars_salt_purification.webp" alt=""><div class="oars-purification-shadow"></div>`;
    refs.stage.appendChild(layer);
    void layer.offsetWidth;
    layer.classList.add("show");
    playCutIn(event.title || "巨型鹽彈・影子解放");
    showStatus("十五袋巨型鹽命中歐斯，影子開始脫離巨軀。", 3000);
    scheduleOarsPurificationFx(() => {
      playPortraitAction("enemy", "hit", 900);
      playStageShake();
      spawnBattleDamageNumber({ amount: Number(event.damage || 0), critical: true, targetSide: "enemy", anchorElement: refs.enemyCard });
    }, 1050);
    scheduleOarsPurificationFx(() => {
      setPortraitState("enemy", "dizzy");
      playStageShake();
    }, 2050);
    scheduleOarsPurificationFx(clearOarsPurificationFx, Math.max(3200, Number(event.duration || 3200)));
  }
function showStatus(message) {
    refs.status.textContent = message;
    refs.status.classList.add("show");
    clearTimeout(showStatus.timer);
    showStatus.timer = setTimeout(() => refs.status.classList.remove("show"), 2300);
  }
function playCutIn(text) {
    if (!refs.cutInFx || !text) return;
    refs.cutInFx.textContent = text;
    restartAnimation(refs.cutInFx, "show");
  }
playOarsPurificationFx(event);const status=refs.status.textContent;for(const task of tasks.sort((a,b)=>a.at-b.at)){if(task.cancelled)continue;now=task.at;task.fn();}return {actions,status,statusUntil:2300,endAt:now};
};
