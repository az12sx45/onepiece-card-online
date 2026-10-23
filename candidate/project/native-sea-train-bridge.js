'use strict';
// Bounded counterparts for the original train layer. The original function
// still advances its curve, controls camera timing and calls landing rules.
exports.bind=function(refs,document,view){
 let active=null,disposed=false;
 const map=view.get('map_view');let transition='none';
 refs.boardViewport={get clientWidth(){return map.get('size').x;},get clientHeight(){return map.get('size').y;}};
 const panStyle={get transition(){return transition;},set transition(v){if(!['none','transform 220ms ease'].includes(v))throw Error('Unknown train camera transition');transition=v;}};
 Object.defineProperty(panStyle,'transform',{set(v){const match=String(v).match(/^translate\(([-\d.e+]+)px, ([-\d.e+]+)px\) scale\(([-\d.e+]+)\)$/);if(!match)throw Error('Unknown native camera transform '+v);view.call('camera_json',JSON.stringify({x:Number(match[1]),y:Number(match[2]),scale:Number(match[3]),transition}));}});refs.boardPanZoomLayer={style:panStyle};
 function createLayer(tag){
  if(tag!=='div')throw Error('Unsupported train node '+tag);let className='',html='',queued=false,removed=false;const classes=new Set(),pose={x:0,y:0,angle:0,flip:1};
  const publish=()=>{if(queued||disposed||removed)return;queued=true;Promise.resolve().then(()=>{queued=false;if(!disposed&&!removed)view.call('pose_json',JSON.stringify(pose));});};
  const style={setProperty(key,v){if(key!=='--sea-train-facing-flip')throw Error('Unknown train style '+key);pose.flip=Number(v);publish();}};
  for(const [name,key]of [['left','x'],['top','y']])Object.defineProperty(style,name,{set(v){if(!/^-?[\d.]+px$/.test(v))throw Error('Invalid train position');pose[key]=parseFloat(v);publish();}});
  Object.defineProperty(style,'transform',{set(v){const m=String(v).match(/^translate\(-50%,-50%\) rotate\(([-\d.e+]+)deg\)$/);if(!m)throw Error('Unknown train transform '+v);pose.angle=Number(m[1]);publish();}});
  const token={style},layer={get className(){return className;},set className(v){if(v!=='sea-train-map-layer')throw Error('Unsupported native created layer '+v);className=v;},get innerHTML(){return html;},set innerHTML(value){html=String(value);const path=html.match(/class="sea-train-map-track-reveal"[^>]*d="M ([\d.e+-]+) ([\d.e+-]+) Q ([\d.e+-]+) ([\d.e+-]+) ([\d.e+-]+) ([\d.e+-]+)"/),frames=[...html.matchAll(/class="sea-train-map-frame" src="([^"]+)"/g)].map(m=>m[1]),size=html.match(/--sea-train-token-size:([\d.]+)px/),correction=html.match(/--sea-train-sprite-correction:([-\d.]+)deg/);if(!path||frames.length!==4||!size||!correction)throw Error('Original train presentation markup changed');layer.model={start:{x:Number(path[1]),y:Number(path[2])},control:{x:Number(path[3]),y:Number(path[4])},end:{x:Number(path[5]),y:Number(path[6])},frames,tokenSize:Number(size[1]),correction:Number(correction[1])};},querySelector(s){if(s!=='.sea-train-map-token')throw Error('Unknown train layer selector '+s);return token;},classList:{add(...keys){for(const key of keys){if(!['moving','train-moving','arrived'].includes(key))throw Error('Unknown train layer class '+key);classes.add(key);view.call('set_phase',key);}}},remove(){removed=true;active=null;view.call('finish');}};return layer;
 }
 refs.boardGameMap={appendChild(layer){if(active||!layer.model)throw Error('Invalid native train layer');active=layer;view.call('prepare_json',JSON.stringify(layer.model));},querySelector(selector){const match=selector.match(/^\.ship-token\[data-player-id="([^"]+)"\]$/);if(!match)throw Error('Unknown train ship selector '+selector);return{classList:{add(key){if(!['sea-train-transforming-source','sea-train-hidden-source'].includes(key))throw Error('Unknown train ship class');view.call('ship_state',match[1],key);}}};}};
 return{document:new Proxy(document,{get(target,key){if(key==='createElement')return createLayer;return target[key];}}),dispose(){disposed=true;if(active)active.remove();}};
};
