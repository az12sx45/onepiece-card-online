'use strict';
exports.prepare=function(event){
let now=0,sagaFusionFxTimers=[];const tasks=[],timeline=[];let shakes=0,cutinAt=-1;
const element=()=>({textContent:'',src:'',offsetWidth:1,classes:new Set(),get classList(){return{add:(...v)=>v.forEach(x=>this.classes.add(x)),remove:(...v)=>v.forEach(x=>this.classes.delete(x))}}});
const refs=Object.fromEntries(['sagaFusionFx','sagaFusionBefore','sagaFusionFinal','sagaFusionSword','sagaFusionStage','sagaFusionTitle','sagaFusionResult','sagaFusionEffect','status','cutInFx'].map(k=>[k,element()]));
const setTimeout=(fn,delay)=>{const task={fn,at:now+delay,cancelled:false};tasks.push(task);return task},clearTimeout=t=>{if(t)t.cancelled=true};
const playStageShake=()=>shakes++,restartAnimation=()=>{cutinAt=now;};
function clearSagaFusionFx() {
    sagaFusionFxTimers.forEach((timer) => clearTimeout(timer));
    sagaFusionFxTimers = [];
    refs.sagaFusionFx?.classList.remove("show", "absorbing", "revealed");
  }
function scheduleSagaFusionFx(callback, delay) {
    const timer = setTimeout(callback, delay);
    sagaFusionFxTimers.push(timer);
    return timer;
  }
function playSagaFusionFx(event) {
    if (!event || !refs.sagaFusionFx) return;
    clearSagaFusionFx();
    if (refs.sagaFusionBefore) refs.sagaFusionBefore.src = event.beforePortrait || "images/board/battle/enemies/postgame_saga/normal.webp";
    if (refs.sagaFusionFinal) refs.sagaFusionFinal.src = event.finalPortrait || "images/board/battle/enemies/postgame_saga/fused_normal.webp";
    if (refs.sagaFusionSword) refs.sagaFusionSword.src = event.swordImage || "images/board/items/postgame_boss_relics/saga_seven_star_sword.webp";
    if (refs.sagaFusionStage) refs.sagaFusionStage.textContent = event.title || "血祭值 75／75";
    if (refs.sagaFusionTitle) refs.sagaFusionTitle.textContent = event.stageText || "七星劍吸滿鮮血";
    if (refs.sagaFusionResult) refs.sagaFusionResult.textContent = event.resultText || "完全融合・最終形態";
    if (refs.sagaFusionEffect) refs.sagaFusionEffect.textContent = event.effectText || "直接攻擊傷害 +50%";
    void refs.sagaFusionFx.offsetWidth;
    refs.sagaFusionFx.classList.add("show");
    playCutIn(event.stageText || "七星劍吸滿鮮血");
    showStatus("血祭值到達 75，七星劍開始融入薩卡身體。", 2700);
    scheduleSagaFusionFx(() => {
      refs.sagaFusionFx?.classList.add("absorbing");
      if (refs.sagaFusionTitle) refs.sagaFusionTitle.textContent = event.fusionText || "七星劍融入薩卡身體";
      playCutIn(event.fusionText || "七星劍融入薩卡身體");
      playStageShake();
    }, 1750);
    scheduleSagaFusionFx(() => {
      refs.sagaFusionFx?.classList.add("revealed");
      if (refs.sagaFusionStage) refs.sagaFusionStage.textContent = event.resultText || "完全融合・最終形態";
      if (refs.sagaFusionTitle) refs.sagaFusionTitle.textContent = event.effectText || "直接攻擊傷害 +50%";
      playCutIn(event.resultText || "完全融合・最終形態");
      showStatus(`${event.actorName || "薩卡"}進入最終形態：${event.effectText || "直接攻擊傷害 +50%"}。`, 2700);
      playStageShake();
    }, 3300);
    scheduleSagaFusionFx(() => clearSagaFusionFx(), Math.max(4800, Number(event.duration || 6200)));
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
const snapshot=()=>({at:now,visible:refs.sagaFusionFx.classes.has('show'),heading:refs.sagaFusionStage.textContent,title:refs.sagaFusionTitle.textContent,result:refs.sagaFusionResult.textContent,effect:refs.sagaFusionEffect.textContent,status:refs.status.textContent,statusVisible:refs.status.classes.has('show'),cutin:refs.cutInFx.textContent,cutinAt,shakes});
playSagaFusionFx(event);timeline.push(snapshot());while(tasks.length){tasks.sort((a,b)=>a.at-b.at);const task=tasks.shift();if(task.cancelled)continue;now=task.at;task.fn();timeline.push(snapshot());}return {before:refs.sagaFusionBefore.src,final:refs.sagaFusionFinal.src,sword:refs.sagaFusionSword.src,timeline,endAt:Math.max(4800,Number(event.duration||6200))};
};
