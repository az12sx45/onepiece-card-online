'use strict';
const {project}=require('./native-research-markup');
class NativeResearchBridge{
 constructor(bridge,html){
  this.bridge=bridge;this.view=bridge.application.get('research_modal');this.model=project(html);this.disposed=false;this.queued=false;const self=this;this.nodes=[];
  const publish=()=>{if(self.disposed||self.queued)return;self.queued=true;Promise.resolve().then(()=>{self.queued=false;if(!self.disposed)self.view.call('update_controls_json',JSON.stringify(self.model));});};
  for(const control of this.model.controls){const node={id:control.key,dataset:control.dataset,get disabled(){return control.disabled;},set disabled(value){control.disabled=!!value;publish();},addEventListener(type,fn){if(type!=='click')throw Error('Unknown original research event');bridge.listeners.set(control.key,()=>{if(!self.disposed&&!control.disabled)fn({currentTarget:node,target:node});});}};this.nodes.push(node);bridge.controls.set(node.id,node);}
  for(const node of this.nodes)bridge.bindNativeButton(node,node.id);
  this.root={classList:{contains:key=>key==='is-cultivating'&&self.model.cultivating,add(key){if(key!=='is-cultivating')throw Error('Unknown research phase');self.model.cultivating=true;publish();}},setAttribute(key,value){if(key!=='aria-busy'||value!=='true')throw Error('Unknown research attribute');}};
  this.notice={get textContent(){return self.model.notice;},set textContent(value){self.model.notice=String(value);publish();}};
  this.view.call('apply_json',JSON.stringify(this.model));
 }
 query(selector){
  if(selector[0]==='#')return this.nodes.filter(n=>n.id===selector.slice(1));
  if(selector==='button')return this.nodes;if(selector==='.research-lab-ui')return[this.root];if(selector==='.research-lab-footer-notice')return[this.notice];
  const m=selector.match(/^\[data-(research-[\w-]+)(?:=['"]([^'"]*)['"])?\]$/);if(!m)throw Error('Unsupported original research selector '+selector);const key=m[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return this.nodes.filter(n=>Object.hasOwn(n.dataset,key)&&(m[2]===undefined||n.dataset[key]===m[2]));
 }
 dispose(){this.disposed=true;}
}
exports.NativeResearchBridge=NativeResearchBridge;
