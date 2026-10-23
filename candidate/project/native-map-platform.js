'use strict';
const menus=require('./native-ship-menu');
const cpuMenus=require('./native-cpu-ship-menu');
// The scene owns visibility; these boundaries preserve original menu-open
// mission events and invoke the original delegated handler statements.
exports.create=function(api,scene){
    for(const method of ['openHelm','closeHelm','canShowCommands'])if(typeof scene[method]!=='function')throw Error('Native map scene missing '+method);
    let playerId=null,cpuPlayerId=null,automaticMenu=false;
    const f=api.functions;
    function showPlayerMenu(player,automatic=false){
        bindings.closeShipActionMenu();
        const menu=menus.project(api,player);if(!menu)return;
        playerId=String(player.id);automaticMenu=automatic;scene.openHelm(menu);
    }
    const bindings={
        autoCenterOnCurrentPlayer(){const target=api.presentation.autoCenterTarget();if(target)scene.centerOn(target.x,target.y);},
        showBoardUiHud(title='行動同步',subtitle='',options={}){
            const theme=String(options.theme||'event').replace(/[^\w-]/g,'')||'event';
            scene.showNotice({title:title||'行動同步',subtitle:subtitle||'',icon:f.boardActionHudIconUrl(theme,options.symbol),theme,eventId:String(options.eventId||''),duration:Math.max(900,Number(options.duration||1700))});
        },
        shipSailingPosition(id){return scene.sailingPosition(String(id||''));},
        startShipSailingMotion(player,from,to,duration){
            const motion=api.presentation.startSailing(player,from,to,duration,{now:()=>scene.now()});
            if(motion)scene.startSailing(motion);
        },
        stopShipSailingMotion(id){api.presentation.stopSailing(id);scene.stopSailing(String(id||''));},
        resetShipSailingMotions(){api.presentation.resetSailing();scene.resetSailing();},
        setMapMovementStable(active){scene.setMoving(!!active);},
        renderMovementFrame(){
            for(const player of api.state.gameState.players){f.activeCrew(player);f.movementCap(player);}
            const player=f.currentPlayer();
            const replacementLocked=api.state.battleState?.needsReplacement&&String(api.state.battleState.playerId||'')===String(player?.id||'');
            if(!replacementLocked)f.ensureActiveCrewAlive(player);
            f.activeCrew(player);f.teamPassiveSummary(player);f.movementCap(player);f.getTeamEffects(player);
            f.renderLog();if(!scene.refreshShips?.(api.presentation.shipProjection()))scene.refresh(api.presentation.mapProjection());
        },
        animateDice(theme,title,subtitle,maxFace=6,options={}){
            return scene.playDice(api.presentation.boardDice(theme,title,subtitle,maxFace,options));
        },
        cancelDiceAnimation(remoteId=''){scene.cancelDice(remoteId);},
        hideDiceHud(){scene.hideDice();},
        openShipActionMenu(player){
            if(f.canOpenCpuShipControlFor(player)){
                bindings.closeShipActionMenu();f.ensureGameSettings();cpuPlayerId=String(player.id);scene.openCpuShip(cpuMenus.project(api,player));return;
            }
            if(!f.canOpenShipActionsFor(player))return;
            f.recordMainMissionEvent(player,{type:'captain_command_open'});
            showPlayerMenu(player);
        },
        closeShipActionMenu(){playerId=null;cpuPlayerId=null;automaticMenu=false;scene.closeHelm();scene.closeCpuShip?.();},
    };
    function command(action,id){
        if(playerId===null||String(id)!==playerId)return false;
        const player=api.state.gameState.players.find(p=>String(p.id)===playerId);
        const menu=player&&menus.project(api,player);
        if(!menu?.entries.some(entry=>entry.action===action&&entry.enabled))return false;
        // Restoring the always-visible phone helm is presentation only. Count
        // its original menu-open event on actual input, never on a snapshot or
        // reconnect render, which must not silently mutate received state.
        if(automaticMenu){automaticMenu=false;f.recordMainMissionEvent(player,{type:'captain_command_open'});}
        const original=api.presentation.shipMenu(player);
        api.presentation.dispatchShipAction(action,player,original.sparPartners);
        return true;
    }
    function sync(){
        if(cpuPlayerId!==null){const cpu=api.state.gameState.players.find(p=>String(p.id)===cpuPlayerId);if(cpu&&f.canOpenCpuShipControlFor(cpu)){scene.openCpuShip(cpuMenus.project(api,cpu));return;}bindings.closeShipActionMenu();}
        const game=api.state.gameState,player=game&&f.currentPlayer();
        const blocked=!player||f.isCpuPlayer(player)||!f.canOpenShipActionsFor(player)
            ||game.battleExitLock||api.state.seaTrainAnimation||api.state.kumaPawAnimation
            ||player.pendingIslandServiceChoice?.requiredEntry===true||api.presentation.mapPresentationLocked()
            ||api.boardLan.pendingRemoteBattleViews.length>0||!scene.canShowCommands();
        if(blocked){if(playerId!==null)bindings.closeShipActionMenu();return;}
        if(playerId!==String(player.id))showPlayerMenu(player,true);
        else scene.openHelm(menus.project(api,player));
    }
    function mapCommand(type,payload){
        if(type==='inspect-island'){const island=f.getIslandById(payload.islandId);if(!island)return false;f.inspectIsland(island);return true;}
        if(type==='inspect-sea'){const tile=api.state.gameState.boardData?.seaTiles?.find(t=>t.id===payload.tileId);if(!tile)return false;f.inspectSeaTile(tile);return true;}
        if(type==='cpu-ship-close'){bindings.closeShipActionMenu();sync();return true;}
        if(type==='cpu-ship-change'||type==='cpu-ship-action'){
            if(cpuPlayerId===null||String(payload.playerId)!==cpuPlayerId)return false;
            const player=api.state.gameState.players.find(p=>String(p.id)===cpuPlayerId);if(!player)return false;
            const result=type==='cpu-ship-change'?cpuMenus.change(api,player,payload.key,payload.value):cpuMenus.activate(api,player,payload.key);
            if(result&&type==='cpu-ship-change')scene.openCpuShip(cpuMenus.project(api,player));return result;
        }
        if(type==='choose-route'){
            if(!api.state.gameState.routePrompt?.routeIds.includes(payload.routeId))return false;
            f.chooseRouteFromMap(payload.routeId);return true;
        }
        if(type==='ship-actions'){
            const player=api.state.gameState.players.find(p=>String(p.id)===String(payload.playerId));
            if(!player||(!f.canOpenCpuShipControlFor(player)&&!f.canOpenShipActionsFor(player)))return false;bindings.openShipActionMenu(player);return true;
        }
        throw Error('Native map command not implemented: '+type);
    }
    return {bindings,command,mapCommand,sync,isOpen:()=>playerId!==null||cpuPlayerId!==null};
};
