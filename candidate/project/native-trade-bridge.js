'use strict';
const {parse}=require('./native-research-markup'),itemIcon=require('./native-backpack-bridge').icon;
const raw=n=>n==null?'':typeof n==='string'?n:(n.children||[]).map(raw).join(''),text=n=>raw(n).replace(/\s+/g,' ').trim();
const matches=(n,s)=>{if(!n||typeof n==='string')return false;if(s[0]==='.')return (n.attrs.class||'').split(/\s+/).includes(s.slice(1));if(s[0]==='#')return n.attrs.id===s.slice(1);const a=s.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);return a?Object.hasOwn(n.attrs,a[1])&&(a[2]===undefined||n.attrs[a[1]]===a[2]):n.tag===s;};
const all=(n,s)=>{const out=[];function walk(n){for(const c of n?.children||[])if(typeof c!=='string'){if(matches(c,s))out.push(c);walk(c);}}walk(n);return out;},one=(n,s)=>all(n,s)[0],value=(n,s)=>text(one(n,s));
const escaped=s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const markup=n=>typeof n==='string'?escaped(n):'<'+n.tag+Object.entries(n.attrs).map(([k,v])=>' '+k+'="'+escaped(v)+'"').join('')+'>'+n.children.map(markup).join('')+(['img','br','input'].includes(n.tag)?'':'</'+n.tag+'>');
class NativeTradeBridge{
 constructor(bridge,html,helpers){
  this.bridge=bridge;this.disposed=false;this.nodes=[];this.handlers=new Map();const root=this.root=parse(html);
  const walk=n=>{for(const c of n.children||[])if(typeof c!=='string'){if(['button','input'].includes(c.tag)||Object.hasOwn(c.attrs,'data-close-trade-popover'))this.nodes.push(c);walk(c);}};walk(root);
  this.controls=this.nodes.map((node,i)=>{
   const key=node.attrs.id||'trade:'+i,descriptor={key,tag:node.tag,label:text(node),disabled:Object.hasOwn(node.attrs,'disabled'),value:node.tag==='input'?node.attrs.value||'':null,attrs:{...node.attrs}};
   const control={id:key,dataset:Object.fromEntries(Object.entries(node.attrs).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v])),value:descriptor.value,disabled:descriptor.disabled,textContent:descriptor.label,addEventListener:(type,fn)=>{if(!['click','change'].includes(type))throw Error('Unbound original trade event '+type);this.handlers.set(key+':'+type,fn);},click:()=>this.activate(key)};
   bridge.controls.set(key,control);return descriptor;
  });
  const control=n=>n?this.controls[this.nodes.indexOf(n)]:null,keys=(n,s='button')=>all(n,s).map(control).filter(Boolean).map(c=>c.key),image=n=>one(n,'img')?.attrs.src?.split('?')[0]||'',icon=n=>itemIcon(markup(n),helpers.decode);
  const picker=one(root,'.maple-trade-picker'),detail=one(root,'.maple-trade-detail'),shell=one(root,'.maple-trade-shell');
  const model=this.model={kind:'trade',page:picker?'picker':detail?'detail':shell?'main':'prompt',controls:this.controls,title:value(root,shell?'.maple-trade-title':'h3'),location:value(root,'.maple-trade-location'),log:all(root,'.maple-chat-line').map(text),panels:[],actions:[],sourceText:text(root)};
  model.panels=all(root,'.maple-bilateral-panel').map(n=>{const head=one(n,'.maple-bilateral-head'),input=control(one(n,'input'));return {name:value(head,'strong'),avatar:image(head),status:all(head,'span').map(text).join('\n'),slots:all(n,'.maple-offer-slot').map(b=>({key:control(b).key,title:b.attrs.title||b.attrs['aria-label']||'',count:value(b,'small'),icon:icon(b)})),coins:{...input,label:value(n,'.maple-payment-line')},value:value(n,'.maple-trade-value'),confirm:keys(n,'[data-confirm-active-trade]')};});
  if(picker){model.title=value(picker,'.maple-picker-title');model.subtitle=value(picker,'.maple-picker-sub');model.empty=value(picker,'.maple-picker-empty');model.entries=all(picker,'.maple-picker-item').map(n=>({key:control(n).key,name:value(n,'strong'),description:value(n,'small'),icon:icon(n)}));model.actions=keys(picker,'.maple-popover-close');}
  else if(detail){const head=one(detail,'.maple-detail-head');model.title=value(head,'strong');model.subtitle=value(head,'span');model.icon=icon(head);model.description=raw(one(detail,'.maple-detail-body')).trim();model.price=value(detail,'.maple-detail-price');model.actions=keys(detail);}
  else if(shell){model.actions=keys(root,'.maple-trade-footer');model.actions=[control(one(root,'#cancelActiveTradeBtn')).key];}
  else{model.subtitle=value(root,'.trade-prompt-copy');model.description=value(root,'.trade-prompt-reason');model.actions=keys(root);}
  setTimeout(()=>{if(!this.disposed)bridge.application.call('show_trade_modal',JSON.stringify(model));},0);
 }
 query(selector){return this.nodes.filter(n=>matches(n,selector)).map(n=>this.bridge.controls.get(this.controls[this.nodes.indexOf(n)].key));}
 snapshot(){return {text:text(this.root),controls:this.controls.map(c=>({...c,value:c.tag==='input'?this.bridge.controls.get(c.key).value:null}))};}
 activate(key,type='click',value){
  if(this.disposed)return false;const control=this.bridge.controls.get(key);if(!control||control.disabled)return false;
  const fn=this.handlers.get(key+':'+type);if(!fn)return false;if(type==='change')control.value=String(value);fn();return true;
 }
 handle(key){
  if(key.startsWith('trade-value:')){const p=JSON.parse(key.slice(12));this.activate(p.key,'change',p.value);return true;}
  if(this.controls.some(c=>c.key===key)){this.activate(key);return true;}return false;
 }
 dispose(){this.disposed=true;this.handlers.clear();}
}
exports.NativeTradeBridge=NativeTradeBridge;
