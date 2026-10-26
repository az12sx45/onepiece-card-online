'use strict';
// The authored Marineford control tree retains its original listeners and
// selected values. Layout, media playback and hit testing belong to Godot.
const {parse}=require('./native-research-markup');
const camel=s=>s.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
exports.create=function(catalog,{changed=()=>{},geometry,video,extraTags=[],extraEvents=[]}={}){
 let serial=0;const ids=new Map(),nodes=new Map();
 const tags=new Set(['body','main','header','section','aside','footer','div','span','strong','small','h1','h2','h3','b','p','ul','li','br','img','button','article','video',...extraTags]);
 const matches=(n,selector)=>{
  const m=selector.trim().match(/^([a-z][\w-]*)?((?:[.#][\w-]+)*)(?:\[([\w-]+)(?:=['"]([^'"]*)['"])?\])?$/);if(!m)throw Error('Unbound Marineford selector '+selector);
  if(n.tag==='text'||m[1]&&n.tag!==m[1])return false;
  for(const part of m[2].match(/[.#][\w-]+/g)||[])if(part[0]==='#'?n.id!==part.slice(1):!n.classList.contains(part.slice(1)))return false;
  return !m[3]||(n.hasAttribute(m[3])&&(m[4]===undefined||n.getAttribute(m[3])===m[4]));
 };
 function selected(n,s){if(s.includes(' > ')){const [parent,child,...extra]=s.split(' > ');if(extra.length)throw Error('Unbound Marineford child selector '+s);return matches(n,child)&&n.parent&&matches(n.parent,parent);}return matches(n,s);}
 class Control{
  constructor(tag,attrs={},text=''){
   if(tag!=='text'&&!tags.has(tag))throw Error('Unbound Marineford control '+tag);
   this.tag=tag;this.uid='marine-'+(++serial);this.attrs={...attrs};this.childNodes=[];this.parent=null;this.listeners=new Map();this.text=text;this.markup='';this.dataset={};this.styles={};this._classes=new Set(String(attrs.class||'').split(/\s+/).filter(Boolean));
   for(const [k,v]of Object.entries(attrs))if(k.startsWith('data-'))this.dataset[camel(k.slice(5))]=v;
   for(const entry of String(attrs.style||'').split(';')){const at=entry.indexOf(':');if(at>0)this.styles[entry.slice(0,at).trim()]=entry.slice(at+1).trim();}
   const set=(k,v)=>{if(this.styles[k]!==String(v)){this.styles[k]=String(v);changed();}};
   this.style=new Proxy({setProperty:set,getPropertyValue:k=>this.styles[k]||'',removeProperty:k=>{delete this.styles[k];changed();}}, {get:(o,k)=>k in o?o[k]:this.styles[k]||'',set:(_o,k,v)=>{set(k,v);return true;}});
   this.classList={contains:k=>this._classes.has(k),add:(...ks)=>{this.className=[...new Set([...this._classes,...ks])].join(' ');},remove:(...ks)=>{this.className=[...this._classes].filter(k=>!ks.includes(k)).join(' ');},toggle:(k,force)=>{const on=force===undefined?!this._classes.has(k):!!force;if(on)this.classList.add(k);else this.classList.remove(k);return on;}};
   if(tag==='video'){if(typeof video!=='function')throw Error('Marineford native video backend required');video(this);}
  }
  get id(){return this.attrs.id||'';}set id(v){if(nodes.has(this.uid))ids.delete(this.id);this.attrs.id=String(v);if(nodes.has(this.uid))ids.set(this.id,this);changed();}
  get className(){return this.attrs.class||'';}set className(v){v=String(v);if(v===this.className)return;this.attrs.class=v;this._classes=new Set(v.split(/\s+/).filter(Boolean));changed();}
  get src(){return this.attrs.src||'';}set src(v){if(this.attrs.src===String(v))return;this.attrs.src=String(v);changed();}
  get alt(){return this.attrs.alt||'';}set alt(v){this.attrs.alt=String(v);changed();}
  get disabled(){return this.hasAttribute('disabled');}set disabled(v){if(v)this.setAttribute('disabled','');else this.removeAttribute('disabled');}
  get hidden(){return this.hasAttribute('hidden');}set hidden(v){if(v)this.setAttribute('hidden','');else this.removeAttribute('hidden');}
  get children(){return this.childNodes.filter(n=>n.tag!=='text');}get parentElement(){return this.parent;}get nextElementSibling(){return this.parent?.children.filter(n=>n.tag!=='text').find((n,i,list)=>list[i-1]===this)||null;}
  get textContent(){return this.text+this.childNodes.map(n=>n.textContent).join('');}set textContent(value){this.clear();this.text=String(value??'');changed();}
  get innerHTML(){return this.markup;}set innerHTML(value){this.clear();this.markup=String(value);for(const child of parse(this.markup).children)this.appendChild(from(child));changed();}
  setAttribute(k,v){v=String(v);if(this.attrs[k]===v)return;if(k==='class'){this.className=v;return;}if(k==='id'){this.id=v;return;}this.attrs[k]=v;if(k.startsWith('data-'))this.dataset[camel(k.slice(5))]=v;changed();}
  getAttribute(k){return this.attrs[k]??null;}hasAttribute(k){return Object.hasOwn(this.attrs,k);}
  removeAttribute(k){if(!this.hasAttribute(k))return;if(k==='id')ids.delete(this.id);delete this.attrs[k];if(k.startsWith('data-'))delete this.dataset[camel(k.slice(5))];changed();}
  clear(){for(const c of [...this.childNodes])c.remove();this.text='';this.markup='';}
  appendChild(n){if(n.parent)n.remove();n.parent=this;this.childNodes.push(n);attach(n);changed();return n;}
  remove(){if(this.parent)this.parent.childNodes=this.parent.childNodes.filter(n=>n!==this);this.parent=null;detach(this);changed();}
  cloneNode(deep){const n=new Control(this.tag,this.attrs,this.text);n.styles={...this.styles};if(deep)for(const child of this.childNodes)n.appendChild(child.cloneNode(true));return n;}
  querySelectorAll(s){const result=[];const visit=n=>{for(const c of n.childNodes){if(selected(c,s))result.push(c);visit(c);}};visit(this);return result;}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
  contains(child){for(let n=child;n;n=n.parent)if(n===this)return true;return false;}
  closest(s){for(let n=this;n;n=n.parent)if(selected(n,s))return n;return null;}
  addEventListener(type,fn,opts={}){if(!['click','keydown','visibilitychange','error','ended','loadedmetadata','playing','canplay',...extraEvents].includes(type))throw Error('Unbound Marineford event '+type);const list=this.listeners.get(type)||[];list.push({fn,once:!!opts.once});this.listeners.set(type,list);}
  removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)||[]).filter(x=>x.fn!==fn));}
  async dispatch(type,values={}){if(type==='click'&&(this.disabled||this.hidden))return false;const chain=[];for(let n=this;n;n=n.parent)chain.push(n);const pending=[];let stopped=false,immediate=false;const event={target:this,...values,preventDefault(){},stopPropagation(){stopped=true;},stopImmediatePropagation(){stopped=true;immediate=true;}};for(const n of chain){event.currentTarget=n;for(const item of [...n.listeners.get(type)||[]]){if(item.once)n.removeEventListener(type,item.fn);const result=item.fn(event);if(result?.then)pending.push(result);if(immediate)break;}if(stopped)break;}await Promise.all(pending);changed();return true;}
  click(){return this.dispatch('click');}
  getBoundingClientRect(){if(typeof geometry!=='function')throw Error('Marineford native geometry required');const r=geometry(this);if(!r||!Number.isFinite(r.width))throw Error('Missing Marineford geometry '+this.uid);return {...r,x:r.left,y:r.top,right:r.left+r.width,bottom:r.top+r.height};}
  get offsetWidth(){return this.getBoundingClientRect().width;}
 }
 function attach(n){nodes.set(n.uid,n);if(n.id)ids.set(n.id,n);for(const c of n.childNodes)attach(c);}
 function detach(n){nodes.delete(n.uid);if(n.id&&ids.get(n.id)===n)ids.delete(n.id);for(const c of n.childNodes)detach(c);}
 function from(n){if(typeof n==='string')return new Control('text',{},n);const value=new Control(n.tag,n.attrs||n.attributes||{},n.text||'');for(const child of n.children||[])value.appendChild(from(child));return value;}
 const body=from(catalog);attach(body);
 const document={body,hidden:false,getElementById:id=>ids.get(id)||null,querySelectorAll:s=>[...(selected(body,s)?[body]:[]),...body.querySelectorAll(s)],querySelector(s){return this.querySelectorAll(s)[0]||null;},createElement:tag=>new Control(tag),addEventListener:(...args)=>body.addEventListener(...args),removeEventListener:(...args)=>body.removeEventListener(...args)};
 return {document,nodes,ids,dispatch(uid,type,event){const node=nodes.get(uid);if(!node)throw Error('Expired Marineford input '+uid);return node.dispatch(type,event);},dispose(){for(const n of nodes.values()){n.listeners.clear();n.parent=null;n.childNodes.length=0;}nodes.clear();ids.clear();}};
};
