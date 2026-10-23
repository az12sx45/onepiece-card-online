'use strict';
// Exact source controller, backed by data nodes and a native UI bridge.
const POSTGAME_ZEPHYR_EXPLOSION_STORY_SCENES = Object.freeze([
    Object.freeze({
      image: "images/board/story/postgame_zephyr_explosion/scene_01_countdown_v1.webp",
      kicker: "第一幕",
      title: "倒數歸零",
      line: "最後一顆炸藥岩迸出裂痕——已經沒有回頭路。",
      alt: "發出紫紅強光並開始龜裂的炸藥岩",
      hold: 2400,
    }),
    Object.freeze({
      image: "images/board/story/postgame_zephyr_explosion/scene_02_detonation_v1.webp",
      kicker: "第二幕",
      title: "引爆",
      line: "白色爆光吞沒終結點；澤法站在衝擊之前，沒有退後。",
      alt: "澤法背對玩家迎向炸藥岩爆炸",
      hold: 2500,
      flash: true,
    }),
    Object.freeze({
      image: "images/board/story/postgame_zephyr_explosion/scene_03_endpoint_collapse_v1.webp",
      kicker: "第三幕",
      title: "終結點崩壞",
      line: "島嶼從中央裂開，爆風與岩漿一同撕碎海面。",
      alt: "由空中看見終結點島嶼被爆炸撕裂",
      hold: 2700,
      flash: true,
    }),
    Object.freeze({
      image: "images/board/story/postgame_zephyr_explosion/scene_04_seabed_chain_v1.webp",
      kicker: "第四幕",
      title: "連鎖反應",
      line: "能量沿海床奔走；沉睡的火山，一座接一座甦醒。",
      alt: "海床裂縫引發多座海底火山的連鎖反應",
      hold: 2600,
    }),
    Object.freeze({
      image: "images/board/story/postgame_zephyr_explosion/scene_05_new_world_catastrophe_v1.webp",
      kicker: "終幕",
      title: "新世界陷落",
      line: "最後終結點毀滅——澤法完成了他的計畫。",
      alt: "小船面對新世界各地火山爆發的災變",
      hold: 3000,
    }),
  ]);
exports.scenes=POSTGAME_ZEPHYR_EXPLOSION_STORY_SCENES;
exports.create=function(options){
 let activeZephyrExplosionStoryEventId='',zephyrExplosionStoryIndex=0,zephyrExplosionStoryChanging=false,zephyrExplosionStoryFinished=false,zephyrExplosionStoryTimer=null,latestView=null,flashRevision=0;
 const element=()=>({hidden:true,offsetWidth:1,textContent:'',src:'',alt:'',children:[],classes:new Set(),replaceChildren(...nodes){this.children=nodes;},get classList(){return {add:(...v)=>v.forEach(x=>{this.classes.add(x);if(x==='flash-on')flashRevision++;}),remove:(...v)=>v.forEach(x=>this.classes.delete(x)),toggle:(x,on)=>on?this.classes.add(x):this.classes.delete(x)};}});
 const refs=Object.fromEntries(['zephyrExplosionStory','zephyrExplosionStoryImage','zephyrExplosionStoryKicker','zephyrExplosionStoryTitle','zephyrExplosionStoryLine','zephyrExplosionStoryHint','zephyrExplosionStoryProgress'].map(k=>[k,element()]));
 const document={createElement:element},window={setTimeout:options.setTimeout,clearTimeout:options.clearTimeout},spectatorBattlePlayback={status:()=>({active:!!options.spectatorActive?.()})};
 class Image{set src(value){options.preload(value);}}
 const callBattleAction=(method,type,payload)=>viewerCanControlBattle(latestView)?options.command({method,type,payload}):false;
 function viewerCanControlBattle(view = latestView) {
    return !spectatorBattlePlayback.status().active && !!view?.battle?.canControl;
  }
function clearZephyrExplosionStory() {
    window.clearTimeout(zephyrExplosionStoryTimer);
    zephyrExplosionStoryTimer = null;
    activeZephyrExplosionStoryEventId = "";
    zephyrExplosionStoryIndex = 0;
    zephyrExplosionStoryChanging = false;
    zephyrExplosionStoryFinished = false;
    if (!refs.zephyrExplosionStory) return;
    refs.zephyrExplosionStory.hidden = true;
    refs.zephyrExplosionStory.classList.remove("is-changing", "flash-on");
  }
function finishZephyrExplosionStory() {
    if (!activeZephyrExplosionStoryEventId || zephyrExplosionStoryFinished) return false;
    window.clearTimeout(zephyrExplosionStoryTimer);
    zephyrExplosionStoryTimer = null;
    zephyrExplosionStoryFinished = true;
    if (refs.zephyrExplosionStoryHint) refs.zephyrExplosionStoryHint.textContent = "全員瀕死結算中……";
    if (!viewerCanControlBattle(latestView)) return true;
    return callBattleAction(
      "battleZephyrExplosionStoryDone",
      "zephyr-story-done",
      { eventId: activeZephyrExplosionStoryEventId }
    ) !== false;
  }
function scheduleZephyrExplosionStoryAdvance() {
    window.clearTimeout(zephyrExplosionStoryTimer);
    const scene = POSTGAME_ZEPHYR_EXPLOSION_STORY_SCENES[zephyrExplosionStoryIndex];
    zephyrExplosionStoryTimer = window.setTimeout(
      () => advanceZephyrExplosionStory(),
      Math.max(1200, Number(scene?.hold || 2400))
    );
  }
function paintZephyrExplosionStoryScene(nextIndex, immediate = false) {
    if (!refs.zephyrExplosionStory || zephyrExplosionStoryFinished) return false;
    const index = Math.max(0, Math.min(POSTGAME_ZEPHYR_EXPLOSION_STORY_SCENES.length - 1, Number(nextIndex || 0)));
    const scene = POSTGAME_ZEPHYR_EXPLOSION_STORY_SCENES[index];
    const commit = () => {
      zephyrExplosionStoryIndex = index;
      refs.zephyrExplosionStoryImage.src = scene.image;
      refs.zephyrExplosionStoryImage.alt = scene.alt;
      refs.zephyrExplosionStoryKicker.textContent = scene.kicker;
      refs.zephyrExplosionStoryTitle.textContent = scene.title;
      refs.zephyrExplosionStoryLine.textContent = scene.line;
      refs.zephyrExplosionStoryHint.textContent = index === POSTGAME_ZEPHYR_EXPLOSION_STORY_SCENES.length - 1
        ? "點擊畫面完成劇情"
        : "點擊畫面或按 → 繼續";
      Array.from(refs.zephyrExplosionStoryProgress.children).forEach((dot, dotIndex) => {
        dot.classList.toggle("active", dotIndex === index);
      });
      refs.zephyrExplosionStory.classList.remove("is-changing");
      if (scene.flash) {
        refs.zephyrExplosionStory.classList.remove("flash-on");
        void refs.zephyrExplosionStory.offsetWidth;
        refs.zephyrExplosionStory.classList.add("flash-on");
      }
      zephyrExplosionStoryChanging = false;
      scheduleZephyrExplosionStoryAdvance();
    };
    window.clearTimeout(zephyrExplosionStoryTimer);
    if (immediate) {
      commit();
    } else {
      zephyrExplosionStoryChanging = true;
      refs.zephyrExplosionStory.classList.add("is-changing");
      zephyrExplosionStoryTimer = window.setTimeout(commit, 280);
    }
    return true;
  }
function advanceZephyrExplosionStory() {
    if (!activeZephyrExplosionStoryEventId || zephyrExplosionStoryChanging || zephyrExplosionStoryFinished) return false;
    if (zephyrExplosionStoryIndex >= POSTGAME_ZEPHYR_EXPLOSION_STORY_SCENES.length - 1) return finishZephyrExplosionStory();
    return paintZephyrExplosionStoryScene(zephyrExplosionStoryIndex + 1);
  }
function playZephyrExplosionStory(event) {
    if (!event?.id || !refs.zephyrExplosionStory) return false;
    if (activeZephyrExplosionStoryEventId === event.id && !refs.zephyrExplosionStory.hidden) return true;
    clearZephyrExplosionStory();
    activeZephyrExplosionStoryEventId = event.id;
    refs.zephyrExplosionStory.hidden = false;
    refs.zephyrExplosionStoryProgress.replaceChildren(
      ...POSTGAME_ZEPHYR_EXPLOSION_STORY_SCENES.map(() => document.createElement("span"))
    );
    POSTGAME_ZEPHYR_EXPLOSION_STORY_SCENES.forEach((scene) => {
      const preload = new Image();
      preload.src = scene.image;
    });
    return paintZephyrExplosionStoryScene(0, true);
  }
function syncZephyrExplosionStory(view) {
    const event = view?.battle?.visualEvent;
    if (event?.type === "postgame-zephyr-explosion-story") {
      playZephyrExplosionStory(event);
      return;
    }
    if (activeZephyrExplosionStoryEventId || !refs.zephyrExplosionStory?.hidden) clearZephyrExplosionStory();
  }
 return {refresh(view){latestView=view;syncZephyrExplosionStory(view);},play:playZephyrExplosionStory,advance:advanceZephyrExplosionStory,close:clearZephyrExplosionStory,snapshot(){return {visible:!refs.zephyrExplosionStory.hidden,eventId:activeZephyrExplosionStoryEventId,index:zephyrExplosionStoryIndex,changing:zephyrExplosionStoryChanging,finished:zephyrExplosionStoryFinished,flashRevision,flash:refs.zephyrExplosionStory.classes.has('flash-on'),image:refs.zephyrExplosionStoryImage.src,kicker:refs.zephyrExplosionStoryKicker.textContent,title:refs.zephyrExplosionStoryTitle.textContent,line:refs.zephyrExplosionStoryLine.textContent,hint:refs.zephyrExplosionStoryHint.textContent,progress:refs.zephyrExplosionStoryProgress.children.map(n=>n.classes.has('active')),canControl:viewerCanControlBattle(latestView)};}};
};
