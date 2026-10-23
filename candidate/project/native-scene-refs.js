'use strict';
// Bounded control-state bridge for source functions that close modals or update
// map commands. It does not pretend to be a browser DOM. Unsupported HTML and
// unknown controls fail so an unported screen cannot silently disappear.
exports.create=function createNativeSceneRefs(adapter){
    for(const key of ['clearModal','controlsChanged'])if(typeof adapter[key]!=='function')throw Error('Missing native control adapter '+key);
    function control(name){
        let text='',disabled=false,classes=new Set(),html='';
        const node={dataset:{},
            contains(child){if(name==='modal'&&child?.kind==='move-learn')return adapter.queryModalControls?.('.move-learn-ui').includes(child)||false;throw Error('Native containment not bound: '+name);},
            querySelector(selector){return this.querySelectorAll(selector)[0]||null;},
            querySelectorAll(selector){if(typeof adapter.queryModalControls!=='function')throw Error('Native modal selector not bound: '+selector);return adapter.queryModalControls(selector);},
            get textContent(){return text;},set textContent(value){value=String(value??'');if(text===value)return;text=value;adapter.controlsChanged(name,{text,disabled});},
            get disabled(){return disabled;},set disabled(value){value=!!value;if(disabled===value)return;disabled=value;adapter.controlsChanged(name,{text,disabled});},
            get className(){return [...classes].join(' ');},set className(value){classes=new Set(String(value).split(/\s+/).filter(Boolean));},
            get innerHTML(){return html;},set innerHTML(value){
                value=String(value??'');
                if(value){if(typeof adapter.renderModalMarkup!=='function')throw Error('Native modal renderer required for '+name);adapter.renderModalMarkup(name,value);}
                else if(name==='modal')adapter.clearModal();
                html=value;
            },
            classList:{contains:key=>classes.has(key),add(...keys){keys.forEach(k=>classes.add(k));},remove(...keys){keys.forEach(k=>classes.delete(k));},toggle(key,force){const enabled=force===undefined?!classes.has(key):!!force;if(enabled)classes.add(key);else classes.delete(key);return enabled;}},
        };
        return node;
    }
    const refs=Object.fromEntries(['modal','modalBack','rollDiceBtn','useItemBtn','inspectTileBtn','itemRevealHud','saveGameBtn','voyageRecordStatus'].map(name=>[name,control(name)]));
    if(adapter.extraControls)for(const [name,node]of adapter.extraControls)refs[name]=node;
    return new Proxy(refs,{get(object,key){if(typeof key==='symbol'||key in object)return object[key];throw Error('Native control not bound: '+key);}});
};
// Source BGM selection asks whether one of its scenario overlays is open.
// Unmounted scenes are genuinely absent; unknown DOM operations remain errors.
exports.createOverlayLookup=function(registry,modalControls=null,queryModal=null){
    if(!(registry instanceof Map))throw Error('Native overlay registry required');
    const supported=new Set(['battlePageOverlay','impelDownPageOverlay','marinefordPageOverlay','waterSevenPageOverlay','sparSelectionOverlay','yorkPuzzleOverlay','spectatorModalCloseBtn']);
    // The source CPU polls these modal controls even while their pages are
    // unmounted. Live controls above still win; absence is not an adapter error.
    const optionalCpuControls=new Set(['acceptImpelRecruitBtn','acceptMissionBtn','acceptRecruitBtn','claimMissionRewardBtn','elbaphLokiChallengeBtn','elbaphLokiLeaveBtn','joinCoopBattleBtn','leaveHospitalBtn','leaveMissionBoardBtn','leaveResearchLabBtn','leaveShopBtn','leaveShopListBtn','leaveTavernBtn','postgameBossChallengeBtn','postgameBossLeaveBtn','postgameRocksChallengeBtn','postgameRocksLeaveBtn','rejectFullImpelRecruitBtn','rejectFullRecruitBtn','rejectImpelRecruitBtn','rejectRecruitBtn','rollRecruitBtn','shopBuyBtn','shopQtyConfirm','skipCoopBattleBtn','yonkoStoryLeaveBtn','yonkoStoryStartBtn']);
    const optionalStoryControls=new Set(['acceptSparInviteBtn','clearMapMarkerBtn','markIslandBtn','markSeaTileBtn','finalActivationRitualScene','finalRobinReading','finalRobinLine','finalRitualNarration','finalRitualNarrationLine','closeCpuStrategyBtn','finalEndingNextBtn','finalEndingPrevBtn','finalEndingAutoBtn','finalEndingSkipBtn','finalEndingSpeedSelect','evolveCrewFromDetailBtn','manageBulletArsenalBtn','setupLoadGameBtn','confirmDraftOrderBtn','recruitRollBtn','draftDestinyDisc','draftWheelResult','draftDetailOverlay','draftDetailCloseBtn','draftConfirmPickBtn','draftBoardingStamp','draftStampText','openVoyageRecordsBtn','importLocalVoyageBtn','loadOfflineVoyageBtn','cancelLoadSaveBtn','saveOkBtn','saveManageBtn']);
    return new Proxy({
        hidden:false,
        body:{contains(node){return !!node&&modalControls?.get(node.id)===node;}},
        getElementById(id){if(registry.has(id))return registry.get(id);if(modalControls?.has(id))return modalControls.get(id);if(optionalStoryControls.has(id)||optionalCpuControls.has(id))return null;if(id==='seaTrainMarkBtn'&&modalControls?.has('seaTrainCancelBtn'))return null;if(['acceptMissionBtn','acceptSharedMissionBtn','claimMissionRewardBtn','claimSharedMissionRewardBtn'].includes(id)&&modalControls?.has('leaveMissionBoardBtn'))return null;if(!supported.has(id))throw Error('Native overlay lookup not bound: '+id);return registry.get(id)||null;},
        querySelector(selector){if(typeof queryModal!=='function')throw Error('Native document selector not bound: '+selector);return queryModal(selector)[0]||null;},
        querySelectorAll(selector){if(typeof queryModal!=='function')throw Error('Native document selector not bound: '+selector);return queryModal(selector);},
    },{get(object,key){if(key in object)return object[key];throw Error('Native document operation not bound: '+String(key));}});
};


