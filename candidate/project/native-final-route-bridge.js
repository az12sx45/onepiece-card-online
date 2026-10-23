'use strict';
// Only the original final-route DOM contract. Timing, map layout and unlock
// mutations remain inside the unmodified source controller.
exports.bind=function(host,application,getCore){
 const previous=host.document,view=application.get('final_route_effect'),map=application.get('map_view');let active=null,disposed=false;
 const classSet=(changed)=>{const classes=new Set();return {contains:key=>classes.has(key),add(...keys){keys.forEach(k=>classes.add(k));changed?.();},remove(...keys){keys.forEach(k=>classes.delete(k));changed?.();},text:()=>[...classes].join(' '),set(value){classes.clear();String(value).split(/\s+/).filter(Boolean).forEach(k=>classes.add(k));changed?.();}};};
 const publish=()=>{if(active&&!disposed)view.call('apply_json',JSON.stringify({classes:active.className,style:active.values,children:active.children.map(n=>({classes:n.className,style:n.values})),extent:getCore().functions.boardPixelSize()}));};
 const create=tag=>{if(tag!=='div')throw Error('Final route DOM tag not supported '+tag);const node={children:[],values:{},offsetWidth:1,style:{setProperty(key,value){node.values[key]=String(value);if(active===node)publish();}},appendChild(child){node.children.push(child);return child;},append(...children){children.forEach(c=>node.appendChild(c));},remove(){if(active===node){active=null;view.call('close_surface');application.call_deferred('emit_signal','map_controls_visibility_changed');}}};node.classList=classSet(()=>{if(active===node)publish();});Object.defineProperty(node,'className',{get:()=>node.classList.text(),set:v=>node.classList.set(v)});return node;};
 const boardMap={get offsetWidth(){return getCore().functions.boardPixelSize().width;},querySelectorAll(selector){if(selector!=='.final-island-reveal-fx')throw Error('Final map selector not supported '+selector);return active?[active]:[];},appendChild(node){if(node.className!=='final-island-reveal-fx')throw Error('Final map effect not supported '+node.className);active=node;publish();return node;}};
 boardMap.classList=classSet(()=>map.call('set_world_reveal',boardMap.classList.contains('postgame-world-map-reveal')));
 host.refs.boardGameMap=boardMap;
 host.refs.boardViewport={get clientWidth(){return application.get('size').x;},get clientHeight(){return application.get('size').y;}};
 const style={transition:'none'};Object.defineProperty(style,'transform',{set(value){const m=/^translate\(([-\d.e]+)px, ([-\d.e]+)px\) scale\(([-\d.e]+)\)$/.exec(value);if(!m)throw Error('Unknown source camera transform '+value);map.call('apply_source_camera_json',JSON.stringify({x:Number(m[1]),y:Number(m[2]),scale:Number(m[3]),immediate:style.transition==='none'}));}});host.refs.boardPanZoomLayer={style};
 host.document=new Proxy(previous,{get(target,key){if(key==='createElement')return create;if(key==='getElementById')return id=>id==='postgameWorldCinematic'?(()=>{const screen=target.querySelector('.final-ending-screen');return screen?.id===id?screen:null;})():target.getElementById(id);return Reflect.get(target,key);}});
 return {document:host.document,active:()=>active,dispose(){disposed=true;if(active)active.remove();map.call('set_world_reveal',false);}};
};

