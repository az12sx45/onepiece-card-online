'use strict';
// A bounded data tree, never an HTML/CSS renderer. Original handlers own all
// state, gestures and authority; the native surface consumes project().
const decode=s=>String(s).replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const dataKey=s=>s.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
exports.create=function({height=()=>132,capture=()=>{},release=()=>{}}={}){
 const listeners=new Map(),allowed=new Set(['div','span','img','button','figure','figcaption','b','strong']);
 class Element{
  constructor(tag){this.tag=tag;this.children=[];this.parentElement=null;this.attributes={};this.dataset={};this.style={};this._text='';this._classes=new Set();this.disabled=false;this.hidden=false;this.capture=null;
   this.classList={add:(...v)=>v.forEach(k=>this._classes.add(k)),remove:(...v)=>v.forEach(k=>this._classes.delete(k)),contains:k=>this._classes.has(k),toggle:(k,on)=>{on=on===undefined?!this._classes.has(k):!!on;if(on)this._classes.add(k);else this._classes.delete(k);return on;}};
  }
  get className(){return [...this._classes].join(' ');}set className(v){this._classes=new Set(String(v).split(/\s+/).filter(Boolean));}
  get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}set textContent(v){this.replaceChildren();this._text=String(v??'');}
  get childNodes(){return this.children;}
  get clientHeight(){return this.classList.contains('raid-wheel-shell')?height():0;}
  setAttribute(k,v){v=String(v);this.attributes[k]=v;if(k==='class')this.className=v;else if(k==='id')this.id=v;else if(k.startsWith('data-'))this.dataset[dataKey(k.slice(5))]=v;else if(k==='src'||k==='alt')this[k]=v;}
  removeAttribute(k){delete this.attributes[k];if(k.startsWith('data-'))delete this.dataset[dataKey(k.slice(5))];}
  remove(){if(!this.parentElement)return;const p=this.parentElement;p.children.splice(p.children.indexOf(this),1);this.parentElement=null;}
  append(...nodes){for(const node of nodes){if(node.tag==='#fragment'){this.append(...node.children.slice());continue;}node.remove();node.parentElement=this;this.children.push(node);}}
  prepend(...nodes){for(const node of nodes.slice().reverse()){node.remove();node.parentElement=this;this.children.unshift(node);}}
  before(...nodes){const parent=this.parentElement;if(!parent)throw Error('Detached Judicial control insertion');for(const node of nodes){node.remove();node.parentElement=parent;parent.children.splice(parent.children.indexOf(this),0,node);}}
  replaceChildren(...nodes){for(const child of this.children)child.parentElement=null;this.children=[];this._text='';this.append(...nodes);}
  matches(selector){if(selector.startsWith('.'))return this.classList.contains(selector.slice(1));if(selector.startsWith('#'))return this.id===selector.slice(1);const m=selector.match(/^\[([\w-]+)\]$/);if(m)return m[1].startsWith('data-')?Object.hasOwn(this.dataset,dataKey(m[1].slice(5))):Object.hasOwn(this.attributes,m[1]);return this.tag===selector;}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  querySelectorAll(selector){return this.children.flatMap(c=>[...(c.matches(selector)?[c]:[]),...c.querySelectorAll(selector)]);}
  closest(selector){for(let node=this;node;node=node.parentElement)if(node.matches(selector))return node;return null;}
  setPointerCapture(id){this.capture=id;capture(id);}hasPointerCapture(id){return this.capture===id;}
  releasePointerCapture(id){if(this.capture===id){this.capture=null;release(id);}}
  set innerHTML(html){this.replaceChildren();const stack=[this];for(const token of String(html).match(/<[^>]*>|[^<]+/g)||[]){
   if(token.startsWith('</')){const tag=token.slice(2,-1).trim();if(stack.at(-1).tag!==tag)throw Error('Judicial source markup nesting changed');stack.pop();}
   else if(token.startsWith('<')){const tag=token.match(/^<([a-z][\w-]*)/i)?.[1];if(!allowed.has(tag))throw Error('Unsupported Judicial markup '+tag);const node=new Element(tag);for(const match of token.slice(tag.length+1,-1).matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))node.setAttribute(match[1],decode(match[2]??match[3]??match[4]??''));stack.at(-1).append(node);if(tag!=='img'&&!token.endsWith('/>'))stack.push(node);}
   else{const node=new Element('#text');node._text=decode(token);stack.at(-1).append(node);}
  }if(stack.length!==1)throw Error('Unclosed Judicial markup');}
 }
 const root=new Element('div');root.id='raidPhaseFx';
 const add=(id,cls,parent=root)=>{const n=new Element('div');n.id=id;n.className=cls;parent.append(n);return n;};
 add('raidClearText','raid-clear-text');add('raidDefeatedName','raid-defeated-name');const card=add('','raid-reward-card'),shell=add('','raid-wheel-shell',card),wheel=add('raidRewardWheel','raid-reward-wheel',shell),text=add('','raid-reward-text',card);
 add('raidRewardIcon','raid-wheel-center',shell);add('','raid-reward-kicker',text).textContent='突破補給';add('raidRewardLabel','raid-reward-label',text);add('raidRewardDescription','raid-reward-desc',text);add('raidRewardScene','raid-reward-scene',text);add('raidNextEnemyName','raid-next-enemy');
 const document={documentElement:{dataset:{platform:'android'}},hidden:false,getElementById:id=>root.id===id?root:root.querySelector('#'+id),createElement:tag=>{if(!allowed.has(tag))throw Error('Unsupported Judicial element '+tag);return new Element(tag);},createDocumentFragment:()=>new Element('#fragment'),addEventListener:(name,fn)=>{const list=listeners.get(name)||[];list.push(fn);listeners.set(name,list);}};
 const byId=id=>document.getElementById(id),control=selector=>root.querySelector(selector),image=node=>node?.querySelector('img')?.src||'';
 const project=()=>({visible:root.classList.contains('show'),phase:root.dataset.phoneRewardPhase||'',title:byId('raidClearText').textContent,defeated:byId('raidDefeatedName').textContent,next:byId('raidNextEnemyName').textContent,label:byId('raidRewardLabel').textContent,description:byId('raidRewardDescription').textContent,icon:image(byId('raidRewardIcon')),art:image(byId('raidRewardScene')),caption:byId('raidRewardScene').querySelector('figcaption')?.textContent||'',hint:control('.phone-raid-swipe-hint')?.textContent||'',primary:{label:control('[data-phone-reward-primary]')?.textContent||'',disabled:control('[data-phone-reward-primary]')?.disabled??true},skip:{label:control('[data-phone-reward-skip]')?.textContent||'',disabled:control('[data-phone-reward-skip]')?.disabled??true},offset:Number(wheel.style.transform?.match(/^translateY\(([-+\d.eE]+)px\)$/)?.[1]||0),rows:wheel.children.map(row=>({id:row.dataset.rewardId,icon:image(row),label:row.querySelector('.raid-slot-label')?.textContent||'',winning:row.classList.contains('is-winning')}))});
 return {document,root,shell,wheel,project,press(key){const n=control('[data-phone-reward-'+key+']');if(!n||n.disabled||!root.classList.contains('show'))return false;n.onclick?.();return true;},pointer(type,values={}){const fn=shell['on'+type];if(!fn)return false;fn({...values,type,preventDefault(){},stopPropagation(){}});return true;},visibility(hidden){document.hidden=!!hidden;for(const fn of listeners.get('visibilitychange')||[])fn();}};
};
