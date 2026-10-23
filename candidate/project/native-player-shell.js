'use strict';
// A small cross-language mount boundary, usable by the Android entry without
// importing QA scenes or injecting game state.
exports.create=function(node){return {
 mountLobby:async()=>node.call('mount_lobby'),mountGame:async()=>node.call('mount_game'),
 unmount:async page=>{if(!page)return;node.call('unmount',page);await new Promise(resolve=>setTimeout(resolve,16));},
 loading:()=>node.call('show_loading'),ready:page=>node.call('show_ready',page),error:text=>node.call('show_error',String(text)),
};};
