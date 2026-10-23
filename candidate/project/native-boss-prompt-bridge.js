'use strict';
const {Callable}=require('godot');
class NativeBossPromptBridge{
 constructor(stage){
  this.stage=stage;this.surface=stage.get('boss_prompt');this.disposed=false;this.queued=false;this.last='';
  this.controller=require('./native-boss-prompt-controller').create({changed:()=>this.schedule(),command:({type,payload})=>{stage.emit_signal('command_json',JSON.stringify({type,payload}));return true;}});
  this.callback=Callable.create(this.surface,(uid,type,transfer)=>{if(this.disposed)return;const result=this.controller.input(String(uid),String(type),String(transfer));this.flush();if(result.mode==='attack'&&!this.surface.call('is_visible'))stage.get('view').call('_select_mode','attack');});
  this.surface.connect('source_input',this.callback);
 }
 schedule(){if(this.disposed||this.queued)return;this.queued=true;Promise.resolve().then(()=>{this.queued=false;if(!this.disposed)this.flush();});}
 flush(){if(!this.controller||this.disposed)return;const json=JSON.stringify(this.controller.project());if(json===this.last)return;this.last=json;this.surface.call('apply_source_json',json);}
 refresh(view){this.controller.refresh(view);this.flush();}
 dispose(){if(this.disposed)return;this.disposed=true;this.surface.disconnect('source_input',this.callback);this.callback=null;this.controller.dispose();this.surface.call('apply_source_json','{"visible":false}');}
}
exports.NativeBossPromptBridge=NativeBossPromptBridge;
