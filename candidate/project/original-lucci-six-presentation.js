'use strict';
// Exact original renderer controller. Timers become native presentation gates.
exports.prepare=function(event,imageAvailable=true){
let lucciSixPowerFxTimers=[],now=0,shakeAt=null;const tasks=[],timeline=[];
const element=()=>({textContent:'',alt:'',src:'',offsetWidth:1,classes:new Set(),removeAttribute(k){this[k]='';},addEventListener(type,fn){if(type===(imageAvailable?'load':'error'))fn();},get classList(){return {add:(...v)=>v.forEach(x=>this.classes.add(x)),remove:(...v)=>v.forEach(x=>this.classes.delete(x))};}});
const refs={lucciSixPowerFx:element(),lucciSixPowerImage:element(),lucciSixPowerName:element(),lucciSixPowerEffect:element()};
const setTimeout=(fn,delay)=>{const task={fn,at:now+delay,cancelled:false};tasks.push(task);return task;},clearTimeout=task=>{task.cancelled=true;},playStageShake=()=>{shakeAt=now;};
function clearLucciSixPowerFx() {
    lucciSixPowerFxTimers.forEach((timer) => clearTimeout(timer));
    lucciSixPowerFxTimers = [];
    refs.lucciSixPowerFx?.classList.remove("show", "has-image");
    if (refs.lucciSixPowerImage) {
      refs.lucciSixPowerImage.removeAttribute("src");
      refs.lucciSixPowerImage.alt = "";
    }
  }
function playLucciSixPowerFx(event) {
    if (!event || !refs.lucciSixPowerFx) return;
    clearLucciSixPowerFx();
    const powerName = String(event.powerName || "六式");
    if (refs.lucciSixPowerName) refs.lucciSixPowerName.textContent = powerName;
    if (refs.lucciSixPowerEffect) refs.lucciSixPowerEffect.textContent = event.effectText || `${event.statLabel || "能力"}提高 80%`;
    if (refs.lucciSixPowerImage && event.image) {
      refs.lucciSixPowerImage.src = event.image;
      refs.lucciSixPowerImage.alt = powerName;
      refs.lucciSixPowerImage.addEventListener("load", () => refs.lucciSixPowerFx?.classList.add("has-image"), { once: true });
      refs.lucciSixPowerImage.addEventListener("error", () => refs.lucciSixPowerFx?.classList.remove("has-image"), { once: true });
    }
    void refs.lucciSixPowerFx.offsetWidth;
    refs.lucciSixPowerFx.classList.add("show");
    lucciSixPowerFxTimers.push(setTimeout(playStageShake, 520));
    lucciSixPowerFxTimers.push(setTimeout(() => clearLucciSixPowerFx(), Math.max(2300, Number(event.duration || 2500))));
  }
const snapshot=()=>({at:now,visible:refs.lucciSixPowerFx.classes.has('show'),hasImage:refs.lucciSixPowerFx.classes.has('has-image'),shakeAt});
playLucciSixPowerFx(event);const packet={name:refs.lucciSixPowerName.textContent,effect:refs.lucciSixPowerEffect.textContent,image:refs.lucciSixPowerImage.src,timeline};timeline.push(snapshot());
for(const task of tasks.sort((a,b)=>a.at-b.at)){if(task.cancelled)continue;now=task.at;task.fn();timeline.push(snapshot());}packet.endAt=now;return packet;
};
exports.powers=[{"id":"soru","name":"剃","stat":"spd","statLabel":"速度","image":"images/board/battle/postgame_mechanics/lucci_six_powers/soru.webp"},{"id":"tekkai","name":"鐵塊","stat":"def","statLabel":"防禦","image":"images/board/battle/postgame_mechanics/lucci_six_powers/tekkai.webp"},{"id":"kamie","name":"紙繪","stat":"evasion","statLabel":"閃避","image":"images/board/battle/postgame_mechanics/lucci_six_powers/kamie.webp"},{"id":"geppo","name":"月步","stat":"sdef","statLabel":"特防","image":"images/board/battle/postgame_mechanics/lucci_six_powers/geppo.webp"},{"id":"shigan","name":"指槍","stat":"atk","statLabel":"攻擊","image":"images/board/battle/postgame_mechanics/lucci_six_powers/shigan.webp"},{"id":"rankyaku","name":"嵐腳","stat":"satk","statLabel":"特攻","image":"images/board/battle/postgame_mechanics/lucci_six_powers/rankyaku.webp"}];
