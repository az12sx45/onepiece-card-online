'use strict';
const {parse}=require('./native-research-markup');
class NativeEncounterBridge{
 constructor(bridge,html){
  this.bridge=bridge;this.view=bridge.application.get('encounter_modal');this.disposed=false;this.queued=false;
  const root=parse(html),all=(n,s)=>{const result=[];function walk(n){for(const c of n?.children||[])if(typeof c!=='string'){if(s[0]==='.'?(c.attrs.class||'').split(/\s+/).includes(s.slice(1)):c.tag===s)result.push(c);walk(c);}}walk(n);return result;},one=(n,s)=>all(n,s)[0],raw=n=>!n?'':typeof n==='string'?n:(n.children||[]).map(raw).join(''),text=n=>raw(n).replace(/\s+/g,' ').trim(),value=(n,s)=>text(one(n,s));
  const blocks=n=>{const result=[];function walk(n){for(const c of n?.children||[])if(typeof c!=='string'){if(c.tag==='strong'||c.tag==='p')result.push(text(c));else walk(c);}}walk(n);return result.join('\n\n');};
  const panel=one(root,'.encounter-ui');if(!panel)throw Error('Original encounter root missing');
  const heading=one(panel,'.encounter-heading'),caption=one(panel,'.encounter-portrait-caption'),context=one(panel,'.encounter-context'),detail=one(panel,'.encounter-detail'),portrait=one(one(panel,'.encounter-portrait-stage'),'img'),reward=one(detail,'.encounter-drop-button'),effect=one(detail,'.encounter-drop-effect');
  this.model={kind:'encounter',sourceText:text(root),title:value(heading,'h3'),eyebrow:value(heading,'p'),portrait:portrait?.attrs.src||'',fallback:portrait?.attrs['data-fallback-src']||'',name:value(caption,'strong'),meta:value(caption,'span'),context:value(context,'strong'),contextDetail:value(context,'span'),stats:all(panel,'.encounter-stat').map(n=>({label:value(n,'span'),value:value(n,'strong')})),message:blocks(one(panel,'.encounter-message')),detailLabel:reward?'':value(detail,'strong'),detailText:reward?text(effect):value(detail,'span'),reward:reward?{key:reward.attrs.id,image:one(reward,'img')?.attrs.src||'',name:value(reward,'strong'),rate:value(reward,'small'),expanded:false}:null,actions:all(one(panel,'.encounter-actions'),'button').map(n=>({key:n.attrs.id,label:value(n,'span'),disabled:Object.hasOwn(n.attrs,'disabled'),secondary:(n.attrs.class||'').split(/\s+/).includes('secondary')}))};
  const publish=()=>{if(this.disposed||this.queued)return;this.queued=true;Promise.resolve().then(()=>{this.queued=false;if(!this.disposed)this.view.call('update_detail_json',JSON.stringify(this.model));});};
  this.nodes=[];
  for(const button of all(panel,'button')){
   const key=button.attrs.id;if(!key)throw Error('Encounter action without original id');const attrs={...button.attrs},classes=new Set((attrs.class||'').split(/\s+/));let disabled=Object.hasOwn(attrs,'disabled');
   const node={id:key,dataset:{},get disabled(){return disabled;},set disabled(v){disabled=!!v;},textContent:text(button),getAttribute:name=>attrs[name]??null,setAttribute:(name,value)=>{if(name!=='aria-expanded')throw Error('Unsupported encounter attribute '+name);attrs[name]=String(value);this.model.reward.expanded=value==='true';publish();},classList:{toggle:(key,force)=>{if(force===undefined)force=!classes.has(key);if(force)classes.add(key);else classes.delete(key);return !!force;}},addEventListener:(type,fn)=>{if(type!=='click')throw Error('Unsupported encounter event '+type);bridge.listeners.set(key,()=>{if(!this.disposed&&!disabled)fn({target:node,currentTarget:node});});}};
   bridge.bindNativeButton(node,key);this.nodes.push(node);bridge.controls.set(key,node);
  }
  if(effect){const node={id:effect.attrs.id};Object.defineProperty(node,'textContent',{get:()=>this.model.detailText,set:value=>{this.model.detailText=String(value);publish();}});bridge.controls.set(node.id,node);}
  this.view.call('apply_json',JSON.stringify(this.model));
 }
 query(selector){if(selector==='button')return this.nodes;if(selector[0]==='#')return this.nodes.filter(n=>n.id===selector.slice(1));throw Error('Unsupported original encounter selector '+selector);}
 dispose(){this.disposed=true;}
}
exports.NativeEncounterBridge=NativeEncounterBridge;

