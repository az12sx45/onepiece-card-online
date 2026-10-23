'use strict';
const {Callable,Time}=require('godot');
class NativeMapScene{
    constructor(application){
        this.application=application;this.sequence=0;this.pending=new Map();
        this.callback=Callable.create(application,(id,result,error)=>{
            const entry=this.pending.get(id);if(!entry)return;this.pending.delete(id);
            if(error)entry.reject(Error(error));else entry.resolve(result);
        });
        application.connect('board_dice_finished',this.callback);
    }
    openHelm(menu){this.application.call('open_helm_json',JSON.stringify(menu));this.camera?.requestInitial();}
    closeHelm(){this.application.call('close_helm');}
    openCpuShip(menu){this.application.get('cpu_ship_menu').call('apply_json',JSON.stringify(menu));}
    closeCpuShip(){this.application.get('cpu_ship_menu').call('close_surface');}
    canShowCommands(){return !this.overlayBlocked?.()&&this.application.call('can_show_commands');}
    now(){return Time.get_ticks_msec();}
    sailingPosition(id){return JSON.parse(this.application.get('map_view').call('sailing_position_json',id));}
    startSailing(motion){this.application.get('map_view').call('start_sailing_json',JSON.stringify(motion));}
    stopSailing(id){this.application.get('map_view').call('stop_sailing',id);}
    resetSailing(){this.application.get('map_view').call('reset_sailing');}
    setMoving(active){this.application.get('map_view').set('movement_active',active);}
    refresh(model){this.application.call('apply_map_json',JSON.stringify(model));}
    refreshShips(ships){return this.application.get('map_view').call('apply_ships_json',JSON.stringify(ships));}
    centerOn(x,y){this.application.get('map_view').call('center_on_point',x,y);}
    showNotice(model){this.application.call('show_board_notice',JSON.stringify(model));}
    playDice(model){
        const id='board-dice-'+(++this.sequence);
        const promise=new Promise((resolve,reject)=>this.pending.set(id,{resolve,reject}));
        this.application.call('play_board_dice',id,JSON.stringify(model));
        return promise;
    }
    cancelDice(remoteId=''){this.application.call('cancel_board_dice',String(remoteId));}
    hideDice(){this.application.call('hide_board_dice');}
    dispose(){this.camera?.dispose();if(this.pending.size)throw Error('Native board scene disposed with pending dice');this.application.disconnect('board_dice_finished',this.callback);this.callback=null;}
}
exports.NativeMapScene=NativeMapScene;
