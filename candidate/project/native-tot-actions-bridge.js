'use strict';
const {Callable}=require('godot');
class NativeTotActionsBridge{
 constructor(stage,options={}){this.stage=stage;this.surface=stage.get('tot_actions');this.disposed=false;this.queued=false;this.last='';
  this.controller=require('./native-tot-actions-controller').create({changed:()=>this.schedule(),command:({type,payload})=>{stage.emit_signal('command_json',JSON.stringify({type,payload}));return true;},...options});
  this.input=Callable.create(this.surface,uid=>{this.controller.input(String(uid));this.flush();});this.answer=Callable.create(this.surface,accepted=>{this.controller.answer(accepted);this.flush();});
  this.surface.connect('source_input',this.input);this.surface.connect('confirmation_answer',this.answer);
 }
 schedule(){if(this.disposed||this.queued)return;this.queued=true;Promise.resolve().then(()=>{this.queued=false;if(!this.disposed)this.flush();});}
 flush(){if(this.disposed)return;const json=JSON.stringify(this.controller.project());if(json!==this.last){this.last=json;this.surface.call('apply_source_json',json);}this.surface.call('_hide_standard_controls');this.stage.get('tot_stage').call('sync_controls_visibility');}
 refresh(view){this.controller.refresh(view);this.flush();}
 presentation(active){this.controller.presentation(active);this.flush();}
 dispose(){if(this.disposed)return;this.disposed=true;this.surface.disconnect('source_input',this.input);this.surface.disconnect('confirmation_answer',this.answer);this.input=null;this.answer=null;this.controller.dispose();this.surface.call('apply_source_json','{"visible":false}');}
}
exports.NativeTotActionsBridge=NativeTotActionsBridge;
