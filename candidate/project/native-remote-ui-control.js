'use strict';
// Only the original remote-playback cleanup contract. Visibility and event id
// are read from the actual native widget, never from a separate fake DOM flag.
exports.create=function(surface){
 const dataset=new Proxy({}, {get(_target,key){if(key!=='boardUiEventId')return undefined;return String(surface.get('remote_event_id')||'')||undefined;},deleteProperty(_target,key){if(key!=='boardUiEventId')throw Error('Unknown remote UI data key');surface.set('remote_event_id','');return true;}});
 return {dataset,classList:{contains:key=>key==='open'&&surface.call('is_visible'),remove(...keys){if(keys.some(key=>key!=='open'))throw Error('Unknown remote UI class');surface.call('cancel_remote','');}},setAttribute(key,value){if(key!=='aria-hidden'||value!=='true')throw Error('Unsupported remote UI attribute');surface.call('cancel_remote','');}};
};
