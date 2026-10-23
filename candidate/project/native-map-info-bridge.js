'use strict';
const {parse}=require('./native-research-markup');
class NativeMapInfoBridge{
 constructor(bridge,html){
  this.disposed=false;const root=parse(html),all=(n,s)=>{const out=[];function walk(n){for(const c of n?.children||[])if(typeof c!=='string'){if(s[0]==='.'?(c.attrs.class||'').split(/\s+/).includes(s.slice(1)):c.tag===s)out.push(c);walk(c);}}walk(n);return out;},one=(n,s)=>all(n,s)[0],raw=n=>!n?'':typeof n==='string'?n:(n.children||[]).map(raw).join(''),text=n=>raw(n).replace(/\s+/g,' ').trim(),value=(n,s)=>text(one(n,s));
  const panel=one(root,'.map-node-info-ui');if(!panel)throw Error('Original map information missing');const visual=one(panel,'.map-node-visual'),image=one(visual,'img'),caption=one(panel,'.map-node-caption'),description=one(panel,'.map-node-description');
  this.model={kind:'map-info',imageMode:(visual.attrs.class||'').includes('portrait')?'portrait':'landscape',sourceText:text(root),title:value(panel,'h3'),eyebrow:'',portrait:image.attrs.src.split('?')[0],fallback:image.attrs['data-fallback-src']?.split('?')[0]||'',name:value(caption,'strong'),meta:value(caption,'span'),context:value(panel,'.map-node-summary'),contextDetail:'',stats:all(panel,'.map-node-stat').map(n=>({label:value(n,'span'),value:value(n,'strong')})),message:value(description,'strong')+'\n'+value(description,'p'),detailLabel:'',detailText:value(panel,'.map-node-route'),reward:null,actions:all(one(panel,'.map-node-actions'),'button').map(n=>({key:n.attrs.id,label:text(n),disabled:Object.hasOwn(n.attrs,'disabled'),secondary:(n.attrs.class||'').includes('secondary')}))};
  this.nodes=all(panel,'button').map(n=>{const key=n.attrs.id,node={id:key,dataset:n.attrs['data-map-marker-action']?{mapMarkerAction:n.attrs['data-map-marker-action']}:{},textContent:text(n),disabled:Object.hasOwn(n.attrs,'disabled'),getAttribute:k=>n.attrs[k]??null,addEventListener:(type,fn)=>{if(type!=='click')throw Error('Unbound map info event '+type);bridge.listeners.set(key,()=>{if(!this.disposed&&!node.disabled)fn({target:node,currentTarget:node});});}};bridge.controls.set(key,node);return node;});
  bridge.application.get('map_info_modal').call('apply_json',JSON.stringify(this.model));
 }
 query(selector){if(selector==='button')return this.nodes;if(selector[0]==='#')return this.nodes.filter(n=>n.id===selector.slice(1));throw Error('Unbound map information selector '+selector);}
 dispose(){this.disposed=true;}
}
exports.NativeMapInfoBridge=NativeMapInfoBridge;
