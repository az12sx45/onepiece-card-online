'use strict';
const {Callable}=require('godot');
const fx=require('./original-move-fx'),catalog=require('./original-fx-catalog'),dice=require('./original-dice-presentation');
const visualHp=require('./original-visual-hp');
const status=require('./original-status-presentation');
const result=require('./original-result-presentation');
const mechanics=require('./native-boss-mechanics');
const attributes=require('./original-attribute-presentation');
const demon=require('./original-demon-presentation');
const blackTurn=require('./original-black-turn-presentation');
const lucciSix=require('./original-lucci-six-presentation');
const oars=require('./original-oars-presentation');
const saga=require('./original-saga-presentation');
const bullet=require('./original-bullet-presentation');
const battleIdentity=require('./original-battle-identity');
class NativeBattleScene {
    constructor(stage,callbacks){
        for(const key of ['closeModal','log','map'])if(typeof callbacks[key]!=='function')throw Error('Missing native application scene callback '+key);
        this.stage=stage;this.callbacks=callbacks;this.view=null;this.sequence=0;this.events=new Map();this.failures=[];this.closing=false;
        this.metrics={updates:0,plays:0,completed:0,deduplicated:0};
        this.statusControls=Object.fromEntries(['player','enemy'].map(side=>[side,require('./original-status-controls').create({Controls:require('./native-lineage-controls')})]));
        this.icons=status.createIcons(view=>this.applyHud(view));
        this.iconCallback=Callable.create(stage,(side,id)=>this.icons.release(side,id));
        stage.connect('status_icons_ready',this.iconCallback);
        // GodotJS Callable owners must be Godot objects. The bound JS scene is
        // released by disconnecting explicitly in dispose().
        this.callback=Callable.create(stage,this._finished.bind(this));
        stage.connect('presentation_finished',this.callback);
        this.lineage=null;
        this.prompts=new(require('./native-boss-prompt-bridge').NativeBossPromptBridge)(stage);
        this.totActions=new(require('./native-tot-actions-bridge').NativeTotActionsBridge)(stage);
        this.totStage=new(require('./native-tot-stage-bridge').NativeTotStageBridge)(stage);
        this.zephyr=new(require('./native-zephyr-story-bridge').NativeZephyrStoryBridge)(stage);
        this.bulletNode=stage.get('timeline').get('bullet');this.bulletEvent=null;
        this.bulletGeometry=Callable.create(stage,value=>{if(this.bulletEvent)this.bulletNode.call('replace_packet_json',JSON.stringify(bullet.prepare(this.bulletEvent,JSON.parse(value))));});
        this.bulletNode.connect('geometry_changed',this.bulletGeometry);
    }
    show(packet={skip:true}){this.closing=false;this.stage.call('request_open_json',JSON.stringify(packet));}
    isOpen(){return this.stage.call('is_visible');}
    beginClose(){this.closing=true;this.stage.call('begin_close');}
    close(){this.closing=false;if(this.judicialReward)this.judicialReward.close();this.zephyr.close();this.stage.call('close_surface');if(this.lineage)this.lineage.refresh(null);this.prompts.refresh(null);this.totActions.refresh(null);this.totStage.refresh(null);}
    enableJudicialReward(options){if(this.judicialReward)throw Error('Judicial bridge already bound');this.judicialReward=new(require('./native-judicial-reward-bridge').NativeJudicialRewardBridge)(this.stage,options);return this.judicialReward;}
    closeModal(){this.callbacks.closeModal();}
    ready(){return this.stage.is_inside_tree()&&this.stage.call('presentation_ready');}
    log(lines){this.callbacks.log(lines);}
    map(game){return this.callbacks.map(game);}
    ships(game){return this.callbacks.ships?this.callbacks.ships(game):this.map(game);}
    wait(ms){return new Promise(resolve=>setTimeout(resolve,Math.max(0,Number(ms)||0)));}
    reportError(error){if(!this.failures.includes(error.message))this.failures.push(error.message);}
    async waitIdle(){while([...this.events.values()].some(event=>event.pending))await Promise.allSettled([...this.events.values()].filter(event=>event.pending).map(event=>event.promise));}
    hasPendingBattlePresentation(){return [...this.events.values()].some(event=>event.pending&&!['turn-banner','mission-complete-toast'].includes(event.type));}
    applyHud(view){
        const packet={...view,_nativeAttribute:attributes.prepare(view)};
        for(const [side,field] of [['player','activeCard'],['enemy','enemy']]){
            const actor=view[field];if(!actor)continue;
            this.statusControls[side].refresh(actor,side,view);
            packet[field]={...actor,_nativeStatusIcons:this.statusControls[side].project()};
            if(side==='enemy')packet[field]._nativeDemon=demon.prepare(actor);
        }
        this.stage.call('apply_view_json',JSON.stringify(packet));
    }
    update(view){
        this.metrics.updates++;
        const identity=battleIdentity.key(view);
        // Source resetBattleSessionVisualState clears held transforms before
        // rendering a new enemy/raid/intro even when no visualEvent is queued.
        if(identity&&identity!==this.battleIdentity){this.stage.call('reset_battle_actor_visuals',identity);this.stage.call('cancel_black_turn_visual');this.stage.call('cancel_lucci_six_visual');this.stage.call('cancel_oars_visual');this.stage.call('cancel_saga_visual');this.bulletNode.call('cancel');this.bulletEvent=null;}
        this.battleIdentity=identity;
        this.view=view;
        this.prompts.refresh(view);
        this.totActions.refresh(view);
        this.totStage.refresh(view);
        this.zephyr.refresh(view);
        if(!view?.battle){this.icons.dispose();if(this.lineage)this.lineage.refresh(view);return;}
        // This presentation-only member never enters the source game state or
        // network snapshot. Labels/rewards come from the original renderer.
        this.applyHud(this.icons.update({...view,_nativeResult:result.prepare(view),_nativeMechanic:mechanics.prepare(view)}));
        if(view.battle.lineageExtraction&&!this.lineage)this.lineage=new(require('./native-lineage-bridge').NativeLineageBridge)(this.stage);
        if(this.lineage)this.lineage.refresh(view);
        const event=view?.battle?.visualEvent;
        if(event?.id){
            // Source handleVisualEvent clears a prior transform only for a new
            // visual ID. Ordinary snapshot refreshes and separate toasts do not.
            if(!this.events.has(String(event.id))&&event.type!=='sanji-raid-suit-transform')this.stage.call('cancel_sanji_visual');
            if(!this.events.has(String(event.id))&&event.type!=='kyubi-mask')this.stage.call('cancel_kyubi_visual');
            this.play(event).catch(error=>{if(!this.failures.includes(error.message))this.failures.push(error.message);});
        }
    }
    play(event){
        const id=String(event.id||'native-presentation-'+(++this.sequence));
        if(this.events.has(id)){this.metrics.deduplicated++;return this.events.get(id).promise;}
        this.metrics.plays++;
        let resolve,reject;
        const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
        promise.catch(error=>this.reportError(error));
        this.events.set(id,{promise,resolve,reject,pending:true,type:event.type});
        if(event.type!=='black-turn-cast')this.stage.call('cancel_black_turn_visual');
        if(event.type!=='postgame-lucci-six-power')this.stage.call('cancel_lucci_six_visual');
        if(event.type!=='postgame-oars-purify')this.stage.call('cancel_oars_visual');
        if(event.type!=='postgame-saga-fusion')this.stage.call('cancel_saga_visual');
        if(event.type!=='postgame-bullet-fusion'){this.bulletNode.call('cancel');this.bulletEvent=null;}
        if(event.type==='postgame-zephyr-explosion-story'){
            this.stage.call('begin_external_presentation',id);
            const finished=error=>{this.stage.call('end_external_presentation',id);this._finished(id,error);};
            this.zephyr.play(event).then(()=>finished(''),error=>finished(error.message||String(error)));
            return promise;
        }
        if(event.type==='raid-phase-reward'){
            if(!this.judicialReward){this._finished(id,'Original Judicial authority was not bound');return promise;}
            this.stage.call('begin_external_presentation',id);
            const finished=error=>{this.stage.call('end_external_presentation',id);this._finished(id,error);};
            this.judicialReward.play(event).then(()=>finished(''),error=>finished(error.message||String(error)));
            return promise;
        }
        if(['tot-musica-dual-sync','tot-musica-enemy-dual-strike'].includes(event.type)){
            this.stage.call('begin_external_presentation',id);
            const finished=error=>{this.stage.call('end_external_presentation',id);this._finished(id,error);};
            this.totStage.play(event).then(()=>finished(''),error=>finished(error.message||String(error)));
            return promise;
        }
        const sound=phase=>{const mapped=fx.soundFor(catalog,event,phase);return mapped===undefined?(event[phase+'Sfx']||''):mapped;};
        const packet={event,profile:fx.resolve(catalog,event)||{},sounds:{cast:sound('cast'),hit:sound('hit')},dice:['dice','bonus'].includes(event.type)?dice.prepare(event,this.view):{},hp:visualHp.prepare({...this.view,battle:{...this.view?.battle,visualEvent:event}})||{}};
        packet.status=['status','heal','passive-opening'].includes(event.type)||event.specialFx==='lucci-rokuogan'&&event.effectFx?status.prepare(event):{};
        if(event.type==='postgame-aramaki-revive')packet.status=status.prepare({...event,type:'heal'});
        if(event.type==='postgame-lucci-six-power')packet.lucciSix={loaded:lucciSix.prepare(event,true),fallback:lucciSix.prepare(event,false)};
        if(event.type==='postgame-oars-purify')packet.oars=oars.prepare(event);
        if(event.type==='postgame-saga-fusion')packet.saga=saga.prepare(event);
        if(event.type==='postgame-bullet-fusion'){this.bulletEvent=event;packet.bullet=bullet.prepare(event,JSON.parse(this.bulletNode.call('geometry_json')));}
        if(event.type==='black-turn-cast'){
            const geometry=JSON.parse(this.stage.call('black_turn_geometry_json'));
            packet.blackTurn=blackTurn.prepare(event,geometry,{enemy:geometry.enemyImage});
        }
        if(event.type==='kyubi-mask'){
            const from=event.fromAttribute||this.view?.activeCard?.naturalAttribute||this.view?.activeCard?.attribute||'無',target=event.targetAttribute||attributes.prepare(this.view).attribute,cycle=Array.isArray(event.attributes)&&event.attributes.length?event.attributes:['力','速','技'];
            packet.kyubi={from,target,cycle,displays:Object.fromEntries([...new Set([from,target,...cycle])].map(value=>[value,attributes.prepare(this.view,value)]))};
        }
        this.stage.call('present_json',id,JSON.stringify(packet));
        return promise;
    }
    _finished(id,error){
        if(id==='prebattle-error'){this.reportError(Error(error));return;}
        const entry=this.events.get(id);if(!entry||!entry.pending)return;
        entry.pending=false;
        this.metrics.completed++;
        if(error)entry.reject(Error(error));else entry.resolve();
        for(const [key,value] of this.events){if(this.events.size<=512)break;if(!value.pending)this.events.delete(key);}
    }
    dispose(){
        this.close();
        if(this.judicialReward)this.judicialReward.dispose();
        this.zephyr.dispose();
        this.totStage.dispose();
        this.totActions.dispose();
        this.prompts.dispose();
        if(this.lineage)this.lineage.dispose();
        this.icons.dispose();
        for(const controller of Object.values(this.statusControls))controller.dispose();
        this.stage.disconnect('status_icons_ready',this.iconCallback);
        this.stage.disconnect('presentation_finished',this.callback);
        this.bulletNode.disconnect('geometry_changed',this.bulletGeometry);this.bulletGeometry=null;this.bulletEvent=null;
        this.iconCallback=null;this.callback=null;
        if([...this.events.values()].some(event=>event.pending))throw Error('Native battle disposed with pending presentation');
        this.events.clear();
    }
}
exports.NativeBattleScene=NativeBattleScene;
