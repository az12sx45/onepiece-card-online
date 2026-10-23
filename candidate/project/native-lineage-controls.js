'use strict';
// Bounded authored-control state for board_lineage_extraction.js. It has no CSS
// layout engine or browser; geometry and drawing must be supplied by native UI.
const {parse}=require('./native-research-markup');
const camel=s=>s.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
exports.create=function({changed,bounds,extraEvents=[]}){
 if(typeof changed!=='function'||typeof bounds!=='function')throw Error('Native lineage control bindings required');
 let serial=0,structure=0,attributes=0;const nodes=new Map(),ids=new Map(),roots=[],classVersions=new Map();
 class Style{
  constructor(owner){this.owner=owner;}
  setProperty(k,v){v=String(v);if(this.owner.styles[k]===v)return;this.owner.styles[k]=v;changed();}
  removeProperty(k){if(!Object.hasOwn(this.owner.styles,k))return;delete this.owner.styles[k];changed();}
 }
 for(const key of ['left','top','width','height','transform','transition'])Object.defineProperty(Style.prototype,key,{get(){return this.owner.styles[key]||'';},set(v){this.setProperty(key,v);}});
 class Classes{
  constructor(owner){this.owner=owner;}
  contains(k){return this.owner._classes.has(k);}
  add(...keys){this.owner.className=[...new Set([...this.owner.className.split(/\s+/).filter(Boolean),...keys])].join(' ');}
  remove(...keys){this.owner.className=this.owner.className.split(/\s+/).filter(k=>!keys.includes(k)).join(' ');}
  toggle(k,force){const enabled=force===undefined?!this.contains(k):!!force;if(enabled)this.add(k);else this.remove(k);return enabled;}
 }
 class Text{
  constructor(value){this.tag='text';this.uid='lineage-text-'+(++serial);this.text=value;this.children=[];this.parent=null;this.attrs={};}
  get textContent(){return this.text;}
  querySelector(){return null;}
  querySelectorAll(){return [];}
  remove(){if(this.parent){this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;}detach(this);changed();}
 }

 class Control{
  constructor(tag='div',attrs={}){
   this.uid='lineage-node-'+(++serial);this.tag=tag;this.attrs={...attrs};this.children=[];this.parent=null;this._queries=new Map();this._classes=new Set(String(attrs.class||'').split(/\s+/).filter(Boolean));this.listeners=new Map();this.onclick=null;this.text='';this.markup='';this.dataset={};this.styles={};
   for(const [k,v]of Object.entries(attrs))if(k.startsWith('data-'))this.dataset[camel(k.slice(5))]=v;
   for(const item of String(attrs.style||'').split(';')){const i=item.indexOf(':');if(i>0)this.styles[item.slice(0,i).trim()]=item.slice(i+1).trim();}
   this.style=new Style(this);this.classList=new Classes(this);
  }
  get id(){return this.attrs.id||'';}set id(v){if(nodes.has(this.uid)){ids.delete(this.id);ids.set(String(v),this);}this.attrs.id=String(v);attributes++;changed();}
  get parentElement(){return this.parent;}
  get className(){return this.attrs.class||'';}set className(v){v=String(v);if(this.attrs.class===v)return;const next=new Set(v.split(/\s+/).filter(Boolean));for(const key of new Set([...this._classes,...next]))if(this._classes.has(key)!==next.has(key))classVersions.set(key,(classVersions.get(key)||0)+1);this._classes=next;this.attrs.class=v;changed();}
  get src(){return this.attrs.src||'';}set src(v){this.attrs.src=String(v);changed();}
  get alt(){return this.attrs.alt||'';}set alt(v){this.attrs.alt=String(v);changed();}
  get hidden(){return Object.hasOwn(this.attrs,'hidden');}set hidden(v){if(v)this.attrs.hidden='';else delete this.attrs.hidden;changed();}
  get disabled(){return Object.hasOwn(this.attrs,'disabled');}set disabled(v){if(v)this.attrs.disabled='';else delete this.attrs.disabled;changed();}
  get textContent(){return this.text+this.children.map(n=>n.textContent).join('');}set textContent(v){for(const child of [...this.children])child.remove();this.text=String(v??'');changed();}
  get innerHTML(){return this.markup;}set innerHTML(v){for(const child of [...this.children])child.remove();this.text='';this.markup=String(v);for(const n of parse(this.markup).children)this.appendChild(from(n));changed();}
  setAttribute(k,v){if(this.attrs[k]===String(v))return;attributes++;this.attrs[k]=String(v);if(k.startsWith('data-'))this.dataset[camel(k.slice(5))]=String(v);changed();}
  getAttribute(k){return this.attrs[k]??null;}
  appendChild(child){if(child.parent)child.remove();this.children.push(child);child.parent=this;attach(child);changed();return child;}
  remove(){if(this.parent){this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;}detach(this);changed();}
  querySelectorAll(selector){const revision=selector[0]==='.'?(classVersions.get(selector.slice(1))||0):attributes;const cached=this._queries.get(selector);if(cached&&cached.structure===structure&&cached.revision===revision)return cached.value;const out=[];const visit=node=>{for(const child of node.children){if(matches(child,selector))out.push(child);visit(child);}};visit(this);this._queries.set(selector,{structure,revision,value:out});return out;}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  closest(selector){if(selector!=='button')throw Error('Unknown lineage closest selector '+selector);return this.tag==='button'?this:this.parent?.closest(selector)||null;}
  addEventListener(type,fn,options={}){if(!['click','pointerdown','pointermove','pointerup','pointercancel','wheel',...extraEvents].includes(type))throw Error('Unknown lineage event '+type);if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push({fn,once:!!options.once});}
  dispatch(type,values={}){if(this.disabled)return false;const event={...values,currentTarget:this,target:values.target||this,preventDefault(){},stopPropagation(){}};for(const listener of [...this.listeners.get(type)||[]]){if(listener.once)this.listeners.set(type,this.listeners.get(type).filter(v=>v!==listener));listener.fn(event);}if(type==='click')this.onclick?.(event);return true;}
  setPointerCapture(){/* Native control owns the active touch until release. */}
  getBoundingClientRect(){const r=bounds(this);if(!r||!Number.isFinite(r.width)||!Number.isFinite(r.height))throw Error('Lineage native bounds unavailable '+this.uid);return {...r,x:r.left,y:r.top,right:r.left+r.width,bottom:r.top+r.height};}
  get offsetWidth(){return this.getBoundingClientRect().width;}get offsetHeight(){return this.getBoundingClientRect().height;}
 }
 function matches(n,s){if(n.tag==='text')return false;if(s.includes(','))return s.split(',').some(part=>matches(n,part.trim()));if(s[0]==='.')return n.classList.contains(s.slice(1));if(s[0]==='#')return n.id===s.slice(1);const m=s.match(/^\[([\w-]+)(?:=['"]([^'"]*)['"])?\]$/);if(m)return Object.hasOwn(n.attrs,m[1])&&(m[2]===undefined||n.attrs[m[1]]===m[2]);if(/^[a-z][a-z0-9]*$/.test(s))return n.tag===s;throw Error('Unknown authored lineage selector '+s);}
 function attach(node){structure++;nodes.set(node.uid,node);if(node.id)ids.set(node.id,node);for(const child of node.children)attach(child);}
 function detach(node){structure++;nodes.delete(node.uid);if(node.id)ids.delete(node.id);for(const child of node.children)detach(child);}
 function from(value){if(typeof value==='string')return new Text(value);const node=new Control(value.tag,value.attrs);for(const child of value.children)node.appendChild(from(child));return node;}
 const document={getElementById(id){return ids.get(id)||null;},createElement(tag){if(!['div','section'].includes(tag))throw Error('Unknown lineage-created control '+tag);return new Control(tag);},querySelectorAll(s){return [...nodes.values()].filter(n=>matches(n,s));},querySelector(s){return this.querySelectorAll(s)[0]||null;}};
 return{document,nodes,addRoot(tag,attrs){const node=new Control(tag,attrs);roots.push(node);attach(node);return node;},dispatch(uid,type,event){const node=nodes.get(uid);if(!node)throw Error('Removed lineage input target '+uid);return node.dispatch(type,event);},dispose(){for(const node of nodes.values()){node.listeners?.clear();node._queries?.clear();node.onclick=null;node.parent=null;node.children.length=0;if(node.style)node.style.owner=null;if(node.classList)node.classList.owner=null;}nodes.clear();ids.clear();roots.length=0;}};
};
exports.RotationMatrix=class RotationMatrix{constructor(value){const m=String(value).match(/^rotate\(([-+\d.e]+)deg\)$/);if(!m)throw Error('Unsupported native lineage rotation '+value);const angle=Number(m[1])*Math.PI/180;this.a=Math.cos(angle);this.b=Math.sin(angle);}};
