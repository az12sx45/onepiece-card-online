'use strict';
// Bounded translation of explicitly supported original screens. No HTML/CSS
// engine is embedded; original event-handler closures remain authoritative.
const {Callable}=require('godot');
function decode(value){return String(value||'').replace(/<[^>]*>/g,'').replace(/&quot;/g,'"').replace(/&#39;|&#x27;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').trim();}
function field(html,pattern,label){const value=html.match(pattern)?.[1];if(value===undefined)throw Error('Original modal field missing: '+label);return decode(value);}
function asset(value){return String(value).split('?')[0];}
class NativeModalBridge{
    constructor(application,{navigate=null}={}){
        this.navigate=navigate;
        this.application=application;this.controls=new Map();this.listeners=new Map();this.model=null;this.story=null;
        this.callback=Callable.create(application,key=>{if(this.compass?.handle(String(key))||this.trade?.handle(String(key))||this.story?.handle(String(key))||this.draft?.handle(String(key))||this.cpu?.handle(String(key)))return;const listener=this.listeners.get(String(key));if(!listener)throw Error('Native modal action has no original handler: '+key);listener();});
        application.connect('modal_command',this.callback);
    }
    control(key,dataset={},initialText=''){
        let text=initialText,disabled=false;
        const control={id:key,dataset,addEventListener:(type,listener)=>{if(type!=='click'||typeof listener!=='function')throw Error('Unsupported native modal listener');this.listeners.set(key,listener);}};
        Object.defineProperty(control,'disabled',{get:()=>disabled,set:value=>{disabled=!!value;if(this.model?.kind==='tavern-result')this.application.get('tavern_modal').call('set_control_disabled',key,disabled);else if(this.model?.kind==='move-learn')this.application.get('move_learn_modal').call('set_control_disabled',key,disabled);}});
        control.click=()=>{if(!disabled)this.listeners.get(key)?.();};control.focus=()=>{};
        const geometry=()=>JSON.parse(this.application.call('modal_button_state_json',key));
        control.getBoundingClientRect=()=>geometry().rect;
        Object.defineProperty(control,'hidden',{get:()=>!geometry().visible});
        Object.defineProperty(control,'nativeComputedStyle',{get:()=>({display:geometry().visible?'block':'none',visibility:'visible',pointerEvents:'auto'})});
        Object.defineProperty(control,'textContent',{get:()=>text,set:value=>{text=String(value??'');if(key===this.model?.quantityKey)this.model.quantity=text;if(key===this.model?.totalKey)this.model.total=text;this.application.get(this.model?.kind==='move-learn'?'move_learn_modal':'shop_modal').call('update_text',key,text);}});
        this.controls.set(key,control);return control;
    }
    bindNativeButton(control,key){
        const geometry=()=>JSON.parse(this.application.call('modal_button_state_json',key));
        control.click=()=>{if(!control.disabled)this.listeners.get(key)?.();};
        // Animated chest cards provide a sampled transform and DOM edge
        // coordinates; retain that geometry instead of replacing it.
        if(!control.getBoundingClientRect)control.getBoundingClientRect=()=>geometry().rect;
        Object.defineProperty(control,'hidden',{get:()=>!geometry().visible});
        Object.defineProperty(control,'nativeComputedStyle',{get:()=>({display:geometry().visible?'block':'none',visibility:'visible',pointerEvents:'auto'})});
        return control;
    }
    render(_name,html){
        this.sourceButtons=[...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(match=>{
            const attrs=Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],decode(m[2])]));
            return {attrs,text:decode(match[2])};
        });
        this.arena?.dispose();this.arena=null;this.mapInfo?.dispose();this.mapInfo=null;this.compass?.dispose();this.compass=null;this.ritual?.dispose();this.ritual=null;this.encounter?.dispose();this.encounter=null;this.trade?.dispose();this.trade=null;this.research?.dispose();this.research=null;this.seaChest?.dispose();this.seaChest=null;this.backpack?.dispose();this.backpack=null;this.codex?.dispose();this.codex=null;this.shipInfo?.dispose();this.shipInfo=null;this.fleet?.dispose();this.fleet=null;this.cpu?.dispose();this.cpu=null;
        this.story?.dispose();this.story=null;
        this.draft?.dispose();this.draft=null;
        this.controls.clear();this.listeners.clear();
        if(html.includes('class="arena-ui"')){this.application.call('begin_modal_transition');this.arena=new (require('./native-arena-bridge').NativeArenaBridge)(this,html);this.model=this.arena.model;return;}
        if(html.includes('class="map-node-info-ui"')){this.application.call('begin_modal_transition');this.mapInfo=new (require('./native-map-info-bridge').NativeMapInfoBridge)(this,html);this.model=this.mapInfo.model;return;}
        if(html.includes('class="final-boss-compass-screen"')){this.application.call('begin_modal_transition');this.compass=new (require('./native-compass-bridge').NativeCompassBridge)(this,html);this.model=this.compass.model;return;}
        if(html.includes('id="finalActivationRitualScene"')||html.includes('id="finalRobinReading"')){this.application.call('begin_modal_transition');this.ritual=new (require('./native-final-ritual-bridge').NativeFinalRitualBridge)(this,html);this.model=this.ritual.model;return;}
        if(html.includes('class="encounter-ui"')){this.application.call('begin_modal_transition');this.encounter=new (require('./native-encounter-bridge').NativeEncounterBridge)(this,html);this.model=this.encounter.model;return;}
        if(html.includes('maple-trade-shell')||html.includes('trade-prompt-title')){this.application.call('begin_modal_transition');this.trade=new (require('./native-trade-bridge').NativeTradeBridge)(this,html,{decode,field,asset});this.model=this.trade.model;return;}
        if(html.includes('class="research-lab-ui')){this.application.call('begin_modal_transition');this.research=new (require('./native-research-bridge').NativeResearchBridge)(this,html);this.model=this.research.model;return;}
        if(html.includes('class="sea-chest-stage-shell')&&!html.includes('is-result')){this.application.call('begin_modal_transition');this.seaChest=new (require('./native-sea-chest-bridge').NativeSeaChestBridge)(this,html,{decode,field,asset});this.model=this.seaChest.model;return;}
        if(html.includes('class="backpack-ui-frame"')){this.application.call('begin_modal_transition');this.backpack=new (require('./native-backpack-bridge').NativeBackpackBridge)(this,html,{decode,field,asset});this.model=this.backpack.model;return;}
        if(html.includes('class="defeated-codex-ui"')){this.application.call('begin_modal_transition');this.codex=new (require('./native-codex-bridge').NativeCodexBridge)(this,html,{decode,field,asset});this.model=this.codex.model;return;}
        if(html.includes('class="ship-info-ui"')){this.application.call('begin_modal_transition');this.shipInfo=new (require('./native-ship-info-bridge').NativeShipInfoBridge)(this,html,{decode,field,asset});this.model=this.shipInfo.model;return;}
        if(html.includes('class="fleet-info-ui"')){this.application.call('begin_modal_transition');this.fleet=new (require('./native-fleet-bridge').NativeFleetBridge)(this,html,{decode,field,asset});this.model=this.fleet.model;return;}
        if(html.includes('class="cpu-strategy-ui"')){this.application.call('begin_modal_transition');this.cpu=new (require('./native-cpu-strategy-bridge').NativeCpuStrategyBridge)(this,html,{decode,field,asset});this.model=this.cpu.model;return;}
        if(html.includes('class="draft-recruitment-shell ')){
            this.application.call('begin_modal_transition');this.draft=new (require('./native-draft-bridge').NativeDraftBridge)(this.application,this.controls,html,{decode,field,asset});this.model=this.draft.model;return;
        }
        if(html.includes('final-ending-screen final-ending-cinematic')){
            this.application.call('begin_modal_transition');
            this.story=new (require('./native-story-bridge').NativeStoryBridge)(this.application,this.controls,html,{decode,field,asset});this.model=this.story.model;return;
        }
        let model=require('./native-marineford-entry-markup').project(html,this);
        if(model){this.model=model;this.application.call('show_save_modal',JSON.stringify(model));return;}
        model=require('./native-spectator-rewards-markup').project(html,this,{decode,field});
        if(model){this.model=model;this.application.call('show_save_modal',JSON.stringify(model));return;}
        model=require('./native-spar-prompt-markup').project(html,this);
        if(model){this.model=model;this.application.call('show_save_modal',JSON.stringify(model));return;}
        model=require('./native-event-notices-markup').project(html,this);
        if(model){this.model=model;this.application.call('show_save_modal',JSON.stringify(model));return;}
        model=require('./native-judicial-entry-markup').project(html,this);
        if(model){this.model=model;this.application.call('show_judicial_entry_modal',JSON.stringify(model));return;}
        model=require('./native-inversion-overview-markup').project(html,this);
        if(model){this.model=model;this.application.call('show_inversion_overview_modal',JSON.stringify(model));return;}
        model=require('./native-yonko-markup').project(html,this);
        if(model){this.model=model;this.application.call('show_yonko_modal',JSON.stringify(model));return;}
        model=require('./native-final-imu-markup').project(html,this);
        if(model){this.model=model;this.application.call('show_final_imu_modal',JSON.stringify(model));return;}
        model=require('./native-sea-train-markup').project(html,this,{decode,field,asset});
        if(model){this.model=model;this.application.call('show_backpack_target_modal',JSON.stringify(model));return;}
        model=require('./native-impel-recruit-markup').project(html,this);
        if(model){this.model=model;this.application.call('show_tavern_modal',JSON.stringify(model));return;}
        model=require('./native-captain-markup').project(html,this);
        if(model){this.model=model;this.application.call('show_captain_modal',JSON.stringify(model));return;}
        model=require('./native-judicial-chest-markup').project(html,this,{decode,field,asset});
        if(model){this.model=model;this.application.call('show_reward_choice_modal',JSON.stringify(model));return;}
        model=require('./native-backpack-target-markup').project(html,this,{decode,field,asset});
        if(model){this.model=model;this.application.call(model.kind==='healing-quantity'?'show_shop_modal':'show_backpack_target_modal',JSON.stringify(model));return;}
        model=require('./native-mission-board-markup').project(html,this,{decode,field,asset});
        if(model){this.model=model;this.application.call('show_mission_board_modal',JSON.stringify(model));return;}
        model=require('./native-mission-journal-markup').project(html,this,{decode,field,asset});
        if(model){this.model=model;this.application.call('show_mission_journal_modal',JSON.stringify(model));return;}
        model=require('./native-network-markup').project(html,this,{decode,field,asset});
        if(model){this.model=model;this.application.call('show_save_modal',JSON.stringify(model));return;}
        model=require('./native-save-markup').project(html,this,{decode,field,asset});
        if(model){this.model=model;this.application.call('show_save_modal',JSON.stringify(model));return;}
        model=require('./native-passive-markup').project(html,this,{decode,field});
        if(model){this.model=model;this.application.call('show_save_modal',JSON.stringify(model));return;}
        model=require('./native-cosmetic-markup').project(html,this,{decode,field,asset});
        if(model){this.model=model;this.application.call('show_cosmetic_modal',JSON.stringify(model));return;}
        model=require('./native-move-learn-markup').project(html,this,{decode,field,asset});
        if(model){this.model=model;this.application.call('show_move_learn_modal',JSON.stringify(model));return;}
        model=require('./native-training-markup').project(html,this,{decode,field,asset});
        if(model){this.model=model;this.application.call(model.kind==='training'?'show_training_modal':'show_shop_modal',JSON.stringify(model));return;}
        model=require('./native-carry-markup').project(html,this,{decode,field,asset});
        if(model){this.model=model;this.application.call('show_carry_modal',JSON.stringify(model));return;}
        model=require('./native-crew-markup').project(html,this,{decode,field,asset});
        if(model){this.model=model;this.application.call('show_crew_modal',JSON.stringify(model));return;}
        model=require('./native-tavern-markup').project(html,this,{decode,field,asset});
        if(model){
            this.model=model;
            if(model.kind==='tavern'){
                const bridge=this,keeper={id:'tavernMakinoImg'};let path=model.keeper;
                Object.defineProperty(keeper,'src',{get:()=>path,set:value=>{path=String(value);bridge.application.get('tavern_modal').call('keeper_frame',path);}});this.controls.set(keeper.id,keeper);
            }else{
                if(!this.tavernPresentation)throw Error('Native tavern reveal/reaction presentation is not connected');
                const bridge=this,node={id:'nativeTavernResult',dataset:model.dataset,classList:{contains:key=>key==='is-full-crew'&&model.full},closest(selector){if(selector==='.board-modal-backdrop')return bridge.nativeRefs?.modalBack||null;throw Error('Unsupported tavern ancestor '+selector);},get isConnected(){return bridge.controls.get(this.id)===this;}};
                this.controls.set(node.id,node);
                this.tavernPresentation.bindResult(node);
            }
            this.application.call('show_tavern_modal',JSON.stringify(model));return;
        }
        model=require('./native-hospital-markup').project(html,this,{decode,field,asset});
        if(model){this.model=model;this.application.call('show_hospital_modal',JSON.stringify(model));return;}
        model=require('./native-shop-markup').project(html,this,{decode,field,asset});
        if(model){
            this.model=model;this.application.call('show_shop_modal',JSON.stringify(model));return;
        }else if(/class="island-decision-ui(?: |")/.test(html)){
            const service=html.includes('island-service-choice-ui'),ids=service?['enterPostBattleIslandBtn','rollFromPostBattleIslandBtn']:['continueSailingBtn','stayOnIslandBtn'];ids.forEach(id=>this.control(id));
            model={kind:service?'island-service-choice':'island-decision',sourceText:decode(html).replace(/\s+/g,' '),title:field(html,/<h3 id="(?:islandDecisionTitle|postBattleIslandChoiceTitle)">([\s\S]*?)<\/h3>/,'island title'),
                image:asset(field(html,/<div class="island-decision-visual">\s*<img\s+src="([^"]+)"/,'island image')),
                remaining:field(html,/<div class="island-decision-remaining">([\s\S]*?)<\/div>/,'remaining').replace(/\s+/g,' '),
                brief:field(html,/<div class="island-decision-brief">([\s\S]*?)<\/div>/,'brief'),
                hint:field(html,/<div class="island-decision-hint">([\s\S]*?)<\/div>/,'hint'),
                actions:ids.map(id=>{const button=html.match(new RegExp('<button[^>]*id="'+id+'"[^>]*>([\\s\\S]*?)<\\/button>'))?.[1];if(!button)throw Error('Original island action missing');return {key:id,label:field(button,/<span>([\s\S]*?)<\/span>/,'action label'),image:asset(field(button,/<img src="([^"]+)"/,'action frame'))};})};
        }else if(html.includes('class="sea-event-choice-ui"')){
            const entries=[...html.matchAll(/<article class="sea-event-choice-entry[^>]*>([\s\S]*?)<\/article>/g)].map(match=>{
                const body=match[1],readonly=body.includes('spectator-readonly-card'),slot=readonly?'':field(body,/data-sea-choice="([^"]*)"/,'sea choice'),type=field(body,/data-sea-type="([^"]*)"/,'sea type'),key=readonly?'':'sea:'+slot;
                const label=field(body,/<strong>([\s\S]*?)<\/strong>/,'sea label');
                const control=readonly?{}:this.control(key,{seaChoice:slot,seaType:type},label);
                // The source button has a fallback label, but no .choice-card
                // ancestor. Preserve that exact lookup for original CPU scoring.
                control.closest=selector=>{if(selector==='.choice-card')return null;throw Error('Unsupported sea card ancestor: '+selector);};
                return {key,...(readonly?{readonly:true}:{}),image:asset(field(body,/<img src="([^"]+)"/,'sea card')),label:field(body,/<strong>([\s\S]*?)<\/strong>/,'sea label'),teaser:field(body,/<div class="sea-event-choice-info">[\s\S]*?<span>([\s\S]*?)<\/span>/,'sea teaser'),details:[...body.matchAll(/<em>([\s\S]*?)<\/em>/g)].map(m=>decode(m[1]))};
            });
            if(entries.length!==2)throw Error('Original sea choice count changed');
            model={kind:'sea-choice',title:field(html,/<h3>([\s\S]*?)<\/h3>/,'sea title'),subtitle:field(html,/<div class="sea-event-ui-subtitle">([\s\S]*?)<\/div>/,'sea subtitle'),entries};
            if(html.includes('id="spectatorModalCloseBtn"')){
                const key='spectatorModalCloseBtn',label=field(html,/<button[^>]*id="spectatorModalCloseBtn"[^>]*>([\s\S]*?)<\/button>/,'spectator close');
                this.control(key,{},label);model.actions=[{key,label,image:'images/board/encounter_ui/encounter_action_button_frame.webp'}];
            }
        }else if(html.includes('class="sea-event-result-ui"')){
            const key=field(html,/<div class="sea-event-result-actions">[\s\S]*?<button[^>]*id="([^"]+)"/,'sea result action');
            const action=html.match(new RegExp('<button[^>]*id="'+key+'"[^>]*>([\\s\\S]*?)<\\/button>'))?.[1];
            this.control(key,{},decode(action));
            model={kind:'sea-result',title:field(html,/<h3>([\s\S]*?)<\/h3>/,'sea result title'),
                subtitle:field(html,/<div class="sea-event-ui-subtitle">([\s\S]*?)<\/div>/,'sea result subtitle'),
                image:asset(field(html,/<div class="sea-event-result-card">[\s\S]*?<img src="([^"]+)"/,'sea result card')),
                brief:field(html,/<div class="sea-event-result-description">[\s\S]*?<p>([\s\S]*?)<\/p>/,'sea result description'),
                hint:field(html,/<div class="sea-event-result-summary">([\s\S]*?)<\/div>/,'sea result summary'),
                actions:[{key,label:decode(action),image:asset(field(action,/<img src="([^"]+)"/,'sea result button'))}]};
        }else if(html.includes('class="sea-reveal"')&&(html.includes('id="confirmSeaEventBtn"')||html.includes('id="confirmSeaTreasureChestBtn"')||html.includes('id="spectatorModalCloseBtn"'))){
            const confirmId=html.includes('id="spectatorModalCloseBtn"')?'spectatorModalCloseBtn':html.includes('id="confirmSeaTreasureChestBtn"')?'confirmSeaTreasureChestBtn':'confirmSeaEventBtn';this.control(confirmId);
            const rows=[...html.matchAll(/<div class="sea-reveal-outcome"[^>]*>([\s\S]*?)<\/div>/g)].map(m=>field(m[1],/<span>([\s\S]*?)<\/span>/,'outcome').replace(/\s+/g,' '));
            const action=html.match(new RegExp('<button[^>]*id="'+confirmId+'"[^>]*>([\\s\\S]*?)<\\/button>'))?.[1];
            if(!action)throw Error('Original sea result action missing');
            model={kind:'sea-result',title:field(html,/<h3>([\s\S]*?)<\/h3>/,'result title'),subtitle:field(html,/<header class="sea-reveal-header">[\s\S]*?<p>([\s\S]*?)<\/p>/,'result subtitle'),
                image:asset(field(html,/<img class="sea-reveal-illustration" src="([^"]+)"/,'result illustration')),
                brief:field(html,/<p class="sea-reveal-description">([\s\S]*?)<\/p>/,'result description'),
                hint:[...rows,'航海結果',field(html,/<div class="sea-reveal-summary"[^>]*>[\s\S]*?<strong>([\s\S]*?)<\/strong>/,'result summary')].join('\n'),
                actions:[{key:confirmId,label:decode(action),image:action.includes('<img')?asset(field(action,/<img src="([^"]+)"/,'confirm frame')):'images/board/encounter_ui/encounter_action_button_frame.webp'}]};
        }else throw Error('Native modal screen not implemented: '+html.slice(0,100));
        this.model=model;this.application.call('show_choice_modal',JSON.stringify(model));
    }
    query(selector){
        if(!this.model)return [];
        // Global source/CPU discovery must resolve before dispatch to the
        // active page. An encounter (or any other page) is not a cinematic.
        if(selector.startsWith('.final-ending-')||selector==='[data-final-ending-choice]')return this.story?this.story.query(selector):[];
        if(selector==='.tavern-result-ui')return this.controls.has('nativeTavernResult')?[this.controls.get('nativeTavernResult')]:[];
        // This legacy CPU selector has no matching sibling in the current
        // fleet markup (closeFleetInfoBtn has neither of these classes).
        if(selector==='#openDefeatedCodexBtn + .modal-btn.primary')return [];
        const primary=selector.match(/^\.(modal-btn|final-imu-btn|final-ending-btn)\.primary:not\(:disabled\)$/);
        if(primary)return (this.sourceButtons||[]).filter(button=>{
            const classes=(button.attrs.class||'').split(/\s+/);return classes.includes(primary[1])&&classes.includes('primary');
        }).map(button=>{
            const attributes=button.attrs;
            const node=attributes.id?this.controls.get(attributes.id):[...this.controls.values()].find(control=>
                Object.keys(attributes).some(key=>key.startsWith('data-'))&&Object.entries(attributes).filter(([key])=>key.startsWith('data-')).every(([key,value])=>control.dataset?.[key.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]===value));
            if(!node)throw Error('Original primary button has no native binding: '+(attributes.id||button.text));
            return node;
        }).filter(node=>!node.disabled);
        const byId=selector.match(/^#([\w-]+)(:not\(:disabled\))?$/);
        if(byId){const node=this.controls.get(byId[1]);return node&&(!byId[2]||!node.disabled)?[node]:[];}
        // These selectors own containers/selects rather than registered button
        // ids. Resolve them before the generic data-attribute button lookup.
        if(this.seaChest&&['[data-sea-chest-grid]','[data-sea-chest-stage-note]'].includes(selector))return this.seaChest.query(selector);
        if(this.shipInfo&&['[data-ship-info-tab-button]','[data-ship-info-page]'].includes(selector))return this.shipInfo.query(selector);
        if(this.cpu&&(selector==='[data-cpu-strategy-player]'||selector.startsWith('[data-cpu-strategy-desc=')))return this.cpu.query(selector);
        if(this.ritual&&selector==='[data-final-story-skip]')return this.ritual.query(selector);
        const byData=selector.match(/^\[data-([\w-]+)(?:=['"]([^'"]*)['"])?\](:not\(:disabled\))?$/);
        if(byData){const name=byData[1].replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase());return [...this.controls.values()].filter(node=>node.dataset?.[name]!==undefined&&(byData[2]===undefined||String(node.dataset[name])===byData[2])&&(!byData[3]||!node.disabled));}
        const owner={'.move-learn-ui':'move-learn','.mission-board-modal .mission-shell, .mission-shell':'mission-board','.mission-card.selected':'mission-board','.shop-item-row.is-selected':'shop','.tavern-result-card .tavern-grade-badge':'tavern-result','.tavern-result-meta-grid > span:nth-child(2) strong, .tavern-result-card .companion-tier':'tavern-result','.tavern-result-name, .tavern-result-card .companion-name':'tavern-result'}[selector];
        if(owner&&this.model.kind!==owner)return [];
        if(selector==='.move-learn-ui')return this.model.kind==='move-learn'?[this.model]:[];
        if(selector==='.mission-board-modal .mission-shell, .mission-shell')return this.model.kind==='mission-board'?[this.model]:[];
        if(selector==='.mission-card.selected'){const row=this.model.entries?.find(entry=>entry.selected);return row?[this.controls.get(row.key)]:[];}
        if(selector==='.shop-item-row.is-selected'){const row=this.model.rows?.find(entry=>entry.selected);return row?[this.controls.get(row.key)]:[];}
        if(this.model.kind==='tavern-result'){
            if(selector==='.tavern-result-name, .tavern-result-card .companion-name')return [{textContent:this.model.name}];
            if(selector==='.tavern-result-meta-grid > span:nth-child(2) strong, .tavern-result-card .companion-tier')return [this.controls.get('tavern-result-role')];
            if(selector==='.tavern-result-card .tavern-grade-badge')return [];
        }
        if(this.model?.kind==='spar-prompt'&&selector==='[data-spar-partner]')return [...this.controls.values()].filter(c=>c.dataset?.sparPartner);
        if(selector==='.island-service-choice-ui')return this.model?.kind==='island-service-choice'?[{id:'native-island-service'}]:[];
        if(this.arena)return this.arena.query(selector);
        if(this.mapInfo)return this.mapInfo.query(selector);
        if(this.compass)return this.compass.query(selector);
        if(this.ritual)return this.ritual.query(selector);
        if(this.encounter)return this.encounter.query(selector);
        if(this.trade)return this.trade.query(selector);
        if(this.model?.kind==='captain-selection'&&selector==='[data-captain-preview]')return [...this.controls.values()].filter(c=>c.dataset?.captainPreview!==undefined);
        if(this.model?.kind==='impel-entry'&&selector==='[data-impel-rescue]')return [...this.controls.values()].filter(c=>c.dataset?.impelRescue!==undefined);
        if(this.model?.kind==='impel-recruit-result'&&selector==='[data-impel-replace-crew]')return [...this.controls.values()].filter(c=>c.dataset?.impelReplaceCrew!==undefined);
        if(this.research)return this.research.query(selector);
        if(this.seaChest)return this.seaChest.query(selector);
        if(this.model?.kind==='sea-train'&&selector==='[data-sea-train-destination]')return [...this.controls.values()].filter(c=>c.dataset?.seaTrainDestination!==undefined);
        if(this.model?.kind==='judicial-chest'&&selector==='[data-judicial-chest-choice]')return [...this.controls.values()].filter(c=>c.dataset?.judicialChestChoice!==undefined);
        if(this.model?.kind==='fixed-step'&&selector==='[data-fixed-step]')return [...this.controls.values()].filter(c=>c.dataset?.fixedStep!==undefined);
        if(this.model?.kind==='backpack-target'&&/^\[data-backpack-[\w-]+-target\]$/.test(selector)){const field=selector.slice(6,-1).split('-').map((s,i)=>i?s[0].toUpperCase()+s.slice(1):s).join('');return [...this.controls.values()].filter(c=>c.dataset?.[field]!==undefined);}

        if(this.backpack&&['[data-backpack-pocket]','.backpack-list-panel','.backpack-bag-art'].includes(selector))return this.backpack.query(selector);
        if(this.model?.kind==='mission-board'&&selector==='[data-mission-select]')return [...this.controls.values()].filter(c=>c.dataset?.missionSelect!==undefined);
        if(this.model?.kind==='mission-journal'&&['[data-journal-select]','[data-journal-claim]','[data-journal-main-claim]','[data-journal-abandon]'].includes(selector)){const field=selector.slice(6,-1).split('-').map((s,i)=>i?s[0].toUpperCase()+s.slice(1):s).join('');return [...this.controls.values()].filter(c=>c.dataset?.[field]!==undefined);}
        if(this.codex&&selector==='[data-codex-index]')return this.codex.query(selector);
        if(this.shipInfo&&['.ship-info-ui','[data-ship-info-tab-button]','[data-ship-info-page]'].includes(selector))return this.shipInfo.query(selector);
        if(this.fleet&&selector==='[data-fleet-role]')return this.fleet.query(selector);
        if(this.cpu&&(selector==='[data-cpu-strategy-player]'||selector.startsWith('[data-cpu-strategy-desc=')))return this.cpu.query(selector);
        if(this.draft&&selector==='[data-draft-card-id]')return this.draft.query(selector);
        if(selector==='[data-arsenal-slot]'&&this.model?.arsenal)return [...this.controls.values()].filter(c=>c.dataset?.arsenalSlot!==undefined);
        if(selector==='[data-arsenal-inventory-index]'&&this.model?.arsenal)return [...this.controls.values()].filter(c=>c.dataset?.arsenalInventoryIndex!==undefined);
        if(selector==='[data-preview-cosmetic-frame]'&&this.model?.kind==='cosmetic')return [...this.controls.values()].filter(c=>c.dataset?.previewCosmeticFrame!==undefined);
        if(selector==='.cosmetic-frame-choice-list'&&this.model?.kind==='cosmetic')return [this.controls.get('cosmetic-choice-list')];
        if(selector==='[data-forget-move-id]'&&this.model?.kind==='move-learn')return [...this.controls.values()].filter(c=>c.dataset?.forgetMoveId!==undefined);
        if(selector==='[data-training-material-use]'&&this.model?.kind==='training')return [...this.controls.values()].filter(c=>c.dataset?.trainingMaterialUse!==undefined);
        if(selector==='.training-character-caption'&&this.model?.kind==='training')return [this.controls.get('training-caption')];
        if(selector==='[data-equip-carry-index]'&&this.model?.kind==='carry')return [...this.controls.values()].filter(c=>c.dataset?.equipCarryIndex!==undefined);
        if(selector==='[data-crew-toggle]'&&this.model?.kind==='crew-roster')return [...this.controls.values()].filter(c=>c.dataset?.crewToggle!==undefined);
        if(selector==='[data-sea-choice]'&&this.model?.kind==='sea-choice')return [...this.controls.values()];
        if(selector==='[data-shop-select]'&&this.model?.kind==='shop')return [...this.controls.values()].filter(c=>c.dataset.shopSelect);
        if(selector==='[data-hospital-service]'&&this.model?.kind==='hospital')return [...this.controls.values()].filter(c=>c.dataset.hospitalService);
        if(selector==='[data-tavern-candidate]'&&this.model?.kind==='tavern')return [...this.controls.values()].filter(c=>c.dataset?.tavernCandidate);
        if(selector==='[data-replace-crew]'&&this.model?.kind==='tavern-result')return [...this.controls.values()].filter(c=>c.dataset?.replaceCrew!==undefined);
        if(selector==='.tavern-candidate-list'&&this.model?.kind==='tavern'){
            const stage=this.application.get('tavern_modal');return [{get scrollTop(){return stage.call('list_scroll_top');},set scrollTop(value){stage.call('set_list_scroll_top',Number(value)||0);}}];
        }
        if(selector==='.shop-list'&&this.model?.kind==='shop'){
            const stage=this.application.get('shop_modal');
            return [{get scrollTop(){return stage.call('list_scroll_top');},set scrollTop(value){stage.call('set_list_scroll_top',Number(value)||0);}}];
        }
        throw Error('Native modal selector not implemented: '+selector);
    }
    bindings(){return {
        captureModalScrollState:()=>this.model?.kind==='arena'?JSON.parse(this.application.get('arena_modal').call('capture_scroll_json')):this.model?.kind==='shop'?JSON.parse(this.application.get('shop_modal').call('capture_scroll_json')):this.model?.kind==='tavern'?[{key:'tavern-candidate-list',top:this.application.get('tavern_modal').call('list_scroll_top')}]:[],
        restoreModalScrollState:(_root,entries)=>{if(this.model?.kind==='arena')this.application.get('arena_modal').call('restore_scroll_json',JSON.stringify(entries));else if(this.model?.kind==='shop')this.application.get('shop_modal').call('restore_scroll_json',JSON.stringify(entries));else if(this.model?.kind==='tavern')for(const entry of entries)if(entry.key==='tavern-candidate-list')this.application.get('tavern_modal').call('set_list_scroll_top',entry.top);},
    };}
    clear(){this.arena?.dispose();this.arena=null;this.mapInfo?.dispose();this.mapInfo=null;this.compass?.dispose();this.compass=null;this.ritual?.dispose();this.ritual=null;this.encounter?.dispose();this.encounter=null;this.trade?.dispose();this.trade=null;this.research?.dispose();this.research=null;this.seaChest?.dispose();this.seaChest=null;this.backpack?.dispose();this.backpack=null;this.codex?.dispose();this.codex=null;this.shipInfo?.dispose();this.shipInfo=null;this.fleet?.dispose();this.fleet=null;this.cpu?.dispose();this.cpu=null;this.story?.dispose();this.story=null;this.draft?.dispose();this.draft=null;this.model=null;this.controls.clear();this.listeners.clear();this.tavernPresentation?.cancel();this.application.call('request_modal_close');}
    dispose(){this.arena?.dispose();this.arena=null;this.mapInfo?.dispose();this.mapInfo=null;this.compass?.dispose();this.compass=null;this.ritual?.dispose();this.ritual=null;this.encounter?.dispose();this.encounter=null;this.trade?.dispose();this.trade=null;this.research?.dispose();this.research=null;this.seaChest?.dispose();this.seaChest=null;this.backpack?.dispose();this.backpack=null;this.codex?.dispose();this.shipInfo?.dispose();this.fleet?.dispose();this.cpu?.dispose();this.story?.dispose();this.draft?.dispose();this.tavernPresentation?.dispose();this.application.disconnect('modal_command',this.callback);this.callback=null;}
}
exports.NativeModalBridge=NativeModalBridge;





