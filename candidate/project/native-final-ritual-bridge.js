'use strict';
const {parse}=require('./native-research-markup');
class NativeFinalRitualBridge{
 constructor(bridge,html){
  this.bridge=bridge;this.view=bridge.application.get('final_ritual_modal');this.disposed=false;this.nodes=new Map();this.skips=[];
  const raw=n=>!n?'':typeof n==='string'?n:(n.children||[]).map(raw).join(''),text=n=>raw(n).replace(/\s+/g,' ').trim();this.text=text;
  this.model={kind:'final-ritual',sourceText:text(parse(html)),ritual:html.includes('finalActivationRitualScene'),reading:false,placing:false,complete:false,narration:true,narrationLine:'',speaker:'',line:'',portrait:'',slots:[],skipKey:''};
  const node=(id,classes='')=>{const set=new Set(classes.split(/\s+/).filter(Boolean)),item={id,dataset:{},offsetWidth:1,remove:()=>{this.nodes.delete(id);bridge.controls.delete(id);if(id==='finalRitualNarration'){this.model.narration=false;this.publish();}},insertAdjacentHTML:(position,markup)=>{if(id!=='finalActivationRitualScene'||position!=='beforeend')throw Error('Unknown original ritual insertion');this.parse(markup);this.publish();}};
   item.classList={contains:key=>set.has(key),remove:(...keys)=>{keys.forEach(k=>set.delete(k));},add:(...keys)=>{keys.forEach(k=>set.add(k));for(const key of keys){if(id==='finalActivationRitualScene'&&key==='is-placing')this.model.placing=true;if(id==='finalActivationRitualScene'&&key==='is-complete')this.model.complete=true;if(id==='finalRitualNarration'&&key==='is-fading')this.model.narration=false;if(key==='is-shifting')this.view.call('shift_line');}this.publish();}};
   Object.defineProperty(item,'textContent',{get:()=>id==='finalRobinLine'?this.model.line:this.model.narrationLine,set:value=>{if(id==='finalRobinLine')this.model.line=String(value);else if(id==='finalRitualNarrationLine')this.model.narrationLine=String(value);else throw Error('Unknown ritual text target '+id);this.publish();}});
   this.nodes.set(id,item);bridge.controls.set(id,item);return item;};this.makeNode=node;
  this.parse(html);this.view.call('apply_json',JSON.stringify(this.model));
 }
 parse(html){
  const root=parse(html);const walk=n=>{if(typeof n==='string')return;const c=(n.attrs?.class||'').split(/\s+/),id=n.attrs?.id;
   if(id)this.makeNode(id,n.attrs.class||'');
   if(c.includes('final-ritual-slot')){const image=n.children.find(x=>typeof x!=='string'&&x.tag==='img');this.model.slots.push({direction:c.find(x=>['north','east','south','west'].includes(x)),image:image?.attrs.src||'',delay:Number(/--slot-delay:\s*(\d+)ms/.exec(n.attrs.style)?.[1]||0)});}
   if(c.includes('final-robin-reading')){this.model.reading=true;this.model.speaker='妮可·羅賓';}
   if(c.includes('final-robin-portrait')){const image=n.children.find(x=>typeof x!=='string'&&x.tag==='img');this.model.portrait=image?.attrs.src||'';}
   if(id==='finalRobinLine')this.model.line=this.text(n);if(id==='finalRitualNarrationLine')this.model.narrationLine=this.text(n);
   if(n.tag==='button'&&Object.hasOwn(n.attrs,'data-final-story-skip')){const key='final-ritual-skip-'+this.skips.length,node={id:key};Object.defineProperty(node,'onclick',{set:fn=>this.bridge.listeners.set(key,()=>{if(!this.disposed)fn({stopPropagation(){}});})});this.skips.push(node);this.bridge.controls.set(key,node);this.model.skipKey=key;}
   for(const child of n.children||[])walk(child);
  };walk(root);
 }
 publish(){if(!this.disposed)this.view.call('apply_json',JSON.stringify(this.model));}
 query(selector){if(selector==='[data-final-story-skip]')return this.skips;if(selector[0]==='#')return this.nodes.has(selector.slice(1))?[this.nodes.get(selector.slice(1))]:[];throw Error('Unknown ritual selector '+selector);}
 dispose(){this.disposed=true;}
}
exports.NativeFinalRitualBridge=NativeFinalRitualBridge;
