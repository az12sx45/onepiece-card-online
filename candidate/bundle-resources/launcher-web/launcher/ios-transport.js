'use strict';
window.TabletopAndroid=Object.freeze({postMessage:message=>window.webkit.messageHandlers.tabletop.postMessage(message)});
window.__poLauncherPause=()=>{for(const media of document.querySelectorAll('audio,video'))media.pause();};
