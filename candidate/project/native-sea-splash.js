'use strict';
// Isolated source DOM boundary; does not replace the product document factory.
exports.create=(view,clock)=>{
 let disposed=false,sequence=0;const roots=new Map(),timers=new Map();
 const window={matchMedia:()=>({matches:true}),setTimeout(fn,delay){if(disposed)return 0;const id=clock.setTimeout(()=>{timers.delete(id);if(!disposed)fn();},delay);timers.set(id,{fn,delay});return id;}};
 const element=tag=>{
  if(!['div','strong','span'].includes(tag))throw Error('Unsupported splash element '+tag);
  const node={className:'',textContent:'',children:[],vars:{},append(...children){this.children.push(...children);},setAttribute(key,value){if(key!=='aria-hidden'||value!=='true')throw Error('Unsupported splash attribute');},remove(){if(roots.delete(node.id))view.call('remove_layer',node.id);}};
  node.style={setProperty:(key,value)=>{node.vars[key]=value;}};
  node.classList={add(key){if(!['show','closing'].includes(key))throw Error('Unsupported splash class '+key);if(!roots.has(node.id))return;view.call(key==='show'?'show_layer':'close_layer',node.id);}};
  return node;
 };
 const document={createElement:element,body:{appendChild(root){
  if(disposed)return;const brush=root.children.find(n=>n.className.startsWith('sea-encounter-brush'));
  if(!brush)throw Error('Original sea splash brush absent');root.id='sea-splash-'+(++sequence);roots.set(root.id,root);
  view.call('add_layer_json',JSON.stringify({id:root.id,name:brush.children[0].textContent,attack:brush.children[1].textContent}));
 }}};
 const original=require('./original-sea-splash').create({document,window,navigator:{maxTouchPoints:1}});
 return {play:name=>{if(disposed)return Promise.resolve();return original(name);},dispose(){
  if(disposed)return;disposed=true;
  // Unmount invalidates battle identity before releasing the source's wait.
  // Its callback schedules no further work after this boundary is disposed.
  const pending=[...timers.values()].filter(t=>t.delay===3450);for(const id of timers.keys())clock.clearTimeout(id);timers.clear();
  for(const root of [...roots.values()])root.remove();for(const t of pending)t.fn();
 },pending:()=>roots.size};
};
