'use strict';
// Bounded original lobby control model, not an HTML renderer. Only the source
// templates' element operations are accepted; drawing is done by Godot Controls.
const decode=s=>String(s).replace(/&quot;/g,'"').replace(/&#39;|&#x27;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const camel=s=>s.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
exports.create=function(catalog,onChange=()=>{}){
 let serial=0;const nodes=new Map();
 const match=(node,selector)=>{
  if(/^#[\w-]+$/.test(selector))return node.id===selector.slice(1);
  if(/^\.[\w-]+$/.test(selector))return node.classList.contains(selector.slice(1));
  const attribute=selector.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);
  if(attribute){const value=node.getAttribute(attribute[1]);return value!==null&&(attribute[2]===undefined||value===attribute[2]);}
  if(/^[a-z][a-z0-9]*$/.test(selector))return node.tagName===selector;
  throw Error('Lobby selector not implemented: '+selector);
 };
 class Control{
  constructor(tag='div',id=''){this.tagName=tag;this.id=id||'lobby-dynamic-'+(++serial);this.children=[];this.parent=null;this.attributes={};this.dataset={};this.style={};this.listeners=new Map();this._text='';this._html='';this.value='';this.disabled=false;this.hidden=false;this.title='';this.src='';this.open=false;this.scrollTop=0;this.scrollHeight=0;const classes=new Set();this.classList={contains:s=>classes.has(s),add(...args){args.forEach(s=>classes.add(s));onChange();},remove(...args){args.forEach(s=>classes.delete(s));onChange();},toggle(s,force){const yes=force===undefined?!classes.has(s):!!force;if(yes)classes.add(s);else classes.delete(s);onChange();return yes;}};Object.defineProperty(this,'className',{get:()=>[...classes].join(' '),set:value=>{classes.clear();String(value).split(/\s+/).filter(Boolean).forEach(s=>classes.add(s));onChange();}});}
  setAttribute(name,value){value=String(value);this.attributes[name]=value;if(name==='class')this.className=value;else if(name==='id')this.id=value;else if(name.startsWith('data-'))this.dataset[camel(name.slice(5))]=value;else if(name==='disabled')this.disabled=true;else if(name==='hidden')this.hidden=true;else if(['src','title','value'].includes(name))this[name]=value;onChange();}
  getAttribute(name){if(name==='class')return this.className;if(name==='id')return this.id;if(name.startsWith('data-'))return this.dataset[camel(name.slice(5))]??null;return this.attributes[name]??null;}
  get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
  get options(){if(this.tagName!=='select')throw Error('Options requested on non-select');return this.children.filter(n=>n.tagName==='option');}
  get value(){return this.tagName==='select'?this.options[this._selectedIndex??-1]?.value??'':this._value??'';}
  set value(value){this._value=String(value??'');if(this.tagName==='select')this._selectedIndex=this.options.findIndex(o=>o.value===this._value);onChange();}
  get disabled(){return this._disabled===true;}
  set disabled(value){this._disabled=!!value;onChange();}
  get hidden(){return this._hidden===true;}
  set hidden(value){this._hidden=!!value;onChange();}
  set textContent(value){this._text=String(value??'');this._html='';this.children=[];onChange();}
  get innerHTML(){return this._html;}
  set innerHTML(value){this._html=String(value);this._text='';this.children=[];parse(this._html,this);onChange();}
  appendChild(child){child.parent=this;this.children.push(child);if(this.tagName==='select'&&child.tagName==='option'&&(this._selectedIndex??-1)<0)this._selectedIndex=0;onChange();return child;}
  replaceChildren(...children){this.children=[];this._text='';this._html='';this._selectedIndex=-1;children.forEach(child=>this.appendChild(child));onChange();}
  add(child){if(this.tagName!=='select')throw Error('Option added to non-select');this.appendChild(child);}
  querySelectorAll(selector){const found=[];const visit=node=>{for(const child of node.children){if(match(child,selector))found.push(child);visit(child);}};visit(this);return found;}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  addEventListener(type,callback){if(!['click','input','change','blur','keydown','close','toggle','submit'].includes(type))throw Error('Lobby event not implemented: '+type);const list=this.listeners.get(type)||[];list.push(callback);this.listeners.set(type,list);}
  dispatch(type,extra={}){if(type==='click'&&(this.disabled||this.hidden||this.style.display==='none'))return false;for(const callback of this.listeners.get(type)||[])callback({target:this,preventDefault(){},...extra});onChange();return true;}
  click(){return this.dispatch('click');}
  checkValidity(){
   if(this.tagName==='form')return this.querySelectorAll('input').every(node=>node.checkValidity());
   if(this.tagName!=='input')throw Error('Validation not implemented for '+this.tagName);
   if(this.disabled)return true;
   if(this.getAttribute('required')!==null&&!this.value)return false;
   const pattern=this.getAttribute('pattern');if(!this.value||pattern===null)return true;
   const validation=catalog.validationPatterns?.[pattern];if(!validation)throw Error('Original form pattern not catalogued');
   // HTML ignores syntactically invalid UnicodeSets patterns. Capture this at
   // extraction time, rather than accidentally tightening the original form.
   return !validation.valid||new RegExp('^(?:'+pattern+')$','u').test(this.value);
  }
  blur(){return this.dispatch('blur');}
  focus(){document.activeElement=this;}
  showModal(){this.open=true;onChange();}
  close(){this.open=false;this.dispatch('close');}
 }
 const tags=new Set(['div','span','button','article','img','p','strong','small','label','input','select','option','details','summary','ul','li','b','br','time','h3','h4','form']);
 function parse(html,parent){
  const stack=[parent];for(const token of html.match(/<[^>]*>|[^<]+/g)||[]){
   if(token.startsWith('</')){const name=token.slice(2,-1).trim().toLowerCase();if(stack.length<2||stack.at(-1).tagName!==name)throw Error('Invalid original lobby markup '+name);stack.pop();continue;}
   if(token.startsWith('<')){const tag=token.match(/^<([a-z][a-z0-9]*)\b/i)?.[1].toLowerCase();if(!tags.has(tag))throw Error('Lobby markup not implemented: '+token);const node=new Control(tag);const attrs=token.slice(tag.length+1,-1);for(const m of attrs.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))node.setAttribute(m[1],decode(m[2]??m[3]??m[4]??''));stack.at(-1).appendChild(node);if(!['img','br','input'].includes(tag)&&!token.endsWith('/>'))stack.push(node);}
   else{const text=new Control('text');text._text=decode(token);stack.at(-1).appendChild(text);}
  }if(stack.length!==1)throw Error('Unclosed original lobby markup');
 }
 for(const item of catalog.controls){const node=new Control(item.tag,item.id);node.textContent=item.text;node.caption=item.caption;for(const [key,value]of Object.entries(item.attributes))node.setAttribute(key,value);nodes.set(item.id,node);}
 function hydrate(item){const node=item.id&&nodes.has(item.id)?nodes.get(item.id):new Control(item.tag,item.id);node.replaceChildren();if(item.tag==='text')node.textContent=item.text;for(const [key,value]of Object.entries(item.attributes||{}))node.setAttribute(key,value);for(const child of item.children||[])node.appendChild(hydrate(child));return node;}
 for(const item of catalog.trees||[])hydrate(item);
 const views=catalog.views.map(view=>{const n=new Control('section','view-'+view);n.dataset.view=view;return n;});
 const refs=Object.fromEntries(catalog.refs.map(key=>[key,key==='views'?views:nodes.get(key)]));
 for(const [key,value]of Object.entries(refs))if(!value)throw Error('Original lobby ref missing '+key);
 const document={activeElement:null,body:{dataset:{entryAuthSource:'native-account'}},createElement(tag){if(!tags.has(tag))throw Error('Lobby element not implemented '+tag);return new Control(tag);},getElementById(id){if(nodes.has(id))return nodes.get(id);if(['boardDockMeAva','boardDockMeName'].includes(id))return null;throw Error('Lobby control not implemented '+id);},querySelectorAll(selector){if(selector==='.view')return views;if(selector==='[data-campaign-view]')return [...nodes.values()].filter(n=>n.dataset.campaignView);if(selector==='#boardCampaignPanel button')return nodes.get('boardCampaignPanel').querySelectorAll('button');throw Error('Lobby root selector not implemented '+selector);}};
 return {refs,document,nodes,views,Control};
};
