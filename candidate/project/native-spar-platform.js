'use strict';
const {Callable,FileAccess}=require('godot');
exports.create=function({core,parentHost,registry,application}){
 const surface=application.get('spar_page'),scene=require('./native-spar').create({core,parentHost,registry,catalog:JSON.parse(FileAccess.get_file_as_string('res://spar-controls.json')),present:model=>surface.call('apply_json',JSON.stringify(model)),hide:()=>surface.call('close_surface')});let disposed=false;
 let command=Callable.create(surface,key=>scene.activate(String(key)).catch(error=>{console.error('Original spar action failed: '+error.message);application.get('shared_toasts').call('show_message','切磋操作尚未完成。');}));surface.connect('command_requested',command);
 return {scene,dispose(){if(disposed)return;disposed=true;surface.disconnect('command_requested',command);command=null;scene.dispose();}};
};
