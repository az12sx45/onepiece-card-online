'use strict';
// Replace browser presentation boundaries only. Rules, command authorization,
// queueing, dice rolls, damage, inventory, rewards and sync stay in source core.
exports.bind = function bindBattlePlatform(api, scene, hostWindow=null) {
    for(const name of ['show','closeModal','update','ready','play','log','map','wait']){
        if(typeof scene[name]!=='function')throw Error('Native battle scene missing '+name);
    }
    const f=api.functions,state=api.state;
    const pendingToasts=new Set();
    let overlayEpoch=0,overlayOpen=false,entryTimer=null,closeTimer=null;
    // A delayed map/handoff close can arrive while the next CPU action is
    // awaiting its native animation. Closing the channel here makes the source
    // fall back to browser DOM animations and strands battle.animating=true.
    const actionOwnsSurface=()=>!!state.battleState&&!state.gameState?.battleExitLock
        &&(!!state.battleState.animating||scene.hasPendingBattlePresentation?.());
    const spectator=require('./native-battle-spectator').create({update:view=>scene.update(view),play:event=>scene.play(event),resume:()=>{api.presentation.resumeRemotePlayback();f.resumeAfterRemoteBoardPlayback();},reportError:error=>scene.reportError(error)});
    scene.spectatorPlayback=spectator;
    const channel={closed:false,__BOARD_BATTLE_DEBUG__:{refresh:view=>spectator.refresh(view),spectatorPlaybackState:()=>spectator.status()},postMessage(message){
        if(message.type==='board-battle-update')spectator.update(message.snapshot.view);
        else throw Error('Unimplemented native battle message '+message.type);
    }};
    const rewardControl=battle=>{
        const player=f.battlePlayer(null,battle);
        return !!player&&!f.isCpuPlayer(player)&&f.canBoardLanControlBattlePlayer(player,battle)
            &&(!f.isCoopBattle(battle)||battle.result!=='win'||String(f.currentPlayer()?.id||'')===String(player.id||''));
    };
    const judicial=hostWindow?scene.enableJudicialReward({window:hostWindow,channel,canControl:()=>rewardControl(state.battleState)}):null;
    return {
        openBattleWindow(){
            if(closeTimer!==null){clearTimeout(closeTimer);closeTimer=null;}
            overlayEpoch++;
            let packet={repeat:true};
            // The original openBattleWindow consumes this snapshot flag only
            // on the first open, including entry into chapter/rescue battles.
            if(!overlayOpen){
                const syncedEntry=f.activeSyncedBattleEntryTransition(state.battleState);
                const skipMapShake=Boolean(state.gameState.skipNextBattleMapShake)&&!syncedEntry;
                state.gameState.skipNextBattleMapShake=false;overlayOpen=true;
                const delay=syncedEntry?Math.max(0,Number(syncedEntry.startsAt||0)-Date.now()):0;
                packet={skip:skipMapShake,delay};
                if(syncedEntry){
                    f.scheduleBattlePrebattleIntroAt(syncedEntry.introAt,delay+4100);
                    entryTimer=setTimeout(()=>{entryTimer=null;f.rememberPlayedBattleEntryTransition(syncedEntry.key);},delay+900);
                }
                else f.scheduleBattlePrebattleIntroShow(skipMapShake?1000:4100);
            }else if(typeof scene.isOpen!=='function'||scene.isOpen())f.scheduleBattlePrebattleIntroShow(1000);
            scene.show(packet);channel.closed=false;state.battleWindow=channel;
            return channel;
        },
        closeBattlePageOverlay(){
            if(api.boardLan.connected&&!api.boardLan.awaitingInitialState&&(api.boardLan.pendingRemoteBattleViews.length||spectator.status().active))return;
            if(actionOwnsSurface())return;
            // Repeated terminal snapshots must not postpone the same close.
            if(closeTimer!==null)return;
            f.clearBattlePageOverlayOpenTimers();f.clearBattlePrebattleIntroRecoveryTimer();
            if(entryTimer!==null){clearTimeout(entryTimer);entryTimer=null;}
            if(typeof scene.beginClose!=='function')throw Error('Native battle closing state boundary required');
            scene.beginClose();
            const token=++overlayEpoch;
            closeTimer=setTimeout(()=>{
                closeTimer=null;
                if(token!==overlayEpoch)return;
                // Also check at commit: the action may have started during the
                // 260 ms transition. Restore opacity without advancing rules.
                if(actionOwnsSurface()){scene.show({repeat:true});return;}
                if(typeof scene.close!=='function')throw Error('Native battle close boundary required');
                scene.close();channel.closed=true;overlayOpen=false;
                api.presentation.resumeRemotePlayback();f.resumeAfterRemoteBoardPlayback();
            },260);
        },
        updateShipTokensOnMap(){return (scene.ships?scene.ships(state.gameState):scene.map(state.gameState))===true;},
        renderMap(){return scene.map(state.gameState);},
        showTurnTransitionBanner(event={}){
            const model=api.presentation.turnBanner(event);
            scene.play({...event,...model,type:'turn-banner'}).catch(error=>{if(scene.reportError)scene.reportError(error);else throw error;});
            return model.transitionDelay;
        },
        // Keep the original renderBattleInterface orchestration. Its conditional
        // closeModal clears source timers, event locks and backdrop state before
        // the already-bound native openBattleWindow/notify boundaries run.
        battlePageReadyForOpeningVisuals(){return scene.ready();},
        async playBattleIntroIfNeeded(player,battle){
            if(battle.introPlayed)return;
            battle.introPlayed=true;
            await scene.play({type:'battle-intro',playerName:player.name,enemyName:battle.enemyCombatant.name,duration:f.battleAnimationDuration(520)});
        },
        playBattleRoundEndAnimation(battle){return scene.play({type:'round-end',result:battle.result,duration:f.battleAnimationDuration(520)});},
        async waitBattleWindowVisual(event,fallbackDuration=900){
            if(!f.battleWindowIsActive())return;
            if(event?.type==='raid-phase-reward'&&judicial){
                const battle=state.battleState;
                const waiting=judicial.wait(event,{sourceWindow:()=>state.battleWindow,isCurrent:()=>state.battleState===battle&&battle.visualEvent?.id===event.id,canControl:()=>rewardControl(battle)});
                const presentation=scene.play(event);
                if(waiting){const acknowledged=await waiting;if(!acknowledged){judicial.close();await presentation;if(state.battleState!==battle)return;throw Error('Judicial native authority failed to attach');}}
                await presentation;return;
            }
            // Native scene must acknowledge this exact event. Interactive reward
            // events are never bypassed by a timer or silently auto-selected.
            await scene.play(event||{type:'hold',duration:fallbackDuration});
        },
        playBattleHealAnimation(side,amount,snapshot){return scene.play({type:'legacy-heal',side,amount,snapshot,duration:f.battleAnimationDuration(760)});},
        playBattleBuffAnimation(side,label='能力上升'){return scene.play({type:'legacy-buff',side,label,duration:f.battleAnimationDuration(760)});},
        playBattleDebuffAnimation(side,label='能力下降'){return scene.play({type:'legacy-debuff',side,label,duration:f.battleAnimationDuration(760)});},
        playBattleSwitchAnimation(side,fromName,toName){return scene.play({type:'legacy-switch',side,fromName,toName,duration:f.battleAnimationDuration(280)});},
        playBattleEscapeAnimation(success){return scene.play({type:'legacy-escape',success,duration:f.battleAnimationDuration(680)});},
        showMissionCompleteToast(mission,player=f.currentPlayer()){
            if(!mission||!f.canReceiveMissionCompleteToast(player)||api.boardLan.applying)return;
            const key=`${state.gameState?.seed||''}:${player.id}:${mission.id}`;
            if(pendingToasts.has(key))return;
            pendingToasts.add(key);
            Promise.resolve(scene.play({type:'mission-complete-toast',key,mission,isMain:!!f.mainMissionDef(mission),duration:5200})).finally(()=>pendingToasts.delete(key)).catch(error=>{
                if(typeof scene.reportError==='function')scene.reportError(error);else throw error;
            });
        },
        renderLog(){scene.log((state.gameState?.log||[]).slice().reverse().slice(0,18));},
        renderAll(){
            // Original renderers normalize data as a side effect. Preserve that
            // work at a state transition; never make GPU redraw mutate rules.
            for(const player of state.gameState?.players||[]){
                f.ensurePlayerResearchLabState(player);f.ensurePostgameResearchStarterExtractor(player);
                f.movementCap(player);
            }
            const player=f.currentPlayer();
            if(player){
                const replacementLocked=state.battleState?.needsReplacement&&String(state.battleState.playerId||'')===String(player.id||'');
                if(!replacementLocked)f.ensureActiveCrewAlive(player);
                f.teamPassiveSummary(player);f.getTeamEffects(player);
                f.canResumeBattle(player);f.isGameActionLocked();f.currentIslandServiceAction(player);
            }
            scene.map(state.gameState);f.renderLog();
            // Original renderAll refreshes these source-owned command locks.
            // CPU automation reads rollDiceBtn.disabled even with a native HUD.
            f.syncTurnActionButtons();
            f.refreshBgmForState();f.recoverAnyPendingElbaphGateSequence();
            f.scheduleRecoveredResearchStoryIfNeeded();f.schedulePendingAokijiCaptureStory();
            f.scheduleBoardLanStatePush('render');f.scheduleBoardCampaignAutoSave();
        },
        wait(milliseconds){return scene.wait(milliseconds);},
    };
};
