'use strict';
// Read-only presentation projection. Rules and visibility decisions remain in
// the original source helpers. No event handler/HTML is executed here.
function decode(value){return String(value||'').replace(/&quot;/g,'"').replace(/&#39;|&#x27;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');}
function artwork(markup){
    const images=[];
    for(const match of String(markup).matchAll(/<img\b([^>]*)>/g)){
        const attributes={};for(const a of match[1].matchAll(/([\w-]+)="([^"]*)"/g))attributes[a[1]]=decode(a[2]);
        if(attributes.src)images.push({source:attributes.src,fallback:attributes['data-fallback-src']||'',alt:attributes.alt||'',classes:attributes.class||''});
    }
    return {images,elbaph:String(markup).includes('elbaph-island-visual'),generic:String(markup).includes('island-generic-mark')};
}
exports.project=function(api,environment){
    const f=api.functions,game=api.state.gameState,c=api.constants;
    if(!game?.boardData)throw Error('Native map requires original generated boardData');
    const template=game.boardData.mapTemplate,viewer=f.mapViewerPlayer();
    const routeChoices=f.buildRouteChoiceTileMap(game.routePrompt),scout=f.getScoutEncounterTileIds(viewer);
    const decorations=Object.values(c.ACTIVE_MAP_LAYOUT.decorations||{}).filter(d=>d.asset).map(d=>({source:d.asset,x:d.x,y:d.y,size:d.size||64,rotation:d.rotation||0}));
    const edges=f.connections().map(({a,b,routeId,routeSegmentIndex,postgameRoute,postgameOrder})=>({a:{x:a.x,y:a.y},b:{x:b.x,y:b.y},routeId,routeSegmentIndex,postgameRoute:!!postgameRoute,postgameOrder}));
    const tiles=[];
    for(const tile of game.boardData.seaTiles){
        const route=f.getRouteById(tile.routeId);if(f.shouldHideRouteOnMap(route))continue;
        const claimedBy=route?.meta?.uniqueBranch?game.claimedBranchRoutes?.[route.meta.branchId]:null;
        tiles.push({id:tile.id,routeId:tile.routeId,...f.nodeToPx(tile),routeChoiceId:routeChoices.get(tile.id)||'',scout:scout.has(tile.id),claimed:claimedBy?(claimedBy===viewer?.id?'me':'other'):'',postgame:!!route?.meta?.postgameRoute,index:tile.index});
    }
    const islands=[];
    for(const island of game.boardData.islands){
        if(f.shouldHideFinalIslandOnMap(island))continue;
        const islandState=f.getIslandState(island.id),visible=f.getVisibleIslandView(viewer,island);
        const art=artwork(f.islandHtml(island,islandState,visible,viewer));
        islands.push({id:island.id,...f.nodeToPx(island),kind:visible.displayKind||f.getEffectiveIslandKind(island,islandState),name:visible.displayName,hidden:!!visible.hidden,locked:island.kind==='final'&&!game.finalIslandUnlocked,postgame:f.isPostgameIsland(island),postgameOrder:island.postgameOrder||0,...art});
    }
    f.normalizeMapMarkers();
    const markers=game.mapMarkers.map(marker=>({...marker,colorIndex:f.markerColorIndex(marker.playerId)%4}));
    const ships=projectShips(api,environment);
    return {width:template.widthPx||(c.BOARD_OFFSET_X*2+template.cols*c.TILE_SIZE),height:template.heightPx||(c.BOARD_OFFSET_Y*2+template.rows*c.TILE_SIZE),decorations,edges,tiles,islands,markers,ships,routePrompt:game.routePrompt||null};
};

function projectShips(api,environment){
    const f=api.functions,game=api.state.gameState;
    return game.players.map((player,index)=>{
        const visual=f.remoteMovementVisualPlayer(player),current=index===game.currentPlayerIndex;
        const canAct=current&&f.canOpenShipActionsFor(player),cpu=f.canOpenCpuShipControlFor(player),learn=f.canOpenMoveLearnPanelFor(player);
        const skin=f.shipSkinForPlayer(player,index);
        return {id:String(player.id),...f.shipDisplayPositionPx(visual),name:player.name,current,canAct,canControlCpu:cpu,canLearn:learn,hasMoveNotice:f.shouldShowMoveLearnBadgeFor(player),inBattle:f.isPlayerInBattleOnMap(player),hidden:api.state.seaTrainAnimation?.playerId===player.id||api.state.kumaPawAnimation?.playerId===player.id||player.pendingPostgameBossVoyage?.phase==='arriving',sailing:environment.sailing.includes(String(player.id)),rotation:f.shipRotationForPlayer(visual),flip:f.shipFlipForPlayer(visual),angle:f.shipTravelAngleForPlayer(visual),source:skin?.image||'',colorIndex:index%4,badges:artwork(f.shipBattleStatusIconHtml(player)+f.shipMoveLearnBadgeHtml(player))};
    });
}
exports.projectShips=projectShips;
