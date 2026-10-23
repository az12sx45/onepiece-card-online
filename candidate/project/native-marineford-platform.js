'use strict';
const {Callable,FileAccess,Time}=require('godot');
exports.create=function({core,parentHost,registry,application}){
 const surface=application.get('marineford_page'),media=require('./native-marineford-video').create(application.get('marineford_video'));let disposed=false;
 const warm=async paths=>{const json=JSON.stringify(paths),deadline=Time.get_ticks_msec()+20000;while(!surface.call('warm_images_json',json)){if(disposed)throw Error('Marineford preload cancelled');if(Time.get_ticks_msec()>deadline)throw Error('Original Marineford media unavailable');await new Promise(r=>setTimeout(r,16));}return true;};
 const scene=require('./native-marineford').create({core,parentHost,registry,catalog:JSON.parse(FileAccess.get_file_as_string('res://marineford-controls.json')),
  present:model=>surface.call('apply_json',JSON.stringify(model)),hide:()=>surface.call('close_surface'),warmImages:warm,preloadImage:path=>warm([String(path).split('?')[0]]),video:node=>media.bind(node),syncMedia:document=>media.sync(document),
  geometry(node){const kind=['marineford','slot-img','slot','lottery-token','lottery-track','lottery-lane'].find(k=>node.classList.contains(k));if(!kind)throw Error('Unbound Marineford source geometry '+node.className);const lane=node.closest('.lottery-reel')?.querySelector('.lottery-lane');return JSON.parse(surface.call('geometry_json',kind,Number(lane?.dataset.lotteryLane||0)));}
 });
 let command=Callable.create(surface,uid=>{scene.activate(String(uid)).catch(error=>{console.error('Original Marineford action failed: '+error.message);application.get('shared_toasts').call('show_message','頂上戰爭操作未完成，請保留目前存檔。');});}),resize=Callable.create(surface,()=>scene.resize());
 surface.connect('command_requested',command);surface.connect('resized',resize);
 return {scene,media,dispose(){if(disposed)return;disposed=true;surface.disconnect('command_requested',command);surface.disconnect('resized',resize);command=null;resize=null;scene.dispose();media.dispose();}};
};
