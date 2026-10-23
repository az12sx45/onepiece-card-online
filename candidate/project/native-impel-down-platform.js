'use strict';
const {Callable,FileAccess}=require('godot');
exports.create=function({core,parentHost,registry,application}){
 const surface=application.get('impel_down_page');let disposed=false;
 const scene=require('./native-impel-down').create({core,parentHost,registry,catalog:JSON.parse(FileAccess.get_file_as_string('res://impel-down-controls.json')),present:model=>surface.call('apply_json',JSON.stringify(model)),hide:()=>surface.call('close_surface')});
 let command=Callable.create(surface,key=>scene.activate(String(key)).catch(error=>{console.error('Original Impel Down action failed: '+error.message);application.get('shared_toasts').call('show_message','推進城操作未完成，請保留目前存檔。');}));surface.connect('command_requested',command);
 return {scene,dispose(){if(disposed)return;disposed=true;surface.disconnect('command_requested',command);command=null;scene.dispose();}};
};
